// npm run news:test — offline end-to-end test of the news pipeline with fixtures.
import { getNews } from '../service.mjs'
import { memoryStore } from '../cache.mjs'
import { makeWeb } from './fixtures.mjs'

let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); if (!ok) failures++ }
const params = { place: 'Tandil', region: 'Buenos Aires', type: 'city', countryIso3: 'ARG' }
// Restrict outlets to the one with fixtures by asking for the region whose list starts with it.
const store = memoryStore()
let clock = Date.parse('2026-10-05T12:00:00Z')
const now = () => clock

// 1) first request: fetch + extract + cache
const web = makeWeb()
const t0 = Date.now()
const r1 = await getNews(params, { store, fetchImpl: web.fetchImpl, now: Date.now, budgetMs: 8000 })
const took = Date.now() - t0
console.log('\nFirst request:', r1.status, `${took} ms`, `${web.log.length} requests`, '| query:', r1.query)
for (const a of r1.articles) console.log(`  • [${a.via}] ${a.title}\n      ${a.source} · ${a.publishedAt?.slice(0, 10)} · img: ${a.image ? 'yes' : 'no'} · ${a.url}\n      ${a.excerpt ? `“${a.excerpt}” (${a.excerpt.length} chars, from ${a.excerptFrom})` : `(no excerpt) ${a.note}`}`)
check('responds within the 10 s Netlify limit', took < 9500, `${took} ms`)
check('query includes place, province and country', r1.query.startsWith('"Tandil" "Buenos Aires" "Argentina" ('), r1.query.slice(0, 40))
check('no fallback search when the scoped one finds enough', !r1.fallbackQuery && web.log.filter((u) => u.includes('/rss/search')).length === 1)
check('internal fields are not returned', !('picks' in r1) && r1.articles.every((a) => !('googleUrl' in a) && !('description' in a)))
check('at most 5 articles', r1.articles.length <= 5 && r1.articles.length >= 3, `${r1.articles.length}`)
check('excerpts ≤ 400 chars', r1.articles.every((a) => !a.excerpt || a.excerpt.length <= 401))
check('obituary excluded', !r1.articles.some((a) => /sepelio/i.test(a.title)))
check('syndicated duplicate collapsed', r1.articles.filter((a) => /detuvieron a dos/i.test(a.title)).length <= 1)
check('unrelated outlet item excluded', !r1.articles.some((a) => /miel/i.test(a.title)))
check('outlet RSS item included (direct link)', r1.articles.some((a) => a.via === 'outlet-rss' && a.url.startsWith('https://www.eleco.com.ar/policiales/allanamientos')))
check('legacy Google link decoded to publisher', r1.articles.some((a) => a.url === 'https://www.eleco.com.ar/policiales/robo-tandil'))
check('batchexecute Google link decoded', r1.articles.some((a) => a.url === 'https://www.clarin.com/policiales/tandil-motochorros.html' && a.excerpt?.includes('La Movediza')))
check('Readability extracted body (no nav text)', r1.articles.some((a) => a.excerpt?.startsWith('Los vecinos del barrio La Movediza')))
check('dateline stripped from JSON-LD body', r1.articles.some((a) => a.excerpt?.startsWith('Dos jóvenes fueron detenidos')))
check('paywall page falls back to outlet description', r1.articles.some((a) => a.excerptFrom === 'description' && /Lago del Fuerte/.test(a.excerpt || '')))
check('robots.txt respected (page never fetched)', !web.log.includes('https://www.privado.com.ar/privado/tandil-secuestro'))
const trelew = r1.articles.filter((a) => /turistas de Tandil/i.test(a.title))
check('crime elsewhere ("turistas de Tandil en Trelew") is not ranked above local stories', trelew.length === 0 || r1.articles.indexOf(trelew[0]) >= r1.articles.length - 1, trelew.map((a) => a.source).join(', ') || 'not shown')
check('same story from two outlets with different headlines shown once', trelew.length <= 1)
const { relevance } = await import('../rank.mjs')
const jornadaBody = 'Allanaron y le secuestraron la camioneta al sospechado del robo a los turistas de Tandil Personal de la comisaría segunda de Trelew este jueves realizó un allanamiento.'
const demoted = relevance({ title: 'Allanaron y le secuestraron la camioneta al sospechado del robo a los turistas de Tandil', excerpt: jornadaBody, publishedAt: new Date().toISOString() }, { place: 'Tandil' })
const local = relevance({ title: 'Múltiples procedimientos policiales en Tandil dejaron detenciones', excerpt: 'Múltiples procedimientos policiales en Tandil dejaron detenciones Durante los últimos días, efectivos policiales de Tandil…', publishedAt: new Date().toISOString() }, { place: 'Tandil' })
check('"happened elsewhere" detected even when the text starts with the headline', demoted < local / 2, `${demoted.toFixed(1)} vs local ${local.toFixed(1)}`)
const edt = r1.articles.find((a) => a.url.includes('eldiariodetandil'))
check('outlet name from Google News wins over the page publisher (CMS vendor)', !edt || edt.source === 'El Diario de Tandil', edt?.source || 'not in top 5')

