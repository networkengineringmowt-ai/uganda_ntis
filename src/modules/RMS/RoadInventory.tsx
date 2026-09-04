/**
 * RoadInventory — RMS → Road Inventory: the 8-way inventory split, grounded in
 * UNRA's official taxonomy (Visual Inspections manual, Feb 2012).
 * Compact layout: sub-tab ribbon (same style as BMS sub-tabs), collapsible
 * manual-reference strip, table fills the view.
 */
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Database } from 'lucide-react';
import {
  INVENTORY_CATEGORIES, GRADE_SCALE, MANUAL_SOURCE_NOTE,
} from '../../shared/unraStandards';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';
import { RoadClassPill, NullableCell, PercentCell } from '../../shared/tableFormatting';

interface InvLink {
  link_id: string; link_name: string | null; region: string | null; station: string | null;
  material_type: string | null; road_width_m: number | null; has_shoulder_pct: number;
  shoulder_material: string | null; shoulder_width_m: number | null;
  road_reserve_width_m: number | null; lanes: number | string | null; terrain: string | null;
  line_features: Record<string, number>; point_features: Record<string, number>;
  line_records: number; point_records: number;
}
interface InvData {
  survey: string; paved_links_surveyed: number; paved_line_records: number;
  paved_point_records: number; unpaved_links_in_register: number | null; links: InvLink[];
}

interface LinkRow {
  link_id: string; road_no: string; road_class: string; link_name: string;
  length_km: number; surface_type: string; maintenance_region: string;
  maintenance_station: string;
}

const C = { cyan: '#00f5ff', teal: '#00d4aa', yellow: '#ffd23f', gray: '#94a3b8' };

// Which measured 2022-23 feature subtypes belong to each inventory category.
// Matched case-insensitively against the field-survey feature names.
const CATEGORY_FEATURES: Record<string, string[]> = {
  shoulders:  ['kerb', 'layby', 'edge marker'],
  drainage:   ['lined open', 'unlined', 'lined covered', 'storm drain', 'minor culvert',
               'major culvert', 'culvert marker'],
  structures: ['retaining wall', 'bridge', 'waiting shed'],
  junctions:  ['junction', 'roundabout', 'cross', 'access', 'light controlled', 'barrier'],
  furniture:  ['guard rail', 'bollard', 'street light', 'reserve post', 'kilometre post',
               'hazard marker', 'rumble', 'speed table', 'road hump', 'road narrowing',
               'traffic calming', 'warning', 'informative', 'prohibitory', 'guidance',
               'supplementary', 'mandatory', 'regulatory'],
  markings:   ['centreline', 'lane lines', 'edge lines', 'road stud', 'transverse marking',
               'other markings'],
  environs:   ['embankment', 'cutting', 'island', 'rolling', 'flat', 'mountainous',
               'raised', 'depressed', 'flush'],
};

