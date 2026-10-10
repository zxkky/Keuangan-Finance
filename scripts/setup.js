// Membuat database, tabel, kategori awal, dan akun admin pertama.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const dbName = process.env.DB_NAME || 'keuangan_finance';
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME hanya boleh huruf, angka, dan underscore');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${dbName}\``);
  await conn.query(fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8'));
  console.log('Tabel dan data awal siap.');

  const email = (process.env.ADMIN_EMAIL || 'admin@keuangan.local').toLowerCase();
  const [exists] = await conn.query('SELECT id FROM users WHERE email = ?', [email]);
  if (exists.length) {
    console.log(`Admin ${email} sudah ada, dilewati.`);
  } else {
    const password = process.env.ADMIN_PASSWORD || 'ganti-password-ini';
    const hash = await bcrypt.hash(password, 10);
    await conn.query('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)', [
      process.env.ADMIN_NAME || 'Admin Keuangan', email, hash, 'admin',
    ]);
    console.log(`Admin dibuat: ${email}. Segera ganti password setelah login.`);
  }
  await conn.end();
})().catch((e) => { console.error('Setup gagal:', e.message); process.exit(1); });
