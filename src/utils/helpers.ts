import type { ConditionRating, TrafficLevel } from '../types';

// ─── Seeded pseudo-random (deterministic, no external deps) ──────────────────
export function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

// ─── Condition helpers ───────────────────────────────────────────────────────
export const CONDITION_LABELS: Record<number, string> = {
  5: 'Excellent',
  4: 'Good',
  3: 'Fair',
  2: 'Poor',
  1: 'Critical',
};

export const CONDITION_COLORS: Record<number, string> = {
  5: '#22c55e',
  4: '#84cc16',
  3: '#f59e0b',
  2: '#f97316',
  1: '#ef4444',
};

export const CONDITION_BADGE: Record<number, string> = {
  5: 'badge-excellent',
  4: 'badge-good',
  3: 'badge-fair',
  2: 'badge-poor',
  1: 'badge-critical',
};

export function conditionLabel(r: ConditionRating | number): string {
  return CONDITION_LABELS[r] ?? 'Unknown';
}

export function conditionColor(r: ConditionRating | number): string {
  return CONDITION_COLORS[r] ?? '#94a3b8';
}

export function conditionBadge(r: ConditionRating | number): string {
  return CONDITION_BADGE[r] ?? 'badge-slate';
}

// ─── Priority score ──────────────────────────────────────────────────────────
const TRAFFIC_SCORE: Record<TrafficLevel, number> = {
  'Very High': 4,
  'High':      3,
  'Medium':    2,
  'Low':       1,
};

export function calcPriorityScore(
  conditionRating: ConditionRating,
  traffic: TrafficLevel,
  yearBuilt: number,
  strategicImportance: number,
): number {
  const age = 2024 - yearBuilt;
  const condScore       = (5 - conditionRating) * 3;          // 0–12
  const trafficScore    = TRAFFIC_SCORE[traffic] * 2;         // 2–8
  const ageScore        = age > 50 ? 4 : age > 30 ? 3 : age > 15 ? 2 : 1;  // 1–4
  const strategicScore  = strategicImportance;                 // 1–5
  const raw = condScore + trafficScore + ageScore + strategicScore; // max 29
  return Math.round((raw / 29) * 100);
}

// ─── Condition history generator ─────────────────────────────────────────────
export function generateConditionHistory(
  seed: number,
  currentRating: ConditionRating,
  yearBuilt: number,
): { year: number; rating: ConditionRating }[] {
  const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024];
  const history: { year: number; rating: ConditionRating }[] = [];

  // Work backwards from 2024
  let rating = currentRating;
  const yearly: number[] = [rating];

  for (let i = YEARS.length - 2; i >= 0; i--) {
    const r = seededRandom(seed * 7 + i * 13);
    let prev = rating;
    // Slight chance of improvement (maintenance done) or degradation
    if (r < 0.15 && prev < 5) prev = (prev + 1) as ConditionRating;  // improvement
    else if (r > 0.65 && prev > 1) prev = (prev - 1) as ConditionRating; // degradation
    yearly.unshift(prev);
    rating = prev;
  }

  // Clamp: very new structures can't be worse than 3 in early years
  const age2018 = 2018 - yearBuilt;
  YEARS.forEach((y, i) => {
    let r = yearly[i] as ConditionRating;
    if (age2018 < 5 && i <= 1 && r < 4) r = 4;
    history.push({ year: y, rating: r });
  });

  return history;
}

// ─── Defect generator ────────────────────────────────────────────────────────
const ALL_DEFECTS = [
  'Deck cracking', 'Spalling concrete', 'Rebar exposure', 'Efflorescence',
  'Scour at foundations', 'Guard rail damage', 'Bearing deterioration',
  'Expansion joint failure', 'Drainage blockage', 'Deformation/settlement',
  'Parapet damage', 'Paint deterioration', 'Corrosion of steel',
  'Wingwall cracking', 'Approach slab settlement', 'Erosion at abutments',
  'Loss of bearing area', 'Honeycomb concrete', 'Alkali–silica reaction',
  'Debris accumulation',
];

export function generateDefects(seed: number, rating: ConditionRating): string[] {
  const count = 6 - rating; // critical=5 defects, excellent=1
  const defects: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    let idx: number;
    let attempts = 0;
    do {
      idx = Math.floor(seededRandom(seed + i * 17 + attempts) * ALL_DEFECTS.length);
      attempts++;
    } while (used.has(idx) && attempts < 30);
    used.add(idx);
    defects.push(ALL_DEFECTS[idx]);
  }
  return defects;
}

// ─── Date helpers ────────────────────────────────────────────────────────────
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-UG', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function daysUntil(dateStr: string): number {
  const now  = new Date();
  const then = new Date(dateStr);
  return Math.round((then.getTime() - now.getTime()) / 86_400_000);
}

export function isOverdue(dateStr: string): boolean {
  return daysUntil(dateStr) < 0;
}

// ─── Number formatters ───────────────────────────────────────────────────────
export function formatUGX(n: number): string {
  if (n >= 1_000_000_000) return `UGX ${(n / 1_000_000_000).toFixed(2)}Bn`;
  if (n >= 1_000_000)     return `UGX ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)         return `UGX ${(n / 1_000).toFixed(0)}K`;
  return `UGX ${n}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-UG');
}

// ─── Inspectors ──────────────────────────────────────────────────────────────
export const INSPECTORS = [
  'INS-001', 'INS-002', 'INS-003',
  'INS-004', 'INS-005', 'INS-006',
  'INS-007', 'INS-008', 'INS-009',
  'INS-010', 'INS-011', 'INS-012',
];

export function getInspector(seed: number): string {
  return INSPECTORS[Math.floor(seededRandom(seed) * INSPECTORS.length)];
}

// ─── Traffic assignment by road type ─────────────────────────────────────────
export function trafficForRoad(roadDesc: string, seed: number): TrafficLevel {
  const lower = (roadDesc ?? '').toLowerCase();
  if (lower.includes('kampala') || lower.includes('jinja') || lower.includes('entebbe')) {
    return seededRandom(seed) > 0.3 ? 'Very High' : 'High';
  }
  if (lower.includes('gulu') || lower.includes('mbarara') || lower.includes('mbale')) {
    return seededRandom(seed) > 0.5 ? 'High' : 'Medium';
  }
  if (lower.includes('bypass') || lower.includes('ring')) {
    return seededRandom(seed) > 0.4 ? 'High' : 'Very High';
  }
  const r = seededRandom(seed);
  if (r < 0.25)      return 'Low';
  if (r < 0.55)      return 'Medium';
  if (r < 0.8)       return 'High';
  return 'Very High';
}
