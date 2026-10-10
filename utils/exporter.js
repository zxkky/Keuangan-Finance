const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { rupiah, tanggal } = require('./format');

// Baris laporan: { label, value?, text?, bold?, indent?, gap? }
function plRows(pl) {
  const rows = [{ label: 'Pendapatan', bold: true }];
  pl.revenue.forEach((i) => rows.push({ label: i.name, value: i.total, indent: true }));
  rows.push({ label: 'Total pendapatan', value: pl.revenueTotal, bold: true }, { gap: true });
  rows.push({ label: 'Harga pokok penjualan', bold: true });
  if (pl.salesHpp) rows.push({ label: 'HPP produk terjual', value: pl.salesHpp, indent: true });
  pl.cogs.forEach((i) => rows.push({ label: i.name, value: i.total, indent: true }));
  rows.push({ label: 'Total HPP', value: pl.hppTotal, bold: true });
  rows.push({ label: 'LABA KOTOR', value: pl.grossProfit, bold: true }, { gap: true });
  rows.push({ label: 'Biaya operasional', bold: true });
  pl.opex.forEach((i) => rows.push({ label: i.name, value: i.total, indent: true }));
  rows.push({ label: 'Total operasional', value: pl.opexTotal, bold: true });
  if (pl.otherIncomeTotal) rows.push({ label: 'Pendapatan lain-lain', value: pl.otherIncomeTotal });
  rows.push({ gap: true }, { label: 'PROFIT BERSIH', value: pl.netProfit, bold: true }, { gap: true });
  rows.push({ label: 'Gross margin', text: `${pl.grossMargin.toFixed(1)}%` }, { label: 'Net profit margin', text: `${pl.netMargin.toFixed(1)}%` });
  return rows;
}

function cfRows(cf) {
  const rows = [];
  if (cf.opening !== null) rows.push({ label: 'Saldo awal', value: cf.opening, bold: true }, { gap: true });
  rows.push({ label: 'Uang masuk', bold: true });
  cf.inflow.forEach((i) => rows.push({ label: i.name, value: i.total, indent: true }));
  rows.push({ label: 'Total uang masuk', value: cf.totalIn, bold: true }, { gap: true });
  rows.push({ label: 'Uang keluar', bold: true });
  cf.outflow.forEach((i) => rows.push({ label: i.name, value: i.total, indent: true }));
  rows.push({ label: 'Total uang keluar', value: cf.totalOut, bold: true }, { gap: true });
  rows.push({ label: 'NET CASH FLOW', value: cf.net, bold: true });
  if (cf.closing !== null) rows.push({ label: 'Saldo akhir', value: cf.closing, bold: true });
  return rows;
}

function toPdf(res, { title, subtitle, rows, filename }) {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(16).text(title);
  doc.font('Helvetica').fontSize(10).fillColor('#555555').text(subtitle).moveDown(1);
  rows.forEach((r) => {
    if (doc.y > 760) doc.addPage();
    if (r.gap) { doc.moveDown(0.6); return; }
    const y = doc.y;
    doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#111111');
    doc.text(r.label, 50 + (r.indent ? 16 : 0), y, { width: 320 });
    const val = r.text !== undefined ? r.text : r.value !== undefined ? rupiah(r.value) : '';
    if (val) doc.text(val, 380, y, { width: 165, align: 'right' });
    doc.moveDown(0.4);
  });
  doc.end();
}

async function toExcel(res, { title, subtitle, rows, filename }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laporan');
  ws.columns = [{ width: 42 }, { width: 22 }];
  ws.addRow([title]).font = { bold: true, size: 14 };
  ws.addRow([subtitle]);
  ws.addRow([]);
  rows.forEach((r) => {
    if (r.gap) { ws.addRow([]); return; }
    const row = ws.addRow([(r.indent ? '    ' : '') + r.label, r.text !== undefined ? r.text : r.value]);
    if (r.bold) row.font = { bold: true };
    row.getCell(2).alignment = { horizontal: 'right' };
    if (typeof r.value === 'number') row.getCell(2).numFmt = '"Rp"#,##0;[Red]-"Rp"#,##0';
  });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}

const subtitleFor = (from, to, businessName) =>
  `Keuangan | ${tanggal(from)} s.d. ${tanggal(to)}${businessName ? ` | ${businessName}` : ' | Semua usaha'}`;

module.exports = { plRows, cfRows, toPdf, toExcel, subtitleFor };
