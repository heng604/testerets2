// ════════════════════════════════════════════════════════════
//  Masatoshi — Export Utilities
//  Real, professionally-styled .xlsx (ExcelJS) and .pdf
//  (jsPDF + autoTable) file generation for the admin panel.
// ════════════════════════════════════════════════════════════
import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/* ── Brand palette (matches XCLOUD_THEME) ── */
const BRAND_PURPLE   = '4F46E5';
const BRAND_PURPLE_D = '3730A3';
const BRAND_INK      = '0F172A';
const ZEBRA_FILL     = 'F3F4F8';
const BORDER_COLOR   = 'D8DCE6';

const BRAND_PURPLE_RGB = [79, 70, 229];
const BRAND_INK_RGB    = [15, 23, 42];
const ZEBRA_RGB        = [244, 245, 250];

/* Columns whose values should be right-aligned + treated as numbers */
const NUMERIC_KEYS = new Set([
  'points', 'pointsSpent', 'amount', 'totalTopups', 'totalTopupAmount', 'loginCount',
]);

function isNumericCol(key) {
  return NUMERIC_KEYS.has(key);
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeSheetName(name) {
  // Excel sheet names: max 31 chars, no : \ / ? * [ ]
  return String(name).replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || 'Sheet1';
}

/* ── Build one nicely-styled worksheet inside a workbook ── */
function buildSheet(workbook, sheetLabel, rows, cols) {
  const sheet = workbook.addWorksheet(safeSheetName(sheetLabel), {
    views: [{ state: 'frozen', ySplit: 3 }], // freeze title + header rows
  });

  const colCount = cols.length;
  const lastColLetter = sheet.getColumn(colCount).letter;

  // Column widths — based on header + longest value, with sane bounds
  sheet.columns = cols.map(c => {
    const longest = rows.reduce((max, r) => {
      const v = r[c.key] == null ? '' : String(r[c.key]);
      return Math.max(max, v.length);
    }, c.label.length);
    return { key: c.key, width: Math.min(Math.max(longest + 3, 12), 42) };
  });

  // ── Title row ──
  sheet.mergeCells(1, 1, 1, colCount);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `Masatoshi — ${sheetLabel}`;
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(1).height = 28;
  for (let c = 1; c <= colCount; c++) {
    sheet.getCell(1, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_PURPLE_D}` } };
  }

  // ── Subtitle row (export date + row count) ──
  sheet.mergeCells(2, 1, 2, colCount);
  const subCell = sheet.getCell(2, 1);
  subCell.value = `Exported ${new Date().toLocaleString()}  ·  ${rows.length} record${rows.length === 1 ? '' : 's'}`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
  subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet.getRow(2).height = 18;

  // ── Header row ──
  const headerRowIdx = 3;
  const headerRow = sheet.getRow(headerRowIdx);
  cols.forEach((c, i) => { headerRow.getCell(i + 1).value = c.label; });
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_PURPLE}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.border = {
      top: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
      bottom: { style: 'thin', color: { argb: `FF${BORDER_COLOR}` } },
    };
  });

  // ── Data rows ──
  rows.forEach((r, idx) => {
    const rowIdx = headerRowIdx + 1 + idx;
    const row = sheet.getRow(rowIdx);
    cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const raw = r[c.key];
      if (isNumericCol(c.key) && raw !== '' && raw != null && !isNaN(raw)) {
        cell.value = Number(raw);
        cell.numFmt = '#,##0.##';
        cell.alignment = { horizontal: 'right', indent: 1 };
      } else {
        cell.value = raw == null ? '' : String(raw);
        cell.alignment = { horizontal: 'left', indent: 1, wrapText: false };
      }
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: `FF${BRAND_INK}` } };
      cell.border = { bottom: { style: 'hair', color: { argb: `FF${BORDER_COLOR}` } } };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ZEBRA_FILL}` } };
      }
    });
    row.height = 19;
  });

  // ── Autofilter + polish ──
  if (rows.length) {
    sheet.autoFilter = {
      from: { row: headerRowIdx, column: 1 },
      to: { row: headerRowIdx, column: colCount },
    };
  }
  sheet.pageSetup = { orientation: colCount > 6 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  sheet.properties.defaultRowHeight = 19;

  return sheet;
}

/* ── Public: export a single dataset to a real, styled .xlsx file ── */
export async function exportToExcel(rows, cols, sheetLabel, filenameBase) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Masatoshi Admin';
  workbook.created = new Date();
  buildSheet(workbook, sheetLabel, rows, cols);
  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filenameBase}_${Date.now()}.xlsx`
  );
}

/* ── Public: export multiple datasets into one multi-sheet workbook ── */
export async function exportAllToExcel(dataset, colsByKey, labelsByKey, filenameBase) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Masatoshi Admin';
  workbook.created = new Date();

  let sheetsAdded = 0;
  Object.entries(dataset).forEach(([key, rows]) => {
    const cols = colsByKey[key];
    if (rows && rows.length && cols) {
      buildSheet(workbook, labelsByKey[key] || key, rows, cols);
      sheetsAdded++;
    }
  });

  if (!sheetsAdded) throw new Error('No data available to export');

  const buffer = await workbook.xlsx.writeBuffer();
  saveBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filenameBase}_${Date.now()}.xlsx`
  );
  return sheetsAdded;
}

/* ── Public: export a single dataset to a real, downloadable PDF file ── */
export function exportToPDF(rows, cols, title, filenameBase) {
  const landscape = cols.length > 5;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  renderPdfSection(doc, title, rows, cols, true);
  finalizePdf(doc, title);
  doc.save(`${filenameBase}_${Date.now()}.pdf`);
}

/* ── Public: export multiple datasets into one multi-section PDF file ── */
export function exportAllToPDF(dataset, colsByKey, labelsByKey, filenameBase) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  let first = true;
  let any = false;

  Object.entries(dataset).forEach(([key, rows]) => {
    const cols = colsByKey[key];
    if (rows && rows.length && cols) {
      if (!first) doc.addPage();
      renderPdfSection(doc, labelsByKey[key] || key, rows, cols, first);
      first = false;
      any = true;
    }
  });

  if (!any) throw new Error('No data available to export');

  finalizePdf(doc, 'Masatoshi — Full Export');
  doc.save(`${filenameBase}_${Date.now()}.pdf`);
}

function renderPdfSection(doc, title, rows, cols, isFirstOfDoc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 36;

  // Header band
  doc.setFillColor(...BRAND_PURPLE_RGB);
  doc.rect(0, 0, pageWidth, 54, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Masatoshi — ${title}`, marginX, 32);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Exported ${new Date().toLocaleString()}  ·  ${rows.length} record${rows.length === 1 ? '' : 's'}`, marginX, 46);

  autoTable(doc, {
    startY: 68,
    head: [cols.map(c => c.label)],
    body: rows.map(r => cols.map(c => {
      const v = r[c.key];
      return v == null ? '' : String(v);
    })),
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 5,
      textColor: BRAND_INK_RGB,
      lineColor: [216, 220, 230],
      lineWidth: 0.5,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: BRAND_PURPLE_RGB,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: { fillColor: ZEBRA_RGB },
    margin: { left: marginX, right: marginX },
    theme: 'grid',
  });
}

function finalizePdf(doc, docTitle) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setProperties({ title: docTitle });

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 130);
    doc.text(`Masatoshi Admin — Confidential`, 36, pageHeight - 18);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 36, pageHeight - 18, { align: 'right' });
  }
}
