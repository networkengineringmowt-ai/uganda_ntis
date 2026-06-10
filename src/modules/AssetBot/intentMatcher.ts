import { LINK_QUERY_INTENTS, LINK_ID_EXPLAINER } from './linkIdKnowledge';

const INTENTS = [
  { keywords: ['rehab', 'rehabilitation', 'reconstruct', 'very bad', 'iri'], queryId: 'Q01' },
  { keywords: ['budget', 'cost', 'allocation', 'region', 'fund'], queryId: 'Q02' },
  { keywords: ['risk', 'urgent', 'priority', 'top', 'worst', 'critical'], queryId: 'Q03' },
  { keywords: ['overload', 'weighbridge', 'heavy', 'axle load'], queryId: 'Q13' },
  { keywords: ['bridge', 'culvert', 'structure'], queryId: 'Q05' },
  { keywords: ['summary', 'overview', 'network', 'statistics', 'state of'], queryId: 'Q12' },
  { keywords: ['fail', 'future', '2 year', 'predict', 'forecast'], queryId: 'Q10' },
  { keywords: ['programme', 'plan', '5 year', 'work programme', 'rolling'], queryId: 'Q11' },
  { keywords: ['backlog', 'deferred', 'overdue'], queryId: 'Q08' },
  { keywords: ['life cycle', 'npv', 'user cost', 'ruc', 'lcc'], queryId: 'Q16' },
  { keywords: ['survey', 'inspect', 'assessment'], queryId: 'Q20' },
  { keywords: ['traffic', 'aadt', 'vehicle', 'growth', 'trend'], queryId: 'Q06' },
  { keywords: ['cesal', 'esal', 'loading', 'structural'], queryId: 'Q04' },
  { keywords: ['surface', 'pavement type', 'gravel', 'paved', 'unpaved'], queryId: 'Q15' },
  { keywords: ['project', 'completion', 'contract', 'funded'], queryId: 'Q09' },
  { keywords: ['rms', 'road management system', 'rams', 'integrated platform'], queryId: 'Q21' },
  { keywords: ['global', 'case study', 'best practice', 'international', 'tanroads', 'kenya', 'rwanda', 'sanral', 'australia', 'nzta', 'fhwa', 'india', 'sweden', 'netherlands', 'japan', 'brazil', 'ghana', 'ethiopia'], queryId: 'Q22' },
  { keywords: ['standard', 'hdm-4', 'iso 55001', 'satcc', 'aashto', 'piarc', 'world bank guideline', 'afdb framework'], queryId: 'Q23' },
  { keywords: ['architecture', '5 tier', 'data collection', 'data management', 'analysis modelling', 'planning programming', 'monitoring reporting'], queryId: 'Q24' },
];

// Link-ID specific queries derived from linkIdKnowledge
const LINK_INTENTS = LINK_QUERY_INTENTS.map(li => ({
  keywords: li.patterns,
  queryId: li.queryId,
}));

export type MatchResult = {
  queryId: string;
  linkId?: string | null;
  roadNumber?: string | null;
  explanationText?: string;
};

export function matchIntent(text: string): string | null {
  return matchIntentFull(text).queryId ?? null;
}

export function matchIntentFull(text: string): MatchResult {
  const l = text.toLowerCase();

  // Check for classification/link system questions first
  if (/\b(what is a link|link id|link number|how.*link|location referenc|chainage|lrs|road classif)\b/i.test(text)) {
    return { queryId: 'LINK_EXPLAINER', explanationText: LINK_ID_EXPLAINER };
  }

  // Check for real Department of National Roads link_id pattern: A001_Link01, B101_Link02, C261_Link01
  const linkIdMatch = text.match(/\b([A-Z]\d{1,3}[A-Z]?\d*_Link\d{2,})\b/i)
    ?? text.match(/\b([A-Z]\d{1,3}[A-Z]?\d*Int\d+_S\d+)\b/i);
  if (linkIdMatch) {
    return { queryId: 'LINK_DETAIL', linkId: linkIdMatch[1].toUpperCase() };
  }

  // Check link-specific intents
  for (const li of LINK_INTENTS) {
    if (li.keywords.some(k => l.includes(k.toLowerCase()))) {
      const linkIntent = LINK_QUERY_INTENTS.find(x => x.queryId === li.queryId);
      const linkId = linkIntent?.extractLinkId ? linkIntent.extractLinkId(text) : null;
      const roadNumber = (linkIntent as { extractRoadNumber?: (t: string) => string | null })?.extractRoadNumber?.(text) ?? null;
      return { queryId: li.queryId, linkId, roadNumber };
    }
  }

  // Standard intents
  for (const i of INTENTS) {
    if (i.keywords.some(k => l.includes(k))) return { queryId: i.queryId };
  }

  return { queryId: '' };
}

export const QUICK_QUERIES = [
  { label: '🚧 Roads needing rehab',   text: 'Which roads need rehabilitation this FY?',   queryId: 'Q01' },
  { label: '💰 Budget by region',       text: 'Budget needed for maintenance by region',     queryId: 'Q02' },
  { label: '⚠️ Top 20 risk links',     text: 'Top 20 highest risk road links',              queryId: 'Q03' },
  { label: '🌉 Bridge condition',       text: 'Bridge condition summary by region',          queryId: 'Q05' },
  { label: '📊 Network summary',        text: 'Network condition statistics summary',        queryId: 'Q12' },
  { label: '🔮 Failing in 2 years',    text: 'Roads likely to fail within 2 years',         queryId: 'Q10' },
  { label: '🚛 Overloading hotspots',  text: 'Overloading hotspots at weighbridges',         queryId: 'Q13' },
  { label: '🔗 Link ID lookup',        text: 'What is link A001_Link01?',                   queryId: 'LINK_EXPLAINER' },
];
