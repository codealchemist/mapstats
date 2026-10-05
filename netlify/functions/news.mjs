// GET /api/news?place=Tandil&region=Buenos%20Aires&type=city&country=ARG[&withRegion=1]
// Recent crime news for a place: Google News RSS + local outlet RSS → article excerpts (≤ 400 chars).
// Results are cached in Netlify Blobs for 24 h; the first request for a place does the fetching.
import { getStore } from '@netlify/blobs'
import { getNews } from '../news/service.mjs'
import { COUNTRIES } from '../../src/data/countries.js'
import { memoryStore } from '../news/cache.mjs'

// Netlify Blobs exists on Netlify and under `netlify dev`; anywhere else fall back to a per-instance
// memory cache so the endpoint still works (just without the shared 24 h cache).
let fallback = null
function newsStore() {
  try {
    return getStore({ name: 'news', consistency: 'strong' })
  } catch (e) {
    if (!fallback) { console.warn('[news] Netlify Blobs unavailable, using an in-memory cache:', e.message); fallback = memoryStore() }
    return fallback
  }
}

const json = (body, status = 200, maxAge = 0) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
})

export default async (req) => {
  const q = new URL(req.url).searchParams
  const place = (q.get('place') || '').trim()
  const region = (q.get('region') || '').trim() || null
  const type = q.get('type') === 'province' ? 'province' : 'city'
  const countryIso3 = (q.get('country') || 'ARG').toUpperCase()
  // Keep the endpoint narrow: short plain names and supported countries only.
  const okName = (s) => s && s.length <= 80 && /^[\p{L}\p{M}0-9 .,'’()-]+$/u.test(s)
  if (!okName(place) || (region && !okName(region)) || !COUNTRIES.some((c) => c.iso3 === countryIso3)) {
    return json({ error: 'Invalid place, region or country.' }, 400)
  }
  try {
    const result = await getNews(
      { place, region, type, countryIso3, withRegion: q.get('withRegion') === '1' },
      { store: newsStore(), budgetMs: Number(process.env.NEWS_BUDGET_MS) || 8000 },
    )
    const maxAge = result.status === 'cached' || result.status === 'fresh' ? 900 : 0
    return json(result, result.status === 'unavailable' ? 503 : 200, maxAge)
  } catch (e) {
    console.error('[news]', e)
    return json({ error: 'News service error.' }, 500)
  }
}

export const config = { path: '/api/news' }
