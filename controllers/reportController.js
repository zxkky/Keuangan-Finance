const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { dateRange } = require('../utils/period');
const { profitLoss, cashFlow, health } = require('../utils/finance');
const ex = require('../utils/exporter');
const v = require('../utils/validate');

async function context(req) {
  const { from, to } = dateRange(req.query.from, req.query.to);
  const businessId = v.id(req.query.business_id);
  const [businesses] = await db.query('SELECT id, name FROM businesses ORDER BY name');
  const business = businesses.find((b) => b.id === businessId) || null;
  return { from, to, businessId: business ? business.id : null, business, businesses };
}

exports.profitLoss = wrap(async (req, res) => {
  const c = await context(req);
  const pl = await profitLoss(c.from, c.to, c.businessId);
  res.render('reports/pl', { title: 'Laporan laba rugi', ...c, pl, health: health(pl) });
});

exports.cashFlow = wrap(async (req, res) => {
  const c = await context(req);
  const cf = await cashFlow(c.from, c.to, c.businessId);
  res.render('reports/cashflow', { title: 'Laporan cash flow', ...c, cf });
});

exports.export = wrap(async (req, res) => {
  const kind = req.params.kind;
  const format = req.query.format === 'xlsx' ? 'xlsx' : 'pdf';
  if (!['laba-rugi', 'cash-flow'].includes(kind)) return res.redirect('/laporan/laba-rugi');
  const c = await context(req);
  const isPl = kind === 'laba-rugi';
  const rows = isPl
    ? ex.plRows(await profitLoss(c.from, c.to, c.businessId))
    : ex.cfRows(await cashFlow(c.from, c.to, c.businessId));
  const opts = {
    title: isPl ? 'Laporan Laba Rugi' : 'Laporan Cash Flow',
    subtitle: ex.subtitleFor(c.from, c.to, c.business && c.business.name),
    rows,
    filename: `${kind}-${c.from}_${c.to}`,
  };
  return format === 'pdf' ? ex.toPdf(res, opts) : ex.toExcel(res, opts);
});
