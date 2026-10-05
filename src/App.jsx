import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapView } from './components/MapView.jsx'
import { TopBar } from './components/TopBar.jsx'
import { SidePanel } from './components/SidePanel.jsx'
import { Legend } from './components/Legend.jsx'
import { ReportPanel } from './components/ReportPanel.jsx'
import { LiveStatus } from './components/LiveStatus.jsx'
import { Methodology } from './components/Methodology.jsx'
import { SourcesView } from './components/SourcesView.jsx'
import { CompareView } from './components/CompareView.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { COUNTRIES, countryByIso } from './data/countries.js'
import { DEFAULT_WEIGHTS, metricById } from './data/metrics.js'
import { familyOf, isMultiSource } from './data/sources.js'
import { useCountryData } from './hooks/useCountryData.js'
import { useLiveData } from './hooks/useLiveData.js'
import { adHocEntity, buildEntities, ownValue } from './lib/scoring.js'
import { colorAt, scaleFor } from './lib/colors.js'
import { renderSurface, surfaceSamples, surfaceVarById } from './lib/surface.js'
import { livePoints } from './lib/scoring.js'
import { floodLevel } from './components/mapLayers.js'

const store = {
  get: (k, d) => { try { const v = localStorage.getItem(`mapstats:${k}`); return v ? JSON.parse(v) : d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(`mapstats:${k}`, JSON.stringify(v)) } catch { /* ignore */ } },
}

const DEFAULT_OVERLAYS = { choropleth: true, cities: true, labels: true, heat: false, quakes: false, relief: false, flood: false, surface: false, surfaceVar: 'tempMaxAnnual' }

