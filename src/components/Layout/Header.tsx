import { Bell, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useBMS } from '../../store/BMSContext';
import { UserBadge } from '../../modules/Auth/UserBadge';

const CURR = new Date().getFullYear();   // dynamic current year — never hardcode

const VIEW_TITLES: Record<string, { title: string; sub: string; color?: string }> = {
  rms:           { title: 'RMS — Road Management System', sub: 'Overview · Road network map · Road inventory · Network story', color: '#00f5ff' },
  bms:           { title: 'Bridge Management System',     sub: 'Dashboard · Structure map · Inventory & condition · Bridge works', color: '#4d9fff' },
  lifecycle:     { title: 'Life Cycle Management',        sub: 'Per-link timeline · IRI trajectory · Intervention history · Projected maintenance', color: '#00d4aa' },
  budget:        { title: 'Budget & Maintenance',         sub: 'Maintenance financing · Unit-cost matrix · MTEF planning', color: '#ff2d78' },
  pim:           { title: 'Public Investment',            sub: 'PIM funding · PPP projects · Donor vs GoU financing', color: '#ffd23f' },
  projecttracker:{ title: 'Projects & Works',             sub: 'Execution tracking · Physical vs financial progress', color: '#00ff88' },
  oprc:          { title: 'OPRC Contracts',               sub: 'Output & performance-based road contracts · 9 lots', color: '#00ff88' },
  ndpiv:         { title: 'NDP IV Investment',            sub: 'National Development Plan IV road projects & funding', color: '#b967ff' },
  overloading:   { title: 'Overloading & ESAL',           sub: 'Axle-load risk index · Weighbridge analytics · Hotspot map', color: '#ff3366' },
  growthfactors: { title: 'Traffic Growth Factors',       sub: 'Monthly / seasonal expansion factors · Annual growth', color: '#00d4aa' },
  trafficanalytics: { title: 'Traffic Analytics',         sub: 'AADT trends · Vehicle composition · Regional distribution', color: '#00f5ff' },
  trafficsummary:{ title: 'Traffic Summary Tables',       sub: 'Road links & stations · TIS counts', color: '#00f5ff' },
  maintenanceprogramme: { title: 'Maintenance Programme', sub: 'Priority-ranked interventions · PMS programme', color: '#ff6b35' },
  mlarchitecture:{ title: 'ML System Architecture',       sub: 'Model pipeline · Deep learning components', color: '#b967ff' },
  tabularsummaries: { title: 'Tabular Summaries',         sub: '100 cited tables · Platform data hub', color: '#00f5ff' },
  dataaudit:     { title: 'Data Audit',                   sub: 'Cross-section KPI validation · Coverage & freshness', color: '#ffd23f' },
  datacapture:   { title: 'Data Capture',                 sub: 'Field data entry · Writes to the live Supabase database', color: '#00d4aa' },
  pendingsurveys:{ title: 'Pending Submissions',          sub: 'Queued condition surveys awaiting export', color: '#ffd23f' },
  // Platform
  network:       { title: 'Network Overview',              sub: 'Dashboard · Road Network Map · Network Story · Architecture', color: '#6366f1' },
  admin:         { title: 'Admin Tools',                   sub: 'Platform Mind Map · Data Audit · System Architecture',        color: '#00f5ff' },
  sources:       { title: 'Sources & Evidence',            sub: 'Evidence Catalogue · Tabular Summaries · Documents · Downloads', color: '#94a3b8' },
  platform:      { title: 'Platform Overview',            sub: 'Uganda National Roads Management Platform',             color: '#00f5ff' },
  networkstory:  { title: 'Network Story 1986–',          sub: 'Road network development since liberation · 40-year arc', color: '#b967ff' },
  roadnetwork:   { title: 'Road Network Map',             sub: '1,013 national road links · 21,302 km official (FY25-26) · Data: DNR GIS / NDPIV FY25-26', color: '#00ff88' },
  casestudies:   { title: 'Global Case Studies',          sub: 'World map · Comparative analytics · Literature Review Matrix (195 countries) · Lessons for DNR', color: '#00d4aa' },
  roadreserve:   { title: 'Road Reserve Management',      sub: 'Gazette status · Reserve corridor map · Encroachment register · Legal enforcement', color: '#00d4aa' },
  roadvideoview: { title: 'Road Survey Video',             sub: 'Road surface video archive · 2021–2026',               color: '#ff6b35' },
  traffic:       { title: 'Traffic & Demand',             sub: `Network traffic counts · base year 2016 · projected to ${CURR} · 298 TCS stations`,   color: '#ffd23f' },
  roadcondition: { title: 'Pavement Management',          sub: `Road condition · IRI · HDM-4 · maintenance programme · as of ${CURR}`,    color: '#fb923c' },
  atc:           { title: 'ATC Live Dashboard',           sub: 'Automatic Traffic Counters · 10 permanent mother stations · Jul 2025–present', color: '#ffd23f' },
  projects:      { title: 'Projects & Road Development',  sub: 'Ongoing upgrading & construction contracts · FY 2025/26', color: '#ff2d78' },
  // BMS
  gismap:        { title: 'Structure Map',                   sub: 'GIS structure map · All bridges & major culverts · 2018–2024 time series', color: '#00ff88' },
  dashboard:     { title: 'BMS Dashboard',                sub: 'Bridge Management System · DNR',                        color: '#00f5ff' },
  registry:      { title: 'Structure Registry',           sub: '546 bridges · 485 major culverts · 1,031 total',        color: '#4d9fff' },
  inspections:   { title: 'Inspection Management',        sub: 'Schedule, record and track field inspections',          color: '#ffd23f' },
  condition:     { title: 'Condition Assessment',         sub: 'Component ratings and defect analysis',                 color: '#ff6b35' },
  maintenance:   { title: 'Maintenance & Works',          sub: 'Work orders, contracts and maintenance records',        color: '#b967ff' },
  analytics:     { title: 'Analytics & Reports',          sub: 'Condition trends, cost analysis and network insights',  color: '#00f5ff' },
  priority:      { title: 'Priority Ranking',             sub: 'Risk-based intervention priority scores',               color: '#ff2d78' },
  documents:     { title: 'Document Store',               sub: 'Drawings, reports, contracts and records',             color: '#4d9fff' },
  media:         { title: 'Media and Document Gallery',   sub: 'Photography, video surveys, field reports & documents · Uganda national roads', color: '#b967ff' },
  phototwin:     { title: 'Photo Gallery & Digital Twin', sub: 'Inspection photos and structural schematics',          color: '#00ff88' },
};

