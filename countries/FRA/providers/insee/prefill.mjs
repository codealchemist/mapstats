// Prefill for INSEE's département statistics → countries/FRA/data/insee.json (a compilation: each value cites its
// provider). Everything comes from INSEE's open APIs (api.insee.fr, no key; INSEE Open Licence 2.0): insee.fr's
// robots.txt disallows fetching its xlsx/csv files, so the APIs are the only automated route.
//
//   npm run prefill -- FRA --provider insee
//
// Each answer is stored once in raw/ (Melodi pages are followed and concatenated); the reference-population file of
// every commune (populations légales) is stored here too, as the population weights of the Géorisques prefill.
//
// Rules:
//  - Values are stored as published, with the reference period of each series; nothing is recomputed except the
//    mean of the women's and men's life expectancy and the public-transport share of commuters.
//  - Filosofi covers metropolitan France and La Réunion only: the other overseas départements stay null.
//  - Unemployment: metropolitan départements have localised ILO rates; overseas départements only the survey-based
//    ILO rate (same concept, different series) and Mayotte none. The series (idbank, title) is kept per département.
//  - Population at 1 January 2023 is the reference used as `pop` (definitive, aligned with the 2023 census
//    populations the communes use); later provisional years are stored for other prefills' denominators.
import { rawStore } from '#sdk'
import { fetchJsonOnce, fetchOnceStored, POPULATIONS, regionNames, withCityJurisdictions, DEP_TO_MAP, DEPS } from '../../lib/fr.mjs'
import { COMMUNE_NAMES } from '../../places.js'
import { FILES, populationByYear, communePopulations, filosofi, lifeExpectancy, commuting, unemployment } from './parse.mjs'

const POP_REFERENCE_YEAR = 2023

const PROVIDERS = {
  pop: 'FRA/insee-population', unemployment: 'FRA/insee-unemployment',
  lifeExp: 'FRA/insee-mortality', lifeExpWomen: 'FRA/insee-mortality', lifeExpMen: 'FRA/insee-mortality',
  povertyRelative: 'FRA/insee-filosofi', transitCommute: 'FRA/insee-census',
}

export async function prefill({ log }) {
  const raw = rawStore('FRA', 'insee')
  const files = {}
  for (const [key, f] of Object.entries(FILES)) files[key] = key === 'unemployment' ? await fetchOnceStored(raw, f.url, { name: f.name }) : await fetchJsonOnce(raw, f.url, f.name)
  files.populations = await fetchOnceStored(raw, POPULATIONS.url, { name: POPULATIONS.name, note: 'reference populations of every commune: weights of the Géorisques prefill' })
  const json = (k) => JSON.parse(files[k].text)

  const population = populationByYear(json('population'))
  const communes = communePopulations(json('communes'))
  const pov = filosofi(json('filosofi'))
  const life = lifeExpectancy(json('mortality'))
  const com = commuting(json('commuting'))
  const unemp = await unemployment(files.unemployment.text)

  const region = {}
  for (const id of DEPS.map((d) => DEP_TO_MAP[d])) {
    region[id] = {
      pop: population[id]?.[POP_REFERENCE_YEAR] ?? null,
      unemployment: unemp.region[id]?.unemployment ?? null,
      lifeExp: life.region[id]?.lifeExp ?? null, lifeExpWomen: life.region[id]?.lifeExpWomen ?? null, lifeExpMen: life.region[id]?.lifeExpMen ?? null,
      povertyRelative: pov.region[id]?.povertyRelative ?? null,
      transitCommute: com.region[id]?.transitCommute ?? null,
    }
  }
  const subregion = {}
  for (const code of Object.keys(COMMUNE_NAMES)) {
    subregion[code] = { povertyRelative: pov.subregion[code]?.povertyRelative ?? null, transitCommute: com.subregion[code]?.transitCommute ?? null }
  }
  const n = (o) => Object.values(o).filter((v) => v != null).length
  log(`${Object.keys(region).length} départements: unemployment ${n(Object.values(region).map((r) => r.unemployment))} (${unemp.year}), life expectancy ${n(Object.values(region).map((r) => r.lifeExp))} (${life.year}${life.status[life.year] === 'PROV' ? ', provisional' : ''}), relative poverty ${n(Object.values(region).map((r) => r.povertyRelative))} (${pov.year}), commuting ${n(Object.values(region).map((r) => r.transitCommute))} (${com.year}); ${Object.keys(subregion).length} communes (municipal population ${Object.values(communes)[0]?.year})`)

  return {
    schema: 1,
    country: 'FRA',
    providers: PROVIDERS,
    generatedAt: new Date().toISOString(),
    period: { latest: Math.max(unemp.year, life.year), population: POP_REFERENCE_YEAR, unemployment: unemp.year, lifeExpectancy: `${life.year}${life.status[life.year] === 'PROV' ? ' (provisional)' : ''}`, filosofi: pov.year, census: com.year },
    origin: {
      files: [
        { ...files.population.ref, note: `pop: persons at 1 January ${POP_REFERENCE_YEAR} (localised population estimates; ${population.status[POP_REFERENCE_YEAR] || 'definitive'})` },
        { ...files.communes.ref, note: 'municipal populations of the tracked communes (populations légales): places.js' },
        { ...files.filosofi.ref, note: `povertyRelative: % of persons below 60 % of the median standard of living (Filosofi ${pov.year}; metropolitan France and La Réunion)` },
        { ...files.mortality.ref, note: `lifeExp: mean of the published women's and men's life expectancy at birth, ${life.year}${life.status[life.year] === 'PROV' ? ' (provisional)' : ''}` },
        { ...files.commuting.ref, note: `transitCommute: employed residents aged 15+ whose main mode of transport to work is public transport, census ${com.year} (France excluding Mayotte)` },
        { ...files.unemployment.ref, note: `unemployment: ILO rate, ${unemp.year} annual average (localised rates; survey-based overseas, none for Mayotte)` },
        { ...files.populations.ref, note: 'reference populations of every commune (weights of the Géorisques prefill)' },
      ],
      notes: 'INSEE open APIs (api.insee.fr Melodi and BDM), fetched once; INSEE Open Licence 2.0. Each value cites its provider (providers).',
    },
    values: withCityJurisdictions({ values: { region, subregion } }).values,
    names: { subregion: COMMUNE_NAMES, region: regionNames() },
  }
}
