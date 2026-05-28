import { useState, useMemo, useCallback } from 'react';
import { Download, Filter, ExternalLink, BookOpen } from 'lucide-react';

const C = {
  cyan: '#00f5ff', green: '#00ff88', yellow: '#ffd23f',
  orange: '#ff6b35', purple: '#b967ff', blue: '#4d9fff',
  pink: '#ff2d78', teal: '#00d4aa', red: '#ff3366', gray: '#94a3b8',
};
function hexRgb(h: string) {
  const c = h.replace('#','');
  return `${parseInt(c.slice(0,2),16)},${parseInt(c.slice(2,4),16)},${parseInt(c.slice(4,6),16)}`;
}

type SourceType = 'Survey' | 'GIS' | 'Database' | 'Report' | 'Manual' | 'Project' | 'External' | 'Model';

interface Source {
  name:        string;
  type:        SourceType;
  owner:       string;
  yearRange:   string;
  coverage:    string;
  variables:   string;
  format:      string;
  status:      'Active' | 'Archived' | 'Planned' | 'Partial';
  module:      string[];
  link?:       string;
  notes?:      string;
}

const TYPE_COLOR: Record<SourceType, string> = {
  Survey: C.cyan, GIS: C.green, Database: C.blue, Report: C.purple,
  Manual: C.teal, Project: C.orange, External: C.yellow, Model: C.pink,
};

