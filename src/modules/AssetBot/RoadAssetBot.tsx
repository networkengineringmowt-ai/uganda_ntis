import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useBMS } from '../../store/BMSContext';
import { BotHighlightContext, type BotMessage, type Row, type MLPrediction } from './types';
import { matchIntentFull, QUICK_QUERIES } from './intentMatcher';
import { LINK_ID_EXPLAINER } from './linkIdKnowledge';

const BASE = import.meta.env.BASE_URL;
const GLASS: React.CSSProperties = {
  background: 'rgba(10,16,30,0.92)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.1)',
};
const ACCENT = '#6366f1';

// ── Network summary canonical response ───────────────────────────────────────
const NETWORK_SUMMARY_RESPONSE = 'The national road network is **21,302 km** (FY 2025/26), comprising **6,405 km paved (30.1%)** and **14,897 km unpaved (69.9%)**, covering **1,013 mapped links** across **6 regions** and **23 maintenance stations**. Source: NDPIV FY 2025/26 official figures, MoWT/DNR.';

const NETWORK_KEYWORDS = /\b(network size|how big|total km|total length|how long|total roads|network total|national road network|road network is|size of|coverage)\b/i;

// ── Confidence level logic ─────────────────────────────────────────────────────
function getConfidence(queryId: string, hasRows: boolean): { conf: '🟢' | '🟡' | '🔴'; label: string } {
  if (!hasRows) return { conf: '🔴', label: 'Low — no data found' };
  const realData = ['Q01','Q02','Q03','Q04','Q05','Q06','Q08','Q09','Q10','Q11','Q12','Q13','Q15','Q16','Q20','LINK_DETAIL','ROAD_ALL_LINKS','LINK_STRUCTURES'];
  const projected = ['Q10','Q11','Q24'];
  if (projected.includes(queryId)) return { conf: '🟡', label: 'Medium — projected/estimated' };
  if (realData.includes(queryId)) return { conf: '🟢', label: 'High — from real database' };
  return { conf: '🟡', label: 'Medium — platform knowledge base' };
}

// ── Response text generator ───────────────────────────────────────────────────
function describeResult(queryId: string, rows: Row[]): string {
  const n = rows.length;
  const phrases: Record<string, string> = {
    Q01: `Found **${n} road links** with IRI > 8 m/km or Bad/Very Bad condition requiring rehabilitation.`,
    Q02: `Budget breakdown across **${n} regions** — sorted by estimated maintenance cost (UGX million).`,
    Q03: `**Top ${n} highest-risk links** ranked by ML urgency score. Gold highlights added to map.`,
    Q04: `**${n} links** ranked by estimated annual ESAL loading. High values indicate structural stress.`,
    Q05: `Bridge condition across **${n} regions** — poor/critical column shows bridges needing attention.`,
    Q06: `**${n} links** with AADT traffic counts. Sorted by traffic volume descending.`,
    Q08: `Maintenance backlog: **${n} groups** across regions and road classes with estimated UGX cost.`,
    Q09: `**${n} contracts/projects** listed by contract value. Status reflects current programme stage.`,
    Q10: `**${n} links** projected to reach IRI > 8 m/km within 2 years or urgency > 0.7. Act before failure.`,
    Q11: `**${n} links** in the rolling 5-year work programme, grouped by intervention year.`,
    Q12: n > 0 ? `Network summary — **${rows[0]?.total_links ?? n} links**, ${rows[0]?.total_km ?? '—'} km total. Condition split shown below.` : 'Network summary loaded.',
    Q13: `**${n} weighbridge stations** ranked by overloaded vehicle count.`,
    Q15: `Pavement type breakdown across **${n} surface categories** with average IRI per type.`,
    Q16: `**${n} links** ranked by estimated user cost (road roughness impact on vehicle operating costs).`,
    Q20: `**${n} links** sorted by date last surveyed — never-surveyed links appear first.`,
    LINK_EXPLAINER: 'Uganda Department of National Roads Link ID & Location Referencing system explained.',
    LINK_DETAIL: `Link detail retrieved — **${n} records** found.`,
    ROAD_ALL_LINKS: `Found **${n} links** on the requested road.`,
    LINK_STRUCTURES: `Found **${n} structures** on this road link.`,
  };
  return phrases[queryId] ?? `Found **${n} records** matching your query.`;
}

