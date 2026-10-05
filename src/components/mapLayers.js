// MapStats custom sources & layers, added on top of whichever basemap style is active.

const SURFACE = { light: '#fcfcfb', dark: '#1a1a19' }
const INK = { light: '#0b0b0b', dark: '#ffffff' }
export const EMPTY_FC = { type: 'FeatureCollection', features: [] }
// 1×1 transparent PNG placeholder for the climate-surface image source.
const BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const BLANK_COORDS = [[-1, 1], [1, 1], [1, -1], [-1, -1]]

// River flood watch levels (forecast peak ÷ usual high water). Status colours, always shown with a label.
export const FLOOD_LEVELS = [
  { id: 'normal', max: 0.8, label: 'Below usual high water', color: '#86b6ef' },
  { id: 'near', max: 1.2, label: 'Near usual high water', color: '#fab219' },
  { id: 'above', max: 2, label: 'Above usual high water', color: '#ec835a' },
  { id: 'well-above', max: Infinity, label: 'Well above (≥ 2×)', color: '#d03b3b' },
]
export const floodLevel = (r) => FLOOD_LEVELS.find((l) => r < l.max)

// Elevation colour relief: lowland greens -> uplands tan -> high Andes white.
const RELIEF = [
  'interpolate', ['linear'], ['elevation'],
  -100, '#bfe0d6', 0, '#d8ecd2', 200, '#e9efc9', 600, '#f0e3b4', 1200, '#e2c596',
  2000, '#c9a27a', 3000, '#a88466', 4200, '#d9d4cf', 5500, '#ffffff',
]

function firstSymbolLayer(m) {
  return m.getStyle().layers.find((l) => l.type === 'symbol')?.id
}

function labelFont(m) {
  const l = m.getStyle().layers.find((x) => x.type === 'symbol' && x.layout?.['text-font'])
  const f = l?.layout['text-font']
  return Array.isArray(f) && typeof f[0] === 'string' ? f : ['Open Sans Regular']
}

