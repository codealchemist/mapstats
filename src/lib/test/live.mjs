// npm run live:test — offline checks of the Open-Meteo queue against a fake rate-limited API, on a virtual clock.
import { callWeight, createQueue, isAbort, PRIORITY } from '../meteoQueue.js'
import { fetchAqiBatch, fetchClimateBatch, fetchUvBatch } from '../live.js'

let failures = 0
const check = (label, ok, extra = '') => { console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`); if (!ok) failures++ }
const section = (title) => console.log(`\n${title}`)

// Node's own localStorage needs --localstorage-file; an in-memory one keeps the cache working.
const mem = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) },
})

function virtualClock() {
  let t = 0
  const timers = []
  const settle = () => new Promise((r) => setImmediate(r))
  return {
    now: () => t,
    wait: (ms) => new Promise((r) => timers.push({ at: t + ms, r })),
    async run() {
      for (;;) {
        await settle()
        if (!timers.length) return
        timers.sort((a, b) => a.at - b.at)
        const next = timers.shift()
        t = Math.max(t, next.at)
        next.r()
      }
    },
  }
}

const httpError = (status, reason) => Object.assign(new Error(reason || `${status}`), { status, reason })
const MINUTELY = 'Minutely API request limit exceeded. Please try again in one minute.'
const HOURLY = 'Hourly API request limit exceeded. Please try again in the next hour.'

function urlWeight(url) {
  const q = new URL(url).searchParams
  if (!q.has('latitude')) return +q.get('w') || 1
  const locations = q.get('latitude').split(',').length
  const variables = ['hourly', 'daily', 'current'].flatMap((k) => q.get(k)?.split(',') || []).length
  const days = q.has('start_date')
    ? Math.round((Date.parse(q.get('end_date')) - Date.parse(q.get('start_date'))) / 86_400_000) + 1
    : (+q.get('past_days') || 0) + (+q.get('forecast_days') || 7)
  return callWeight({ locations, variables, days })
}

const year = new Date().getFullYear() - 1
const DAYS = Array.from({ length: 365 }, (_, i) => new Date(Date.UTC(year, 0, 1 + i)).toISOString().slice(0, 10))
const fill = (v) => DAYS.map(() => v)
const BODY = {
  'archive-api.open-meteo.com': () => ({ elevation: 120, daily: { time: DAYS, temperature_2m_max: fill(22), temperature_2m_min: fill(12), precipitation_sum: fill(1), snowfall_sum: fill(0), sunshine_duration: fill(30000) } }),
  'historical-forecast-api.open-meteo.com': () => ({ daily: { uv_index_max: fill(5) } }),
  'air-quality-api.open-meteo.com': () => ({ hourly: { european_aqi: [20, 30] } }),
  'example.test': () => ({ ok: true }),
  'other.test': () => ({ ok: true }),
}

// Like Open-Meteo, usage is counted per clock minute and requests are refused once it reaches the limit.
function fakeApi(clock, { limit = 600, alreadyUsed = 0, fault } = {}) {
  const log = []
  const usage = { 0: alreadyUsed }
  const fetchJSON = async (url, { signal } = {}) => {
    const call = { url, at: clock.now(), weight: urlWeight(url) }
    log.push(call)
    await clock.wait(300)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const minute = Math.floor(call.at / 60_000)
    if ((usage[minute] || 0) >= limit) throw (call.status = 429, httpError(429, MINUTELY))
    const injected = fault?.(url, call)
    if (injected) throw (call.status = injected.status, injected)
    usage[minute] = (usage[minute] || 0) + call.weight
    call.status = 200
    const u = new URL(url)
    const n = u.searchParams.get('latitude')?.split(',').length || 1
    const one = BODY[u.host]
    return n === 1 ? one() : Array.from({ length: n }, one)
  }
  return { log, fetchJSON, usage }
}

const job = (q, w, opts = {}) => q.request(`https://example.test/x?w=${w}&id=${Math.random()}`, { weight: w, ...opts })
const points = (prefix, n) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, lat: -40 + i * 0.1, lon: -60 }))
const maxRolling = (log, windowMs = 60_000) =>
  Math.max(...log.map((c) => log.filter((d) => d.at > c.at - windowMs && d.at <= c.at).reduce((s, d) => s + d.weight, 0)))

