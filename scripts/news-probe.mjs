// npm run news:probe [-- "Tandil" "Buenos Aires"] [-- --outlets-only]
// Output is also saved to logs/news-probe-latest.log (+ a timestamped copy) and the structured
// results to logs/news-probe-latest.json, so they can be read back without copy-pasting.
// Run from a machine with internet access (no Netlify needed; in-memory cache):
//   1. the real news pipeline for one place;
//   2. health of every VERIFIED (pinned) outlet feed;
//   3. a diagnosis of every CANDIDATE outlet, with the line to paste into VERIFIED when a feed works;
//   4. provinces that rely on Google News only.
import fs from 'node:fs'
import path from 'node:path'
import { getNews } from '../netlify/news/service.mjs'
import { memoryStore } from '../netlify/news/cache.mjs'
import { VERIFIED, FEED_PATHS, ARG_REGIONS, candidateHomes } from '../netlify/news/outlets.mjs'
import { parseFeed, discoverFeeds } from '../netlify/news/rss.mjs'
import { robotsAllows } from '../netlify/news/robots.mjs'
import { fold, newsQuery } from '../src/lib/news.js'
import { newsSettings } from '../src/data/countries.js'
import { googleNewsItems } from '../netlify/news/googleNews.mjs'
import { relevance } from '../netlify/news/rank.mjs'
import { Deadline } from '../netlify/news/http.mjs'

// ---------- log files: everything printed is also appended to the log as it happens ----------
const LOG_DIR = path.resolve('logs')
fs.mkdirSync(LOG_DIR, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const LOG = path.join(LOG_DIR, `news-probe-${stamp}.log`)
const LATEST = path.join(LOG_DIR, 'news-probe-latest.log')
const JSON_OUT = path.join(LOG_DIR, 'news-probe-latest.json')
for (const f of [LOG, LATEST]) fs.writeFileSync(f, '')
for (const level of ['log', 'warn', 'error']) {
  const orig = console[level].bind(console)
  console[level] = (...a) => {
    orig(...a)
    const line = a.map((x) => (typeof x === 'string' ? x : x instanceof Error ? x.stack : JSON.stringify(x))).join(' ') + '\n'
    for (const f of [LOG, LATEST]) fs.appendFileSync(f, line)
  }
}
const report = { startedAt: new Date().toISOString(), node: process.version, pipeline: null, verified: [], candidates: [], coverage: null, error: null }
const saveJson = () => fs.writeFileSync(JSON_OUT, JSON.stringify({ ...report, finishedAt: new Date().toISOString() }, null, 2))
process.on('uncaughtException', (e) => { console.error('probe crashed:', e); report.error = String(e?.stack || e); saveJson(); process.exit(1) })

const args = process.argv.slice(2)
const outletsOnly = args.includes('--outlets-only')
const [place = 'Tandil', region = 'Buenos Aires'] = args.filter((a) => !a.startsWith('--'))
const OUR_UA = process.env.NEWS_USER_AGENT || 'Mozilla/5.0 (compatible; MapStatsNews/1.0; +https://github.com/mapstats)'
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36'
const CRIME = /polic|robo|asalt|homicid|crimen|delit|insegur|detenid|tirote|narco|seguridad/i

// Raw fetch for diagnostics: keeps status, type and errors (the service's fetch hides them).
async function probe(url, ua = OUR_UA, timeoutMs = 8000) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs), headers: { 'User-Agent': ua, Accept: '*/*', 'Accept-Language': 'es-AR,es;q=0.9' } })
    const text = await res.text()
    return { status: res.status, type: res.headers.get('content-type') || '', text, url: res.url }
  } catch (e) {
    return { status: 0, error: e.name === 'TimeoutError' ? 'timeout' : e.cause?.code || e.message, text: '' }
  }
}
const challenge = (r) => /cf-chl|just a moment|captcha|attention required|access denied/i.test(r.text.slice(0, 5000))
const feedInfo = (text) => {
  const items = parseFeed(text)
  const newest = items.map((i) => Date.parse(i.publishedAt)).filter(Number.isFinite).sort((a, b) => b - a)[0]
  return { items: items.length, newestDays: newest ? Math.round((Date.now() - newest) / 86_400_000) : null, crime: items.filter((i) => CRIME.test(`${i.title} ${i.description}`)).length }
}

