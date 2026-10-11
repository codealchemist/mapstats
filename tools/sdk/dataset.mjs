// Checking and writing datasets (docs/schemas/dataset.schema.json) against the catalogue, the country's
// providers, its regions and its places.
import fs from 'node:fs'
import path from 'node:path'
import { indicatorById, scoreRange } from '../../src/data/metrics.js'
import { providersFor } from '../../src/core/providers.js'

const LEVELS = ['national', 'region', 'subregion', 'city']

/**
 * @param ctx { country, regionIds: string[], places: [{ id, codes }] }
 * @returns { errors: string[], warnings: string[], indicators: { [id]: { provider, levels: { [level]: n }, min, max, outside } } }
 */
export function checkDataset(ds, { country, regionIds, places }) {
  const errors = [], warnings = []
  const who = ds.provider || `${ds.country} compilation`
  const err = (m) => errors.push(`${who}: ${m}`)
  const warn = (m) => warnings.push(`${who}: ${m}`)
  if (ds.schema !== 1) err('schema must be 1')
  if (ds.country !== country.iso3) err(`country is ${ds.country}, expected ${country.iso3}`)
  if (!ds.provider === !ds.providers) err('needs exactly one of provider / providers')
  if (!ds.generatedAt || Number.isNaN(Date.parse(ds.generatedAt))) err('generatedAt must be a date-time')
  if (!Number.isInteger(ds.period?.latest)) err('period.latest must be a year')
  if (!ds.origin?.files?.length) err('origin.files must list the files the values come from')

  const available = new Set(providersFor(country).map((p) => p.id))
  const providerOfValue = (k) => ds.providers?.[k] ?? ds.provider
  for (const p of new Set([ds.provider, ...Object.values(ds.providers || {})].filter(Boolean))) {
    if (!available.has(p)) err(`provider ${p} is not one of ${country.iso3}'s providers (country.config.js)`)
  }

  const regions = new Set(regionIds), cities = new Set(places.map((p) => p.id))
  const known = { national: new Set([country.iso3]), region: regions, city: cities }
  const indicators = {}
  for (const level of LEVELS) {
    const missing = []
    for (const [id, vals] of Object.entries(ds.values?.[level] || {})) {
      if (known[level] && !known[level].has(id)) missing.push(id)
      for (const [k, v] of Object.entries(vals)) {
        const ind = indicatorById[k]
        if (!ind) { err(`unknown indicator ${k} (not in src/data/metrics.js)`); continue }
        if (v !== null && typeof v !== 'number') { err(`${level} ${id} ${k}: ${JSON.stringify(v)} is not a number`); continue }
        const s = (indicators[k] ||= { provider: providerOfValue(k), levels: {}, min: Infinity, max: -Infinity, outside: 0, range: scoreRange(k) })
        if (v == null) continue
        s.levels[level] = (s.levels[level] || 0) + 1
        s.min = Math.min(s.min, v)
        s.max = Math.max(s.max, v)
        if (s.range && (v < s.range.range[0] || v > s.range.range[1])) s.outside++
      }
    }
    if (missing.length) err(`${level} ids not in ${level === 'city' ? 'the place list' : level === 'region' ? 'geo/regions.json' : 'the country'}: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ` (+${missing.length - 5})` : ''}`)
  }
  const subregions = new Set(Object.keys(ds.values?.subregion || {}))
  if (subregions.size) {
    const unlinked = places.filter((p) => p.codes?.subregion && !subregions.has(p.codes.subregion)).map((p) => p.id)
    if (unlinked.length) warn(`no ${country.subregionLabel || 'subregion'} values for ${unlinked.length} place(s) linked to one: ${unlinked.slice(0, 5).join(', ')}`)
  }
  // Anchored ranges leave a few values outside by design; a hand-set domain that clips values may need data-based anchors.
  for (const [k, s] of Object.entries(indicators)) {
    if (s.outside && s.range?.from === 'domain') warn(`${k}: ${s.outside} value(s) outside the hand-set domain [${s.range.range.join(', ')}] (scores saturate there; never change the data to fit)`)
  }
  return { errors, warnings, indicators }
}

/**
 * Completes a prefill's output into a dataset, checks it and writes countries/<ISO3>/data/<file>.json.
 * @param parts  { period, origin, values, names?, series?, details?, quality? } from the provider's prefill()
 * @param ctx    { country, provider (full id), file, regionIds, places }
 */
export function writeDataset(parts, { country, provider, file, regionIds, places, root = process.cwd() }) {
  const ds = { schema: 1, provider, country: country.iso3, generatedAt: new Date().toISOString(), ...parts }
  const report = checkDataset(ds, { country, regionIds, places })
  if (report.errors.length) throw Object.assign(new Error(`Dataset not written:\n  ${report.errors.join('\n  ')}`), { report })
  const out = path.join(root, 'countries', country.iso3, 'data', `${file}.json`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(ds, null, 1) + '\n')
  return { path: out, ...report }
}
