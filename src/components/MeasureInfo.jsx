import { useEffect } from 'react'
import { X, ExternalLink, ArrowDown, ArrowUp, ArrowDownUp, Minus, Calculator, Sigma, FileText } from 'lucide-react'
import { indicatorById, scoreRange } from '../data/metrics.js'
import { STANDARDS, standardOfMeasure, scoresFor } from '../data/standards.js'
import { ABOUT, ROW_ABOUT, ORIGIN, ORIGIN_KIND, READING, readingOf } from '../data/about.js'
import { providerUnder } from '../core/providers.js'
import { fmtIndicator } from '../lib/format.js'

const READ_ICON = { low: ArrowDown, high: ArrowUp, mid: ArrowDownUp, context: Minus }
const ORIGIN_ICON = { score: Calculator, derived: Sigma, published: FileText }

/**
 * "About this measure": what it is, which way is better, the selected standard's categories, how it scores, and its
 * source. `measure`: { indicator: id } for an indicator, or { row: ROW_ABOUT key, title?, sub? } for other rows.
 */
export function MeasureInfo({ measure, standards, onClose }) {
  useEffect(() => {
    // Capture phase, so Esc closes this dialog only, not the view underneath.
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const ind = measure.indicator ? indicatorById[measure.indicator] : null
  const about = ind ? ABOUT[ind.id] : ROW_ABOUT[measure.row]
  // A standard's own measure that scores an indicator (US AQI under US EPA) reads and scores like that indicator.
  const scored = ind && (ind.better ? ind : indicatorById[scoresFor(ind.id, standards)] || null)
  const read = scored ? scored.better : ind ? readingOf(ind) : about?.read || 'context'
  const Icon = READ_ICON[read]
  const title = measure.title || about?.title || ind?.label
  const std = ind ? standardOfMeasure(ind.id, standards) : null
  const family = std && Object.values(STANDARDS).find((s) => s.options.includes(std))
  const range = ind?.better && !STANDARDS[ind.id] ? scoreRange(ind.id) : null
  const provider = ind ? providerUnder(ind.id, standards) : null
  // Where the number comes from: a MapStats score, calculated from a source's data, or the source's own figure.
  const [kind, how] = (ind ? ORIGIN[ind.id] : about?.origin) || []
  const OriginIcon = ORIGIN_ICON[kind]

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal glass measure-info" role="dialog" aria-modal="true" aria-labelledby="minfo-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2 id="minfo-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
        </div>
        <div className="modal-body">
          {measure.sub && <p className="muted small">{measure.sub}</p>}
          <p>{about?.text || 'No description yet.'}</p>

          {kind && (
            <>
              <h3>Where the number comes from</h3>
              <p className={`origin origin-${kind}`}><OriginIcon size={14} /> <b>{ORIGIN_KIND[kind]}</b></p>
              {how && <p className="small">{how.charAt(0).toUpperCase() + how.slice(1)}</p>}
            </>
          )}

          <h3>How to read it</h3>
          <p className={`reading read-${read}`}><Icon size={14} /> {READING[read]}{ind && !scored && read !== 'context' && ' Shown for context: it doesn’t change the score.'}</p>

          {std && (
            <>
              <h3>Standard: {std.short}</h3>
              <p className="small">{std.name}{std.url && <> · <a href={std.url} target="_blank" rel="noreferrer">reference <ExternalLink size={11} /></a></>}</p>
              {family?.valueFromInput && <p className="small muted">Each day is placed in the categories below; the day scores 100 with no risk and less the worse its category, and the value is the yearly mean.</p>}
              <table className="bands">
                <thead><tr><th>{std.unit}</th><th>Category</th></tr></thead>
                <tbody>
                  {std.bands.map(([max, label], k) => {
                    const lo = k ? std.bands[k - 1][0] : null
                    return <tr key={label}><td>{lo == null ? `up to ${max}` : max === Infinity ? `above ${lo}` : `${lo} to ${max}`}</td><td>{label}</td></tr>
                  })}
                </tbody>
              </table>
              {(std.note || family?.note) && <p className="small muted">{std.note || family.note}</p>}
              <p className="small muted">Change the standard in the comparison header or the Weights tab.</p>
            </>
          )}

          {ind && (
            <>
              <h3>Score</h3>
              <p className="small">
                {!scored ? 'Not scored.'
                  : scored !== ind ? `Scores ${scored.label.replace(/\s*\(.*\)$/, '').toLowerCase()} under ${std?.short}: 0–100 by the categories above, the same way for every place.`
                  : STANDARDS[ind.id] ? `Scored 0–100 by the selected standard (${std?.short}), the same way for every place.`
                    : range ? `Scores 100 at ${fmtIndicator(ind.id, ind.better === 'low' ? range.range[0] : range.range[1])} and 0 at ${fmtIndicator(ind.id, ind.better === 'low' ? range.range[1] : range.range[0])}${range.from === 'anchors' ? `: the 2nd and 98th percentile of ${range.n} regions across every country with data` : ' (set by hand)'}; values beyond score 100 or 0.`
                      : 'Scored.'}
              </p>
            </>
          )}

          {provider && (
            <>
              <h3>Source</h3>
              <p className="small">{provider.name}{provider.covers ? ` · ${provider.covers}` : ''}{provider.url && <> · <a href={provider.url} target="_blank" rel="noreferrer">website <ExternalLink size={11} /></a></>}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
