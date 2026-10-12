import { useEffect, useRef } from 'react'
import { Chart } from 'react-chartjs-2'
import { Check, Focus, Info } from 'lucide-react'
import { CATEGORIES, INDICATORS } from '../../data/metrics.js'
import { baseOptions, barStyle, lineStyle } from '../charts/theme.js'
import { fmtIndicator, fmtScore, MONTHS } from '../../lib/format.js'
import { meterScale, isOwnValue } from '../../lib/scoring.js'
import { providerUnder, PROVIDERS, localFirst } from '../../core/providers.js'
import { floodLevel } from '../mapLayers.js'
import { warningsFor } from '../../lib/warnings.js'
import { hiddenMeasures, standardOfMeasure, measureBand, scoresFor } from '../../data/standards.js'
import { indicatorById } from '../../data/metrics.js'
import { ORIGIN } from '../../data/about.js'
import { matches } from './match.js'

/**
 * One grid, one scroll container: every row is the same measure for every place, so the
 * columns always scroll together and line up. Charts in a row share one axis range.
 * places: fixed-length array (3) of { e, i, d, flood } or null for an empty slot.
 */
export function SideBySide({ places, header, national, ranges, standards, tk, onFocus, onInfo, query = '', scrollRef, initialScroll, flashKey, onFlashDone }) {
  const filled = places.filter(Boolean)
  const rows = filterRows(buildRows(filled, national, ranges, standards), query)
  // Phones hide every empty slot but the first, so the filled places get the width.
  const firstEmpty = places.findIndex((p) => !p)
  const spare = places.map((p, k) => !p && k !== firstEmpty)
  return (
    <div className="sbs-scroll" ref={(el) => {
      if (!el || !scrollRef) return
      // Restore the saved position once, on mount (coming back from focus mode).
      if (scrollRef.current !== el && initialScroll) { el.scrollTop = initialScroll.top; el.scrollLeft = initialScroll.left }
      scrollRef.current = el
    }}>
      <div className="sbs-grid" style={{ '--cols': places.length, '--ncols': places.length - spare.filter(Boolean).length }}>
        <div className="sbs-corner sbs-sticky-top sbs-sticky-left" />
        {places.map((p, k) => <div key={k} className={`sbs-head sbs-sticky-top${spare[k] ? ' spare' : ''}`}>{header(k)}</div>)}

        {!rows.length && <div className="sbs-section sbs-empty">No measure matches “{query}”.</div>}
        {rows.map((r) => (r.section ? (
          <div key={r.key} className="sbs-section">{r.section}{r.score && <span className="muted"> · category score</span>}</div>
        ) : (
          <Row key={r.key} r={r} places={places} spare={spare} tk={tk} onFocus={onFocus} onInfo={onInfo} flash={r.key === flashKey} onFlashDone={onFlashDone} />
        )))}
      </div>
    </div>
  )
}

function Row({ r, places, spare, tk, onFocus, onInfo, flash, onFlashDone }) {
  const labelRef = useRef(null)
  // Briefly highlight the row we came back to; bring it into view if the restored scroll doesn't show it.
  useEffect(() => {
    if (!flash) return
    const el = labelRef.current
    const box = el?.closest('.sbs-scroll')
    if (el && box) {
      const r1 = el.getBoundingClientRect(), r2 = box.getBoundingClientRect()
      if (r1.top < r2.top + 80 || r1.bottom > r2.bottom) el.scrollIntoView({ block: 'center' })
    }
    const t = setTimeout(() => onFlashDone?.(), 1600)
    return () => clearTimeout(t)
  }, [flash]) // eslint-disable-line react-hooks/exhaustive-deps
  const fl = flash ? ' flash' : ''
  return (
    <>
      <div ref={labelRef} className={`sbs-label sbs-sticky-left${fl}`}>
        <span>{r.label}</span>
        {r.sub && <small className="muted">{r.sub}</small>}
        <span className="sbs-label-actions">
          {r.info && onInfo && <button className="icon-btn sm" onClick={() => onInfo({ ...r.info, sub: r.sub })} title="What this measures and how to read it" aria-label={`About ${r.label}`}><Info size={13} /></button>}
          {r.focus && <button className="icon-btn sm" onClick={() => onFocus(r.focus, r)} title="Show as one large chart"><Focus size={13} /></button>}
        </span>
      </div>
      {places.map((p, k) => (
        <div key={k} className={`sbs-cell ${r.chart ? 'chart' : ''}${p ? '' : ' vacant'}${spare[k] ? ' spare' : ''}${fl}`} style={{ '--place': tk.series[k] }}>
          {/* Phones stack chart cells full width, so each one names its place. */}
          {p && r.chart && <span className="sbs-cell-place"><i className="swatch" style={{ background: tk.series[k] }} />{p.e.name}</span>}
          {!p ? null : r.cell(p, tk) || <span className="sbs-na">{r.na || 'No data'}</span>}
        </div>
      ))}
    </>
  )
}

