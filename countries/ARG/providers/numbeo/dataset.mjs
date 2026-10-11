// Numbeo inputs for Argentina → MapStats dataset (countries/ARG/data/numbeo.json). Pure: used by numbeo:build.
//   snapshot  snapshot.json: approximate indices entered by hand, never verified
//   stored    numbeo:build's list of pages stored or copied by hand (manual.json), matched to city ids
// A city with stored values uses only those: snapshot figures it doesn't publish are dropped.

const INDICATORS = ['crimeIndex', 'healthcareIndex', 'pollutionIndex', 'trafficIndex', 'costOfLiving', 'purchasingPower', 'qualityOfLife']
const pick = (o) => Object.fromEntries(INDICATORS.filter((k) => o[k] != null).map((k) => [k, o[k]]))
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null))

export function toDataset({ snapshot, stored, builtAt = new Date().toISOString() }) {
  const values = {}, details = {}
  for (const c of snapshot) {
    values[c.cityId] = pick(c)
    if (c.crimeIndex != null) details[c.cityId] = { source: 'snapshot' }
  }
  for (const s of stored) {
    if (!s.cityId) continue
    values[s.cityId] = pick(s)
    details[s.cityId] = clean({ source: s.source, fetchedAt: s.fetchedAt, contributors: s.contributors, survey: s.survey, safetyIndex: s.safetyIndex, climateIndex: s.climateIndex, slug: s.slug })
  }
  const fetched = stored.map((s) => s.fetchedAt).filter(Boolean).sort()
  return {
    schema: 1,
    provider: 'numbeo',
    country: 'ARG',
    generatedAt: builtAt,
    period: { latest: +(fetched.at(-1) || '2025').slice(0, 4) },
    origin: {
      files: [{ name: 'providers/numbeo/snapshot.json', sha256: null, retrievedAt: null, note: 'hand-entered approximations (2025), date not recorded' },
        ...stored.filter((s) => s.cityId).map((s) => ({ name: s.slug, url: `https://www.numbeo.com/crime/in/${s.slug}`, sha256: null, retrievedAt: s.fetchedAt || null, note: s.source }))],
      notes: 'Numbeo blocks cross-origin requests and restricts automated collection: values are a stored snapshot, and reports link to the live pages.',
    },
    values: { city: values },
    details: { city: details },
  }
}
