// Pure statistics engine for the Deep Analytics "Numeric Distribution Statistics" panels.
// No React/UI dependency — safe to reuse anywhere numeric arrays need summarizing.

export interface DistStats {
  n: number;
  mean: number;
  median: number;
  mode: number;
  min: number;
  max: number;
  range: number;
  stdDev: number;
  variance: number;
  coefVar: number; // coefficient of variation, %
  q1: number;
  q3: number;
  iqr: number;
  p5: number;
  p10: number;
  p90: number;
  p95: number;
  p99: number;
  skewness: number | null;
  kurtosis: number | null;
}

export interface HistBin {
  x0: number;
  x1: number;
  count: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

export function computeDistribution(raw: (number | null | undefined)[]): DistStats | null {
  const values = raw.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const n = values.length;
  if (n === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / n;
  const median = percentile(sorted, 50);
  const min = sorted[0];
  const max = sorted[n - 1];
  const range = max - min;

  // Mode via rounded-value frequency map (numeric data is often continuous;
  // rounding to a sensible precision groups near-duplicate values together).
  const magnitude = Math.max(1, Math.abs(mean));
  const decimals = magnitude >= 100 ? 0 : magnitude >= 1 ? 1 : 3;
  const freq = new Map<number, number>();
  for (const v of sorted) {
    const key = Number(v.toFixed(decimals));
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  let mode = sorted[0];
  let modeCount = 0;
  for (const [key, count] of freq) {
    if (count > modeCount) {
      modeCount = count;
      mode = key;
    }
  }

  let variance = 0;
  let stdDev = 0;
  if (n > 1) {
    const sqDiffSum = sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0);
    variance = sqDiffSum / (n - 1);
    stdDev = Math.sqrt(variance);
  }
  const coefVar = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  const q1 = percentile(sorted, 25);
  const q3 = percentile(sorted, 75);
  const iqr = q3 - q1;
  const p5 = percentile(sorted, 5);
  const p10 = percentile(sorted, 10);
  const p90 = percentile(sorted, 90);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);

  let skewness: number | null = null;
  if (n > 2 && stdDev > 0) {
    const m3 = sorted.reduce((acc, v) => acc + (v - mean) ** 3, 0) / n;
    const g1 = m3 / stdDev ** 3;
    skewness = (Math.sqrt(n * (n - 1)) / (n - 2)) * g1; // sample-adjusted (Fisher-Pearson)
  }

  let kurtosis: number | null = null;
  if (n > 3 && stdDev > 0) {
    const m4 = sorted.reduce((acc, v) => acc + (v - mean) ** 4, 0) / n;
    const g2 = m4 / stdDev ** 4 - 3;
    kurtosis = ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6); // excess kurtosis, sample-adjusted
  }

  return {
    n,
    mean,
    median,
    mode,
    min,
    max,
    range,
    stdDev,
    variance,
    coefVar,
    q1,
    q3,
    iqr,
    p5,
    p10,
    p90,
    p95,
    p99,
    skewness,
    kurtosis,
  };
}

export function histogramBins(raw: (number | null | undefined)[], binCount = 12): HistBin[] {
  const values = raw.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ x0: min, x1: max, count: values.length }];
  }
  const width = (max - min) / binCount;
  const bins: HistBin[] = Array.from({ length: binCount }, (_, i) => ({
    x0: min + i * width,
    x1: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count += 1;
  }
  return bins;
}

export function statsTableCSV(groups: { label: string; values: (number | null | undefined)[] }[]): string {
  const header = [
    'Group',
    'N',
    'Mean',
    'Median',
    'Mode',
    'StdDev',
    'Variance',
    'CV%',
    'Min',
    'Q1',
    'Q3',
    'Max',
    'IQR',
    'P5',
    'P10',
    'P90',
    'P95',
    'P99',
    'Skewness',
    'Kurtosis',
  ];
  const rows = [header.join(',')];
  for (const g of groups) {
    const s = computeDistribution(g.values);
    if (!s) {
      rows.push([g.label, 0, ...Array(header.length - 2).fill('')].join(','));
      continue;
    }
    rows.push(
      [
        g.label,
        s.n,
        s.mean.toFixed(3),
        s.median.toFixed(3),
        s.mode.toFixed(3),
        s.stdDev.toFixed(3),
        s.variance.toFixed(3),
        s.coefVar.toFixed(2),
        s.min.toFixed(3),
        s.q1.toFixed(3),
        s.q3.toFixed(3),
        s.max.toFixed(3),
        s.iqr.toFixed(3),
        s.p5.toFixed(3),
        s.p10.toFixed(3),
        s.p90.toFixed(3),
        s.p95.toFixed(3),
        s.p99.toFixed(3),
        s.skewness !== null ? s.skewness.toFixed(3) : '',
        s.kurtosis !== null ? s.kurtosis.toFixed(3) : '',
      ].join(',')
    );
  }
  return rows.join('\n');
}