// A row matches on its label, subtitle (source/unit) or section name; typing a section name keeps
// the whole section. Section headings without any remaining row are dropped.
function filterRows(rows, query) {
  if (!query.trim()) return rows
  const out = []
  let section = null, pending = null
  for (const r of rows) {
    if (r.section) { section = r.section; pending = r; continue }
    if (!matches(query, r.label, r.sub, section)) continue
    if (pending) { out.push(pending); pending = null }
    out.push(r)
  }
  return out
}

// ---------- shared scales ----------
function range(values, { zero = false, pad = 0.06, floor } = {}) {
  const v = values.flat().filter((x) => x != null && Number.isFinite(x))
  if (!v.length) return null
  let lo = Math.min(...v), hi = Math.max(...v)
  if (zero) lo = Math.min(0, lo)
  const span = hi - lo || Math.abs(hi) || 1
  return { min: zero ? lo : Math.floor(lo - span * pad), max: Math.ceil(hi + span * pad), ...(floor != null && { min: floor }) }
}

function mini(tk, { type = 'line', labels, data, color, horizontal = false, scale }) {
  const opts = baseOptions(tk, { horizontal })
  opts.animation = false
  const axis = horizontal ? opts.scales.x : opts.scales.y
  Object.assign(axis, { beginAtZero: false, min: scale?.min, max: scale?.max, ticks: { ...axis.ticks, maxTicksLimit: 4 } })
  const cat = horizontal ? opts.scales.y : opts.scales.x
  cat.ticks = { ...cat.ticks, font: { size: 10 }, maxTicksLimit: horizontal ? 20 : 6 }
  const style = type === 'line' ? { ...lineStyle(color, { fill: true }), pointRadius: 0 } : { ...barStyle(color), maxBarThickness: 14 }
  return { type, data: { labels, datasets: [{ data, ...style, label: '' }] }, options: opts }
}

function MiniChart({ cfg, height = 140 }) {
  return <div className="sbs-chart" style={{ height }}><Chart type={cfg.type} data={cfg.data} options={cfg.options} /></div>
}