// 1b) thin scoped results → the place-only search runs as a fallback
const webThin = makeWeb({ thinScoped: true })
const rThin = await getNews(params, { store: memoryStore(), fetchImpl: webThin.fetchImpl, budgetMs: 8000 })
const searches = webThin.log.filter((u) => u.includes('/rss/search')).map((u) => decodeURIComponent(new URL(u).searchParams.get('q')).replace(/ \(robo.*/, ''))
check('thin scoped search → place-only fallback runs and fills the list', rThin.fallbackQuery?.startsWith('"Tandil" (') && searches.length === 2 && rThin.articles.length >= 3,
  `${searches.join(' → ')} · ${rThin.articles.length} articles`)

// 2) second request within 24 h: served from the blob cache, no network
const web2 = makeWeb()
const r2 = await getNews(params, { store, fetchImpl: web2.fetchImpl, budgetMs: 8000 })
check('cached response has only public fields', !('picks' in r2), Object.keys(r2).join(','))
check('second request served from cache', (r2.status === 'cached' && web2.log.length === 0) || (r2.status !== 'cached' && !r1.complete), `${r2.status}, ${web2.log.length} requests`)

// 3) tight budget → partial, then completed by the next request (no refetch of what is done)
const store3 = memoryStore()
const p1 = await getNews(params, { store: store3, fetchImpl: makeWeb().fetchImpl, budgetMs: 2600 })
const web4 = makeWeb()
const p2 = await getNews(params, { store: store3, fetchImpl: web4.fetchImpl, budgetMs: 8000 })
check('tight budget returns a partial result', p1.status === 'partial' || p1.complete === false, `${p1.status}, ${p1.articles.filter((a) => a.excerpt).length} excerpts`)
check('next request completes it without re-reading feeds', !web4.log.some((u) => u.includes('/rss/search')), `${p2.status}, ${p2.articles.filter((a) => a.excerpt).length} excerpts, ${web4.log.length} requests`)

// 4) TTL: after 24 h the query is fetched again
const store5 = memoryStore()
await getNews(params, { store: store5, fetchImpl: makeWeb().fetchImpl, now, budgetMs: 8000 })
clock += 24 * 3600 * 1000 + 1
const web6 = makeWeb()
const r6 = await getNews(params, { store: store5, fetchImpl: web6.fetchImpl, now, budgetMs: 8000 })
check('after 24 h the cache expires and the first request refetches', web6.log.some((u) => u.includes('/rss/search')), `${r6.status}`)

// 5) all sources down → error, not cached
const store7 = memoryStore()
const r7 = await getNews(params, { store: store7, fetchImpl: makeWeb({ down: true }).fetchImpl, budgetMs: 3000 })
check('sources down → "unavailable", nothing cached', r7.status === 'unavailable' && ![...store7.map.keys()].some((k) => k.startsWith('q/')), r7.error)

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
