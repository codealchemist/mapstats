import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { CATEGORIES, INDICATORS } from '../data/metrics.js'
import { familiesFor, isMultiSource, sourceList, sourceOf } from '../data/sources.js'

export function Methodology({ onClose, weights, country, curated, onSources }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const total = Object.values(weights).reduce((s, x) => s + x, 0) || 1
  const region = country.regionLabel.toLowerCase()
  const families = familiesFor(country.iso3).filter((f) => !isMultiSource(f.id)).map((f) => f.short).join(', ')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass" role="dialog" aria-modal="true" aria-labelledby="mtitle" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="mtitle">How MapStats scores places</h2>
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">
          <ol className="steps">
            <li><b>Normalise.</b> Each indicator is mapped to 0–100 on a fixed range (below), flipped when lower is better and clamped at the ends. Fixed ranges keep scores comparable across countries.</li>
            <li><b>Combine sources.</b> Within a category, each source ({families}) gets its own score: the average of its normalised indicators. The category score is the median of those source scores (with two sources, their mean). Only data measured for the place votes; {region} figures fill a category only when no source has local data. The data-source selector shows a single source instead.</li>
            <li><b>Weighted integration</b> (selectable): each source ranks the place as a percentile among the places it covers, then sources are averaged by reliability — base weight (official register or measurement 1.0, crowd survey 0.5, hand-entered estimate 0.3) × geographic match (sub-{region} unit 0.9, {region}-wide figure 0.5) × quality (Numbeo contributors, full weight at 50+) × recency (−15% per year beyond one). The ± shown is the weighted standard deviation between sources.</li>
            <li><b>Weight.</b> The MapStats score is the weighted average of category scores. Missing categories are left out and the remaining weights re-normalised, so absent data neither helps nor hurts. Each report shows its data coverage.</li>
            <li><b>Cities</b> inherit their {region}'s statistics, then override them with city-level data (Numbeo indices, official figures for the city's own area) and live measurements at the exact location (climate, air quality, earthquakes). <b>{country.regionLabel}s</b> aggregate live and Numbeo data from their cities, weighted by population.</li>
            {(curated?.methodology || []).map((text, i) => <li key={i}><b>{country.name}.</b> {text}</li>)}
            {!country.curated && <li><b>{country.name}</b> has no curated socio-economic baseline yet: only live environmental and risk data is scored.</li>}
            <li><b>Climate comfort</b> rates each month from 0–100: ideal mean temperature 16–24 °C; penalties for heat (&gt;30 °C highs), frost, months over 100 mm of rain, snow and fewer than 4 sunshine hours a day.</li>
          </ol>

          <h3 className="eyebrow">Indicators</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Category</th><th>Indicator</th><th>Best → worst</th><th>Source in {country.name}</th></tr></thead>
              <tbody>
                {CATEGORIES.map((c) =>
                  INDICATORS.filter((i) => i.category === c.id && i.better).map((i, k) => (
                    <tr key={i.id}>
                      <td>{k === 0 ? `${c.label} (${Math.round((weights[c.id] / total) * 100)}%)` : ''}</td>
                      <td>{i.label}</td>
                      <td className="num">{i.better === 'low' ? `${i.domain[0]} → ${i.domain[1]}` : `${i.domain[1]} → ${i.domain[0]}`} {i.unit}</td>
                      <td>{sourceOf(i.id, country.iso3) || <span className="faint">not available</span>}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>

          <h3 className="eyebrow">Data sources {onSources && <button className="link small" onClick={onSources}>· open the full sources view</button>}</h3>
          <ul className="sources">
            {sourceList.map((s) => (
              <li key={s.key}>
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name} <ExternalLink size={12} /></a> : <b>{s.name}</b>}
                <span>{s.covers}</span>
              </li>
            ))}
          </ul>
          <p className="hint">
            Imported official statistics are used exactly as published; hand-entered statistics are approximate snapshots of the latest published figures and should be verified for decisions.
            Numbeo blocks cross-origin requests and automated scraping, so MapStats ships a snapshot of its city indices and links to the live Numbeo pages from each city report.
            Live data is cached in your browser (climate 30 days, air quality 1 day, earthquakes 7 days).
          </p>
        </div>
      </div>
    </div>
  )
}
