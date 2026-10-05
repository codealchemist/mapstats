import { useEffect, useRef } from 'react'
import { Chart } from 'react-chartjs-2'
import { Check, Focus } from 'lucide-react'
import { CATEGORIES, INDICATORS } from '../../data/metrics.js'
import { SURVEY } from '../../data/numbeoSurvey.js'
import { baseOptions, barStyle, lineStyle } from '../charts/theme.js'
import { fmtIndicator, fmtScore, MONTHS } from '../../lib/format.js'
import { normalise, isOwnValue } from '../../lib/scoring.js'
import { sourceOf } from '../../data/sources.js'
import { floodLevel } from '../mapLayers.js'
import { matches } from './match.js'

/**
 * One grid, one scroll container: every row is the same measure for every place, so the
 * columns always scroll together and line up. Charts in a row share one axis range.
 * places: fixed-length array (3) of { e, i, d, flood } or null for an empty slot.
 */
export function SideBySide({ places, header, national, curated, country, tk, onFocus, query = '', scrollRef, initialScroll, flashKey, onFlashDone }) {
  const filled = places.filter(Boolean)
  const rows = filterRows(buildRows(filled, national, curated, country), query)
  return (
    <div className="sbs-scroll" ref={(el) => {
      if (!el || !scrollRef) return
      // Restore the saved position once, on mount (coming back from focus mode).
      if (scrollRef.current !== el && initialScroll) { el.scrollTop = initialScroll.top; el.scrollLeft = initialScroll.left }
      scrollRef.current = el
    }}>
      <div className="sbs-grid" style={{ '--cols': places.length }}>
        <div className="sbs-corner sbs-sticky-top sbs-sticky-left" />
        {places.map((p, k) => <div key={k} className="sbs-head sbs-sticky-top">{header(k)}</div>)}

        {!rows.length && <div className="sbs-section sbs-empty">No measure matches “{query}”.</div>}
        {rows.map((r) => (r.section ? (
          <div key={r.key} className="sbs-section">{r.section}{r.score && <span className="muted"> · category score</span>}</div>
        ) : (
          <Row key={r.key} r={r} places={places} tk={tk} onFocus={onFocus} flash={r.key === flashKey} onFlashDone={onFlashDone} />
        )))}
      </div>
    </div>
  )
}

