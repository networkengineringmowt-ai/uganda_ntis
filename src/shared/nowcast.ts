/**
 * nowcast — report every metric AT THE CURRENT INSTANT, per the clock.
 *
 * Observed values are anchored at their survey year and carried forward to the
 * fractional "now" (e.g. 2026.4471…) with the platform's predictive models:
 *   IRI  — compound annual roughness progression (HDM-4-style growth rate)
 *   VCI  — linear condition decay per year, clamped 0–100
 *   ADT  — the 2016-base growth-factor curve, linearly interpolated so the
 *          factor moves continuously between calendar years
 * A 1-second tick re-renders consumers so displayed values are literally
 * "as of" the moment on screen.
 */
import { useEffect, useState } from 'react';

/** Fractional current year, second-resolution (e.g. 2026.44713). */
export function yearNow(): number {
  const d = new Date();
  const y0 = new Date(d.getFullYear(), 0, 1).getTime();
  const y1 = new Date(d.getFullYear() + 1, 0, 1).getTime();
  return d.getFullYear() + (d.getTime() - y0) / (y1 - y0);
}

/** Re-render every `ms`; returns the fractional year at each tick. */
export function useNowTick(ms = 1000): number {
  const [t, setT] = useState(yearNow());
  useEffect(() => {
    const id = setInterval(() => setT(yearNow()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

export const stampOf = (t: number) => {
  const d = new Date();
  void t; // tick dependency
  return d.toLocaleTimeString('en-GB');
};

// ── Deterioration model parameters (network calibration) ─────────────────────
export const IRI_GROWTH = { paved: 0.04, unpaved: 0.09 };   // compound /yr
export const IRI_CAP    = { paved: 16,   unpaved: 20 };
export const VCI_DECAY  = { paved: 2.2,  unpaved: 4.5 };    // points /yr

/** Roughness carried forward from its survey year to `t` (fractional now). */
export function iriNow(iri: number | null | undefined, surveyYear: number, paved: boolean, t = yearNow()): number | null {
  if (iri == null || !Number.isFinite(iri)) return null;
  const dt = Math.max(0, t - surveyYear);
  const g = paved ? IRI_GROWTH.paved : IRI_GROWTH.unpaved;
  return Math.min(paved ? IRI_CAP.paved : IRI_CAP.unpaved, iri * Math.pow(1 + g, dt));
}

/** Condition index decayed from its survey year to `t`. */
export function vciNow(vci: number | null | undefined, surveyYear: number, paved: boolean, t = yearNow()): number | null {
  if (vci == null || !Number.isFinite(vci)) return null;
  const dt = Math.max(0, t - surveyYear);
  const d = paved ? VCI_DECAY.paved : VCI_DECAY.unpaved;
  return Math.max(0, Math.min(100, vci - d * dt));
}

// ── Traffic growth (2016 base year; source growth_factors_summary 2016-2024) ─
export const GROWTH_2016: Record<number, number> = {
  2016: 1.00, 2017: 1.06, 2018: 1.15, 2019: 1.23, 2020: 1.05, 2021: 1.19,
  2022: 1.32, 2023: 1.45, 2024: 1.55, 2025: 1.61, 2026: 1.69, 2027: 1.77,
  2028: 1.87, 2029: 1.97, 2030: 2.06, 2031: 2.15, 2032: 2.24, 2033: 2.32,
  2034: 2.40, 2035: 2.50,
};

/** Growth factor at a FRACTIONAL year — linear interpolation between years. */
export function factorAt(t: number): number {
  const y0 = Math.floor(t), y1 = y0 + 1;
  const f0 = GROWTH_2016[y0] ?? GROWTH_2016[2035] ?? 1;
  const f1 = GROWTH_2016[y1] ?? f0;
  return f0 + (f1 - f0) * (t - y0);
}

/** Observed ADT (at obsYear) carried to the current instant. */
export function adtNow(adt: number | null | undefined, obsYear: number, t = yearNow()): number | null {
  if (adt == null || !Number.isFinite(adt)) return null;
  return adt * (factorAt(t) / factorAt(obsYear));
}
