// Report block drawn from a provider's details for a place (src/core/resolve.js) and its `report.trends`
// metadata (src/core/define.js): yearly series with the latest-rates table. Any provider that publishes `series`
// gets it, whatever its country.
import { useCallback, useMemo } from 'react'
import { ChartCard } from '../charts/ChartCard.jsx'
import { baseOptions, lineStyle } from '../charts/theme.js'
import { fmtNum } from '../../lib/format.js'

const fmtRate = (v) => (v == null ? '—' : v >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(1))
const chartId = (provider, key) => `${provider.id.replace(/\W+/g, '-')}-${key}`
const subregionName = (d, country) => `${d.name} ${(country.subregionLabel || 'area').toLowerCase()}`

/** Whether a provider has a block to show for this place (its label then appears in the section heading). */
export const hasBlock = (provider, entity) => !!entity.details?.[provider.id] && !!provider.report.trends

function TrendChart({ provider, chart, lines, years, unit, theme }) {
  const build = useCallback((t) => ({
    type: 'line',
    data: {
      labels: years,
      datasets: lines.map((l, i) => (l.national
        ? { label: l.label, data: l.d.series[chart.indicator], ...lineStyle(t.de), borderDash: [], pointRadius: 0 }
        : { label: l.label, data: l.d.series[chart.indicator], ...lineStyle(t.series[i]), pointRadius: i === 0 ? 2.5 : 0 })),
    },
    options: baseOptions(t, { legend: true, yTitle: unit }),
  }), [lines, years, chart.indicator, unit])
  const fmt = (v) => (v == null ? null : fmtNum(v, chart.digits))
  return (
    <ChartCard id={chartId(provider, chart.indicator)} title={chart.title} subtitle={`${chart.subtitle} · ${provider.short}`} theme={theme} build={build} height={190}
      table={{ columns: ['Year', ...lines.map((l) => l.label)], rows: years.map((y, i) => [y, ...lines.map((l) => fmt(l.d.series[chart.indicator]?.[i]))]) }} />
  )
}

/** Yearly series for this place, its region (for a city) and the country, plus the provider's latest-rates table. */
export function TrendBlock({ provider, entity, model, country, theme }) {
  const d = entity.details?.[provider.id]
  const nat = model.national.details?.[provider.id]
  const years = nat?.years || []
  // Stable between renders, so the charts only rebuild when the place or its data change.
  const { lines, region } = useMemo(() => {
    if (!d?.series || !nat) return { lines: [] }
    const regionEntity = entity.type === 'city' ? model.provinces.find((p) => p.id === entity.province) : null
    const r = regionEntity?.details?.[provider.id]
    const own = { label: d.level === 'subregion' ? subregionName(d, country) : d.level === 'city' ? d.name : entity.name, d }
    const regionLine = r ? { label: r.name || regionEntity.name, d: r } : null
    return { lines: [own, ...(regionLine ? [regionLine] : []), { label: country.name, d: nat, national: true }], region: regionLine }
  }, [d, nat, entity, model.provinces, provider.id, country])
  const { trends, latestTable, footnote } = provider.report
  if (!trends || !lines.length || !years.length) return null
  const where = d.level === 'subregion'
    ? `${subregionName(d, country)}, the finest level ${provider.short} publishes`
    : d.level === 'city' ? 'city-wide' : `${country.regionLabel.toLowerCase()}-wide`
  return (
    <>
      <div className="sub-head">
        {provider.kind === 'register' ? 'Official statistics' : 'Statistics'} · {provider.short} {years[0]}–{d.latestYear}
        <span className="muted small"> · {where}</span>
      </div>
      {trends.charts.filter((c) => !c.focusOnly).map((c) => (
        <TrendChart key={c.indicator} provider={provider} chart={c} lines={lines} years={years} unit={trends.unit} theme={theme} />
      ))}
      {latestTable && d.latest && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{latestTable.title} ({d.latestYear}, {latestTable.unit})</th>
                <th className="num">{entity.type === 'city' ? (d.level === 'subregion' ? country.subregionLabel : 'City') : entity.name}</th>
                {region && <th className="num">{country.regionLabel}</th>}
                <th className="num">{country.name}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(latestTable.rows).map(([k, label]) => (
                <tr key={k}>
                  <td>{label}</td>
                  <td className="num">{fmtRate(d.latest[k])}</td>
                  {region && <td className="num">{fmtRate(region.d.latest?.[k])}</td>}
                  <td className="num">{fmtRate(nat.latest?.[k])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {footnote && <p className="chart-foot">{footnote}</p>}
    </>
  )
}
