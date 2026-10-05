// Reliability weights for the "weighted" integration mode.
//
// weight = base (kind of source) × geographic match × quality × recency
// The numbers are judgement calls, kept in one place so they can be tuned and are
// shown verbatim in the report and methodology.

const YEAR = new Date().getFullYear()

export const BASE = {
  snic: { w: 1.0, why: 'official register of recorded cases' },
  ssmsi: { w: 1.0, why: 'official register of recorded cases' },
  onisr: { w: 1.0, why: 'official road-accident register' },
  insee: { w: 1.0, why: 'official statistics' },
  openmeteo: { w: 1.0, why: 'physical measurement / reanalysis' },
  usgs: { w: 1.0, why: 'instrumental earthquake catalogue' },
  numbeo: { w: 0.5, why: 'crowd-sourced perception survey' },
  provincial: { w: 0.3, why: 'hand-entered approximations' },
}

// Full weight within a year of the reference period, then −15% per extra year, floor 50%.
const recency = (year) => (year == null ? 1 : Math.max(0.5, 1 - 0.15 * Math.max(0, YEAR - year - 1)))

/**
 * @param family  source family id
 * @param ctx     { type: 'city'|'province', official: { [family]: { level, latestYear } }, numbeo }
 * @param borrowed  value comes from the province, not the place itself
 * @returns { w, factors: [[label, multiplier]] }
 */
export function sourceWeight(family, ctx = {}, borrowed = false) {
  const base = BASE[family]
  if (!base) return { w: 0, factors: [] }
  const factors = [[base.why, base.w]]
  const official = ctx.official?.[family]
  if (official) {
    if (ctx.type === 'city' && official.level === 'subregion') factors.push(['department, not city boundary', 0.9])
    const r = recency(official.latestYear)
    if (r < 1) factors.push([`data from ${official.latestYear}`, r])
  }
  if (family === 'numbeo' && ctx.numbeo) {
    const n = ctx.numbeo
    if (n.source === 'snapshot') factors.push(['approximate snapshot, unverified', 0.4])
    else if (n.contributors != null) factors.push([`${n.contributors} contributors (full weight at 50+)`, Math.min(1, Math.max(0.2, n.contributors / 50))])
    else factors.push(['contributor count unknown', 0.7])
    const r = recency(n.fetchedAt ? +n.fetchedAt.slice(0, 4) : null)
    if (r < 1) factors.push([`collected ${n.fetchedAt}`, r])
  }
  if (family === 'provincial' && ctx.type === 'city') factors.push(['province-wide figure', 0.5])
  if (borrowed && family !== 'provincial') factors.push(['borrowed from the province', 0.5])
  return { w: factors.reduce((p, [, m]) => p * m, 1), factors }
}

// Percentile (0–100) of `v` within the sorted array `sorted`; ties count half.
export function percentile(sorted, v) {
  let lo = 0, hi = sorted.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < v) lo = m + 1; else hi = m }
  let eq = lo
  while (eq < sorted.length && sorted[eq] === v) eq++
  return ((lo + (eq - lo) / 2) / sorted.length) * 100
}

export const agreementOf = (spread) => (spread == null ? null : spread < 10 ? 'high' : spread < 20 ? 'medium' : 'low')
