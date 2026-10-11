// City ids must be unique (a place id is a key everywhere). Natural Earth repeats names across regions
// (Kansas City, MO and KS): every occurrence of a repeated id gets its region code, e.g. USA-kansas-city-us-mo.
export function uniqueCityIds(cities) {
  const count = {}
  for (const c of cities) count[c.id] = (count[c.id] || 0) + 1
  return cities.map((c) => (count[c.id] > 1 ? { ...c, id: `${c.id}-${String(c.province || 'unknown').toLowerCase()}` } : c))
}
