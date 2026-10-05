import { useEffect, useMemo, useState } from 'react'
import { fetchNews, newsQuery, needsRegion, fold } from '../lib/news.js'
import { newsSettings } from '../data/countries.js'

// Recent crime news for the selected place (city, region, or a searched place), from our
// /api/news function (RSS discovery + article excerpts, cached 24 h server-side).
export function useNews(entity, country, model) {
  const [state, setState] = useState({ status: 'idle', articles: [], error: null })
  const [reload, setReload] = useState(0)
  // City names that occur in more than one region of the loaded country also need the region name.
  const ambiguous = useMemo(() => {
    const seen = {}
    for (const c of model?.cities || []) (seen[fold(c.name)] ||= new Set()).add(c.province)
    for (const p of model?.provinces || []) (seen[fold(p.name)] ||= new Set()).add(p.id)
    return new Set(Object.entries(seen).filter(([, s]) => s.size > 1).map(([k]) => k))
  }, [model?.cities, model?.provinces])

  const name = entity?.name, provinceName = entity?.provinceName, type = entity?.type
  const disambiguate = name ? needsRegion({ name, provinceName, type }, ambiguous) : false
  useEffect(() => {
    if (!name) return
    const ctrl = new AbortController()
    setState((s) => ({ status: 'loading', articles: reload ? s.articles : [], error: null }))
    fetchNews({ entity: { name, provinceName, type }, country, disambiguate, signal: ctrl.signal })
      .then((r) => setState({ status: r.status, articles: r.articles || [], fetchedAt: r.fetchedAt, expiresAt: r.expiresAt, complete: r.complete, fallbackQuery: r.fallbackQuery || null, error: r.error || null }))
      .catch((e) => e.name !== 'AbortError' && setState({ status: 'error', articles: [], error: e.message, code: e.code }))
    return () => ctrl.abort()
  }, [name, provinceName, type, country, disambiguate, reload])

  // The query is known before (and regardless of) the request, e.g. for the Google News link.
  const query = name ? newsQuery({ name, provinceName, type }, newsSettings(country.iso3), ambiguous) : null
  return { ...state, query, refresh: () => setReload((n) => n + 1) }
}
