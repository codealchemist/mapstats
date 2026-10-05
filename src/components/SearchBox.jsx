import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, MapPin, Building2, Globe, LoaderCircle, X } from 'lucide-react'
import { fold } from '../lib/format.js'
import { fetchAqiBatch, fetchClimateBatch, geocode } from '../lib/live.js'
import { PRIORITY } from '../lib/meteoQueue.js'
import { countQuakesNear } from '../lib/scoring.js'
import { pointInFeature } from '../lib/geo.js'

export function SearchBox({ model, country, live, geo, onSelect }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)

  const local = useMemo(() => {
    if (!model || q.trim().length < 1) return []
    const needle = fold(q.trim())
    const match = (e) => fold(e.name).includes(needle)
    const score = (e) => (fold(e.name).startsWith(needle) ? 0 : 1)
    return [...model.cities.filter(match), ...model.provinces.filter(match)]
      .sort((a, b) => score(a) - score(b) || (b.values.pop || 0) - (a.values.pop || 0))
      .slice(0, 6)
  }, [model, q])

  useEffect(() => {
    if (q.trim().length < 3) { setRemote([]); return }
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      geocode(q)
        .then((r) => !cancelled && setRemote(r))
        .catch(() => !cancelled && setRemote([]))
        .finally(() => !cancelled && setLoading(false))
    }, 320)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  useEffect(() => {
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const known = new Set(local.map((e) => fold(e.name)))
  const items = [
    ...local.map((e) => ({ kind: 'local', e })),
    ...remote.filter((g) => !known.has(fold(g.name))).slice(0, 5).map((g) => ({ kind: 'remote', g })),
  ]

  const pickRemote = async (g) => {
    const inCountry = g.countryCode === country.iso2
    const prov = inCountry && geo ? geo.features.find((f) => pointInFeature([g.lon, g.lat], f)) : null
    const base = { place: g, provinceId: prov?.properties.id, provinceName: prov?.properties.name || g.admin1 }
    const id = g.id
    const quakes = inCountry ? countQuakesNear(live.quakes, g.lat, g.lon) : null
    onSelect({ type: 'adhoc', id, input: { ...base, live: { quakes } } }, { fly: true })
    const pt = [{ id, lat: g.lat, lon: g.lon }]
    const opts = { priority: PRIORITY.user }
    const [clim, aqi] = await Promise.all([fetchClimateBatch(pt, opts), fetchAqiBatch(pt, opts)])
    const c = clim.data[id] || {}
    onSelect({
      type: 'adhoc', id,
      input: {
        ...base,
        live: {
          quakes, aqi: aqi.data[id] ?? null, climateComfort: c.climateComfort ?? null, meanTemp: c.meanTemp ?? null,
          annualPrecip: c.annualPrecip ?? null, snowfall: c.snowfall ?? null, sunshine: c.sunshine ?? null, elevation: c.elevation ?? null,
        },
      },
    })
  }

  const choose = (it) => {
    setOpen(false)
    setQ(it.kind === 'local' ? it.e.name : it.g.name)
    if (it.kind === 'local') onSelect({ type: it.e.type, id: it.e.id }, { fly: true })
    else pickRemote(it.g)
  }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && items[active]) choose(items[active])
    else if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div className="search glass" ref={boxRef}>
      <Search size={16} className="search-icon" />
      <input
        value={q}
        placeholder={`Search cities in ${country.name} or worldwide…`}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        aria-label="Search cities"
        role="combobox"
        aria-expanded={open && items.length > 0}
      />
      {loading && <LoaderCircle size={15} className="spin muted" />}
      {q && !loading && <button className="icon-btn sm" onClick={() => { setQ(''); setRemote([]) }} title="Clear"><X size={14} /></button>}
      {open && items.length > 0 && (
        <ul className="search-results glass" role="listbox">
          {items.map((it, i) => (
            <li
              key={it.kind === 'local' ? it.e.id : it.g.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(it)}
            >
              {it.kind === 'local' ? (
                <>
                  {it.e.type === 'city' ? <MapPin size={15} /> : <Building2 size={15} />}
                  <div className="sr-text">
                    <div>{it.e.name}</div>
                    <small>{it.e.type === 'city' ? it.e.provinceName : country.regionLabel}</small>
                  </div>
                  {it.e.snic && <span className="sr-tag src" title="Official SNIC crime statistics">SNIC</span>}
                  {it.e.numbeo && <span className="sr-tag src" title="Numbeo city data">Numbeo</span>}
                  {it.e.score != null && <span className="sr-score">{Math.round(it.e.score)}</span>}
                </>
              ) : (
                <>
                  <Globe size={15} />
                  <div className="sr-text">
                    <div>{it.g.name}</div>
                    <small>{[it.g.admin1, it.g.country].filter(Boolean).join(', ')}</small>
                  </div>
                  <span className="sr-tag">live</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
