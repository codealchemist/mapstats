import { useMemo, useState } from 'react'
import { Layers, Trophy, SlidersHorizontal, FileSpreadsheet, FileText, RotateCcw, Info, LoaderCircle } from 'lucide-react'
import { CATEGORIES, DEFAULT_WEIGHTS, MAP_METRICS, indicatorById } from '../data/metrics.js'
import { ICONS } from './icons.js'
import { fmtScore } from '../lib/format.js'
import { downloadBlob, rankingCsv, rankingPdf } from '../lib/export.js'
import { slug } from '../lib/format.js'
import { useToast } from './Toast.jsx'
import { SourceButtons } from './SourceButtons.jsx'
import { sourcesForIndicators, familiesFor, familyOf, familyById, isMultiSource } from '../data/sources.js'
import { INDICATORS } from '../data/metrics.js'
import { SURFACE_VARS } from '../lib/surface.js'

const TABS = [
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'weights', label: 'Weights', icon: SlidersHorizontal },
]

export function SidePanel(props) {
  const [tab, setTab] = useState('layers')
  return (
    <aside className="side-panel glass">
      <SourcePicker mode={props.sourceMode} onChange={props.onSourceMode} country={props.country} />
      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </nav>
      <div className="panel-scroll">
        {tab === 'layers' && <LayersTab {...props} />}
        {tab === 'ranking' && <RankingTab {...props} />}
        {tab === 'weights' && <WeightsTab {...props} />}
      </div>
    </aside>
  )
}

// ---------------- Layers ----------------

const OVERLAYS = [
  { id: 'choropleth', label: 'Region fill', hint: 'Colour regions by the selected metric' },
  { id: 'cities', label: 'City markers', hint: 'Sized by population' },
  { id: 'labels', label: 'City labels' },
  { id: 'heat', label: 'Livability heat map', hint: 'Hot spots of high MapStats score' },
  { id: 'quakes', label: 'Earthquakes M5+', hint: 'USGS catalogue since 1980' },
  { id: 'relief', label: 'Terrain & elevation', hint: 'Hillshade + elevation colour relief' },
  { id: 'flood', label: 'River flood watch', hint: 'GloFAS 30-day forecast peak vs each river’s usual high water', status: 'flood' },
  { id: 'surface', label: 'Climate surface', hint: 'Interpolated map of a climate variable', status: 'climate' },
]

