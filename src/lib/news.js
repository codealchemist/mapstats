// Crime news for a place. Shared by the browser (src/) and the news function (netlify/):
// both build the same query, so the "Search more on Google News" link always matches what
// the service searched.
//
// The browser never scrapes: it calls our Netlify function (/api/news), which finds articles
// in RSS feeds, extracts a short excerpt of each article's main text and caches the result
// in Netlify Blobs for 24 h.

export const KEYWORDS = {
  es: ['robo', 'asalto', 'homicidio', 'asesinato', 'crimen', 'delito', 'inseguridad', 'tiroteo', 'secuestro', 'narcotráfico'],
  pt: ['roubo', 'assalto', 'homicídio', 'assassinato', 'crime', 'violência', 'tiroteio', 'sequestro', 'tráfico'],
  en: ['robbery', 'assault', 'homicide', 'murder', 'crime', 'shooting', 'burglary', 'kidnapping'],
  fr: ['vol', 'agression', 'homicide', 'meurtre', 'crime', 'délinquance', 'fusillade', 'cambriolage'],
  de: ['Raub', 'Überfall', 'Mord', 'Tötungsdelikt', 'Kriminalität', 'Einbruch', 'Schüsse'],
  it: ['rapina', 'aggressione', 'omicidio', 'delitto', 'criminalità', 'furto', 'sparatoria'],
}

// Names shared by several places in Argentina (or common words) that need the province to disambiguate.
const AMBIGUOUS = new Set(['merlo', 'junin', 'concepcion', 'san martin', 'santa rosa', 'la banda', 'capital', 'san rafael', 'general roca', 'san francisco', 'belgrano', 'colon', 'rivadavia', 'san isidro', 'san fernando'])
export const fold = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** True when the place name alone is ambiguous and the region must be part of the query. */
export function needsRegion({ name, provinceName, type }, extraAmbiguous = new Set()) {
  const key = fold(name)
  return type === 'city' && !!provinceName && fold(provinceName) !== key && (AMBIGUOUS.has(key) || extraAmbiguous.has(key))
}

/**
 * Search query: the place, its state/province and country (each a required phrase), plus crime
 * keywords in the country's language:
 *   city      → "Tandil" "Buenos Aires" "Argentina" (robo OR …)
 *   province  → "Mendoza" "Argentina" (robo OR …)
 * `scope: false` gives the place-only variant (state only for ambiguous names), used as a fallback
 * when the scoped search finds too little: local outlets often never name the province or country.
 */
export function newsQuery(entity, { lang, countryName }, extraAmbiguous = new Set(), { scope = true } = {}) {
  const words = KEYWORDS[lang] || KEYWORDS.en
  const phrase = (s) => `"${String(s).replace(/"/g, '')}"`
  const name = fold(entity.name)
  const region = entity.type === 'city' && entity.provinceName && fold(entity.provinceName) !== name ? entity.provinceName : null
  const country = countryName && fold(countryName) !== name && fold(countryName) !== fold(region) ? countryName : null
  const parts = scope
    ? [entity.name, region, country]
    : [entity.name, needsRegion(entity, extraAmbiguous) ? entity.provinceName : null]
  return [...parts.filter(Boolean).map(phrase), `(${words.join(' OR ')})`].join(' ')
}

// Google News edition per country: interface language (hl) and edition id (ceid) must match, or
// Google redirects to its own defaults.
const GN_HL = { AR: 'es-419', BO: 'es-419', CL: 'es-419', CO: 'es-419', EC: 'es-419', MX: 'es-419', PY: 'es-419', PE: 'es-419', UY: 'es-419', ES: 'es', BR: 'pt-419', PT: 'pt-150', US: 'en-US', FR: 'fr', DE: 'de', IT: 'it' }
const edition = (iso2) => {
  const gl = iso2 || 'US'
  const hl = GN_HL[gl] || 'en-US'
  return `hl=${hl}&gl=${gl}&ceid=${gl}:${hl}`
}

/** Same query on Google News, for a "search more" link (opened by the user, never fetched). */
export const googleNewsUrl = (query, iso2) => `https://news.google.com/search?q=${encodeURIComponent(`${query} when:30d`)}&${edition(iso2)}`

/** Google News RSS search feed (used server-side by the news function). */
export const googleNewsRssUrl = (query, iso2) => `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:30d`)}&${edition(iso2)}`

/**
 * Browser client for the news function.
 * @returns { status, fetchedAt, expiresAt, query, articles: [{ title, excerpt, image, source, url, publishedAt }] }
 */
export async function fetchNews({ entity, country, disambiguate, signal }) {
  const params = new URLSearchParams({
    place: entity.name, type: entity.type, country: country.iso3,
    ...(entity.provinceName && { region: entity.provinceName }),
    ...(disambiguate && { withRegion: '1' }),
  })
  const res = await fetch(`/api/news?${params}`, { signal })
  if (res.status === 404) throw Object.assign(new Error('News service not running (start the app with `netlify dev`)'), { code: 'no-service' })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body) throw new Error(body?.error || `News service error ${res.status}`)
  return body
}
