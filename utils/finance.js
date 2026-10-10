const db = require('../config/database');
const { monthRange } = require('./period');

const num = (v) => Number(v) || 0;
const sum = (list) => list.reduce((s, i) => s + i.total, 0);

/**
 * Laba rugi untuk satu periode.
 * Omzet      = pemasukan berkategori "revenue"
 * HPP        = (qty x cost) item penjualan + pengeluaran kategori "cogs"
 * Operasional= pengeluaran "operational" dan "other"
 * Modal, pinjaman, dan pembelian stok TIDAK masuk laba rugi (hanya cash flow).
 */
async function profitLoss(start, end, businessId = null) {
  const p = [start, end];
  let bw = '';
  if (businessId) { bw = ' AND t.business_id = ?'; p.push(businessId); }

  const [rows] = await db.query(
    `SELECT c.name, c.category_type AS ct, t.type, SUM(t.amount) AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.transaction_date BETWEEN ? AND ?${bw}
      GROUP BY c.name, c.category_type, t.type`, p);

  const sp = [start, end];
  let sw = '';
  if (businessId) { sw = ' AND s.business_id = ?'; sp.push(businessId); }
  const [[h]] = await db.query(
    `SELECT COALESCE(SUM(si.quantity * si.cost), 0) AS hpp
       FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.transaction_date BETWEEN ? AND ?${sw}`, sp);

  const r = { revenue: [], cogs: [], opex: [], otherIncome: [], cashIn: 0, cashOut: 0 };
  for (const x of rows) {
    const item = { name: x.name, total: num(x.total) };
    if (x.type === 'income') {
      r.cashIn += item.total;
      if (x.ct === 'revenue') r.revenue.push(item);
      else if (x.ct === 'other') r.otherIncome.push(item);
    } else {
      r.cashOut += item.total;
      if (x.ct === 'cogs') r.cogs.push(item);
      else if (x.ct === 'operational' || x.ct === 'other') r.opex.push(item);
    }
  }
  r.salesHpp = num(h.hpp);
  r.revenueTotal = sum(r.revenue);
  r.cogsManual = sum(r.cogs);
  r.hppTotal = r.salesHpp + r.cogsManual;
  r.grossProfit = r.revenueTotal - r.hppTotal;
  r.opexTotal = sum(r.opex);
  r.otherIncomeTotal = sum(r.otherIncome);
  r.netProfit = r.grossProfit - r.opexTotal + r.otherIncomeTotal;
  r.grossMargin = r.revenueTotal > 0 ? (r.grossProfit / r.revenueTotal) * 100 : 0;
  r.netMargin = r.revenueTotal > 0 ? (r.netProfit / r.revenueTotal) * 100 : 0;
  return r;
}

// Penilaian kesehatan keuangan berdasarkan margin.
function health(pl) {
  if (pl.revenueTotal <= 0) {
    return { level: 'kosong', title: 'Belum ada omzet', message: 'Catat penjualan atau pemasukan usaha untuk melihat kesehatan keuangan periode ini.' };
  }
  const opexShare = pl.grossProfit > 0 ? (pl.opexTotal / pl.grossProfit) * 100 : 100;
  if (pl.netProfit < 0) {
    return { level: 'perhatian', title: 'Rugi pada periode ini', message: `Biaya melebihi laba kotor. Operasional menghabiskan ${Math.round(opexShare)}% laba kotor.` };
  }
  if (pl.netMargin >= 20) {
    return { level: 'sehat', title: 'Sehat', message: 'Biaya operasional masih dalam batas yang baik dan sebagian besar laba kotor menjadi profit.' };
  }
  if (pl.netMargin >= 10) {
    return { level: 'waspada', title: 'Cukup, perlu dijaga', message: `Operasional mengambil ${Math.round(opexShare)}% laba kotor. Cek biaya yang bisa ditekan.` };
  }
  return { level: 'perhatian', title: 'Perlu perhatian', message: `Sebagian besar laba kotor habis untuk operasional (${Math.round(opexShare)}%). Margin bersih hanya ${pl.netMargin.toFixed(1).replace('.', ',')}%.` };
}

