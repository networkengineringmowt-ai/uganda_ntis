/**
 * SourceTableButton — tiny pill rendered next to a chart that navigates to
 * Tabular Summaries and scrolls to the specific table feeding the chart.
 *
 * Usage:
 *   <SourceTableButton anchor="tbl-006" />
 *
 * Implementation: writes the anchor to window.location.hash AND sessionStorage
 * (fallback for sections that re-render before hashchange fires) and then calls
 * useBMS().navigate('sources'). TabularSummaries reads the hash on mount and
 * scrolls to the matching element.
 */
import { useBMS } from '../store/BMSContext';

interface Props {
  anchor:  string;       // e.g. 'tbl-006' (without leading #)
  label?:  string;       // default '📋 Source table'
  inline?: boolean;      // if true, no margins (for inline placement)
  size?:   'sm' | 'md';  // default 'sm'
}

export function SourceTableButton({ anchor, label, inline = false, size = 'sm' }: Props) {
  const { navigate } = useBMS();

  const handleClick = () => {
    // Persist anchor for TabularSummaries to read on mount
    try {
      sessionStorage.setItem('tbl-anchor', anchor);
      // Also write to window.location.hash so a manual refresh keeps the anchor
      // (use setTimeout to avoid race with React re-renders)
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.hash = anchor;
        }
      }, 0);
    } catch { /* sessionStorage may be unavailable in private mode */ }
    navigate('sources');
  };

  const sizing = size === 'sm'
    ? { padding: '3px 9px', fontSize: 9.5 }
    : { padding: '5px 12px', fontSize: 10.5 };

  return (
    <button
      onClick={handleClick}
      title={`Open source table (#${anchor}) in Tabular Summaries`}
      style={{
        ...sizing,
        marginTop:    inline ? 0 : 6,
        marginLeft:   inline ? 6 : 0,
        display:      'inline-flex',
        alignItems:   'center',
        gap:          4,
        background:   'rgba(0,245,255,0.06)',
        border:       '1px solid rgba(0,245,255,0.22)',
        borderRadius: 5,
        color:        '#7dd3fc',
        cursor:       'pointer',
        fontWeight:   600,
        transition:   'all 0.13s',
        whiteSpace:   'nowrap',
        lineHeight:   1.4,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,245,255,0.14)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,245,255,0.45)';
        (e.currentTarget as HTMLButtonElement).style.color = '#bfdbfe';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,245,255,0.06)';
        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,245,255,0.22)';
        (e.currentTarget as HTMLButtonElement).style.color = '#7dd3fc';
      }}
    >
      {label ?? '📋 Source table'}
    </button>
  );
}

export default SourceTableButton;
