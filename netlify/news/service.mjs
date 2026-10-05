// Orchestrates one /api/news request within Netlify's 10 s limit (free plan, no background work):
//   cache hit (complete, < 24 h)            → return it
//   otherwise discover → pick → enrich       → cache for 24 h from the first fetch
// When the time budget runs out before every picked article is read, the partial result is
// cached with complete:false and the next request continues where this one stopped.
import { newsQuery, fold } from '../../src/lib/news.js'
import { newsSettings, countryByIso } from '../../src/data/countries.js'
import { Deadline, fetchText, hostOf } from './http.mjs'
import { googleNewsItems, decodeGoogleNewsUrl } from './googleNews.mjs'
import { outletItems } from './feeds.mjs'
import { outletsFor } from './outlets.mjs'
import { extractArticle } from './extract.mjs'
import { relevance, storyKey, sameStory } from './rank.mjs'
import { allowedByRobots } from './robots.mjs'
import { createCache, hashKey } from './cache.mjs'

const DAY = 86_400_000
const PICKS = 8
const SHOW = 5
const MIN_SCOPED = 3 // fewer scoped Google News hits than this → also run the place-only search

export async function getNews({ place, region, type, countryIso3, withRegion }, { store, fetchImpl = fetch, now = Date.now, budgetMs = 8000 }) {
  const deadline = new Deadline(budgetMs, now)
  const cache = createCache(store, now)
  const country = countryByIso(countryIso3)
  const settings = newsSettings(country.iso3)
  const entity = { name: place, provinceName: region, type }
  const ambiguous = withRegion ? new Set([fold(place)]) : new Set()
  // Scoped query (place + state + country); the place-only query is the fallback for thin results.
  const query = newsQuery(entity, settings, ambiguous)
  const looseQuery = newsQuery(entity, settings, ambiguous, { scope: false })
  const key = `q/${hashKey(country.iso3, fold(place), fold(region || ''), withRegion ? 1 : 0, type)}`
  const match = { place, region, withRegion }
  const ctx = { cache, deadline, fetchImpl, match }

  const entry = await cache.getEntry(key)
  if (entry?.fresh && entry.value.complete) return publicResult(entry.value, 'cached', entry.expiresAt)

  let state = entry?.fresh ? entry.value : null
  const expiresAt = entry?.fresh ? entry.expiresAt : now() + DAY
  if (!state) {
    // Up to 3 local outlets per request keeps the first (uncached) request inside the time budget.
    const outlets = outletsFor(country.iso3, region, place).slice(0, 3)
    const results = await Promise.all([googleNewsItems(query, country.iso2, ctx), ...outlets.map((o) => outletItems(o, ctx))])
    // Local outlets often never name the province or country, so a scoped search can come back thin:
    // then also run the place-only search (still disambiguated by region when the name is ambiguous).
    const scopedHits = results[0].filter((it) => fold(it.title).includes(fold(place)) || relevance(it, match) > 0).length
    let fallbackUsed = false
    if (scopedHits < MIN_SCOPED && looseQuery !== query && deadline.left() > 4500) {
      results.push(await googleNewsItems(looseQuery, country.iso2, ctx))
      fallbackUsed = true
    }
    const answered = results.some((r) => r.length) // at least one source returned a parseable feed
    const seen = new Set()
    const picks = results.flat()
      .map((it) => ({ ...it, score: relevance(it, match) }))
      // Google News already matched the query in the full text; outlet feeds must match on title/lead.
      .filter((it) => it.score > 0 || (it.via === 'google-news' && fold(it.title).includes(fold(place))))
      .sort((a, b) => b.score - a.score || (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
      .filter((it) => { const k = storyKey(it.title); if (seen.has(k)) return false; seen.add(k); return true })
      .filter((it, i, list) => !list.slice(0, i).some((o) => sameStory(o.title, it.title, place)))
      .slice(0, PICKS)
      .map((it) => ({ title: it.title, source: it.outlet || hostOf(it.link), url: it.via === 'google-news' ? null : it.link, googleUrl: it.googleUrl || null,
        publishedAt: it.publishedAt, image: it.image || null, description: it.description || '', via: it.via, excerpt: null, state: 'pending' }))
    if (!answered) {
      // Nothing reachable: don't cache, so the next request tries again.
      return { query, status: 'unavailable', fetchedAt: new Date(now()).toISOString(), articles: [], complete: false,
        error: 'News sources could not be reached. Try again later.' }
    }
    state = { query, fallbackQuery: fallbackUsed ? looseQuery : null, scopedHits, fetchedAt: new Date(now()).toISOString(), picks, complete: false }
  }

  // Enrich pending picks in parallel until the deadline.
  await Promise.all(state.picks.filter((p) => p.state === 'pending').map((p) => enrich(p, ctx)))

  const finished = state.picks.filter((p) => p.state !== 'pending')
  const ranked = state.picks
    // Google News matched the query against the full article, so its items are kept (ranked lower
    // when our own check finds no match); outlet-feed items must pass our relevance check.
    .map((p) => {
      const own = p.state === 'read' ? p.score ?? relevance(p, match) : 1
      return { ...p, score: p.via === 'google-news' ? Math.max(own, 0.5) : own }
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    // Titles can change once the article is read (outlets' own headlines): check for the same story again.
    .filter((p, i, list) => !list.slice(0, i).some((o) => sameStory(o.title, p.title, place)))
  state.complete = finished.length === state.picks.length
  state.articles = ranked.slice(0, SHOW).map(publicArticle)
  await cache.put(key, state, 0, expiresAt)
  return publicResult(state, state.complete ? 'fresh' : 'partial', expiresAt)
}

async function enrich(p, ctx) {
  const { cache, deadline, fetchImpl } = ctx
  if (deadline.left() < 1200) return // leave it pending for the next request
  const url = p.url || (p.googleUrl && (await decodeGoogleNewsUrl(p.googleUrl, ctx)))
  if (!url) { p.state = deadline.passed ? 'pending' : 'no-link'; return }
  p.url = url
  const akey = `a/${hashKey(url)}`
  const hit = await cache.getFresh(akey)
  if (hit) return Object.assign(p, merge(p, hit), { state: hit.excerpt ? 'read' : 'no-text' })
  if (!(await allowedByRobots(url, ctx))) { p.state = 'robots'; return }
  const page = await fetchText(url, { deadline, timeoutMs: 3500, fetchImpl })
  if (!page) { p.state = deadline.left() < 300 ? 'pending' : 'unreachable'; return }
  const { fullText, ...art } = extractArticle(page.text, page.url)
  await cache.put(akey, art, DAY)
  Object.assign(p, merge(p, art), { url: page.url, state: art.excerpt ? 'read' : 'no-text' })
  p.score = relevance({ title: p.title, excerpt: fullText || art.excerpt }, ctx.match)
}

const merge = (p, a) => ({
  title: a.title && a.title.length > 12 ? a.title : p.title,
  excerpt: a.excerpt, excerptFrom: a.excerptFrom,
  // The outlet name from Google News / the outlet's feed wins: pages' publisher field is sometimes the CMS vendor.
  image: a.image || p.image, publishedAt: a.publishedAt || p.publishedAt, source: p.source || a.source,
})

// Only public fields leave the function (internal picks, Google ids and descriptions stay in the cache).
const publicResult = (s, status, expiresAt) => ({
  status, query: s.query, fallbackQuery: s.fallbackQuery || null, fetchedAt: s.fetchedAt, expiresAt, complete: s.complete, articles: s.articles,
})

const NOTES = {
  robots: 'The outlet does not allow automated reading; open the article to read it.',
  'no-text': 'No article text could be extracted (paywall or unusual page).',
  'no-link': 'The original link could not be resolved; opening it via Google News.',
  unreachable: 'The outlet did not respond in time.',
  pending: 'Excerpt still loading; refresh to complete.',
}

function publicArticle(p) {
  return {
    title: p.title, excerpt: p.excerpt || null, excerptFrom: p.excerptFrom || null, image: p.image || null,
    source: p.source || hostOf(p.url || ''), url: p.url || p.googleUrl, publishedAt: p.publishedAt || null,
    via: p.via, note: p.state === 'read' ? null : NOTES[p.state] || null,
  }
}
