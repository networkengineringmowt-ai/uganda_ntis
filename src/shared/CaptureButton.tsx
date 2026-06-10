/**
 * CaptureButton — the big "capture screen" launcher that every platform section
 * can drop in. Jumps to the login-gated Data Capture Hub, which writes straight
 * to the Supabase Unified DB and so updates the rest of the platform.
 */
import { ClipboardPlus, ChevronRight } from 'lucide-react';
import { useBMS } from '../store/BMSContext';

interface Props {
  /** Capture form to preselect in the hub, e.g. 'condition' | 'encroachment'. */
  capture?: string;
  /** Short label describing what gets captured, e.g. "road condition survey". */
  label?: string;
  accent?: string;
}

export function CaptureButton({ capture = 'condition', label = 'field data', accent = '#00d4aa' }: Props) {
  const { dispatch } = useBMS();
  const open = () => {
    try { sessionStorage.setItem('capture_target', capture); } catch { /* ignore */ }
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'datacapture' as any });
  };
  return (
    <button onClick={open} style={{
      display: 'flex', alignItems: 'center', gap: 12, width: '100%',
      padding: '14px 18px', marginBottom: 16, cursor: 'pointer', textAlign: 'left',
      background: `linear-gradient(135deg, rgba(0,212,170,0.14), rgba(0,245,255,0.05))`,
      border: `1px solid ${accent}66`, borderRadius: 12,
      boxShadow: `0 0 22px ${accent}1f`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, flexShrink: 0,
        background: `${accent}22`, border: `1px solid ${accent}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
      }}>
        <ClipboardPlus size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#e2eaf4' }}>Capture {label} →</div>
        <div style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginTop: 1 }}>
          Opens the synced data-entry screen · writes to the live Supabase database
        </div>
      </div>
      <ChevronRight size={18} style={{ color: accent }} />
    </button>
  );
}