const SOURCES: Source[] = [
  // ── Surveys ──
  { name: 'ROMDAS Pavement Condition Survey',
    type: 'Survey', owner: 'UNRA/DNR', yearRange: '2018–2023',
    coverage: '~6,000 km paved national roads (partial coverage annually)',
    variables: 'IRI (m/km), rutting depth, cracking area, texture, GPS coordinates',
    format: 'CSV + ROMDAS binary + georeferenced video',
    status: 'Active', module: ['PMS', 'HDM4', 'Network'],
    notes: 'Surveys conducted by UNRA with ROMDAS vehicle; latest 2023 survey covers ~4,200 km' },

  { name: 'UNRA Traffic Information System (TIS)',
    type: 'Survey', owner: 'UNRA TIS Unit', yearRange: '2010–present',
    coverage: '298 manual count stations, 21,292 km national network',
    variables: 'AADT by 12 vehicle classes, directional split, peak hour, seasonal factors',
    format: 'Excel workbooks + access DB → analytics.json export',
    status: 'Active', module: ['TIS', 'Network', 'PMS'],
    notes: 'Annual 7-day classified counts; growth factors computed from time-series' },

  { name: 'Automatic Traffic Counter (ATC) Data',
    type: 'Survey', owner: 'UNRA/DNR', yearRange: '2016–present',
    coverage: '25 ATC stations (15 legacy + 10 new 2025)',
    variables: 'Hourly AADT, speed, classification, axle signature',
    format: 'SQLite DB (traffic_platform.db), 607k+ readings',
    status: 'Active', module: ['TIS', 'Network'],
    notes: 'Real-time continuous counts; site IDs U0001–U0010 (new stations)' },

  { name: 'OPM NAPR Road Condition Assessment',
    type: 'Survey', owner: 'Office of the Prime Minister / NAPR', yearRange: 'July 2025',
    coverage: 'All classified national roads (~21,292 km)',
    variables: 'Visual condition class (Good/Fair/Poor/Bad), surface type, road class',
    format: 'GeoJSON + Excel report',
    status: 'Active', module: ['PMS', 'Network'],
    notes: 'National Annual Progress Report 2025 road condition data; primary condition layer' },

  { name: 'Weighbridge / Axle Load Survey',
    type: 'Survey', owner: 'UNRA / AFCAP Uganda', yearRange: '2014–2022',
    coverage: '12 weighbridge stations on major corridors',
    variables: 'Gross vehicle weight, axle configuration, overloading %, commodity type',
    format: 'Excel + AFCAP reports',
    status: 'Partial', module: ['TIS', 'HDM4'],
    notes: 'SATCC/TRH4 ESAL factors derived from these surveys; overloading uplift 25% HGV' },

  // ── GIS ──
  { name: 'Uganda National Road Network GIS',
    type: 'GIS', owner: 'UNRA/DNR GIS Section', yearRange: '2010–present',
    coverage: '21,292 km, 1,359 links, 6 maintenance regions',
    variables: 'Geometry, road_no, link_id, surface_type, road_class, length_km, chainage',
    format: 'Shapefile + GeoJSON (bundle.json, atc_stations.geojson)',
    status: 'Active', module: ['Network', 'PMS', 'TIS', 'BMS', 'Projects'],
    notes: 'Primary spatial reference for all asset management layers; maintained in ArcGIS' },

  { name: 'Bridge & Culvert GIS Registry',
    type: 'GIS', owner: 'UNRA BMS Unit', yearRange: '2015–present',
    coverage: '1,019 structures (534 bridges, 485 culverts)',
    variables: 'lat/lng, span, width, material, condition rating, inspection date',
    format: 'GeoJSON + SQLite (traffic_platform.db)',
    status: 'Active', module: ['BMS'],
    notes: 'Structure registry; coordinates validated against 1:50,000 topo' },

  { name: 'KCCA Road Network (Urban)',
    type: 'GIS', owner: 'KCCA / MoWT', yearRange: '2020–present',
    coverage: 'Kampala metropolitan area classified roads',
    variables: 'Geometry, road class, condition, paving status',
    format: 'Shapefile',
    status: 'Partial', module: ['Network'],
    notes: 'Partial coverage; urban roads complementary to national network' },

  // ── Databases ──
  { name: 'Traffic Platform SQLite DB',
    type: 'Database', owner: 'UNRA/DNR (this platform)', yearRange: '2016–2025',
    coverage: 'All ATC stations, road links, traffic counts',
    variables: '12+ tables: road_links, traffic_counts, atc_stations, atc_readings, overloading_summary',
    format: 'SQLite (traffic_platform.db)',
    status: 'Active', module: ['TIS', 'Network', 'PMS'],
    notes: 'Platform database: 267k+ traffic records, 1,359 links, 305 ATC records' },

  { name: 'UNRA Contract Management System',
    type: 'Database', owner: 'UNRA PDU / Contracts Dept', yearRange: '2010–present',
    coverage: 'All UNRA contracts (construction + maintenance)',
    variables: 'Contract value, contractor, progress %, payment status, completion date',
    format: 'Internal system (proprietary) + Excel exports',
    status: 'Active', module: ['Projects'],
    notes: 'Source for OPRC and NDPIV project data; exported to projects JSON' },

  // ── Reports ──
  { name: 'UNRA Annual Report',
    type: 'Report', owner: 'UNRA', yearRange: '2010–2024',
    coverage: 'Full national road network performance',
    variables: 'Paved km added, condition KPIs, accident stats, bridge inspections, budget utilisation',
    format: 'PDF (published annually)',
    status: 'Active', module: ['Network', 'PMS', 'BMS', 'Budget'],
    link: 'https://www.unra.go.ug/reports',
    notes: 'Primary source for time-series network performance indicators' },

  { name: 'World Bank Uganda Transport Sector Review',
    type: 'Report', owner: 'World Bank / IBRD', yearRange: '2008–2022',
    coverage: 'Uganda transport sector (roads, rail, aviation, water)',
    variables: 'Budget analysis, RSDP progress, VFM assessment, institutional review',
    format: 'PDF (World Bank Open Data)',
    status: 'Archived', module: ['PIM', 'Budget'],
    notes: 'Multiple reports; 2022 transport diagnostic is most current' },

  { name: 'AfDB RSSP Completion Reports',
    type: 'Report', owner: 'AfDB / UNRA', yearRange: '2010–2023',
    coverage: 'Road Sector Support Project I, II, III',
    variables: 'Project completion, KPIs, disbursement, outcome ratings',
    format: 'PDF (AfDB project portal)',
    status: 'Active', module: ['PIM', 'Projects'],
    notes: 'Key donor financing history for Northern Uganda road upgrading' },

  { name: 'JICA Uganda Road Sector Studies',
    type: 'Report', owner: 'JICA / MoWT', yearRange: '2007–2020',
    coverage: 'Northern Corridor, cross-border roads with Tanzania/Kenya',
    variables: 'Traffic counts, economic analysis, design standards',
    format: 'PDF',
    status: 'Archived', module: ['PIM', 'TIS'],
    notes: 'Important for Kyotera–Mutukula and Gulu–Atiak traffic data' },

  // ── Manuals ──
  { name: 'MoWT Design Manual for Roads & Bridges',
    type: 'Manual', owner: 'Ministry of Works & Transport', yearRange: '2005 (2023 update)',
    coverage: 'Uganda design standards, all road classes',
    variables: 'Geometric standards, pavement design, drainage, bridges, structures',
    format: 'PDF (public)',
    status: 'Active', module: ['PMS', 'BMS', 'HDM4'],
    notes: 'Primary design reference; pavement thickness tables aligned with HDM-4 CESAL' },

  { name: 'MoWT Schedule of Rates (SoR)',
    type: 'Manual', owner: 'Ministry of Works & Transport', yearRange: 'FY 2024/25',
    coverage: 'Uganda civil works cost rates',
    variables: 'Unit costs for all road/bridge/drainage works (UGX)',
    format: 'PDF + Excel',
    status: 'Active', module: ['Budget', 'HDM4', 'PIM'],
    notes: 'Updated annually; used for budget estimates and contract BoQ reference' },

  { name: 'HDM-4 User Guide & Documentation',
    type: 'Manual', owner: 'World Bank / PIARC', yearRange: '2000 (v1.3)',
    coverage: 'Global — HDM-4 methodology and technical documentation',
    variables: 'Deterioration equations, calibration procedures, economic analysis framework',
    format: 'PDF (PIARC/World Bank)',
    status: 'Active', module: ['HDM4'],
    notes: 'Core reference for HDM-4 model structure and equations' },

  { name: 'SATCC / TRH4 Vehicle Classification & ESAL Factors',
    type: 'Manual', owner: 'SATCC (Southern African)', yearRange: '2020',
    coverage: 'SADC/COMESA region including Uganda',
    variables: 'Vehicle class definitions, axle load factors, ESAL equivalency factors',
    format: 'PDF',
    status: 'Active', module: ['TIS', 'HDM4'],
    notes: 'Source for ESAL factors used in overloading risk computation (Truck Trailer 6ax = 5.86)' },

  // ── Model / External ──
  { name: 'HDM-4 Calibration Study (UNRA 2023)',
    type: 'Model', owner: 'UNRA/DNR', yearRange: 'December 2023',
    coverage: '~3,200 km paved roads (calibration segments)',
    variables: 'Kcit, Kcia, Kcp, Krt, Kge calibration coefficients; IRI validation curves',
    format: 'HDM-4 project file + Excel + PDF report',
    status: 'Active', module: ['HDM4', 'PMS'],
    notes: 'First Uganda-specific HDM-4 calibration; critical for accurate treatment programming' },

  { name: 'CHIRPS Rainfall Data (Uganda)',
    type: 'External', owner: 'UC Santa Barbara / USAID', yearRange: '1981–present',
    coverage: 'Uganda national coverage at 5km grid',
    variables: 'Monthly/annual rainfall (mm), anomalies',
    format: 'NetCDF / GeoTIFF (open source)',
    status: 'Active', module: ['PMS', 'HDM4'],
    link: 'https://www.chc.ucsb.edu/data/chirps',
    notes: 'Used to compute mean annual rainfall covariate for HDM-4 deterioration models' },

  { name: 'SRTM Digital Elevation Model (Uganda)',
    type: 'External', owner: 'NASA / USGS', yearRange: '2000',
    coverage: 'Full Uganda coverage at 30m resolution',
    variables: 'Elevation (m), slope (%)',
    format: 'GeoTIFF (free download via EarthExplorer)',
    status: 'Active', module: ['PMS', 'HDM4'],
    link: 'https://earthexplorer.usgs.gov',
    notes: 'Terrain slope derived for HDM-4 environment model and flood risk scoring' },

  { name: 'Uganda Bureau of Statistics — GDP & Population',
    type: 'External', owner: 'UBOS', yearRange: '2010–2024',
    coverage: 'National, district, sub-county level',
    variables: 'GDP (real, USD), GDP growth rate, population by district',
    format: 'Excel + PDF reports (UBOS website)',
    status: 'Active', module: ['TIS', 'PIM'],
    link: 'https://www.ubos.org',
    notes: 'Used for traffic growth model inputs (GDP-AADT elasticity)' },

  // ── Projects ──
  { name: 'NDP IV Projects Register',
    type: 'Project', owner: 'NPA / UNRA', yearRange: '2020/21–2025/26',
    coverage: 'All NDP IV national road investments',
    variables: 'Project name, location, length, budget, progress %, funder, contractor',
    format: 'Excel + JSON (ndpiv_projects.json)',
    status: 'Active', module: ['Projects', 'PIM'],
    notes: 'Primary source for NDPIV dashboard; updated quarterly from UNRA contract management' },

  { name: 'OPRC Lot Boundaries & Performance Data',
    type: 'Project', owner: 'UNRA/OPRC PMU', yearRange: '2018–present',
    coverage: '9 OPRC lots covering ~7,500 km national roads',
    variables: 'Lot boundary, contractor, contract value, performance score, condition targets',
    format: 'GeoJSON + Excel',
    status: 'Active', module: ['Projects', 'Budget'],
    notes: 'Output-based road contract data; contractor is responsible for condition standards' },
];

