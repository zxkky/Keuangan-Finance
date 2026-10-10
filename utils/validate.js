const { UserError } = require('./errors');
const { isDate } = require('./period');

const text = (v, label, { max = 255, required = true } = {}) => {
  const s = String(v ?? '').trim();
  if (required && !s) throw new UserError(`${label} wajib diisi.`);
  if (s.length > max) throw new UserError(`${label} terlalu panjang (maksimal ${max} karakter).`);
  return s || null;
};

const amount = (v, label, { min = 0, allowZero = false } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new UserError(`${label} harus berupa angka.`);
  if (n > 9999999999999) throw new UserError(`${label} terlalu besar.`);
  if (allowZero ? n < min : n <= min) throw new UserError(`${label} harus lebih dari ${min}.`);
  return Math.round(n * 100) / 100;
};

const integer = (v, label, { min = 1 } = {}) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new UserError(`${label} harus bilangan bulat minimal ${min}.`);
  return n;
};

const date = (v, label = 'Tanggal') => {
  if (!isDate(v)) throw new UserError(`${label} tidak valid.`);
  return v;
};

const id = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const oneOf = (v, list, label) => {
  if (!list.includes(v)) throw new UserError(`${label} tidak valid.`);
  return v;
};

const list = (v) => [].concat(v === undefined ? [] : v);

module.exports = { text, amount, integer, date, id, oneOf, list };
