import { createContext } from 'react';

export interface BotMessage {
  role: 'user' | 'bot';
  text: string;
  rows?: Row[];
  queryId?: string;
  linkIds?: string[];
  /** 🟢 High = real DB data · 🟡 Medium = estimated/projected · 🔴 Low = insufficient data */
  confidence?: '🟢' | '🟡' | '🔴';
  confidenceLabel?: string;
}

export type Row = Record<string, string | number | null>;

export interface MLPrediction {
  link_id: string;
  iri_predicted: number;
  condition_class: number;
  rutting_mm: number;
  cracking_pct: number;
  urgency_score: number;
  is_anomaly: boolean;
}

export const BotHighlightContext = createContext<{
  highlightedLinks: string[];
  setHighlightedLinks: (ids: string[]) => void;
}>({ highlightedLinks: [], setHighlightedLinks: () => {} });
