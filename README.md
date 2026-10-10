# Keuangan Finance

Sistem manajemen keuangan dan usaha. Node.js, Express, EJS, Tailwind CSS (CDN), MySQL, Chart.js.

## Menjalankan

1. Pasang Node.js 18+ dan MySQL/MariaDB.
2. `npm install`
3. Salin `.env.example` menjadi `.env`, lalu isi koneksi database, `SESSION_SECRET`, dan akun admin pertama.
4. `npm run setup` membuat database, tabel, kategori awal, akun Kas dan Bank, serta admin pertama.
5. `npm start` (atau `npm run dev`), lalu buka http://localhost:3000

Ganti password admin lewat menu Pengaturan setelah login pertama.

## Fitur

- Role: admin (semua fitur), bendahara (keuangan, usaha, laporan), anggota (hanya melihat).
- Dashboard: pemasukan, pengeluaran, laba kotor, profit bersih, alur omzet ke profit, indikator kesehatan keuangan, grafik 6 bulan, performa usaha, saldo akun, target bulanan.
- Keuangan: pemasukan, pengeluaran, transfer antar akun (tidak dihitung sebagai pemasukan), akun kas/bank/e-wallet.
- Usaha: banyak usaha, produk dengan HPP dan harga jual, restok (HPP rata-rata tertimbang), penjualan multi-barang yang otomatis mengurangi stok, mencatat pemasukan dan HPP, serta bisa dibatalkan.
- Persediaan: stok, riwayat pergerakan, koreksi stok.
- Laporan: laba rugi dan cash flow per rentang tanggal dan per usaha, export PDF dan Excel.
- Analitik: tren profit, perbandingan usaha, produk terlaku dan paling menguntungkan, ringkasan otomatis.

## Aturan perhitungan

- Omzet = pemasukan berkategori kelompok `revenue`.
- HPP = (jumlah x HPP) barang terjual + pengeluaran kelompok `cogs`.
- Laba kotor = omzet - HPP. Profit bersih = laba kotor - biaya operasional (+ pendapatan lain).
- Modal, pinjaman, dan pembelian stok tidak masuk laba rugi, hanya cash flow. Pembelian stok baru menjadi HPP saat barang terjual.
- Kelompok laporan diatur per kategori di menu Kategori.

## Struktur

```
app.js            server, session, CSRF, error handler
config/           koneksi MySQL (+ helper transaksi)
controllers/      logika tiap modul
routes/index.js   semua rute dan pembatasan role
middleware/       login dan role
utils/            finance.js (laba rugi, cash flow), export PDF/Excel, validasi, format
database/         schema.sql
scripts/setup.js  inisialisasi database
views/            template EJS
public/js/app.js  menu mobile dan dialog formulir
```

## Catatan deployment

- Session memakai penyimpanan memori bawaan: login hilang saat server restart. Untuk produksi, ganti dengan session store (mis. `express-mysql-session`).
- Isi `SESSION_SECRET`, jalankan di belakang HTTPS, dan set `COOKIE_SECURE=true`.
- Tailwind dan Chart.js dimuat dari CDN, jadi perlu internet. Untuk produksi, build Tailwind sendiri dan hosting aset secara lokal, lalu aktifkan CSP di helmet.
