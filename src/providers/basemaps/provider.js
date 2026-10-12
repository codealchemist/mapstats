// Map tiles streamed by MapLibre (src/components/MapView.jsx).
import { defineProvider } from '#core/define.js'

export default [
  defineProvider({
    id: 'carto', short: 'CARTO', name: 'CARTO basemaps', url: 'https://carto.com/basemaps',
    covers: 'Positron / Dark Matter base map (© OpenStreetMap contributors)', access: 'tiles', cadence: 'OpenStreetMap updates', scope: 'Global',
    types: ['geo'], usedFor: 'Base map',
  }),
  defineProvider({
    id: 'terrain', short: 'Terrain', name: 'Terrain tiles (AWS Open Data)', url: 'https://registry.opendata.aws/terrain-tiles/',
    covers: 'Hillshade & elevation relief', access: 'tiles', cadence: 'Static', scope: 'Global DEM tiles', types: ['geo', 'hazards'],
    usedFor: 'Terrain & elevation overlay',
  }),
]
