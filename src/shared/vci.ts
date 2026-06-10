/**
 * Visual Condition Index (VCI) rating bands — single source of truth.
 * Matches the platform UI (NetworkStory VCI_BANDS) and the Supabase schema
 * comments (road_link_condition.vci_rating, etc.):
 *   Very Good ≥85 · Good ≥75 · Fair ≥65 · Poor ≥55 · Very Poor <55
 */
export type VciRating = 'Very Good' | 'Good' | 'Fair' | 'Poor' | 'Very Poor';

export function vciRating(vci: number | null | undefined): VciRating | null {
  if (vci == null || Number.isNaN(vci)) return null;
  if (vci >= 85) return 'Very Good';
  if (vci >= 75) return 'Good';
  if (vci >= 65) return 'Fair';
  if (vci >= 55) return 'Poor';
  return 'Very Poor';
}

export const VCI_RATING_COLOR: Record<VciRating, string> = {
  'Very Good': '#00ff88',
  'Good':      '#00f5ff',
  'Fair':      '#ffd23f',
  'Poor':      '#ff6b35',
  'Very Poor': '#ff2d78',
};
