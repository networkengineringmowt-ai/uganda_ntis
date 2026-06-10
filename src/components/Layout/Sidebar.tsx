import {
  Activity, Shield, Construction, Layers, Network, Building2,
  DollarSign, Clock, Database, ShieldCheck, Route, Globe, Landmark,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import type { ActiveView } from '../../types';

interface Section {
  id:     ActiveView;
  label:  string;
  icon:   React.ReactNode;
  color:  string;
}

const N = {
  indigo: '#6366f1', cyan:   '#00f5ff', orange: '#ff6b35',
  teal:   '#00d4aa', blue:   '#4d9fff', purple: '#b967ff',
  green:  '#00ff88', yellow: '#ffd23f', pink:   '#ff2d78',
  gray:   '#94a3b8',
};

// Single flat list — each section is a direct nav button. No expand/collapse.
const SECTIONS: Section[] = [
  { id: 'rms',           label: 'RMS — Road Mgmt System',    icon: <Route size={15}/>,        color: N.cyan   },
  { id: 'roadcondition', label: 'Pavement Management',       icon: <Activity size={15}/>,     color: N.orange },
  { id: 'traffic',       label: 'Traffic Information',        icon: <Layers size={15}/>,       color: N.cyan   },
  { id: 'bms',           label: 'Bridge Management',          icon: <Network size={15}/>,      color: N.blue   },
  { id: 'roadreserve',   label: 'Road Reserve Management',    icon: <Landmark size={15}/>,     color: N.teal   },
  { id: 'projects',      label: 'Projects & Works',           icon: <Construction size={15}/>, color: N.green  },
  { id: 'pim',           label: 'Public Investment',          icon: <Building2 size={15}/>,    color: N.yellow },
  { id: 'budget',        label: 'Budget & Maintenance',       icon: <DollarSign size={15}/>,   color: N.pink   },
  { id: 'lifecycle',     label: 'Life Cycle Management',      icon: <Clock size={15}/>,        color: N.teal   },
  { id: 'casestudies',   label: 'Global Case Studies',       icon: <Globe size={15}/>,        color: N.teal   },
  { id: 'sources',       label: 'Sources & Evidence',         icon: <Database size={15}/>,     color: N.gray   },
  { id: 'admin',         label: 'Admin Tools',                icon: <ShieldCheck size={15}/>,  color: N.cyan   },
];

export default function Sidebar() {
  const { state, navigate } = useBMS();
  const { structures, activeView } = state;

  const criticalCount = structures.filter(s => s.conditionRating === 1).length;

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
              Asset Management · DNR
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
        <StatPill label="Roads"    value="21.3k" color={N.cyan} />
        <StatPill label="Bridges"  value={String(structures.filter(s=>s.type==='bridge').length)} color={N.blue} />
        <StatPill label="Critical" value={String(criticalCount)} color={N.pink} />
      </div>

      {/* ── Flat Navigation — one click per section ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {SECTIONS.map(s => {
          const isActive = activeView === s.id;
          const rgb = hexToRgb(s.color);
          return (
            <button
              key={s.id}
              onClick={() => navigate(s.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8, marginBottom: 3,
                fontSize: 11, fontWeight: isActive ? 800 : 600,
                cursor: 'pointer', border: 'none', textAlign: 'left',
                transition: 'all 0.15s',
                background: isActive ? `rgba(${rgb},0.14)` : 'rgba(255,255,255,0.02)',
                color: isActive ? s.color : 'rgba(203,213,225,0.78)',
                borderLeft: isActive ? `3px solid ${s.color}` : '3px solid transparent',
                boxShadow: isActive ? `inset 0 0 18px rgba(${rgb},0.08)` : 'none',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
                  (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(203,213,225,0.78)';
                }
              }}
            >
              <span style={{
                color: isActive ? s.color : 'rgba(148,163,184,0.55)',
                flexShrink: 0,
                filter: isActive ? `drop-shadow(0 0 6px ${s.color})` : 'none',
                transition: 'all 0.2s',
              }}>
                {s.icon}
              </span>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
              {isActive && (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0,
                  boxShadow: `0 0 8px ${s.color}`,
                  animation: 'pulse 2s ease-in-out infinite',
                }}/>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(0,245,255,0.08)', textAlign: 'center' }}>
        <div style={{ fontSize: 7.5, color: 'rgba(100,116,139,0.45)', letterSpacing: '0.05em' }}>
          Uganda NRMS v4.0 · DNR 2026 (FY25-26)
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

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
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
