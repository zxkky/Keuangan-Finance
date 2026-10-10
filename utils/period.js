const { today } = require('./format');

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s));
const pad = (n) => String(n).padStart(2, '0');

function shiftMonth(m, delta) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function monthRange(m) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m || '')) m = today().slice(0, 7);
  const [y, mo] = m.split('-').map(Number);
  const last = new Date(y, mo, 0).getDate();
  const label = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(y, mo - 1, 1));
  const short = new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(new Date(y, mo - 1, 1));
  return { month: m, start: `${m}-01`, end: `${m}-${pad(last)}`, label, short, prev: shiftMonth(m, -1), next: shiftMonth(m, 1) };
}

// Rentang tanggal bebas untuk laporan; bawaannya awal bulan ini sampai hari ini.
function dateRange(from, to) {
  const t = today();
  const f = isDate(from) ? from : `${t.slice(0, 7)}-01`;
  let e = isDate(to) ? to : t;
  if (e < f) e = f;
  return { from: f, to: e };
}

module.exports = { isDate, shiftMonth, monthRange, dateRange };
