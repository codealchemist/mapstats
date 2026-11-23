# drees: physicians by département (DREES, RPPS)

| | |
|---|---|
| Publisher | DREES – Direction de la recherche, des études, de l'évaluation et des statistiques |
| Page | https://www.data.gouv.fr/fr/datasets/la-demographie-des-professionnels-de-sante-depuis-2012 |
| Licence | Licence Ouverte 2.0 |
| Kind | `register`: physicians registered with the Ordre (RPPS) and active at 1 January |
| Indicators | `doctors` (scored) |
| Levels | département |
| Period | 2012–2026, at 1 January each year |
| Next release | Summer each year |
| Access | One xlsx workbook ("Médecins RPPS 2012-2026", ≈ 70 MB) through a data.gouv.fr resource link; streamed sheet by sheet |
| Methodology | The workbook's "Lisez-moi" sheet and `lisez-moi-drees-demographie-professionnels-de-sante.pdf` |

## Definitions vs the MapStats catalogue

- `doctors`: physicians per 1,000 inhabitants. DREES publishes the density per 100,000 inhabitants over INSEE's population estimate at 1 January of the same year, for physicians of all specialties and modes of practice, counted once at their most recent place of activity (headcounts, not activities); MapStats divides by 100. Argentina counts registered physicians under 65 by province of registration.
- "ND" (fewer than 10 professionals) stays `null`.

## Updating

```bash
npm run prefill -- FRA --provider drees
npm run anchors && npm run golden -- --update && npm test && npm run country:check -- FRA
```

A new edition is a new workbook: update `RESOURCE` (and the stored file name) in [`prefill.mjs`](prefill.mjs). The sheets are found by name ("Densités", "Effectifs"); the yearly columns by their `densite_YYYY` / `effectif_YYYY` headers.