// ---------- 1. pipeline ----------
if (!outletsOnly) {
  console.log(`\n== News for ${place} (${region})`)
  const t0 = Date.now()
  const r = await getNews({ place, region, type: 'city', countryIso3: 'ARG' }, { store: memoryStore(), budgetMs: 8000 })
  console.log(`status ${r.status} in ${Date.now() - t0} ms · query: ${r.query}`)
  for (const a of r.articles || []) console.log(`• ${a.title}\n  ${a.source} · ${a.via} · ${a.url}\n  ${a.excerpt ? a.excerpt.slice(0, 160) + '…' : a.note}`)
  if (r.error) console.log('error:', r.error)
  report.pipeline = { place, region, ms: Date.now() - t0, ...r }
  saveJson()
}

// ---------- 1b. scoped vs place-only Google News search ----------
// The service searches "place" "province" "country" first and falls back to the place-only search
// when that finds fewer than 3 articles. This compares both on a few cities.
if (!outletsOnly) {
  console.log('\n== Google News: place + province + country vs place only (relevant / total items)')
  const SAMPLE = [['Tandil', 'Buenos Aires'], ['Lomas de Zamora', 'Buenos Aires'], ['Rosario', 'Santa Fe'], ['Merlo', 'San Luis'], ['San Carlos de Bariloche', 'Río Negro'], ['Ushuaia', 'Tierra del Fuego'], [place, region]]
  const settings = newsSettings('ARG')
  report.queryComparison = []
  for (const [name, prov] of [...new Map(SAMPLE.map((x) => [x.join('|'), x])).values()]) {
    const entity = { name, provinceName: prov, type: 'city' }
    const count = async (q) => {
      const items = await googleNewsItems(q, 'AR', { deadline: new Deadline(10000), fetchImpl: fetch })
      return { total: items.length, relevant: items.filter((it) => relevance(it, { place: name, region: prov }) > 0).length }
    }
    const scoped = await count(newsQuery(entity, settings))
    const loose = await count(newsQuery(entity, settings, new Set(), { scope: false })) // ambiguous names get their province via the built-in list
    console.log(`${name.padEnd(26)} scoped ${String(scoped.relevant).padStart(3)} / ${String(scoped.total).padEnd(4)} place-only ${String(loose.relevant).padStart(3)} / ${loose.total}${scoped.relevant < 3 ? '   → fallback would run' : ''}`)
    report.queryComparison.push({ name, province: prov, scoped, placeOnly: loose })
    await new Promise((r) => setTimeout(r, 1200)) // be gentle with Google
  }
  saveJson()
}

// ---------- 2. verified feeds (+ crime-section feeds) ----------
// General "latest news" feeds carry few crime stories; many CMSs also publish per-section feeds.
const SECTION_PATHS = [
  '/policiales/feed', '/policiales/feed/', '/category/policiales/feed/', '/seccion/policiales/feed', '/secciones/policiales/feed',
  '/rss/policiales', '/rss/policiales.xml', '/policiales/rss', '/feed/policiales', '/rss/seccion/policiales',
  '/arc/outboundfeeds/rss/category/policiales/?outputType=xml', '/arc/outboundfeeds/rss/category/sucesos/?outputType=xml',
  '/seguridad/feed', '/category/seguridad/feed/', '/rss/seguridad', '/sucesos/feed', '/rss/sucesos',
]
const STALE_DAYS = 30
const isFeed = (r) => (r.status === 200 && /xml|rss|atom/i.test(r.type + r.text.slice(0, 200)) ? feedInfo(r.text) : null)

// A crime-section feed on the site: ≥ 30 % crime-related items and fresh.
async function sectionFeed(base) {
  let best = null
  for (let i = 0; i < SECTION_PATHS.length; i += 6) {
    const batch = await Promise.all(SECTION_PATHS.slice(i, i + 6).map(async (path) => ({ path, r: await probe(base + path, OUR_UA, 6000) })))
    for (const { path, r } of batch) {
      const info = isFeed(r)
      if (info?.items && info.crime / info.items >= 0.3 && (info.newestDays ?? 0) <= STALE_DAYS && (!best || info.crime > best.info.crime)) best = { url: r.url || base + path, info }
    }
    if (best) break
  }
  return best
}

