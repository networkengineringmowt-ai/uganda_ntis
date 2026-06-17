/**
 * DataDictionary — browsable, searchable view of every term, metric and
 * categorical value defined on the platform. Backed by shared/dataDictionary.ts
 * (the same source the hover tips read), so it is always in sync.
 */
import { useMemo, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { DICTIONARY, DICT_GROUPS } from '../../shared/dataDictionary';

export default function DataDictionary() {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>('all');

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return DICTIONARY.filter(e => {
      if (group !== 'all' && e.group !== group) return false;
      if (!n) return true;
      return `${e.term} ${e.label ?? ''} ${e.description} ${(e.values ?? []).map(v => v.value + v.meaning).join(' ')}`
        .toLowerCase().includes(n);
    });
  }, [q, group]);

  return (
    <div style={{ padding: '16px 18px', color: '#e2eaf4' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <BookOpen size={18} style={{ color: '#4d9fff' }} />
        <div style={{ fontSize: 17, fontWeight: 900 }}>Data Dictionary</div>
        <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.6)' }}>{DICTIONARY.length} terms · {DICT_GROUPS.length} groups</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'rgba(148,163,184,0.7)', marginBottom: 14 }}>
        What every metric, field and categorical value means across the platform. The same definitions
        appear as ℹ hover tips on cards, tables and charts.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(15,23,42,0.7)',
          border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: '7px 11px', flex: '1 1 240px', maxWidth: 380 }}>
          <Search size={13} style={{ color: 'rgba(148,163,184,0.6)' }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search terms, definitions, values…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e2eaf4', fontSize: 12 }} />
        </div>
        {['all', ...DICT_GROUPS].map(g => (
          <button key={g} onClick={() => setGroup(g)} style={{
            padding: '5px 11px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
            background: group === g ? 'rgba(77,159,255,0.18)' : 'rgba(255,255,255,0.03)',
            border: `1px solid ${group === g ? '#4d9fff' : 'rgba(255,255,255,0.1)'}`,
            color: group === g ? '#4d9fff' : 'rgba(148,163,184,0.75)' }}>{g === 'all' ? 'All' : g}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12 }}>
        {rows.map(e => (
          <div key={e.key} style={{ background: 'rgba(13,20,38,0.7)', border: '1px solid rgba(77,159,255,0.14)',
            borderRadius: 12, padding: '13px 15px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: '#4d9fff' }}>{e.term}</span>
              {e.unit && <span style={{ fontSize: 10, color: '#94a3b8' }}>({e.unit})</span>}
              <span style={{ marginLeft: 'auto', fontSize: 8.5, color: 'rgba(148,163,184,0.5)',
                textTransform: 'uppercase', letterSpacing: '0.07em' }}>{e.group}</span>
            </div>
            {e.label && e.label !== e.term && (
              <div style={{ fontSize: 10.5, color: 'rgba(148,163,184,0.8)', marginBottom: 4 }}>{e.label}</div>
            )}
            <div style={{ fontSize: 11.5, color: 'rgba(226,234,244,0.85)', lineHeight: 1.5 }}>{e.description}</div>
            {e.range && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}><b>Range:</b> {e.range}</div>}
            {e.values && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {e.values.map(v => (
                  <div key={v.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 10.5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, marginTop: 4, flexShrink: 0, background: v.color ?? '#64748b' }} />
                    <span><b style={{ color: v.color ?? '#cbd5e1' }}>{v.value}</b>
                      <span style={{ color: 'rgba(148,163,184,0.85)' }}> — {v.meaning}</span></span>
                  </div>
                ))}
              </div>
            )}
            {e.source && <div style={{ fontSize: 9.5, color: 'rgba(148,163,184,0.5)', marginTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 5 }}>Source: {e.source}</div>}
          </div>
        ))}
        {rows.length === 0 && <div style={{ color: 'rgba(148,163,184,0.5)', fontSize: 12, padding: 20 }}>No terms match your search.</div>}
      </div>
    </div>
  );
}
