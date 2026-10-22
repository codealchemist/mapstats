# onisr: road deaths by département (ONISR, BAAC accident files)

| | |
|---|---|
| Publisher | ONISR – Observatoire national interministériel de la sécurité routière |
| Page | https://www.data.gouv.fr/fr/datasets/bases-de-donnees-annuelles-des-accidents-corporels-de-la-circulation-routiere-annees-de-2005-a-2024 |
| Licence | Licence Ouverte (as labelled by the publisher) |
| Kind | `register`: every injury accident recorded by the police and gendarmerie (BAAC form) |
| Indicators | `roadDeaths` (scored, 3-year average) |
| Levels | département of the accident |
| Period | 2019–2024, yearly (the 2025 files are expected in autumn 2026) |
| Next release | Autumn each year, for the previous year |
| Access | CSV downloads; resource URLs are pinned per year because the catalogue renames files |
| Methodology | `description-des-bases-de-donnees-annuelles.pdf` shipped with the dataset |

## Definitions vs the MapStats catalogue

- `roadDeaths`: people killed within 30 days of the accident (`grav = 2` in the "usagers" file), per 100,000 inhabitants of the département where the accident happened, over INSEE's population estimate at 1 January of the same year (from the INSEE provider's stored estimates). Argentina's SNIC publishes road-death victims per 100,000 too; the 30-day rule is the international definition both follow.
- Users are joined to their accident by `Num_Acc` (`Accident_Id` in the 2022 file) for the département; one row per user, so nothing is multiplied through vehicles.

## Updating

Add the new year's "caractéristiques" and "usagers" resource URLs to `YEARS` in [`prefill.mjs`](prefill.mjs) (copy the links from the dataset page), then:

```bash
npm run prefill -- FRA --provider onisr
npm run anchors && npm run golden -- --update && npm test && npm run country:check -- FRA
```

## Quirks

- The 2019 file writes départements 01–09 as "1"–"9"; later years zero-pad them.
- Saint-Pierre-et-Miquelon, Saint-Martin, Saint-Barthélemy, Wallis-et-Futuna, Polynésie and Nouvelle-Calédonie are counted but dropped (not on the map).
- Mayotte's population estimates start in 2014 in INSEE's series, so every year has a denominator.