const initialTheme = () => store.get('theme', window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

export default function App() {
  const [iso3, setIso3] = useState(() => store.get('country', 'ARG'))
  const [theme, setTheme] = useState(initialTheme)
  const [metricId, setMetricId] = useState('score')
  const [overlays, setOverlays] = useState(DEFAULT_OVERLAYS)
  // Bumped by the logo (home view) to remount stateful panels: search text, side-panel tab.
  const [homeKey, setHomeKey] = useState(0)
  const [weights, setWeights] = useState(() => ({ ...DEFAULT_WEIGHTS, ...store.get('weights', {}) }))
  const [sourceMode, setSourceMode] = useState(() => store.get('sourceMode', 'combined'))
  const [selected, setSelected] = useState(null) // { type, id } | { type: 'adhoc', entityInput }
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 820)
  const [showInfo, setShowInfo] = useState(false)
  const [showSources, setShowSources] = useState(false)
  // Compare slots keep their position (and colour) when another place is removed.
  const [compare, setCompare] = useState([null, null, null])
  const [showCompare, setShowCompare] = useState(false)
  const mapRef = useRef(null)

  const country = countryByIso(iso3)
  const data = useCountryData(country)
  const live = useLiveData(data)

  useEffect(() => { document.documentElement.dataset.theme = theme; store.set('theme', theme) }, [theme])
  useEffect(() => store.set('country', iso3), [iso3])
  useEffect(() => store.set('weights', weights), [weights])
  useEffect(() => store.set('sourceMode', sourceMode), [sourceMode])

  const model = useMemo(
    () => (data.geo ? buildEntities({ country, provincesGeo: data.geo, cities: data.cities, live, weights, sourceMode }) : null),
    [country, data.geo, data.cities, live, weights, sourceMode],
  )

  // Ad-hoc (searched) places are rescored when weights change.
  const adHoc = useMemo(() => {
    if (selected?.type !== 'adhoc') return null
    const provinceEntity = model?.provinces.find((p) => p.id === selected.input.provinceId)
    return adHocEntity({ ...selected.input, provinceEntity, country, weights, sourceMode, dist: model?.dist })
  }, [selected, model, country, weights, sourceMode])

  const adHocPoint = useMemo(() => adHoc && { lat: adHoc.lat, lon: adHoc.lon }, [adHoc?.lat, adHoc?.lon]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedEntity = useMemo(() => {
    if (!selected || !model) return null
    if (selected.type === 'adhoc') return adHoc
    const list = selected.type === 'city' ? model.cities : model.provinces
    return list.find((e) => e.id === selected.id) || null
  }, [selected, model, adHoc])

  const metric = metricById[metricId]
  // Indicator layers show each place's own value only: cities without city-level data render as "no data"
  // rather than repeating their province's figure.
  const valueOf = useCallback(
    (e) => (metricId === 'score' ? e.score : metricId.startsWith('cat:') ? e.categories[metricId.slice(4)] : ownValue(e, metricId)),
    [metricId],
  )

  const scale = useMemo(() => {
    if (!model) return null
    return scaleFor(metric, [...model.provinces, ...model.cities].map(valueOf), theme)
  }, [model, metric, valueOf, theme])

  const provincesFC = useMemo(() => {
    if (!model) return null
    const byId = Object.fromEntries(model.provinces.map((p) => [p.id, p]))
    return {
      type: 'FeatureCollection',
      features: data.geo.features.map((f) => {
        const e = byId[f.properties.id]
        const v = valueOf(e)
        return { ...f, properties: { id: e.id, name: e.name, value: v ?? undefined, score: e.score ?? undefined, rank: e.rank, color: colorAt(scale, v, theme) } }
      }),
    }
  }, [model, data.geo, valueOf, scale, theme])

  const citiesFC = useMemo(() => {
    if (!model) return null
    const scores = model.cities.map((c) => c.score).filter((s) => s != null)
    const [lo, hi] = [Math.min(...scores), Math.max(...scores)]
    return {
      type: 'FeatureCollection',
      features: model.cities.map((c) => {
        const v = valueOf(c)
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
          properties: {
            id: c.id, name: c.name, provinceName: c.provinceName, pop: c.values.pop || 50000, value: v ?? undefined,
            score: c.score ?? undefined, rank: c.rank, color: colorAt(scale, v, theme),
            heatWeight: c.score == null || hi === lo ? 0 : ((c.score - lo) / (hi - lo)) ** 1.5,
          },
        }
      }),
    }
  }, [model, valueOf, scale, theme])

  const quakesFC = useMemo(() => live.quakes && {
    type: 'FeatureCollection',
    features: live.quakes.map((q) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [q.lon, q.lat] }, properties: { mag: q.mag } })),
  }, [live.quakes])

  // Interpolated climate surface, rendered only while the overlay is on.
  const surfaceVar = surfaceVarById[overlays.surfaceVar]
  const surface = useMemo(() => {
    if (!overlays.surface || !data.geo) return null
    const points = [...livePoints(data.geo, data.cities), ...live.grid]
    return renderSurface({ samples: surfaceSamples(surfaceVar, points, live), fc: data.geo, bbox: data.bbox, rampName: surfaceVar.ramp })
  }, [overlays.surface, surfaceVar, data.geo, data.cities, data.bbox, live])

  // River flood watch points (cities whose GloFAS cell has a significant river).
  const floodFC = useMemo(() => model && live.flood && {
    type: 'FeatureCollection',
    features: model.cities.flatMap((c) => {
      const f = live.flood[c.id]
      if (!f?.river || f.floodWatch == null) return []
      return [{
        type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: { name: c.name, ratio: f.floodWatch, level: floodLevel(f.floodWatch).id, highWater: f.highWater, forecastPeak: f.forecastPeak, date: f.forecastPeakDate },
      }]
    }),
  }, [model, live.flood])

  const select = useCallback((sel, { fly = false } = {}) => {
    setSelected(sel)
    if (!fly || !model || !sel) return
    if (sel.type === 'adhoc') return mapRef.current?.flyTo(sel.input.place.lon, sel.input.place.lat, 9)
    const e = (sel.type === 'city' ? model.cities : model.provinces).find((x) => x.id === sel.id)
    if (e) mapRef.current?.flyTo(e.lon, e.lat, sel.type === 'city' ? 9 : 5.5)
  }, [model])

  const changeSource = (mode) => {
    setSourceMode(mode)
    if (!isMultiSource(mode) && metric.kind === 'indicator' && familyOf(metricId) !== mode) setMetricId('score')
  }

  // Resolve compare selections against the current model (so weights / source mode apply).
  const compareEntities = useMemo(() => compare.map((sel) => {
    if (!sel || !model) return null
    if (sel.type === 'adhoc') {
      const provinceEntity = model.provinces.find((p) => p.id === sel.input.provinceId)
      return adHocEntity({ ...sel.input, provinceEntity, country, weights, sourceMode, dist: model.dist })
    }
    return (sel.type === 'city' ? model.cities : model.provinces).find((e) => e.id === sel.id) || null
  }), [compare, model, country, weights, sourceMode])

  const addToCompare = useCallback((sel, slot) => {
    if (!sel) return
    setCompare((c) => {
      if (c.some((x) => x && x.id === sel.id)) return c
      const i = slot ?? c.findIndex((x) => !x)
      if (i < 0) return c // full: the view explains how to make room
      const next = [...c]
      next[i] = sel
      return next
    })
    setShowCompare(true)
  }, [])
  const compareFull = compare.every(Boolean)

  // Home view: close every data view and reset filters. Country, theme, weights and the
  // comparison list are preferences, so they are kept.
  const goHome = () => {
    setSelected(null)
    setShowCompare(false)
    setShowSources(false)
    setShowInfo(false)
    setMetricId('score')
    setOverlays(DEFAULT_OVERLAYS)
    setSourceMode('combined')
    setHomeKey((k) => k + 1)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
    if (data.bbox) mapRef.current?.fitBounds(data.bbox)
  }

  const changeCountry = (next) => {
    setCompare([null, null, null])
    setSelected(null)
    setIso3(next)
  }

  return (
    <ToastProvider>
      <div className={`app ${selectedEntity ? 'has-report' : ''}`}>
        <MapView
          ref={mapRef}
          theme={theme}
          bbox={data.bbox}
          provincesFC={provincesFC}
          citiesFC={citiesFC}
          quakesFC={quakesFC}
          floodFC={floodFC}
          surface={surface}
          overlays={overlays}
          metricId={metricId}
          metricLabel={metric.label}
          selected={selected?.type === 'adhoc' ? null : selected}
          adHocPoint={adHocPoint}
          onSelect={select}
        />

        <TopBar
          key={`top-${homeKey}`}
          onHome={goHome}
          country={country}
          countries={COUNTRIES}
          onCountry={changeCountry}
          theme={theme}
          onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          model={model}
          live={live}
          geo={data.geo}
          onSelect={select}
          onInfo={() => setShowInfo(true)}
          onSources={() => setShowSources(true)}
          onCompare={() => setShowCompare(true)}
          compareCount={compare.filter(Boolean).length}
          onTogglePanel={() => setPanelOpen((o) => !o)}
          panelOpen={panelOpen}
          mapRef={mapRef}
        />

        {panelOpen && (
          <SidePanel
            key={`side-${homeKey}`}
            model={model}
            country={country}
            live={live}
            metricId={metricId}
            onMetric={setMetricId}
            overlays={overlays}
            onOverlays={setOverlays}
            weights={weights}
            onWeights={setWeights}
            selected={selected}
            onSelect={select}
            mapRef={mapRef}
            onInfo={() => setShowInfo(true)}
            sourceMode={sourceMode}
            onSourceMode={changeSource}
          />
        )}

        <Legend surface={overlays.surface ? surface : null} surfaceVar={surfaceVar} sourceMode={sourceMode} metric={metric} scale={scale} overlays={overlays} theme={theme} national={model?.national} shifted={panelOpen} />
        <LiveStatus status={live.status} error={data.error} />

        {selectedEntity && model && (
          <ReportPanel
            key={selectedEntity.id}
            entity={selectedEntity}
            model={model}
            country={country}
            live={live}
            theme={theme}
            onClose={() => setSelected(null)}
            onCompare={() => addToCompare(selected)}
            compareState={compare.some((x) => x && x.id === selected?.id) ? 'added' : compareFull ? 'full' : 'open'}
            onSelect={select}
            sourceMode={sourceMode}
          />
        )}

        {showInfo && <Methodology onClose={() => setShowInfo(false)} weights={weights} onSources={() => { setShowInfo(false); setShowSources(true) }} />}
        {showSources && <SourcesView onClose={() => setShowSources(false)} snicOrigin={model?.snicOrigin} />}
        {showCompare && model && (
          <CompareView
            slots={compareEntities}
            model={model}
            country={country}
            theme={theme}
            sourceMode={sourceMode}
            live={live}
            onAdd={addToCompare}
            onRemove={(i) => setCompare((c) => c.map((x, k) => (k === i ? null : x)))}
            onClose={() => setShowCompare(false)}
            onOpen={(i) => { setShowCompare(false); select(compare[i], { fly: true }) }}
          />
        )}
      </div>
    </ToastProvider>
  )
}
