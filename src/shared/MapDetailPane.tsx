/**
 * MapDetailPane — Right-side panel companion to a map.
 *
 * • Default view: general statistics/charts for the section.
 * • Selected view: detailed attributes for a clicked feature.
 *
 * Dark glass styling, fixed width (default 340), internally scrollable.
 * Animated transition between default and selected states.
 */
import type { ReactNode, CSSProperties } from 'react';
import { X } from 'lucide-react';

export interface MapDetailPaneProps {
  /** Content shown when no feature is selected. */
  defaultContent:    ReactNode;
  /** Currently selected feature (null when nothing is selected). */
  selectedFeature:   any | null;
  /** Renderer for selected-feature content. */
  renderFeature:    (f: any) => ReactNode;
  /** Title shown in the default header. */
  defaultTitle?:     string;
  /** Subtitle shown in the default header. */
  defaultSubtitle?:  string;
  /** Title shown when something is selected. */
  selectedTitle?:    string;
  /** Optional close handler — shows ✕ in header when selected. */
  onClose?:          () => void;
  /** Pane width in pixels. Default 340. */
  width?:            number;
  /** Accent colour (active border, highlights). */
  accent?:           string;
}

export default function MapDetailPane({
  defaultContent,
  selectedFeature,
  renderFeature,
  defaultTitle    = 'Section Overview',
  defaultSubtitle = '',
  selectedTitle   = 'Selected Feature',
  onClose,
  width           = 340,
  accent          = '#4d9fff',
}: MapDetailPaneProps) {
  const hasSelection = selectedFeature != null;

  const containerStyle: CSSProperties = {
    width,
    flexShrink: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(4,9,18,0.92)',
    backdropFilter: 'blur(16px) saturate(160%)',
    WebkitBackdropFilter: 'blur(16px) saturate(160%)',
    borderLeft: `1px solid ${accent}33`,
    boxShadow: `-4px 0 24px rgba(0,0,0,0.4), inset 1px 0 0 ${accent}22`,
    fontFamily: "'Inter','Segoe UI',sans-serif",
    overflow: 'hidden',
  };

  const headerStyle: CSSProperties = {
    flexShrink: 0,
    padding: '12px 14px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    background: `linear-gradient(180deg, ${accent}11, transparent)`,
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '12px 14px',
  };

  return (
    <aside style={containerStyle}>
      <style>{`
        @keyframes mdp-slide-in { from { opacity: 0; transform: translateX(8px); } to { opacity: 1; transform: translateX(0); } }
        .mdp-content { animation: mdp-slide-in 0.18s ease-out; }
      `}</style>

      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '0.08em',
              color: accent, textTransform: 'uppercase',
            }}>
              {hasSelection ? selectedTitle : defaultTitle}
            </div>
            {!hasSelection && defaultSubtitle && (
              <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.6)', marginTop: 3, lineHeight: 1.45 }}>
                {defaultSubtitle}
              </div>
            )}
            {hasSelection && (
              <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 3 }}>
                Click another feature or close ✕ to return to overview
              </div>
            )}
          </div>
          {hasSelection && onClose && (
            <button onClick={onClose} style={{
              padding: 4, borderRadius: 6, cursor: 'pointer', flexShrink: 0,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(148,163,184,0.7)',
            }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div style={bodyStyle}>
        <div className="mdp-content" key={hasSelection ? 'feature' : 'default'}>
          {hasSelection ? renderFeature(selectedFeature) : defaultContent}
        </div>
      </div>
    </aside>
  );
}

// ── Helper card components used by section panes ─────────────────────────────

export function StatCard({
  label, value, unit, color = '#4d9fff', sub,
}: { label: string; value: string | number; unit?: string; color?: string; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)',
      border: `1px solid ${color}33`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 8, padding: '10px 12px', marginBottom: 8,
    }}>
      <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.55)',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 20, fontWeight: 900, color, lineHeight: 1,
          textShadow: `0 0 12px ${color}55` }}>{value}</span>
        {unit && <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.55)', fontWeight: 700 }}>{unit}</span>}
      </div>
      {sub && <div style={{ fontSize: 9, color: 'rgba(148,163,184,0.5)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function AttributeRow({
  label, value, color = '#e2eaf4', mono = false,
}: { label: string; value: React.ReactNode; color?: string; mono?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
      fontSize: 9.5,
    }}>
      <span style={{ color: 'rgba(148,163,184,0.65)', fontWeight: 600 }}>{label}</span>
      <span style={{
        color, fontWeight: 700,
        fontFamily: mono ? 'monospace' : 'inherit',
        textAlign: 'right', maxWidth: '60%',
      }}>{value ?? '—'}</span>
    </div>
  );
}

export function SectionHeader({ title, accent = '#4d9fff' }: { title: string; accent?: string }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
      textTransform: 'uppercase', color: accent,
      marginTop: 12, marginBottom: 6,
      paddingBottom: 4, borderBottom: `1px solid ${accent}33`,
    }}>{title}</div>
  );
}
