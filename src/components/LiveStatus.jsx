import { useCallback, useRef, useState } from 'react'
import { LoaderCircle, Check, CircleAlert, Clock, ChevronUp, ChevronDown } from 'lucide-react'
import { useDismiss } from '../hooks/useDismiss.js'

// Live layers, in panel order, with what each one feeds. `scored`: scores stay provisional until it finishes.
// `after`: it waits in the request queue for the others (lower priority). `single`: one request, outside the queue.
const LAYERS = [
  { key: 'aqi', label: 'Air quality', role: 'Environment score', scored: true },
  { key: 'thermal', label: 'Heat & cold', role: 'Environment score', scored: true },
  { key: 'uv', label: 'UV', role: 'Environment score', scored: true },
  { key: 'climate', label: 'Climate', role: 'Climate map layers, extremes and warnings' },
  { key: 'flood', label: 'Rivers', role: 'River flood watch', after: 'starts after the layers above' },
  { key: 'quakes', label: 'Earthquakes', role: 'Earthquake count nearby', single: true }, // one USGS request, not queued
]
const SCORED = LAYERS.filter((l) => l.scored).map((l) => l.label)

const failed = (s) => s === 'error' || s === 'partial'
const pct = (done, total) => (total ? Math.floor((done / total) * 100) : 0)

/** "<1 min left", "~3 min left", or null when there's no reliable rate yet. */
function timeLeft(remaining, rate) {
  if (!remaining || !(rate > 0)) return null
  const ms = remaining / rate
  return ms < 60_000 ? '<1 min left' : `~${Math.round(ms / 60_000)} min left`
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

/** Each layer's state and the overall progress, time left and score status, from the live hook's status and progress. */
export function summarize({ status, progress = {}, startedAt }) {
  const items = LAYERS.filter((l) => status[l.key]).map((l) => {
    const s = status[l.key], p = progress[l.key] || { loaded: 0, failed: 0, total: 0 }
    const done = p.loaded + p.failed
    return { ...l, s, p, done, queued: s === 'loading' && done === 0 && !!l.after }
  })
  const busy = items.some((i) => i.s === 'loading')
  const problems = items.filter((i) => failed(i.s))
  // Overall: points done over all points (the earthquake request counts as one).
  const total = items.reduce((n, i) => n + i.p.total, 0), done = items.reduce((n, i) => n + i.done, 0)
  const lastAt = Math.max(startedAt || 0, ...items.map((i) => i.p.at || 0))
  const overall = pct(done, total)
  // Time left from the overall rate, once enough has loaded for it to mean something. Only overall: layers share the
  // request queue, so one finishing speeds up the others and per-layer estimates would overstate what's left.
  const eta = busy && startedAt && overall >= 5 && lastAt - startedAt > 3000 ? timeLeft(total - done, done / (lastAt - startedAt)) : null
  const ready = items.filter((i) => i.s === 'ready').length
  const scoresPending = items.some((i) => i.scored && i.s === 'loading')

  return { items, busy, problems, overall, eta, ready, scoresPending }
}

/** Each layer's status: what it feeds, its progress, and queued / loading / ready / failed. */
export function LivePanel({ items, busy, overall, eta, ready, scoresPending, errors = {} }) {
  return (
    <div className="live-panel glass" id="live-panel" aria-label="Live data status">
      <div className="live-panel-head">
        <b>Live data</b>
        <span className="muted small">{busy ? `${overall}% · ${ready} of ${items.length} ready${eta ? ` · ${eta}` : ''}` : `${ready} of ${items.length} ready`}</span>
      </div>
      <ul className="live-rows">
        {items.map((i) => (
          <li key={i.key} className={`live-row ${i.queued ? 'queued' : i.s}`} title={errors[i.key] || undefined}>
            <span className="live-icon">
              {i.queued ? <Clock size={13} /> : i.s === 'loading' ? <LoaderCircle size={13} className="spin" /> : failed(i.s) ? <CircleAlert size={13} /> : <Check size={13} />}
            </span>
            <span className="live-name">{i.label}<small>{i.role}{i.scored && i.s === 'loading' ? ' · scores update when done' : ''}</small></span>
            <span className="live-bar" aria-hidden="true"><span style={{ width: `${pct(i.done, i.p.total)}%` }} /></span>
            <span className="live-state">
              {i.queued ? `Queued${i.after ? `: ${i.after}` : ''}`
                : i.s === 'loading' ? (i.single ? 'Loading' : `${i.done}/${i.p.total}`)
                  : i.s === 'ready' ? 'Ready'
                    : i.s === 'partial' ? `${i.p.failed} of ${i.p.total} failed`
                      : 'Failed'}
            </span>
            {failed(i.s) && errors[i.key] && <span className="live-error">{errors[i.key]}. {!i.scored ? 'Reload later to fill the gaps.' : i.s === 'partial' ? 'Scores use the places that loaded; reload later to fill the gaps.' : 'Scores use the remaining data; reload later.'}</span>}
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
 * Loading status of the live layers: one pill with overall progress, time left and whether scores are final; a click
 * opens each layer's status (what it feeds, progress, queued / loading / ready / failed). Hidden once all loaded.
 */
export function LiveStatus({ status, progress = {}, errors = {}, error, startedAt }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useDismiss(ref, open, useCallback(() => setOpen(false), []))

  const sum = summarize({ status, progress, startedAt })
  const { busy, problems, overall, eta, ready, items, scoresPending } = sum
  if (!busy && !problems.length && !error) return null

  return (
    <div className="live-status" ref={ref} role="status">
      {open && <LivePanel {...sum} errors={errors} />}
      {error && <span className="live-pill glass st error"><CircleAlert size={13} /> Map data failed to load</span>}
      {(busy || problems.length > 0) && (
        <button className={`live-pill glass${busy ? '' : ' warn'}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="live-panel"
          title={open ? 'Hide details' : 'Show each layer’s status'}>
          {busy ? <Ring value={overall} /> : <CircleAlert size={14} className="warn-icon" />}
          <b>{busy ? `Live data ${overall}%` : `Live data incomplete: ${problems.map((i) => i.label).join(', ')}`}</b>
          {busy && <span>{ready} of {items.length} ready</span>}
          {eta && <span>{eta}</span>}
          {scoresPending && <span className="live-provisional">scores provisional</span>}
          {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </button>
      )}
    </div>
  )
}
