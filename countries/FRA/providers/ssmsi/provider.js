// SSMSI: crime recorded by the police and gendarmerie nationales, by département (Ministère de l'Intérieur's
// statistical service). Scores use the homicide rate and a theft composite, both 3-year averages; every other
// published category is shown as it is.
import { defineProvider, recency } from '#core/define.js'

export const DATASET = 'https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales'

// Every SSMSI indicator in the latest-rates table and "values by source" (parse.mjs METRICS has the source labels).
// propertyCrime is the one composite MapStats computes: the seven theft and robbery categories added up.
export const TABLE = {
  homicide: 'Homicides (victims, incl. fatal assaults)', propertyCrime: 'Thefts and robberies, 7 categories combined',
  homicideAttempt: 'Attempted homicides (victims)', domesticViolence: 'Domestic physical violence (victims)',
  assault: 'Physical violence outside the family (victims)', sexualViolence: 'Sexual violence (victims)',
  armedRobbery: 'Armed robberies (offences)', violentTheft: 'Violent thefts without a weapon (offences)',
  theftFromPersons: 'Non-violent thefts from persons (victims)', burglary: 'Residential burglaries (offences, per 100k dwellings)',
  vehicleTheft: 'Vehicle thefts', theftFromVehicles: 'Thefts from vehicles', vehicleAccessoryTheft: 'Thefts of vehicle accessories',
  vandalism: 'Criminal damage (offences)', drugUse: 'Drug use (persons charged)', drugTrafficking: 'Drug trafficking (persons charged)',
  fraud: 'Fraud and payment fraud (victims, by residence)',
}
const row = (label, value, unit) => ({ label, value, unit })

export default [
  defineProvider({
    id: 'ssmsi', short: 'SSMSI', name: 'SSMSI – Ministère de l’Intérieur', url: DATASET,
    covers: 'Crime recorded by the police and gendarmerie, by département: homicides, violence, thefts, burglaries, drug offences, fraud (Licence Ouverte 2.0)',
    // Published per département; Paris, its own département, gets its figures at city level (lib/fr.mjs).
    kind: 'register', levels: ['region'],
    family: { id: 'ssmsi', label: 'SSMSI · official crime statistics', short: 'SSMSI' },
    provides: ['homicide', 'propertyCrime'],
    access: 'import', cadence: 'Yearly (2016–latest year), revised each summer', refresh: 'year', scope: 'France · département', types: ['crime'],
    report: {
      category: 'safety',
      label: 'Official SSMSI statistics',
      trends: {
        group: 'Crime trends', unit: 'per 100,000',
        charts: [
          { indicator: 'homicide', title: 'Homicide rate', subtitle: 'Victims of homicide per 100,000', digits: 2, lastYear: true },
          { indicator: 'propertyCrime', title: 'Thefts and robberies', subtitle: 'Seven SSMSI theft and robbery categories combined, per 100,000', digits: 0, lastYear: true },
        ],
      },
      latestTable: { title: 'Recorded offences', unit: 'per 100k', rows: TABLE },
      footnote: 'Scores use the 3-year averages of the homicide rate and of the theft composite. Each category has its own counting unit (victims, offences, vehicles, persons charged); the only sum is the theft composite (armed and violent robberies, thefts from persons, burglaries, vehicle thefts, thefts from and of parts of vehicles), per 100,000 inhabitants. Published burglary rates are per 100,000 dwellings. Facts are counted where they were committed (fraud: where the victim lives).',
    },
    provenance: ({ detail: d }) => {
      if (!d) return null // a city's département figures are listed under département-level statistics
      const y = d.latestYear, span = `${y - 2}–${String(y).slice(2)}`
      return {
        level: d.level === 'city' ? 'City (its own département)' : 'Département',
        area: d.name, period: `${y} (+ ${span} average)`, status: 'Official download (data.gouv.fr)',
        rows: Object.entries(TABLE).flatMap(([k, label]) => [
          row(`${label}, ${y}`, d.counts?.[k], 'count'),
          row(`${label}, ${y}`, d.latest?.[k], k === 'burglary' ? 'per 100k dwellings' : 'per 100k'),
          row(`${label}, ${span} average`, d.avg3?.[k], k === 'burglary' ? 'per 100k dwellings' : 'per 100k'),
        ]).filter((r) => r.value != null),
        note: 'Rates as published by the SSMSI (per 1,000, shown per 100,000), rounded to 2 decimals; counts are exact. National rates are computed from the 101 départements.',
      }
    },
    weightFactors: ({ detail }) => {
      const r = recency(detail?.latestYear)
      return r < 1 ? [[`data from ${detail.latestYear}`, r]] : []
    },
  }),
]
