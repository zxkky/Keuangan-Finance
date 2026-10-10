exports.requireLogin = (req, res, next) => (req.session.user ? next() : res.redirect('/login'));

// Contoh: requireRole('admin', 'bendahara')
exports.requireRole = (...roles) => (req, res, next) => {
  if (roles.includes(req.session.user.role)) return next();
  return res.status(403).render('error', { code: 403, message: 'Anda tidak punya akses ke halaman ini.' });
};

exports.wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
