// SNIC import summary (parse.mjs summary()) → MapStats dataset (countries/ARG/data/snic.json).
// Pure: no I/O, so the import and the migration from the old file both use it.

// Scored indicators SNIC provides (3-year averages, per 100,000). Every other SNIC metric stays in `details`.
const INDICATORS = ['homicide', 'propertyCrime', 'roadDeaths']

// Cities whose own jurisdiction SNIC publishes as a province: they get its figures at city level.
const CITY_JURISDICTIONS = { 'ARG-buenos-aires': 'AR-C' }

const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o?.[k] ?? null]))

/** @param snic  the import summary: { years, national, provinces: {iso: …}, departments: {code: …}, files, origin, importedAt } */
export function toDataset(snic) {
  const values = { national: {}, region: {}, subregion: {}, city: {} }
  const series = { years: snic.years, national: {}, region: {}, subregion: {}, city: {} }
  const details = { national: {}, region: {}, subregion: {}, city: {} }
  const names = { region: {}, subregion: {}, city: {} }
  const put = (level, id, rec, name) => {
    values[level][id] = pick(rec.avg3, INDICATORS)
    series[level][id] = rec.series
    details[level][id] = { latestYear: rec.latestYear, latest: rec.latest, counts: rec.counts, avg3: rec.avg3, ...(rec.province && { province: rec.province }) }
    if (name) names[level][id] = name
  }
  put('national', 'ARG', snic.national)
  for (const [iso, p] of Object.entries(snic.provinces)) put('region', iso, p, p.name)
  for (const [code, d] of Object.entries(snic.departments)) put('subregion', code, d, d.name)
  for (const [city, region] of Object.entries(CITY_JURISDICTIONS)) if (snic.provinces[region]) put('city', city, snic.provinces[region], snic.provinces[region].name)
  return {
    schema: 1,
    provider: 'ARG/snic',
    country: 'ARG',
    generatedAt: `${snic.importedAt}T00:00:00Z`,
    period: { latest: snic.latestYear, aggregation: `mean of ${snic.latestYear - 2}–${snic.latestYear} (per 100,000)` },
    origin: { files: snic.files.map((f) => ({ name: f.file, sha256: f.sha256, retrievedAt: f.retrievedAt || snic.importedAt, note: f.kind })), notes: snic.origin },
    values, names, series, details,
  }
}
