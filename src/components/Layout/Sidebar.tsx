import { useState } from 'react';
import {
  Activity, Shield, Construction, Layers, Network, Building2,
  DollarSign, Clock, Database, ShieldCheck, Route, Globe, Landmark,
  ChevronDown,
} from 'lucide-react';
import { useBMS } from '../../store/BMSContext';
import { useAuth } from '../../modules/Auth/AuthContext';
import type { ActiveView } from '../../types';

interface Section {
  id:     ActiveView;
  label:  string;
  icon:   React.ReactNode;
  color:  string;
}

interface Group {
  id:    string;
  label: string;
  icon:  React.ReactNode;
  color: string;
  items: ActiveView[];
}

const N = {
  indigo: '#6366f1', cyan:   '#00f5ff', orange: '#ff6b35',
  teal:   '#00d4aa', blue:   '#4d9fff', purple: '#b967ff',
  green:  '#00ff88', yellow: '#ffd23f', pink:   '#ff2d78',
  gray:   '#94a3b8',
};

// Per-section metadata (label / icon / colour) — looked up by id.
const SECTIONS: Record<string, Section> = {
  rms:           { id: 'rms',           label: 'RMS — Road Mgmt System',   icon: <Route size={14}/>,        color: N.cyan   },
  roadcondition: { id: 'roadcondition', label: 'Pavement Management',      icon: <Activity size={14}/>,     color: N.orange },
  bms:           { id: 'bms',           label: 'Bridge Management',         icon: <Network size={14}/>,      color: N.blue   },
  roadreserve:   { id: 'roadreserve',   label: 'Road Reserve Management',   icon: <Landmark size={14}/>,     color: N.teal   },
  traffic:       { id: 'traffic',       label: 'Traffic Information',       icon: <Layers size={14}/>,       color: N.cyan   },
  projects:      { id: 'projects',      label: 'Projects & Works',          icon: <Construction size={14}/>, color: N.green  },
  pim:           { id: 'pim',           label: 'Public Investment',         icon: <Building2 size={14}/>,    color: N.yellow },
  budget:        { id: 'budget',        label: 'Budget & Maintenance',      icon: <DollarSign size={14}/>,   color: N.pink   },
  lifecycle:     { id: 'lifecycle',     label: 'Life Cycle Management',     icon: <Clock size={14}/>,        color: N.teal   },
  casestudies:   { id: 'casestudies',   label: 'National Case Studies',       icon: <Globe size={14}/>,        color: N.teal   },
  sources:       { id: 'sources',       label: 'Sources & Evidence',        icon: <Database size={14}/>,     color: N.gray   },
  admin:         { id: 'admin',         label: 'Admin Tools',               icon: <ShieldCheck size={14}/>,  color: N.cyan   },
  gisenterprise: { id: 'gisenterprise', label: 'GIS Enterprise',            icon: <Layers size={14}/>,       color: N.purple },
};

// Four top-level tabs — each groups its child sections. Navigation is unchanged
// (each child still calls navigate(id)); this is a presentation/IA grouping only.
const GROUPS: Group[] = [
  { id: 'assets',    label: 'Network & Assets',      icon: <Network size={15}/>,      color: N.cyan,   items: ['rms', 'roadcondition', 'bms', 'roadreserve'] },
  { id: 'traffic',   label: 'Traffic & Performance', icon: <Activity size={15}/>,     color: N.orange, items: ['traffic'] },
  { id: 'planning',  label: 'Planning & Investment', icon: <Building2 size={15}/>,    color: N.green,  items: ['projects', 'pim', 'budget', 'lifecycle'] },
  { id: 'knowledge', label: 'Knowledge & Admin',     icon: <Shield size={15}/>,       color: N.purple, items: ['casestudies', 'sources', 'gisenterprise', 'admin'] },
];

