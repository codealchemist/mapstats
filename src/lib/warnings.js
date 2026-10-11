// Warnings for a place: extremes that a good yearly mean would hide (data/standards.js daily limits for air, under
// the selected standard; data/extremes.js for climate). Shown in reports, compare and the map; never scored.
import { STANDARDS, standardFor } from '../data/standards.js'
import { CLIMATE_WARNINGS, ETCCDI_URL } from '../data/extremes.js'

/** @returns [{ id, text, why, source, url }] */
export function warningsFor(entity, standards) {
  if (!entity?.values) return []
  const out = []
  for (const id of Object.keys(STANDARDS)) {
    const std = standardFor(id, standards)
    const d = std.daily
    const n = d && entity.values[d.indicator]
    if (n != null && n > d.allowed) {
      out.push({ id: d.indicator, text: `${n} days in the last year ${d.text}`, why: `${std.short}: ${d.basis}`, source: std.short, url: std.url })
    }
  }
  for (const w of CLIMATE_WARNINGS) {
    const n = entity.values[w.indicator]
    if (n != null && n >= w.warnAt) out.push({ id: w.indicator, text: w.text(Math.round(n)), why: w.why, source: 'Climate extremes (ERA5)', url: ETCCDI_URL })
  }
  return out
}