function Row({ r, places, tk, onFocus, flash, onFlashDone }) {
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
        {r.focus && <button className="icon-btn sm" onClick={() => onFocus(r.focus, r)} title="Show as one large chart"><Focus size={13} /></button>}
      </div>
      {places.map((p, k) => (
        <div key={k} className={`sbs-cell ${r.chart ? 'chart' : ''}${fl}`}>
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
function buildRows(filled, national, curated, country) {
  const rows = []
  const regionLabel = country?.regionLabel || 'Region'
  const bestOf = (ind) => {
    if (!ind.better || filled.length < 2) return null
    const own = filled.filter(({ e }) => isOwnValue(e, ind.id) || e.type === 'province')
    if (own.length < 2) return null
    const vals = own.map(({ e }) => normalise(ind.id, e.values[ind.id]))
    const top = Math.max(...vals)
    return new Set(own.filter((_, k) => vals[k] === top).map(({ e }) => e.id))
  }
  const indicatorRow = (ind) => {
    const best = bestOf(ind)
    return {
      key: `ind:${ind.id}`, label: ind.label, sub: sourceOf(ind.id, country?.iso3) || '', focus: `ind:${ind.id}`,
      cell: ({ e }) => {
        const v = e.values[ind.id]
        if (v == null) return null
        const n = normalise(ind.id, v)
        return (
          <div className={`sbs-value ${best?.has(e.id) ? 'best' : ''}`}>
            <b>{best?.has(e.id) && <Check size={12} />} {fmtIndicator(ind.id, v)}</b>
            {e.inherited?.has(ind.id) && <span className="tag" title={`${regionLabel} figure, not this place's own`}>{regionLabel.toLowerCase()}</span>}
            {n != null && <span className="meter"><span style={{ width: `${n}%` }} />{national.values[ind.id] != null && <i style={{ left: `${normalise(ind.id, national.values[ind.id])}%` }} />}</span>}
          </div>
        )
      },
    }
  }
  const indicatorsOf = (cat) => INDICATORS.filter((i) => i.category === cat && filled.some(({ e }) => e.values[i.id] != null)).map(indicatorRow)

  // Overview
  rows.push({ key: 's:overview', section: 'Overview' })
  rows.push({
    key: 'score', label: 'MapStats score', sub: `Country average ${fmtScore(national.score)}`, focus: 'score',
    cell: ({ e }) => <div className="sbs-score">{fmtScore(e.score)}<small>/100</small><span className="muted small">{e.rank ? `#${e.rank} of ${e.rankOf}` : 'not ranked'}</span></div>,
  })
  rows.push({
    key: 'cats', label: 'Score by category', sub: '0–100', chart: true, focus: 'categories',
    cell: ({ e, i }, tk) => <MiniChart height={170} cfg={mini(tk, { type: 'bar', horizontal: true, labels: CATEGORIES.map((c) => c.label), data: CATEGORIES.map((c) => e.categories[c.id]), color: tk.series[i], scale: { min: 0, max: 100 } })} />,
  })

  for (const c of CATEGORIES) {
    const extra = []
    if (c.id === 'safety') {
      // Official statistical series (SNIC, …) with a chart, for every place that has them.
      for (const [fam, o] of Object.entries(curated?.official || {})) {
        if (!filled.some(({ e }) => e.official?.[fam]?.series)) continue
        for (const [metric, m] of Object.entries(o.metrics || {}).filter(([, m]) => m.chart)) {
          const scale = range(filled.map(({ e }) => e.official?.[fam]?.series?.[metric] || []), { zero: true })
          extra.push({
            key: `${fam}:${metric}`, label: `${m.chart[0]} by year`, sub: `per 100,000 · ${o.label}`, chart: true, focus: `${fam}:${metric}`, na: `No ${o.label} data`,
            cell: ({ e, i }, tk) => e.official?.[fam]?.series && <MiniChart cfg={mini(tk, { labels: o.years, data: e.official[fam].series[metric], color: tk.series[i], scale })} />,
          })
        }
      }
      const keys = SURVEY.filter(([k]) => filled.some(({ e }) => e.numbeo?.survey?.[k] != null))
      if (keys.length) {
        extra.push({
          key: 'survey', label: 'Numbeo crime survey', sub: '0–100 · higher = worse, except walking safety', chart: true, focus: 'survey', na: 'No Numbeo survey',
          cell: ({ e, i }, tk) => e.numbeo?.survey && <MiniChart height={keys.length * 18 + 30} cfg={mini(tk, { type: 'bar', horizontal: true, labels: keys.map(([, l]) => l.replace(/^(Worries|Problem): /, '')), data: keys.map(([k]) => e.numbeo.survey[k] ?? null), color: tk.series[i], scale: { min: 0, max: 100 } })} />,
        })
      }
    }
    if (c.id === 'hazards' && filled.some(({ flood }) => flood)) {
      extra.push({
        key: 'flood', label: 'River flood watch', sub: '30-day peak ÷ usual high water · GloFAS', focus: 'flood', na: 'No significant river',
        cell: ({ flood }) => flood?.river && flood.floodWatch != null && (
          <div className="sbs-value"><b>{flood.floodWatch.toFixed(2)}×</b><span className="muted small">{floodLevel(flood.floodWatch).label}</span></div>
        ),
      })
    }
    if (c.id === 'environment' && filled.some(({ d }) => d.air)) {
      const dates = [...new Set(filled.flatMap(({ d }) => d.air?.daily.map((x) => x.date) || []))].sort()
      const scale = range(filled.map(({ d }) => d.air?.daily.map((x) => x.aqi) || []), { zero: true })
      extra.push({
        key: 'aqi', label: 'Daily air quality', sub: 'European AQI, last 3 months', chart: true, focus: 'aqi', na: 'Loading…',
        cell: ({ d, i }, tk) => d.air && <MiniChart cfg={mini(tk, { labels: dates.map((x) => x.slice(5)), data: dates.map((dt) => d.air.daily.find((x) => x.date === dt)?.aqi ?? null), color: tk.series[i], scale })} />,
      })
    }
    rows.push({ key: `s:${c.id}`, section: c.label })
    rows.push({ key: `cat:${c.id}`, label: `${c.label} score`, sub: `Country average ${fmtScore(national.categories[c.id])}`, cell: ({ e }) => e.categories[c.id] != null && <div className="sbs-value"><b>{fmtScore(e.categories[c.id])}</b><span className="meter"><span style={{ width: `${e.categories[c.id]}%` }} /></span></div> })
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
        key: `m:${field}`, label, sub: '°C by month · same scale for both rows', chart: true, focus: `m:${field}`, na: 'Loading…',
        cell: ({ d, i }, tk) => d.climate && <MiniChart cfg={mini(tk, { labels: MONTHS, data: d.climate.monthly.map((m) => m[field]), color: tk.series[i], scale: temps })} />,
      })
    }
    rows.push({
      key: 'm:precip', label: 'Precipitation', sub: 'mm by month', chart: true, focus: 'm:precip', na: 'Loading…',
      cell: ({ d, i }, tk) => d.climate && <MiniChart cfg={mini(tk, { type: 'bar', labels: MONTHS, data: d.climate.monthly.map((m) => m.precip), color: tk.series[i], scale: precip })} />,
    })
    if (filled.some(({ d }) => d.climate?.snowfall > 0)) {
      const snow = range(filled.map(({ d }) => d.climate?.monthly.map((m) => m.snow) || []), { zero: true })
      rows.push({
        key: 'm:snow', label: 'Snowfall', sub: 'cm by month', chart: true, focus: 'm:snow', na: 'Loading…',
        cell: ({ d, i }, tk) => d.climate && <MiniChart cfg={mini(tk, { type: 'bar', labels: MONTHS, data: d.climate.monthly.map((m) => m.snow), color: tk.series[i], scale: snow })} />,
      })
    }
  }
  rows.push(...indicatorsOf('climate'))
  return rows
}
