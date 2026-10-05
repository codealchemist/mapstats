// Main-text extraction from an article page.
//  1. JSON-LD NewsArticle/Article `articleBody` (clean, provided by most news CMSs);
//  2. Mozilla Readability (Firefox Reader View) on a linkedom DOM;
//  3. og:description as a last resort (flagged as the outlet's summary, not body text).
import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'

const MIN_BODY = 220 // shorter than this is a teaser, paywall or consent page, not an article body

export function extractArticle(html, url) {
  const meta = readMeta(html)
  const ld = readJsonLd(html)
  let body = clean(ld?.articleBody)
  let method = 'json-ld'
  let readable = null
  if (!body || body.length < MIN_BODY) {
    try {
      const { document } = parseHTML(html)
      readable = new Readability(document, { charThreshold: 300 }).parse()
      body = clean(readable?.textContent)
      method = 'readability'
    } catch {
      body = ''
    }
  }
  let excerptFrom = 'body'
  if (!body || body.length < MIN_BODY) {
    body = clean(meta['og:description'] || meta.description || ld?.description)
    excerptFrom = body ? 'description' : null
    method = 'description'
  }
  return {
    url,
    // Full body, used once for relevance scoring and never cached (only the excerpt is stored).
    fullText: excerptFrom === 'body' ? body : '',
    title: clean(ld?.headline || meta['og:title'] || readable?.title || meta.title) || null,
    excerpt: body ? shorten(stripLead(body), 400) : null,
    excerptFrom,
    method,
    image: absolute(firstImage(ld?.image) || meta['og:image'] || meta['twitter:image'], url),
    publishedAt: toIso(ld?.datePublished || meta['article:published_time'] || meta['og:article:published_time']),
    source: clean(ld?.publisher?.name || meta['og:site_name'] || readable?.siteName) || null,
  }
}

/** Up to `max` characters, ending at a sentence when one ends late enough, else at a word. */
export function shorten(text, max = 400) {
  const t = clean(text)
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const sentence = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('." '))
  if (sentence > max * 0.6) return cut.slice(0, sentence + 1)
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:\-–]$/, '') + '…'
}

// Bylines and datelines that open many bodies ("Por Redacción | ", "TANDIL.- ").
const stripLead = (t) => t.replace(/^(por\s+[^.|\n]{2,60}\s*[|·]\s*)/i, '').replace(/^[A-ZÁÉÍÓÚÑ ]{3,30}\s?(\(.*?\))?\s?[.-]+\s*/, '')

const clean = (s) => (s == null ? '' : String(s).replace(/\s+/g, ' ').replace(/&nbsp;/g, ' ').trim())

function readMeta(html) {
  const out = {}
  for (const m of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]
    const key = /(?:property|name)=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const val = /content=["']([^"']*)["']/i.exec(tag)?.[1]
    if (key && val != null && !(key in out)) out[key] = decodeEntities(val)
  }
  const title = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]
  if (title) out.title = decodeEntities(title)
  return out
}

function readJsonLd(html) {
  for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data
    try { data = JSON.parse(m[1].trim()) } catch { continue }
    const nodes = [data].flat().flatMap((d) => (d?.['@graph'] ? d['@graph'] : [d]))
    const art = nodes.find((n) => [n?.['@type']].flat().some((t) => /Article|NewsArticle|Reportage/i.test(String(t))))
    if (art) return art
  }
  return null
}

const firstImage = (img) => (!img ? null : typeof img === 'string' ? img : Array.isArray(img) ? firstImage(img[0]) : img.url || img.contentUrl || null)
const absolute = (u, base) => { try { return u ? new URL(u, base).href : null } catch { return null } }
const toIso = (s) => { const d = s ? new Date(s) : null; return d && !Number.isNaN(+d) ? d.toISOString() : null }
const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
