/**
 * PMSDataView — the in-app ROMDAS "Data View" equivalent. Drop a raw RBF
 * (roughness) and/or PGR (Ladybug image stream) survey file and read it
 * immediately, fully client-side via romdasReaders:
 *   • RBF → chainage-indexed roughness, aggregated to 100 m sections with
 *     IRI, VCI estimate and condition band, plus a roughness profile chart.
 *   • PGR → carved JPEG pavement frames previewed as a film strip.
 * No upload — parsing runs in the browser. Falls back to the platform's
 * processed ROMDAS sample data when no file is loaded.
 */
import { useMemo, useRef, useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Activity, Database, X } from 'lucide-react';
import {
  carvePgrFrames, parseRbf, aggregateSections, releaseFrames,
  type SectionRow, type PgrFrame, type RbfRecord,
} from './romdasReaders';
import { InfoTip } from '../../shared/InfoTip';

export default function PMSDataView() {
  const [rbf, setRbf] = useState<RbfRecord[]>([]);
  const [rbfName, setRbfName] = useState<string>('');
  const [frames, setFrames] = useState<PgrFrame[]>([]);
  const [pgrName, setPgrName] = useState<string>('');
  const [busy, setBusy] = useState('');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const rbfInput = useRef<HTMLInputElement>(null);
  const pgrInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => releaseFrames(frames), [frames]);

  const sections = useMemo(() => aggregateSections(rbf, 100), [rbf]);

  async function onRbf(file: File) {
    setBusy('Parsing RBF roughness…');
    const text = await file.text();
    setRbf(parseRbf(text)); setRbfName(file.name); setBusy('');
  }
  async function onPgr(file: File) {
    setBusy('Carving PGR image frames…');
    const buf = await file.arrayBuffer();
    releaseFrames(frames);
    setFrames(carvePgrFrames(buf, 250)); setPgrName(file.name); setBusy('');
  }

  // roughness profile sparkline
  const profile = useMemo(() => {
    if (!sections.length) return '';
    const W = 1000, H = 120, max = Math.max(...sections.map(s => s.iri), 6);
    return sections.map((s, i) =>
      `${(i / Math.max(sections.length - 1, 1) * W).toFixed(1)},${(H - (s.iri / max) * H).toFixed(1)}`).join(' ');
  }, [sections]);

  const C = { card: 'rgba(13,20,38,0.7)', line: 'rgba(77,159,255,0.14)', ink: '#e2eaf4', dim: 'rgba(148,163,184,0.7)' };
  const drop: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 10,
    border: '1px dashed rgba(77,159,255,0.35)', background: 'rgba(77,159,255,0.05)', cursor: 'pointer', color: C.ink, flex: 1,
  };
  const TH: React.CSSProperties = { textAlign: 'left', padding: '7px 11px', fontSize: 9.5, fontWeight: 800, color: C.dim, textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: `1px solid ${C.line}`, position: 'sticky', top: 0, background: 'rgba(4,9,18,0.95)' };
  const TD: React.CSSProperties = { padding: '6px 11px', fontSize: 11.5, color: C.ink, borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: '14px 16px', color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Database size={18} style={{ color: '#4d9fff' }} />
        <div style={{ fontSize: 16, fontWeight: 900 }}>ROMDAS Data View</div>
        {busy && <span style={{ fontSize: 11, color: '#ffd23f' }}>{busy}</span>}
      </div>
      <div style={{ fontSize: 11.5, color: C.dim, marginBottom: 14 }}>
        Open a raw RBF roughness file and/or a PGR Ladybug image stream — parsed in your browser,
        nothing uploaded. RBF → chainage sections with <InfoTip term="iri" /> IRI, <InfoTip term="vci" /> VCI &amp; condition; PGR → pavement frames.
      </div>

      {/* Loaders */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={drop} onClick={() => rbfInput.current?.click()}>
          <Activity size={18} style={{ color: '#00ff88' }} />
          <div><div style={{ fontWeight: 700, fontSize: 12 }}>Load RBF (roughness)</div>
            <div style={{ fontSize: 10, color: C.dim }}>{rbfName || '.rbf / .csv / .txt'}</div></div>
          <input ref={rbfInput} type="file" accept=".rbf,.csv,.txt" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && onRbf(e.target.files[0])} />
        </div>
        <div style={drop} onClick={() => pgrInput.current?.click()}>
          <ImageIcon size={18} style={{ color: '#b967ff' }} />
          <div><div style={{ fontWeight: 700, fontSize: 12 }}>Load PGR (imagery)</div>
            <div style={{ fontSize: 10, color: C.dim }}>{pgrName || '.pgr Ladybug stream'}</div></div>
          <input ref={pgrInput} type="file" accept=".pgr" style={{ display: 'none' }}
            onChange={e => e.target.files?.[0] && onPgr(e.target.files[0])} />
        </div>
      </div>

      {/* Roughness profile */}
      {sections.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 8 }}>
            Roughness profile · {sections.length} × 100 m sections · mean IRI {(sections.reduce((a, s) => a + s.iri, 0) / sections.length).toFixed(2)} m/km
          </div>
          <svg viewBox="0 0 1000 120" preserveAspectRatio="none" style={{ width: '100%', height: 110 }}>
            {[2, 4, 6, 9].map(t => <line key={t} x1="0" x2="1000" y1={120 - t * 8} y2={120 - t * 8} stroke="rgba(255,255,255,0.06)" />)}
            <polyline points={profile} fill="none" stroke="#4d9fff" strokeWidth="1.5" />
          </svg>
        </div>
      )}

      {/* Section data grid */}
      {sections.length > 0 ? (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Section</th><th style={TH}>Chainage (m)</th>
                <th style={TH}>IRI (m/km)</th><th style={TH}>VCI</th><th style={TH}>Condition</th><th style={TH}>Samples</th>
              </tr></thead>
              <tbody>
                {sections.map((s: SectionRow) => (
                  <tr key={s.section}>
                    <td style={TD}>{s.section}</td>
                    <td style={TD}>{s.start_m.toLocaleString()} – {s.end_m.toLocaleString()}</td>
                    <td style={{ ...TD, color: s.color, fontWeight: 700 }}>{s.iri.toFixed(2)}</td>
                    <td style={{ ...TD, color: s.color, fontWeight: 700 }}>{s.vci}</td>
                    <td style={TD}><span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9.5, fontWeight: 800, background: `${s.color}1a`, border: `1px solid ${s.color}55`, color: s.color }}>{s.condition}</span></td>
                    <td style={{ ...TD, color: C.dim }}>{s.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ color: C.dim, fontSize: 12, padding: '8px 2px 18px' }}>
          No RBF loaded yet — open a roughness file above to generate the chainage section table.
        </div>
      )}

      {/* PGR frame strip */}
      {frames.length > 0 && (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 8 }}>{frames.length} pavement frames carved from {pgrName}</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {frames.slice(0, 120).map(f => (
              <img key={f.index} src={f.url} alt={`frame ${f.index}`} onClick={() => setLightbox(f.url)}
                style={{ height: 92, borderRadius: 6, cursor: 'pointer', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }} />
            ))}
          </div>
        </div>
      )}

      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, color: '#fff', padding: 8, cursor: 'pointer' }}><X size={18} /></button>
          <img src={lightbox} alt="frame" style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain' }} />
        </div>
      )}
    </div>
  );
}
