import { useState } from 'react';
import { useAuth } from '../Auth/AuthContext';
import { ProtectedRoute } from '../Auth/ProtectedRoute';
import { supabase } from '../../lib/supabase';
import { vciRating, VCI_RATING_COLOR } from '../../shared/vci';

interface SurveyPayload {
  id: string;
  link_id: string;
  survey_date: string;
  iri_measured: number;
  cracking_pct: number;
  rutting_mm: number;
  pothole_count: number;
  drainage_score: number;
  overall_condition: string;
  surveyor_name: string;
  notes: string;
  submitted_at: string;
  status: 'pending';
}

const FIELD: React.CSSProperties = {
  width: '100%', background: 'rgba(10,16,30,0.7)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 7,
  color: '#e2e8f0', fontSize: 12, padding: '8px 10px',
  outline: 'none', boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = { color: '#94a3b8', fontSize: 11, display: 'block', marginBottom: 4 };

interface Props { onClose: () => void; }

function SurveyFormInner({ onClose }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    link_id: '',
    survey_date: new Date().toISOString().slice(0,10),
    iri_measured: '',
    cracking_pct: '',
    rutting_mm: '',
    pothole_count: '',
    pci: '',
    vci: '',
    drainage_score: '3',
    overall_condition: 'Fair',
    notes: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sync, setSync] = useState('');

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  const num = (v: string) => (v === '' ? null : Number(v));
  const liveVci = form.vci === '' ? null : Number(form.vci);
  const liveRating = vciRating(liveVci);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const survey_year = Number(form.survey_date.slice(0, 4)) || new Date().getFullYear();

    // 1) Always queue locally (offline-safe audit trail)
    const payload: SurveyPayload = {
      id: `survey_${Date.now()}`,
      link_id: form.link_id,
      survey_date: form.survey_date,
      iri_measured: Number(form.iri_measured),
      cracking_pct: Number(form.cracking_pct),
      rutting_mm: Number(form.rutting_mm),
      pothole_count: Number(form.pothole_count),
      drainage_score: Number(form.drainage_score),
      overall_condition: form.overall_condition,
      surveyor_name: user?.name ?? 'Unknown',
      notes: form.notes,
      submitted_at: new Date().toISOString(),
      status: 'pending',
    };
    const existing: SurveyPayload[] = JSON.parse(localStorage.getItem('dnr_pending_surveys') ?? '[]');
    existing.push(payload);
    localStorage.setItem('dnr_pending_surveys', JSON.stringify(existing));

    // 2) Sync straight into the Supabase Unified DB (updates the whole platform)
    const dbRow = {
      link_id: form.link_id,
      survey_year,
      iri: num(form.iri_measured),
      rut_mm: num(form.rutting_mm),
      cracking: num(form.cracking_pct),
      pci: num(form.pci),
      vci: liveVci,
      vci_rating: liveRating,
    };
    try {
      const { error } = await supabase
        .from('road_link_condition')
        .upsert(dbRow, { onConflict: 'link_id,survey_year' });
      setSync(error
        ? `Saved locally — Supabase sync failed (${error.message}).`
        : `Synced to Supabase ✓ — ${form.link_id} condition updated across the platform.`);
    } catch (err: any) {
      setSync('Saved locally — offline; will sync on next connection.');
    }
    setBusy(false);
    setSubmitted(true);
  }

  if (submitted) {
    const ok = sync.includes('✓');
    return (
      <div style={{ padding:24, textAlign:'center' }}>
        <div style={{ fontSize:36, marginBottom:12 }}>{ok ? '✅' : '💾'}</div>
        <div style={{ color: ok ? '#4ade80' : '#fbbf24', fontSize:16, fontWeight:700 }}>Survey Submitted</div>
        <div style={{ color:'#94a3b8', fontSize:12, marginTop:6, maxWidth:300, marginInline:'auto' }}>{sync || 'Queued locally.'}</div>
        <button onClick={onClose} style={{ marginTop:18, padding:'8px 20px', borderRadius:8, background:'#6366f1', border:'none', color:'#fff', cursor:'pointer', fontSize:13 }}>Done</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding:20, display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ color:'#e2e8f0', fontSize:14, fontWeight:700, marginBottom:4 }}>Submit Condition Survey</div>
      <div style={{ color:'#64748b', fontSize:10, marginBottom:4 }}>Surveyor: {user?.name} · {new Date().toLocaleDateString()}</div>

      <div>
        <label style={LABEL}>Link ID *</label>
        <input style={FIELD} placeholder="e.g. A001_Link01" required value={form.link_id} onChange={e => set('link_id', e.target.value)} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <label style={LABEL}>Survey Date *</label>
          <input type="date" style={FIELD} required value={form.survey_date} onChange={e => set('survey_date', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Overall Condition *</label>
          <select style={FIELD} value={form.overall_condition} onChange={e => set('overall_condition', e.target.value)}>
            {['Good','Fair','Poor','Bad','Very Bad'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={LABEL}>IRI Measured (m/km)</label>
          <input type="number" step="0.1" min="0" style={FIELD} placeholder="e.g. 4.5" value={form.iri_measured} onChange={e => set('iri_measured', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Rutting Depth (mm)</label>
          <input type="number" step="0.5" min="0" style={FIELD} placeholder="e.g. 8" value={form.rutting_mm} onChange={e => set('rutting_mm', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Cracking (%)</label>
          <input type="number" step="1" min="0" max="100" style={FIELD} placeholder="e.g. 15" value={form.cracking_pct} onChange={e => set('cracking_pct', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>Pothole Count</label>
          <input type="number" step="1" min="0" style={FIELD} placeholder="e.g. 3" value={form.pothole_count} onChange={e => set('pothole_count', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>PCI (0–100)</label>
          <input type="number" step="0.1" min="0" max="100" style={FIELD} placeholder="e.g. 78" value={form.pci} onChange={e => set('pci', e.target.value)} />
        </div>
        <div>
          <label style={LABEL}>VCI — Visual Condition Index (0–100)</label>
          <input type="number" step="0.1" min="0" max="100" style={FIELD} placeholder="e.g. 84" value={form.vci} onChange={e => set('vci', e.target.value)} />
          {liveRating && (
            <div style={{ marginTop: 5, fontSize: 10, fontWeight: 700, color: VCI_RATING_COLOR[liveRating] }}>
              Rating: {liveRating}
            </div>
          )}
        </div>
        <div>
          <label style={LABEL}>Drainage Score (1–5)</label>
          <select style={FIELD} value={form.drainage_score} onChange={e => set('drainage_score', e.target.value)}>
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} — {['Very Poor','Poor','Fair','Good','Excellent'][n-1]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={LABEL}>Notes / Observations</label>
        <textarea rows={3} style={{ ...FIELD, resize:'vertical' }} placeholder="Describe visible defects, drainage issues, subgrade problems…" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
        <button type="button" onClick={onClose} style={{ padding:'8px 18px', borderRadius:8, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'#94a3b8', cursor:'pointer', fontSize:12 }}>Cancel</button>
        <button type="submit" disabled={busy} style={{ padding:'8px 20px', borderRadius:8, background: busy ? '#475569' : '#6366f1', border:'none', color:'#fff', fontWeight:600, cursor: busy ? 'default' : 'pointer', fontSize:12 }}>{busy ? 'Syncing…' : 'Submit & Sync'}</button>
      </div>
    </form>
  );
}

export function ConditionSurveyForm({ onClose }: Props) {
  return (
    <ProtectedRoute permission="canSubmitSurvey">
      <SurveyFormInner onClose={onClose} />
    </ProtectedRoute>
  );
}

export function ConditionSurveyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:10000,
      background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width:520, maxHeight:'90vh', overflowY:'auto',
        background:'rgba(10,16,30,0.97)', border:'1px solid rgba(99,102,241,0.3)',
        borderRadius:14, boxShadow:'0 8px 48px rgba(0,0,0,0.7)',
      }}>
        <ConditionSurveyForm onClose={onClose} />
      </div>
    </div>
  );
}