// Arus kas: semua uang masuk dan keluar, termasuk modal, pinjaman, dan pembelian stok.
async function cashFlow(start, end, businessId = null) {
  const p = [start, end];
  let bw = '';
  if (businessId) { bw = ' AND t.business_id = ?'; p.push(businessId); }
  const [rows] = await db.query(
    `SELECT c.name, t.type, SUM(t.amount) AS total
       FROM transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.transaction_date BETWEEN ? AND ?${bw}
      GROUP BY c.name, t.type ORDER BY total DESC`, p);
  const inflow = rows.filter((x) => x.type === 'income').map((x) => ({ name: x.name, total: num(x.total) }));
  const outflow = rows.filter((x) => x.type === 'expense').map((x) => ({ name: x.name, total: num(x.total) }));
  const totalIn = sum(inflow);
  const totalOut = sum(outflow);
  const net = totalIn - totalOut;

  let opening = null;
  let closing = null;
  if (!businessId) {
    const [[a]] = await db.query('SELECT COALESCE(SUM(initial_balance),0) AS v FROM accounts');
    const [[b]] = await db.query("SELECT COALESCE(SUM(IF(type='income', amount, -amount)),0) AS v FROM transactions WHERE transaction_date < ?", [start]);
    opening = num(a.v) + num(b.v);
    closing = opening + net;
  }
  return { inflow, outflow, totalIn, totalOut, net, opening, closing };
}

// Saldo setiap akun = saldo awal + pemasukan - pengeluaran +/- transfer.
async function accountBalances() {
  const [rows] = await db.query(
    `SELECT a.id, a.name, a.type, a.initial_balance,
        a.initial_balance
        + COALESCE((SELECT SUM(IF(t.type='income', t.amount, -t.amount)) FROM transactions t WHERE t.account_id = a.id), 0)
        - COALESCE((SELECT SUM(amount) FROM transfers WHERE from_account_id = a.id), 0)
        + COALESCE((SELECT SUM(amount) FROM transfers WHERE to_account_id = a.id), 0) AS balance
       FROM accounts a ORDER BY a.name`);
  return rows.map((r) => ({ ...r, balance: num(r.balance) }));
}

// Deret bulanan (terlama ke terbaru) untuk grafik tren.
async function monthlySeries(endMonth, count = 6) {
  const months = [];
  let cur = monthRange(endMonth);
  for (let i = 0; i < count; i++) { months.unshift(cur); cur = monthRange(cur.prev); }
  return Promise.all(months.map(async (m) => {
    const pl = await profitLoss(m.start, m.end);
    return { month: m.month, label: m.short, income: pl.cashIn, expense: pl.cashOut, revenue: pl.revenueTotal, net: pl.netProfit };
  }));
}

// Performa per usaha, ditambah baris "Umum" untuk biaya yang tidak terikat usaha.
async function businessPerformance(start, end) {
  const [biz] = await db.query('SELECT id, name, initial_capital FROM businesses ORDER BY name');
  const total = await profitLoss(start, end);
  const rows = [];
  for (const b of biz) {
    const pl = await profitLoss(start, end, b.id);
    if (pl.revenueTotal || pl.hppTotal || pl.opexTotal) {
      rows.push({ id: b.id, name: b.name, revenue: pl.revenueTotal, hpp: pl.hppTotal, gross: pl.grossProfit, net: pl.netProfit, margin: pl.netMargin });
    }
  }
  const gRevenue = total.revenueTotal - rows.reduce((s, r) => s + r.revenue, 0);
  const gNet = total.netProfit - rows.reduce((s, r) => s + r.net, 0);
  if (Math.abs(gRevenue) > 0.5 || Math.abs(gNet) > 0.5) {
    rows.push({ id: null, name: 'Umum (tanpa usaha)', revenue: gRevenue, hpp: 0, gross: gRevenue, net: gNet, margin: gRevenue > 0 ? (gNet / gRevenue) * 100 : 0 });
  }
  return { rows, total };
}

module.exports = { profitLoss, health, cashFlow, accountBalances, monthlySeries, businessPerformance };