section('Request weights (open-meteo calculateQueryWeight)')
const climateChunk = callWeight({ locations: 40, variables: 5, days: 365 })
check('40-point climate chunk fits the 540 budget', climateChunk <= 540, climateChunk.toFixed(1))
check('…but with the unused wind variable it alone exceeded the 600 limit', callWeight({ locations: 40, variables: 6, days: 365 }) > 600)
check('short requests cost one call per location', callWeight({ locations: 50, variables: 1, days: 31 }) === 50)

section('Pacing')
{
  const clock = virtualClock()
  const api = fakeApi(clock)
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const all = Promise.allSettled(Array.from({ length: 6 }, () => job(q, 260)))
  await clock.run()
  const res = await all
  check('every request succeeds', res.every((r) => r.status === 'fulfilled'))
  check('no rolling minute goes over the budget', maxRolling(api.log) <= 540, `max ${maxRolling(api.log)}`)
  check('1,560 calls need three minutes of windows', api.log.at(-1).at >= 120_000, `last sent at ${api.log.at(-1).at / 1000} s`)
  check('the server never refused a request', api.log.every((c) => c.status === 200))
}

section('Priority')
{
  const clock = virtualClock()
  const api = fakeApi(clock)
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const order = []
  const tag = (name, p) => p.then(() => order.push(name))
  const reqs = [
    tag('map1', job(q, 260)), tag('map2', job(q, 260)), tag('map3', job(q, 260)), tag('map4', job(q, 260)),
    tag('extra', job(q, 10, { priority: PRIORITY.extra })),
  ]
  clock.wait(1000).then(() => reqs.push(tag('user', job(q, 100, { priority: PRIORITY.user }))))
  await clock.run()
  await Promise.all(reqs)
  check('a user request goes before the waiting map batches', order.indexOf('user') < order.indexOf('map3'), order.join(' → '))
  check('a lower priority never overtakes, even when it would fit', order.at(-1) === 'extra')
}

section('Retries and limits')
{
  const clock = virtualClock()
  const api = fakeApi(clock, { alreadyUsed: 600 }) // e.g. by another tab
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const r = await Promise.all([job(q, 50), clock.run()])
  const calls = api.log.length
  check('a minutely 429 pauses for a minute, then the retry succeeds', r[0]?.ok && calls === 2 && api.log[1].at >= 61_000, `${calls} calls, retry at ${api.log[1]?.at / 1000} s`)
}
{
  const clock = virtualClock()
  let first = true
  const api = fakeApi(clock, { fault: (url) => url.includes('example.test') && first && !(first = false) && httpError(503, 'The service is overloaded') })
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const r = await Promise.all([job(q, 5), clock.run()])
  check('a transient 503 is retried after a short backoff', r[0]?.ok && api.log.length === 2 && api.log[1].at - api.log[0].at < 5000)
}
{
  const clock = virtualClock()
  let first = true
  const api = fakeApi(clock, { fault: () => first && !(first = false) && Object.assign(new Error('No response within 60 s'), { timeout: true }) })
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const r = await Promise.all([job(q, 5), clock.run()])
  check('a stalled response (timeout) is retried', r[0]?.ok && api.log.length === 2)
}
{
  const clock = virtualClock()
  const api = fakeApi(clock, { fault: (url) => (url.includes('id=bad') ? httpError(400, 'Invalid parameter') : url.includes('id=hourly') ? httpError(429, HOURLY) : null) })
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const bad = q.request('https://example.test/x?id=bad').catch((e) => e)
  const hourly = q.request('https://example.test/x?id=hourly').catch((e) => e)
  await clock.run()
  const [eBad, eHourly] = await Promise.all([bad, hourly])
  check('a 400 fails without retry', eBad.status === 400 && api.log.filter((c) => c.url.includes('bad')).length === 1)
  check('an hourly 429 fails with its reason, without retry', eHourly.reason === HOURLY && api.log.filter((c) => c.url.includes('hourly')).length === 1)
  const before = api.log.length
  const later = await q.request('https://example.test/x?id=later').catch((e) => e)
  check('that host then fails fast until the hour is over', later.reason === HOURLY && api.log.length === before)
  const other = q.request('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=1&longitude=1&hourly=european_aqi&past_days=30&forecast_days=1')
  await clock.run()
  check('other hosts keep working', (await other.catch(() => null))?.hourly != null)
}
{
  const clock = virtualClock()
  const api = fakeApi(clock, { fault: (url) => (url.includes('id=refused') ? httpError(429, HOURLY) : null) })
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const refused = q.request('https://example.test/x?w=500&id=refused', { weight: 500 }).catch((e) => e)
  const next = q.request('https://other.test/y?w=500', { weight: 500 })
  await clock.run()
  await Promise.all([refused, next])
  check('a refused request gives its weight back to the window', api.log[1].at < 1000, `next request sent at ${api.log[1].at / 1000} s`)
}

