# Country integration guide

How to add a country to MapStats, or improve one, by working only in `countries/<ISO3>/`.

- **Audience:** developers who own a country's data.
- **Before you start:** read sections 3–4 of the [architecture](architecture.md#3-structure). This guide assumes the target structure. Commands marked *(step N)* become available at that step of the [migration plan](architecture.md#8-migration-plan).
- **Worked sample:** [`docs/samples/country-template/`](samples/country-template/) is a complete country folder with one provider, a fixture and a test. `npm run country:new` copies it.

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
| Region boundaries and major cities | Natural Earth (`geo:build`) |
| Crime news per place | Google News, once `news.js` has the language and edition |

So a country with only a config already gets a working map with **Natural risks** and **Environment** scores. Your job is to add the categories that need local data (**Safety, Services, Infrastructure, Economy**) from the best sources available.

## 2. Tiers

`npm run country:check -- XXX` reports which tier your country reaches. Use them to plan your work.

| Tier | Name | Requirements |
|---|---|---|
| 0 | **Environment** | Config + geo. Live global data only. *(All non-Argentine countries today.)* |
| 1 | **News** | `news.js` with language, edition and ambiguous names. At least one verified outlet per 3 regions, or a note on why none exist. |
| 2 | **Curated** | At least one dataset for each of Safety, Services and Economy, with ≥ 90 % of regions covered. Each dataset has a prefill and a passing test. |
| 3 | **Local** | A curated city list with `codes`. Official crime statistics at subregion or city level for ≥ 75 % of listed cities. Trend `series` for at least 5 years. *(Argentina reaches this.)* |

## 3. Choosing sources

The quality of MapStats depends on this step more than any other. For each indicator you want to fill, list the candidate sources and then choose.

**Preferred order** (this is also roughly how the reliability weights treat them):

1. Official registers and statistics offices: police or ministry crime registers, census, health registries, regulators (telecoms, energy, water).
2. Official sample surveys with published methodology (labour force, household surveys).
3. International harmonised datasets at subnational level (Global Data Lab, Eurostat NUTS, World Bank subnational).
4. Measurements and reanalysis. These are mostly covered already by global providers.
5. Crowd-sourced surveys (Numbeo-style).
6. Estimates and hand-entered figures. Use these only to fill a gap, and mark them `kind: 'manual'` or `'estimate'`.

**Checklist for every source.** Record the answers in the provider's `README.md`.

- [ ] **Licence** allows publishing derived figures with attribution. Record the exact licence or terms URL.
- [ ] **Definition** matches the indicator's `definition` in the core catalogue. If it differs (for example incidents instead of victims, or a different age band), say how. If it is not comparable, don't use it for that indicator: propose a new one instead.
- [ ] **Geography:** the finest level published (city > subregion > region). Finer is better, because the core weighs closeness.
- [ ] **Period:** latest year available and how far back it goes. ≥ 5 years enables trend charts.
- [ ] **Access:** a bulk file download (CSV/XLSX/API) beats scraping HTML. Note whether the URL is stable from year to year.
- [ ] **Methodology** is published. Link it.
- [ ] **Cadence:** when the next release is expected. This feeds `prefill:due`.
- [ ] **Robots and terms** allow automated download. If they don't, download by hand into `data/raw/` and record it in the manifest.

When two sources cover the same indicator, **add both** as separate providers. The app shows them side by side, takes the median or the reliability-weighted mean, and shows users where the sources disagree. Don't pre-average them in a prefill.

## 4. Step by step

### 4.1 Scaffold *(step 6)*

```bash
npm run country:new -- CHL          # copies countries/_template, fills codes and names, registers it
npm run geo:build -- CHL            # Natural Earth → countries/CHL/geo/ (needs NE_DIR, see README)
npm run dev                          # the country appears in the picker at Tier 0
```

### 4.2 Config: `country.config.js`

```js
export default defineCountry({
  iso3: 'CHL', iso2: 'CL', name: 'Chile',
  regionLabel: 'Region', subregionLabel: 'Commune',
  bounds: [-76, -56, -66, -17],                       // only when islands or territories zoom the map out too far
  geo: { simplify: '8%', minCityPop: 100_000, maxCities: 120 },
  providers: ['open-meteo', 'usgs', 'CHL/cead'],      // global ids + your own (namespaced automatically)
  news,
  maintainers: ['@your-handle'],
})
```

Open the app and check that every region has a name and that the map frames the country.

### 4.3 Places: `places.js` (optional, needed for Tier 3)

Without this file, the app uses the Natural Earth city list (cities ≥ 100k). Add your own list when:

- important towns are missing,
- or your providers publish data for subregions or cities, and you need a crosswalk from their codes to our ids.

```js
export const REGION_CODES = { '13': 'CL-RM', '05': 'CL-VS' }   // provider's region code → ISO 3166-2 id in geo/regions.json
export const CITIES = [
  { id: 'CHL-santiago', name: 'Santiago', region: 'CL-RM', lat: -33.45, lon: -70.67, pop: 6_300_000, capital: true,
    codes: { subregion: '13101', numbeo: 'Santiago' } },
]
```

City ids are `ISO3-slug` and **never change** once published: saved compare slots and links depend on them.

To link cities to subregions, use the SDK instead of typing codes by hand. For example, `places.pointToSubregion(lat, lon, polygons)` with a subregion boundary file, used once during preparation. That is how Argentina's `SNIC_DEPT` table was built.

### 4.4 A provider

One folder per source: `countries/CHL/providers/<id>/`.

| File | Purpose | Runs in |
|---|---|---|
| `provider.js` | Metadata (`defineProvider`): name, URL, licence, kind, cadence, which indicators at which levels | browser + Node |
| `prefill.mjs` | `prefill(ctx)`: acquire → parse → map → return dataset parts | Node |
| `parse.mjs` *(optional)* | Pure parsing functions, when `prefill.mjs` gets long | Node |
| `fixtures/` | A small, real excerpt of the source file (a few rows, including a messy one) | tests |
| `provider.test.mjs` | Offline test of parsing and mapping against the fixtures | Node |
| `README.md` | The source checklist answers, how to download, known quirks | — |

Shape of a prefill (full version in the [template](samples/country-template/providers/example-stats/prefill.mjs)):

```js
import { rawStore, parseCsv } from '#sdk'
import provider from './provider.js'
import { REGION_CODES } from '../../places.js'

export function toValues(csvText, { regionCodes = REGION_CODES } = {}) {
  // pure: text → { values: { region: { 'CL-RM': { homicide: 3.1 } } }, unmatched: [] }
}

export async function prefill({ year, log }) {
  const raw = rawStore('CHL', provider.id)
  const file = await raw.fetchOnce(urlFor(year), { name: `regions-${year}.csv` })
  const { values, unmatched } = toValues(file.text)
  if (unmatched.length) log.warn(`Unmatched region codes: ${unmatched.join(', ')}`)
  return { period: { latest: year }, origin: { files: [file.ref] }, values }
}
```

The CLI adds the header (`provider`, `country`, `generatedAt`, `schema`), validates and writes `data/<id>.json`:

```bash
npm run prefill -- CHL --provider cead              # download (once) + build
npm run prefill -- CHL --provider cead --offline    # rebuild from data/raw only
```

Then load the dataset in `country.data.js`:

```js
import cead from './data/cead.json'
export default { places, datasets: [cead] }
```

### 4.5 Test and check

```bash
npm test                          # every offline test, including your provider.test.mjs
npm run country:check -- CHL      # ids, schema, domains, coverage, tier
```

`country:check` output is what reviewers look at. For example:

```
CHL · Tier 2 (Curated)
  config ............. ok
  geo ................ 16 regions · 38 cities
  CHL/cead ........... 2025 · region 16/16 · subregion 312/346
     homicide ........ 16/16 regions   range 1.2–7.9   domain [0, 8] ok
  CHL/casen .......... 2024 · region 16/16
     poverty ......... 16/16 regions   range 2.1–19.4  domain [15, 60] ⚠ 9 values below domain (scores saturate)
  missing for Tier 3: city codes for 30/38 cities
```

A **domain warning** is not an error. It means the global domain may need recalibrating: open an issue for the core team. Don't change your data to fit the domain.

### 4.6 News: `news.js`

1. Set `lang`, `countryName` (as local press writes it), and `edition` (the `hl`/`gl` pair Google News uses for the country. Check that `https://news.google.com/?hl=…&gl=…&ceid=…` doesn't redirect).
2. Add `ambiguousNames`: place names shared by several regions, or that are also common words.
3. List local outlets as `candidates`, run `npm run news:probe -- CHL`, and move the ones it verifies into `verified` with the feed it found. Prefer police or crime section feeds.

### 4.7 README and pull request

Fill in `countries/CHL/README.md`: tier, sources table, coverage, known gaps, next releases. Then open a PR that touches only `countries/CHL/` (and `countries/index.js` if new).

**PR checklist**

- [ ] `npm run lint`, `npm test` and `npm run country:check -- CHL` pass
- [ ] Every new provider has a README with the source checklist, a fixture and a test
- [ ] `data/raw/CHL/*/manifest.json` committed; raw files not committed
- [ ] No values invented, carried over from a neighbouring area, or averaged across sources inside a dataset
- [ ] Screenshots: the map on one Safety/Services/Economy indicator, one report
- [ ] The country README is updated

## 5. Recipes

**Region-level CSV from a statistics office.** Use the [template provider](samples/country-template/providers/example-stats/) as it is. Map the office's region codes with `REGION_CODES`. Names are less stable than codes.

**XLSX with merged headers or several sheets.** Use `readXlsx(path, { sheet, headerRow })`. Put one real sheet excerpt in `fixtures/` (save it as CSV if the workbook is large) and test the header detection.

**Counts instead of rates.** Convert with `stats.per100k(count, population)`, using the population the publisher used in the same release. If the publisher doesn't give one, say which population you used in the README. Prefer published rates when they exist. That is SNIC's rule: rates are used exactly as published.

**Small areas with noisy rates.** Publish the multi-year mean (`stats.meanOfLast(series, 3)`) as the value and the yearly values as `series`. Indicators whose `definition` says "mean of 3 years" expect this.

**Subregion data, region-level map.** Put both levels in the dataset (`values.region` and `values.subregion`). The core uses subregion values for cities linked by `codes.subregion`, and region values for the rest, labelled as borrowed.

**Time series.** Add `series.years` and `series.<level>.<id>.<indicator>` arrays aligned with it, with `null` for missing years. The Trends section and compare charts appear automatically.

**HTML tables (no download available).** Use `loadHtml` from `#sdk`, and fetch only through `rawStore().fetchOnce`. It honours robots.txt, keeps a polite delay and never fetches a page twice. Check the site's terms first. If they forbid it, copy the figures by hand into a CSV in `data/raw/`, use `kind: 'manual'`, and cite the publication.

**A live source.** Rare. It must be free, keyless and CORS-enabled, and fit the shared request queue. Talk to the core team first: a live provider runs in every visitor's browser.

## 6. Rules

- **Never invent, interpolate or borrow inside a dataset.** Missing is `null`. The core handles fallbacks and labels them.
- **Never redefine a core indicator.** If your source measures something different, propose a new indicator, or add it as descriptive (`better: null`) in your config.
- **Never import from another country's folder or from `src/` internals.** Use `#core/define.js`, `#sdk` and `#providers/*`. If you need something that isn't there, open an issue: it probably belongs in the SDK for everyone.
- **No secrets or API keys in the browser.** A source that needs a key is a prefill (key in your local environment) or a core-reviewed function.
- **Ids are permanent:** region ids (ISO 3166-2), city ids, provider ids.
- **Commit the generated datasets and the raw manifests.** Don't commit the raw files.

## 7. FAQ

**The Natural Earth regions don't match how my country publishes statistics** (merged or split regions, an old division). Keep the Natural Earth ids for the map. In the prefill, aggregate or split with documented weights (for example population). If that isn't sound, raise it with the core team: the fix may be a different boundary source for that country in `geo:build`.

**My best crime source is per police district, not per administrative area.** Use `subregion` with the district codes, and link cities with `codes.subregion` using the SDK's point-in-polygon helper and the district boundaries. Explain this in the provider README.

**The data release moved to a new URL.** Update `urlFor` in the prefill, run it, and commit the new dataset and manifest. Add the old and new URLs to the provider README so the next person can find them.

**Scores in my country look wrong.** Run `country:check` for domain warnings, then open the place's report: *values by source* shows every input, its level and its weight.
