import { ExternalLink } from 'lucide-react'
import { providerById } from '../core/providers.js'

// Small link buttons that open the sources (provider ids) behind a category, section or layer.
// `entity` lets sources deep-link to a specific place (e.g. a city's Numbeo page).
export function SourceButtons({ keys, entity, category, label = 'Sources' }) {
  if (!keys?.length) return null
  return (
    <div className="src-btns">
      {label && <span className="src-label">{label}</span>}
      {keys.map((k) => {
        const s = providerById(k)
        const href = s.urlFor?.(entity, category) || s.url
        return href ? (
          <a key={k} className="src-btn" href={href} target="_blank" rel="noreferrer" title={`${s.name} — ${s.covers}`}>
            {s.name} <ExternalLink size={11} />
          </a>
        ) : (
          <span key={k} className="src-btn static" title={s.covers}>{s.name}</span>
        )
      })}
    </div>
  )
}
