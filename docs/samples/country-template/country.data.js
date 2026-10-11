// Browser entry for this country, loaded with import() only when the country is selected (its own chunk).
import { CITIES } from './places.js'
import exampleStats from './data/example-stats.json'

export default {
  places: CITIES,
  datasets: [exampleStats],
  // Custom report sections, only when the generated ones (indicators, trends, survey) can't show the data:
  // [{ id: 'XXX-…', topic: 'crime', title: '…', component }] — component props: { entity, model, theme }.
  report: [],
}
