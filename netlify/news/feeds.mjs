// Outlet RSS feeds: read pinned feeds directly; discovery (cached 7 days) is used by the probe and
// for outlets without a pinned feed.
import { fetchText, hostOf } from './http.mjs'
import { parseFeed, discoverFeeds } from './rss.mjs'
import { FEED_PATHS } from './outlets.mjs'

export async function feedUrlFor(home, { cache, deadline, fetchImpl }) {
  const key = `feed/${hostOf(home)}`
  const hit = await cache.getFresh(key)
  if (hit !== null && hit !== undefined) return hit || null // '' = known to have no feed
  let found = ''
  const page = await fetchText(home, { deadline, timeoutMs: 3000, fetchImpl })
  const advertised = page ? discoverFeeds(page.text, page.url) : []
  // Prefer a crime/police section feed when the homepage lists several.
  const sorted = advertised.sort((a, b) => score(b) - score(a))
  // Advertised feeds first (best first), then common paths — each group probed in parallel.
  for (const group of [sorted.slice(0, 3), FEED_PATHS.map((p) => new URL(p, home).href)]) {
    if (!group.length || deadline.left() < 1500) continue
    const probes = await Promise.all(group.map((url) => fetchText(url, { deadline, timeoutMs: 2000, fetchImpl })))
    const ok = probes.find((r) => r && parseFeed(r.text).length)
    if (ok) { found = ok.url; break }
  }
  // Only remember "no feed" when we actually completed the search (not when the deadline cut it short).
  if (found || deadline.left() >= 1500) await cache.put(key, found, 7 * 86_400_000)
  return found || null
}

const score = (u) => (/polic|seguridad|sucesos|judicial/i.test(u) ? 2 : 0) + (/rss|feed/i.test(u) ? 1 : 0)

/** outlet: { home, feed? } — a pinned (verified) feed is read directly, otherwise it is discovered. */
export async function outletItems(outlet, ctx) {
  const home = outlet.home || outlet
  const feed = outlet.feed || (await feedUrlFor(home, ctx))
  if (!feed) return []
  const r = await fetchText(feed, { deadline: ctx.deadline, timeoutMs: 2500, fetchImpl: ctx.fetchImpl })
  if (!r) return []
  const name = feedTitle(r.text) || hostOf(home)
  return parseFeed(r.text).map((it) => ({ ...it, outlet: name, outletUrl: home, via: 'outlet-rss' }))
}

// Channel title, minus taglines ("El Eco - Noticias de Tandil" → "El Eco").
const feedTitle = (xml) => /<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?([^<\]]+)/i.exec(xml)?.[1]?.split(/\s[-|–:]\s/)[0].trim() || null
