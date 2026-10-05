// RSS 2.0 / Atom parsing into a common item shape.
import { XMLParser } from 'fast-xml-parser'

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#text', processEntities: true, htmlEntities: true })
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x])
const text = (x) => (x == null ? '' : typeof x === 'object' ? String(x['#text'] ?? '') : String(x)).trim()
export const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

/** @returns [{ title, link, publishedAt, description, source: { name, url }, image }] */
export function parseFeed(xml) {
  let doc
  try { doc = parser.parse(xml) } catch { return [] }
  if (doc?.rss?.channel) {
    return arr(doc.rss.channel.item).map((it) => ({
      title: stripHtml(text(it.title)),
      link: text(it.link) || text(it.guid),
      publishedAt: toIso(text(it.pubDate) || text(it['dc:date'])),
      description: stripHtml(text(it.description) || text(it['content:encoded'])),
      source: it.source ? { name: text(it.source), url: it.source['@url'] || null } : null,
      image: it['media:content']?.['@url'] || arr(it['media:content'])[0]?.['@url'] || it['media:thumbnail']?.['@url'] || (/(image)/.test(it.enclosure?.['@type'] || '') ? it.enclosure['@url'] : null) || null,
    })).filter((x) => x.title && x.link)
  }
  if (doc?.feed) {
    return arr(doc.feed.entry).map((e) => ({
      title: stripHtml(text(e.title)),
      link: arr(e.link).find((l) => !l['@rel'] || l['@rel'] === 'alternate')?.['@href'] || '',
      publishedAt: toIso(text(e.published) || text(e.updated)),
      description: stripHtml(text(e.summary) || text(e.content)),
      source: null,
      image: null,
    })).filter((x) => x.title && x.link)
  }
  return []
}

function toIso(s) {
  const d = s ? new Date(s) : null
  return d && !Number.isNaN(+d) ? d.toISOString() : null
}

/** Feed URLs advertised by an HTML page (<link rel="alternate" type="application/rss+xml">). */
export function discoverFeeds(html, baseUrl) {
  const out = []
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]
    if (!/rel=["']?alternate/i.test(tag) || !/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1]
    if (href) { try { out.push(new URL(href, baseUrl).href) } catch { /* ignore bad href */ } }
  }
  return [...new Set(out)]
}
