// Local news outlets used as direct RSS sources, per country (countries/<ISO3>/news.js: outlets.verified with
// pinned feeds, outlets.candidates for the probe). Countries without outlets rely on Google News only.
import { fold } from '../../src/lib/news.js'

// Feed locations tried by the probe when a candidate's homepage advertises none.
export const FEED_PATHS = [
  '/rss', '/feed', '/rss/', '/feed/', '/rss.xml', '/index.rss', '/feeds/rss',
  '/arc/outboundfeeds/rss/?outputType=xml', '/arc/outboundfeeds/rss/', '/arc/outboundfeeds/feeds/rss/?outputType=xml',
  '/rss/policiales.xml', '/rss/policiales', '/rss/ultimas-noticias.xml', '/rss/portada.xml', '/servicios/rss',
]

const home = (o) => `https://www.${o.domain}/`

/** A region name as outlets list it: accent-folded, without the country's prefixes ("provincia de …"). */
export const regionKey = (country, name) => (country.news.regionPrefixes || []).reduce((s, p) => (s.startsWith(p) ? s.slice(p.length) : s), fold(name))

/**
 * Verified outlets for a place: that city's outlets first, then region-wide ones, then the rest.
 * @returns [{ domain, home, feed }]
 */
export function outletsFor(country, regionName, placeName = '') {
  if (!regionName) return []
  const region = regionKey(country, regionName)
  const place = fold(placeName)
  const rank = (o) => (o.cities.includes(place) ? 0 : o.cities.length ? 2 : 1)
  return country.news.outlets.verified.filter((o) => o.regions.includes(region)).sort((a, b) => rank(a) - rank(b)).map((o) => ({ ...o, home: home(o) }))
}

/** Regions with no verified outlet, i.e. relying on Google News only. */
export function uncoveredRegions(country, allRegions = country.news.regions || []) {
  const covered = new Set(country.news.outlets.verified.flatMap((o) => o.regions))
  return allRegions.filter((r) => !covered.has(regionKey(country, r)))
}

export const candidateHomes = (country) => country.news.outlets.candidates.map((o) => ({ ...o, home: home(o) }))
