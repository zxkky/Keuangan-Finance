const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { monthRange } = require('../utils/period');
const { UserError } = require('../utils/errors');
const v = require('../utils/validate');

const TITLES = { income: 'Pemasukan', expense: 'Pengeluaran' };

exports.list = (type) => wrap(async (req, res) => {
  const per = monthRange(req.query.month);
  const businessId = v.id(req.query.business_id);
  const categoryId = v.id(req.query.category_id);
  const params = [type, per.start, per.end];
  let extra = '';
  if (businessId) { extra += ' AND t.business_id = ?'; params.push(businessId); }
  if (categoryId) { extra += ' AND t.category_id = ?'; params.push(categoryId); }

  const [rows] = await db.query(
    `SELECT t.*, c.name AS category, b.name AS business, a.name AS account, u.name AS user_name
       FROM transactions t JOIN categories c ON c.id = t.category_id
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN businesses b ON b.id = t.business_id LEFT JOIN users u ON u.id = t.user_id
      WHERE t.type = ? AND t.transaction_date BETWEEN ? AND ?${extra}
      ORDER BY t.transaction_date DESC, t.id DESC`, params);
  const [categories] = await db.query('SELECT * FROM categories WHERE type = ? ORDER BY name', [type]);
  const [businesses] = await db.query("SELECT id, name FROM businesses WHERE status = 'aktif' ORDER BY name");
  const [accounts] = await db.query('SELECT id, name FROM accounts ORDER BY name');

  res.render('transactions/index', {
    title: TITLES[type], type, label: TITLES[type], per, rows, categories, businesses, accounts,
    total: rows.reduce((s, r) => s + r.amount, 0), filters: { businessId, categoryId },
  });
});

exports.store = wrap(async (req, res) => {
  const type = v.oneOf(req.body.type, ['income', 'expense'], 'Jenis transaksi');
  const back = type === 'income' ? '/pemasukan' : '/pengeluaran';
  try {
    const data = {
      amount: v.amount(req.body.amount, 'Nominal'),
      date: v.date(req.body.transaction_date),
      description: v.text(req.body.description, 'Keterangan', { required: false }),
      categoryId: v.id(req.body.category_id),
      accountId: v.id(req.body.account_id),
      businessId: v.id(req.body.business_id),
    };
    const [[cat]] = await db.query('SELECT id FROM categories WHERE id = ? AND type = ?', [data.categoryId, type]);
    if (!cat) throw new UserError('Pilih kategori yang sesuai.');
    const [[acc]] = await db.query('SELECT id FROM accounts WHERE id = ?', [data.accountId]);
    if (!acc) throw new UserError('Pilih akun.');
    if (data.businessId) {
      const [[b]] = await db.query('SELECT id FROM businesses WHERE id = ?', [data.businessId]);
      if (!b) throw new UserError('Usaha tidak ditemukan.');
    }
    await db.query(
      `INSERT INTO transactions (business_id, account_id, category_id, user_id, type, amount, transaction_date, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.businessId, data.accountId, data.categoryId, req.session.user.id, type, data.amount, data.date, data.description]);
    req.flash('success', `${TITLES[type]} disimpan.`);
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect(`${back}?month=${String(req.body.transaction_date || '').slice(0, 7)}`);
});

exports.remove = wrap(async (req, res) => {
  const [[t]] = await db.query('SELECT id, type, sale_id FROM transactions WHERE id = ?', [req.params.id]);
  if (!t) return res.redirect('/');
  if (t.sale_id) {
    req.flash('error', 'Transaksi ini berasal dari penjualan. Batalkan lewat halaman Penjualan.');
  } else {
    await db.query('DELETE FROM transactions WHERE id = ?', [t.id]);
    req.flash('success', 'Transaksi dihapus.');
  }
  res.redirect(t.type === 'income' ? '/pemasukan' : '/pengeluaran');
});

// ---------- Transfer antar akun ----------
exports.transfers = wrap(async (req, res) => {
  const per = monthRange(req.query.month);
  const [rows] = await db.query(
    `SELECT tr.*, fa.name AS from_name, ta.name AS to_name
       FROM transfers tr JOIN accounts fa ON fa.id = tr.from_account_id JOIN accounts ta ON ta.id = tr.to_account_id
      WHERE tr.transfer_date BETWEEN ? AND ? ORDER BY tr.transfer_date DESC, tr.id DESC`, [per.start, per.end]);
  const [accounts] = await db.query('SELECT id, name FROM accounts ORDER BY name');
  res.render('transfers/index', { title: 'Transfer', per, rows, accounts });
});

exports.storeTransfer = wrap(async (req, res) => {
  try {
    const from = v.id(req.body.from_account_id);
    const to = v.id(req.body.to_account_id);
    if (!from || !to) throw new UserError('Pilih akun asal dan akun tujuan.');
    if (from === to) throw new UserError('Akun asal dan tujuan harus berbeda.');
    const [accs] = await db.query('SELECT id FROM accounts WHERE id IN (?, ?)', [from, to]);
    if (accs.length !== 2) throw new UserError('Akun tidak ditemukan.');
    await db.query(
      'INSERT INTO transfers (from_account_id, to_account_id, user_id, amount, transfer_date, description) VALUES (?, ?, ?, ?, ?, ?)',
      [from, to, req.session.user.id, v.amount(req.body.amount, 'Nominal'), v.date(req.body.transfer_date), v.text(req.body.description, 'Keterangan', { required: false })]);
    req.flash('success', 'Transfer disimpan. Transfer tidak dihitung sebagai pemasukan atau pengeluaran.');
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/transfer');
});

exports.removeTransfer = wrap(async (req, res) => {
  await db.query('DELETE FROM transfers WHERE id = ?', [req.params.id]);
  req.flash('success', 'Transfer dihapus.');
  res.redirect('/transfer');
});
