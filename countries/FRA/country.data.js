// Browser entry for France, loaded with import() only when the country is selected (its own chunk).
import { CITIES } from './places.js'
import ssmsi from './data/ssmsi.json' with { type: 'json' }
import onisr from './data/onisr.json' with { type: 'json' }
import insee from './data/insee.json' with { type: 'json' }
import drees from './data/drees.json' with { type: 'json' }
import georisques from './data/georisques.json' with { type: 'json' }
import arcep from './data/arcep.json' with { type: 'json' }
import gem from './data/gem.json' with { type: 'json' }

export default {
  places: CITIES,
  datasets: [ssmsi, onisr, insee, drees, georisques, arcep, gem],
}
