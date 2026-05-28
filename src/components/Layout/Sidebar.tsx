import { useState } from 'react';
import {
  LayoutDashboard, Map, Table2, ClipboardCheck, Activity,
  Wrench, BarChart3, BarChart2, AlertTriangle, FolderOpen, ChevronRight, ChevronDown,
  Shield, Camera, Globe, Construction, Layers, Network, BookOpen,
  Download, TrendingUp, Weight, Cpu, DollarSign, Clock,
  Database, FileText, Building2,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { ActiveView } from '../../types';

interface NavItem {
  id:     ActiveView;
  label:  string;
  icon:   React.ReactNode;
}

interface Module {
  id:     string;
  label:  string;
  icon:   React.ReactNode;
  color:  string;
  items:  NavItem[];
}

const N = {
  indigo: '#6366f1', cyan:   '#00f5ff', orange: '#ff6b35',
  teal:   '#00d4aa', blue:   '#4d9fff', purple: '#b967ff',
  green:  '#00ff88', yellow: '#ffd23f', pink:   '#ff2d78',
  gray:   '#94a3b8',
};

const MODULES: Module[] = [
  {
    id: 'network', label: 'Network Overview', icon: <Globe size={14}/>, color: N.indigo,
    items: [
      { id: 'platform',       label: 'Platform Dashboard',  icon: <LayoutDashboard size={13}/> },
      { id: 'networkstory',   label: 'Network Story 1986–', icon: <BookOpen size={13}/> },
      { id: 'roadnetwork',    label: 'Road Network Map',    icon: <Map size={13}/> },
      { id: 'mlarchitecture', label: 'ML Architecture',     icon: <Cpu size={13}/> },
      { id: 'roadatlas',      label: 'Visual Atlas',         icon: <Layers size={13}/> },
      { id: 'media',          label: 'Media Gallery',       icon: <Camera size={13}/> },
    ],
  },
  {
    id: 'pms', label: 'PMS — Pavement Mgmt', icon: <Activity size={14}/>, color: N.orange,
    items: [
      { id: 'roadcondition', label: 'Road Condition Map', icon: <Activity size={13}/> },
      { id: 'hdm4',          label: 'HDM-4 Models',       icon: <TrendingUp size={13}/> },
    ],
  },
  {
    id: 'tis', label: 'TIS — Traffic', icon: <Layers size={14}/>, color: N.cyan,
    items: [
      { id: 'traffic',          label: 'Traffic Map',       icon: <Layers size={13}/> },
      { id: 'trafficanalytics', label: 'Traffic Analytics', icon: <BarChart2 size={13}/> },
      { id: 'trafficsummary',   label: 'Traffic Tables',    icon: <Table2 size={13}/> },
      { id: 'growthfactors',    label: 'Growth Factors',    icon: <TrendingUp size={13}/> },
      { id: 'overloading',      label: 'Overloading Risk',  icon: <Weight size={13}/> },
    ],
  },
  {
    id: 'bms', label: 'BMS — Bridges', icon: <Network size={14}/>, color: N.blue,
    items: [
      { id: 'bridgesection', label: 'Bridge Data 2026',   icon: <Database size={13}/> },
      { id: 'dashboard',     label: 'BMS Dashboard',      icon: <LayoutDashboard size={13}/> },
      { id: 'gismap',      label: 'Structure Map',        icon: <Network size={13}/> },
      { id: 'registry',    label: 'Structure Registry',   icon: <Table2 size={13}/> },
      { id: 'inspections', label: 'Inspections',          icon: <ClipboardCheck size={13}/> },
      { id: 'condition',   label: 'Condition Assessment', icon: <Activity size={13}/> },
      { id: 'maintenance', label: 'Maintenance & Works',  icon: <Wrench size={13}/> },
      { id: 'analytics',   label: 'Analytics & Reports',  icon: <BarChart3 size={13}/> },
      { id: 'priority',    label: 'Priority Ranking',     icon: <AlertTriangle size={13}/> },
      { id: 'documents',   label: 'Document Store',       icon: <FolderOpen size={13}/> },
      { id: 'phototwin',   label: 'Photo & Digital Twin', icon: <Camera size={13}/> },
      { id: 'downloads',   label: 'Downloads & Exports',  icon: <Download size={13}/> },
    ],
  },
  {
    id: 'hdm4mod', label: 'HDM-4', icon: <TrendingUp size={14}/>, color: N.purple,
    items: [
      { id: 'hdm4', label: 'HDM-4 Full Module', icon: <TrendingUp size={13}/> },
    ],
  },
  {
    id: 'projects', label: 'Projects & Works', icon: <Construction size={14}/>, color: N.green,
    items: [
      { id: 'projects',       label: 'Ongoing Projects', icon: <Construction size={13}/> },
      { id: 'oprc',           label: 'OPRC Contracts',   icon: <TrendingUp size={13}/> },
      { id: 'ndpiv',          label: 'NDP IV',           icon: <TrendingUp size={13}/> },
      { id: 'projecttracker', label: 'Project Tracker',  icon: <BarChart2 size={13}/> },
    ],
  },
  {
    id: 'pim', label: 'Public Investment', icon: <Building2 size={14}/>, color: N.yellow,
    items: [
      { id: 'pim', label: 'PIM & PPPs', icon: <DollarSign size={13}/> },
    ],
  },
  {
    id: 'budget', label: 'Budget & Maintenance', icon: <DollarSign size={14}/>, color: N.pink,
    items: [
      { id: 'budget', label: 'Budget Planning', icon: <DollarSign size={13}/> },
    ],
  },
  {
    id: 'lifecycle', label: 'Life Cycle Mgmt', icon: <Clock size={14}/>, color: N.teal,
    items: [
      { id: 'lifecycle', label: 'Link Lifecycles', icon: <Clock size={13}/> },
    ],
  },
  {
    id: 'sources', label: 'Sources & Evidence', icon: <Database size={14}/>, color: N.gray,
    items: [
      { id: 'sources', label: 'Evidence Catalogue', icon: <FileText size={13}/> },
    ],
  },
];

export default function Sidebar() {
  const { state, navigate } = useBMS();
  const { structures, workOrders, activeView } = state;

  const criticalCount = structures.filter(s => s.conditionRating === 1).length;
  const overdueCount  = structures.filter(s => s.inspectionDue).length;
  const activeWOCount = workOrders.filter(w => w.status === 'In Progress').length;

  const activeModuleId = MODULES.find(m => m.items.some(i => i.id === activeView))?.id ?? 'network';
  const [openModules, setOpenModules] = useState<Set<string>>(new Set([activeModuleId]));

  function toggleModule(id: string) {
    setOpenModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function getBadge(id: ActiveView): string | undefined {
    if (id === 'priority'    && criticalCount > 0) return String(criticalCount);
    if (id === 'inspections' && overdueCount  > 0) return String(overdueCount);
    if (id === 'maintenance' && activeWOCount > 0) return String(activeWOCount);
    return undefined;
  }

  return (
    <aside
      className="flex flex-col z-20 flex-shrink-0"
      style={{
        width: 240, minWidth: 240,
        background: 'rgba(8,14,28,0.72)',
        backdropFilter: 'blur(28px) saturate(200%)',
        WebkitBackdropFilter: 'blur(28px) saturate(200%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.6), 1px 0 0 rgba(0,245,255,0.05)',
      }}
    >
      {/* Brand header */}
      <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(77,159,255,0.15))',
            border: '1px solid rgba(0,245,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,245,255,0.15)',
          }}>
            <Shield size={15} style={{ color: '#00f5ff' }}/>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#00f5ff',
              letterSpacing: '0.12em', lineHeight: 1.2,
              textShadow: '0 0 12px rgba(0,245,255,0.5)' }}>UGROADS</div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.04em' }}>
              Asset Management · UNRA DNR
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 9, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,245,255,0.4), transparent)',
          animation: 'scanLineAnim 3s ease-in-out infinite',
        }}/>
      </div>

      {/* Network summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
        <StatPill label="Roads"    value="21.3k" unit="km"  color={N.cyan}   />
        <StatPill label="Bridges"  value={String(structures.filter(s=>s.type==='bridge').length)} unit="str" color={N.blue}  />
        <StatPill label="Critical" value={String(criticalCount)} unit="⚠"    color={N.pink}   />
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '5px 5px' }}>
        {MODULES.map(mod => {
          const isOpen   = openModules.has(mod.id);
          const isActive = mod.items.some(i => i.id === activeView);
          const accent   = mod.color;

          return (
            <div key={mod.id} style={{ marginBottom: 1 }}>
              <button
                onClick={() => toggleModule(mod.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 8px', borderRadius: 7, marginBottom: 1,
                  fontSize: 9, fontWeight: 900,
                  cursor: 'pointer', border: 'none', textAlign: 'left',
                  transition: 'all 0.15s',
                  background: isActive ? `rgba(${hexToRgb(accent)},0.10)` : 'rgba(255,255,255,0.02)',
                  color: isActive ? accent : 'rgba(148,163,184,0.70)',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <span style={{ color: isActive ? accent : 'rgba(148,163,184,0.5)', flexShrink: 0,
                  filter: isActive ? `drop-shadow(0 0 5px ${accent})` : 'none' }}>
                  {mod.icon}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {mod.label}
                </span>
                {isOpen
                  ? <ChevronDown size={9} style={{ color: `rgba(${hexToRgb(accent)},0.5)`, flexShrink: 0 }}/>
                  : <ChevronRight size={9} style={{ color: 'rgba(148,163,184,0.3)', flexShrink: 0 }}/>}
              </button>

              {isOpen && (
                <div style={{ marginLeft: 8, borderLeft: `1px solid rgba(${hexToRgb(accent)},0.15)`, paddingLeft: 5, marginBottom: 3 }}>
                  {mod.items.map(item => {
                    const isItemActive = activeView === item.id;
                    const badge = getBadge(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 8px', borderRadius: 6, marginBottom: 1,
                          fontSize: 11, fontWeight: isItemActive ? 800 : 500,
                          cursor: 'pointer', border: 'none', textAlign: 'left',
                          transition: 'all 0.13s',
                          background: isItemActive ? `rgba(${hexToRgb(accent)},0.12)` : 'transparent',
                          color: isItemActive ? accent : 'rgba(180,195,215,0.80)',
                          boxShadow: isItemActive ? `inset 0 0 0 1px rgba(${hexToRgb(accent)},0.25)` : 'none',
                        }}
                        onMouseEnter={e => { if (!isItemActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (!isItemActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                      >
                        <span style={{ color: isItemActive ? accent : 'rgba(148,163,184,0.55)', flexShrink: 0,
                          filter: isItemActive ? `drop-shadow(0 0 4px ${accent})` : 'none' }}>
                          {item.icon}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.label}
                        </span>
                        {badge && (
                          <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 4px', borderRadius: 8,
                            background: isItemActive ? `rgba(${hexToRgb(accent)},0.2)` : 'rgba(255,51,102,0.15)',
                            color: isItemActive ? accent : '#ff3366',
                            border: `1px solid ${isItemActive ? `rgba(${hexToRgb(accent)},0.4)` : 'rgba(255,51,102,0.35)'}`,
                            flexShrink: 0 }}>{badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,245,255,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: 7.5, color: 'rgba(100,116,139,0.45)', letterSpacing: '0.05em' }}>
          Uganda NRMS v4.0 · DNR 2025 · 10-Module IAMS
        </div>
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88',
            boxShadow: '0 0 6px #00ff88', animation: 'pulse 2s ease-in-out infinite', display: 'inline-block' }}/>
          <span style={{ fontSize: 7.5, color: 'rgba(0,255,136,0.6)' }}>System Online</span>
        </div>
      </div>
    </aside>
  );
}

function StatPill({ label, value, unit: _unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 4px',
      background: `rgba(${hexToRgb(color)}, 0.04)`,
      borderRight: '1px solid rgba(0,245,255,0.05)' }}>
      <span style={{ fontSize: 12, fontWeight: 900, lineHeight: 1, color,
        textShadow: `0 0 10px ${color}60` }}>{value}</span>
      <span style={{ fontSize: 6.5, color: 'rgba(100,116,139,0.55)', marginTop: 2,
        textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}
