/**
 * CrossLinkChipBar — renders a horizontal bar of chips linking to related sections.
 * Place at the top of any section content area.
 *
 * Usage:
 *   import CrossLinkChipBar from '../../shared/CrossLinkChipBar';
 *   <CrossLinkChipBar sectionId="traffic" navigate={navigate} />
 */
import { useCrossLinks } from './useCrossLinks';
import { useBMS } from '../store/BMSContext';
import type { ActiveView } from '../types';
import { ArrowRight } from 'lucide-react';

interface Props {
  sectionId: string;
  navigate?: (view: ActiveView) => void;
}

export default function CrossLinkChipBar({ sectionId, navigate: navProp }: Props) {
  const { navigate: ctxNavigate } = useBMS();
  const links = useCrossLinks(sectionId);
  const navigate = navProp ?? ctxNavigate;

  if (!links.length) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      padding: '6px 14px', flexShrink: 0,
      background: 'rgba(0,245,255,0.025)',
      borderBottom: '1px solid rgba(0,245,255,0.06)',
    }}>
      <span style={{
        fontSize: 8, fontWeight: 800, color: 'rgba(148,163,184,0.45)',
        textTransform: 'uppercase', letterSpacing: '0.12em', flexShrink: 0, marginRight: 2,
      }}>
        Related Data:
      </span>
      {links.map(link => (
        <button
          key={link.targetView}
          onClick={() => navigate(link.targetView)}
          title={`${link.description} · field: ${link.dataField}`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
            background: 'rgba(0,245,255,0.06)',
            border: '1px solid rgba(0,245,255,0.18)',
            color: '#00d4aa', fontSize: 9, fontWeight: 700,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,245,255,0.12)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,245,255,0.35)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,245,255,0.06)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,245,255,0.18)';
          }}
        >
          <ArrowRight size={9} />
          {link.label}
        </button>
      ))}
    </div>
  );
}
