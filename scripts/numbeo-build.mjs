// Builds src/data/numbeo-argentina.json from locally stored Numbeo pages.
// Never touches the network: safe to run as often as you like.
//
//   npm run numbeo:build
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { CITIES } from '../src/data/argentina.js'
import { fold, parseCityCrime, parseCountryTable } from './numbeo/parse.mjs'
import { loadManifest, readPage } from './numbeo/store.mjs'

const OUT = path.resolve('src/data/numbeo-argentina.json')
const MANUAL = path.resolve('src/data/numbeo-manual.json')

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

export function build({ quiet = false } = {}) {
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
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n')
  if (!quiet) {
    const unmatched = result.cities.filter((c) => !c.cityId).map((c) => c.name || c.slug)
    console.log(`Wrote ${result.cities.length} cities to ${path.relative(process.cwd(), OUT)} (${cities.size} from stored pages, ${manual.length} manual)`)
    if (unmatched.length) console.log(`Not in MapStats' city list (add coordinates to include them): ${unmatched.join(', ')}`)
  }
  return result
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) build()
