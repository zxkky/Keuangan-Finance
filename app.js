require('dotenv').config();
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const expressLayouts = require('express-ejs-layouts');
const format = require('./utils/format');
const routes = require('./routes');

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET wajib diisi di production');

const app = express();
if (isProd) app.set('trust proxy', 1);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('layout extractScripts', true);

app.use(helmet({ contentSecurityPolicy: false })); // CSP dimatikan karena Tailwind dan Chart.js dimuat dari CDN
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-hanya-untuk-lokal',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: 1000 * 60 * 60 * 8 },
}));

// Variabel yang tersedia di semua view, pesan flash, dan perlindungan CSRF.
app.use((req, res, next) => {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  const u = req.session.user || null;
  Object.assign(res.locals, format, {
    csrf: req.session.csrf,
    user: u,
    path: req.path,
    flash: req.session.flash || null,
    isAdmin: !!u && u.role === 'admin',
    canManage: !!u && ['admin', 'bendahara'].includes(u.role),
  });
  delete req.session.flash;
  req.flash = (type, msg) => { req.session.flash = { type, msg }; };

  if (req.method === 'POST' && req.body._csrf !== req.session.csrf) {
    return res.status(403).render('error', { layout: u ? 'layout' : 'auth', code: 403, message: 'Formulir sudah kedaluwarsa. Muat ulang halaman lalu coba lagi.' });
  }
  next();
});

app.use(routes);

app.use((req, res) => {
  res.status(404).render('error', { layout: req.session.user ? 'layout' : 'auth', code: 404, message: 'Halaman tidak ditemukan.' });
});
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).render('error', { layout: req.session.user ? 'layout' : 'auth', code: 500, message: 'Terjadi kesalahan di server. Coba lagi sebentar.' });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Keuangan Finance berjalan di http://localhost:${port}`));