function LayersTab({ model, country, live, metricId, onMetric, overlays, onOverlays, onInfo, sourceMode }) {
  // In a single-source view, only that source's indicators (and the categories it covers) are listed.
  const inSource = (m) => {
    if (isMultiSource(sourceMode) || m.id === 'score') return true
    if (m.kind === 'score') return INDICATORS.some((i) => i.better && i.category === m.id.slice(4) && familyOf(i.id, country.iso3) === sourceMode)
    return familyOf(m.id, country.iso3) === sourceMode
  }
  const groups = useMemo(() => {
    const g = {}
    for (const m of MAP_METRICS.filter(inSource)) (g[m.group] ||= []).push(m)
    return Object.entries(g)
  }, [sourceMode, country.iso3]) // eslint-disable-line react-hooks/exhaustive-deps

  const available = (m) => {
    if (!model || m.kind === 'score') return true
    return [...model.provinces, ...model.cities].some((e) => e.values[m.id] != null)
  }
  const pending = (m) => {
    if (m.kind === 'score') return false
    const ind = indicatorById[m.id]
    if (!ind?.live) return false
    const src = m.id === 'aqi' ? 'aqi' : m.id === 'quakes' ? 'quakes' : 'climate'
    return live.status[src] === 'loading'
  }

  return (
    <>
      <section className="section">
        <h3 className="eyebrow">Overlays</h3>
        <div className="toggles">
          {OVERLAYS.map((o) => (
            <label key={o.id} className="toggle-row" title={o.hint}>
              <span>
                {o.label}
                {((o.id === 'quakes' && live.status.quakes === 'loading') || (o.status && live.status[o.status] === 'loading') || (o.id === 'surface' && overlays.surfaceVar === 'uvMean' && live.status.uv === 'loading')) && <LoaderCircle size={12} className="spin muted inline" />}
              </span>
              <input type="checkbox" className="switch" checked={overlays[o.id]} onChange={(e) => onOverlays((s) => ({ ...s, [o.id]: e.target.checked }))} />
            </label>
          ))}
        </div>
        {overlays.surface && (
          <div className="select-wrap surface-select">
            <select value={overlays.surfaceVar} onChange={(e) => onOverlays((s) => ({ ...s, surfaceVar: e.target.value }))} aria-label="Climate surface variable">
              {SURFACE_VARS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
        )}
        <SourceButtons keys={['Natural Earth', 'USGS (live)', 'Terrain', 'Open-Meteo GloFAS (live)', 'Open-Meteo ERA5 (live)', 'Open-Meteo UV history (live)']} />
      </section>
      {groups.map(([group, metrics]) => (
        <section className="section" key={group}>
          <h3 className="eyebrow">{group}</h3>
          <div className="metric-list">
            {metrics.map((m) => {
              const Icon = ICONS[m.icon] || Layers
              const ok = available(m)
              const wait = pending(m)
              return (
                <button
                  key={m.id}
                  className={`metric ${metricId === m.id ? 'active' : ''}`}
                  disabled={!ok && !wait}
                  onClick={() => onMetric(m.id)}
                  title={ok ? m.label : wait ? 'Loading live data…' : 'No data for this country'}
                >
                  <Icon size={15} />
                  <span>{m.label}</span>
                  {wait ? <LoaderCircle size={13} className="spin muted" /> : indicatorById[m.id]?.live ? <span className="badge">live</span> : null}
                </button>
              )
            })}
          </div>
          {group === 'Ranking' ? (
            <div className="src-btns">
              <span className="src-label">Sources</span>
              <button className="src-btn" onClick={onInfo}>All sources & methodology <Info size={11} /></button>
            </div>
          ) : (
            <SourceButtons keys={sourcesForIndicators(metrics.filter((m) => m.kind === 'indicator' && available(m)).map((m) => m.id), country.iso3)} />
          )}
        </section>
      ))}
    </>
  )
}

// ---------------- Ranking ----------------

function RankingTab({ model, country, selected, onSelect, mapRef, sourceMode }) {
  const [kind, setKind] = useState('province')
  const toast = useToast()
  if (!model) return <div className="empty">Loading…</div>
  const list = (kind === 'city' ? model.cities : model.provinces).filter((e) => e.score != null).sort((a, b) => a.rank - b.rank)
  const avg = model.national.score

  const exportCsv = () => {
    downloadBlob(rankingCsv([...model.provinces, ...model.cities], country.regionLabel), `mapstats-${slug(country.name)}.csv`)
    toast('CSV downloaded')
  }
  const exportPdf = async () => {
    try {
      const snap = mapRef.current?.snapshot()
      await rankingPdf({ entities: list, countryName: country.name, regionLabel: country.regionLabel, mapImage: snap, kind })
      toast('PDF downloaded')
    } catch (e) {
      console.error(e)
      toast('PDF export failed', 'error')
    }
  }

  return (
    <>
      <div className="row-between">
        <div className="segmented">
          <button className={kind === 'province' ? 'active' : ''} onClick={() => setKind('province')}>{country.regionLabel}s</button>
          <button className={kind === 'city' ? 'active' : ''} onClick={() => setKind('city')}>Cities</button>
        </div>
        <div className="btn-group">
          <button className="icon-btn" title="Export CSV (all regions & cities)" onClick={exportCsv}><FileSpreadsheet size={16} /></button>
          <button className="icon-btn" title="Export PDF with map" onClick={exportPdf}><FileText size={16} /></button>
        </div>
      </div>
      <p className="hint">
        Country average <b>{fmtScore(avg)}</b>. Bars show the MapStats score (0–100) from <b>{familyById[sourceMode].short}</b>
        {!isMultiSource(sourceMode) && <> · {list.length} {kind === 'city' ? 'cities' : 'regions'} have data from this source</>}.
      </p>
      <ol className="ranking">
        {list.map((e) => (
          <li key={e.id}>
            <button className={`rank-row ${selected?.id === e.id ? 'active' : ''}`} onClick={() => onSelect({ type: e.type, id: e.id }, { fly: true })}>
              <span className="rank-n">{e.rank}</span>
              <span className="rank-name">
                <span>{e.name}</span>
                {e.type === 'city' && <small>{e.provinceName}</small>}
              </span>
              <span className="rank-bar" aria-hidden="true">
                <span className={e.score >= avg ? 'above' : 'below'} style={{ width: `${e.score}%` }} />
                <i style={{ left: `${avg}%` }} />
              </span>
              <span className="rank-score">{fmtScore(e.score)}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  )
}

// ---------------- Weights ----------------

function WeightsTab({ weights, onWeights, onInfo, country }) {
  const total = Object.values(weights).reduce((s, x) => s + x, 0) || 1
  return (
    <>
      <p className="hint">
        Tune how much each category counts in the MapStats score. Weights are relative — they're normalised to 100%.
        {!country.curated && <> {country.name} has no curated socio-economic baseline yet, so only environmental and risk data is scored.</>}
      </p>
      <div className="weights">
        {CATEGORIES.map((c) => {
          const Icon = ICONS[c.icon]
          return (
            <div key={c.id} className="weight-row">
              <div className="weight-head">
                <span><Icon size={15} /> {c.label}</span>
                <b>{Math.round((weights[c.id] / total) * 100)}%</b>
              </div>
              <input
                type="range" min="0" max="50" step="1" value={weights[c.id]}
                onChange={(e) => onWeights((w) => ({ ...w, [c.id]: +e.target.value }))}
                aria-label={`${c.label} weight`}
                style={{ '--fill': `${(weights[c.id] / 50) * 100}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="row-between">
        <button className="btn ghost" onClick={() => onWeights(DEFAULT_WEIGHTS)}><RotateCcw size={14} /> Reset</button>
        <button className="btn ghost" onClick={onInfo}><Info size={14} /> How the score works</button>
      </div>
    </>
  )
}

function SourcePicker({ mode, onChange, country }) {
  return (
    <div className="source-picker">
      <label htmlFor="source-mode" className="eyebrow">Data source</label>
      <div className="select-wrap">
        <select id="source-mode" value={mode} onChange={(e) => onChange(e.target.value)}>
          {familiesFor(country.iso3).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </div>
      <p className="hint">
        {mode === 'combined'
          ? 'Each source is scored 0–100 per category; the median of the sources is shown. Only data measured for the place votes.'
          : mode === 'weighted'
            ? 'Each source ranks the place among all places it covers (percentile); sources are averaged by reliability: official registers and measurements count more than surveys and estimates.'
            : `Scores and layers use ${familyById[mode].short} only. Places without it show as no data.`}
      </p>
    </div>
  )
}