// Feed links on an HTML page (e.g. a /rss "feed directory" page), crime sections first.
function feedLinks(html, base) {
  const out = new Set()
  for (const m of String(html).matchAll(/href=["']([^"'#]+)["']/gi)) {
    if (!/rss|feed|\.xml|atom/i.test(m[1])) continue
    try { out.add(new URL(m[1], base).href) } catch { /* ignore */ }
  }
  return [...out].sort((a, b) => Number(/polic|segur|suces|judic/i.test(b)) - Number(/polic|segur|suces|judic/i.test(a))).slice(0, 12)
}

console.log('\n== Verified outlet feeds (pinned) and crime-section feeds')
await Promise.all(VERIFIED.map(async (o) => {
  const r = await probe(o.feed)
  const info = r.status === 200 ? feedInfo(r.text) : null
  const ok = info?.items > 0
  const stalePinned = ok && (info.newestDays ?? 0) > STALE_DAYS
  const lines = [`${ok && !stalePinned ? '✓' : '✗'} ${o.domain.padEnd(26)} ${ok ? `${info.items} items, newest ${info.newestDays ?? '?'} d old${stalePinned ? ' (STALE — replace this feed)' : ''}, ${info.crime} look crime-related` : `HTTP ${r.status || r.error}${r.status === 429 ? ' (rate limited — retry later)' : r.status === 403 ? ' (refused — blocking automated clients?)' : ''}`}`]
  // Only look for a crime-section feed when the pinned feed is not already one (or has gone stale).
  const pinnedIsSection = ok && !stalePinned && info.crime / info.items >= 0.3
  const found = pinnedIsSection ? null : await sectionFeed(`https://www.${o.domain}`)
  const best = found && found.url.replace(/\.xml$|\/$/, '') !== o.feed.replace(/\.xml$|\/$/, '') ? found : null
  if (best) lines.push(`    crime-section feed: ${best.url} (${best.info.items} items, ${best.info.crime} crime-related) → use as feed: '${best.url}'`)
  o.report = lines.join('\n')
  report.verified.push({ domain: o.domain, feed: o.feed, status: r.status || r.error, ...(info || {}), sectionFeed: best ? { url: best.url, ...best.info } : null })
}))
VERIFIED.forEach((o) => console.log(o.report))
report.verified.sort((a, b) => a.domain.localeCompare(b.domain))
saveJson()

