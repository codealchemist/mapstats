import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LoaderCircle, Check, CircleAlert, Clock, ChevronUp, ChevronDown, CloudDownload, RotateCw, PauseCircle } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss.js'
import { PRIORITY, limitText, meteo } from '../lib/meteoQueue.js'
import { LIVE_LAYERS } from '../hooks/useLiveData.js'
import { INDICATORS } from '../data/metrics.js'
import { liveLayerOf } from '../lib/scoring.js'

// The live layers in words, in panel order: what each feeds (`role`) and, for an on-demand layer, what asks for it
// (`trigger`; its status is `off` until then). What it loads, from which service and when comes from the hook's registry
// (hooks/useLiveData.js LIVE_LAYERS): `single` (one request), `host` (an hourly or daily limit on that service holds it
// back), and `after` when it waits in the queue behind the scored layers.
const COPY = {
  aqi: { label: 'Air quality', role: 'Environment score' },
  thermal: { label: 'Heat & cold', role: 'Environment score' },
  uv: { label: 'UV', role: 'Environment score' },
  climate: { label: 'Climate', role: 'Climate map layers, extremes and warnings' },
  quakes: { label: 'Earthquakes', role: 'Earthquake count nearby' },
  flood: { label: 'Rivers', role: 'River flood watch', trigger: 'loads with the river flood watch' },
  climateGrid: { label: 'Climate surface', role: 'Fills the gaps between cities', trigger: 'loads with the climate surface' },
  uvGrid: { label: 'UV surface', role: 'Fills the gaps between cities', trigger: 'loads with the UV surface' },
}
// A layer feeds scores when a scored indicator's value comes from it: scores stay provisional until it finishes.
const SCORED_LAYERS = new Set(INDICATORS.filter((i) => i.better).map((i) => liveLayerOf(i.id)).filter(Boolean))
const LAYERS = Object.entries(COPY).map(([key, copy]) => {
  const l = LIVE_LAYERS.find((x) => x.key === key)
  return { key, ...copy, host: l.host, single: !!l.single, scored: SCORED_LAYERS.has(key), after: l.priority === PRIORITY.extra ? 'starts after the scored layers' : null }
})
const SCORED = LAYERS.filter((l) => l.scored).map((l) => l.label)
const HOSTS = new Set(LAYERS.map((l) => l.host))

const failed = (s) => s === 'error' || s === 'partial'
// A layer whose service is blocked by an hourly or daily limit: retrying it would fail at once.
const stalled = (i, notice) => !!notice?.hosts?.has(i.host)
const pct = (done, total) => (total ? Math.floor((done / total) * 100) : 0)
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** "<1 min left", "~3 min left", or null when there's no reliable rate yet. */
function timeLeft(remaining, rate) {
  if (!remaining || !(rate > 0)) return null
  const ms = remaining / rate
  return ms < 60_000 ? '<1 min left' : `~${Math.round(ms / 60_000)} min left`
}

// The current time, ticking every second during a pause, for its countdown. (The queue itself announces when a pause
// ends or a block lifts.)
function useNow(pausedUntil) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!pausedUntil) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0), id = setInterval(tick, 1000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [pausedUntil])
  return now
}

function Ring({ value }) {
  const r = 6, c = 2 * Math.PI * r
  return (
    <svg className="live-ring" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r={r} className="track" />
      <circle cx="8" cy="8" r={r} className="bar" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
    </svg>
  )
}

/** Each layer's state and the overall progress, failures, time left and score status, from the live hook's state. */
export function summarize({ status, progress = {}, startedAt }) {
  const all = LAYERS.filter((l) => status[l.key]).map((l) => {
    const s = status[l.key], p = progress[l.key] || { loaded: 0, failed: 0, total: 0 }
    const done = p.loaded + p.failed
    return { ...l, s, p, done, queued: s === 'loading' && done === 0 && !!l.after }
  })
  const off = all.filter((i) => i.s === 'off'), rows = all.filter((i) => i.s !== 'off')
  // The current round: layers started since it began (an on-demand layer asked for later starts a new one).
  const items = rows.filter((i) => (i.p.since ?? 0) >= (startedAt || 0))
  const busy = items.some((i) => i.s === 'loading')
  // Layers that finished with failures (retryable); failed places, counting those still loading.
  const problems = all.filter((i) => failed(i.s))
  const failedPoints = rows.reduce((n, i) => n + i.p.failed, 0)
  // Overall: points done over all points (the earthquake request counts as one).
  const total = items.reduce((n, i) => n + i.p.total, 0), done = items.reduce((n, i) => n + i.done, 0)
  const lastAt = Math.max(startedAt || 0, ...items.map((i) => i.p.at || 0))
  const overall = pct(done, total)
  // Time left from the overall rate, once enough has loaded for it to mean something. Only overall: layers share the
  // request queue, so one finishing speeds up the others and per-layer estimates would overstate what's left.
  const eta = busy && startedAt && overall >= 5 && lastAt - startedAt > 3000 ? timeLeft(total - done, done / (lastAt - startedAt)) : null
  // Ready out of every started layer, as the panel lists them (the overall % and time left are the current round's).
  const ready = rows.filter((i) => i.s === 'ready').length
  const scoresPending = items.some((i) => i.scored && i.s === 'loading')

  return { items, rows, off, busy, problems, failedPoints, overall, eta, ready, scoresPending }
}

