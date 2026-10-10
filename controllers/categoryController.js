const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const v = require('../utils/validate');

const CATEGORY_TYPES = {
  revenue: 'Pendapatan usaha (masuk omzet)',
  cogs: 'HPP (mengurangi laba kotor)',
  operational: 'Biaya operasional',
  inventory: 'Pembelian stok (bukan beban, hanya arus kas)',
  capital: 'Modal',
  loan: 'Pinjaman',
  other: 'Lain-lain',
};

exports.index = wrap(async (req, res) => {
  const [categories] = await db.query('SELECT * FROM categories ORDER BY type DESC, category_type, name');
  res.render('categories/index', { title: 'Kategori', categories, CATEGORY_TYPES });
});

exports.store = wrap(async (req, res) => {
  try {
    const name = v.text(req.body.name, 'Nama kategori', { max: 100 });
    const type = v.oneOf(req.body.type, ['income', 'expense'], 'Jenis');
    const ct = v.oneOf(req.body.category_type, Object.keys(CATEGORY_TYPES), 'Kelompok laporan');
    await db.query('INSERT INTO categories (name, type, category_type) VALUES (?, ?, ?)', [name, type, ct]);
    req.flash('success', 'Kategori ditambahkan.');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') req.flash('error', 'Kategori dengan nama dan jenis itu sudah ada.');
    else if (e instanceof UserError) req.flash('error', e.message);
    else throw e;
  }
  res.redirect('/kategori');
});

exports.remove = wrap(async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    req.flash('success', 'Kategori dihapus.');
  } catch (e) {
    if (e.code !== 'ER_ROW_IS_REFERENCED_2') throw e;
    req.flash('error', 'Kategori sudah dipakai transaksi, jadi tidak bisa dihapus.');
  }
  res.redirect('/kategori');
});
