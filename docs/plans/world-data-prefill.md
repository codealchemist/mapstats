# Plan: shared world-data cache, prefilled by admins

**Status:** proposal, not started. To be built after PR #1 (Open-Meteo rate limits) is merged, since it builds on that PR's request queue and `batch()` loader.

## Problem

Every visitor's browser downloads the live climate data for a country from Open-Meteo, using its own IP's quota (600 calls/min, 5,000/hour, 10,000/day), and caches it only in its own `localStorage`. Nothing is shared between visitors:

- An uncached Argentina load costs about **1,770 calls** (climate ≈ 1,240, UV ≈ 250, river flow ≈ 210, air quality ≈ 74), and each city report another ≈ 140.
- Climate and UV are about 85% of that, yet they describe a past year and never change.
- Paced to the minute limit (PR #1), a large country takes about 3 minutes to fill on a first visit.

Letting any visitor upload results to a shared cache was rejected: Open-Meteo responses aren't signed, so anyone could plant fake data.

## Proposal

Admins prefill the historical data into a shared cache in Netlify Blobs. Visitors only read it.

- **Visitors:** read the shared cache first, then fetch only what's missing with their own quota, as today. They never write to it.
- **Admins:** use an admin-only page listing what's missing. Each admin claims an item, their browser fetches it with their own quota and uploads it, and the other admins see who is loading what.
- **Refresh:** historical data is refreshed once a year.

## Scope

| Data                                                              | Prefilled? | Why                                                |
| ----------------------------------------------------------------- | ---------- | -------------------------------------------------- |
| Climate, last full year (ERA5: temperature, rain, snow, sunshine) | **Yes**    | Final once the year closes; ~70% of a country load |
| UV, last full year (archived forecasts)                           | **Yes**    | Final once the year closes                         |
| 10-year climate normals per city (reports)                        | **Yes**    | ~130 calls per city report; final for the period   |
| Air quality (30-day average)                                      | No         | Changes daily; ~74 calls per country, cheap        |
| River flow (GloFAS, 30-day forecast)                              | No         | Changes every 12 h                                 |
| Places found through search (outside the city list)               | No         | Not on the known place list; visitors fetch them   |

## Cost of a full fill

Measured with the app's own place lists (cities plus the gap-filling grid) and Open-Meteo's billing rule. That rule was verified against their server source: per location, `max(1, variables/10 × max(1, days/14))`.

| Country   |    Places |  Cities | Map layers (climate + UV) | Report normals (all cities) |
| --------- | --------: | ------: | ------------------------: | --------------------------: |
| ARG       |        95 |      74 |                     1,486 |                       9,652 |
| BOL       |        25 |       9 |                       391 |                       1,174 |
| BRA       |       230 |     120 |                     3,598 |                      15,651 |
| CHL       |        30 |      24 |                       469 |                       3,130 |
| COL       |        54 |      34 |                       845 |                       4,435 |
| ECU       |        27 |      13 |                       422 |                       1,696 |
| FRA       |       103 |      40 |                     1,611 |                       5,217 |
| DEU       |        49 |      49 |                       767 |                       6,391 |
| ITA       |       110 |      40 |                     1,721 |                       5,217 |
| MEX       |        92 |      83 |                     1,439 |                      10,826 |
| PRY       |        18 |       5 |                       282 |                         652 |
| PER       |        34 |      22 |                       532 |                       2,869 |
| PRT       |        20 |       6 |                       313 |                         783 |
| ESP       |        57 |      41 |                       892 |                       5,348 |
| USA       |       231 |     120 |                     3,614 |                      15,651 |
| URY       |        19 |       4 |                       297 |                         522 |
| **Total** | **1,194** | **684** |               **~18,700** |                 **~89,200** |

At 10,000 calls a day per IP: map layers take ~2 admin-days and report normals ~9, so ~11 admin-days per year. See _Filling with 1, 2 or 3 admins_ below.

## Storage size and the Netlify free plan

Measured with the app's own storage format (the summaries `src/lib/live.js` already keeps per place, not raw daily series):

| What                                                                  | Size                                               |
| --------------------------------------------------------------------- | -------------------------------------------------- |
| One place's climate summary / UV summary                              | 157 B / 45 B                                       |
| One city's 10-year report normals                                     | ~1.7 KB                                            |
| **One full year, all 16 countries** (1,194 places + 684 city normals) | **~1.35 MB** (236 KB map layers + 1.15 MB normals) |
| 10 years kept                                                         | ~13.5 MB                                           |
| Largest single blob (`data/climate/{year}/USA`, 231 places)           | ~35 KB (Netlify's per-object limit is 5 GB)        |

**Storage is not a constraint.** Netlify doesn't publish a separate per-GB price for Blobs; storage draws from the account's monthly credit pool (300 credits on the free plan), and a few MB should be negligible. Check the real figure on Netlify's usage page after the first fill.

What actually uses the free plan's 300 monthly credits (rates since April 2026):

| Usage             | Rate                 | Impact                                                                                                                                                                                                                       |
| ----------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production deploy | 15 credits each      | **Main constraint:** 20 production deploys use the whole month. Iterate with `npm run deploy:preview`.                                                                                                                       |
| Bandwidth         | 20 credits / GB      | ~0.75 MB of app code per first visit, so ~20,000 first visits per month if all credits went to bandwidth. Shared-cache reads are tiny (see below). Map tiles and Open-Meteo calls go directly from browsers and don't count. |
| Web requests      | 2 credits / 10,000   | Negligible                                                                                                                                                                                                                   |
| Function compute  | 10 credits / GB-hour | Negligible: read and upload calls are milliseconds                                                                                                                                                                           |

### Bandwidth of shared-cache reads

What a visitor downloads from the shared cache, measured gzip-compressed as Netlify serves it:

| Read                                                | Uncompressed | Compressed |
| --------------------------------------------------- | ------------ | ---------- |
| Argentina: climate + UV (95 places)                 | 19 KB        | ~3.5 KB    |
| USA, the largest country: climate + UV (231 places) | 47 KB        | ~8 KB      |
| One city report's normals                           | 1.6 KB       | ~0.3 KB    |
| _For comparison:_ app code on a first visit         | —            | ~750 KB    |

The measurement used synthetic values, which may compress slightly better than real ones, so budget up to ~10–12 KB per country load.

- **Per GB (20 credits):** ~87,000 country loads from the cache, against ~1,400 first visits' worth of app code. Cache reads add only ~1–2% to a first visit's bandwidth; app code dominates.
- **Repeat visits:** download nothing from the cache, because the browser's `localStorage` cache (30 days for climate and UV) answers first.
- **Web requests:** 2 per country load (climate + UV), so 10,000 country loads ≈ 4 credits.
- **Function compute:** milliseconds per uncached read. With CDN caching, most reads never invoke the function; CDN responses still count as bandwidth (the small figure above).
- **Blob operations inside the function:** not priced separately; they draw from the same credit pool and are tiny at these sizes. Netlify doesn't document whether a blob read costs anything beyond the function call; confirm on the usage page after the first fill.
- **Admin uploads:** ~1.35 MB per year in total.

The free plan's limits are **hard**: when credits run out, the site stops being served until the next month. Watch the usage page after launch; the paid Personal plan (1,000 credits) is the next step if bandwidth grows.

Sources: [Netlify pricing](https://www.netlify.com/pricing/), [credit-based plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/), [Blobs pricing and limits (support forum)](https://answers.netlify.com/t/blobs-pricing-and-limits/119907).

## Filling with 1, 2 or 3 admins

Each admin loads with their own browser and IP, within Open-Meteo's free limits per IP: 600 calls/minute (the app's queue keeps to ~540), 5,000/hour and 10,000/day.

- **What one admin-day looks like:** at ~540 calls a minute, the hourly limit is reached after ~10 minutes of loading. So 10,000 calls is about **20 minutes of loading spread over two clock hours**. For example, load ~10 minutes, then resume the next hour; the queue stops by itself at each limit and the admin page resumes from the last uploaded chunk.
- **Fill time per year** (≈ 18,700 calls of map layers + ≈ 89,200 of report normals):

| Admins | Map layers (climate + UV) | Report normals (all cities) | Full yearly fill |
| -----: | ------------------------- | --------------------------- | ---------------- |
|      1 | 2 days                    | 9 days                      | **~11 days**     |
|      2 | 1 day                     | 5 days                      | **~6 days**      |
|      3 | 1 day                     | 3 days                      | **~4 days**      |

- **Map layers first:** visitors benefit most from them, and they're done in 1–2 days with any number of admins. Report normals can follow over the next days, most-viewed countries first, using demand ranking (phase 4).
- **Large items span days:** some countries exceed one admin's daily budget (e.g. USA or Brazil normals, ~15,700 calls each). Uploads are per chunk, so the item simply resumes the next day, by the same or another admin.

**Why this reduces load on Open-Meteo.** Today every visitor's browser fetches the same historical data again:

- **Map layers:** ~1,500 calls per country per first visit.
- **Reports:** ~130 calls per city report.

With the shared cache, each place is fetched **once a year** in total, and visitors only fetch the small live layers (air quality and river flow, ~300 calls per country). The yearly map-layer fill (~18,700 calls) costs about as much as a dozen first visits do today, and everything after that is calls Open-Meteo no longer serves. Open-Meteo's data is CC BY 4.0, so serving it from our cache is fine with attribution; MapStats already credits them in the Data sources view.

## Design

### Storage (Netlify Blobs, store `meteo`)

| Key                            | Content                                                                                                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/{layer}/{year}/{iso3}`   | `{ layer, year, iso3, updatedAt, points: { "lat,lon": value } }`. `layer` is `climate`, `uv` or `normals` (`year` = last year of the 10-year period). Coordinates are rounded to 3 decimals, as in today's requests. Values have the same shape the browser already stores. |
| `claims/{layer}/{year}/{iso3}` | `{ admin, startedAt, leaseUntil, filled, expected }`                                                                                                                                                                                                                        |
| `demand/{layer}/{year}/{iso3}` | Count of visitor reads that found missing places (optional; used to rank the admin list)                                                                                                                                                                                    |

- **Per place, not per chunk:** today's browser cache keys whole chunks of places. Per-place entries let any chunk, country or report reuse them.
- **Merging:** writes use Blobs' conditional writes. Read the current `etag`, merge the new places, write with `onlyIfMatch`, and retry on conflict, so two uploads never overwrite each other. Claims use `onlyIfNew` or `onlyIfMatch` in the same way.
- **Size:** one country and layer is ≤ ~230 places × ≤ 1 KB, well within free-plan limits.

### Expected place list (server side)

The function computes each country's expected places the same way the client does: `livePoints()` + `gapGrid()` over the bundled `public/geo/{iso3}.json` and `-cities.json` (for normals, cities only). This is shared code, not a copy, so client and server can't drift.

This list defines what counts as "missing" and which coordinates an upload may contain.

### Endpoints (Netlify Functions)

| Method & path                          | Access | Purpose                                                                                                                                                                                                                                           |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/meteo/{layer}/{year}/{iso3}` | Public | The shared cache for one country and layer. Closed years are CDN-cached (`Netlify-CDN-Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`), so most visitors never invoke the function. Records demand when places are missing. |
| `GET /api/admin/meteo/items?year=`     | Admin  | The work list: country × layer, with expected/filled counts, claim (who, until when) and estimated cost in calls. Sorted by demand, then size.                                                                                                    |
| `POST /api/admin/meteo/claim`          | Admin  | Claims an item for 15 minutes. Fails if someone else holds a live lease.                                                                                                                                                                          |
| `PUT /api/admin/meteo/claim`           | Admin  | Renews the lease (sent every ~60 s while loading).                                                                                                                                                                                                |
| `DELETE /api/admin/meteo/claim`        | Admin  | Releases the claim (stop / done).                                                                                                                                                                                                                 |
| `POST /api/admin/meteo/upload`         | Admin  | Uploads one chunk `{ layer, year, iso3, points }`. Validated (below), then merged. Only the claim holder may upload.                                                                                                                              |

### Admin authentication

- **Tokens:** each admin gets a personal random token. The site stores `ADMIN_TOKENS` as a Netlify environment variable, e.g. `{"maria": "<sha256 of token>", …}`.
- **Requests:** requests send `Authorization: Bearer <token>`. The function hashes it, compares in constant time, and records the admin's name for claims and logs.
- **Revoking:** remove the entry and redeploy. Works on the free plan with no extra service.
- **Rate limiting:** per token, as defence in depth.

### Upload validation (even for admins)

Validation protects against bugs and stolen tokens:

- **Places:** coordinates must be on the expected list for that country and layer; anything else is rejected.
- **Shape:** must exactly match the layer's value format; no extra fields; size capped.
- **Plausible ranges:** e.g. temperatures −90…60 °C, annual precipitation 0…15,000 mm, snowfall 0…5,000 cm, sunshine 0…4,500 h, UV 0…20, elevation −500…9,000 m.
- **Year:** must be a closed year (≤ current year − 1), and the claim holder must match the token.

### Visitor flow (changes to `src/lib/live.js`)

1. For `climate` and `uv`, `batch()` first calls `GET /api/meteo/{layer}/{year}/{iso3}`, takes every cached place, and sends only the missing ones through the existing queue. Progress counts start at the cached number (e.g. "Climate 95/95" instantly).
2. If the current year isn't in the cache yet (January), fall back to the previous year, labelled in the UI ("2024 data, 2025 not yet available"), before fetching anything.
3. City reports ask the shared cache for that city's normals first (`normals` layer, one place) and fetch the 10-year series only if it's missing.
4. The browser's `localStorage` cache stays as the first layer. The shared cache is the second; Open-Meteo is the last resort.
5. If the shared cache endpoint fails or times out (~3 s), the browser fetches everything itself, as today.

### Admin page

- **Packaging:** a separate Vite entry (`/admin`, lazily loaded), not part of the public bundle. The admin enters their token once (kept in `sessionStorage`).
- **Work list:** one row per country × layer for the selected year:
  - progress bar (filled/expected) and estimated remaining calls
  - status: missing / in progress by _name_ (with lease countdown) / complete
  - **Start** (claims, then fills) and **Stop**

  It refreshes every ~5 s so admins see each other's progress.

- **Loading:** reuses the app's request queue and `batch()` loaders, so pacing and retry behave as in the app. Each chunk is uploaded as soon as it arrives, so stopping, closing the tab or hitting a limit loses nothing. The next admin resumes from the uploaded places.
- **Usage meter:** this browser's estimated Open-Meteo use for the last minute/hour/day against the free limits. Loading stops by itself on an hourly or daily limit.
- **Year selector:** defaults to the last closed year; previous years stay readable.

### Annual refresh

- **Timing:** on January 1 the last full year changes, so every item for the new year appears as missing. ERA5 is published with a ~5-day delay; the admin page only offers a new year from **January 10**.
- **During the fill:** visitors get the previous year (see the fallback above) until each country completes.
- **Old years:** kept; they're small, and the year selector can show them.

## Phases

1. **Read path + prefill script.** Read endpoint, the expected place list, and visitor read-before-fetch with the previous-year fallback. Plus `npm run meteo:prefill -- ARG` with one admin token. This alone covers map layers for all countries in ~2 admin-days. _(~1 day)_
2. **Admin page with claims.** Work list, leases, live progress and usage meter. _(~1 day)_
3. **Report normals.** `normals` layer, the per-city read in reports, filled from the admin page. _(~0.5 day)_
4. **Demand ranking (optional).** Count visitor misses; sort the work list by them. _(~0.25 day)_

## Testing

- **Offline function tests** (the pattern of `netlify/news/test/`):
  - token check
  - validation (coordinates off the list, out-of-range values, extra fields, open year)
  - claim races, using conditional writes against an in-memory Blobs mock that supports etags
  - lease expiry and renewal
  - merge conflicts
- **Client tests** (the pattern of `src/lib/test/live.mjs`):
  - cached places skipped
  - only missing places requested
  - previous-year fallback
  - shared cache down → full fetch
- **Manual** with `netlify dev`: two browsers with two admin tokens claiming different items, then the same one.

## Open questions

1. How many admins (1, 2 or 3) take part in the yearly fill, and on which days in January?
2. Who are the admins, and how are tokens handed out and rotated?
3. Should the admin page also prefill air quality and river flow for a daily snapshot? (Not planned: cheap for visitors, and stale quickly.)
