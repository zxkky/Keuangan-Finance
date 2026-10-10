const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const { today } = require('../utils/format');
const v = require('../utils/validate');

exports.index = wrap(async (req, res) => {
  const businessId = v.id(req.query.business_id);
  const showArchived = req.query.arsip === '1';
  const params = [];
  let where = showArchived ? '1=1' : 'p.is_active = 1';
  if (businessId) { where += ' AND p.business_id = ?'; params.push(businessId); }
  const [products] = await db.query(
    `SELECT p.*, b.name AS business FROM products p JOIN businesses b ON b.id = p.business_id
      WHERE ${where} ORDER BY b.name, p.name`, params);
  const [businesses] = await db.query("SELECT id, name FROM businesses WHERE status = 'aktif' ORDER BY name");
  const [accounts] = await db.query('SELECT id, name FROM accounts ORDER BY name');
  res.render('products/index', { title: 'Produk', products, businesses, accounts, filters: { businessId, showArchived }, todayStr: today() });
});

exports.save = wrap(async (req, res) => {
  try {
    const name = v.text(req.body.name, 'Nama produk', { max: 150 });
    const sku = v.text(req.body.sku, 'SKU', { required: false, max: 50 });
    const cost = v.amount(req.body.cost_price || 0, 'HPP', { allowZero: true });
    const price = v.amount(req.body.selling_price, 'Harga jual');
    if (req.params.id) {
      await db.query('UPDATE products SET name=?, sku=?, cost_price=?, selling_price=? WHERE id=?', [name, sku, cost, price, req.params.id]);
      req.flash('success', 'Produk diperbarui.');
    } else {
      const businessId = v.id(req.body.business_id);
      const [[b]] = await db.query('SELECT id FROM businesses WHERE id = ?', [businessId]);
      if (!b) throw new UserError('Pilih usaha untuk produk ini.');
      const stock = v.integer(req.body.stock || 0, 'Stok awal', { min: 0 });
      await db.withTx(async (c) => {
        const [r] = await c.query('INSERT INTO products (business_id, name, sku, cost_price, selling_price, stock) VALUES (?, ?, ?, ?, ?, ?)',
          [businessId, name, sku, cost, price, stock]);
        if (stock > 0) {
          await c.query("INSERT INTO stock_movements (product_id, type, quantity, note, user_id) VALUES (?, 'in', ?, 'Stok awal', ?)",
            [r.insertId, stock, req.session.user.id]);
        }
      });
      req.flash('success', 'Produk ditambahkan.');
    }
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/produk');
});

exports.toggleArchive = wrap(async (req, res) => {
  await db.query('UPDATE products SET is_active = 1 - is_active WHERE id = ?', [req.params.id]);
  req.flash('success', 'Status produk diperbarui.');
  res.redirect('/produk');
});

/**
 * Restok: stok bertambah, HPP dihitung ulang dengan rata-rata tertimbang,
 * dan (jika ada biaya) tercatat sebagai pengeluaran "Pembelian Stok".
 * Pembelian stok bukan beban; HPP baru diakui saat barang terjual.
 */
exports.restock = wrap(async (req, res) => {
  try {
    const qty = v.integer(req.body.quantity, 'Jumlah');
    const totalCost = v.amount(req.body.total_cost || 0, 'Total biaya', { allowZero: true });
    const date = v.date(req.body.date);
    const accountId = v.id(req.body.account_id);
    await db.withTx(async (c) => {
      const [[p]] = await c.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!p) throw new UserError('Produk tidak ditemukan.');
      let newCost = p.cost_price;
      if (totalCost > 0) newCost = Math.round(((p.stock * p.cost_price) + totalCost) / (p.stock + qty));
      await c.query('UPDATE products SET stock = stock + ?, cost_price = ? WHERE id = ?', [qty, newCost, p.id]);
      await c.query("INSERT INTO stock_movements (product_id, type, quantity, note, user_id) VALUES (?, 'in', ?, 'Restok', ?)",
        [p.id, qty, req.session.user.id]);
      if (totalCost > 0) {
        const [[acc]] = await c.query('SELECT id FROM accounts WHERE id = ?', [accountId]);
        if (!acc) throw new UserError('Pilih akun pembayaran.');
        const [[cat]] = await c.query("SELECT id FROM categories WHERE name = 'Pembelian Stok' AND type = 'expense'");
        if (!cat) throw new UserError('Kategori "Pembelian Stok" tidak ditemukan. Tambahkan lewat menu Kategori.');
        await c.query(
          `INSERT INTO transactions (business_id, account_id, category_id, user_id, type, amount, transaction_date, description)
           VALUES (?, ?, ?, ?, 'expense', ?, ?, ?)`,
          [p.business_id, acc.id, cat.id, req.session.user.id, totalCost, date, `Restok ${p.name} x${qty}`]);
      }
    });
    req.flash('success', 'Stok ditambahkan.');
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/produk');
});
