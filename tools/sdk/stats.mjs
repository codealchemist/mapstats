// Small helpers for turning published figures into indicator values.

export const round = (v, digits = 2) => (v == null ? null : Math.round(v * 10 ** digits) / 10 ** digits)

/** Rate per 100,000 inhabitants. */
export const per100k = (count, population) => (count == null || !population ? null : (count / population) * 1e5)

/** Share as a percentage (0–100). */
export const share = (part, total) => (part == null || !total ? null : (part / total) * 100)

/**
 * Mean of the last `n` values of a yearly series, ignoring gaps; null when fewer than `min` remain
 * (a mean of one year is just that year).
 */
export function meanOfLast(series, n = 3, { min = 2 } = {}) {
  const v = series.slice(-n).filter((x) => x != null)
  return v.length >= min ? v.reduce((s, x) => s + x, 0) / v.length : null
}
