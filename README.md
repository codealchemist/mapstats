# MapStats

**Compare places by what matters to you, and find your next place to live.**

MapStats is an interactive map that scores and compares regions and cities on safety, natural risks, environment, services and economy. Choose a country, weigh the criteria you care about, and the map shows where places rank. You can open a detailed report for any place, or put up to three side by side.

Every number links back to its source, and you can switch between data sources to see how much they agree.

## Features

### Explore the map
- **Choropleth map** of regions and cities, coloured by the overall **MapStats score** (0–100, centred on the country average), a category score, or any single indicator.
- **Overlays:** region fill, city markers sized by population, city labels, livability heat map, earthquakes M5+ since 1980, terrain and elevation, river flood watch (30-day forecast), and interpolated climate surfaces (temperature, rain, UV…).
- **Search** the country's cities and regions, or any place worldwide. Places outside the city list are scored on the fly from live data.
- **16 countries:** Argentina, Bolivia, Brazil, Chile, Colombia, Ecuador, France, Germany, Italy, Mexico, Paraguay, Peru, Portugal, Spain, United States and Uruguay.

### Score places your way
- **Weights:** tune how much each category counts in the score. The map, rankings and reports update immediately.
- **Data source selector:**
  - the median of all sources (default);
  - all sources weighted by reliability (official registers and measurements count more than surveys and estimates);
  - a single source.
- **Ranking** of regions or cities, exportable as CSV or as a PDF that includes the map.

### Place reports
- Overview with score, rank, data coverage and key figures (population, elevation, temperature, rain, air quality now, UV today).
- Sections for sources, safety (official crime statistics), news, climate (10-year monthly normals), air quality and UV, natural risks, and every indicator compared with the country average.
- Export a report as **PDF** or **CSV**, and copy or download any chart.

### Compare places
- Add up to **three places** and compare them **side by side**: every measure in one row, with charts on a shared scale and the best value marked.
- **Focus chart:** one measure for all places as a single large chart.
- Search across measures, and export the comparison as CSV.

### Transparent data
- A **Data sources** view lists every source, what it covers, how often it updates and how it is accessed (live, imported, snapshot or manual).
- A **methodology** page explains how indicators are normalised, combined and weighted.

### Everywhere
- Light and dark themes.
- Works on phones and tablets: the panels open as sheets, the controls are sized for touch, and the compare view adapts to small screens.

## Data

