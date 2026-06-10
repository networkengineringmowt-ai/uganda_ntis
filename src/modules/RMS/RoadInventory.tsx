/**
 * RoadInventory — RMS → Road Inventory: the 8-way inventory split, grounded in
 * UNRA's official taxonomy (Visual Inspections manual, Feb 2012). Every
 * category card cites the manual's inventory items and related survey defects;
 * categories with platform data render a sortable/filterable/exportable table.
 */
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, ClipboardList, Database } from 'lucide-react';
import {
  INVENTORY_CATEGORIES, GRADE_SCALE, MANUAL_SOURCE_NOTE,
} from '../../shared/unraStandards';
import { SortableFilterableTable, type STColumn } from '../../shared/SortableFilterableTable';

interface LinkRow {
  link_id: string; road_no: string; road_class: string; link_name: string;
  length_km: number; surface_type: string; maintenance_region: string;
  maintenance_station: string;
}

const C = { cyan: '#00f5ff', teal: '#00d4aa', yellow: '#ffd23f', gray: '#94a3b8' };

export default function RoadInventory() {
  const [cat, setCat] = useState(INVENTORY_CATEGORIES[0].id);
  const [links, setLinks] = useState<LinkRow[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/network_links.json`)
      .then(r => r.json())
      .then(d => setLinks(d))
      .catch(() => setLinks([]));
  }, []);

  const active = INVENTORY_CATEGORIES.find(c => c.id === cat)!;

  const carriagewayCols: STColumn<LinkRow>[] = useMemo(() => [
    { key: 'link_id',    label: 'Link ID',  comment: 'UNRA AMS location-referencing link identifier.' },
    { key: 'road_no',    label: 'Road No.', comment: 'Nationally accepted road/route number (manual: Inventory Items).' },
    { key: 'link_name',  label: 'Link Name' },
    { key: 'road_class', label: 'Class',    comment: 'Road class A / B / C / M.' },
    { key: 'surface_type', label: 'Pavement Type',
      comment: 'Official inventory item "Pavement Type" — carriageway paved/unpaved + wearing course.' },
    { key: 'length_km',  label: 'Length (km)', numeric: true, total: 'sum',
      comment: 'Official inventory item "Dimensions" — section length. SUM = network total.' },
    { key: 'maintenance_region',  label: 'Region' },
    { key: 'maintenance_station', label: 'Station',
      comment: 'Maintenance station responsible (manual: Inventory Items → Station).' },
  ], []);

  return (
    <div style={{ padding: '20px 18px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <ClipboardList size={17} style={{ color: C.teal }} />
        <div style={{ fontSize: 15, fontWeight: 900, color: '#e2eaf4' }}>Road Network Inventory — 8 Asset Categories</div>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginBottom: 14 }}>
        Categorisation per UNRA's official inventory survey items (Continuous/Line + Discrete/Point data).
        {' '}{MANUAL_SOURCE_NOTE}
      </div>

      {/* Category chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {INVENTORY_CATEGORIES.map(c => {
          const on = c.id === cat;
          return (
            <button key={c.id} onClick={() => setCat(c.id)} style={{
              padding: '7px 13px', borderRadius: 999, fontSize: 10.5, fontWeight: on ? 800 : 600,
              cursor: 'pointer', background: on ? 'rgba(0,212,170,0.16)' : 'rgba(15,23,42,0.7)',
              border: `1px solid ${on ? C.teal : 'rgba(148,163,184,0.25)'}`,
              color: on ? C.teal : 'rgba(148,163,184,0.8)',
            }}>
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Category definition card (the ingested manual content) */}
      <div style={{ background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.2)',
        borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#e2eaf4', marginBottom: 4 }}>{active.label}</div>
        <div style={{ fontSize: 11.5, color: 'rgba(203,213,225,0.85)', marginBottom: 10 }}>{active.description}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              Official inventory items (manual)
            </div>
            {active.manualItems.map(m => (
              <div key={m} style={{ fontSize: 10.5, color: '#c4d2e1', padding: '2px 0' }}>• {m}</div>
            ))}
          </div>
          {active.relatedDefects.length > 0 && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.yellow, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
                Related visual-survey defects (graded 1–5)
              </div>
              {active.relatedDefects.map(d => (
                <div key={d} style={{ fontSize: 10.5, color: '#c4d2e1', padding: '2px 0' }}>• {d}</div>
              ))}
            </div>
          )}
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: C.cyan, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>
              Official grade scale
            </div>
            {GRADE_SCALE.map(g => (
              <div key={g.grade} style={{ fontSize: 10, color: 'rgba(196,210,225,0.75)', padding: '1px 0' }}>
                <strong style={{ color: '#e2eaf4' }}>{g.grade}</strong> — {g.meaning}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Data table where the platform has data for this category */}
      {cat === 'carriageway' ? (
        <SortableFilterableTable
          columns={carriagewayCols}
          rows={links}
          accent={C.teal}
          exportName="road-inventory-carriageway"
          initialSort="road_no"
        />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
          borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px dashed rgba(148,163,184,0.3)' }}>
          <Database size={15} style={{ color: C.gray }} />
          <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.8)' }}>
            Field data for <strong style={{ color: '#e2eaf4' }}>{active.label}</strong> is collected per the
            Visual Inspections manual items listed above — capture via the Data Capture hub writes it to the
            Supabase Unified DB, and this table will populate automatically.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'rgba(148,163,184,0.45)', marginTop: 14 }}>
        <BookOpen size={10} /> Ingested from: 0. Manuals / Asset Management Manuals — Visual Inspections of Paved & Unpaved Roads (Feb 2012).
      </div>
    </div>
  );
}
