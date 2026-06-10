/**
 * SortableFilterableTable — the platform-wide shared table.
 * Click a header to sort (asc/desc), type to filter across all columns,
 * one-click CSV export (via exportUtils). Styled to match the platform's
 * dark table convention so it can be dropped into any section.
 */
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Search, Download, FileSpreadsheet } from 'lucide-react';
import { exportTableToCSV } from './exportUtils';
import { exportTableToExcel } from './excelExport';

export interface STColumn<T> {
  key: keyof T & string;
  label: string;
  numeric?: boolean;
  /** Optional custom cell renderer; defaults to String(value). */
  render?: (row: T) => React.ReactNode;
  width?: number | string;
  /** Excel export: header-cell comment (definition, units, data source). */
  comment?: string;
  /** Excel export: totals-row formula for this column. */
  total?: 'sum' | 'avg';
}

interface Props<T> {
  columns: STColumn<T>[];
  rows: T[];
  /** Accent colour for header/controls (hex). */
  accent?: string;
  /** Filename stem for the CSV export. */
  exportName?: string;
  /** Initial sort column key. */
  initialSort?: string;
  emptyText?: string;
}

export function SortableFilterableTable<T extends Record<string, any>>({
  columns, rows, accent = '#4d9fff', exportName = 'table-export',
  initialSort, emptyText = 'No rows match the current filter.',
}: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(initialSort ?? null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');

  const onSort = (key: string) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const visible = useMemo(() => {
    let out = rows;
    const q = filter.trim().toLowerCase();
    if (q) {
      out = out.filter(r =>
        columns.some(c => String(r[c.key] ?? '').toLowerCase().includes(q)));
    }
    if (sortKey) {
      const col = columns.find(c => c.key === sortKey);
      out = [...out].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = col?.numeric
          ? Number(av) - Number(bv)
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortAsc ? cmp : -cmp;
      });
    }
    return out;
  }, [rows, columns, filter, sortKey, sortAsc]);

  const doExport = () => {
    exportTableToCSV(
      visible.map(r => Object.fromEntries(columns.map(c => [c.label, r[c.key]]))),
      exportName,
    );
  };

  const [xlsBusy, setXlsBusy] = useState(false);
  const doExcelExport = async () => {
    setXlsBusy(true);
    try {
      await exportTableToExcel({
        filename: exportName,
        sheetName: 'Data',
        columns: columns.map(c => ({
          key: c.key, label: c.label, numeric: c.numeric,
          comment: c.comment, total: c.total,
        })),
        rows: visible as Record<string, unknown>[],
        meta: {
          'Filter applied': filter.trim() || '(none)',
          'Sorted by': sortKey ? `${sortKey} (${sortAsc ? 'asc' : 'desc'})` : '(none)',
        },
      });
    } finally {
      setXlsBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, flex: '1 1 220px', maxWidth: 360,
          background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 8, padding: '7px 11px',
        }}>
          <Search size={13} style={{ color: 'rgba(148,163,184,0.6)', flexShrink: 0 }} />
          <input
            value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Filter rows…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#e2eaf4', fontSize: 11.5 }}
          />
        </div>
        <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)' }}>
          {visible.length} of {rows.length} rows
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={doExport} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px',
          borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: 'pointer',
          background: `${accent}1a`, border: `1px solid ${accent}55`, color: accent,
        }}>
          <Download size={12} /> CSV
        </button>
        <button onClick={doExcelExport} disabled={xlsBusy} title="Excel with live formulas + column-note comments" style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '6px 13px',
          borderRadius: 7, fontSize: 10.5, fontWeight: 800, cursor: xlsBusy ? 'default' : 'pointer',
          background: '#00ff881a', border: '1px solid #00ff8855', color: '#00ff88',
          opacity: xlsBusy ? 0.6 : 1,
        }}>
          <FileSpreadsheet size={12} /> {xlsBusy ? 'Generating…' : 'Excel'}
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5 }}>
          <thead>
            <tr style={{ background: `${accent}10`, borderBottom: `1px solid ${accent}33` }}>
              {columns.map(c => {
                const active = sortKey === c.key;
                return (
                  <th key={c.key} onClick={() => onSort(c.key)} style={{
                    textAlign: c.numeric ? 'right' : 'left', padding: '9px 12px',
                    color: active ? accent : 'rgba(148,163,184,0.8)', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5,
                    cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', width: c.width,
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.label}
                      {active
                        ? (sortAsc ? <ArrowUp size={10} /> : <ArrowDown size={10} />)
                        : <ArrowUpDown size={10} style={{ opacity: 0.35 }} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={i} style={{
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                background: i % 2 ? 'rgba(255,255,255,0.012)' : 'transparent',
              }}>
                {columns.map(c => (
                  <td key={c.key} style={{
                    padding: '8px 12px', color: '#c4d2e1',
                    textAlign: c.numeric ? 'right' : 'left',
                  }}>
                    {c.render ? c.render(r) : String(r[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={columns.length} style={{ padding: '18px 12px', textAlign: 'center',
                color: 'rgba(148,163,184,0.5)', fontSize: 11 }}>{emptyText}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
