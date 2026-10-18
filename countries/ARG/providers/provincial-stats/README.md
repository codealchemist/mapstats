# Argentina · provincial statistics

Province-level figures from official publications, read by a prefill into [`countries/ARG/data/provincial-stats.json`](../../data/provincial-stats.json). Each indicator cites its own provider ([`provider.js`](provider.js)).

| Indicator | Publication | Where to find a new edition | Set in |
|---|---|---|---|
| Water, sewer, internet | INDEC, Censo 2022, definitive results: three household tables per province (72 files) | [censo.gob.ar](https://censo.gob.ar/index.php/datos_definitivos_total_pais/) (only after a new census) | [`census-files.mjs`](census-files.mjs) |
| Poverty | INDEC, EPH poverty report, twice a year (`cuadros_informe_pobreza_MM_YY.xls`) | INDEC · Pobreza e indigencia | `SOURCES.poverty` in [`prefill.mjs`](prefill.mjs) |
| Unemployment | INDEC, EPH "total urbano", 3rd quarter, once a year (`indicadores_eph_total_urbano_3t_YYYY.xls`) | INDEC · Mercado de trabajo | `SOURCES.unemployment` |
| Life expectancy, population | INDEC, provincial projections 2022–2040 | INDEC · Proyecciones (rarely revised) | `SOURCES.life`, `SOURCES.population`, `LIFE_YEAR`, `POP_YEAR` |
| Physicians, HDI | Ministerio de Salud and PAHO, *Indicadores Básicos Argentina*, once a year (a PDF) | [PAHO's repository (IRIS)](https://iris.paho.org): search "Indicadores básicos Argentina" | `SOURCES.health`, `DOCTORS_YEAR` |
| Seismic zone | INPRES zoning map, hand-entered (shown, not scored) | [inpres.gob.ar](https://www.inpres.gob.ar/) | [`hand-entered.json`](hand-entered.json) |

INDEC's files live under `https://www.indec.gob.ar/ftp/cuadros/`; its page addresses change often, so search the topic or the file name on [indec.gob.ar](https://www.indec.gob.ar/).

## Yearly update

1. **Point to the new editions.** In [`prefill.mjs`](prefill.mjs), update each publication's `url` and `year` in `SOURCES` (and `POP_YEAR`, `DOCTORS_YEAR`). For a new *Indicadores Básicos*, open its record on IRIS and copy the PDF's download address (`…/server/api/core/bitstreams/<id>/content`).
2. **Run the prefill** (in the dev container):
   ```sh
   npm run prefill -- ARG --provider provincial-stats
   ```
   It downloads each new file once into `raw/` (gitignored) and records its URL, date and SHA-256 in `raw/manifest.json` (committed). It writes the dataset only if every province has every value.
3. **Census files:** on a fresh checkout `raw/` has none, and the prefill stops at the first one: see below.
4. **Check and commit:**
   ```sh
   npm run anchors                # score ranges follow the data
   npm run golden -- --update     # scores change: say how much in the PR
   npm test && npm run country:check -- ARG
   ```
   Commit `data/provincial-stats.json`, `raw/manifest.json`, `src/data/anchors.json` and the golden snapshots.

## Census files: `censo-download.mjs`

`censo.gob.ar` doesn't send its intermediate certificate. Browsers fetch it on their own, but Node and curl reject the site, so the prefill can't download the census tables. [`censo-download.mjs`](censo-download.mjs) does what browsers do: it fetches the missing certificate from Sectigo and trusts it on top of the usual ones (certificates are still verified).

Run it **on your own machine**, in the same checkout (the dev container's firewall blocks `crt.sectigo.com`). It needs Node 18+ and no `npm install`:

```sh
npm run censo:download                                                # or:
node countries/ARG/providers/provincial-stats/censo-download.mjs        # the 72 tables the prefill reads, into raw/
node countries/ARG/providers/provincial-stats/censo-download.mjs --all  # every spreadsheet the site links
```

- **Default:** downloads the tables listed in [`census-files.mjs`](census-files.mjs) into `raw/`, skipping those already there (`--refresh` downloads them again). Then run the prefill: it registers each file with its URL.
- **`--all`:** reads the definitive-results pages and downloads every spreadsheet they link into `raw/censo-download/` (gitignored, about 2,600 files), with `links.tsv` listing each file's URL, page and link text. Use it to find files that moved or a new census's tables, then update `census-files.mjs`.
- **If it fails with a certificate error,** the site may have changed certificate: `openssl s_client -connect censo.gob.ar:443` shows the new issuer; update `INTERMEDIATE` in the script.

Without the script, download each file listed in `census-files.mjs` with a browser into `raw/`, keeping its name.

## When a table changes shape

The readers in [`parse.mjs`](parse.mjs) find columns by their header text and provinces by name, and fail rather than leave a gap: the error names the table and what's missing. Fix the reader, add the case to [`provider.test.mjs`](provider.test.mjs) and run `npm test`.

- INDEC answers 200 with an error page for files that don't exist; the prefill fails reading them. Check the file name on INDEC's site.
- *Indicadores Básicos* is read from the PDF's text (`pdfTableColumn`): tables are found by their title and numbered columns. Check the column numbers against the new edition's notes (physicians: column 9 of "Indicadores de recursos, acceso y cobertura"; HDI: column 11 of "Indicadores demográficos"). The provincial physician counts must add up to the national total.
