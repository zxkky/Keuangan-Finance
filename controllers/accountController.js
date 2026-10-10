const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const v = require('../utils/validate');
const { accountBalances } = require('../utils/finance');

const TYPES = ['kas', 'bank', 'ewallet'];

exports.index = wrap(async (req, res) => {
  const accounts = await accountBalances();
  res.render('accounts/index', { title: 'Akun', accounts, total: accounts.reduce((s, a) => s + a.balance, 0) });
});

exports.save = wrap(async (req, res) => {
  try {
    const name = v.text(req.body.name, 'Nama akun', { max: 100 });
    const type = v.oneOf(req.body.type, TYPES, 'Jenis akun');
    const initial = v.amount(req.body.initial_balance || 0, 'Saldo awal', { allowZero: true });
    if (req.params.id) {
      await db.query('UPDATE accounts SET name = ?, type = ?, initial_balance = ? WHERE id = ?', [name, type, initial, req.params.id]);
      req.flash('success', 'Akun diperbarui.');
    } else {
      await db.query('INSERT INTO accounts (name, type, initial_balance) VALUES (?, ?, ?)', [name, type, initial]);
      req.flash('success', 'Akun ditambahkan.');
    }
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/akun');
});

exports.remove = wrap(async (req, res) => {
  try {
    await db.query('DELETE FROM accounts WHERE id = ?', [req.params.id]);
    req.flash('success', 'Akun dihapus.');
  } catch (e) {
    if (e.code !== 'ER_ROW_IS_REFERENCED_2') throw e;
    req.flash('error', 'Akun sudah dipakai transaksi, jadi tidak bisa dihapus.');
  }
  res.redirect('/akun');
});