export default function Sidebar() {
  const { state, navigate } = useBMS();
  const { structures, activeView } = state;
  const { user } = useAuth();

  const criticalCount = structures.filter(s => s.conditionRating === 1).length;

  // super level: dashboards & reports only — Admin Tools stays hidden
  const isAdmin = user?.role === 'admin';
  const visibleGroups = GROUPS
    .map(g => ({ ...g, items: g.items.filter(id => id !== 'admin' || isAdmin) }))
    .filter(g => g.items.length > 0);

  // Which top-level tab is expanded — defaults to the one holding the active view.
  const groupOf = (view: string) =>
    visibleGroups.find(g => g.items.includes(view as ActiveView))?.id ?? visibleGroups[0]?.id;
  const [openGroup, setOpenGroup] = useState<string | undefined>(groupOf(activeView));

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
          <img
            src={`${import.meta.env.BASE_URL}mowt.jpg`}
            alt="Ministry of Works and Transport"
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0, objectFit: 'contain',
              background: '#fff', padding: 2,
              border: '1px solid rgba(0,245,255,0.3)',
              boxShadow: '0 0 16px rgba(0,245,255,0.15)',
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#00f5ff',
              letterSpacing: '0.12em', lineHeight: 1.2,
              textShadow: '0 0 12px rgba(0,245,255,0.5)' }}>UGROADS</div>
            <div style={{ fontSize: 8, color: 'rgba(148,163,184,0.6)', letterSpacing: '0.04em' }}>
              Ministry of Works & Transport · DNR
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

      {/* ── 4 top-level tabs (accordion groups) ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {visibleGroups.map(g => {
          const grp = hexToRgb(g.color);
          const isOpen = openGroup === g.id;
          const hasActive = g.items.includes(activeView as ActiveView);
          return (
            <div key={g.id} style={{ marginBottom: 4 }}>
              {/* Group header = top-level tab */}
              <button
                onClick={() => setOpenGroup(isOpen ? undefined : g.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                  padding: '10px 11px', borderRadius: 8,
                  fontSize: 11.5, fontWeight: 800, letterSpacing: '0.02em',
                  cursor: 'pointer', border: 'none', textAlign: 'left',
                  transition: 'all 0.15s',
                  background: isOpen || hasActive ? `rgba(${grp},0.13)` : 'rgba(255,255,255,0.02)',
                  color: isOpen || hasActive ? g.color : 'rgba(203,213,225,0.85)',
                  borderLeft: hasActive ? `3px solid ${g.color}` : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!isOpen && !hasActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isOpen && !hasActive) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; }}
              >
                <span style={{ color: g.color, flexShrink: 0,
                  filter: isOpen || hasActive ? `drop-shadow(0 0 6px ${g.color})` : 'none' }}>
                  {g.icon}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.label}
                </span>
                <ChevronDown size={13} style={{
                  flexShrink: 0, opacity: 0.7,
                  transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s',
                }}/>
              </button>

              {/* Child sections */}
              <div style={{
                overflow: 'hidden',
                maxHeight: isOpen ? `${g.items.length * 40 + 8}px` : '0px',
                transition: 'max-height 0.25s ease',
              }}>
                <div style={{ padding: '4px 0 4px 8px' }}>
                  {g.items.map(id => {
                    const s = SECTIONS[id];
                    if (!s) return null;
                    const isActive = activeView === id;
                    const rgb = hexToRgb(s.color);
                    return (
                      <button
                        key={id}
                        onClick={() => navigate(id)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 9,
                          padding: '8px 11px', borderRadius: 7, marginBottom: 2,
                          fontSize: 10.5, fontWeight: isActive ? 800 : 600,
                          cursor: 'pointer', border: 'none', textAlign: 'left',
                          transition: 'all 0.15s',
                          background: isActive ? `rgba(${rgb},0.14)` : 'transparent',
                          color: isActive ? s.color : 'rgba(203,213,225,0.7)',
                          borderLeft: isActive ? `2px solid ${s.color}` : '2px solid transparent',
                        }}
                        onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = '#e2eaf4'; } }}
                        onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(203,213,225,0.7)'; } }}
                      >
                        <span style={{ color: isActive ? s.color : 'rgba(148,163,184,0.5)', flexShrink: 0,
                          filter: isActive ? `drop-shadow(0 0 5px ${s.color})` : 'none' }}>
                          {s.icon}
                        </span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.label}
                        </span>
                        {isActive && (
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%', background: s.color, flexShrink: 0,
                            boxShadow: `0 0 8px ${s.color}`, animation: 'pulse 2s ease-in-out infinite',
                          }}/>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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
