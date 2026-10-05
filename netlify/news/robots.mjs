// Minimal robots.txt support (User-agent: * rules), cached per host for 7 days.
import { fetchText } from './http.mjs'

export function robotsAllows(txt, path) {
  const rules = []
  let applies = false
  for (const raw of String(txt || '').split('\n')) {
    const line = raw.split('#')[0].trim()
    const i = line.indexOf(':')
    if (i < 0) continue
    const k = line.slice(0, i).trim().toLowerCase(), v = line.slice(i + 1).trim()
    if (k === 'user-agent') applies = v === '*'
    else if (applies && (k === 'disallow' || k === 'allow') && v) rules.push({ allow: k === 'allow', v })
  }
  // Longest matching rule wins (as in Google's implementation).
  const hit = rules.filter((r) => path.startsWith(r.v)).sort((a, b) => b.v.length - a.v.length)[0]
  return !hit || hit.allow
}

export async function allowedByRobots(url, { cache, deadline, fetchImpl }) {
  const u = new URL(url)
  const key = `robots/${u.host}`
  let txt = await cache.getFresh(key)
  if (txt == null) {
    const r = await fetchText(`${u.origin}/robots.txt`, { deadline, timeoutMs: 1500, fetchImpl })
    txt = r?.text ?? ''
    await cache.put(key, txt, 7 * 86_400_000)
  }
  return robotsAllows(txt, u.pathname + u.search)
}