const STATUS_COLOR = { Active: C.green, Archived: C.gray, Planned: C.blue, Partial: C.yellow };
const TYPES: SourceType[] = ['Survey', 'GIS', 'Database', 'Report', 'Manual', 'Project', 'External', 'Model'];

export default function SourcesCatalogueSection() {
  const [typeFilter, setTypeFilter] = useState<SourceType | 'All'>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');

  const filtered = useMemo(() => SOURCES.filter(s => {
    if (typeFilter !== 'All' && s.type !== typeFilter) return false;
    if (statusFilter !== 'All' && s.status !== statusFilter) return false;
    if (moduleFilter !== 'All' && !s.module.includes(moduleFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.variables.toLowerCase().includes(q)
        || s.owner.toLowerCase().includes(q) || (s.notes ?? '').toLowerCase().includes(q);
    }
    return true;
  }), [typeFilter, statusFilter, moduleFilter, search]);

  const exportCSV = useCallback(() => {
    const headers = ['Name', 'Type', 'Owner', 'Year Range', 'Coverage', 'Variables', 'Format', 'Status', 'Modules', 'Notes'];
    const rows = filtered.map(s => [
      s.name, s.type, s.owner, s.yearRange, s.coverage,
      s.variables, s.format, s.status, s.module.join('; '), s.notes ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`));
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'UNRA_Sources_Catalogue.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  const ALL_MODULES = Array.from(new Set(SOURCES.flatMap(s => s.module))).sort();

  return (
    <div style={{ padding: '20px 18px', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10,
            background: `linear-gradient(135deg, rgba(${hexRgb(C.gray)},0.2), rgba(${hexRgb(C.blue)},0.1))`,
            border: `1px solid rgba(${hexRgb(C.gray)},0.3)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={16} style={{ color: C.gray }}/>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#e2eaf4' }}>Sources & Evidence Catalogue</div>
            <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.65)', marginTop: 1 }}>
              All data sources, surveys, manuals, GIS layers, and reports underpinning the Uganda Roads platform
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: 'Total Sources', value: String(SOURCES.length), color: C.cyan },
            { label: 'Active',   value: String(SOURCES.filter(s=>s.status==='Active').length),   color: C.green  },
            { label: 'Archived', value: String(SOURCES.filter(s=>s.status==='Archived').length), color: C.gray   },
            { label: 'Partial',  value: String(SOURCES.filter(s=>s.status==='Partial').length),  color: C.yellow },
            { label: 'Filtered', value: String(filtered.length), color: C.purple },
          ].map(k => (
            <div key={k.label} style={{ background: `rgba(${hexRgb(k.color)},0.06)`,
              border: `1px solid rgba(${hexRgb(k.color)},0.2)`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(148,163,184,0.5)', marginTop: 3, textTransform: 'uppercase' }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={13} style={{ color: 'rgba(148,163,184,0.5)', flexShrink: 0 }}/>

          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sources..."
            style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 7, color: '#d4dde8', fontSize: 11, padding: '6px 12px',
              width: 200, outline: 'none' }}/>

          {/* Type filter */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {(['All', ...TYPES] as const).map(t => (
              <button key={t} onClick={() => setTypeFilter(t as any)} style={{
                fontSize: 9, padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontWeight: 700,
                background: typeFilter === t
                  ? (t === 'All' ? 'rgba(255,255,255,0.1)' : `rgba(${hexRgb(TYPE_COLOR[t as SourceType])},0.15)`)
                  : 'rgba(255,255,255,0.03)',
                color: typeFilter === t
                  ? (t === 'All' ? '#d4dde8' : TYPE_COLOR[t as SourceType])
                  : 'rgba(148,163,184,0.5)',
              }}>{t}</button>
            ))}
          </div>

          {/* Status filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['All', 'Active', 'Archived', 'Partial'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                fontSize: 9, padding: '3px 9px', borderRadius: 5, border: 'none', cursor: 'pointer',
                fontWeight: 700,
                background: statusFilter === s ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                color: statusFilter === s
                  ? (s === 'All' ? '#d4dde8' : STATUS_COLOR[s as keyof typeof STATUS_COLOR])
                  : 'rgba(148,163,184,0.5)',
              }}>{s}</button>
            ))}
          </div>

          {/* Module filter */}
          <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)} style={{
            background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 7, color: '#d4dde8', fontSize: 10, padding: '5px 10px' }}>
            <option value="All">All Modules</option>
            {ALL_MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <button onClick={exportCSV} style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
            background: `rgba(${hexRgb(C.cyan)},0.12)`,
            color: C.cyan, fontSize: 11, fontWeight: 700,
            boxShadow: `inset 0 0 0 1px rgba(${hexRgb(C.cyan)},0.3)`,
          }}>
            <Download size={12}/> Export CSV ({filtered.length})
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'rgba(8,14,28,0.6)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 380px)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr style={{ background: 'rgba(8,14,28,0.95)' }}>
                {['Source Name', 'Type', 'Owner', 'Year Range', 'Coverage', 'Key Variables', 'Format', 'Status', 'Modules', 'Link'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 8,
                    fontWeight: 900, color: 'rgba(0,245,255,0.65)',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    borderBottom: '1px solid rgba(0,245,255,0.12)',
                    whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => {
                const tc = TYPE_COLOR[s.type];
                const sc = STATUS_COLOR[s.status];
                return (
                  <tr key={s.name} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '9px 12px', minWidth: 200, maxWidth: 280 }}>
                      <div style={{ fontWeight: 700, color: '#d4dde8', lineHeight: 1.3 }}>{s.name}</div>
                      {s.notes && <div style={{ fontSize: 9, color: 'rgba(100,116,139,0.6)', marginTop: 2, lineHeight: 1.3 }}>{s.notes}</div>}
                    </td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 800,
                        background: `rgba(${hexRgb(tc)},0.12)`, color: tc }}>{s.type}</span>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.7)', whiteSpace: 'nowrap', fontSize: 10 }}>{s.owner}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.6)', whiteSpace: 'nowrap', fontSize: 10, fontFamily: 'monospace' }}>{s.yearRange}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.65)', fontSize: 10, minWidth: 160, maxWidth: 220, lineHeight: 1.4 }}>{s.coverage}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(196,210,225,0.75)', fontSize: 10, minWidth: 180, maxWidth: 240, lineHeight: 1.4 }}>{s.variables}</td>
                    <td style={{ padding: '9px 12px', color: 'rgba(148,163,184,0.55)', fontSize: 9, whiteSpace: 'nowrap' }}>{s.format}</td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 800,
                        background: `rgba(${hexRgb(sc)},0.1)`, color: sc }}>{s.status}</span>
                    </td>
                    <td style={{ padding: '9px 12px', minWidth: 100 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        {s.module.map(m => (
                          <span key={m} style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3,
                            background: 'rgba(255,255,255,0.06)', color: 'rgba(148,163,184,0.6)',
                            fontWeight: 700 }}>{m}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {s.link && (
                        <a href={s.link} target="_blank" rel="noopener noreferrer"
                          style={{ color: C.cyan, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                          <ExternalLink size={10}/> Open
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '40px', textAlign: 'center', color: 'rgba(100,116,139,0.5)', fontSize: 12 }}>
                    No sources match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
