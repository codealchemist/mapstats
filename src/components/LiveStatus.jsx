import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LoaderCircle, Check, CircleAlert, Clock, ChevronUp, ChevronDown, CloudDownload, RotateCw, PauseCircle } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss.js'
import { meteo } from '../lib/meteoQueue.js'

// Live layers, in panel order, with what each one feeds. `scored`: scores stay provisional until it finishes.
// `after`: it waits in the request queue for the others (lower priority). `single`: one request, outside the queue.
// `trigger`: what asks for a layer that loads on demand (hooks/useLiveData.js; its status is `off` until then).
// `host`: the Open-Meteo API it calls (lib/live.js): an hourly or daily limit blocks one host, not the others.
const LAYERS = [
  { key: 'aqi', label: 'Air quality', role: 'Environment score', scored: true, host: 'air-quality-api.open-meteo.com' },
  { key: 'thermal', label: 'Heat & cold', role: 'Environment score', scored: true, host: 'archive-api.open-meteo.com' },
  { key: 'uv', label: 'UV', role: 'Environment score', scored: true, host: 'historical-forecast-api.open-meteo.com' },
  { key: 'climate', label: 'Climate', role: 'Climate map layers, extremes and warnings', after: 'starts after the scored layers', host: 'archive-api.open-meteo.com' },
  { key: 'quakes', label: 'Earthquakes', role: 'Earthquake count nearby', single: true }, // one USGS request, not queued
  { key: 'flood', label: 'Rivers', role: 'River flood watch', trigger: 'loads with the river flood watch', host: 'flood-api.open-meteo.com' },
  { key: 'climateGrid', label: 'Climate surface', role: 'Fills the gaps between cities', trigger: 'loads with the climate surface', host: 'archive-api.open-meteo.com' },
  { key: 'uvGrid', label: 'UV surface', role: 'Fills the gaps between cities', trigger: 'loads with the UV surface', host: 'historical-forecast-api.open-meteo.com' },
]
const SCORED = LAYERS.filter((l) => l.scored).map((l) => l.label)

const failed = (s) => s === 'error' || s === 'partial'
// A layer whose Open-Meteo host is blocked by an hourly or daily limit: retrying it would fail at once.
const stalled = (i, notice) => !!i.host && !!notice?.hosts?.has(i.host)
const pct = (done, total) => (total ? Math.floor((done / total) * 100) : 0)
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** "<1 min left", "~3 min left", or null when there's no reliable rate yet. */
function timeLeft(remaining, rate) {
  if (!remaining || !(rate > 0)) return null
  const ms = remaining / rate
  return ms < 60_000 ? '<1 min left' : `~${Math.round(ms / 60_000)} min left`
}

// The current time, ticking every second while `active` (a countdown is on screen); otherwise it stays put.
function useNow(active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now())
    const first = setTimeout(tick, 0), id = setInterval(tick, 1000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [active])
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
  // Layers that finished with failures (retryable), and failures so far among those still loading.
  const problems = all.filter((i) => failed(i.s))
  const failing = rows.filter((i) => i.s === 'loading' && i.p.failed > 0)
  const failedPoints = [...problems, ...failing].reduce((n, i) => n + i.p.failed, 0)
  // Overall: points done over all points (the earthquake request counts as one).
  const total = items.reduce((n, i) => n + i.p.total, 0), done = items.reduce((n, i) => n + i.done, 0)
  const lastAt = Math.max(startedAt || 0, ...items.map((i) => i.p.at || 0))
  const overall = pct(done, total)
  // Time left from the overall rate, once enough has loaded for it to mean something. Only overall: layers share the
  // request queue, so one finishing speeds up the others and per-layer estimates would overstate what's left.
  const eta = busy && startedAt && overall >= 5 && lastAt - startedAt > 3000 ? timeLeft(total - done, done / (lastAt - startedAt)) : null
  const ready = items.filter((i) => i.s === 'ready').length
  const scoresPending = items.some((i) => i.scored && i.s === 'loading')

  return { items, rows, off, busy, problems, failing, failedPoints, overall, eta, ready, scoresPending }
}

/**
 * What the request queue is doing about Open-Meteo's limits, in words: a pause after a per-minute 429 (requests resume
 * and retry on their own) or an hourly / daily block (requests fail until it lifts). Null when neither.
 */