| Kind | Sources |
|---|---|
| Live (fetched in the browser and cached locally) | Open-Meteo (ERA5 climate, CAMS air quality, UV, GloFAS river flow, elevation), USGS earthquakes, geocoding |
| Curated / imported | SNIC official crime statistics (Argentina), provincial statistics |
| Linked only | Numbeo city pages (its terms don't allow republishing its data) |
| Map | Natural Earth boundaries and places, CARTO basemaps, terrain tiles |
| News | Google News RSS and outlet feeds, through the `/api/news` function (never used in scores) |

Argentina has the most complete data: official crime statistics by department and socio-economic baselines. The other countries are scored mainly on live environmental and natural-risk data.

Live data is paced to Open-Meteo's free limits, so a large country can take a few minutes to fill in on first load. The layers that feed scores (air quality, heat and cold, UV) load first, then climate. River flow and the grid points that fill the climate surfaces between cities load only on request: when you turn on their overlay, pick a river metric, open a comparison of cities, or press *Load river data* in a city report. After that it is cached in your browser: climate for 30 days, air quality for 1 day, earthquakes for 7 days.

## Running the project

Requirements: **Node.js 20** and npm.

```bash
npm install
npm run dev        # http://localhost:5173
```

The Vite dev server also serves `/api/news`, using the same handler as production, so the news section works locally.

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |
| `npm test` | Every offline test: news pipeline, live-data loading, the golden scoring snapshot and each provider's tests |
| `npm run news:test` / `live:test` / `golden` | One of those suites |
| `npm run e2e` | Browser tests (Playwright, desktop and phone) of the production build, with every data service mocked; run `npx playwright install chromium` once first |
| `npm run screenshots -- --url <app>` | Screenshots of the running app at desktop and phone size, dark theme by default (`--theme light`), with an `index.md` of captions to paste into a PR: the map, layers, reports, a comparison, methodology and sources. Options in `scripts/screenshots.mjs`; output in `screenshots/` (gitignored) |
| `npm run dev:netlify` | Run in a local Netlify environment (functions + Blobs) on http://localhost:8888 |
| `npm run deploy:preview` | Deploy a draft to Netlify with its own preview URL |
| `npm run deploy` | Lint and test, then deploy to production on Netlify |

The Netlify commands run the Netlify CLI through `npx`. The first time, log in and link the site with `npx -p netlify-cli netlify login` and `npx -p netlify-cli netlify link`.

### Countries and their data

Each country lives in `countries/<ISO3>/`; the [country guide](docs/country-guide.md) explains how to add or improve one. These commands prepare the data shipped with the app. The app itself never calls these sources.

| Command | What it does |
|---|---|
| `npm run country:new -- <ISO3> --iso2 XX --name "…" --region-label …` | Start a country folder and register it |
| `npm run geo -- <ISO3>` | Rebuild boundaries and city lists in `countries/<ISO3>/geo/` from Natural Earth, with the country's `geo` settings (`NE_DIR=/path/to/natural-earth`; no country = all) |
| `npm run prefill -- <ISO3> [--provider <id>]` | Run a country's provider prefills: check each dataset and write `countries/<ISO3>/data/<id>.json` |
| `npm run country:check -- <ISO3>` | Check a country folder: datasets, coverage, score ranges, provider tests, tier |
| `npm run prefill:due` | List datasets older than their providers' refresh period (also run monthly by CI, which opens an issue) |
| `npm run snic:import` | Argentina: official SNIC crime statistics from the stored bases (see `countries/ARG/providers/snic/prefill.mjs`) |
| `npm run anchors` | Recompute the score ranges from all countries' data (`src/data/anchors.json`); run it when datasets change (`npm test` fails until you do) |

## Project structure

```
src/
  App.jsx            app state: country, selection, weights, overlays, compare slots
  components/        map, top bar, side panel, legend, reports, compare and sources views
  components/charts/ Chart.js cards and theme
  components/compare/side-by-side grid, focus chart and their measures
  components/report/ report blocks drawn from any provider's data (trends, surveys)
  core/              registries and contracts: countries, providers, the dataset resolver
  providers/         global data sources (Open-Meteo, USGS, Natural Earth, basemaps, news; Numbeo as links)
  data/              indicator catalogue and categories
  hooks/             data loading (country data, live data, place details, news)
  lib/               scoring, reliability weights, colours, formatting, live APIs and request queue, exports
countries/<ISO3>/    one folder per country: manifest, places, news, providers, datasets, geo
countries/_template/ worked example country
tools/               SDK and CLI for country developers (prefill, country:check, country:new…)
netlify/             /api/news function and the news pipeline
tests/               golden scoring snapshot; e2e/ browser tests and their API mocks
scripts/             Natural Earth build, news probe
```

## Documentation

| Document | For |
|---|---|
| [Architecture](docs/architecture.md) | Core structure, the country/provider/dataset contracts, the prefill process and the migration |
| [Country integration guide](docs/country-guide.md) | Developers adding or improving a country: choosing sources, writing a provider, testing, PR checklist |
| [Country template](countries/_template/) | A complete example country folder with one provider, a fixture and a test |
| [Dataset schema](docs/schemas/dataset.schema.json) | The JSON format every prefill produces |

## Deployment

The app is a static Vite build plus one Netlify function (`/api/news`) that uses Netlify Blobs as a 24-hour cache. It runs on the Netlify free plan. `netlify.toml` defines the build command, the publish folder and the functions folder.
