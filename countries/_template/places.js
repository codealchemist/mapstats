// Curated places and code crosswalks. Optional: without CITIES the app uses the Natural Earth city list.

// Statistics office region code → region id in geo/regions.json (ISO 3166-2). Codes are stabler than names.
export const REGION_CODES = {
  '01': 'XX-N',
  '02': 'XX-S',
}

// City ids are permanent (saved compare slots and links use them).
// `codes` links the city to each provider's own identifiers: `subregion` picks the municipality-level
// values of any dataset; provider-specific keys (e.g. `numbeo`) are read by that provider.
export const CITIES = [
  { id: 'XXX-capital-city', name: 'Capital City', region: 'XX-N', lat: -12.05, lon: -77.04, pop: 1_250_000, capital: true,
    codes: { subregion: '01001', numbeo: 'Capital-City' } },
  { id: 'XXX-port-town', name: 'Port Town', region: 'XX-S', lat: -14.08, lon: -75.73, pop: 180_000,
    codes: { subregion: '02004' } },
]
