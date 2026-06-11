/**
 * Reporting year — the platform ALWAYS reports on the current year; where
 * observations lag, the predictive models (traffic projections, bridge AADT
 * prediction, deterioration curves) carry values forward to this year.
 */
export const CURRENT_YEAR = new Date().getFullYear();
export const FY_LABEL = `FY${(CURRENT_YEAR - 1) % 100}-${CURRENT_YEAR % 100}`;