// ---------- rows ----------
function buildRows(filled, national, ranges, standards) {
  const rows = []
  // Direction of a row: its own, or that of the indicator it scores for under the selected standard.
  const betterOf = (ind) => ind.better || indicatorById[scoresFor(ind.id, standards)]?.better || null
  const bestOf = (ind) => {
    const better = betterOf(ind)
    if (!better || filled.length < 2) return null
    const own = filled.filter(({ e }) => isOwnValue(e, ind.id))
    if (own.length < 2) return null
    // Real values in the indicator's direction: normalised scores clamp at the domain ends and would tie.
    const vals = own.map(({ e }) => e.values[ind.id])
    const top = better === 'high' ? Math.max(...vals) : Math.min(...vals)
    return new Set(own.filter((_, k) => vals[k] === top).map(({ e }) => e.id))
  }
  // tint: the value itself takes the place's colour (climate rows mostly have no meter to carry it).
  const indicatorRow = (ind, { tint = false } = {}) => {
    const best = bestOf(ind), better = betterOf(ind)
    const pos = meterScale(ranges[ind.id], [...filled.map(({ e }) => e.values[ind.id]), national.values[ind.id]])
    return {
      key: `ind:${ind.id}`, label: ind.label, focus: `ind:${ind.id}`, info: { indicator: ind.id },
      // Whether MapStats calculates it as a score, the standard measuring it (when one does), then the source.
      sub: [ORIGIN[ind.id]?.[0] === 'score' && 'MapStats score', standardOfMeasure(ind.id, standards)?.short, providerUnder(ind.id, standards)?.short].filter(Boolean).join(' · '),
      cell: ({ e }) => {
        const v = e.values[ind.id]
        if (v == null) return null
        const n = better ? pos(v) : null
        const band = measureBand(ind.id, v, standards) // its category under the selected standard ("Moderate")
        return (
          <div className={`sbs-value ${best?.has(e.id) ? 'best' : ''}${tint ? ' tint' : ''}`}>
            <b>{best?.has(e.id) && <Check size={12} />} {fmtIndicator(ind.id, v)}</b>
            {e.inherited?.has(ind.id) && <span className="tag" title="Province figure, not this place's own">prov.</span>}
            {band && <span className="muted small">{band}</span>}
            {n != null && <span className={`meter dir-${better}`} title={better === 'low' ? 'Lower is better' : 'Higher is better'}><span style={{ width: `${n}%` }} />{national.values[ind.id] != null && <i style={{ left: `${pos(national.values[ind.id])}%` }} />}</span>}
          </div>
        )
      },
    }
  }
  // A provider's latest published value for an indicator (details.latest), real value, best marked.
  const lastYearRow = (p, chart, unit) => {
    const k = chart.indicator, better = INDICATORS.find((x) => x.id === k)?.better
    const latest = (e) => e?.details?.[p.id]?.latest?.[k] ?? null
    const vals = filled.map(({ e }) => latest(e)).filter((v) => v != null)
    const top = vals.length > 1 && better ? (better === 'high' ? Math.max(...vals) : Math.min(...vals)) : null
    // From 0, so bar lengths are proportional to the rates (a min–max scale exaggerates small differences).
    const pos = meterScale([0, 0], [...vals, latest(national)])
    const year = national.details?.[p.id]?.latestYear
    return {
      key: `last:${p.id}:${k}`, info: { row: 'last', title: `${chart.title} last year` }, label: `${chart.title} last year`, sub: `${year ? `${year} · ` : ''}${unit} · ${p.short}`, focus: `last:${p.id}:${k}`, na: `No ${p.short} data`,
      cell: ({ e }) => {
        const v = latest(e)
        if (v == null) return null
        return (
          <div className={`sbs-value ${v === top ? 'best' : ''}`}>
            <b>{v === top && <Check size={12} />} {fmtIndicator(k, v)}</b>
            {better && <span className={`meter dir-${better}`} title={better === 'low' ? 'Lower is better' : 'Higher is better'}><span style={{ width: `${pos(v)}%` }} />{latest(national) != null && <i style={{ left: `${pos(latest(national))}%` }} />}</span>}
          </div>
        )
      },
    }
  }
  // One row per measure: other standards' versions of it are left out (data/standards.js hiddenMeasures).
  const hidden = hiddenMeasures(standards)
  const indicatorsOf = (cat, opts) => INDICATORS.filter((i) => i.category === cat && !hidden.has(i.id) && filled.some(({ e }) => e.values[i.id] != null)).map((i) => indicatorRow(i, opts))

  // Overview
  rows.push({ key: 's:overview', section: 'Overview' })
  rows.push({
    key: 'score', info: { row: 'score' }, label: 'MapStats score', sub: `MapStats score · country average ${fmtScore(national.score)}`, focus: 'score',
    cell: ({ e }) => <div className="sbs-score">{fmtScore(e.score)}<small>/100</small><span className="muted small">{e.rank ? `#${e.rank} of ${e.rankOf}` : 'not ranked'}</span></div>,
  })
  // Extremes a good yearly mean would hide (lib/warnings.js), under the selected standards.
  if (filled.some(({ e }) => warningsFor(e, standards).length)) {
    rows.push({
      key: 'warnings', info: { row: 'warnings' }, label: 'Warnings', sub: 'Extremes in the last year', na: 'None',
      cell: ({ e }) => {
        const list = warningsFor(e, standards)
        return list.length > 0 && <div className="sbs-warnings">{list.map((w) => <span key={w.id} title={w.why}>⚠ {w.text}</span>)}</div>
      },
    })
  }
  rows.push({
    key: 'cats', info: { row: 'categories' }, label: 'Score by category', sub: '0–100', chart: true, focus: 'categories',
    cell: ({ e, i }, tk) => <MiniChart height={170} cfg={mini(tk, { type: 'bar', horizontal: true, labels: CATEGORIES.map((c) => c.label), data: CATEGORIES.map((c) => e.categories[c.id]), color: tk.series[i], scale: { min: 0, max: 100 } })} />,
  })

  for (const c of CATEGORIES) {
    const extra = []
    if (c.id === 'safety') {
      // Yearly series from the providers that publish them (their report.trends).
      for (const p of localFirst(PROVIDERS).filter((x) => x.report?.category === c.id)) {
        const of = (e) => e.details?.[p.id]
        const t = p.report.trends
        const years = national.details?.[p.id]?.years || []
        if (t && filled.some(({ e }) => of(e)?.series)) {
          for (const chart of t.charts.filter((x) => !x.focusOnly)) {
            const scale = range(filled.map(({ e }) => of(e)?.series?.[chart.indicator] || []), { zero: true })
            extra.push({
              key: `trend:${p.id}:${chart.indicator}`, info: { row: 'trend', title: `${chart.title} by year` }, label: `${chart.title} by year`, sub: `${t.unit} · ${p.short}`, chart: true, focus: `trend:${p.id}:${chart.indicator}`, na: `No ${p.short} data`,
              cell: ({ e, i }, tk) => of(e)?.series && <MiniChart cfg={mini(tk, { labels: years, data: of(e).series[chart.indicator], color: tk.series[i], scale })} />,
            })
          }
          // The latest year's published value, for charts that ask for it (e.g. robberies and thefts).
          for (const chart of t.charts.filter((x) => x.lastYear)) extra.push(lastYearRow(p, chart, t.unit))
        }
      }
    }
    if (c.id === 'hazards' && filled.some(({ flood }) => flood)) {
      extra.push({
        key: 'flood', info: { row: 'flood' }, label: 'River flood watch', sub: '30-day peak ÷ usual high water · GloFAS', focus: 'flood', na: 'No significant river',
        cell: ({ flood }) => flood?.river && flood.floodWatch != null && (
          <div className="sbs-value"><b>{flood.floodWatch.toFixed(2)}×</b><span className="muted small">{floodLevel(flood.floodWatch).label}</span></div>
        ),
      })
    }
    if (c.id === 'environment' && filled.some(({ d }) => d.air)) {
      const dates = [...new Set(filled.flatMap(({ d }) => d.air?.daily.map((x) => x.date) || []))].sort()
      const scale = range(filled.map(({ d }) => d.air?.daily.map((x) => x.aqi) || []), { zero: true })
      extra.push({
        key: 'aqi', info: { row: 'airDaily' }, label: 'Daily air quality', sub: 'European AQI, last 3 months', chart: true, focus: 'aqi', na: 'Loading…',
        cell: ({ d, i }, tk) => d.air && <MiniChart cfg={mini(tk, { labels: dates.map((x) => x.slice(5)), data: dates.map((dt) => d.air.daily.find((x) => x.date === dt)?.aqi ?? null), color: tk.series[i], scale })} />,
      })
    }
    rows.push({ key: `s:${c.id}`, section: c.label })
    rows.push({ key: `cat:${c.id}`, info: { row: 'category', title: `${c.label} score` }, label: `${c.label} score`, sub: `MapStats score · country average ${fmtScore(national.categories[c.id])}`, cell: ({ e }) => e.categories[c.id] != null && <div className="sbs-value"><b>{fmtScore(e.categories[c.id])}</b><span className="meter"><span style={{ width: `${e.categories[c.id]}%` }} /></span></div> })
    rows.push(...indicatorsOf(c.id), ...extra)
  }

  // Climate (descriptive)
  rows.push({ key: 's:climate', section: 'Climate' })
  const anyClim = filled.some(({ d }) => d.climate)
  if (anyClim) {
    const temps = range(filled.flatMap(({ d }) => [d.climate?.monthly.map((m) => m.tmax) || [], d.climate?.monthly.map((m) => m.tmin) || []]))
    const precip = range(filled.map(({ d }) => d.climate?.monthly.map((m) => m.precip) || []), { zero: true })
    for (const [field, label] of [['tmax', 'Average daily maximum'], ['tmin', 'Average daily minimum']]) {
      rows.push({
        key: `m:${field}`, info: { row: 'monthly', title: label }, label, sub: '°C by month · same scale for both rows', chart: true, focus: `m:${field}`, na: 'Loading…',
        cell: ({ d, i }, tk) => d.climate && <MiniChart cfg={mini(tk, { labels: MONTHS, data: d.climate.monthly.map((m) => m[field]), color: tk.series[i], scale: temps })} />,
      })
    }
    rows.push({
      key: 'm:precip', info: { row: 'monthly', title: 'Precipitation' }, label: 'Precipitation', sub: 'mm by month', chart: true, focus: 'm:precip', na: 'Loading…',
      cell: ({ d, i }, tk) => d.climate && <MiniChart cfg={mini(tk, { type: 'bar', labels: MONTHS, data: d.climate.monthly.map((m) => m.precip), color: tk.series[i], scale: precip })} />,
    })
    if (filled.some(({ d }) => d.climate?.snowfall > 0)) {
      const snow = range(filled.map(({ d }) => d.climate?.monthly.map((m) => m.snow) || []), { zero: true })
      rows.push({
        key: 'm:snow', info: { row: 'monthly', title: 'Snowfall' }, label: 'Snowfall', sub: 'cm by month', chart: true, focus: 'm:snow', na: 'Loading…',
        cell: ({ d, i }, tk) => d.climate && <MiniChart cfg={mini(tk, { type: 'bar', labels: MONTHS, data: d.climate.monthly.map((m) => m.snow), color: tk.series[i], scale: snow })} />,
      })
    }
  }
  rows.push(...indicatorsOf('climate', { tint: true }))
  return rows
}
