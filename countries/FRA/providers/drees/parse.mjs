// DREES "Médecins RPPS" workbook rows → density and headcount per département. Pure.
//
// Rules (see the "Lisez-moi" sheet):
//  - Physicians registered with the Ordre and active at 1 January of the year, all specialties and modes of
//    practice, counted once at their most recent place of activity (headcounts, not activities).
//  - Density is DREES's own figure: physicians per 100,000 inhabitants, over INSEE's population estimate at
//    1 January of the same year. The indicator is per 1,000: density ÷ 100.
//  - Only the "Ensemble" rows by département are read; "ND" (fewer than 10 professionals) stays null.
import { num } from '#sdk'
import { DEP_TO_MAP, round, withCityJurisdictions } from '../../lib/fr.mjs'

/** "075-Paris" / "02A-Corse-du-Sud" / "971 -Guadeloupe" → INSEE département code, null for totals and areas off the map. */
export function depCode(label) {
  const c = String(label ?? '').split('-')[0].trim().toUpperCase()
  return DEP_TO_MAP[c] ? c : DEP_TO_MAP[c.replace(/^0/, '')] ? c.replace(/^0/, '') : null
}

const isTotal = (v) => /Ensemble/i.test(String(v ?? ''))
const TOTAL_COLUMNS = ['specialites_agregees', 'specialites', 'exercice', 'tranche_age', 'sexe']

/**
 * Rows of one sheet ({ header: value }, readXlsx) → { byRegion: { regionId: { year: value } }, year, unmatched }.
 * `re` matches the yearly columns (densite_2026 / effectif_2026).
 */
export function departmentRows(rows, re) {
  const byRegion = {}
  const unmatched = new Set()
  let year = 0
  for (const r of rows) {
    if (!TOTAL_COLUMNS.every((k) => isTotal(r[k])) || isTotal(r.departement)) continue
    const dep = depCode(r.departement)
    if (!dep) { unmatched.add(String(r.departement)); continue }
    for (const [h, v] of Object.entries(r)) {
      const m = h.match(re)
      if (!m) continue
      ;(byRegion[DEP_TO_MAP[dep]] ||= {})[+m[1]] = num(v)
      year = Math.max(year, +m[1])
    }
  }
  return { byRegion, year, unmatched: [...unmatched] }
}

/** Densities and headcounts per département → the dataset's parts (doctors per 1,000 = density ÷ 100). */
export function toValues({ density, physicians, year }, { names = {} } = {}) {
  const parts = { values: { region: {} }, names: { region: {} }, details: { region: {} } }
  for (const [id, d] of Object.entries(density.byRegion)) {
    parts.values.region[id] = { doctors: d[year] == null ? null : round(d[year] / 100, 2) }
    parts.details.region[id] = { year, density: d[year] ?? null, physicians: physicians.byRegion[id]?.[year] ?? null, densityByYear: d }
    if (names[id]) parts.names.region[id] = names[id]
  }
  return { ...withCityJurisdictions(parts), period: { latest: year, note: `physicians active at 1 January ${year}` } }
}
