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

/** Boys born per girl: about 105 to 100, the usual sex ratio at birth (Argentina's vital statistics among others). */
export const BOYS_PER_GIRL = 1.05

/**
 * Life expectancy at birth for both sexes from the men's and the women's, when the source publishes them apart:
 * their mean weighted by births (BOYS_PER_GIRL), as a combined life table starts. 1 decimal; null without both.
 */
export const lifeExpBothSexes = ({ men, women }) => (men == null || women == null ? null : round((BOYS_PER_GIRL * men + women) / (1 + BOYS_PER_GIRL), 1))
