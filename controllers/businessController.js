const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const v = require('../utils/validate');
const { profitLoss } = require('../utils/finance');

exports.index = wrap(async (req, res) => {
  const [list] = await db.query('SELECT * FROM businesses ORDER BY status, name');
  const businesses = await Promise.all(list.map(async (b) => {
    const pl = await profitLoss('1900-01-01', '2999-12-31', b.id);
    return { ...b, revenue: pl.revenueTotal, hpp: pl.hppTotal, gross: pl.grossProfit, net: pl.netProfit };
  }));
  res.render('businesses/index', { title: 'Daftar usaha', businesses });
});

exports.save = wrap(async (req, res) => {
  try {
    const name = v.text(req.body.name, 'Nama usaha', { max: 120 });
    const description = v.text(req.body.description, 'Deskripsi', { required: false, max: 1000 });
    const capital = v.amount(req.body.initial_capital || 0, 'Modal awal', { allowZero: true });
    const status = v.oneOf(req.body.status || 'aktif', ['aktif', 'nonaktif'], 'Status');
    const start = req.body.start_date ? v.date(req.body.start_date, 'Tanggal mulai') : null;
    if (req.params.id) {
      await db.query('UPDATE businesses SET name=?, description=?, initial_capital=?, status=?, start_date=? WHERE id=?',
        [name, description, capital, status, start, req.params.id]);
      req.flash('success', 'Usaha diperbarui.');
    } else {
      await db.query('INSERT INTO businesses (name, description, initial_capital, status, start_date) VALUES (?, ?, ?, ?, ?)',
        [name, description, capital, status, start]);
      req.flash('success', 'Usaha ditambahkan.');
    }
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/usaha');
});

exports.remove = wrap(async (req, res) => {
  try {
    await db.query('DELETE FROM businesses WHERE id = ?', [req.params.id]);
    req.flash('success', 'Usaha dihapus.');
  } catch (e) {
    if (e.code !== 'ER_ROW_IS_REFERENCED_2') throw e;
    req.flash('error', 'Usaha sudah punya produk atau transaksi. Ubah statusnya menjadi nonaktif.');
  }
  res.redirect('/usaha');
});
