import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Map as MLMap, NavigationControl, ScaleControl, Popup, Marker, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre 6 derives its worker URL at runtime, which bundlers can't see; let Vite bundle it explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)
import { fmtIndicator, fmtScore } from '../lib/format.js'
import { addCustomLayers, syncAll, FLOOD_LEVELS } from './mapLayers.js'

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
}


/**
 * Thin imperative wrapper around MapLibre. React owns the data; this component
 * mirrors it into GeoJSON sources and re-adds custom layers whenever the basemap
 * style changes (theme switch).
 */
export const MapView = forwardRef(function MapView(
  { theme, bbox, provincesFC, citiesFC, quakesFC, floodFC, surface, overlays, metricLabel, metricId, selected, adHocPoint, onSelect, onReady },
  ref,
) {
  const el = useRef(null)
  const map = useRef(null)
  const latest = useRef({})
  const hoverPopup = useRef(null)
  const marker = useRef(null)
  const hovered = useRef(null)

  latest.current = { provincesFC, citiesFC, quakesFC, floodFC, surface, overlays, metricLabel, metricId, selected, onSelect, theme }

  useImperativeHandle(ref, () => ({
    flyTo: (lon, lat, zoom = 9) => map.current?.flyTo({ center: [lon, lat], zoom, duration: 1400, essential: true }),
    fitBounds: (b) => map.current?.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: fitPadding(), duration: 900 }),
    snapshot: () => {
      const c = map.current?.getCanvas()
      return c ? { canvas: c, dataUrl: c.toDataURL('image/jpeg', 0.9), width: c.width, height: c.height } : null
    },
  }))

  // ---- init once ----
  useEffect(() => {
    const m = new MLMap({
      container: el.current,
      style: STYLES[theme],
      center: [-64, -38],
      zoom: 3.4,
      minZoom: 1.5,
      maxPitch: 60,
      attributionControl: { compact: true },
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    })
    map.current = m
    m.addControl(new NavigationControl({ visualizePitch: true }), 'bottom-right')
    m.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right')
    hoverPopup.current = new Popup({ closeButton: false, closeOnClick: false, className: 'ms-popup', offset: 10, maxWidth: '260px' })

    m.on('style.load', () => {
      addCustomLayers(m, latest.current.theme)
      syncAll(m, latest.current)
      onReady?.()
    })

    const floodRows = (fl) => fl
      ? `<div class="pp-sep"></div><div class="pp-row"><span>River flood watch</span><b>${fl.properties.ratio.toFixed(2)}×</b></div>` +
        `<div class="pp-sub">${escapeHtml(FLOOD_LEVELS.find((l) => l.id === fl.properties.level)?.label || '')} · 30-day peak ${Math.round(fl.properties.forecastPeak).toLocaleString('en')} m³/s on ${escapeHtml(fl.properties.date || '')} vs usual high ${Math.round(fl.properties.highWater).toLocaleString('en')} m³/s</div>`
      : ''

    const showHover = (e, f, isCity, fl) => {
      const p = f.properties
      const L = latest.current
      const value = L.metricId === 'score' || L.metricId.startsWith('cat:') ? fmtScore(p.value) : fmtIndicator(L.metricId, p.value === '' ? null : p.value)
      hoverPopup.current
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="pp-name">${escapeHtml(p.name)}</div>` +
          `<div class="pp-sub">${isCity ? escapeHtml(p.provinceName || '') : 'Region'}</div>` +
          `<div class="pp-row"><span>${escapeHtml(L.metricLabel)}</span><b>${value}</b></div>` +
          (L.metricId !== 'score' ? `<div class="pp-row"><span>MapStats score</span><b>${fmtScore(p.score)}</b></div>` : '') +
          (p.rank ? `<div class="pp-row"><span>Rank</span><b>#${p.rank}</b></div>` : '') +
          floodRows(fl),
        )
        .addTo(m)
    }

    const setHover = (id) => {
      if (hovered.current === id) return
      hovered.current = id
      if (m.getLayer('prov-hover')) m.setFilter('prov-hover', ['==', ['get', 'id'], id ?? ''])
    }

    m.on('mousemove', (e) => {
      if (!m.getLayer('prov-fill')) return
      const layers = ['city-circles', 'flood-circles', 'prov-fill'].filter((l) => m.getLayer(l) && m.getLayoutProperty(l, 'visibility') !== 'none')
      const feats = m.queryRenderedFeatures(e.point, { layers })
      const city = feats.find((f) => f.layer.id === 'city-circles')
      const flood = feats.find((f) => f.layer.id === 'flood-circles')
      const prov = feats.find((f) => f.layer.id === 'prov-fill')
      m.getCanvas().style.cursor = city || prov ? 'pointer' : ''
      if (city) { setHover(null); showHover(e, city, true, flood) }
      else if (flood) { setHover(null); hoverPopup.current.setLngLat(e.lngLat).setHTML(`<div class="pp-name">${escapeHtml(flood.properties.name)}</div>${floodRows(flood)}`).addTo(m) }
      else if (prov) { setHover(prov.properties.id); showHover(e, prov, false) }
      else { setHover(null); hoverPopup.current.remove() }
    })
    m.on('mouseout', () => { setHover(null); hoverPopup.current.remove() })
    m.on('click', (e) => {
      if (!m.getLayer('prov-fill')) return
      const feats = m.queryRenderedFeatures(e.point, { layers: ['city-circles', 'prov-fill'].filter((l) => m.getLayer(l)) })
      const city = feats.find((f) => f.layer.id === 'city-circles')
      const prov = feats.find((f) => f.layer.id === 'prov-fill')
      if (city) latest.current.onSelect({ type: 'city', id: city.properties.id })
      else if (prov) latest.current.onSelect({ type: 'province', id: prov.properties.id })
    })
    return () => m.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- theme -> swap basemap (custom layers re-added on style.load) ----
  const firstTheme = useRef(theme)
  useEffect(() => {
    if (firstTheme.current === theme) return
    firstTheme.current = null
    // diff:false forces a full reload so 'style.load' fires and custom layers are re-added.
    map.current?.setStyle(STYLES[theme], { diff: false })
  }, [theme])

  // ---- data / overlays / selection ----
  useEffect(() => {
    const m = map.current
    if (m?.getSource('provinces')) syncAll(m, latest.current)
  }, [provincesFC, citiesFC, quakesFC, floodFC, surface, overlays, selected, metricId])

  useEffect(() => {
    if (bbox && map.current) map.current.fitBounds([[bbox[0], bbox[1]], [bbox[2], bbox[3]]], { padding: fitPadding(), duration: 0 })
  }, [bbox])

  // ---- ad-hoc search result marker ----
  useEffect(() => {
    marker.current?.remove()
    if (adHocPoint && map.current) {
      const dot = document.createElement('div')
      dot.className = 'adhoc-marker'
      marker.current = new Marker({ element: dot }).setLngLat([adHocPoint.lon, adHocPoint.lat]).addTo(map.current)
    }
  }, [adHocPoint])

  return <div ref={el} className="map" aria-label="Map" />
})

function fitPadding() {
  const narrow = window.innerWidth < 820
  return narrow ? { top: 120, bottom: 40, left: 20, right: 20 } : { top: 90, bottom: 40, left: 370, right: 40 }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}
