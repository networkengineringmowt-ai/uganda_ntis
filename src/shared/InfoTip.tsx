/**
 * InfoTip / Term / Tip — universal hover tooltips backed by the data dictionary.
 *
 *   <InfoTip term="iri" />                 ℹ icon; hover → full definition card
 *   <Term k="vci">VCI</Term>               dotted-underline text; hover → definition
 *   <Tip text="free-form note">label</Tip> generic tooltip for anything not in the dict
 *
 * The floating card is rendered fixed-position at a high z-index so it is never
 * clipped by table/card overflow. Definitions (term, units, range, categorical
 * value meanings with colour swatches) come from dataDictionary.ts.
 */
import { useState, useRef, type ReactNode, type CSSProperties } from 'react';
import { lookup, type DictEntry } from './dataDictionary';

const CARD: CSSProperties = {
  position: 'fixed', zIndex: 99999, maxWidth: 340, width: 'max-content',
  background: 'rgba(8,13,26,0.98)', border: '1px solid rgba(77,159,255,0.35)',
  borderRadius: 10, padding: '11px 13px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
  fontFamily: 'Inter, system-ui, sans-serif', pointerEvents: 'none',
  color: '#e2eaf4', lineHeight: 1.5,
};

function Floating({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  // Keep within viewport: flip left/up near edges.
  const left = Math.min(x + 14, window.innerWidth - 360);
  const top = Math.min(y + 16, window.innerHeight - 220);
  return <div style={{ ...CARD, left: Math.max(8, left), top: Math.max(8, top) }}>{children}</div>;
}

function EntryCard({ e }: { e: DictEntry }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
        <span style={{ fontWeight: 800, fontSize: 13, color: '#4d9fff' }}>{e.term}</span>
        {e.unit && <span style={{ fontSize: 10, color: '#94a3b8' }}>({e.unit})</span>}
        <span style={{ marginLeft: 'auto', fontSize: 8.5, color: 'rgba(148,163,184,0.55)',
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>{e.group}</span>
      </div>
      {e.label && e.label !== e.term && (
        <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.8)', marginBottom: 4 }}>{e.label}</div>
      )}
      <div style={{ fontSize: 11.5, color: 'rgba(226,234,244,0.88)' }}>{e.description}</div>
      {e.range && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}><b>Range:</b> {e.range}</div>}
      {e.values && e.values.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {e.values.map(v => (
            <div key={v.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 10.5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, marginTop: 4, flexShrink: 0,
                background: v.color ?? '#64748b' }} />
              <span><b style={{ color: v.color ?? '#cbd5e1' }}>{v.value}</b>
                <span style={{ color: 'rgba(148,163,184,0.85)' }}> — {v.meaning}</span></span>
            </div>
          ))}
        </div>
      )}
      {e.source && <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.55)', marginTop: 7,
        borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 5 }}>Source: {e.source}</div>}
    </>
  );
}

function useHover() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const handlers = {
    onMouseEnter: (ev: React.MouseEvent) => setPos({ x: ev.clientX, y: ev.clientY }),
    onMouseMove: (ev: React.MouseEvent) => setPos({ x: ev.clientX, y: ev.clientY }),
    onMouseLeave: () => setPos(null),
  };
  return { pos, handlers };
}

/** ℹ info icon — hover shows the dictionary definition for `term`. */
export function InfoTip({ term, size = 12 }: { term: string; size?: number }) {
  const e = lookup(term);
  const { pos, handlers } = useHover();
  if (!e) return null;
  return (
    <span {...handlers} style={{ display: 'inline-flex', cursor: 'help', verticalAlign: 'middle' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
        stroke="rgba(148,163,184,0.65)" strokeWidth="2.2" style={{ marginLeft: 3 }}>
        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
      </svg>
      {pos && <Floating x={pos.x} y={pos.y}><EntryCard e={e} /></Floating>}
    </span>
  );
}

/** Wrap a term with a dotted underline; hover shows its definition. */
export function Term({ k, children }: { k: string; children: ReactNode }) {
  const e = lookup(k);
  const { pos, handlers } = useHover();
  if (!e) return <>{children}</>;
  return (
    <span {...handlers} style={{ cursor: 'help', borderBottom: '1px dotted rgba(148,163,184,0.5)' }}>
      {children}
      {pos && <Floating x={pos.x} y={pos.y}><EntryCard e={e} /></Floating>}
    </span>
  );
}

/** Generic free-text tooltip for content not in the dictionary. */
export function Tip({ text, children }: { text: string; children: ReactNode }) {
  const { pos, handlers } = useHover();
  return (
    <span {...handlers} style={{ cursor: 'help' }}>
      {children}
      {pos && <Floating x={pos.x} y={pos.y}><div style={{ fontSize: 11.5 }}>{text}</div></Floating>}
    </span>
  );
}

/** True if the dictionary has a definition for this key/label (for conditional ℹ). */
export { lookup as hasDefinition } from './dataDictionary';