export function queueNotice(queue, now) {
  const blocks = queue.blocked.filter((b) => b.host.endsWith('open-meteo.com'))
  if (blocks.length) {
    const hosts = new Set(blocks.map((b) => b.host)), until = Math.max(...blocks.map((b) => b.until))
    const limit = blocks.some((b) => b.limit === 'daily') ? 'daily' : 'hourly'
    const layers = LAYERS.filter((l) => hosts.has(l.host)).map((l) => l.label).join(', ')
    return { kind: 'blocked', hosts, until, short: `Open-Meteo limit until ${clock(until)}`, text: `Open-Meteo’s ${limit} limit for this connection was reached (${layers}). Those layers can’t load until about ${clock(until)}; what already loaded stays. Retry then.` }
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
export function LivePanel({ rows, off, items, busy, problems, overall, eta, ready, scoresPending, errors = {}, notice, onLoad, onRetry }) {
  const retryTitle = notice?.kind === 'blocked' ? `Open-Meteo’s limit lifts at about ${clock(notice.until)}` : undefined
  return (
    <div className="live-panel glass" id="live-panel" aria-label="Live data status">
      <div className="live-panel-head">
        <b>Live data</b>
        <span className="muted small">{busy ? `${overall}% · ${ready} of ${items.length} ready${eta ? ` · ${eta}` : ''}` : `${ready} of ${items.length} ready`}</span>
        {problems.length > 0 && (
          <button className="btn sm live-retry-all" onClick={() => problems.filter((i) => !stalled(i, notice)).forEach((i) => onRetry(i.key))} disabled={problems.every((i) => stalled(i, notice))} title={retryTitle}>
            <RotateCw size={12} /> Retry failed
          </button>
        )}
      </div>
      {notice && <p className={`live-notice ${notice.kind}`} role="alert"><PauseCircle size={13} /> {notice.text}</p>}
      <ul className="live-rows">
        {rows.map((i) => (
          <li key={i.key} className={`live-row ${i.queued ? 'queued' : i.s}`}>
            <span className="live-icon">
              {i.queued ? <Clock size={13} /> : i.s === 'loading' ? <LoaderCircle size={13} className="spin" /> : failed(i.s) ? <CircleAlert size={13} /> : <Check size={13} />}
            </span>
            <span className="live-name">{i.label}<small>{i.role}{i.scored && i.s === 'loading' ? ' · scores update when done' : ''}</small></span>
            <span className="live-bar" aria-hidden="true"><span style={{ width: `${pct(i.done, i.p.total)}%` }} /></span>
            <span className="live-state">
              {failed(i.s)
                ? <button className="btn sm" onClick={() => onRetry(i.key)} disabled={stalled(i, notice)} title={stalled(i, notice) ? retryTitle : undefined} aria-label={`Retry ${i.label}`}><RotateCw size={12} /> Retry</button>
                : stateText(i)}
            </span>
            {(failed(i.s) || i.p.failed > 0) && errors[i.key] && (
              <span className="live-error">{failed(i.s) && `${stateText(i)}: `}{errors[i.key]}. {impact(i)}</span>
            )}
          </li>
        ))}
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
  const now = useNow(queue.pausedUntil > 0 || queue.blocked.length > 0)

  const sum = summarize({ status, progress, startedAt })
  const { busy, problems, failedPoints, overall, eta, ready, items, scoresPending } = sum
  const notice = queueNotice(queue, now)
  if (!busy && !problems.length && !error) return null
  const blocked = problems.every((i) => stalled(i, notice))

  return (
    <div className="live-status" ref={ref} role="status">
      {open && <LivePanel {...sum} errors={errors} notice={notice} onLoad={onLoad} onRetry={onRetry} />}
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
            {busy && <span className="live-extra">{ready} of {items.length} ready</span>}
            {scoresPending && <span className="live-provisional live-extra">scores provisional</span>}
            {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
          {!busy && problems.length > 0 && (
            <button className="btn sm live-retry" onClick={() => problems.filter((i) => !stalled(i, notice)).forEach((i) => onRetry(i.key))} disabled={blocked}
              title={blocked ? `Open-Meteo’s limit lifts at about ${clock(notice.until)}` : 'Load the failed layers again'}>
              <RotateCw size={12} /> Retry
            </button>
          )}
        </span>
      )}
    </div>
  )
}
