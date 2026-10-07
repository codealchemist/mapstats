import { LoaderCircle, Check, CircleAlert } from 'lucide-react'

const failed = (s) => s === 'error' || s === 'partial'

const LABELS = { climate: 'Climate', aqi: 'Air quality', quakes: 'Earthquakes', uv: 'UV', flood: 'Rivers' }

function tooltip(label, s, p, error) {
  if (s === 'loading' && p) return `${label}: ${p.loaded} of ${p.total} places loaded. Requests are paced to Open-Meteo's free limit (600 calls a minute), so large countries fill in over a few minutes.`
  if (s === 'partial') return `${label}: ${p.failed} of ${p.total} places could not be loaded (${error}). Scores use the rest; reload later to fill the gaps.`
  if (s === 'error') return `${label} could not be loaded (${error || 'network or rate limit'}). Scores use the remaining data.`
}

export function LiveStatus({ status, progress = {}, errors = {}, error }) {
  const entries = Object.entries(status)
  const busy = entries.some(([, s]) => s === 'loading')
  const anyFailed = entries.some(([, s]) => failed(s))
  if (!busy && !anyFailed && !error) return null
  return (
    <div className="live-status glass" role="status">
      {error && <span className="st error"><CircleAlert size={13} /> Map data failed to load</span>}
      {entries.map(([k, s]) => {
        const p = progress[k]
        return (
          <span key={k} className={`st ${s}`} title={tooltip(LABELS[k], s, p, errors[k])}>
            {s === 'loading' ? <LoaderCircle size={13} className="spin" /> : failed(s) ? <CircleAlert size={13} /> : <Check size={13} />}
            {LABELS[k]}
            {s === 'loading' && p && <span className="st-count">{p.loaded}/{p.total}</span>}
          </span>
        )
      })}
    </div>
  )
}
