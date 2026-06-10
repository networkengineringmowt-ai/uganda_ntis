/**
 * excelExport — platform-wide Excel (.xlsx) export engine.
 * Goes beyond CSV: real Excel formulas (SUM/AVERAGE totals row), cell comments
 * on headers (column descriptions / data sources), styled + frozen header with
 * autofilter, and a metadata sheet recording provenance.
 *
 * exceljs is loaded via dynamic import so it is code-split out of the main
 * bundle and only fetched when a user actually exports.
 */

export interface XlsColumn {
  /** Property key on each row object. */
  key: string;
  /** Header label. */
  label: string;
  numeric?: boolean;
  /** Attach a totals-row formula for this column. */
  total?: 'sum' | 'avg';
  /** Header cell comment (e.g. column definition, units, data source). */
  comment?: string;
  width?: number;
}

export interface XlsOptions {
  filename: string;            // stem; '-YYYY-MM-DD.xlsx' appended
  sheetName?: string;
  columns: XlsColumn[];
  rows: Record<string, unknown>[];
  /** Lines for the Metadata sheet (source citation, filters applied, etc.). */
  meta?: Record<string, string>;
}

const HEADER_FILL = 'FF16263E';
const HEADER_FONT = 'FF7DD3E0';
const TOTAL_FILL  = 'FF101C33';

export async function exportTableToExcel(opts: XlsOptions): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const { columns, rows } = opts;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Uganda National Roads Platform — DNR/MOWT';
  wb.created = new Date();

  // ── Data sheet ──────────────────────────────────────────────────────────────
  const ws = wb.addWorksheet(opts.sheetName ?? 'Data', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = columns.map(c => ({
    key: c.key,
    width: c.width ?? Math.max(12, c.label.length + 4),
  }));

  // Header row: styled, with comments
  const header = ws.addRow(columns.map(c => c.label));
  header.eachCell((cell, i) => {
    cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle' };
    const col = columns[i - 1];
    if (col?.comment) {
      cell.note = {
        texts: [{ text: col.comment }],
        margins: { insetmode: 'auto' },
      } as any;
    }
  });

  // Data rows
  for (const r of rows) {
    ws.addRow(columns.map(c => {
      const v = r[c.key];
      if (c.numeric && v != null && v !== '') return Number(v);
      return v ?? '';
    }));
  }

  // ── Totals row with real Excel formulas ─────────────────────────────────────
  const hasTotals = columns.some(c => c.total);
  if (hasTotals && rows.length > 0) {
    const first = 2;                       // data starts on row 2
    const last  = rows.length + 1;
    const totalRow = ws.addRow(columns.map(() => ''));
    columns.forEach((c, idx) => {
      const cell = totalRow.getCell(idx + 1);
      if (idx === 0 && !c.total) { cell.value = 'TOTAL'; }
      if (c.total) {
        const colLetter = ws.getColumn(idx + 1).letter;
        const fn = c.total === 'avg' ? 'AVERAGE' : 'SUM';
        cell.value = { formula: `${fn}(${colLetter}${first}:${colLetter}${last})` } as any;
        cell.numFmt = '#,##0.00';
        cell.note = `${fn} of ${c.label} — live Excel formula, recalculates if you edit the data.`;
      }
      cell.font = { bold: true, color: { argb: HEADER_FONT }, size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    });
  }

  // Autofilter across the header
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: columns.length },
  };

  // Number format for numeric columns
  columns.forEach((c, idx) => {
    if (c.numeric) ws.getColumn(idx + 1).numFmt = '#,##0.##';
  });

  // ── Metadata sheet ──────────────────────────────────────────────────────────
  const metaWs = wb.addWorksheet('Metadata');
  metaWs.columns = [{ width: 26 }, { width: 80 }];
  const metaRows: [string, string][] = [
    ['Platform', 'Uganda National Roads Platform — DNR / Ministry of Works & Transport'],
    ['Generated', new Date().toISOString()],
    ['Rows exported', String(rows.length)],
    ...Object.entries(opts.meta ?? {}),
  ];
  for (const [k, v] of metaRows) {
    const row = metaWs.addRow([k, v]);
    row.getCell(1).font = { bold: true, color: { argb: HEADER_FONT }, size: 10 };
  }

  // ── Download ────────────────────────────────────────────────────────────────
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${opts.filename}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
