import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { CATEGORIES, INDICATORS, scoreRange, anchorsInfo } from '../data/metrics.js'
import { PROVIDERS, providerOf } from '../core/providers.js'
import { STANDARDS, standardFor } from '../data/standards.js'

export function Methodology({ onClose, weights, standards, onSources }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const total = Object.values(weights).reduce((s, x) => s + x, 0) || 1

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass" role="dialog" aria-modal="true" aria-labelledby="mtitle" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="mtitle">How MapStats scores places</h2>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <ol className="steps">
            <li><b>Normalise.</b> Each indicator is mapped to 0–100 between two fixed values (below), flipped when lower is better and clamped at the ends. For statistics, they are the {anchorsInfo.method}: the few places beyond them score 0 or 100, and the rest spread over the whole scale. Live measurements use ranges set by hand. The same ranges apply to every country, so scores stay comparable; they are relative to the places MapStats covers, not absolute judgements. Charts, map layers and comparisons always show real values.</li>
            <li><b>Combine sources.</b> Within a category, each source (official crime statistics, Open-Meteo, USGS, provincial statistics) gets its own score: the average of its normalised indicators. The category score is the median of those source scores (with two sources, their mean). Only data measured for the place votes; province figures fill a category only when no source has local data. The data-source selector shows a single source instead.</li>
            <li><b>Weighted integration</b> (selectable): each source ranks the place as a percentile among the places it covers, then sources are averaged by reliability — base weight (official register or measurement 1.0, crowd survey 0.5, hand-entered estimate 0.3) × geographic match (department 0.9, province-wide figure 0.5) × recency (−15% per year beyond one). The ± shown is the weighted standard deviation between sources.</li>
            <li><b>Weight.</b> The MapStats score is the weighted average of category scores. Missing categories are left out and the remaining weights re-normalised, so absent data neither helps nor hurts. Each report shows its data coverage.</li>
            <li><b>Cities</b> inherit their province's statistics, then override them with city-level data (e.g. their crime-statistics department) and live measurements at the exact location (climate, air quality, earthquakes). <b>Provinces</b> aggregate live data from their cities, weighted by population.</li>
            <li><b>Official crime data</b> comes from SNIC (Ministerio de Seguridad). Cities use their department (partido) — the finest level SNIC publishes — as 3-year averages per 100,000 inhabitants, using parent crime codes only so sub-categories aren't counted twice.</li>
            <li><b>Climate comfort</b> rates each month from 0–100: ideal mean temperature 16–24 °C; penalties for heat (&gt;30 °C highs), frost, months over 100 mm of rain, snow and fewer than 4 sunshine hours a day.</li>
          </ol>

          <h3 className="eyebrow">Indicators</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Category</th><th>Indicator</th><th>Best → worst</th><th>Source</th></tr></thead>
              <tbody>
                {CATEGORIES.map((c) =>
                  INDICATORS.filter((i) => i.category === c.id && i.better).map((i, k) => (
                    <tr key={i.id}>
                      <td>{k === 0 ? `${c.label} (${Math.round((weights[c.id] / total) * 100)}%)` : ''}</td>
                      <td>{i.label}</td>
                      <td className="num">{standardFor(i.id, standards)
                        ? `${standardFor(i.id, standards).short} bands (${standardFor(i.id, standards).unit})`
                        : `${(([lo, hi]) => (i.better === 'low' ? `${lo} → ${hi}` : `${hi} → ${lo}`))(scoreRange(i.id).range)} ${i.unit}`}</td>
                      <td>{providerOf(i.id)?.short}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <h3 className="eyebrow">Standards</h3>
          <p className="hint">Where a recognised standard says how good or bad a value is for people, it sets the score instead of the range above. Pick one per indicator in the Weights tab; it applies to every place.</p>
          <ul className="sources">
            {Object.entries(STANDARDS).flatMap(([id, s]) => s.options.map((o) => (
              <li key={`${id}:${o.id}`}>
                <a href={o.url} target="_blank" rel="noreferrer">{o.name} <ExternalLink size={12} /></a>
                <span>{o.id === standardFor(id, standards).id ? '(in use) ' : ''}Scores the {o.unit}: {o.bands.map(([max, label]) => (max === Infinity ? label : `${label} ≤ ${max}`)).join(' · ')}</span>
              </li>
            )))}
          </ul>

          <h3 className="eyebrow">Data sources {onSources && <button className="link small" onClick={onSources}>· open the full sources view</button>}</h3>
          <ul className="sources">
            {PROVIDERS.map((s) => (
              <li key={s.id}>
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name} <ExternalLink size={12} /></a> : <b>{s.name}</b>}
                <span>{s.covers}</span>
              </li>
            ))}
          </ul>
          <p className="hint">
            Curated statistics are approximate snapshots of the latest published figures and should be verified for decisions.
            Numbeo's terms don't allow republishing its data without consent, so MapStats shows no Numbeo values and links to each city's Numbeo pages instead.
            Live data is cached in your browser (climate 30 days, air quality 1 day, earthquakes 7 days).
          </p>
        </div>
      </div>
    </div>
  )
}