/**
 * Retrying the failed layers, for the pill and the panel alike: those whose service is blocked by an hourly or daily
 * limit wait for it (they would fail at once). `run` retries the rest; `blocked` when none can be; `title` says until when.
 */
export function retryPlan(problems, notice, onRetry) {
  const layers = problems.filter((i) => !stalled(i, notice))
  const title = notice?.kind === 'blocked' ? `Open-Meteo’s limit lifts at about ${clock(notice.until)}` : undefined
  return { any: problems.length > 0, blocked: !layers.length, title, run: () => layers.forEach((i) => onRetry(i.key)) }
}

/**
 * What the request queue is doing about Open-Meteo's limits, in words: a pause after a per-minute 429 (requests resume
 * and retry on their own) or an hourly / daily block (requests fail until it lifts). Null when neither.
 */
export function queueNotice(queue, now) {
  const blocks = queue.blocked.filter((b) => HOSTS.has(b.host))
  if (blocks.length) {
    const hosts = new Set(blocks.map((b) => b.host)), until = Math.max(...blocks.map((b) => b.until))
    const limit = blocks.some((b) => b.limit === 'daily') ? 'daily' : 'hourly'
    const layers = LAYERS.filter((l) => hosts.has(l.host)).map((l) => l.label).join(', ')
    return { kind: 'blocked', hosts, until, short: `Open-Meteo limit until ${clock(until)}`, text: `${limitText(limit)} (${layers}). Those layers can’t load until about ${clock(until)}; what already loaded stays. Retry then.` }
  }
  if (queue.pausedUntil > now) {
    const s = Math.max(1, Math.ceil((queue.pausedUntil - now) / 1000))
    return { kind: 'paused', short: `paused · ${s} s`, text: `Open-Meteo’s per-minute limit was reached: requests resume in ${s} s and retry on their own.` }
  }
  return null
}

const stateText = (i) => (i.queued ? `Queued${i.after ? `: ${i.after}` : ''}`
  : i.s === 'loading' ? (i.single ? 'Loading' : `${i.done}/${i.p.total}${i.p.failed ? ` · ${i.p.failed} failed` : ''}`)
    : i.s === 'ready' ? 'Ready'
      : i.s === 'partial' ? `${i.p.failed} of ${i.p.total} failed`
        : 'Failed')

// What a failure means for the user, after the error itself.
const impact = (i) => (i.s === 'loading' ? 'You can retry once the layer finishes.'
  : !i.scored ? '' : i.s === 'partial' ? 'Scores use the places that loaded.' : 'Scores leave this layer out.')

