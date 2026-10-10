const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireLogin, requireRole } = require('../middleware/auth');

const auth = require('../controllers/authController');
const dashboard = require('../controllers/dashboardController');
const tx = require('../controllers/transactionController');
const account = require('../controllers/accountController');
const business = require('../controllers/businessController');
const product = require('../controllers/productController');
const sale = require('../controllers/saleController');
const stock = require('../controllers/stockController');
const report = require('../controllers/reportController');
const analytics = require('../controllers/analyticsController');
const category = require('../controllers/categoryController');
const users = require('../controllers/userController');
const settings = require('../controllers/settingsController');

const router = express.Router();
const manage = requireRole('admin', 'bendahara'); // tulis data keuangan dan usaha
const adminOnly = requireRole('admin');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => {
    req.flash('error', 'Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.');
    res.redirect('/login');
  },
});

// Publik
router.get('/login', auth.showLogin);
router.post('/login', loginLimiter, auth.login);

// Semua halaman di bawah ini wajib login
router.use(requireLogin);
router.post('/logout', auth.logout);
router.get('/', dashboard.index);

// Keuangan
router.get('/pemasukan', tx.list('income'));
router.get('/pengeluaran', tx.list('expense'));
router.post('/transaksi', manage, tx.store);
router.post('/transaksi/:id/hapus', manage, tx.remove);
router.get('/transfer', tx.transfers);
router.post('/transfer', manage, tx.storeTransfer);
router.post('/transfer/:id/hapus', manage, tx.removeTransfer);
router.get('/akun', account.index);
router.post('/akun', manage, account.save);
router.post('/akun/:id', manage, account.save);
router.post('/akun/:id/hapus', adminOnly, account.remove);

// Usaha, produk, penjualan
router.get('/usaha', business.index);
router.post('/usaha', manage, business.save);
router.post('/usaha/:id', manage, business.save);
router.post('/usaha/:id/hapus', adminOnly, business.remove);
router.get('/produk', product.index);
router.post('/produk', manage, product.save);
router.post('/produk/:id', manage, product.save);
router.post('/produk/:id/arsip', manage, product.toggleArchive);
router.post('/produk/:id/restok', manage, product.restock);
router.get('/penjualan', sale.index);
router.get('/penjualan/baru', manage, sale.form);
router.post('/penjualan', manage, sale.store);
router.post('/penjualan/:id/batal', manage, sale.void);

// Persediaan
router.get('/stok', stock.index);
router.post('/stok/:id/koreksi', manage, stock.adjust);

// Laporan dan analitik
router.get('/laporan/laba-rugi', report.profitLoss);
router.get('/laporan/cash-flow', report.cashFlow);
router.get('/laporan/:kind/export', report.export);
router.get('/analitik', analytics.index);

// Admin
router.get('/kategori', category.index);
router.post('/kategori', adminOnly, category.store);
router.post('/kategori/:id/hapus', adminOnly, category.remove);
router.get('/pengguna', adminOnly, users.index);
router.post('/pengguna', adminOnly, users.store);
router.post('/pengguna/:id', adminOnly, users.update);
router.post('/pengguna/:id/hapus', adminOnly, users.remove);

// Pengaturan
router.get('/pengaturan', settings.index);
router.post('/pengaturan/target', manage, settings.saveTarget);
router.post('/pengaturan/password', settings.changePassword);

module.exports = router;
