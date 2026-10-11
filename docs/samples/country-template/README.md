# Exampleland (XXX)

> Template. `npm run country:new -- <ISO3>` copies this folder to `countries/<ISO3>/` and replaces `XXX`, `XX` and the names.
> Sample file paths are the target layout ([architecture](../../architecture.md#31-folder-layout)); imports use the `#core` and `#sdk` aliases, so they work from either location.

| | |
|---|---|
| Tier | 2 · Curated *(from `npm run country:check -- XXX`)* |
| Maintainers | @your-github-handle |
| Regions | 2 provinces (Natural Earth) · 2 curated cities |
| Last prefill | 2026-04-20 |

## Sources

| Provider | Indicators | Level | Latest | Next release |
|---|---|---|---|---|
| [example-stats](providers/example-stats/) | internet, water, poverty, unemployment | region | 2025 | April 2027 |
| Open-Meteo, USGS *(global, live)* | climate, air, UV, floods, elevation, earthquakes | point | live | — |

## Coverage by category

| Category | Status |
|---|---|
| Safety | ✗ no source yet (see gaps) |
| Natural risks | ✓ live (USGS, GloFAS) |
| Environment | ✓ live (CAMS, ERA5) |
| Services | ◐ internet, water: region level |
| Infrastructure | ✗ |
| Economy | ◐ poverty, unemployment: region level |

## Known gaps and next steps

- Safety: the national police publish yearly crime counts by municipality as PDF only. Ask the office for CSV; extracting the PDF tables would need a new shared SDK parser (core-team issue).
- Unemployment is urban-only. Rural regions show "not published".

## Files

| Path | What |
|---|---|
| `country.config.js` | Manifest: identity, geo settings, providers, news, maintainers |
| `country.data.js` | Browser entry (lazy): places, datasets, custom report sections |
| `places.js` | Curated cities and code crosswalks |
| `news.js` | News language, edition, ambiguous names, outlets |
| `providers/<id>/` | One folder per source: metadata, prefill, fixtures, test, README |
| `data/` | Generated datasets (committed). Do not edit by hand: re-run the prefill. |
| `geo/` | Generated boundaries and cities (`npm run geo:build -- XXX`) |
