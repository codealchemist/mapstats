import { useEffect, useMemo, useState } from 'react'
import { X, ExternalLink, Search, Database } from 'lucide-react'
import { SOURCES, SOURCE_META, DATA_TYPES, ACCESS, familyOfSource, indicatorsOfSource } from '../data/sources.js'
import { BASE } from '../lib/sourceWeights.js'
import { fold } from '../lib/format.js'

// What sources without indicators are used for.
const USED_FOR = {
  'SNIC mirror': 'Files behind the current SNIC import (replace with the official downloads)',
  Departments: 'Matching each city to its SNIC department',
  Terrain: 'Terrain & elevation overlay',
  CARTO: 'Base map',
  Geocoding: 'Search for places outside the city list',
  'Natural Earth': 'Region boundaries; city list for countries without curated data',
  'Open-Meteo UV (live)': 'UV today and the 3-month UV chart in reports',
  'Open-Meteo ERA5 (live)': 'Climate charts, comfort model, climate surfaces',
  'Open-Meteo CAMS (live)': 'Air-quality charts in reports',
  'USGS (live)': 'Earthquake overlay and report charts',
  'Open-Meteo GloFAS (live)': 'River flood watch overlay',
  'Open-Meteo UV history (live)': 'UV climate surface',
  'Google News RSS': '“In the news” section of reports (never used in scores)',
  'Outlet RSS': '“In the news” section of reports',
  'News service': 'Article excerpts and images in “In the news”',
}

export function SourcesView({ onClose, curated }) {
  const [q, setQ] = useState('')
  const [access, setAccess] = useState('all')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const sources = useMemo(() => Object.entries(SOURCES).map(([key, s]) => {
    const meta = SOURCE_META[key] || { types: ['geo'], access: 'bundled' }
    const indicators = indicatorsOfSource(key)
    // Raw files behind an imported series, when the loaded country uses this source.
    const origin = Object.values(curated?.official || {}).find((o) => o.key === key)?.origin || null
    return { key, ...s, ...meta, indicators, origin, weight: indicators.length ? BASE[familyOfSource(key)]?.w ?? null : null }
  }), [curated])

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
          {['live', 'import', 'snapshot', 'manual'].map((a) => (
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
                      {s.origin && <><dt>Files</dt><dd>{s.origin}</dd></>}
                    </dl>
                    {(s.indicators.length > 0 || USED_FOR[s.key]) && (
                      <div className="src-used">
                        <span className="muted small">Used for</span>
                        {USED_FOR[s.key] && <span className="pill static">{USED_FOR[s.key]}</span>}
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
