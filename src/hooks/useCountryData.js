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
    const getJson = (url) => fetch(url).then((r) => r.json())
    // The Natural Earth city list is only needed when the country ships no places of its own.
    const data = loadCountryData(country.iso3)
    const places = data.then((d) => d.places || getJson(urls.cities))
    Promise.all([getJson(urls.regions), places, data])
      .then(([geo, list, { datasets }]) => {
        if (cancelled) return
        const cities = normalisePlaces(list).filter((c) => c.region)
        setState({ iso3: country.iso3, geo, cities, datasets, bbox: country.bounds || collectionBbox(geo), error: null })
      })
      .catch((error) => !cancelled && setState((s) => ({ ...s, error })))
    return () => { cancelled = true }
  }, [country])

  // Only expose data once it matches the requested country, so consumers never mix countries.
  return state.iso3 === country.iso3 ? state : { ...state, geo: null, cities: [], datasets: [] }
}
