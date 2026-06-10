/**
 * CriticalStructures — BMS → Inventory & Condition → Critical Structures.
 * All structures rated Critical (1) or Poor (2), ranked by priority score.
 * First consumer of the shared SortableFilterableTable (sort/filter/CSV export).
 */
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

const RATING_LABEL: Record<number, string> = {
  1: 'Critical', 2: 'Poor', 3: 'Fair', 4: 'Good', 5: 'Excellent',
};
const RATING_COLOR: Record<number, string> = {
  1: '#ff3366', 2: '#ff6b35', 3: '#ffd23f', 4: '#00f5ff', 5: '#00ff88',
};

interface Row {
  name: string;
  type: string;
  road: string;
  region: string;
  rating: number;
  ratingLabel: string;
  priorityScore: number;
  priorityRank: number;
  spanLength: number;
  lastInspection: string;
  replacementCostBnUgx: number;
}

export default function CriticalStructures() {
  const { state } = useBMS();

  const rows = useMemo<Row[]>(() =>
    state.structures
      .filter(s => s.conditionRating <= 2)
      .map(s => ({
        name: s.name,
        type: s.type,
        road: s.road,
        region: s.region,
        rating: s.conditionRating,
        ratingLabel: RATING_LABEL[s.conditionRating] ?? String(s.conditionRating),
        priorityScore: Math.round(s.priorityScore),
        priorityRank: s.priorityRank,
        spanLength: s.spanLength,
        lastInspection: (s.lastInspection || '').slice(0, 10),
        replacementCostBnUgx: +(s.estimatedReplacementCost / 1e9).toFixed(2),
      })),
    [state.structures]);

  const columns: STColumn<Row>[] = [
    { key: 'name',   label: 'Structure', comment: 'Structure name from the BMS registry (bridges & major culverts).' },
    { key: 'type',   label: 'Type',      comment: 'bridge | culvert' },
    { key: 'road',   label: 'Road',      comment: 'Road the structure carries (national network).' },
    { key: 'region', label: 'Region' },
    { key: 'ratingLabel', label: 'Condition',
      comment: 'BMS condition rating: 1 Critical · 2 Poor · 3 Fair · 4 Good · 5 Excellent. This view shows only 1–2.',
      render: r => (
      <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 999,
        fontSize: 9.5, fontWeight: 800, color: RATING_COLOR[r.rating],
        background: `${RATING_COLOR[r.rating]}1f`, border: `1px solid ${RATING_COLOR[r.rating]}55` }}>
        {r.ratingLabel}
      </span>
    ) },
    { key: 'priorityScore', label: 'Priority', numeric: true, total: 'avg',
      comment: 'Priority score 0–100, computed from condition, traffic level and strategic importance. Higher = more urgent.' },
    { key: 'priorityRank',  label: 'Rank',     numeric: true,
      comment: 'Network-wide priority rank (1 = most urgent).' },
    { key: 'spanLength',    label: 'Span (m)', numeric: true, total: 'sum',
      comment: 'Total span length in metres.' },
    { key: 'lastInspection', label: 'Last Inspection',
      comment: 'Date of most recent field inspection (ISO).' },
    { key: 'replacementCostBnUgx', label: 'Repl. Cost (Bn UGX)', numeric: true, total: 'sum',
      comment: 'Estimated full replacement cost in billions of UGX — SUM gives the total exposure of the critical backlog.' },
  ];

  const criticalCount = rows.filter(r => r.rating === 1).length;

  return (
    <div style={{ padding: '18px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <AlertTriangle size={16} style={{ color: '#ff3366' }} />
        <div style={{ fontSize: 14, fontWeight: 900, color: '#e2eaf4' }}>Critical Structures</div>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginBottom: 14 }}>
        {criticalCount} critical · {rows.length - criticalCount} poor — all structures rated
        Critical or Poor, sorted by priority. Click headers to sort, filter, or export.
      </div>
      <SortableFilterableTable
        columns={columns}
        rows={rows}
        accent="#ff3366"
        exportName="critical-structures"
        initialSort="priorityRank"
      />
    </div>
  );
}
