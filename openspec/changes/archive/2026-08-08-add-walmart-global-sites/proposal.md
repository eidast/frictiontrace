## Why

The benchmark currently covers Walmart Central America (5 own + 8 subsidiaries) and 6 competitors. Adding the four large Walmart markets — US, Canada, Mexico, Chile — as a separate segment lets stakeholders compare the CAM operation against the group's flagship markets on identical page stages (homepage, checkout, PLP, PDP).

## What Changes

- Add 4 sites to `engine/crux-pages.yaml` under a new group `walmart_global`: Walmart US (walmart.com), Walmart Canada (walmart.ca), Walmart Mexico (walmart.com.mx), Walmart Chile (super.lider.cl — Walmart Chile's grocery e-commerce runs on the Lider brand; lider.cl/supermercado redirects there).
- Extend the group comparison report (`scripts/crux-group-report.ts`) to render a third cohort "Walmart Global" alongside Walmart (CAM) and Competencia, in both field and lab sections.
- Run CrUX sync for the new origins and a synthetic (Lighthouse, fast4g) baseline for the new sites.

## Capabilities

### Modified Capabilities
- `crux-group-compare-report`: cohorts become data-driven — the report supports N cohorts (Walmart CAM, Walmart Global, Competencia) instead of the hardcoded pair.
- `synthetic-lighthouse-runs`: no runner changes; new sites are picked up from config automatically.

## Impact

- **Config**: `engine/crux-pages.yaml` — 4 new sites × 4 pages (16 new URLs), new group `walmart_global`.
- **Report generator**: `scripts/crux-group-report.ts` — cohort definition becomes a list; tables gain a third column group; "Sitios evaluados" lists the new segment.
- **Data**: `data/crux.db` grows (CrUX history for 16 new URLs; new synthetic rows).
- No changes to sync logic, schema, or the interactive dashboard.