export function addCustomLayers(m, theme) {
  const below = firstSymbolLayer(m)
  const surface = SURFACE[theme]
  const ink = INK[theme]

  m.addSource('dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium', tileSize: 256, maxzoom: 14,
    attribution: 'Terrain: Mapzen / AWS Open Data',
  })
  m.addSource('provinces', { type: 'geojson', data: EMPTY_FC, promoteId: 'id' })
  m.addSource('cities', { type: 'geojson', data: EMPTY_FC })
  m.addSource('quakes', { type: 'geojson', data: EMPTY_FC })
  m.addSource('surface', { type: 'image', url: BLANK, coordinates: BLANK_COORDS })
  m.addSource('flood', { type: 'geojson', data: EMPTY_FC })

  m.addLayer({ id: 'relief', type: 'color-relief', source: 'dem', layout: { visibility: 'none' }, paint: { 'color-relief-color': RELIEF, 'color-relief-opacity': 0.85 } }, below)
  m.addLayer({
    id: 'hillshade', type: 'hillshade', source: 'dem', layout: { visibility: 'none' },
    paint: { 'hillshade-exaggeration': 0.45, 'hillshade-shadow-color': theme === 'dark' ? '#000000' : '#5a5040', 'hillshade-highlight-color': '#ffffff' },
  }, below)
  m.addLayer({ id: 'prov-fill', type: 'fill', source: 'provinces', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.72 } }, below)
  m.addLayer({
    id: 'surface-layer', type: 'raster', source: 'surface', layout: { visibility: 'none' },
    paint: { 'raster-opacity': 0.82, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
  }, below)
  m.addLayer({ id: 'prov-line', type: 'line', source: 'provinces', paint: { 'line-color': surface, 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 8, 1.6], 'line-opacity': 0.9 } }, below)
  m.addLayer({ id: 'prov-hover', type: 'line', source: 'provinces', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': ink, 'line-width': 1.2, 'line-opacity': 0.55 } })
  m.addLayer({ id: 'prov-selected', type: 'line', source: 'provinces', filter: ['==', ['get', 'id'], ''], paint: { 'line-color': ink, 'line-width': 2.4 } })

  m.addLayer({
    id: 'city-heat', type: 'heatmap', source: 'cities', layout: { visibility: 'none' },
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['coalesce', ['get', 'heatWeight'], 0], 0, 0, 1, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.9, 9, 2.2],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 22, 6, 46, 10, 90],
      'heatmap-opacity': 0.82,
      'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
        0, 'rgba(57,135,229,0)', 0.15, 'rgba(158,197,244,0.55)', 0.35, '#6da7ec', 0.55, '#3987e5', 0.75, '#256abf', 1, '#0d366b'],
    },
  })

  m.addLayer({
    id: 'quake-circles', type: 'circle', source: 'quakes', layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['exponential', 1.6], ['get', 'mag'], 5, 2.5, 6, 5, 7, 10, 8.5, 20],
      'circle-color': '#eb6834', 'circle-opacity': 0.45,
      'circle-stroke-color': surface, 'circle-stroke-width': 0.6, 'circle-stroke-opacity': 0.6,
    },
  })

  m.addLayer({
    id: 'flood-circles', type: 'circle', source: 'flood', layout: { visibility: 'none' },
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['get', 'ratio'], 0, 4, 1, 6, 2, 10, 4, 15],
      'circle-color': ['match', ['get', 'level'], ...FLOOD_LEVELS.flatMap((l) => [l.id, l.color]), '#86b6ef'],
      'circle-opacity': 0.9, 'circle-stroke-color': surface, 'circle-stroke-width': 2,
    },
  })
  m.addLayer({
    id: 'city-circles', type: 'circle', source: 'cities',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'],
        3, ['interpolate', ['linear'], ['get', 'pop'], 20000, 3.5, 300000, 5, 1500000, 8, 4000000, 10],
        9, ['interpolate', ['linear'], ['get', 'pop'], 20000, 7, 300000, 10, 1500000, 14, 4000000, 18]],
      'circle-color': ['get', 'color'],
      'circle-stroke-color': surface, 'circle-stroke-width': 2,
    },
  })
  m.addLayer({
    id: 'city-selected', type: 'circle', source: 'cities', filter: ['==', ['get', 'id'], ''],
    paint: { 'circle-radius': 15, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ink, 'circle-stroke-width': 2 },
  })
  m.addLayer({
    id: 'city-labels', type: 'symbol', source: 'cities',
    layout: {
      'text-field': ['get', 'name'], 'text-font': labelFont(m), 'text-size': ['interpolate', ['linear'], ['get', 'pop'], 50000, 10.5, 2000000, 13],
      'text-offset': [0, 1.15], 'text-anchor': 'top', 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'pop']],
    },
    paint: { 'text-color': ink, 'text-halo-color': surface, 'text-halo-width': 1.4, 'text-opacity': 0.88 },
  })
}

export function syncAll(m, { provincesFC, citiesFC, quakesFC, floodFC, surface, overlays, selected }) {
  m.getSource('provinces')?.setData(provincesFC || EMPTY_FC)
  m.getSource('cities')?.setData(citiesFC || EMPTY_FC)
  m.getSource('quakes')?.setData(quakesFC || EMPTY_FC)
  m.getSource('flood')?.setData(floodFC || EMPTY_FC)
  // Only push a new image when it changed (the source is recreated on style reload, so this resets then).
  const surf = m.getSource('surface')
  const url = surface?.url || BLANK
  if (surf && surf.msUrl !== url) {
    surf.updateImage({ url, coordinates: surface?.coordinates || BLANK_COORDS })
    surf.msUrl = url
  }
  const vis = (id, on) => m.getLayer(id) && m.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
  vis('relief', overlays.relief)
  vis('hillshade', overlays.relief)
  vis('city-heat', overlays.heat)
  vis('quake-circles', overlays.quakes)
  vis('city-circles', overlays.cities)
  vis('city-selected', overlays.cities)
  vis('city-labels', overlays.labels)
  vis('prov-fill', overlays.choropleth)
  vis('surface-layer', overlays.surface && !!surface)
  vis('flood-circles', overlays.flood)
  // A climate surface replaces the region colours (two colour scales at once would be unreadable);
  // the fill stays at opacity 0 so regions remain hoverable and clickable.
  m.setPaintProperty('prov-fill', 'fill-opacity', overlays.surface && surface ? 0 : overlays.relief ? 0.38 : 0.72)
  m.setFilter('prov-selected', ['==', ['get', 'id'], selected?.type === 'province' ? selected.id : ''])
  m.setFilter('city-selected', ['==', ['get', 'id'], selected?.type === 'city' ? selected.id : ''])
}
