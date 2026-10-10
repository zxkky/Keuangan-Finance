const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const { monthRange } = require('../utils/period');
const v = require('../utils/validate');

exports.index = wrap(async (req, res) => {
  const per = monthRange(req.query.month);
  const [[current]] = await db.query('SELECT * FROM targets WHERE month = ?', [per.month]);
  const [targets] = await db.query('SELECT * FROM targets ORDER BY month DESC LIMIT 12');
  res.render('settings/index', { title: 'Pengaturan', per, current: current || null, targets });
});

exports.saveTarget = wrap(async (req, res) => {
  try {
    const month = monthRange(req.body.month).month;
    const rev = v.amount(req.body.revenue_target || 0, 'Target omzet', { allowZero: true });
    const profit = v.amount(req.body.profit_target || 0, 'Target profit', { allowZero: true });
    await db.query(
      `INSERT INTO targets (month, revenue_target, profit_target) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE revenue_target = VALUES(revenue_target), profit_target = VALUES(profit_target)`, [month, rev, profit]);
    req.flash('success', 'Target disimpan.');
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/pengaturan');
});

exports.changePassword = wrap(async (req, res) => {
  try {
    const [[u]] = await db.query('SELECT password FROM users WHERE id = ?', [req.session.user.id]);
    if (!(await bcrypt.compare(String(req.body.current || ''), u.password))) throw new UserError('Password saat ini salah.');
    if (String(req.body.next || '').length < 8) throw new UserError('Password baru minimal 8 karakter.');
    if (req.body.next !== req.body.confirm) throw new UserError('Konfirmasi password tidak sama.');
    await db.query('UPDATE users SET password = ? WHERE id = ?', [await bcrypt.hash(req.body.next, 10), req.session.user.id]);
    req.flash('success', 'Password diganti.');
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/pengaturan');
});
