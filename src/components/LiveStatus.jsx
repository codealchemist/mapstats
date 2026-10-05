import { LoaderCircle, Check, CircleAlert } from 'lucide-react'

const LABELS = { climate: 'Climate', aqi: 'Air quality', quakes: 'Earthquakes', uv: 'UV', flood: 'Rivers' }

export function LiveStatus({ status, error }) {
  const entries = Object.entries(status)
  const busy = entries.some(([, s]) => s === 'loading')
  const failed = entries.some(([, s]) => s === 'error')
  if (!busy && !failed && !error) return null
  return (
    <div className="live-status glass" role="status">
      {error && <span className="st error"><CircleAlert size={13} /> Map data failed to load</span>}
      {entries.map(([k, s]) => (
        <span key={k} className={`st ${s}`} title={s === 'error' ? `${LABELS[k]} could not be loaded (network or rate limit). Scores use the remaining data.` : undefined}>
          {s === 'loading' ? <LoaderCircle size={13} className="spin" /> : s === 'error' ? <CircleAlert size={13} /> : <Check size={13} />}
          {LABELS[k]}
        </span>
      ))}
    </div>
  )
}
