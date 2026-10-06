import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Maximize2, Minimize2, Plus, FileSpreadsheet, Columns3, MapPin, Building2, ChartLine, Search, ArrowLeft } from 'lucide-react'
import { CATEGORIES, INDICATORS } from '../data/metrics.js'
import { familyById } from '../data/sources.js'
import { TOKENS } from './charts/theme.js'
import { useEntityDetail } from '../hooks/useEntityDetail.js'
import { fmtScore, fold } from '../lib/format.js'
import { downloadBlob } from '../lib/export.js'
import { useToast } from './Toast.jsx'
import { SideBySide } from './compare/SideBySide.jsx'
import { FocusChart } from './compare/FocusChart.jsx'

export const MAX_COMPARE = 3

/**
 * Compare up to three places, in two modes:
 *  - Side by side: one grid where every row is the same measure for every place (single scroll).
 *  - Focus chart: one measure for all places as a single full-screen chart.
 * `slots` is fixed-length (nulls for empty slots) so each place keeps its colour.
 */
export function CompareView({ slots, model, country, theme, sourceMode, live, onAdd, onRemove, onClose, onOpen }) {
  const ref = useRef(null)
  const toast = useToast()
  const [isFull, setIsFull] = useState(false)
  const [mode, setMode] = useState('side')
  const [measureId, setMeasureId] = useState('score')
  const [query, setQuery] = useState('')
  const searchRef = useRef(null)
  // Side-by-side scroll position, saved whenever we leave that mode and restored on return.
  const sideScrollRef = useRef(null)
  const sideScroll = useRef({ top: 0, left: 0 })
  // Set when a row's "large chart" button opened focus mode: where to go back to.
  const [origin, setOrigin] = useState(null) // { rowKey, query, label }
  const [flashKey, setFlashKey] = useState(null)
  // One detail loader per slot (hooks must not be called conditionally).
  const d0 = useEntityDetail(slots[0]?.lat, slots[0]?.lon)
  const d1 = useEntityDetail(slots[1]?.lat, slots[1]?.lon)
  const d2 = useEntityDetail(slots[2]?.lat, slots[2]?.lon)
  const details = [d0, d1, d2]
  const t = TOKENS[theme]
  const places = slots.map((e, i) => (e ? { e, i, d: details[i], flood: live?.flood?.[e.id] || null } : null))
  const filled = places.filter(Boolean)

  useEffect(() => {
    const onChange = () => setIsFull(document.fullscreenElement === ref.current)
    const onKey = (e) => {
      // "/" jumps to the measure search (unless already typing somewhere).
      if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === 'Escape' && !document.fullscreenElement) escRef.current()
    }
    document.addEventListener('fullscreenchange', onChange)
    window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('fullscreenchange', onChange); window.removeEventListener('keydown', onKey) }
  }, [])

  const toggleFull = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (ref.current?.requestFullscreen) await ref.current.requestFullscreen()
      else throw new Error('unsupported')
    } catch {
      toast('Fullscreen is not available here', 'error')
    }
  }

  const rows = INDICATORS.filter((i) => filled.some(({ e }) => e.values[i.id] != null))
  const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
  const exportCsv = () => {
    const esc = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))
    const head = ['indicator', 'unit', ...filled.flatMap(({ e }) => [e.name, `${e.name} scope`]), 'country average']
    const body = [
      ['MapStats score', '/100', ...filled.flatMap(({ e }) => [round1(e.score), familyById[sourceMode].short]), round1(model.national.score)],
      ...CATEGORIES.map((c) => [c.label, '/100', ...filled.flatMap(({ e }) => [round1(e.categories[c.id]), '']), round1(model.national.categories[c.id])]),
      ...rows.map((i) => [i.label, i.unit, ...filled.flatMap(({ e }) => [e.values[i.id], e.inherited?.has(i.id) ? 'province' : e.values[i.id] != null ? 'own' : '']), model.national.values[i.id]]),
    ]
    downloadBlob(new Blob(['﻿' + [head, ...body].map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' }), 'mapstats-compare.csv')
    toast('CSV downloaded')
  }

  const switchMode = (next) => {
    if (mode === 'side' && sideScrollRef.current) {
      sideScroll.current = { top: sideScrollRef.current.scrollTop, left: sideScrollRef.current.scrollLeft }
    }
    if (next === 'focus' || next === mode) return setMode(next)
    setMode(next)
    setOrigin(null)
  }
  // Opened from a side-by-side row: remember the row and search so "Back" returns to exactly there.
  const focus = (id, row) => {
    setOrigin({ rowKey: row.key, query, label: row.label })
    setMeasureId(id)
    switchMode('focus')
  }
  const back = () => {
    if (origin) { setQuery(origin.query); setFlashKey(origin.rowKey) }
    setOrigin(null)
    setMode('side')
  }
  // Esc: from a chart opened via a row, go back; otherwise close the comparison.
  const escRef = useRef(onClose)
  escRef.current = () => (mode === 'focus' && origin ? back() : onClose())

  const header = (k) => {
    const e = slots[k]
    if (!e) return <AddSlot model={model} taken={slots.filter(Boolean).map((x) => x.id)} onAdd={(sel) => onAdd(sel, k)} />
    return (
      <div className="cmp-col">
        <div className="cmp-col-head">
          <i className="swatch" style={{ background: t.series[k] }} />
          <span className="chip">{e.type === 'city' ? <MapPin size={11} /> : <Building2 size={11} />}{e.type === 'city' ? 'City' : country.regionLabel}</span>
          <button className="icon-btn sm push" onClick={() => onRemove(k)} title="Remove"><X size={14} /></button>
        </div>
        <button className="cmp-name link" onClick={() => onOpen(k)} title="Open full report">{e.name}</button>
        <div className="muted small">{e.type === 'city' ? e.provinceName : country.name} · {Math.round((e.coverage || 0) * 100)}% data</div>
      </div>
    )
  }

  return (
    <div className="fullview compare" ref={ref} role="dialog" aria-modal="true" aria-labelledby="compare-title">
      <header className="fullview-head">
        <div className="fullview-title">
          <Columns3 size={18} />
          <h2 id="compare-title">Compare places</h2>
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={mode === 'side'} className={mode === 'side' ? 'active' : ''} onClick={() => switchMode('side')}><Columns3 size={13} /> Side by side</button>
            <button role="tab" aria-selected={mode === 'focus'} className={mode === 'focus' ? 'active' : ''} onClick={() => switchMode('focus')}><ChartLine size={13} /> Focus chart</button>
          </div>
          <span className="muted small">up to {MAX_COMPARE} places · scores from {familyById[sourceMode].short}</span>
        </div>
        <div className="search-inline measure-search">
          <Search size={15} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Esc clears the search first; a second Esc closes the view.
              if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery('') }
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            placeholder={mode === 'side' ? 'Search measures… (e.g. homicide, rain, safety)' : 'Search measures to chart…'}
            aria-label="Search measures"
          />
          {query ? <button className="icon-btn sm" onClick={() => setQuery('')} title="Clear search"><X size={13} /></button> : <kbd>/</kbd>}
        </div>
        <div className="report-actions">
          <button className="icon-btn" onClick={exportCsv} title="Download comparison CSV" disabled={!filled.length}><FileSpreadsheet size={16} /></button>
          <button className="icon-btn fullscreen-btn" onClick={toggleFull} title={isFull ? 'Exit fullscreen' : 'Fullscreen'}>{isFull ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
          <button className="icon-btn" onClick={onClose} title="Close (Esc)"><X size={18} /></button>
        </div>
      </header>

      {mode === 'side' ? (
        <SideBySide places={places} header={header} national={model.national} tk={t} onFocus={focus} query={query}
          scrollRef={sideScrollRef} initialScroll={sideScroll.current} flashKey={flashKey} onFlashDone={() => setFlashKey(null)} />
      ) : (
        <div className="fullview-body focus-body">
          <div className="focus-places">
            {origin && (
              <button className="btn back-btn" onClick={back} title="Back to side by side (Esc)">
                <ArrowLeft size={14} /> Back to side by side
              </button>
            )}
            {places.map((p, k) => (p
              ? <span key={k} className="pill static"><i className="swatch" style={{ background: t.series[k] }} /> {p.e.name} · {fmtScore(p.e.score)}</span>
              : <span key={k} className="pill static muted"><Plus size={11} /> empty slot</span>))}
            <button className="link small" onClick={() => switchMode('side')}>Add or remove places</button>
          </div>
          <FocusChart places={filled} national={model.national} theme={theme} measureId={measureId} onMeasure={setMeasureId} query={query} />
        </div>
      )}
    </div>
  )
}

function AddSlot({ model, taken, onAdd }) {
  const [q, setQ] = useState('')
  const needle = fold(q.trim())
  const matches = useMemo(() => (needle.length < 1 ? [] : [...model.cities, ...model.provinces]
    .filter((e) => !taken.includes(e.id) && fold(e.name).includes(needle))
    .sort((a, b) => (fold(a.name).startsWith(needle) ? 0 : 1) - (fold(b.name).startsWith(needle) ? 0 : 1))
    .slice(0, 6)), [model, needle, taken])
  return (
    <div className="cmp-col empty-slot">
      <div className="muted small"><Plus size={13} /> Add a place</div>
      <input className="slot-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="City or region…" aria-label="Add a place to compare" />
      {matches.length > 0 && (
        <ul className="slot-results">
          {matches.map((e) => (
            <li key={e.id}><button onClick={() => { onAdd({ type: e.type, id: e.id }); setQ('') }}>{e.name} <span className="muted small">{e.type === 'city' ? e.provinceName : 'region'}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  )
}
