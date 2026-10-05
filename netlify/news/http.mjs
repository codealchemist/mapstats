// Network helper for the news function: per-request timeout, a global deadline (Netlify's free
// plan stops synchronous functions at 10 s), an honest User-Agent and a size cap.
const UA = process.env.NEWS_USER_AGENT || 'Mozilla/5.0 (compatible; MapStatsNews/1.0; +https://github.com/mapstats)'
const MAX_BYTES = 2_500_000

export class Deadline {
  constructor(ms, now = Date.now) { this.now = now; this.end = now() + ms }
  left() { return this.end - this.now() }
  get passed() { return this.left() <= 0 }
}

/** Fetch text; resolves null on timeout / HTTP error / non-text, never throws. */
export async function fetchText(url, { deadline, timeoutMs = 4000, method = 'GET', body, headers = {}, fetchImpl = fetch } = {}) {
  const budget = Math.min(timeoutMs, deadline ? deadline.left() - 150 : timeoutMs)
  if (budget < 300) return null
  try {
    const res = await fetchImpl(url, {
      method, body, redirect: 'follow', signal: AbortSignal.timeout(budget),
      headers: { 'User-Agent': UA, 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.6', Accept: 'text/html,application/xhtml+xml,application/xml,application/rss+xml;q=0.9,*/*;q=0.5', ...headers },
    })
    if (!res.ok) return null
    const type = res.headers.get?.('content-type') || ''
    if (type && !/text|xml|json|html/i.test(type)) return null
    const text = await res.text()
    return { text: text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text, url: res.url || url }
  } catch {
    return null
  }
}

export const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '') } catch { return '' } }
