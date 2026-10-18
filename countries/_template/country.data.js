// Browser entry for this country, loaded with import() only when the country is selected (its own chunk).
// Without this file the app uses the Natural Earth city list and live data only.
import { CITIES } from './places.js'
import exampleStats from './data/example-stats.json' with { type: 'json' }

export default {
  places: CITIES,
  datasets: [exampleStats],
}
