import { useEffect, useMemo, useState } from 'react'
import { X, ExternalLink, Search, Database } from 'lucide-react'
import { INDICATORS } from '../data/metrics.js'
import { PROVIDERS, providerOf, familyOf, familyBase } from '../core/providers.js'
import { ACCESS, DATA_TYPES } from '../core/define.js'
import { fold } from '../lib/format.js'

export function SourcesView({ onClose, datasets = {} }) {
  const [q, setQ] = useState('')
  const [access, setAccess] = useState('all')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sources = useMemo(() => PROVIDERS.map((p) => {
    const indicators = INDICATORS.filter((i) => providerOf(i.id) === p)
    const family = indicators.length ? familyOf(indicators[0].id) : null
    return { ...p, key: p.id, indicators, weight: familyBase(family)?.w ?? null }
  }), [])

  const needle = fold(q.trim())
  const visible = sources.filter((s) =>
    (access === 'all' || s.access === access) &&
    (!needle || fold(`${s.name} ${s.covers} ${s.indicators.map((i) => i.label).join(' ')}`).includes(needle)))
  const counts = Object.fromEntries(Object.keys(ACCESS).map((a) => [a, sources.filter((s) => s.access === a).length]))

  return (
    <div className="fullview" role="dialog" aria-modal="true" aria-labelledby="sources-title">
      <header className="fullview-head">
        <div className="fullview-title">
          <Database size={18} />
          <h2 id="sources-title">Data sources</h2>
          <span className="muted">{sources.length} sources behind every number in MapStats</span>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
      </header>

      <div className="fullview-body">
        <div className="tiles src-tiles">
          {['live', 'import', 'manual', 'link'].map((a) => (
            <button key={a} className={`tile tile-btn ${access === a ? 'active' : ''}`} onClick={() => setAccess(access === a ? 'all' : a)} title={ACCESS[a].detail}>
              <div className="tile-label">{ACCESS[a].label}</div>
              <div className="tile-value">{counts[a]}</div>
              <div className="muted small">{ACCESS[a].detail}</div>
            </button>
          ))}
        </div>

        <div className="src-toolbar">
          <div className="search-inline">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter sources or indicators…" aria-label="Filter sources" />
          </div>
          <div className="segmented">
            <button className={access === 'all' ? 'active' : ''} onClick={() => setAccess('all')}>All</button>
            {Object.entries(ACCESS).map(([k, a]) => counts[k] > 0 && (
              <button key={k} className={access === k ? 'active' : ''} onClick={() => setAccess(k)}>{a.label}</button>
            ))}
          </div>
        </div>

        {DATA_TYPES.map((t) => {
          const list = visible.filter((s) => s.types.includes(t.id))
          if (!list.length) return null
          return (
            <section key={t.id} className="src-type">
              <h3 className="eyebrow">{t.label} · {list.length}</h3>
              <div className="src-cards">
                {list.map((s) => (
                  <article key={s.key} className="src-card">
                    <div className="src-card-head">
                      {s.url
                        ? <a href={s.url} target="_blank" rel="noreferrer" className="src-card-name">{s.name} <ExternalLink size={12} /></a>
                        : <span className="src-card-name">{s.name}</span>}
                      <span className={`tag access-${s.access}`} title={ACCESS[s.access].detail}>{ACCESS[s.access].label}</span>
                    </div>
                    <p className="src-covers">{s.covers}</p>
                    <dl className="src-facts">
                      {s.scope && <><dt>Coverage</dt><dd>{s.scope}</dd></>}
                      {s.cadence && <><dt>Updates</dt><dd>{s.cadence}</dd></>}
                      {s.weight != null && <><dt>Reliability</dt><dd>×{s.weight.toFixed(1)} in the weighted score</dd></>}
                      {datasets[s.id]?.origin?.notes && <><dt>Origin</dt><dd>{datasets[s.id].origin.notes}</dd></>}
                    </dl>
                    {(s.indicators.length > 0 || s.usedFor) && (
                      <div className="src-used">
                        <span className="muted small">Used for</span>
                        {s.usedFor && <span className="pill static">{s.usedFor}</span>}
                        {s.indicators.map((i) => <span key={i.id} className="pill static">{i.label}</span>)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )
        })}
        {!visible.length && <div className="empty">No sources match.</div>}
      </div>
    </div>
  )
}
