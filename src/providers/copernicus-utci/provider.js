// Copernicus ERA5-HEAT: the Universal Thermal Climate Index (UTCI) from the ERA5 reanalysis, computed by ECMWF for
// the Copernicus Climate Change Service. Its daily statistics need a Copernicus account, so they are prefilled
// yearly per country (prefill.mjs) into countries/<ISO3>/data/copernicus-utci.json and score heat and cold stress
// when the UTCI standard is selected (data/standards.js). Opt-in: a country lists 'copernicus-utci'.
import { defineProvider } from '#core/define.js'

export default [
  defineProvider({
    id: 'copernicus-utci', short: 'Copernicus UTCI', name: 'Copernicus · Thermal comfort indices (ERA5-HEAT)', optIn: true,
    kind: 'measurement', family: { id: 'copernicus', label: 'Copernicus · ERA5-HEAT thermal stress', short: 'Copernicus' },
    url: 'https://cds.climate.copernicus.eu/datasets/derived-utci-historical',
    covers: 'Daily highest and lowest Universal Thermal Climate Index (UTCI) on a 0.25° grid, from the ERA5 reanalysis. Contains modified Copernicus Climate Change Service information; Licence to use Copernicus Products',
    levels: ['region', 'city'], provides: ['thermalUtci', 'utciHeatDays', 'utciColdDays'],
    access: 'import', refresh: 'year', cadence: 'Yearly prefill (final data 2–3 months after the year ends)', scope: 'Global grid ≈ 28 km', types: ['climate'],
    usedFor: 'Heat and cold stress under the UTCI standard',
  }),
]