// ── Result table ──────────────────────────────────────────────────────────────
function ResultTable({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p style={{ color: '#64748b', fontSize: 11, margin: '8px 0' }}>No data available.</p>;
  const cols = Object.keys(rows[0]);
  return (
    <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto', borderRadius: 6, marginTop: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, minWidth: 400 }}>
        <thead>
          <tr style={{ background: 'rgba(99,102,241,0.15)', position: 'sticky', top: 0 }}>
            {cols.map(c => (
              <th key={c} style={{ padding: '5px 8px', color: '#94a3b8', fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.025)' }}>
              {cols.map(c => (
                <td key={c} style={{ padding: '4px 8px', color: '#cbd5e1', whiteSpace: 'nowrap', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {row[c] === null ? '—' : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, onNavigateSources }: { msg: BotMessage; onNavigateSources: () => void }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div style={{
        maxWidth: '90%', padding: '8px 12px', borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
        background: isUser ? `rgba(99,102,241,0.25)` : 'rgba(255,255,255,0.06)',
        border: `1px solid ${isUser ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
        color: '#e2eaf4', fontSize: 12, lineHeight: 1.6,
      }}>
        {/* Render bold markdown-style text */}
        <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
        {msg.rows && <ResultTable rows={msg.rows} />}
        {/* Confidence badge */}
        {!isUser && msg.confidence && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 6, padding: '2px 8px', borderRadius: 10,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            fontSize: 10, color: '#94a3b8',
          }}>
            <span>{msg.confidence}</span>
            <span>{msg.confidenceLabel}</span>
          </div>
        )}
        {!isUser && msg.queryId && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={onNavigateSources}
              style={{
                padding: '2px 8px', borderRadius: 10, fontSize: 10, cursor: 'pointer',
                background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
                color: ACCENT, fontWeight: 600,
              }}
            >
              📋 Sources
            </button>
            {msg.linkIds && msg.linkIds.length > 0 && (
              <span style={{ fontSize: 10, color: '#64748b', lineHeight: '20px' }}>
                {msg.linkIds.length} links highlighted on map
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main bot component ────────────────────────────────────────────────────────
export default function RoadAssetBot() {
  const { navigate } = useBMS();
  const { setHighlightedLinks } = useContext(BotHighlightContext);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<BotMessage[]>([{
    role: 'bot',
    text: 'Hi! I\'m the **Road Asset Intelligence Bot**. Ask me about road conditions, rehabilitation needs, traffic, overloading, budgets, or bridge status. Use the quick queries below or type your question.',
  }]);
  const [input, setInput] = useState('');
  const [botResults, setBotResults] = useState<Record<string, Row[]>>({});
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}data/bot_results.json`).then(r => r.json()).catch(() => ({} as Record<string, Row[]>)),
      fetch(`${BASE}data/deep_ml_predictions.json`).then(r => r.json()).catch(() => [] as MLPrediction[]),
    ]).then(([results]) => {
      setBotResults(results);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    const userMsg: BotMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    setTimeout(() => {
      const result = matchIntentFull(text);
      const { queryId, linkId, explanationText } = result;

      // Network size canonical response
      if (NETWORK_KEYWORDS.test(text)) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: NETWORK_SUMMARY_RESPONSE,
          queryId: 'Q21',
          confidence: '🟢',
          confidenceLabel: 'High — official NDPIV FY25/26 figures',
        }]);
        return;
      }

      // Link ID system explanation
      if (queryId === 'LINK_EXPLAINER' || explanationText) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: explanationText ?? LINK_ID_EXPLAINER,
          queryId: 'LINK_EXPLAINER',
          confidence: '🟢',
          confidenceLabel: 'High — system reference data',
        }]);
        return;
      }

      // Specific link detail lookup
      if (queryId === 'LINK_DETAIL' && linkId) {
        const rows = (botResults['Q01'] ?? []).filter(r => String(r.link_id) === linkId);
        const allRows = rows.length ? rows : (botResults['Q20'] ?? []).filter(r => String(r.link_id) === linkId);
        setMessages(prev => [...prev, {
          role: 'bot',
          text: allRows.length
            ? `Found data for link **${linkId}**:`
            : `No data available in the current database for link **${linkId}**. This link may not appear in the condition survey dataset yet. Try the network map to see its geometry.`,
          rows: allRows.length ? allRows : undefined,
          queryId: 'LINK_DETAIL',
          linkIds: [linkId],
          confidence: allRows.length ? '🟢' : '🔴',
          confidenceLabel: allRows.length ? 'High — from real data' : 'Low — insufficient data',
        }]);
        if (linkId) setHighlightedLinks([linkId]);
        return;
      }

      if (queryId && botResults[queryId]?.length) {
        const rows = botResults[queryId];
        const linkIds = rows.map(r => r.link_id as string).filter(Boolean);
        if (linkIds.length) setHighlightedLinks(linkIds);
        const { conf, label } = getConfidence(queryId, true);
        setMessages(prev => [...prev, {
          role: 'bot',
          text: describeResult(queryId, rows),
          rows,
          queryId,
          linkIds,
          confidence: conf,
          confidenceLabel: label,
        }]);
      } else if (queryId && botResults[queryId]) {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: `No data available for this query in the current database (${queryId}). The dataset may not include this category yet.`,
          queryId,
          confidence: '🔴',
          confidenceLabel: 'Low — no data found',
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'bot',
          text: 'I didn\'t recognise that query. Try: "roads needing rehab", "budget by region", "top risk links", "overloading hotspots", "bridge condition", or "What is link A001_Link01?"',
          confidence: '🔴',
          confidenceLabel: 'Low — query not matched',
        }]);
      }
    }, 280);
  }, [botResults, setHighlightedLinks]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const clearHighlights = () => setHighlightedLinks([]);

  return (
    <>
      {/* ── FAB ── */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Road Asset Intelligence Bot"
        style={{
          position: 'fixed', top: 14, left: 14, bottom: 'auto', right: 'auto', zIndex: 9999,
          width: 52, height: 52, borderRadius: '50%',
          background: `linear-gradient(135deg, ${ACCENT}, #818cf8)`,
          border: 'none', cursor: 'pointer',
          boxShadow: `0 4px 24px rgba(99,102,241,0.55), 0 2px 8px rgba(0,0,0,0.4)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'rotate(15deg)' : 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = open ? 'rotate(15deg)' : 'none'; }}
      >
        🤖
        {!open && loading === false && Object.keys(botResults).length > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            width: 14, height: 14, borderRadius: '50%',
            background: '#22c55e', border: '2px solid rgba(10,16,30,0.9)',
            fontSize: 7, fontWeight: 900, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✓</span>
        )}
      </button>

      {/* ── Slide-in panel ── */}
      {open && (
        <div style={{
          position: 'fixed', top: 76, left: 14, bottom: 'auto', right: 'auto', zIndex: 9998,
          width: 520, maxWidth: 'calc(100vw - 48px)',
          maxHeight: 'calc(100vh - 120px)',
          borderRadius: 16,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.2)',
          ...GLASS,
          animation: 'botSlideIn 0.22s ease-out',
        }}>

          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: `linear-gradient(135deg, ${ACCENT}, #818cf8)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>🤖</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#e2eaf4' }}>Road Asset Bot</div>
                <div style={{ fontSize: 10, color: '#64748b' }}>
                  {loading ? 'Loading data…' : `${Object.keys(botResults).length} queries ready · Department of National Roads DNR`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={clearHighlights}
                title="Clear map highlights"
                style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                }}
              >
                Clear highlights
              </button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: '4px 8px', borderRadius: 6, fontSize: 14, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#94a3b8',
                }}
              >×</button>
            </div>
          </div>

          {/* Quick chips */}
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', flexWrap: 'wrap', gap: 5, flexShrink: 0,
            maxHeight: 80, overflowY: 'auto',
          }}>
            {QUICK_QUERIES.map(q => (
              <button
                key={q.queryId}
                onClick={() => sendMessage(q.text)}
                style={{
                  padding: '3px 9px', borderRadius: 12, fontSize: 10, cursor: 'pointer',
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                  color: '#a5b4fc', fontWeight: 600, whiteSpace: 'nowrap',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.25)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)'; }}
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', minHeight: 0 }}
          >
            {messages.map((msg, i) => (
              <MessageBubble
                key={i}
                msg={msg}
                onNavigateSources={() => navigate('sources' as never)}
              />
            ))}
            {loading && (
              <div style={{ color: '#64748b', fontSize: 11, textAlign: 'center', padding: 8 }}>
                Loading pre-computed query results…
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', gap: 8, flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about roads, bridges, traffic, budget…"
              style={{
                flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                color: '#e2eaf4', outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              style={{
                padding: '8px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                background: input.trim() ? `linear-gradient(135deg, ${ACCENT}, #818cf8)` : 'rgba(255,255,255,0.06)',
                border: 'none', color: input.trim() ? '#fff' : '#475569',
                fontWeight: 700, transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes botSlideIn {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
    </>
  );
}
