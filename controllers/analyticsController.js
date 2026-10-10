const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { monthRange } = require('../utils/period');
const { monthlySeries, businessPerformance } = require('../utils/finance');
const { rupiah, persen } = require('../utils/format');

exports.index = wrap(async (req, res) => {
  const per = monthRange(req.query.month);
  const [series, perf] = await Promise.all([monthlySeries(per.month, 6), businessPerformance(per.start, per.end)]);

  const [rows] = await db.query(
    `SELECT p.name, b.name AS business, SUM(si.quantity) AS qty, SUM(si.subtotal) AS revenue, SUM(si.quantity * si.cost) AS hpp
       FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id JOIN businesses b ON b.id = p.business_id
      WHERE s.transaction_date BETWEEN ? AND ? GROUP BY p.id, p.name, b.name`, [per.start, per.end]);
  const products = rows.map((r) => {
    const profit = r.revenue - r.hpp;
    return { ...r, profit, unitProfit: r.qty ? profit / r.qty : 0, margin: r.revenue ? (profit / r.revenue) * 100 : 0 };
  });
  const topSelling = [...products].sort((a, b) => b.qty - a.qty).slice(0, 8);
  const topProfit = [...products].sort((a, b) => b.profit - a.profit).slice(0, 8);

  // Kalimat ringkasan otomatis.
  const insights = [];
  const cur = series[series.length - 1];
  const prev = series[series.length - 2];
  if (prev && prev.net > 0) {
    const ch = ((cur.net - prev.net) / prev.net) * 100;
    insights.push(`Profit bersih ${ch >= 0 ? 'naik' : 'turun'} ${Math.abs(ch).toFixed(0)}% dibanding bulan lalu (${rupiah(prev.net)} menjadi ${rupiah(cur.net)}).`);
  } else if (prev && prev.net <= 0 && cur.net > 0) {
    insights.push(`Profit bersih bulan ini ${rupiah(cur.net)}, membaik dari bulan lalu yang ${rupiah(prev.net)}.`);
  }
  if (topSelling[0]) insights.push(`Produk paling laku: ${topSelling[0].name} (${topSelling[0].qty} terjual).`);
  if (topProfit[0]) insights.push(`Penyumbang laba terbesar: ${topProfit[0].name} dengan laba kotor ${rupiah(topProfit[0].profit)} (margin ${persen(topProfit[0].margin)}).`);
  const lowMargin = products.filter((p) => p.margin < 20 && p.qty > 0).sort((a, b) => a.margin - b.margin)[0];
  if (lowMargin) insights.push(`Margin ${lowMargin.name} hanya ${persen(lowMargin.margin)}. Pertimbangkan menaikkan harga atau menekan HPP.`);
  const bestBiz = [...perf.rows].filter((r) => r.id).sort((a, b) => b.net - a.net)[0];
  if (bestBiz && bestBiz.net > 0) insights.push(`Usaha dengan profit tertinggi: ${bestBiz.name} (${rupiah(bestBiz.net)}).`);

  res.render('analytics/index', { title: 'Analitik', per, series, perf: perf.rows, topSelling, topProfit, insights });
});
