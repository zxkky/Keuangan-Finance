const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const { monthRange } = require('../utils/period');
const { today } = require('../utils/format');
const v = require('../utils/validate');

exports.index = wrap(async (req, res) => {
  const per = monthRange(req.query.month);
  const businessId = v.id(req.query.business_id);
  const params = [per.start, per.end];
  let extra = '';
  if (businessId) { extra = ' AND s.business_id = ?'; params.push(businessId); }
  const [sales] = await db.query(
    `SELECT s.*, b.name AS business, a.name AS account, u.name AS user_name
       FROM sales s JOIN businesses b ON b.id = s.business_id JOIN accounts a ON a.id = s.account_id
       LEFT JOIN users u ON u.id = s.user_id
      WHERE s.transaction_date BETWEEN ? AND ?${extra} ORDER BY s.transaction_date DESC, s.id DESC`, params);
  const itemsBySale = {};
  if (sales.length) {
    const [items] = await db.query(
      'SELECT si.*, p.name FROM sale_items si JOIN products p ON p.id = si.product_id WHERE si.sale_id IN (?)', [sales.map((s) => s.id)]);
    items.forEach((i) => { (itemsBySale[i.sale_id] = itemsBySale[i.sale_id] || []).push(i); });
  }
  const [businesses] = await db.query('SELECT id, name FROM businesses ORDER BY name');
  const totals = sales.reduce((t, s) => ({ revenue: t.revenue + s.total, cost: t.cost + s.total_cost }), { revenue: 0, cost: 0 });
  res.render('sales/index', { title: 'Penjualan', per, sales, itemsBySale, businesses, filters: { businessId }, totals });
});

exports.form = wrap(async (req, res) => {
  const [businesses] = await db.query("SELECT id, name FROM businesses WHERE status = 'aktif' ORDER BY name");
  const [products] = await db.query(
    'SELECT id, business_id, name, stock, cost_price, selling_price FROM products WHERE is_active = 1 ORDER BY name');
  const [accounts] = await db.query('SELECT id, name FROM accounts ORDER BY name');
  res.render('sales/new', { title: 'Catat penjualan', businesses, products, accounts, todayStr: today() });
});

exports.store = wrap(async (req, res) => {
  try {
    const businessId = v.id(req.body.business_id);
    const accountId = v.id(req.body.account_id);
    const date = v.date(req.body.transaction_date);
    const note = v.text(req.body.note, 'Catatan', { required: false });
    const pids = v.list(req.body.product_id);
    const qtys = v.list(req.body.qty);
    const prices = v.list(req.body.price);
    if (!pids.length) throw new UserError('Tambahkan minimal satu produk.');

    const saleId = await db.withTx(async (c) => {
      const [[biz]] = await c.query('SELECT id FROM businesses WHERE id = ?', [businessId]);
      if (!biz) throw new UserError('Pilih usaha.');
      const [[acc]] = await c.query('SELECT id FROM accounts WHERE id = ?', [accountId]);
      if (!acc) throw new UserError('Pilih akun penerima.');
      const [[cat]] = await c.query("SELECT id FROM categories WHERE name = 'Penjualan' AND type = 'income'");
      if (!cat) throw new UserError('Kategori "Penjualan" tidak ditemukan. Tambahkan lewat menu Kategori.');

      const lines = [];
      for (let i = 0; i < pids.length; i++) {
        const [[p]] = await c.query('SELECT * FROM products WHERE id = ? AND business_id = ? FOR UPDATE', [v.id(pids[i]), businessId]);
        if (!p || !p.is_active) throw new UserError('Ada produk yang tidak valid untuk usaha ini.');
        const qty = v.integer(qtys[i], `Jumlah ${p.name}`);
        const price = v.amount(prices[i], `Harga ${p.name}`, { allowZero: true });
        if (p.stock < qty) throw new UserError(`Stok ${p.name} tidak cukup (tersisa ${p.stock}).`);
        await c.query('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, p.id]);
        lines.push({ p, qty, price, cost: p.cost_price, subtotal: qty * price });
      }
      const total = lines.reduce((s, l) => s + l.subtotal, 0);
      const totalCost = lines.reduce((s, l) => s + l.qty * l.cost, 0);

      const [sale] = await c.query(
        'INSERT INTO sales (business_id, account_id, user_id, total, total_cost, transaction_date, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [businessId, accountId, req.session.user.id, total, totalCost, date, note]);
      for (const l of lines) {
        await c.query('INSERT INTO sale_items (sale_id, product_id, quantity, price, cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
          [sale.insertId, l.p.id, l.qty, l.price, l.cost, l.subtotal]);
        await c.query("INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, user_id) VALUES (?, 'out', ?, ?, ?, ?)",
          [l.p.id, -l.qty, sale.insertId, `Penjualan #${sale.insertId}`, req.session.user.id]);
      }
      await c.query(
        `INSERT INTO transactions (business_id, account_id, category_id, user_id, sale_id, type, amount, transaction_date, description)
         VALUES (?, ?, ?, ?, ?, 'income', ?, ?, ?)`,
        [businessId, accountId, cat.id, req.session.user.id, sale.insertId, total, date,
          note || `Penjualan ${lines.map((l) => `${l.p.name} x${l.qty}`).join(', ')}`.slice(0, 250)]);
      return sale.insertId;
    });
    req.flash('success', `Penjualan #${saleId} tersimpan. Stok, pemasukan, dan HPP sudah tercatat.`);
    return res.redirect(`/penjualan?month=${date.slice(0, 7)}`);
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
    return res.redirect('/penjualan/baru');
  }
});

// Batalkan penjualan: stok dikembalikan dan pemasukan terkait dihapus.
exports.void = wrap(async (req, res) => {
  await db.withTx(async (c) => {
    const [[s]] = await c.query('SELECT * FROM sales WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!s) throw new UserError('Penjualan tidak ditemukan.');
    const [items] = await c.query('SELECT * FROM sale_items WHERE sale_id = ?', [s.id]);
    for (const i of items) {
      await c.query('UPDATE products SET stock = stock + ? WHERE id = ?', [i.quantity, i.product_id]);
      await c.query("INSERT INTO stock_movements (product_id, type, quantity, reference_id, note, user_id) VALUES (?, 'void', ?, ?, ?, ?)",
        [i.product_id, i.quantity, s.id, `Batal penjualan #${s.id}`, req.session.user.id]);
    }
    await c.query('DELETE FROM sales WHERE id = ?', [s.id]); // item dan transaksi ikut terhapus (CASCADE)
  }).then(() => req.flash('success', 'Penjualan dibatalkan dan stok dikembalikan.'))
    .catch((e) => { if (!(e instanceof UserError)) throw e; req.flash('error', e.message); });
  res.redirect('/penjualan');
});
