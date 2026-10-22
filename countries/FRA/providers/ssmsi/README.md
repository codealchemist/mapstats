# ssmsi: recorded crime by département (SSMSI, Ministère de l'Intérieur)

| | |
|---|---|
| Publisher | SSMSI – Service statistique ministériel de la sécurité intérieure |
| Page | https://www.data.gouv.fr/fr/datasets/bases-statistiques-communale-departementale-et-regionale-de-la-delinquance-enregistree-par-la-police-et-la-gendarmerie-nationales |
| Licence | Licence Ouverte 2.0 (Etalab) |
| Kind | `register`: counts of facts recorded by the police and gendarmerie nationales |
| Indicators | `homicide`, `propertyCrime` (scored, 3-year averages); 15 other categories shown in reports |
| Levels | département (the commune base exists: not used yet) |
| Period | 2016–2025, yearly; revised each summer with the previous year's definitive figures |
| Next release | July 2027 (2026 figures) |
| Access | CSV download, stable data.gouv.fr resource id; robots.txt allows it |
| Methodology | The metadata note shipped with the dataset (`fichier-metadonnees-*.pdf`) |

## Definitions vs the MapStats catalogue

- `homicide`: victims of homicide, fatal assaults included (SSMSI "Homicides"), per 100,000 inhabitants (INSEE population of the year). Attempted homicides are a separate category and are not counted.
- `propertyCrime`: the catalogue's "robberies + thefts" (Argentina: SNIC's two categories). The SSMSI publishes seven disjoint theft and robbery categories, each with its own counting unit; MapStats adds their counts per département and year over the population. It is the only sum in this import; each category is also shown as published. Burglaries are published per 1,000 dwellings and shown per 100,000 dwellings.
- Rates are used as published (per 1,000 × 100), rounded to 2 decimals. National rates are Σ facts / Σ denominators over the 101 départements of the map (no national row is published).

## Updating

```bash
npm run prefill -- FRA --provider ssmsi            # reads the stored CSV
npm run prefill -- FRA --provider ssmsi --refresh  # downloads the resource again (new edition)
npm run anchors && npm run golden -- --update && npm test && npm run country:check -- FRA
```

The resource id has been stable across editions; if it changes, update `RESOURCE` in [`prefill.mjs`](prefill.mjs). A file downloaded by hand (`donnee-dep*.csv`) into `raw/` is registered on first use.

## Quirks

- The "Usage de stupéfiants" AFD / hors AFD sub-splits are skipped (the total is kept).
- Mayotte's population is frozen at the 2017 census in the source: its rates are used as published.
- A 3-year average needs all three annual rates; otherwise it stays `null`.
