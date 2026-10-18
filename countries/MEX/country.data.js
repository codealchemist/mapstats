// Browser entry for this country, loaded with import() only when it is selected (its own chunk). No curated
// places: the app uses the Natural Earth city list.
import gem from './data/gem.json' with { type: 'json' }

export default {
  places: null,
  datasets: [gem],
}
