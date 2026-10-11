// Reliability weights for the "weighted" integration mode.
//
// weight = base (kind of source) × provider factors (quality, recency) × geographic match
// The numbers are judgement calls, kept with each kind (src/core/define.js KINDS) and provider
// (`weightFactors`), and shown verbatim in the report and methodology.
import { familyBase, familyProviders, isRegionOnly } from '../core/providers.js'

/**
 * @param family  source family id
 * @param ctx     { type: 'city'|'province', details } — details: the place's data per provider (src/core/resolve.js)
 * @param borrowed  value comes from the province, not the place itself
 * @returns { w, factors: [[label, multiplier]] }
 */
export function sourceWeight(family, ctx = {}, borrowed = false) {
  const base = familyBase(family)
  if (!base) return { w: 0, factors: [] }
  const factors = [[base.why, base.w]]
  for (const p of familyProviders(family)) {
    const d = ctx.details?.[p.id]
    if (p.weightFactors) factors.push(...p.weightFactors({ type: ctx.type, level: d?.level, detail: d }))
  }
  // Families that only publish province-wide figures are discounted for a city; any other family's
  // value copied from the province is discounted as borrowed.
  const regionOnly = isRegionOnly(family)
  if (regionOnly && ctx.type === 'city') factors.push(['province-wide figure', 0.5])
  if (borrowed && !regionOnly) factors.push(['borrowed from the province', 0.5])
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
