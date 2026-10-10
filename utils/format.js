const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const rupiah = (v) => {
  const n = Number(v) || 0;
  return (n < 0 ? '-Rp' : 'Rp') + Math.abs(Math.round(n)).toLocaleString('id-ID');
};

const rupiahSingkat = (v) => {
  const n = Number(v) || 0;
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const fmt = (x) => x.toFixed(1).replace('.', ',').replace(/,0$/, '');
  if (a >= 1e9) return `${sign}Rp${fmt(a / 1e9)} miliar`;
  if (a >= 1e6) return `${sign}Rp${fmt(a / 1e6)} juta`;
  if (a >= 1e3) return `${sign}Rp${fmt(a / 1e3)} rb`;
  return `${sign}Rp${Math.round(a)}`;
};

const tanggal = (d) => {
  if (!d) return '-';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return `${Number(dd)} ${BULAN[Number(m) - 1]} ${y}`;
};

const persen = (v) => (Number(v) || 0).toFixed(1).replace('.', ',') + '%';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });

const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

module.exports = { rupiah, rupiahSingkat, tanggal, persen, today, json };
