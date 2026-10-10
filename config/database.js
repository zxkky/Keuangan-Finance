require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'keuangan_finance',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,     // tanggal tetap string YYYY-MM-DD, tanpa geser zona waktu
  decimalNumbers: true,  // DECIMAL dikembalikan sebagai number
  charset: 'utf8mb4',
});

// Jalankan beberapa query dalam satu transaksi database.
pool.withTx = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
};

module.exports = pool;
