import { useEffect, useState } from 'react'
import { collectionBbox } from '../lib/geo.js'
import { geoUrls } from '../core/geoAssets.js'
import { loadCountryData } from '../core/countryData.js'
import { normalisePlaces } from '../core/resolve.js'

// Loads a country's region boundaries, places (its curated list, else Natural Earth's) and datasets.
export function useCountryData(country) {
  const [state, setState] = useState({ iso3: null, geo: null, cities: [], datasets: [], bbox: null, error: null })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, error: null }))
    const urls = geoUrls(country.iso3)
    Promise.all([fetch(urls.regions).then((r) => r.json()), fetch(urls.cities).then((r) => r.json()), loadCountryData(country.iso3)])
      .then(([geo, neCities, { places, datasets }]) => {
        if (cancelled) return
        const cities = normalisePlaces(places || neCities).filter((c) => c.region)
        setState({ iso3: country.iso3, geo, cities, datasets, bbox: country.bounds || collectionBbox(geo), error: null })
      })
      .catch((error) => !cancelled && setState((s) => ({ ...s, error })))
    return () => { cancelled = true }
  }, [country])

  // Only expose data once it matches the requested country, so consumers never mix countries.
  return state.iso3 === country.iso3 ? state : { ...state, geo: null, cities: [], datasets: [] }
}
