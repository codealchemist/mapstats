// Browser entry for Argentina, loaded with import() only when the country is selected (its own chunk).
import { CITIES } from './places.js'
import provincialStats from './data/provincial-stats.json' with { type: 'json' }
import snic from './data/snic.json' with { type: 'json' }

export default {
  places: CITIES,
  datasets: [provincialStats, snic],
}
