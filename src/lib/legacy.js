// TEMPORARY (migration step 3 → 4): the report, compare view, search and provenance still read
// entity.snic / entity.numbeo / entity.numbeoSlug and model.snicOrigin. They are rebuilt here from the generic
// `details` the resolver attaches; step 4 moves those components onto `details` and deletes this file.

const SNIC = 'ARG/snic', NUMBEO = 'numbeo'
const SNIC_LEVEL = { city: 'city', subregion: 'department', region: 'province' }

function snicOf(d) {
  if (!d) return null
  const { level, code, name, latestYear, latest, counts, avg3, series, province } = d
  return { level: SNIC_LEVEL[level], ...(code && { code }), ...(name && { name }), ...(province && { province }), latest, counts, avg3, series, latestYear }
}

function numbeoOf(d) {
  if (!d?.source) return null
  return { source: d.source, fetchedAt: d.fetchedAt, contributors: d.contributors, survey: d.survey, safetyIndex: d.safetyIndex ?? null }
}

export function legacyFields(model) {
  for (const e of model.cities) {
    e.snic = snicOf(e.details[SNIC])
    e.numbeo = numbeoOf(e.details[NUMBEO])
    e.numbeoSlug = e.codes.numbeo
  }
  for (const e of model.provinces) e.snic = snicOf(e.details[SNIC])
  const nat = model.national.details[SNIC]
  if (nat) {
    const { latest, counts, avg3, series, latestYear, years } = nat
    model.national.snic = { latest, counts, avg3, series, latestYear, years }
  }
  model.snicOrigin = model.datasets[SNIC]?.origin?.notes || null
}
