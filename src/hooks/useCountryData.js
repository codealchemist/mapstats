import { useEffect, useState } from 'react'
import { baseCities } from '../lib/scoring.js'
import { collectionBbox } from '../lib/geo.js'

const geoUrl = (file) => `${import.meta.env.BASE_URL}geo/${file}`

// Loads province boundaries + city list for a country.
export function useCountryData(country) {
  const [state, setState] = useState({ iso3: null, geo: null, cities: [], bbox: null, error: null })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, error: null }))
    Promise.all([
      fetch(geoUrl(`${country.iso3}.json`)).then((r) => r.json()),
      fetch(geoUrl(`${country.iso3}-cities.json`)).then((r) => r.json()),
    ])
      .then(([geo, neCities]) => {
        if (cancelled) return
        const cities = baseCities(country, neCities).filter((c) => c.province)
        setState({ iso3: country.iso3, geo, cities, bbox: country.bounds || collectionBbox(geo), error: null })
      })
      .catch((error) => !cancelled && setState((s) => ({ ...s, error })))
    return () => { cancelled = true }
  }, [country])

  // Only expose data once it matches the requested country, so consumers never mix countries.
  return state.iso3 === country.iso3 ? state : { ...state, geo: null, cities: [] }
}