/** Each layer's status: what it feeds, its progress, queued / loading / ready / failed, and retry. */
export function LivePanel({ rows, off, busy, overall, eta, ready, scoresPending, errors = {}, notice, plan, onLoad, onRetry }) {
  return (
    <div className="live-panel glass" id="live-panel" aria-label="Live data status">
      <div className="live-panel-head">
        <b>Live data</b>
        <span className="muted small">{busy ? `${overall}% · ${ready} of ${rows.length} ready${eta ? ` · ${eta}` : ''}` : `${ready} of ${rows.length} ready`}</span>
        {plan.any && (
          <button className="btn sm" onClick={plan.run} disabled={plan.blocked} title={plan.title}>
            <RotateCw size={12} /> Retry failed
          </button>
        )}
      </div>
      {notice && <p className={`live-notice ${notice.kind}`} role="alert"><PauseCircle size={13} /> {notice.text}</p>}
      <ul className="live-rows">
        {rows.map((i) => { const stuck = stalled(i, notice); return (
          <li key={i.key} className={`live-row ${i.queued ? 'queued' : i.s}`}>
            <span className="live-icon">
              {i.queued ? <Clock size={13} /> : i.s === 'loading' ? <LoaderCircle size={13} className="spin" /> : failed(i.s) ? <CircleAlert size={13} /> : <Check size={13} />}
            </span>
            <span className="live-name">{i.label}<small>{i.role}{i.scored && i.s === 'loading' ? ' · scores update when done' : ''}</small></span>
            <span className="live-bar" aria-hidden="true"><span style={{ width: `${pct(i.done, i.p.total)}%` }} /></span>
            <span className="live-state">
              {failed(i.s)
                ? <button className="btn sm" onClick={() => onRetry(i.key)} disabled={stuck} title={stuck ? plan.title : undefined} aria-label={`Retry ${i.label}`}><RotateCw size={12} /> Retry</button>
                : stateText(i)}
            </span>
            {(failed(i.s) || i.p.failed > 0) && errors[i.key] && (
              <span className="live-error">{failed(i.s) && `${stateText(i)}: `}{errors[i.key]}. {impact(i)}</span>
            )}
          </li>
        ) })}
        {off.map((i) => (
          <li key={i.key} className="live-row off">
            <span className="live-icon"><CloudDownload size={13} /></span>
            <span className="live-name">{i.label}<small>{i.role} · {i.trigger}</small></span>
            <span className="live-state"><button className="btn sm" onClick={() => onLoad(i.key)}>Load</button></span>
          </li>
        ))}
      </ul>
      <p className="muted small live-note">
        {scoresPending && <>Scores are provisional until {SCORED.join(', ')} finish. </>}
        Requests are paced to Open-Meteo’s free limit (600 calls a minute), so large countries fill in over a few minutes; results are cached for the next visit.
      </p>
    </div>
  )
}

/**
 * Loading status of the live layers: one pill with overall progress, failures, time left and whether scores are
 * final, plus a Retry button when layers failed; a click opens each layer's status. Hidden once all loaded.
 */
export function LiveStatus({ status, progress = {}, errors = {}, error, startedAt, onLoad, onRetry }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(ref, open, useCallback(() => setOpen(false), []))
  const queue = useSyncExternalStore(meteo.subscribe, meteo.status)
  const now = useNow(queue.pausedUntil)

  const sum = summarize({ status, progress, startedAt })
  const { busy, problems, failedPoints, overall, eta, ready, rows, scoresPending } = sum
  const notice = queueNotice(queue, now)
  if (!busy && !problems.length && !error) return null
  const plan = retryPlan(problems, notice, onRetry)

  return (
    <div className="live-status" ref={ref} role="status">
      {open && <LivePanel {...sum} errors={errors} notice={notice} plan={plan} onLoad={onLoad} onRetry={onRetry} />}
      {error && (
        <span className="live-pill glass error">
          <CircleAlert size={13} /> <b>Map data failed to load</b>
          <button className="btn sm" onClick={() => window.location.reload()}><RotateCw size={12} /> Reload</button>
        </span>
      )}
      {(busy || problems.length > 0) && (
        <span className={`live-pill glass${busy ? '' : ' warn'}${failedPoints || notice ? ' alert' : ''}`}>
          <button className="live-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="live-panel"
            title={open ? 'Hide details' : 'Show each layer’s status'}>
            {busy ? <Ring value={overall} /> : <CircleAlert size={14} className="warn-icon" />}
            <b>{busy ? `Live data ${overall}%` : <>Live data incomplete<span className="live-extra">: {problems.map((i) => i.label).join(', ')}</span></>}</b>
            {failedPoints > 0 && <span className="live-fail">{failedPoints} failed</span>}
            {notice ? <span className="live-wait">{notice.short}</span> : eta && <span className="live-extra">{eta}</span>}
            {busy && <span className="live-extra">{ready} of {rows.length} ready</span>}
            {scoresPending && <span className="live-provisional live-extra">scores provisional</span>}
            {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
          {!busy && problems.length > 0 && (
            <button className="btn sm" onClick={plan.run} disabled={plan.blocked}
              title={plan.blocked ? plan.title : 'Load the failed layers again'}>
              <RotateCw size={12} /> Retry
            </button>
          )}
        </span>
      )}
    </div>
  )
}
