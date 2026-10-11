// Report blocks drawn from a provider's details for a place (src/core/resolve.js) and its `report` metadata
// (src/core/define.js): yearly trends with the latest-rates table, and survey answers. Any provider that
// publishes `series` or a `survey` gets them, whatever its country.
import { useCallback } from 'react'
import { Info } from 'lucide-react'
import { ChartCard } from '../charts/ChartCard.jsx'
import { baseOptions, barStyle, lineStyle } from '../charts/theme.js'
import { fmtNum } from '../../lib/format.js'
import { providersFor, localFirst } from '../../core/providers.js'

const fmtFixed = (digits) => (v) => (v == null ? null : digits ? v.toFixed(digits) : Math.round(v).toLocaleString('en'))
const fmtRate = (v) => (v == null ? '—' : v >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(1))
const chartId = (provider, key) => `${provider.id.replace(/\W+/g, '-')}-${key}`

/** The country's providers that present data in a report category, its own first. */
export const reportProviders = (country, category) => localFirst(providersFor(country)).filter((p) => p.report?.category === category)

/** Whether a provider has a block to show for this place (its label then appears in the section heading). */
export function hasBlock(provider, entity) {
  const d = entity.details?.[provider.id]
  return !!d && (!!provider.report.trends || (!!provider.report.survey && !!d.survey))
}

/** The values a trend chart compares: this place, its region (for a city), the country. */
function trendLines({ provider, entity, model, country }) {
  const d = entity.details?.[provider.id]
  const nat = model.national.details?.[provider.id]
  const region = entity.type === 'city' ? model.provinces.find((p) => p.id === entity.province) : null
  const r = region?.details?.[provider.id]
  const label = d.level === 'subregion' ? `${d.name} ${(country.subregionLabel || 'area').toLowerCase()}` : d.level === 'city' ? d.name : entity.name
  return [
    { label, d },
    ...(r ? [{ label: r.name || region.name, d: r }] : []),
    { label: country.name, d: nat, national: true },
  ]
}

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
  const fmt = fmtFixed(chart.digits)
  return (
    <ChartCard id={chartId(provider, chart.indicator)} title={chart.title} subtitle={`${chart.subtitle} · ${provider.short}`} theme={theme} build={build} height={190}
      table={{ columns: ['Year', ...lines.map((l) => l.label)], rows: years.map((y, i) => [y, ...lines.map((l) => fmt(l.d.series[chart.indicator]?.[i]))]) }} />
  )
}

/** Yearly series for this place, its region and the country, plus the provider's latest-rates table. */
export function TrendBlock({ provider, entity, model, country, theme }) {
  const d = entity.details?.[provider.id]
  const years = model.national.details?.[provider.id]?.years || []
  const { trends, latestTable, footnote } = provider.report
  if (!trends || !d?.series || !years.length) return null
  const lines = trendLines({ provider, entity, model, country })
  const [, region] = lines.length === 3 ? lines : []
  const nat = lines.at(-1)
  const where = d.level === 'subregion'
    ? `${d.name} ${(country.subregionLabel || 'area').toLowerCase()}, the finest level ${provider.short} publishes`
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
                  <td className="num">{fmtRate(nat.d.latest?.[k])}</td>
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

function SurveyChart({ provider, id, rows, survey, spec, color, rowHeight, theme }) {
  const build = useCallback((t) => ({
    type: 'bar',
    data: { labels: rows.map(([, label]) => label), datasets: [{ label: 'Survey score (0–100)', data: rows.map(([k]) => survey[k]), ...barStyle(t.series[color]) }] },
    options: baseOptions(t, { horizontal: true, suggestedMax: 100 }),
  }), [rows, survey, color])
  return (
    <ChartCard id={chartId(provider, id)} title={spec.title} subtitle={spec.subtitle} theme={theme} build={build}
      height={rows.length * rowHeight + 40}
      table={{ columns: ['Question', 'Score'], rows: rows.map(([k, label]) => [label, survey[k]]) }}
      footnote={spec.footnote} />
  )
}

/** Survey answers: questions where a high answer is worse, then those where it is safer. */
export function SurveyBlock({ provider, entity, theme }) {
  const d = entity.details?.[provider.id]
  const s = provider.report.survey
  if (!s || !d?.survey) return null
  const answered = s.questions.filter(([k]) => d.survey[k] != null)
  const worse = answered.filter(([k]) => !s.saferHigh.has(k))
  const safer = answered.filter(([k]) => s.saferHigh.has(k))
  return (
    <>
      {worse.length > 0 && (
        <>
          <div className="sub-head">{s.heading}<span className="muted small"> · {s.status(d)}</span></div>
          <SurveyChart provider={provider} id="survey" rows={worse} survey={d.survey} spec={s.worse} color={1} rowHeight={26} theme={theme} />
        </>
      )}
      {safer.length > 0 && <SurveyChart provider={provider} id="safer" rows={safer} survey={d.survey} spec={s.safer} color={0} rowHeight={30} theme={theme} />}
    </>
  )
}

/** Extra figures a provider publishes for the place (e.g. a safety index), for the section's key values. */
export function ProviderFacts({ providers, entity }) {
  return providers.flatMap((p) => (p.report.facts || []).map((f) => {
    const v = entity.details?.[p.id]?.[f.key]
    return v == null ? null : <span key={`${p.id}:${f.key}`}>{f.label} <b>{f.digits ? fmtNum(v, f.digits) : v}</b></span>
  })).filter(Boolean)
}

/** Caveats a provider attaches to its data for the place (e.g. an unverified snapshot). */
export function ProviderNotes({ providers, entity }) {
  return providers.map((p) => {
    const text = p.report.note?.(entity.details?.[p.id], entity)
    return text && <p key={p.id} className="note"><Info size={13} /> {text}</p>
  })
}
