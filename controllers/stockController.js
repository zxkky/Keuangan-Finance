const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const v = require('../utils/validate');

exports.index = wrap(async (req, res) => {
  const businessId = v.id(req.query.business_id);
  const params = [];
  let where = 'p.is_active = 1';
  if (businessId) { where += ' AND p.business_id = ?'; params.push(businessId); }
  const [products] = await db.query(
    `SELECT p.*, b.name AS business FROM products p JOIN businesses b ON b.id = p.business_id WHERE ${where} ORDER BY p.stock ASC, p.name`, params);
  const [movements] = await db.query(
    `SELECT m.*, p.name AS product, u.name AS user_name FROM stock_movements m
       JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.user_id
      ${businessId ? 'WHERE p.business_id = ?' : ''} ORDER BY m.id DESC LIMIT 50`, businessId ? [businessId] : []);
  const [businesses] = await db.query('SELECT id, name FROM businesses ORDER BY name');
  res.render('stock/index', { title: 'Stok', products, movements, businesses, filters: { businessId } });
});

// Koreksi stok hasil hitung fisik (stock opname).
exports.adjust = wrap(async (req, res) => {
  try {
    const target = v.integer(req.body.new_stock, 'Stok fisik', { min: 0 });
    const note = v.text(req.body.note, 'Alasan koreksi', { max: 200 });
    await db.withTx(async (c) => {
      const [[p]] = await c.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [req.params.id]);
      if (!p) throw new UserError('Produk tidak ditemukan.');
      const diff = target - p.stock;
      if (diff === 0) throw new UserError('Stok fisik sama dengan stok di sistem.');
      await c.query('UPDATE products SET stock = ? WHERE id = ?', [target, p.id]);
      await c.query("INSERT INTO stock_movements (product_id, type, quantity, note, user_id) VALUES (?, 'adjust', ?, ?, ?)",
        [p.id, diff, `Koreksi: ${note}`, req.session.user.id]);
    });
    req.flash('success', 'Stok dikoreksi.');
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/stok');
});
