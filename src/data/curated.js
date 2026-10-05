// Registry of countries with curated (non-live) data, keyed by ISO3. Everything country-specific
// that scoring, provenance and the report need goes through this contract; nothing else in the
// app may branch on a country code.
//
//   iso3
//   regions      map region id (properties.id in public/geo) -> { indicatorId: value }, pop in persons
//   cities       curated city list, or null to use the Natural Earth list. Each city: { id, name,
//                province, lat, lon, pop, capital?, ownValues?, official?, numbeo fields… }
//   sources      indicatorId -> SOURCES key, for every non-live, non-Numbeo indicator the country
//                provides. Indicators missing here are "not available" for the country.
//   periods      indicatorId -> reference period shown next to the value ("EPH 2024")
//   subregion    { label } — the finer official unit cities may carry ("Department (partido)")
//   official     family id -> statistical series dataset:
//                { key, label, years, latestYear, origin, metrics: { k: { label, unit, digits, chart?: [title, subtitle] } },
//                  table: [k], tableLabel, national: block, regions: { regionId: block }, levelNote, footnote, note }
//                where a block is { name, latestYear, latest: {k}, counts: {k}, avg3: {k}, series: {k: []} }.
//                A family without `metrics`/`regions` but with `latestYear` only declares its reference
//                period (used for the recency weight).
//   methodology  sentences for the methodology dialog
import { ARGENTINA } from './argentina.js'
import { FRANCE } from './france.js'

export const CURATED = { ARG: ARGENTINA, FRA: FRANCE }

export const curatedFor = (iso3) => CURATED[iso3] || null
