// ARCEP eligibility statistics (CSV by technology and by speed class) → shares per département and commune. Pure.
//  - Shares are eligible premises / all premises (dwellings and business locations) × 100, 1 decimal: FttH-eligible and
//    eligible to at least 30 Mbit/s with any technology.
import { num } from '#sdk'
import { DEP_TO_MAP, round, withCityJurisdictions } from '../../lib/fr.mjs'

const share = (part, total) => (part == null || !total ? null : round((100 * part) / total, 1))

/** Rows of the "techno" and "debit" files → { out: { id: { premises, ftth, thd30 } }, date }; `keep(row)` gives the id to keep. */
export function coverage(technoRows, debitRows, keep) {
  const out = {}
  let date = null
  for (const r of technoRows) {
    const id = keep(r)
    if (!id) continue
    out[id] = { premises: num(r.nbr), ftth: share(num(r.elig_ftth), num(r.nbr)), date: r.date }
    date = r.date
  }
  for (const r of debitRows) {
    const id = keep(r)
    if (id && out[id]) out[id].thd30 = share(num(r.elig_thd30), num(r.nbr))
  }
  return { out, date }
}

export const byDepartment = (r) => DEP_TO_MAP[r.code_dep] || null
export const byCommune = (communes) => (r) => (communes.has(r.code_insee) ? r.code_insee : null)

/** Département and commune coverage → the dataset's parts. */
export function toValues({ departments, communes }, { names = {}, communeNames = {} } = {}) {
  const parts = { values: { region: {}, subregion: {} }, names: { region: {}, subregion: {} }, details: { region: {}, subregion: {} } }
  for (const [id, d] of Object.entries(departments)) {
    parts.values.region[id] = { fibreCoverage: d.ftth }
    parts.details.region[id] = d
    if (names[id]) parts.names.region[id] = names[id]
  }
  for (const [c, d] of Object.entries(communes)) {
    parts.values.subregion[c] = { fibreCoverage: d.ftth }
    parts.details.subregion[c] = d
    if (communeNames[c]) parts.names.subregion[c] = communeNames[c]
  }
  return withCityJurisdictions(parts)
}
