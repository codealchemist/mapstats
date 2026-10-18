// Score anchors: for each scored indicator, the values that score 0 and 100 are the 2nd and 98th percentile of
// region-level values pooled across every country with data (docs/architecture.md §3.1). Region level only:
// small areas are noisier and would let one department set everyone's scale. Indicators with fewer than
// MIN_REGIONS values keep their hand-set domain.
import { INDICATORS } from '../../src/data/metrics.js'
import { resolvePlaces } from '../../src/core/resolve.js'

export const LOW = 0.02, HIGH = 0.98, MIN_REGIONS = 5

/** Linear-interpolated quantile of a sorted array. */
export function quantile(sorted, q) {
  const i = q * (sorted.length - 1)
  const lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

const round = (v) => +v.toPrecision(4)

/**
 * @param countries  [{ iso3, regionIds, places, datasets }]
 * @returns { method, countries, indicators: { [id]: { lo, hi, n } } }
 */
export function computeAnchors(countries) {
  const pooled = {}
  const used = []
  for (const c of countries) {
    if (!c.datasets.length) continue
    used.push(c.iso3)
    const { regions } = resolvePlaces({ regionIds: c.regionIds, places: c.places, datasets: c.datasets })
    for (const r of Object.values(regions)) {
      for (const [k, v] of Object.entries(r.values)) if (v != null) (pooled[k] ||= []).push(v)
    }
  }
  const indicators = {}
  for (const ind of INDICATORS.filter((i) => i.better)) {
    const v = (pooled[ind.id] || []).sort((a, b) => a - b)
    if (v.length < MIN_REGIONS) continue
    const lo = round(quantile(v, LOW)), hi = round(quantile(v, HIGH))
    if (hi > lo) indicators[ind.id] = { lo, hi, n: v.length }
  }
  return { method: '2nd–98th percentile of region values', countries: used.sort(), indicators }
}
