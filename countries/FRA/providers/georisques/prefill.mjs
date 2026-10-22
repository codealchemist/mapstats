// Prefill for Géorisques / GASPAR → countries/FRA/data/georisques.json.
//
//   npm run prefill -- FRA --provider georisques
//
// Downloaded once into raw/: the national seismic zoning table (shapefile zip on data.gouv.fr; only the .dbf attribute
// table is read, the geometry is ignored), the GASPAR export (zip of CSVs, files.georisques.fr) and the Géorisques
// zoning API answer for the tracked communes (20 per call; the current official zoning, used to cross-check the table
// and as the cities' own values). Commune populations come from the INSEE provider's stored reference-population file.
import { rawStore } from '#sdk'
import { communePopulations, fetchJsonOnce, fetchOnceStored, dbfRows, looseCsv, regionNames, zipEntry, zipEntryNames } from '../../lib/fr.mjs'
import { COMMUNE_NAMES } from '../../places.js'
import { zonesFrom, floodEventsFrom, ddrmFireFrom, pprFrom, classes, aggregate, toValues, FLOOD_SINCE } from './parse.mjs'
import { ZONING, GASPAR } from './provider.js'

const ZONING_URL = 'https://static.data.gouv.fr/resources/zonage-sismique-de-la-france-1/20180730-100725/France_zonage_sismique.zip'
const GASPAR_URL = 'http://files.georisques.fr/GASPAR/gaspar.zip'
const API = 'https://www.georisques.gouv.fr/api/v1/zonage_sismique'
const COMMUNES = Object.keys(COMMUNE_NAMES)

export async function prefill({ log }) {
  const raw = rawStore('FRA', 'georisques')
  const zoning = await fetchOnceStored(raw, ZONING_URL)
  const gaspar = await fetchOnceStored(raw, GASPAR_URL)
  const pages = Array.from({ length: Math.ceil(COMMUNES.length / 20) }, (_, i) => `${API}?code_insee=${COMMUNES.slice(i * 20, i * 20 + 20).join(',')}&page_size=100`)
  const api = await fetchJsonOnce(raw, pages, 'zonage-sismique-communes.json', { items: 'data' })
  const { pop, year: popYear, ref: popRef } = await communePopulations()

  // Seismic zone per commune: the national table (2018 geography), overridden by the API for the tracked communes.
  const zone = zonesFrom(dbfRows(zipEntry(zoning.path, /\.dbf$/).data))
  let mismatches = 0
  for (const c of JSON.parse(api.text).data) {
    const z = +c.code_zone
    if (zone.has(c.code_insee) && zone.get(c.code_insee) !== z) { mismatches++; log(`zone differs for ${c.code_insee} ${c.libelle_commune}: table ${zone.get(c.code_insee)}, API ${z}`) }
    zone.set(c.code_insee, z)
  }
  log(`seismic zoning: ${zone.size} communes in the table, ${JSON.parse(api.text).data.length} checked against the API (${mismatches} differ)`)

  const csv = (re) => { const { rows, realigned, dropped } = looseCsv(zipEntry(gaspar.path, re).text()); if (realigned || dropped) log(`${re}: ${realigned} rows with an extra separator realigned, ${dropped} too short dropped`); return rows }
  const { events: floodEvents, used } = floodEventsFrom(csv(/^catnat_/))
  const ddrmFire = ddrmFireFrom(csv(/^ddrm_risq_/))
  const { ppri, pprif } = pprFrom(csv(/^pprn_/))
  const lookups = { zone, floodEvents, ppri, ddrmFire, pprif }
  let unknownEvents = 0
  for (const c of floodEvents.keys()) if (!pop.has(c)) unknownEvents += floodEvents.get(c).size
  log(`flood events since ${FLOOD_SINCE}: ${used} rows, ${floodEvents.size} communes (${unknownEvents} events on commune codes absent from the ${popYear} population file); forest fire listed in ${ddrmFire.size} communes, PPRif in ${pprif.size}, approved PPRi in ${ppri.size}`)

  const departments = aggregate(pop, lookups)
  const communes = Object.fromEntries(COMMUNES.map((c) => [c, { pop: pop.get(c) ?? null, ...classes(c, lookups) }]))
  const gasparDate = zipEntryNames(gaspar.path).map((n) => n.match(/(\d{4}-\d\d-\d\d)\.csv$/)?.[1]).find(Boolean) || null
  const covered = Object.values(departments).filter((d) => d.seismicZone != null).length
  log(`${Object.keys(departments).length} départements (${covered} with a seismic zone), ${COMMUNES.length} communes`)

  return {
    ...toValues({ departments, communes }, { names: regionNames(), communeNames: COMMUNE_NAMES }),
    period: { latest: +(gasparDate || new Date().toISOString()).slice(0, 4), gaspar: gasparDate, zoning: 'in force since 2011 (décrets 2010-1255 and 2015-5)', population: popYear },
    origin: {
      files: [
        { ...zoning.ref, note: `regulatory seismic zoning by commune (${ZONING})` },
        { ...gaspar.ref, note: `GASPAR export of ${gasparDate}: catnat, ddrm_risq and pprn tables (${GASPAR})` },
        { ...api.ref, note: 'zoning API answer for the tracked communes (cross-check)' },
        { ...popRef, note: 'population weights: INSEE reference populations of every commune (providers/insee)' },
      ],
      notes: 'official downloads from data.gouv.fr and files.georisques.fr (Licence Ouverte), zoning API of georisques.gouv.fr; exposure classes are MapStats estimates built on the records (parse.mjs); population weights from INSEE reference populations',
    },
  }
}
