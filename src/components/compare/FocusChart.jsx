import { useEffect, useMemo } from 'react'
import { ChartCard } from '../charts/ChartCard.jsx'
import { buildMeasures } from './measures.js'
import { matches } from './match.js'

/**
 * One measure, all selected places, the whole screen. The measure list on the left is grouped;
 * on narrow screens it becomes a dropdown.
 */
export function FocusChart({ places, national, theme, measureId, onMeasure, query = '' }) {
  const measures = useMemo(() => buildMeasures(), [])
  const available = measures.filter((m) => m.available(places) && matches(query, m.label, m.group, m.unit))
  const measure = available.find((m) => m.id === measureId) || available[0]
  // Keep the selection in sync with the search: the first match becomes the shown measure.
  useEffect(() => {
    if (measure && measure.id !== measureId) onMeasure(measure.id)
  }, [measure?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const g = {}
    for (const m of available) (g[m.group] ||= []).push(m)
    return Object.entries(g)
  }, [available])

  // Rebuild when places, their loaded details, or the measure change.
  const key = places.map((p) => `${p.e.id}:${p.e.score}:${!!p.d.climate}:${!!p.d.air}:${!!p.d.uv}`).join('|')
  const build = useMemo(() => (tk) => measure.build({ places, tk, national }), [measure, key]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!places.length) return <div className="empty">Add places to compare.</div>
  if (!measure) return <div className="empty">No measure matches “{query}”.</div>
  const table = tableFor(build, places)

  return (
    <div className="focus-layout">
      <nav className="focus-list" aria-label="Measures">
        {groups.map(([group, ms]) => (
          <div key={group} className="focus-group">
            <div className="eyebrow">{group}</div>
            {ms.map((m) => (
              <button key={m.id} className={`metric ${m.id === measure.id ? 'active' : ''}`} onClick={() => onMeasure(m.id)}>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
      <div className="focus-main">
        <div className="select-wrap focus-select">
          <select value={measure.id} onChange={(e) => onMeasure(e.target.value)} aria-label="Measure">
            {groups.map(([group, ms]) => (
              <optgroup key={group} label={group}>{ms.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</optgroup>
            ))}
          </select>
        </div>
        <ChartCard key={measure.id} id={`focus-${measure.id}`} title={measure.label} subtitle={[measure.unit, measure.group].filter(Boolean).join(' · ')}
          theme={theme} build={build} height="fill" table={table} />
      </div>
    </div>
  )
}

// Data-table view of whatever the chart shows (labels × datasets).
function tableFor(build, places) {
  try {
    const cfg = build({ series: ['#000', '#000', '#000', '#000'], de: '#000', grid: '#000', axis: '#000', muted: '#000', secondary: '#000', ink: '#000', surface: '#fcfcfb' })
    const ds = cfg.data.datasets
    if (ds.length === 1) return { columns: ['', 'Value'], rows: cfg.data.labels.map((l, k) => [l, ds[0].data[k]]) }
    return { columns: ['', ...ds.map((d) => d.label)], rows: cfg.data.labels.map((l, k) => [l, ...ds.map((d) => d.data[k])]) }
  } catch {
    return { columns: ['Place'], rows: places.map((p) => [p.e.name]) }
  }
}
