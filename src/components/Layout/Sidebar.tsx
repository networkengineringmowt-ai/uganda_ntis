import {
  LayoutDashboard, Map, Table2, ClipboardCheck, Activity,
  Wrench, BarChart3, AlertTriangle, FolderOpen, ChevronRight,
  Shield, Camera, Globe, Construction, Truck, Network, BookOpen,
  Video, Gauge, Download,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { ActiveView } from '../../types';

interface NavItem {
  id:     ActiveView;
  label:  string;
  icon:   React.ReactNode;
  color?: string;   // neon accent for active state
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const N = {
  cyan:   '#00f5ff',
  green:  '#00ff88',
  orange: '#ff6b35',
  purple: '#b967ff',
  yellow: '#ffd23f',
  pink:   '#ff2d78',
  blue:   '#4d9fff',
};

export default function Sidebar() {
  const { state, navigate } = useBMS();
  const { structures, workOrders, activeView } = state;

  const criticalCount = structures.filter(s => s.conditionRating === 1).length;
  const overdueCount  = structures.filter(s => s.inspectionDue).length;
  const activeWOCount = workOrders.filter(w => w.status === 'In Progress').length;

  const sections: NavSection[] = [
    {
      title: 'National Roads Platform',
      items: [
        { id: 'platform',      label: 'Platform Overview',   icon: <Globe size={15}/>,        color: N.cyan   },
        { id: 'networkstory',  label: 'Network Story 1986–', icon: <BookOpen size={15}/>,     color: N.purple },
        { id: 'roadnetwork',   label: 'Road Network Map',    icon: <Map size={15}/>,           color: N.green  },
        { id: 'roadvideoview', label: 'Road Survey Video',   icon: <Video size={15}/>,         color: N.orange },
        { id: 'traffic',       label: 'Traffic & Demand',    icon: <Truck size={15}/>,         color: N.yellow },
        { id: 'roadcondition', label: 'Road Condition',      icon: <Activity size={15}/>,      color: N.blue   },
        { id: 'atc',           label: 'ATC Dashboard',       icon: <Gauge size={15}/>,          color: N.yellow },
        { id: 'projects',      label: 'Projects & Works',    icon: <Construction size={15}/>,  color: N.pink   },
      ],
    },
    {
      title: 'Bridge Management System',
      items: [
        { id: 'dashboard',   label: 'BMS Dashboard',        icon: <LayoutDashboard size={15}/>, color: N.cyan   },
        { id: 'gismap',      label: 'Structure Map',            icon: <Network size={15}/>,         color: N.green  },
        { id: 'registry',    label: 'Structure Registry',    icon: <Table2 size={15}/>,           color: N.blue   },
        { id: 'inspections', label: 'Inspections',           icon: <ClipboardCheck size={15}/>,  color: N.yellow },
        { id: 'condition',   label: 'Condition Assessment',  icon: <Activity size={15}/>,         color: N.orange },
        { id: 'maintenance', label: 'Maintenance & Works',   icon: <Wrench size={15}/>,           color: N.purple },
        { id: 'analytics',   label: 'Analytics & Reports',   icon: <BarChart3 size={15}/>,        color: N.cyan   },
        { id: 'priority',    label: 'Priority Ranking',      icon: <AlertTriangle size={15}/>,    color: N.pink   },
        { id: 'documents',   label: 'Document Store',        icon: <FolderOpen size={15}/>,       color: N.blue   },
        { id: 'phototwin',   label: 'Photo & Digital Twin',  icon: <Camera size={15}/>,           color: N.green  },
        { id: 'downloads',   label: 'Downloads & Exports',   icon: <Download size={15}/>,          color: N.yellow },
      ],
    },
  ];

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
        width: 240,
        minWidth: 240,
        background: 'rgba(2,5,8,0.95)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
        borderRight: '1px solid rgba(0,245,255,0.10)',
        boxShadow: '4px 0 32px rgba(0,0,0,0.6), 1px 0 0 rgba(0,245,255,0.05)',
      }}
    >
      {/* ── Brand header ── */}
      <div style={{ padding: '16px 14px 14px', borderBottom: '1px solid rgba(0,245,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Logo orb */}
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(77,159,255,0.15))',
            border: '1px solid rgba(0,245,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(0,245,255,0.15)',
          }}>
            <Shield size={16} style={{ color: '#00f5ff' }}/>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 900, color: '#00f5ff',
              letterSpacing: '0.12em', lineHeight: 1.2,
              textShadow: '0 0 12px rgba(0,245,255,0.5)',
            }}>
              UGROADS
            </div>
            <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.7)', letterSpacing: '0.05em' }}>
              DNR · Ministry Works &amp; Transport
            </div>
          </div>
        </div>

        {/* Animated scan line */}
        <div style={{
          marginTop: 10, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,245,255,0.4), transparent)',
          animation: 'scanLineAnim 3s ease-in-out infinite',
        }}/>
      </div>

      {/* ── Network summary strip ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        borderBottom: '1px solid rgba(0,245,255,0.08)',
      }}>
        <StatPill label="Roads"    value="21.3k" unit="km"  color={N.cyan}   />
        <StatPill label="Bridges"  value={String(structures.filter(s=>s.type==='bridge').length)} unit="str" color={N.blue}  />
        <StatPill label="Critical" value={String(criticalCount)} unit="⚠"   color={N.pink}   />
      </div>

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 8px' }}>
        {sections.map(section => (
          <div key={section.title} style={{ marginBottom: 4 }}>
            {/* Section label */}
            <div style={{
              padding: '10px 8px 4px',
              fontSize: 8, fontWeight: 900,
              color: 'rgba(0,245,255,0.35)',
              textTransform: 'uppercase', letterSpacing: '0.16em',
            }}>
              {section.title}
            </div>

            {section.items.map(item => {
              const isActive = activeView === item.id;
              const badge    = getBadge(item.id);
              const accent   = item.color ?? N.cyan;

              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 8, marginBottom: 2,
                    fontSize: 12, fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer', border: 'none', textAlign: 'left',
                    transition: 'all 0.15s',
                    background: isActive
                      ? `rgba(${hexToRgb(accent)}, 0.10)`
                      : 'transparent',
                    color: isActive ? accent : 'rgba(148,163,184,0.75)',
                    boxShadow: isActive
                      ? `inset 0 0 0 1px rgba(${hexToRgb(accent)},0.25), 0 0 12px rgba(${hexToRgb(accent)},0.08)`
                      : 'none',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
                      (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.color = 'rgba(148,163,184,0.75)';
                    }
                  }}
                >
                  {/* Icon */}
                  <span style={{
                    color: isActive ? accent : 'rgba(100,116,139,0.8)',
                    flexShrink: 0,
                    filter: isActive ? `drop-shadow(0 0 6px ${accent})` : 'none',
                    transition: 'all 0.15s',
                  }}>
                    {item.icon}
                  </span>

                  {/* Label */}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>

                  {/* Badge */}
                  {badge && (
                    <span style={{
                      fontSize: 9, fontWeight: 800,
                      padding: '1px 5px', borderRadius: 10,
                      background: isActive ? `rgba(${hexToRgb(accent)},0.2)` : 'rgba(255,51,102,0.15)',
                      color: isActive ? accent : '#ff3366',
                      border: `1px solid ${isActive ? `rgba(${hexToRgb(accent)},0.4)` : 'rgba(255,51,102,0.35)'}`,
                      flexShrink: 0,
                    }}>{badge}</span>
                  )}

                  {/* Active chevron */}
                  {isActive && (
                    <ChevronRight size={10} style={{ color: `rgba(${hexToRgb(accent)},0.6)`, flexShrink: 0 }}/>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div style={{
        padding: '10px 14px',
        borderTop: '1px solid rgba(0,245,255,0.08)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 8, color: 'rgba(100,116,139,0.5)', letterSpacing: '0.05em' }}>
          Uganda National Road Management System v3.0 · DNR 2025
        </div>
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: '#00ff88',
            boxShadow: '0 0 6px #00ff88',
            animation: 'pulse 2s ease-in-out infinite',
            display: 'inline-block',
          }}/>
          <span style={{ fontSize: 8, color: 'rgba(0,255,136,0.6)' }}>System Online</span>
        </div>
      </div>
    </aside>
  );
}

function StatPill({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '7px 4px',
      background: `rgba(${hexToRgb(color)}, 0.04)`,
      borderRight: '1px solid rgba(0,245,255,0.05)',
    }}>
      <span style={{
        fontSize: 13, fontWeight: 900, lineHeight: 1,
        color,
        textShadow: `0 0 10px ${color}60`,
      }}>{value}</span>
      <span style={{ fontSize: 7, color: 'rgba(100,116,139,0.6)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  );
}

/** Convert 6-char hex to "r,g,b" for rgba() */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return `${r},${g},${b}`;
}