// ---------- 3. candidates ----------
console.log('\n== Candidate outlets (not used at runtime) — diagnosis')
const results = await Promise.all(candidateHomes().map(async (o) => {
  const lines = []
  const ours = await probe(o.home)
  const browser = ours.status === 200 && !challenge(ours) ? ours : await probe(o.home, BROWSER_UA)
  const homeOk = ours.status === 200 && !challenge(ours)
  if (!homeOk) {
    lines.push(`homepage with our user agent: ${ours.status || ours.error}${challenge(ours) ? ' (bot challenge page)' : ''}; with a browser user agent: ${browser.status || browser.error}${challenge(browser) ? ' (bot challenge page)' : ''}`)
    if (browser.status === 200 && !challenge(browser)) lines.push('→ the site blocks automated clients; respecting that, it should stay out (or contact the outlet)')
    if (/ENOTFOUND/.test(String(ours.error))) lines.push('→ domain does not resolve — remove it or fix the domain')
  }
  const robots = await probe(new URL('/robots.txt', o.home).href)
  if (robots.status === 200 && !robotsAllows(robots.text, '/')) lines.push('robots.txt disallows automated access to the site')
  const page = homeOk ? ours : browser
  const advertised = page.status === 200 ? discoverFeeds(page.text, page.url || o.home) : []
  const base = page.url || o.home
  const tries = [...advertised, ...FEED_PATHS.map((p) => new URL(p, base).href)]
  let found = null
  const statuses = []
  const pages = [] // 200 HTML answers on feed paths: possibly a page listing the site's feeds
  const consider = (u, r) => {
    const info = isFeed(r)
    if (info?.items) {
      // Prefer fresh feeds, then those with more crime stories.
      const better = !found || ((info.newestDays ?? 0) <= STALE_DAYS && ((found.info.newestDays ?? 0) > STALE_DAYS || info.crime > found.info.crime))
      if (better) found = { url: r.url || u, info }
    } else {
      statuses.push(`${new URL(u).pathname}${new URL(u).search} ${r.status || r.error}`)
      if (r.status === 200 && /html/i.test(r.type)) pages.push({ u, r })
    }
  }
  for (let i = 0; i < tries.length && !(found && (found.info.newestDays ?? 0) <= STALE_DAYS); i += 5) {
    const batch = await Promise.all(tries.slice(i, i + 5).map(async (u) => ({ u, r: await probe(u, OUR_UA, 6000) })))
    batch.forEach(({ u, r }) => consider(u, r))
  }
  // Follow feed links on feed-directory pages (/rss answering with an HTML index of feeds).
  if (!found || (found.info.newestDays ?? 0) > STALE_DAYS) {
    const links = [...new Set(pages.flatMap(({ u, r }) => feedLinks(r.text, r.url || u)))].filter((l) => !tries.includes(l)).slice(0, 12)
    if (links.length) lines.push(`feed directory page found, following ${links.length} links`)
    for (let i = 0; i < links.length; i += 6) {
      const batch = await Promise.all(links.slice(i, i + 6).map(async (u) => ({ u, r: await probe(u, OUR_UA, 6000) })))
      batch.forEach(({ u, r }) => consider(u, r))
    }
  }
  // A dedicated crime-section feed beats a general one.
  const section = found && found.info.crime / found.info.items < 0.3 ? await sectionFeed(new URL(base).origin) : null
  if (section) found = section
  const stale = found && (found.info.newestDays ?? 0) > STALE_DAYS
  if (o.note) lines.unshift(`previous probe: ${o.note}`)
  if (found && !stale) {
    lines.push(`feed found: ${found.url} (${found.info.items} items, newest ${found.info.newestDays ?? '?'} d, ${found.info.crime} crime-related)`)
    lines.push(`→ add to VERIFIED: { domain: '${o.domain}', feed: '${found.url}', regions: ${JSON.stringify(o.regions)}, cities: ${JSON.stringify(o.cities)} },`)
  } else {
    if (stale) lines.push(`only a stale feed: ${found.url} (newest item ${found.info.newestDays} days old) — not suitable`)
    if (homeOk && /ENOTFOUND/.test(statuses.join(' '))) lines.push('domain does not resolve — remove it')
    lines.push(`advertised feeds: ${advertised.length ? advertised.join(', ') : 'none'}`)
    lines.push(`tried paths: ${statuses.slice(0, 8).join(' · ')}${statuses.length > 8 ? ` · …${statuses.length - 8} more` : ''}`)
  }
  if (stale) found = null
  return { o, found, lines }
}))
for (const { o, found, lines } of results) {
  console.log(`${found ? '✓' : '✗'} ${o.domain}`)
  lines.forEach((l) => console.log(`    ${l}`))
}

// ---------- 4. coverage ----------
const covered = new Set(VERIFIED.flatMap((o) => o.regions))
const missing = ARG_REGIONS.filter((r) => !covered.has(fold(r)))
report.candidates = results.map(({ o, found, lines }) => ({ domain: o.domain, regions: o.regions, cities: o.cities, feed: found ? { url: found.url, ...found.info } : null, notes: lines }))
report.coverage = { verified: VERIFIED.length, candidatesWithFeed: results.filter((r) => r.found).length, googleNewsOnly: missing }
saveJson()
console.log(`\n== Coverage\n${VERIFIED.length} verified outlets · ${results.filter((r) => r.found).length} candidates now have a working feed`)
console.log(`Provinces relying on Google News only: ${missing.length ? missing.join(', ') : 'none'}`)
console.log(`\nSaved: ${path.relative(process.cwd(), LATEST)} (also ${path.basename(LOG)}) and ${path.relative(process.cwd(), JSON_OUT)}`)
