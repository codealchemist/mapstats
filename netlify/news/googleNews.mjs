// Google News RSS search: the discovery source with the best local coverage (no key needed).
// Item links point to news.google.com/rss/articles/<id>, not to the publisher, so each one is
// decoded before the article can be read:
//   1. legacy ids embed the URL in their base64 payload (no request needed);
//   2. current ids ("AU_yqL…") need the article's signature + timestamp from Google's page and one
//      call to Google's batchexecute endpoint (the method used by open-source decoders).
// Both are unofficial: when decoding fails the item is still listed (title, outlet, Google link).
import { fetchText } from './http.mjs'
import { parseFeed } from './rss.mjs'
import { googleNewsRssUrl } from '../../src/lib/news.js'

export async function googleNewsItems(query, iso2, { deadline, fetchImpl }) {
  const r = await fetchText(googleNewsRssUrl(query, iso2), { deadline, timeoutMs: 3500, fetchImpl })
  if (!r) return []
  return parseFeed(r.text).map((it) => {
    // Titles come as "Headline - Outlet".
    const outlet = it.source?.name || /\s[-–]\s([^-–]+)$/.exec(it.title)?.[1] || null
    const title = outlet && it.title.endsWith(outlet) ? it.title.slice(0, -(outlet.length)).replace(/\s[-–]\s*$/, '').trim() : it.title
    return { ...it, title, outlet, outletUrl: it.source?.url || null, via: 'google-news', googleUrl: it.link }
  })
}

export const articleId = (link) => /\/articles\/([^/?#]+)/.exec(link || '')?.[1] || null

/** Legacy ids: protobuf-ish base64 payload containing the URL. */
export function decodeLegacy(id) {
  try {
    const bytes = Buffer.from(id.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1')
    const m = /https?:\/\/[\x21-\x7e]+/.exec(bytes)
    if (!m) return null
    // The URL is followed by protobuf bytes; trim at the first control/non-URL character run.
    // eslint-disable-next-line no-control-regex -- trims the binary protobuf bytes after the URL
    return m[0].replace(/[\x00-\x20\x7f-\xff].*$/s, '').replace(/[^\w\-.~:/?#[\]@!$&'()*+,;=%]+$/, '')
  } catch {
    return null
  }
}

export function parseBatchResponse(text) {
  const body = String(text).replace(/^\)\]\}'\s*/, '')
  try {
    const outer = JSON.parse(body)
    for (const row of outer) {
      if (Array.isArray(row) && row[0] === 'wrb.fr' && typeof row[2] === 'string') {
        const inner = JSON.parse(row[2])
        if (Array.isArray(inner) && typeof inner[1] === 'string' && /^https?:\/\//.test(inner[1])) return inner[1]
      }
    }
  } catch { /* fall through to regex */ }
  return /"(https?:\/\/(?![^"]*google\.com)[^"\\]+)"/.exec(body)?.[1] || null
}

export async function decodeGoogleNewsUrl(link, { deadline, fetchImpl, cache }) {
  const id = articleId(link)
  if (!id) return null
  const cacheKey = `gn/${id.slice(0, 180)}`
  const hit = cache && (await cache.getFresh(cacheKey))
  if (hit) return hit
  let url = id.startsWith('AU_yqL') ? null : decodeLegacy(id)
  if (!url) {
    const page = await fetchText(`https://news.google.com/rss/articles/${id}`, { deadline, timeoutMs: 2500, fetchImpl })
    const sg = page && /data-n-a-sg="([^"]+)"/.exec(page.text)?.[1]
    const ts = page && /data-n-a-ts="([^"]+)"/.exec(page.text)?.[1]
    if (sg && ts) {
      const req = [[['Fbv4je', JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg]), null, 'generic']]]
      const res = await fetchText('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
        deadline, timeoutMs: 2500, fetchImpl, method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: `f.req=${encodeURIComponent(JSON.stringify(req))}`,
      })
      url = res && parseBatchResponse(res.text)
    }
  }
  if (url && cache) await cache.put(cacheKey, url, 30 * 86_400_000)
  return url
}
