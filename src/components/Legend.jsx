import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { indicatorById } from '../data/metrics.js'
import { fmtIndicator, fmtScore } from '../lib/format.js'
import { NO_DATA } from '../lib/colors.js'
import { FLOOD_LEVELS } from './mapLayers.js'
import { SourceButtons } from './SourceButtons.jsx'
import { sourcesForCategory, sourcesForIndicators, familyById } from '../data/sources.js'

export function Legend({ metric, scale, overlays, theme, national, shifted, sourceMode = 'combined', surface, surfaceVar }) {
  const isScore = metric.kind === 'score'
  const fmt = (v) => (isScore ? fmtScore(v) : fmtIndicator(metric.id, v))
  const ind = indicatorById[metric.id]
  // Phones show only the colour ramp until expanded; wider screens always show everything.
  const [expanded, setExpanded] = useState(false)
  return (
    <div className={`legend glass ${shifted ? 'shifted' : ''} ${expanded ? 'expanded' : ''}`}>
      {surface && (
        <div className="legend-block">
          <div className="legend-title">{surfaceVar.label}</div>
          <div className="legend-sub">Interpolated from {surface.samples} points · {surfaceVar.id === 'uvMean' ? 'Open-Meteo forecast archive' : 'ERA5'}, last full year · ignores terrain between points</div>
          <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${surface.legend.join(',')})` }} />
          <div className="legend-ticks">
            <span>{fmtSurface(surface.domain[0], surfaceVar)}</span>
            <span>{fmtSurface(surface.domain[1], surfaceVar)}</span>
          </div>
        </div>
      )}
      {overlays.flood && (
        <div className="legend-block">
          <div className="legend-title">River flood watch</div>
          <div className="legend-sub">GloFAS 30-day forecast peak ÷ usual high water · a signal, not an official warning</div>
          <div className="legend-levels">
            {FLOOD_LEVELS.map((l) => <span key={l.id}><i className="sw round" style={{ background: l.color }} /> {l.label}</span>)}
          </div>
        </div>
      )}
      <div className="row-between">
        <div className="legend-title">{metric.label}</div>
        <button className="icon-btn sm legend-toggle" onClick={() => setExpanded((x) => !x)} title={expanded ? 'Less' : 'Legend details'} aria-expanded={expanded}>
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {isScore && <div className="legend-sub">Source: {familyById[sourceMode].short}</div>}
      {ind?.better && <div className="legend-sub">{ind.better === 'low' ? 'Lower' : 'Higher'} is better</div>}
      {isScore && <div className="legend-sub">0–100 · centred on the country average{national?.score != null ? ` (${fmtScore(national.score)})` : ''}</div>}
      {scale ? (
        <>
          <div className="legend-ramp" style={{ background: `linear-gradient(90deg, ${scale.legend.join(',')})` }} />
          <div className="legend-ticks">
            <span>{fmt(scale.domain[0])}</span>
            {scale.mid != null && <span>{fmt(scale.mid)}</span>}
            <span>{fmt(scale.domain[1])}</span>
          </div>
          <div className="legend-ticks muted">
            <span>{scale.lowLabel}</span>
            <span>{scale.highLabel}</span>
          </div>
        </>
      ) : (
        <div className="legend-sub">Waiting for data…</div>
      )}
      <SourceButtons keys={ind ? sourcesForIndicators([metric.id]) : metric.id.startsWith('cat:') ? sourcesForCategory(metric.id.slice(4)) : []} label={null} />
      <div className="legend-extra">
        <span><i className="sw" style={{ background: NO_DATA[theme] }} /> No data</span>
        {overlays.quakes && <span><i className="sw round" style={{ background: '#eb6834' }} /> Earthquake (size = magnitude)</span>}
        {overlays.heat && <span><i className="sw" style={{ background: 'linear-gradient(90deg,#9ec5f4,#0d366b)' }} /> Livability hot spots</span>}
      </div>
    </div>
  )
}

const fmtSurface = (v, sv) => `${Math.round(v * (sv.unit === '°C' || !sv.unit ? 10 : 1)) / (sv.unit === '°C' || !sv.unit ? 10 : 1)}${sv.unit ? (sv.unit === '°C' ? '°C' : ` ${sv.unit}`) : ''}`
