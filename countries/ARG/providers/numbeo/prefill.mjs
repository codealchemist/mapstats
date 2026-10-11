// Prefill for Numbeo in Argentina → countries/ARG/data/numbeo.json, from the hand-entered snapshot
// (snapshot.json), values copied by hand (manual.json) and locally stored Numbeo pages (npm run numbeo:fetch).
// Never touches the network: safe to run as often as you like.
//
//   npm run numbeo:build
import fs from 'node:fs'
import { CITIES } from '../../places.js'
import { toDataset } from './dataset.mjs'
import { fold, parseCityCrime, parseCountryTable } from './parse.mjs'
import { loadManifest, readPage } from './store.mjs'

const MANUAL = new URL('./manual.json', import.meta.url)
const SNAPSHOT = new URL('./snapshot.json', import.meta.url)

export const COUNTRY_TABLES = ['/quality-of-life/country_result.jsp?country=Argentina', '/crime/country_result.jsp?country=Argentina']
export const cityPath = (slug) => `/crime/in/${slug}`

// Numbeo names that differ from ours.
const ALIASES = { 'bariloche': 'ARG-bariloche', 'san miguel de tucuman': 'ARG-tucuman', 'tucuman': 'ARG-tucuman', 'catamarca': 'ARG-catamarca', 'jujuy': 'ARG-jujuy', 'oran': 'ARG-oran' }
const byName = Object.fromEntries(CITIES.map((c) => [fold(c.name), c.id]))
export const matchCity = (name) => {
  const key = fold(name).replace(/,\s*argentina$/, '')
  return ALIASES[key] || byName[key] || null
}

const day = (iso) => iso?.slice(0, 10) || null
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v != null))

export async function prefill({ log = console.log } = {}) {
  const m = loadManifest()
  const cities = new Map()
  const upsert = (slug, data) => cities.set(slug, { ...(cities.get(slug) || { slug }), ...clean(data) })

  for (const p of COUNTRY_TABLES) {
    const html = readPage(m, p)
    if (html) parseCountryTable(html).filter((r) => r.slug).forEach((r) => upsert(r.slug, { ...r, fetchedAt: day(m.pages[p].fetchedAt) }))
  }
  for (const [p, e] of Object.entries(m.pages)) {
    if (!p.startsWith('/crime/in/') || e.status !== 'ok') continue
    const crime = parseCityCrime(readPage(m, p) || '')
    if (!crime?.inArgentina) continue
    delete crime.inArgentina
    const slug = p.slice('/crime/in/'.length)
    upsert(slug, { ...crime, name: cities.get(slug)?.name || crime.name, fetchedAt: day(e.fetchedAt) })
  }

  // Hand-entered values (e.g. copied from a page by hand) fill in only where nothing was scraped.
  const manual = fs.existsSync(MANUAL) ? JSON.parse(fs.readFileSync(MANUAL, 'utf8')).cities : []
  const out = new Map(manual.map((c) => [c.slug, c]))
  for (const r of cities.values()) {
    if (r.crimeIndex == null && r.qualityOfLife == null) continue
    out.set(r.slug, { ...r, cityId: matchCity(r.name || r.slug), source: 'scraped' })
  }

  const result = { source: 'https://www.numbeo.com', builtFrom: 'data/numbeo (local store)', cities: [...out.values()].sort((a, b) => a.slug.localeCompare(b.slug)) }
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')).cities
  const unmatched = result.cities.filter((c) => !c.cityId).map((c) => c.name || c.slug)
  log(`${snapshot.length} snapshot cities, ${result.cities.length} stored (${cities.size} from stored pages, ${manual.length} copied by hand)`)
  if (unmatched.length) log(`Not in MapStats' city list (add coordinates to include them): ${unmatched.join(', ')}`)
  return toDataset({ snapshot, stored: result.cities })
}
