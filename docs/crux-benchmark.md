# CrUX benchmark

FrictionTrace benchmarks real-user web performance across 23 e-commerce sites using Google's [Chrome UX Report](https://developer.chrome.com/docs/crux) (CrUX) History API, storing up to 40 weekly data points per page in `data/crux.db` (versioned with Git LFS).

## Cohorts

Sites are organized in 4 groups (roster: [sites.md](sites.md); source of truth: `engine/crux-pages.yaml`):

| Group | Sites | Description |
|---|---|---|
| `walmart_propios` | 5 | Walmart-owned Central America sites (GT, CR, SV, HN, NI) |
| `walmart_subsidiarias` | 8 | Walmart subsidiary brands (Más x Menos, Paiz, La Despensa, La Unión, Maxi Despensa, Maxi Palí) |
| `walmart_global` | 4 | Walmart US, Canada, Mexico, Chile (Líder) |
| `otros` | 6 | Competitors (Auto Mercado, PriceSmart, Éxito, Carrefour, Chedraui, La Torre) |

Each site has up to 4 page types: `homepage`, `checkout`, `plp`, `pdp`. Pages with `url: null` are skipped until discovery fills them.

## Setup

```bash
cp .env.example .env
# edit .env → CRUX_API_KEY=<your key>
```

## Workflow

### 1. Discover URLs

```bash
npx tsx scripts/crux-discover.ts
```

Finds checkout/PLP/PDP URLs for each site and updates `engine/crux-pages.yaml`.

### 2. Sync history

```bash
npm run crux:sync
```

Calls `queryHistoryRecord` per configured page (PHONE and DESKTOP form factors) and upserts weekly p75 metrics into `data/crux.db`. Metrics include the Core Web Vitals (LCP, CLS, INP, FCP, TTFB) plus diagnostics (LCP subparts, resource types, navigation types, RTT, and more).

### 3. Explore

**Interactive dashboard** (D3.js, 7 views — Resumen, Grupos, Sitios, Tendencia, Comparativa, Desglose, Datos):

```bash
npm run crux:dashboard         # server on http://localhost:3000
npm run crux:dashboard:build   # portable reports/crux-dashboard.html
```

Features: sidebar filters (group, site, page type, metric, form factor, query level, date range), presets, drill-down on chart click, anomalies, CSV/JSON export.

**Cohort comparison report** (field + lab):

```bash
npm run crux:group-report
```

Generates `reports/crux-group-compare.html`: per-page-type sections with cohort summary tables and per-site "semáforo" heatmaps for both CrUX field data and the latest synthetic lab runs. All tables are column-sortable.

### 4. Ad-hoc analysis

```bash
npx tsx scripts/crux-analyze.ts
sqlite3 data/crux.db "SELECT * FROM crux_origins"
```

## Notes

- The CrUX API is rate-limited; a full sync of 23 sites × 4 pages × 2 form factors takes several minutes.
- The dashboard UI and generated reports are in Spanish (stakeholder-facing); the data schema and APIs are English.
