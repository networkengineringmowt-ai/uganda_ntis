import { useBMS } from '../store/BMSContext';
import { setPendingSourcesModule } from './sourcesFilter';

interface Props {
  /** Module label that matches Source.module[] values, e.g. 'PMS', 'TIS', 'BMS' */
  module: string;
}

const BTN: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '4px 10px', borderRadius: 6, border: 'none',
  cursor: 'pointer', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.04em', transition: 'opacity 0.15s',
};

export function ModuleNavBar({ module }: Props) {
  const { dispatch } = useBMS();

  function goSources() {
    setPendingSourcesModule(module);
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'sources' });
  }

  function goSummary() {
    dispatch({ type: 'SET_ACTIVE_VIEW', payload: 'platform' });
  }

  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'center',
      padding: '6px 0 10px',
    }}>
      <button onClick={goSources} style={{
        ...BTN,
        background: 'rgba(148,163,184,0.08)',
        border: '1px solid rgba(148,163,184,0.18)',
        color: '#94a3b8',
      }}>
        📋 Sources
      </button>
      <button onClick={goSummary} style={{
        ...BTN,
        background: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.2)',
        color: '#818cf8',
      }}>
        ↗ Summary
      </button>
    </div>
  );
}
