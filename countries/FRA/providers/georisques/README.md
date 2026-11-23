# georisques: seismic zoning and risk records (Géorisques, GASPAR)

| | |
|---|---|
| Publisher | Ministère de la Transition écologique (Géorisques, GASPAR) |
| Pages | [Zonage sismique de la France](https://www.data.gouv.fr/datasets/zonage-sismique-de-la-france-1) · [GASPAR](https://www.data.gouv.fr/datasets/base-nationale-de-gestion-assistee-des-procedures-administratives-relatives-aux-risques-gaspar) · [zoning API](https://www.georisques.gouv.fr/doc-api) |
| Licence | Licence Ouverte (both datasets) |
| Kind | `estimate`: the zoning is regulatory; the flood and forest-fire classes are MapStats estimates built on administrative records |
| Indicators | `seismicZone`, `floodExposure`, `fireExposure` (all descriptive: the Natural risks category scores from the GEM hazard map) |
| Levels | commune (own values for the 40 tracked cities), population-weighted per département |
| Period | zoning in force since 2011 (décrets 2010-1255 and 2015-5); GASPAR export of 2026-10-05, refreshed continuously |
| Next release | Any time (GASPAR); re-run yearly |
| Access | Shapefile zip (only the .dbf attribute table is read), GASPAR zip of CSVs, API (20 communes per call) |

## Definitions vs the MapStats catalogue

- `seismicZone` (0–4): French zones 1 (très faible) to 5 (forte) minus one. A commune's own zone for cities; the population-weighted mean of its communes for a département (the national 2018 table, cross-checked against the API for the tracked communes: 0 mismatches at import). Argentina's value is the INPRES zone.
- `floodExposure` (1–5): the number of distinct flood "catastrophe naturelle" declarations per commune since 2000 (0 → 1, 1–3 → 2, 4–7 → 3, 8–12 → 4, 13+ → 5), at least 3 with an approved flood PPR; population-weighted per département. A record of past declarations, not a measured hazard.
- `fireExposure` (1–5): 1, or 3 when the département risk file (DDRM) lists the commune for forest fire, 4 with a forest-fire PPR prescribed, 5 approved; population-weighted per département.

Population weights: INSEE reference populations of every commune (stored by the INSEE provider).

## Updating

```bash
npm run prefill -- FRA --provider georisques
npm run country:check -- FRA          # nothing scored: anchors and golden snapshots don't move
```

Delete `raw/gaspar.zip` to fetch a fresh GASPAR export. The zoning table has not changed since 2018; `raw/zonage-sismique-communes.json` (the API answer) can be deleted to re-check it.

## Quirks

- GASPAR CSVs have unquoted free-text fields with stray semicolons: columns are read from both ends of each row (`looseCsv`).
- Municipal arrondissements of Paris, Lyon and Marseille are folded into their commune.
- Mayotte has no zoning and no commune in the 2023 reference-population file: its values stay `null`.
