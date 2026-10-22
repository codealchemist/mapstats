// Géorisques zoning table + GASPAR records → seismic zone and exposure classes per commune, population-weighted per
// département. Pure: the test runs the rules on inline records.
//
// Rules:
//  - A département's seismic zone is the population-weighted mean of its communes' zones (1–5); cities carry their
//    commune's zone. The indicator shows zone − 1 on the shared 0–4 scale.
//  - Flood exposure class per commune, 1–5, from the number of distinct flood CatNat events since FLOOD_SINCE
//    (arrêtés whose risk starts with "Inondation", one per commune and event start date): 0 → 1, 1–3 → 2, 4–7 → 3,
//    8–12 → 4, 13+ → 5; an approved (opposable) flood PPR raises it to at least 3.
//  - Forest-fire exposure class per commune, 1–5: 1 unless the DDRM lists forest fire (3), a PPRif is prescribed (4)
//    or approved (5).
//  - Département classes are population-weighted means of commune classes (1 decimal), with the share of population
//    living in exposed communes kept alongside. These classes are MapStats estimates built on administrative records.
import { communeOf, depOf, DEP_TO_MAP, round, withCityJurisdictions } from '../../lib/fr.mjs'

export const FLOOD_SINCE = 2000
export const PPRIF = ['none', 'prescribed', 'approved']

export const floodClass = (events) => (events === 0 ? 1 : events <= 3 ? 2 : events <= 7 ? 3 : events <= 12 ? 4 : 5)
export const fireClass = (pprif, listed) => (pprif === 2 ? 5 : pprif === 1 ? 4 : listed ? 3 : 1)

/** Zoning table rows (dbf: insee, Sismicite "4 - Moyenne") → Map commune → zone 1–5. */
export function zonesFrom(rows) {
  const zone = new Map()
  for (const r of rows) { const z = +String(r.Sismicite ?? '')[0]; if (z) zone.set(r.insee, z) }
  return zone
}

/** Distinct flood CatNat events per commune since `since`: Map commune → Set of start dates. */
export function floodEventsFrom(rows, since = FLOOD_SINCE) {
  const events = new Map()
  let used = 0
  for (const r of rows) {
    if (!/^Inondation/.test(r.lib_risque_jo || '') || +String(r.date_debut || '').slice(0, 4) < since) continue
    used++
    const c = communeOf(r.code_commune)
    if (!events.has(c)) events.set(c, new Set())
    events.get(c).add(String(r.date_debut).slice(0, 10))
  }
  return { events, used }
}

/** Communes listed for forest fire in their DDRM. */
export const ddrmFireFrom = (rows) => new Set(rows.filter((r) => r.lib_risque === 'Feu de forêt').map((r) => communeOf(r.cod_commune)))

/** Risk prevention plans → { ppri: Set of communes with an approved flood PPR, pprif: Map commune → 0 none, 1 prescribed, 2 approved }. */
export function pprFrom(rows) {
  const ppri = new Set(), pprif = new Map()
  for (const r of rows) {
    const risks = [r['LIBELLE RISQUE 1'], r['LIBELLE RISQUE 2'], r['LIBELLE RISQUE 3']].join('|'), c = communeOf(r['CODE INSEE COMMUNE']), state = r['LIBELLE ETAT']
    if (state === 'Opposable' && (r['CODE MODELE'] === 'PPRN-I' || /Inondation/.test(risks))) ppri.add(c)
    if (r['CODE MODELE'] === 'PPRN-IF' || /Feu de for/.test(risks)) {
      const rank = state === 'Opposable' ? 2 : state === 'Prescrit' ? 1 : 0
      if (rank > (pprif.get(c) ?? -1)) pprif.set(c, rank)
    }
  }
  return { ppri, pprif }
}

/** One commune's records → its zone and classes. */
export function classes(c, { zone, floodEvents, ppri, ddrmFire, pprif }) {
  const events = floodEvents.get(c)?.size ?? 0
  return {
    zone: zone.get(c) ?? null,
    floodEvents: events, ppri: ppri.has(c), flood: Math.max(floodClass(events), ppri.has(c) ? 3 : 1),
    fireListed: ddrmFire.has(c), pprif: PPRIF[pprif.get(c) ?? 0], fire: fireClass(pprif.get(c), ddrmFire.has(c)),
  }
}

/** Population-weighted aggregation over every commune of each département: { regionId: { seismicZone, seismicZoneMax, … } }. */
export function aggregate(pop, lookups) {
  const acc = {}
  for (const [c, p] of pop) {
    const id = DEP_TO_MAP[depOf(c)]
    if (!id || !p) continue
    const a = (acc[id] ||= { pop: 0, communes: 0, zonePop: 0, zoneSum: 0, zoneMax: 0, floodSum: 0, floodPop: 0, fireSum: 0, firePop: 0 })
    const k = classes(c, lookups)
    a.pop += p
    a.communes++
    if (k.zone) { a.zonePop += p; a.zoneSum += p * k.zone; a.zoneMax = Math.max(a.zoneMax, k.zone) }
    a.floodSum += p * k.flood
    if (k.floodEvents) a.floodPop += p
    a.fireSum += p * k.fire
    if (k.fireListed) a.firePop += p
  }
  return Object.fromEntries(Object.entries(acc).map(([id, a]) => [id, {
    communes: a.communes, pop: a.pop,
    seismicZone: a.zonePop ? round(a.zoneSum / a.zonePop) : null, seismicZoneMax: a.zoneMax || null, zoningCoverage: round(a.zonePop / a.pop, 3),
    floodExposure: round(a.floodSum / a.pop, 1), floodExposedShare: round((100 * a.floodPop) / a.pop, 1),
    fireExposure: round(a.fireSum / a.pop, 1), fireListedShare: round((100 * a.firePop) / a.pop, 1),
  }]))
}

// French zones run 1–5; the shared indicator uses a 0–4 scale.
const seismic = (zone) => (zone == null ? null : round(zone - 1, 1))

/** Département aggregates + the tracked communes' classes → the dataset's parts. */
export function toValues({ departments, communes }, { names = {}, communeNames = {} } = {}) {
  const parts = { values: { region: {}, subregion: {} }, names: { region: {}, subregion: {} }, details: { region: {}, subregion: {} } }
  for (const id of Object.values(DEP_TO_MAP)) {
    const d = departments[id]
    parts.values.region[id] = { seismicZone: seismic(d?.seismicZone), floodExposure: d?.floodExposure ?? null, fireExposure: d?.fireExposure ?? null }
    if (d) parts.details.region[id] = d
    if (names[id]) parts.names.region[id] = names[id]
  }
  for (const [c, k] of Object.entries(communes)) {
    parts.values.subregion[c] = { seismicZone: seismic(k.zone), floodExposure: k.flood, fireExposure: k.fire }
    parts.details.subregion[c] = k
    if (communeNames[c]) parts.names.subregion[c] = communeNames[c]
  }
  return withCityJurisdictions(parts)
}
