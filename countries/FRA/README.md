# France (FRA)

| | |
|---|---|
| Tier | 2 · Curated *(from `npm run country:check -- FRA`)* |
| Maintainers | @gasp |
| Regions | 101 départements (Natural Earth) · 40 curated cities pinned to their INSEE commune |
| Last prefill | 2026-10-22 (sources downloaded 2026-10-05/06) |

## Sources

| Provider | Indicators | Level | Latest | Next release |
|---|---|---|---|---|
| [ssmsi](providers/ssmsi/) | homicide, propertyCrime (scored, 3-year averages); 15 other recorded-crime categories shown | département (Paris at city level) | 2025 | July 2027 |
| [onisr](providers/onisr/) | roadDeaths (scored, 3-year average) | département | 2024 | Autumn 2026 (2025 files) |
| [insee](providers/insee/) | unemployment, lifeExp (scored); lifeExpWomen, lifeExpMen, povertyRelative, transitCommute, pop (context) | département; commune for relative poverty, commuting and population | 2025 (unemployment, life expectancy), 2023 (Filosofi, census, population) | June / September / summer each year |
| [drees](providers/drees/) | doctors (scored) | département | 1 January 2026 | Summer 2027 |
| [georisques](providers/georisques/) | seismicZone, floodExposure, fireExposure (context) | commune, population-weighted per département | GASPAR export 2026-10-05 | continuous |
| [arcep](providers/arcep/) | fibreCoverage (context) | département, commune | 2026 Q2 | quarterly |
| GEM *(global)* | pga475 (scored), pga475Max | région, city | v2023.1 | — |
| Open-Meteo, USGS *(global, live)* | climate, air, UV, heat and cold, floods, elevation, earthquakes | point | live | — |

Three source families appear in the source selector: SSMSI, ONISR and INSEE & DREES (plus GEM and Open-Meteo). Everything else is context: it is shown in reports and comparisons but never scored.

## Coverage by category

| Category | Status |
|---|---|
| Safety | ✓ homicide, thefts and robberies (SSMSI), road deaths (ONISR): 101/101 départements, yearly series |
| Natural risks | ✓ GEM seismic hazard (100/101, no Mayotte); regulatory seismic zone and GASPAR flood / forest-fire classes as context |
| Environment | ✓ live (CAMS, ERA5, UV) |
| Services | ◐ physicians (DREES); fibre eligibility as context. No water, sewer or household-internet figure: see gaps |
| Economy | ◐ unemployment (100/101, none for Mayotte), life expectancy (101/101); relative poverty as context (97/101) |

Cities inherit their département's scored figures (the SSMSI, ONISR, INSEE and DREES families only publish per département); Paris, its own département, gets them as its own. Cities carry their own INSEE population, relative poverty, commuting share, seismic zone, flood and forest-fire classes and fibre eligibility.

## Known gaps and next steps

- **Commune-level crime.** The SSMSI publishes a commune base (CSV.gz / Parquet) with the same indicators: importing it would give the 40 cities their own crime figures and reach Tier 3.
- **Deliberately null** (no official figure matches the catalogue's definition): `poverty` (France publishes a relative threshold, kept as `povertyRelative`), `hdi`, `water`, `sewer`, `internet` (ARCEP measures eligibility, kept as `fibreCoverage`). SISPEA (water and sanitation services) and the census's household equipment tables are candidates.
- **News outlets:** none verified yet; `news.js` lists regional dailies to probe (`npm run news:probe -- --country=FRA --outlets-only`).
- **BAAC 2025** once the ONISR publishes it (road deaths currently 2022–2024).
- **Mayotte** has no seismic zoning, no GASPAR classes (absent from the 2023 commune population file), no unemployment series and no Filosofi figure.

## Files

| Path | What |
|---|---|
| `country.config.js` | Manifest: identity, mainland bounds, providers, news, maintainers |
| `country.data.js` | Browser entry (lazy): places and the seven datasets |
| `places.js` | The 40 cities with their INSEE commune codes and 2023 municipal populations |
| `news.js` | News language, edition, ambiguous names, outlet candidates |
| `lib/fr.mjs` | Shared prefill helpers: département codes, zip / dBase readers, GASPAR CSVs, INSEE reference populations |
| `providers/<id>/` | One folder per source: metadata, prefill, parser, fixtures, test, README, `raw/manifest.json` |
| `data/` | Generated datasets (committed). Do not edit by hand: re-run `npm run prefill -- FRA`. |
| `geo/` | Generated boundaries and cities (`npm run geo -- FRA`) |