section('Abort')
{
  const clock = virtualClock()
  const api = fakeApi(clock)
  const q = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const ctrl = new AbortController()
  const inflight = job(q, 500, { signal: ctrl.signal }).catch((e) => e)
  const queued = job(q, 500, { signal: ctrl.signal }).catch((e) => e)
  clock.wait(100).then(() => ctrl.abort())
  await clock.run()
  check('an in-flight request rejects with AbortError', isAbort(await inflight))
  check('a queued request rejects and is never sent', isAbort(await queued) && api.log.length === 1)
}

section('Batches')
{
  mem.clear()
  const clock = virtualClock()
  const api = fakeApi(clock, { fault: (url) => (url.includes('latitude=-35.000,') ? httpError(400, 'Invalid coordinates') : null) })
  const queue = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const progress = []
  const p = fetchAqiBatch(points('aqi', 120), { queue, onProgress: (s) => progress.push(s.loaded + s.failed) })
  await clock.run()
  const r = await p
  check('a failed chunk keeps the other chunks', r.loaded === 70 && r.failed === 50 && Object.keys(r.data).length === 70, `loaded ${r.loaded}, failed ${r.failed}`)
  check('the batch resolves with the error', r.error?.message === 'Invalid coordinates')
  check('progress after every chunk', progress.length === 3 && progress.at(-1) === 120, progress.join(', '))
}
{
  mem.clear()
  const clock = virtualClock()
  const api = fakeApi(clock)
  const queue = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const pts = points('fra', 103)
  const run = Promise.all([
    fetchAqiBatch(pts, { queue, priority: PRIORITY.map }),
    fetchClimateBatch(pts, { queue, priority: PRIORITY.map }),
    fetchUvBatch(pts, { queue, priority: PRIORITY.extra }),
  ])
  await clock.run()
  const [aqi, clim, uv] = await run
  const last = (name) => api.log.filter((c) => c.url.includes(name)).at(-1).at / 1000
  check('cold load: every point of every layer loads', [aqi, clim, uv].every((r) => r.loaded === 103 && !r.failed))
  check('cold load: the server never refused a request', api.log.every((c) => c.status === 200), `${api.log.filter((c) => c.status === 429).length} × 429`)
  check('cold load: climate is real data', clim.data['fra-0'].meanTemp === 17 && clim.data['fra-0'].elevation === 120)
  console.log(`  last request sent: AQI ${last('air-quality')} s, climate ${last('archive')} s, UV ${last('historical-forecast')} s (virtual time)`)
  const again = await fetchClimateBatch(pts, { queue })
  check('a second load comes from the cache', again.loaded === 103 && api.log.length === 9)
}
{
  mem.clear()
  const clock = virtualClock()
  const api = fakeApi(clock)
  const queue = createQueue({ fetchJSON: api.fetchJSON, now: clock.now, wait: clock.wait })
  const ctrl = new AbortController()
  const p = fetchClimateBatch(points('abort', 103), { queue, signal: ctrl.signal, onProgress: () => ctrl.abort() }).catch((e) => e)
  await clock.run()
  check('switching country aborts the rest of a batch', isAbort(await p) && api.log.length === 1, `${api.log.length} requests sent`)
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
