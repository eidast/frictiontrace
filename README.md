# FrictionTrace

Open-core digital experience monitoring focused on user friction in e-commerce. Runs a real browser against a target site, captures a structured signal stream, and produces a templated local report (HTML, HAR, MHTML, Playwright trace).

## Status

M0 — open-core MVP. See `openspec/changes/frictiontrace-m0/` for the change being implemented and `docs/superpowers/specs/2026-06-22-frictiontrace-design.md` for the full design.

## Install (local dev)

```bash
git clone <this-repo> frictiontrace
cd frictiontrace
npm install
npx playwright install chromium
```

## Use

```bash
# Run an audit
node packages/cli/bin/ft run https://example.com

# Validate a journey YAML
node packages/cli/bin/ft validate engine/journeys/default-ecommerce.yaml

# Replay a previous run
node packages/cli/bin/ft replay <runId>
```

## Architecture (M0)

- `engine/` — the open-core engine: orchestrator, worker, signal capture, analyzer, artifacts, render
- `packages/cli/` — the `ft` command-line interface
- `tests/` — unit, integration, golden, and the planted-bug fixture site
- `data/` — shared SQLite databases (e.g., `crux.db` with CrUX historical metrics)
- `docs/superpowers/specs/` — design document
- `openspec/changes/` — active OpenSpec changes

## CrUX Data

FrictionTrace integrates Google's [Chrome UX Report](https://developer.chrome.com/docs/crux) for real-user Core Web Vitals (LCP, CLS, INP, FCP, TTFB) across 28 e-commerce sites.

### Setup

```bash
cp .env.example .env
# Edit .env and add your CRUX_API_KEY from Google Cloud Console
```

### Discover site URLs

Discovers checkout, PLP, and PDP URLs for each site in the benchmark:

```bash
npx tsx scripts/crux-discover.ts
```

This updates `engine/crux-pages.yaml` with discovered URLs.

### Sync CrUX history

Fetches up to 40 weeks of Core Web Vitals history from the CrUX API:

```bash
npx tsx scripts/crux-sync.ts
```

Results are stored in `data/crux.db` (versioned in the repo).

### Analyze data

```bash
npx tsx scripts/crux-analyze.ts
```

### Query directly

```bash
sqlite3 data/crux.db "SELECT * FROM crux_origins"
```

### Dashboard

Interactive D3.js dashboard for exploring CrUX data visually:

```bash
# Start interactive server (live data from crux.db)
npx tsx scripts/crux-dashboard.ts --serve

# Generate portable HTML report
npx tsx scripts/crux-dashboard.ts --build
```

Open `http://localhost:3000` in serve mode, or `reports/crux-dashboard.html` for the portable version. Features: 5 views (Executive Summary, Group Comparison, Site Comparison, Historical Trends, Data Table), presets, export CSV/JSON, mobile vs desktop comparison.

## License

MIT