export default function Header({ showSearch }: { showSearch?: boolean }) {
  const { state, navigate, goBack, goForward, canGoBack, canGoForward } = useBMS();
  const [query, setQuery] = useState('');
  const [now, setNow]     = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(t);
  }, []);

  const meta        = VIEW_TITLES[state.activeView] ?? { title: state.activeView, sub: 'DNR · Ministry of Works & Transport', color: '#00f5ff' };
  const accent      = meta.color ?? '#00f5ff';
  const accentRgb   = hexToRgb(accent);

  const criticalCount = state.structures.filter(s => s.conditionRating === 1).length;
  const dueCount      = state.structures.filter(s => s.inspectionDue).length;
  const alertCount    = criticalCount + dueCount;

  return (
    <header
      className="flex items-center gap-3 flex-shrink-0"
      style={{
        padding: '6px 14px',
        background: 'rgba(2,5,8,0.88)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderBottom: `1px solid rgba(${accentRgb},0.12)`,
        boxShadow: `0 1px 0 rgba(${accentRgb},0.06), 0 4px 24px rgba(0,0,0,0.4)`,
        transition: 'border-color 0.4s, box-shadow 0.4s',
        zIndex: 10,
      }}
    >
      {/* Accent stripe */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
        background: `linear-gradient(to bottom, transparent, ${accent}, transparent)`,
        opacity: 0.7,
      }}/>

      {/* Back / Forward navigation */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        <button
          onClick={goBack}
          disabled={!canGoBack}
          title="Go back"
          style={{
            padding: '5px 7px', borderRadius: 7, cursor: canGoBack ? 'pointer' : 'default',
            background: canGoBack ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${canGoBack ? `rgba(${accentRgb},0.25)` : 'rgba(255,255,255,0.05)'}`,
            color: canGoBack ? accent : 'rgba(100,116,139,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: canGoBack ? 1 : 0.4,
          }}
          onMouseEnter={e => {
            if (canGoBack) {
              (e.currentTarget as HTMLButtonElement).style.background = `rgba(${accentRgb},0.12)`;
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background =
              canGoBack ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
          }}
        >
          <ChevronLeft size={14}/>
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          title="Go forward"
          style={{
            padding: '5px 7px', borderRadius: 7, cursor: canGoForward ? 'pointer' : 'default',
            background: canGoForward ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
            border: `1px solid ${canGoForward ? `rgba(${accentRgb},0.25)` : 'rgba(255,255,255,0.05)'}`,
            color: canGoForward ? accent : 'rgba(100,116,139,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            opacity: canGoForward ? 1 : 0.4,
          }}
          onMouseEnter={e => {
            if (canGoForward) {
              (e.currentTarget as HTMLButtonElement).style.background = `rgba(${accentRgb},0.12)`;
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background =
              canGoForward ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)';
          }}
        >
          <ChevronRight size={14}/>
        </button>
      </div>

      {/* MoWT crest */}
      <img
        src={`${import.meta.env.BASE_URL}mowt.jpg`}
        alt="Ministry of Works and Transport"
        style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0, objectFit: 'contain',
          background: '#fff', padding: 2,
          border: `1px solid rgba(${accentRgb},0.3)`,
          boxShadow: `0 0 14px rgba(${accentRgb},0.18)`,
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }}
      />

      {/* Page title */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{
          fontSize: 15, fontWeight: 800, lineHeight: 1.2,
          color: accent,
          textShadow: `0 0 20px rgba(${accentRgb},0.4)`,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          transition: 'color 0.3s',
        }}>
          {meta.title}
        </h1>
        <p style={{
          fontSize: 10, color: 'rgba(100,116,139,0.8)', marginTop: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {meta.sub} &mdash;{' '}
          {now.toLocaleDateString('en-UG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}{' '}
          <span style={{ fontFamily: 'monospace', color: accent, opacity: 0.7 }}>
            {now.toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} EAT
          </span>
        </p>
      </div>

      {/* Search */}
      {showSearch && (
        <div style={{ position: 'relative', width: 260, flexShrink: 0 }}>
          <Search size={12} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'rgba(0,245,255,0.4)',
          }}/>
          <input
            className="bms-input"
            style={{ paddingLeft: 28, paddingTop: 6, paddingBottom: 6, fontSize: 12 }}
            placeholder="Search structures, roads, IDs…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      )}

      {/* Alert bell */}
      <button
        onClick={() => navigate('priority')}
        title={`${alertCount} alerts`}
        style={{
          position: 'relative',
          padding: '6px', borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(148,163,184,0.7)',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.7)';
        }}
      >
        <Bell size={14}/>
        {alertCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 15, height: 15, borderRadius: '50%',
            background: '#ff3366', boxShadow: '0 0 8px #ff3366',
            fontSize: 8, fontWeight: 800, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {alertCount > 9 ? '9+' : alertCount}
          </span>
        )}
      </button>

      {/* Refresh */}
      <button
        onClick={() => window.location.reload()}
        title="Reload"
        style={{
          padding: '6px', borderRadius: 8, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(148,163,184,0.7)',
          cursor: 'pointer', transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
          (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.7)';
        }}
      >
        <RefreshCw size={14}/>
      </button>

      {/* User badge (role-aware) */}
      <UserBadge />
    </header>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}
