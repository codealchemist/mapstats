# Country integration guide

How to add a country to MapStats, or improve one, by working only in `countries/<ISO3>/`.

- **Audience:** developers who own a country's data.
- **Before you start:** read sections 2–3 of the [architecture](architecture.md#2-structure).
- **Worked example:** [`countries/_template/`](../countries/_template/) is a complete fictional country with one provider, a fixture and a test (run by `npm test`). Argentina (`countries/ARG/`) is the real, complete case.

---

## 1. What you own and what you get

**You own** `countries/<ISO3>/`: the country's config, city list, data providers, generated datasets, news outlets and its README.

**You get without writing any code:**

| Feature | Source |
|---|---|
| Map, ranking, reports, compare, exports, sources view, methodology | core |
| Climate normals, comfort, rain, snow, sunshine, extremes, UV | Open-Meteo (live) |
| Air quality, river flood watch, elevation | Open-Meteo (live) |
| Earthquakes M5+ since 1980 | USGS (live) |
| Region boundaries and major cities | Natural Earth (`npm run geo`) |
| Crime news per place | Google News, once `news.js` has the language and edition |

So a country with only a config already gets a working map with **Natural risks** and **Environment** scores. Your job is to add the categories that need local data (**Safety, Services, Infrastructure, Economy**) from the best sources available.

## 2. Tiers

`npm run country:check -- XXX` reports which tier your country reaches. Use them to plan your work.

| Tier | Name | Requirements |
|---|---|---|
| 0 | **Environment** | Config + geo. Live global data only. *(All non-Argentine countries today.)* |
| 1 | **News** | `news.js` with language, edition and ambiguous names. Verified outlets for at least a third of the regions, or `outletsNote` saying why there are none. |
| 2 | **Curated** | At least one dataset for each of Safety, Services and Economy, with ≥ 90 % of regions covered. Each dataset has a prefill and a passing test. |
| 3 | **Local** | A curated city list with `codes`. Official crime statistics at subregion or city level for ≥ 75 % of listed cities. Trend `series` for at least 5 years. *(Argentina reaches this.)* |

## 3. Choosing sources

The quality of MapStats depends on this step more than any other. For each indicator you want to fill, list the candidate sources and then choose.

**Preferred order** (this is also roughly how the reliability weights treat them):

1. Official registers and statistics offices: police or ministry crime registers, census, health registries, regulators (telecoms, energy, water).
2. Official sample surveys with published methodology (labour force, household surveys).
3. International harmonised datasets at subnational level (Global Data Lab, Eurostat NUTS, World Bank subnational).
4. Measurements and reanalysis. These are mostly covered already by global providers.
5. Crowd-sourced surveys. Read their terms first: many, Numbeo included, forbid collecting or republishing their data without consent. MapStats only links to Numbeo for that reason.
6. Estimates and hand-entered figures. Use these only to fill a gap, and mark them `kind: 'manual'` or `'estimate'`.

**Checklist for every source.** Record the answers in the provider's `README.md`.

- [ ] **Licence** allows showing the values on a public website and publishing derived figures, with attribution. Record the exact licence or terms URL. If it doesn't, link to the source instead of using its data.
- [ ] **Definition** matches the indicator's `definition` in the core catalogue. If it differs (for example incidents instead of victims, or a different age band), say how. If it is not comparable, don't use it for that indicator: propose a new one instead.
- [ ] **Geography:** the finest level published (city > subregion > region). Finer is better, because the core weighs closeness.
- [ ] **Period:** latest year available and how far back it goes. ≥ 5 years enables trend charts.
- [ ] **Access:** a bulk file download (CSV/XLSX/API) beats scraping HTML. Note whether the URL is stable from year to year.
- [ ] **Methodology** is published. Link it.
- [ ] **Cadence:** when the next release is expected. This feeds `prefill:due`.
- [ ] **Robots and terms** allow automated download. If they don't, download by hand into the provider's `raw/` folder and register the file with `rawStore(…).add(name, { note })`.

When two sources cover the same indicator, **add both** as separate providers. The app shows them side by side, takes the median or the reliability-weighted mean, and shows users where the sources disagree. Don't pre-average them in a prefill.

## 4. Step by step

### 4.1 Start the folder

```bash
npm run country:new -- CHL --iso2 CL --name "Chile" --region-label Region --lang es
NE_DIR=/path/to/natural-earth npm run geo -- CHL     # boundaries and cities → countries/CHL/geo/
npm run dev                                          # Chile appears in the picker at Tier 0
```

`country:new` writes `country.config.js`, `news.js` and `README.md` and registers the country in `countries/index.js`. [`countries/_template/`](../countries/_template/) is the worked example to copy from: a fictional country with one provider, its fixture, test, dataset and city list.

### 4.2 Config: `country.config.js`

```js
import { defineCountry } from '#core/define.js'
import cead from './providers/cead/provider.js'
import news from './news.js'

export default defineCountry({
  iso3: 'CHL', iso2: 'CL', name: 'Chile',
  regionLabel: 'Region', subregionLabel: 'Commune',
  bounds: [-76, -56, -66, -17],                 // only when islands or territories zoom the map out too far
  geo: { simplify: '8%', minCityPop: 100_000, maxCities: 120 },
  providers: [cead],                            // your provider definitions, plus opt-in global ids such as 'numbeo' (links only)
  news,
  maintainers: ['@your-handle'],
})
```

Live global data (Open-Meteo, USGS, Natural Earth, news) is always on, without listing it. Your providers become `CHL/<id>`. Open the app and check that every region has a name and that the map frames the country.

### 4.3 Places: `places.js` (optional, needed for Tier 3)

Without a place list, the app uses the Natural Earth city list (cities ≥ 100k). Add your own when important towns are missing, or when your providers publish data per subregion or city and you need a crosswalk from their codes to our ids.

```js
export const REGION_CODES = { '13': 'CL-RM', '05': 'CL-VS' }   // provider's region code → ISO 3166-2 id in geo/regions.json
export const CITIES = [
  { id: 'CHL-santiago', name: 'Santiago', region: 'CL-RM', lat: -33.45, lon: -70.67, pop: 6_300_000, capital: true,
    codes: { subregion: '13101' } },   // subregion: links the city to second-level values of any dataset
]
```

City ids are `ISO3-slug` and **never change** once published: saved comparisons and links depend on them.

Link cities to subregions with the SDK, not by typing codes: `featureAt(lat, lon, subregionBoundaries)` from `#sdk`, run once during preparation with a subregion boundary file. That is how Argentina's department codes in `countries/ARG/places.js` were built.

### 4.4 A provider

One folder per source: `countries/CHL/providers/<id>/`. Copy [`_template/providers/example-stats/`](../countries/_template/providers/example-stats/).

| File | Purpose | Runs in |
|---|---|---|
| `provider.js` | `defineProvider`: what it is and how to present it (fields below) | browser + Node |
| `prefill.mjs` | `prefill({ country, args, log })`: acquire → parse → map → return the dataset's parts | Node |
| `parse.mjs` *(optional)* | Pure parsing rules, when the prefill gets long (Argentina's SNIC has one) | Node |
| `fixtures/` | A small, real excerpt of the source file (a few rows, including a messy one) | tests |
| `provider.test.mjs` | Offline test of the parsing and mapping rules against the fixtures | Node |
| `raw/` | Downloaded source files (git ignores them) and `manifest.json` with each file's URL, date and SHA-256 (committed) | — |
| `README.md` | The source checklist answers, how to download, known quirks | — |

`provider.js`:

```js
export default defineProvider({
  id: 'cead', short: 'CEAD', name: 'CEAD – Subsecretaría de Prevención del Delito', url: 'https://…',
  covers: 'Crimes reported to the police, by region and commune',
  kind: 'register',                                            // base reliability: register, official-survey, manual…
  family: { id: 'cead', label: 'CEAD · official crime statistics', short: 'CEAD' },   // source-selector group
  levels: ['region', 'subregion'],
  provides: ['homicide', 'propertyCrime'],
  access: 'import', cadence: 'Yearly, published each March', refresh: 'year', scope: 'Chile · region & commune',
  types: ['crime'],
})
```

Optional fields present your data without writing UI (examples in `countries/ARG/providers/snic/provider.js`; `links` in `src/providers/numbeo/provider.js`):

| Field | Gives you |
|---|---|
| `report.trends` + `series` in the dataset | trend charts and a latest-rates table in the report, compare line charts |
| `provenance(ctx)` | your group in "values by source" (report, CSV, PDF) |
| `weightFactors(ctx)` | extra reliability factors from your details (sample size, recency…) |
| `links` | links to the source's own pages about a place |

`prefill.mjs` (full version in the [template](../countries/_template/providers/example-stats/prefill.mjs)):

```js
import { rawStore, parseCsv, num } from '#sdk'
import { REGION_CODES } from '../../places.js'

/** Pure: text → values. The test calls this with fixtures. */
export function toValues(csvText, { regionCodes = REGION_CODES } = {}) {
  // → { values: { region: { 'CL-RM': { homicide: 3.1 } } }, unmatched: ['99'] }
}

export async function prefill({ args, log }) {
  const year = +(args.year || new Date().getFullYear() - 1)
  const raw = rawStore('CHL', 'cead')
  const file = await raw.fetchOnce(urlFor(year), { name: `regions-${year}.csv` })   // downloads once, then reuses it
  const { values, unmatched } = toValues(file.text)
  if (unmatched.length) log(`No region for codes ${unmatched.join(', ')}`)
  return { period: { latest: year }, origin: { files: [file.ref] }, values }
}
```

The CLI completes the header (`schema`, `provider`, `country`, `generatedAt`), checks the dataset against the catalogue, your providers, regions and places, and writes `data/<id>.json` only when there are no errors:

```bash
npm run prefill -- CHL --provider cead --year 2025
npm run prefill -- CHL --provider cead --out /tmp/cead.json    # write elsewhere, e.g. to compare
```

Then load the dataset in `country.data.js` (the browser entry, its own chunk):

```js
import { CITIES } from './places.js'
import cead from './data/cead.json' with { type: 'json' }
export default { places: CITIES, datasets: [cead] }
```

### 4.5 Test and check

```bash
npm test                          # every offline suite, including your provider.test.mjs
npm run country:check -- CHL      # what reviewers look at
```

`country:check` for Argentina today (abridged):

```
ARG · Argentina
  config................ Province / Department · 30 providers · maintainers @codealchemist
  geo................... 24 regions · 74 curated places (places.js)
  ARG/snic.............. 2025 · national 1 · region 24 · subregion 533 · city 1 · series 2016–2025
     homicide            24/24 regions  range 0–14.16        scored [1.312, 6.062]  · 167 beyond
  test.................. providers/snic/provider.test.mjs passed

  Tier 3 · Local
```

**Score ranges.** `scored [a, b]` is the range that maps to 0–100 (the 2nd and 98th percentile of region values across all countries, `src/data/anchors.json`). Values *beyond* it are expected: here, departments outside the regions' range; they score 0 or 100 on that indicator. When you add or update a dataset, run `npm run anchors` and commit the file: `npm test` fails until you do, and your PR should say that scores move. A ⚠ appears only where an indicator still uses a hand-set `domain` that clips values. Never change data to fit a range.

### 4.6 News: `news.js`

1. Set `lang`, `countryName` (as local press writes it), and `edition` (the `hl`/`gl` pair Google News uses for the country. Check that `https://news.google.com/?hl=…&gl=…&ceid=…` doesn't redirect).
2. Add `ambiguousNames` (place names shared by several regions, or that are also common words), `regions` (folded region names, for coverage reports) and `regionPrefixes` if geocoding writes them ("provincia de ").
3. List local outlets in `outlets.candidates`, run `npm run news:probe -- --country=CHL --outlets-only`, and move the ones it verifies into `outlets.verified` with the feed it found. Prefer police or crime section feeds. If the country has no usable outlet feeds, set `outletsNote` saying why.

### 4.7 README and pull request

Fill in `countries/CHL/README.md`: tier, sources table, coverage, known gaps, next releases. Then open a PR that touches only `countries/CHL/` (and `countries/index.js` if new).

**PR checklist**

- [ ] `npm run lint`, `npm test` and `npm run country:check -- CHL` pass (after `npm run anchors` if datasets changed)
- [ ] Every new provider has a README with the source checklist, a fixture and a test
- [ ] `providers/*/raw/manifest.json` committed; raw files not committed (git ignores them)
- [ ] No values invented, carried over from a neighbouring area, or averaged across sources inside a dataset
- [ ] Screenshots: the map on one Safety/Services/Economy indicator, one report
- [ ] The country README is updated

## 5. Recipes

**Region-level CSV from a statistics office.** Use the [template provider](../countries/_template/providers/example-stats/) as it is. Map the office's region codes with `REGION_CODES`. Names are less stable than codes.

**Excel workbooks.** `readXlsx(path, { sheet })` streams the rows of one worksheet as objects (first row = header), so 100 MB files are fine (Argentina's SNIC departmental base is one). If the header is not the first row or spans merged cells, map the columns yourself in `parse.mjs`. Put a real excerpt in `fixtures/` as CSV and test the parsing with `parseCsv`.

**Counts instead of rates.** Convert with `stats.per100k(count, population)`, using the population the publisher used in the same release. If the publisher doesn't give one, say which population you used in the README. Prefer published rates when they exist. That is SNIC's rule: rates are used exactly as published.

**Small areas with noisy rates.** Publish the multi-year mean (`stats.meanOfLast(series, 3)`) as the value and the yearly values as `series`. Indicators whose `definition` says "mean of 3 years" expect this.

**Subregion data, region-level map.** Put both levels in the dataset (`values.region` and `values.subregion`). The core uses subregion values for cities linked by `codes.subregion`, and region values for the rest, labelled as borrowed.

**Time series.** Add `series.years` and `series.<level>.<id>.<indicator>` arrays aligned with it, with `null` for missing years. The Trends section and compare charts appear automatically.

**HTML tables (no download available).** Use `loadHtml` from `#sdk`, and fetch only through `rawStore().fetchOnce`. It honours robots.txt, keeps a polite delay and never fetches a page twice. Check the site's terms first. If they forbid it, copy the figures by hand into a CSV in the provider's `raw/` folder, register it with `rawStore(…).add`, use `kind: 'manual'`, and cite the publication.

**A live source.** Rare. It must be free, keyless and CORS-enabled, and fit the shared request queue. Talk to the core team first: a live provider runs in every visitor's browser.

## 6. Rules

- **Never invent, interpolate or borrow inside a dataset.** Missing is `null`. The core handles fallbacks and labels them.
- **Never redefine a core indicator.** If your source measures something different, propose a new indicator, or add it as descriptive (`better: null`) in your config.
- **Never import from another country's folder or from `src/` internals.** Use `#core/define.js` and `#sdk`. If you need something that isn't there, open an issue: it probably belongs in the SDK for everyone.
- **No secrets or API keys in the browser.** A source that needs a key is a prefill (key in your local environment) or a core-reviewed function.
- **Ids are permanent:** region ids (ISO 3166-2), city ids, provider ids.
- **Commit the generated datasets and the raw manifests.** Don't commit the raw files.

## 7. FAQ

**The Natural Earth regions don't match how my country publishes statistics** (merged or split regions, an old division). Keep the Natural Earth ids for the map. In the prefill, aggregate or split with documented weights (for example population). If that isn't sound, raise it with the core team: the fix may be a different boundary source for that country in `npm run geo`.

**My best crime source is per police district, not per administrative area.** Use `subregion` with the district codes, and link cities with `codes.subregion` using the SDK's point-in-polygon helper and the district boundaries. Explain this in the provider README.

**The data release moved to a new URL.** Update `urlFor` in the prefill, run it, and commit the new dataset and manifest. Add the old and new URLs to the provider README so the next person can find them.

**Scores in my country look wrong.** Run `country:check` to see each indicator's range and score range, then open the place's report: *values by source* shows every input, its level and its weight.
