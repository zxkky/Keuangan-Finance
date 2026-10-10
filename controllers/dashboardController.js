const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { monthRange } = require('../utils/period');
const f = require('../utils/finance');

exports.index = wrap(async (req, res) => {
  const per = monthRange(req.query.month);
  const [pl, series, perf, balances, [recent], [[target]]] = await Promise.all([
    f.profitLoss(per.start, per.end),
    f.monthlySeries(per.month, 6),
    f.businessPerformance(per.start, per.end),
    f.accountBalances(),
    db.query(
      `SELECT t.*, c.name AS category, b.name AS business, a.name AS account
         FROM transactions t JOIN categories c ON c.id = t.category_id
         JOIN accounts a ON a.id = t.account_id LEFT JOIN businesses b ON b.id = t.business_id
        ORDER BY t.transaction_date DESC, t.id DESC LIMIT 8`),
    db.query('SELECT * FROM targets WHERE month = ?', [per.month]),
  ]);

  // Perbandingan profit dengan bulan sebelumnya.
  const prev = series.length > 1 ? series[series.length - 2] : null;
  let trend = null;
  if (prev && prev.net > 0 && pl.netProfit !== 0) trend = ((pl.netProfit - prev.net) / prev.net) * 100;

  res.render('dashboard', {
    title: 'Dashboard', per, pl, health: f.health(pl), series, perf: perf.rows, balances,
    totalBalance: balances.reduce((s, a) => s + a.balance, 0), recent, target: target || null, trend, prev,
  });
});