export default function RoadInventory() {
  const [cat, setCat] = useState(INVENTORY_CATEGORIES[0].id);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [inv, setInv] = useState<InvData | null>(null);
  const [showRef, setShowRef] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/network_links.json`)
      .then(r => r.json())
      .then(d => setLinks(d))
      .catch(() => setLinks([]));
    fetch(`${import.meta.env.BASE_URL}data/road_inventory_2023.json`)
      .then(r => r.json())
      .then(setInv)
      .catch(() => setInv(null));
  }, []);

  const active = INVENTORY_CATEGORIES.find(c => c.id === cat)!;

  const carriagewayCols: STColumn<LinkRow>[] = useMemo(() => [
    { key: 'link_id',    label: 'Link ID',  comment: 'UNRA AMS location-referencing link identifier.' },
    { key: 'road_no',    label: 'Road No.', comment: 'Nationally accepted road/route number (manual: Inventory Items).' },
    { key: 'link_name',  label: 'Link Name' },
    { key: 'road_class', label: 'Class',    comment: 'Road class A / B / C / M.',
      render: r => <RoadClassPill cls={r.road_class} /> },
    { key: 'surface_type', label: 'Pavement Type',
      comment: 'Official inventory item "Pavement Type" — carriageway paved/unpaved + wearing course.' },
    { key: 'length_km',  label: 'Length (km)', numeric: true, total: 'sum',
      comment: 'Official inventory item "Dimensions" — section length. SUM = network total.',
      render: r => <NullableCell value={r.length_km}>{r.length_km.toLocaleString(undefined, { maximumFractionDigits: 1 })}</NullableCell> },
    { key: 'maintenance_region',  label: 'Region' },
    { key: 'maintenance_station', label: 'Station',
      comment: 'Maintenance station responsible (manual: Inventory Items → Station).' },
  ], []);

  // measured 2022-23 field inventory, filtered to the ACTIVE category —
  // one numeric column PER feature subtype with the actual count per link.
  type InvRow = Record<string, string | number | null>;
  const keywords = CATEGORY_FEATURES[cat] ?? [];

  const { invRows, subtypes, catTotal } = useMemo(() => {
    const match = (name: string) => {
      const n = name.toLowerCase();
      return keywords.some(k => n.includes(k));
    };
    const totals = new Map<string, number>();
    const rows: InvRow[] = [];
    for (const l of inv?.links ?? []) {
      const matched = [...Object.entries(l.line_features), ...Object.entries(l.point_features)]
        .filter(([k]) => match(k));
      if (!matched.length) continue;
      const row: InvRow = {
        link_id: l.link_id, link_name: l.link_name ?? '', region: l.region ?? '',
        station: l.station ?? '', material: l.material_type ?? '',
        road_width_m: l.road_width_m, shoulder_pct: l.has_shoulder_pct,
        shoulder_width_m: l.shoulder_width_m, reserve_width_m: l.road_reserve_width_m,
        lanes: String(l.lanes ?? ''), terrain: l.terrain ?? '',
        cat_records: 0,
      };
      let sum = 0;
      for (const [k, n] of matched) {
        row[k] = ((row[k] as number) ?? 0) + n;
        sum += n;
        totals.set(k, (totals.get(k) ?? 0) + n);
      }
      row.cat_records = sum;
      rows.push(row);
    }
    const subs = [...totals.entries()].sort((x, y) => y[1] - x[1]).map(([k]) => k);
    // every row carries every subtype key so sorting/CSV stay consistent
    for (const r of rows) for (const st of subs) if (r[st] == null) r[st] = 0;
    return { invRows: rows, subtypes: subs,
             catTotal: [...totals.values()].reduce((x, y) => x + y, 0) };
  }, [inv, keywords]);

  const invCols: STColumn<InvRow>[] = useMemo(() => {
    const base: STColumn<InvRow>[] = [
      { key: 'link_id',   label: 'Link ID' },
      { key: 'link_name', label: 'Link Name' },
      { key: 'region',    label: 'Region' },
      { key: 'station',   label: 'Station' },
    ];
    const extras: STColumn<InvRow>[] =
      cat === 'shoulders' ? [
        { key: 'shoulder_pct',     label: 'Shoulder %',  numeric: true,
          render: (r: InvRow) => <PercentCell value={r.shoulder_pct as number | null} /> },
        { key: 'shoulder_width_m', label: 'Shldr W (m)', numeric: true,
          render: (r: InvRow) => <NullableCell value={r.shoulder_width_m}>{r.shoulder_width_m}</NullableCell> },
        { key: 'material',         label: 'Material' },
      ] : cat === 'environs' ? [
        { key: 'terrain',          label: 'Terrain' },
        { key: 'reserve_width_m',  label: 'Reserve W (m)', numeric: true,
          render: (r: InvRow) => <NullableCell value={r.reserve_width_m}>{r.reserve_width_m}</NullableCell> },
      ] : [];
    const perSubtype: STColumn<InvRow>[] = subtypes.map(st => ({
      key: st, label: st, numeric: true, total: 'sum' as const,
      comment: `Count of "${st}" inventory records on the link (2022-23 survey).`,
    }));
    return [
      ...base, ...extras, ...perSubtype,
      { key: 'cat_records', label: 'Total', numeric: true, total: 'sum',
        comment: `All ${active.label} records on the link.` },
    ];
  }, [cat, active.label, subtypes]);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* ── Category sub-tab ribbon (same pattern as BMS sub-tabs) ── */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px 12px 0', flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(4,9,18,0.6)', flexShrink: 0,
      }}>
        {INVENTORY_CATEGORIES.map(c => {
          const on = c.id === cat;
          return (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px 7px', fontSize: 10, fontWeight: on ? 700 : 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: on ? C.teal : 'rgba(148,163,184,0.65)',
              borderBottom: on ? `2px solid ${C.teal}` : '2px solid transparent',
              transition: 'all 0.13s',
            }}>
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ padding: '10px 12px' }}>
        {/* ── Compact header + collapsible manual reference ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '7px 10px', marginBottom: 10, borderRadius: 8,
          background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.18)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: '#e2eaf4' }}>{active.label}</span>
          <span style={{ fontSize: 10.5, color: 'rgba(203,213,225,0.75)' }}>{active.description}</span>
          <div style={{ flex: 1 }} />
          <button onClick={() => setShowRef(v => !v)} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 9px',
            borderRadius: 6, fontSize: 9.5, fontWeight: 700, cursor: 'pointer',
            background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.3)', color: C.teal,
          }}>
            <BookOpen size={10} /> Manual reference {showRef ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        </div>

        {showRef && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12,
            padding: '10px 12px', marginBottom: 10, borderRadius: 8,
            background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.07)',
          }}>
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Official inventory items (manual)
              </div>
              {active.manualItems.map(m => (
                <div key={m} style={{ fontSize: 10, color: '#c4d2e1', padding: '1px 0' }}>• {m}</div>
              ))}
            </div>
            {active.relatedDefects.length > 0 && (
              <div>
                <div style={{ fontSize: 8.5, fontWeight: 800, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                  Related survey defects (graded 1–5)
                </div>
                {active.relatedDefects.map(d => (
                  <div key={d} style={{ fontSize: 10, color: '#c4d2e1', padding: '1px 0' }}>• {d}</div>
                ))}
              </div>
            )}
            <div>
              <div style={{ fontSize: 8.5, fontWeight: 800, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Official grade scale
              </div>
              {GRADE_SCALE.map(g => (
                <div key={g.grade} style={{ fontSize: 9.5, color: 'rgba(196,210,225,0.75)', padding: '1px 0' }}>
                  <strong style={{ color: '#e2eaf4' }}>{g.grade}</strong> — {g.meaning}
                </div>
              ))}
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: 8.5, color: 'rgba(148,163,184,0.5)' }}>
              {MANUAL_SOURCE_NOTE} Ingested from: 0. Manuals / Asset Management Manuals.
            </div>
          </div>
        )}

        {/* ── Table fills the view ── */}
        {cat === 'carriageway' ? (
          <SortableFilterableTable
            columns={carriagewayCols}
            rows={links}
            accent={C.teal}
            exportName="road-inventory-carriageway"
            initialSort="road_no"
          />
        ) : inv ? (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {[
                [`${invRows.length} / ${inv.paved_links_surveyed}`, `links with ${active.label} features`],
                [`${catTotal.toLocaleString()}`, `${active.label} records`],
                [`${inv.paved_line_records.toLocaleString()}`, 'all line records (survey)'],
                [`${inv.paved_point_records.toLocaleString()}`, 'all point records (survey)'],
              ].map(([v, l]) => (
                <div key={l} style={{ padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: C.teal }}>{v}</span>
                  <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.7)', marginLeft: 6 }}>{l}</span>
                </div>
              ))}
              <div style={{ flexBasis: '100%', fontSize: 9, color: 'rgba(148,163,184,0.5)' }}>
                Measured field inventory — {inv.survey} · source: 6.Road Inventory Data/2022-23 (G: repository)
              </div>
            </div>
            <SortableFilterableTable
              columns={invCols}
              rows={invRows}
              accent={C.teal}
              exportName={`road-inventory-2023-${active.id}`}
              initialSort="link_id"
            />
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
            borderRadius: 8, background: 'rgba(15,23,42,0.6)', border: '1px dashed rgba(148,163,184,0.3)' }}>
            <Database size={14} style={{ color: C.gray }} />
            <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.8)' }}>
              Loading the 2022-23 measured inventory…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
