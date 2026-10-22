// Géorisques and GASPAR (Ministère de la Transition écologique): the regulatory seismic zoning of every commune, and
// administrative risk records (natural-disaster declarations, risk prevention plans, département risk files) that
// MapStats turns into 1–5 exposure classes. Shown for context: seismic hazard (GEM) scores the Natural risks category.
import { defineProvider } from '#core/define.js'

export const ZONING = 'https://www.data.gouv.fr/datasets/zonage-sismique-de-la-france-1'
export const GASPAR = 'https://www.data.gouv.fr/datasets/base-nationale-de-gestion-assistee-des-procedures-administratives-relatives-aux-risques-gaspar'
const row = (label, value, unit) => ({ label, value, unit })
const yesNo = (v) => (v == null ? null : v ? 'yes' : 'no')

export default [
  defineProvider({
    id: 'georisques', short: 'Géorisques', name: 'Géorisques / GASPAR – Ministère de la Transition écologique', url: 'https://www.georisques.gouv.fr/',
    covers: 'Regulatory seismic zoning (zones 1–5) by commune; flood "catastrophe naturelle" declarations, flood and forest-fire prevention plans and DDRM listings (GASPAR), as MapStats 1–5 exposure classes (Licence Ouverte)',
    // The zoning is published; the exposure classes are MapStats estimates built on the records. None is scored.
    kind: 'estimate', levels: ['region', 'subregion'],
    provides: ['seismicZone', 'floodExposure', 'fireExposure'],
    access: 'import', cadence: 'GASPAR export refreshed continuously; zoning in force since 2011', refresh: 'year', scope: 'France · commune, population-weighted per département', types: ['hazards'],
    provenance: ({ detail: d, meta, country }) => {
      if (!d) return null
      const commune = d.level === 'subregion' || d.level === 'city'
      return {
        level: commune ? (d.level === 'city' ? 'City (its own département)' : country.subregionLabel) : country.regionLabel,
        area: d.name, period: `GASPAR export ${meta?.period?.gaspar ?? ''}; zoning in force since 2011`, status: 'Official download (data.gouv.fr, files.georisques.fr)',
        rows: (commune
          ? [row('Regulatory seismic zone (1 very low – 5 strong)', d.zone, '/5'), row('Flood disaster declarations since 2000 (distinct events)', d.floodEvents, 'count'),
            row('Approved flood prevention plan (PPRi)', yesNo(d.ppri), ''), row('Listed for forest fire in the département risk file (DDRM)', yesNo(d.fireListed), ''),
            row('Forest-fire prevention plan (PPRif)', d.pprif, '')]
          : [row('Highest seismic zone of a commune', d.seismicZoneMax, '/5'), row('Share of the population in a zoned commune', d.zoningCoverage == null ? null : d.zoningCoverage * 100, '%'),
            row('Share of the population in communes with a flood declaration since 2000', d.floodExposedShare, '%'), row('Share of the population in communes listed for forest fire', d.fireListedShare, '%'),
            row('Communes aggregated', d.communes, 'count')]
        ).filter((r) => r.value != null && r.value !== ''),
        note: commune
          ? 'Exposure classes: flood from the number of distinct declarations (0 → 1, 1–3 → 2, 4–7 → 3, 8–12 → 4, 13+ → 5; an approved PPRi raises it to at least 3); forest fire 1, or 3 when listed in the DDRM, 4 with a PPRif prescribed, 5 approved.'
          : 'Département values are population-weighted means of the communes’ zones and classes (INSEE reference populations).',
      }
    },
  }),
  defineProvider({
    id: 'georisques-api', short: 'Géorisques API', name: 'Géorisques – zonage sismique API', url: 'https://www.georisques.gouv.fr/doc-api',
    covers: 'The current zoning of the tracked communes (20 per call), used to cross-check the national table',
    access: 'once', cadence: 'On demand', scope: 'France · 40 tracked communes', types: ['hazards'],
    usedFor: 'Cross-checking the seismic zoning table for the tracked communes',
  }),
]
