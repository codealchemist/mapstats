export const PRIORITY = { user: 0, map: 1, extra: 2 }
const BUDGET = 540 // Open-Meteo's free tier allows 600 calls a minute per IP; weights here are estimates
const WINDOW = 60_000
const CONCURRENCY = 2 // the API also refuses too many parallel requests from one IP
const BACKOFF_MS = [2000, 5000, 10000]
const HOUR = 3_600_000, DAY = 86_400_000

export const abortError = () => new DOMException('Aborted', 'AbortError')
export const isAbort = (e) => e?.name === 'AbortError'

// Open-Meteo bills each location of a request as max(1, variables / 10 × max(1, days / 14)) calls.
export const callWeight = ({ locations = 1, variables, days }) => locations * Math.max(1, (variables / 10) * Math.max(1, days / 14))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function getJSON(url, { timeout = 30000, signal } = {}) {
  if (signal?.aborted) throw abortError()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const stop = () => ctrl.abort()
  signal?.addEventListener('abort', stop)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) {
      // The reason is shown in the UI: keep it short and printable (React escapes it; this bounds it).
      // eslint-disable-next-line no-control-regex -- strips control characters on purpose
      const reason = await res.json().then((b) => (typeof b?.reason === 'string' ? b.reason.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200) : null), () => null)
      throw Object.assign(new Error(reason || `${res.status} ${res.statusText}`), { status: res.status, reason })
    }
    return url.includes('format=csv') ? await res.text() : await res.json()
  } catch (e) {
    if (signal?.aborted) throw abortError()
    if (isAbort(e)) throw Object.assign(new Error(`No response within ${timeout / 1000} s`), { timeout: true })
    throw e
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', stop)
  }
}

// Open-Meteo tells its limits apart only in the 429's reason text.
function limitOf(e) {
  if (e?.status !== 429) return null
  const m = /hourly|daily|concurrent/i.exec(e.reason || '')
  return m ? m[0].toLowerCase() : 'minutely'
}

const retryable = (e, limit) => limit === 'minutely' || limit === 'concurrent' || e.timeout || e.status == null || e.status >= 500

export function createQueue({ fetchJSON = getJSON, now = Date.now, wait = sleep, budget = BUDGET, windowMs = WINDOW, concurrency = CONCURRENCY } = {}) {
  const waiting = []
  const sent = []
  const blockedHosts = {}
  let active = 0, pausedUntil = 0, seq = 0, wakeTime = Infinity

  const blockOf = (host) => (blockedHosts[host] && now() < blockedHosts[host].until ? blockedHosts[host].error : null)

  function used(t) {
    while (sent.length && sent[0].at <= t - windowMs) sent.shift()
    return sent.reduce((s, e) => s + e.weight, 0)
  }

  function enqueue(job) {
    const i = waiting.findIndex((j) => j.priority > job.priority || (j.priority === job.priority && j.seq > job.seq))
    waiting.splice(i < 0 ? waiting.length : i, 0, job)
  }

  function wakeAt(time) {
    if (wakeTime <= time) return
    wakeTime = time
    wait(Math.max(0, time - now())).then(() => {
      if (wakeTime !== time) return
      wakeTime = Infinity
      pump()
    })
  }

  function pump() {
    const t = now()
    for (let i = waiting.length - 1; i >= 0; i--) {
      const stop = blockOf(waiting[i].host)
      if (stop) waiting.splice(i, 1)[0].reject(stop)
    }
    if (!waiting.length) return
    if (t < pausedUntil) return wakeAt(pausedUntil)
    const top = waiting[0].priority
    let room = budget - used(t), next = Infinity
    for (let i = 0; i < waiting.length && active < concurrency;) {
      const job = waiting[i]
      if (job.priority > top) break // lower priorities wait rather than fill gaps, or small requests could starve a heavy one
      if (job.notBefore > t) next = Math.min(next, job.notBefore)
      // A request heavier than the whole budget can only go alone, into an empty window.
      else if (job.weight > room && sent.length) next = Math.min(next, sent[0].at + windowMs)
      else {
        waiting.splice(i, 1)
        room -= job.weight
        const entry = { at: t, weight: job.weight }
        sent.push(entry)
        run(job, entry)
        continue
      }
      i++
    }
    if (next < Infinity) wakeAt(next)
  }

  async function run(job, entry) {
    active++
    try {
      job.resolve(await fetchJSON(job.url, { signal: job.signal, timeout: job.timeout }))
    } catch (e) {
      // The server doesn't count a refused request.
      if (e?.status === 429 && sent.includes(entry)) sent.splice(sent.indexOf(entry), 1)
      settleFailure(job, e)
    } finally {
      active--
      pump()
    }
  }

  function settleFailure(job, e) {
    if (isAbort(e)) return job.reject(e)
    const limit = limitOf(e)
    if (limit === 'hourly' || limit === 'daily') {
      const t = now(), span = limit === 'hourly' ? HOUR : DAY
      blockedHosts[job.host] = { until: (Math.floor(t / span) + 1) * span, error: e }
      return job.reject(e)
    }
    if (!retryable(e, limit) || job.attempts >= BACKOFF_MS.length) return job.reject(e)
    if (limit === 'minutely') pausedUntil = Math.max(pausedUntil, now() + windowMs + 1000)
    else job.notBefore = now() + BACKOFF_MS[job.attempts]
    job.attempts++
    enqueue(job)
  }

  /** `weight` is the request's cost in Open-Meteo API calls. */
  function request(url, { weight = 1, priority = PRIORITY.map, signal, timeout } = {}) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(abortError())
      // An in-flight job is aborted by its fetch; a queued one has to be dropped here. The listener
      // is removed once the job settles, so long-lived signals don't keep finished jobs alive.
      const onAbort = () => {
        const i = waiting.indexOf(job)
        if (i >= 0) waiting.splice(i, 1)[0].reject(abortError())
      }
      const settle = (fn) => (v) => { signal?.removeEventListener('abort', onAbort); fn(v) }
      const job = { url, host: new URL(url).host, weight, priority, signal, timeout, attempts: 0, notBefore: 0, seq: seq++, resolve: settle(resolve), reject: settle(reject) }
      const stop = blockOf(job.host)
      if (stop) return job.reject(stop)
      signal?.addEventListener('abort', onAbort, { once: true })
      enqueue(job)
      pump()
    })
  }

  return { request }
}

export const meteo = createQueue()
