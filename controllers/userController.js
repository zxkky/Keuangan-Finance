const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { wrap } = require('../middleware/auth');
const { UserError } = require('../utils/errors');
const v = require('../utils/validate');

const ROLES = ['admin', 'bendahara', 'anggota'];

const password = (p) => {
  if (String(p || '').length < 8) throw new UserError('Password minimal 8 karakter.');
  return bcrypt.hash(String(p), 10);
};

exports.index = wrap(async (req, res) => {
  const [users] = await db.query('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY role, name');
  res.render('users/index', { title: 'Pengguna', users });
});

exports.store = wrap(async (req, res) => {
  try {
    const name = v.text(req.body.name, 'Nama', { max: 100 });
    const email = v.text(req.body.email, 'Email', { max: 150 }).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new UserError('Format email tidak valid.');
    const role = v.oneOf(req.body.role, ROLES, 'Role');
    const hash = await password(req.body.password);
    await db.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [name, email, hash, role]);
    req.flash('success', 'Pengguna ditambahkan.');
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') req.flash('error', 'Email sudah terdaftar.');
    else if (e instanceof UserError) req.flash('error', e.message);
    else throw e;
  }
  res.redirect('/pengguna');
});

exports.update = wrap(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = v.text(req.body.name, 'Nama', { max: 100 });
    const role = v.oneOf(req.body.role, ROLES, 'Role');
    const active = req.body.is_active === '1' ? 1 : 0;
    if (id === req.session.user.id && (role !== 'admin' || !active)) {
      throw new UserError('Anda tidak bisa menurunkan role atau menonaktifkan akun sendiri.');
    }
    if (req.body.password) {
      await db.query('UPDATE users SET name=?, role=?, is_active=?, password=? WHERE id=?', [name, role, active, await password(req.body.password), id]);
    } else {
      await db.query('UPDATE users SET name=?, role=?, is_active=? WHERE id=?', [name, role, active, id]);
    }
    req.flash('success', 'Pengguna diperbarui.');
  } catch (e) {
    if (!(e instanceof UserError)) throw e;
    req.flash('error', e.message);
  }
  res.redirect('/pengguna');
});

exports.remove = wrap(async (req, res) => {
  if (Number(req.params.id) === req.session.user.id) {
    req.flash('error', 'Anda tidak bisa menghapus akun sendiri.');
  } else {
    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    req.flash('success', 'Pengguna dihapus.');
  }
  res.redirect('/pengguna');
});
