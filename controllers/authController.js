const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { wrap } = require('../middleware/auth');

// Hash tiruan agar waktu respons sama baik email ada maupun tidak.
const DUMMY_HASH = bcrypt.hashSync('tidak-dipakai', 10);

exports.showLogin = (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { layout: 'auth', title: 'Masuk' });
};

exports.login = wrap(async (req, res, next) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const [[u]] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const ok = await bcrypt.compare(password, u ? u.password : DUMMY_HASH);
  if (!u || !ok || !u.is_active) {
    req.flash('error', !u || !ok ? 'Email atau password salah.' : 'Akun Anda dinonaktifkan. Hubungi admin.');
    return res.redirect('/login');
  }
  req.session.regenerate((err) => {
    if (err) return next(err);
    req.session.user = { id: u.id, name: u.name, email: u.email, role: u.role };
    req.session.save(() => res.redirect('/'));
  });
});

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
};
