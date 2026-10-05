// One-time Numbeo download for Argentina. Every page is requested at most once:
// results (including misses) are stored permanently in data/numbeo, and later
// runs only fetch URLs that were never requested. The app never calls Numbeo.
//
//   npm run numbeo:fetch                       # fetch what's missing, then build
//   npm run numbeo:fetch -- --dry-run          # list what would be requested
//   npm run numbeo:fetch -- --only Lomas-de-Zamora-Argentina
//   npm run numbeo:fetch -- --probe            # also guess pages for our cities missing from Numbeo's tables
//   npm run numbeo:fetch -- --refresh          # re-download stored pages (refused within 90 days of the last run)
//
// Requests: robots.txt honoured, one at a time, 5 s apart, capped per run
// (--max, default 60), stops at the first 403/429. Numbeo's terms restrict
// automated collection and republication; check them (or use the Numbeo API) first.
import { CITIES } from '../src/data/argentina.js'
import { parseCountryTable, robotsAllows } from './numbeo/parse.mjs'
import { loadManifest, readPage, record, saveManifest } from './numbeo/store.mjs'
import { build, cityPath, COUNTRY_TABLES, matchCity } from './numbeo-build.mjs'

const BASE = process.env.NUMBEO_BASE || 'https://www.numbeo.com'
const UA = 'MapStats/0.1 (one-time personal research download)'
const REFRESH_MIN_DAYS = 90
const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map((a) => a.trim().split(/\s+/)).map(([k, v]) => [k, v ?? true]))
const DELAY = Math.max(2000, +(args.delay || 5000))
const MAX = +(args.max || 60)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ascii = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')

const m = loadManifest()
let requests = 0
let last = 0
let allowed = () => true

// Fetch a page unless it was ever requested before (or --refresh). Returns stored/new HTML or null.
async function once(urlPath) {
  const prev = m.pages[urlPath]
  if (prev && !args.refresh) return readPage(m, urlPath)
  if (!allowed(urlPath)) { record(m, urlPath, 'robots'); console.log(`  robots.txt disallows ${urlPath}`); return null }
  if (requests >= MAX) throw Object.assign(new Error(`Reached --max ${MAX} requests for this run; run again later to continue.`), { soft: true })
  if (args['dry-run']) { console.log(`  would request ${urlPath}`); requests++; return null }
  const wait = last + DELAY - Date.now()
  if (wait > 0) await sleep(wait)
  last = Date.now()
  requests++
  console.log(`  GET ${urlPath}`)
  const res = await fetch(BASE + urlPath, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } })
  if (res.status === 403 || res.status === 429) {
    m.blockedUntil = new Date(Date.now() + 86_400_000).toISOString()
    throw new Error(`Numbeo answered ${res.status}: stopping. No requests will be made before ${m.blockedUntil}.`)
  }
  if (!res.ok) { record(m, urlPath, `http-${res.status}`); return null }
  const html = await res.text()
  record(m, urlPath, 'ok', html)
  saveManifest(m) // persist after every page so an interrupted run never re-requests it
  return html
}

async function main() {
  if (m.blockedUntil && Date.now() < Date.parse(m.blockedUntil) && !args.force) {
    console.log(`Numbeo refused a request earlier; waiting until ${m.blockedUntil} before trying again.`)
    return
  }
  if (args.refresh && m.lastFetchRun) {
    const days = (Date.now() - Date.parse(m.lastFetchRun)) / 86_400_000
    if (days < REFRESH_MIN_DAYS && !args.force) {
      console.log(`Last download was ${Math.floor(days)} days ago; refresh is allowed after ${REFRESH_MIN_DAYS} days (--force to override).`)
      return
    }
  }

  // robots.txt is stored like any other page.
  const robots = await once('/robots.txt').catch(() => null)
  allowed = robotsAllows(robots || '')

  const slugs = new Set()
  if (args.only) slugs.add(String(args.only))
  else {
    for (const p of COUNTRY_TABLES) {
      const html = await once(p)
      if (html) parseCountryTable(html).forEach((r) => r.slug && slugs.add(r.slug))
    }
    // Cities we know the exact Numbeo page for (e.g. Lomas de Zamora).
    CITIES.filter((c) => c.numbeoSlug?.endsWith('-Argentina')).forEach((c) => slugs.add(c.numbeoSlug))
    if (args.probe) {
      const listed = new Set([...slugs].map((s) => matchCity(s.replace(/-Argentina$/, '').replace(/-/g, ' '))))
      CITIES.filter((c) => !listed.has(c.id)).forEach((c) => slugs.add(`${ascii(c.name)}-Argentina`))
    }
  }

  const todo = [...slugs].filter((s) => args.refresh || !m.pages[cityPath(s)])
  console.log(`${slugs.size} city pages known, ${todo.length} not yet downloaded`)
  if (args['dry-run'] && COUNTRY_TABLES.some((p) => !m.pages[p])) console.log('  (plus the city pages listed in the country tables, known once those are downloaded)')
  for (const slug of todo) await once(cityPath(slug))
}

try {
  await main()
} catch (e) {
  console.error(e.message)
  if (!e.soft) process.exitCode = 1
} finally {
  if (requests && !args['dry-run']) m.lastFetchRun = new Date().toISOString()
  if (!args['dry-run']) saveManifest(m)
  console.log(`${requests} request(s) ${args['dry-run'] ? 'would be made' : 'made to Numbeo'} this run.`)
  if (!args['dry-run']) build()
}
