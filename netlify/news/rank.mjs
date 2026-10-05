// Relevance: an article qualifies when it is about crime AND mentions the place (or, for an
// ambiguous name, the place and its region). Obituaries and agendas are excluded.
import { fold } from '../../src/lib/news.js'

const CRIME = ['rob', 'asalt', 'homicid', 'asesin', 'crimen', 'crimin', 'delit', 'delincu', 'insegur', 'tirote', 'balea', 'baleo', 'secuestr', 'narco',
  'detenid', 'detuvieron', 'motochorr', 'femicid', 'apunal', 'ladron', 'hurt', 'estaf', 'violen', 'abus', 'allanamient', 'polic', 'arma blanca', 'arma de fuego', 'entradera', 'usurpa']
const EXCLUDE = ['sepelio', 'participaciones', 'necrolog', 'funebre', 'agenda cultural', 'horoscopo', 'cartelera']

const hits = (text, list) => list.filter((w) => text.includes(w)).length

export function relevance(item, { place, region, withRegion }) {
  const title = fold(item.title)
  const body = fold(`${item.excerpt || ''} ${item.description || ''}`)
  const all = `${title} ${body}`
  if (EXCLUDE.some((w) => title.includes(w))) return 0
  const p = fold(place)
  if (!all.includes(p)) return 0
  if (withRegion && region && !all.includes(fold(region))) return 0
  const crimeTitle = hits(title, CRIME), crimeBody = hits(body, CRIME)
  if (!crimeTitle && crimeBody < 2) return 0
  const ageDays = item.publishedAt ? (Date.now() - Date.parse(item.publishedAt)) / 86_400_000 : 15
  const score = crimeTitle * 3 + Math.min(crimeBody, 4) + (title.includes(p) ? 2 : 0) + Math.max(0, 3 - ageDays / 10)
  return happenedElsewhere(item.title, title, body, p) ? score * 0.25 : score
}

// "Robaron a turistas de Tandil en Trelew": the place is only where the people are from. Detected
// when the title names the place as an origin ("de Tandil", not "en Tandil") and either the lead
// does not mention it or the title locates the event in another place ("en Trelew").
function happenedElsewhere(rawTitle, title, body, p) {
  if (!title.includes(`de ${p}`) || title.includes(`en ${p}`)) return false
  // Extracted text often starts with the headline itself; the lead is what follows it.
  const lead = body.replace(title, ' ').trim().slice(0, 400)
  const elsewhere = [...String(rawTitle).matchAll(/\ben\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/g)].some(([, w]) => !p.startsWith(fold(w)))
  return !lead.includes(p) || elsewhere
}

const STOP = new Set(['para', 'como', 'tras', 'entre', 'sobre', 'desde', 'hasta', 'contra', 'durante', 'este', 'esta', 'unos', 'unas', 'todo', 'todos', 'cuando', 'donde', 'porque', 'luego', 'otra', 'otro'])
const words = (title, place) => {
  const skip = new Set(fold(place).split(' '))
  return new Set(fold(title).replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((w) => w.length >= 4 && !STOP.has(w) && !skip.has(w)))
}

/** Same event reported with different headlines (e.g. two outlets on one robbery). */
export function sameStory(a, b, place) {
  const A = words(a, place), B = words(b, place)
  if (!A.size || !B.size) return false
  let shared = 0
  for (const w of A) if (B.has(w)) shared++
  return shared >= 3 && shared / Math.min(A.size, B.size) >= 0.6
}

/** Same story syndicated by several outlets → keep the first. */
export const storyKey = (title) => fold(title).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70)
