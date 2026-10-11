# example-stats: Exampleland Statistics Office, Household Survey

| | |
|---|---|
| Publisher | Exampleland Statistics Office |
| Page | https://stats.example.gov/household-survey |
| Licence | CC BY 4.0 (https://stats.example.gov/terms) |
| Kind | `official-survey`: sample survey with published methodology |
| Indicators | `internet`, `water`, `poverty`, `unemployment` |
| Levels | region (no municipal breakdown published) |
| Period | 2015–2025, yearly |
| Next release | April each year |
| Access | CSV download, stable URL pattern `/{year}/regions.csv`; robots.txt allows it |
| Methodology | https://stats.example.gov/household-survey/methodology |

## Definitions vs the MapStats catalogue

- `internet`: households with a fixed connection per 100 households. The catalogue counts fixed *accesses* per 100 households. The two match when each household has at most one access; the survey doesn't record more, so this is noted here and accepted. Mobile-only access is not counted in either.
- `water`: households connected to the public network. Wells are not counted, which matches the catalogue.
- `poverty`: % of persons below the national poverty line. National lines differ between countries: comparable within a country, only roughly across countries.
- `unemployment`: % of the labour force, urban areas only. Rural regions are under-represented.

## Updating

```bash
npm run prefill -- XXX --provider example-stats --year 2026
npm run country:check -- XXX
```

## Quirks

- Region code `99` ("Not specified") is not a place and is skipped. The prefill reports it as unmatched.
- Blank cells mean "not published (sample too small)". They stay `null`.
