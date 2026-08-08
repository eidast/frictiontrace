# Getting started

## Prerequisites

- **Node.js ≥ 20** (Node 24 recommended; `better-sqlite3` ships prebuilt binaries for it)
- **Chromium** for Playwright (installed below)
- **Google Chrome** installed on the machine for synthetic Lighthouse runs (`chrome-launcher` looks for a system Chrome)
- A **CrUX API key** (optional, only for field-data features) — create one in Google Cloud Console with the Chrome UX Report API enabled

## Install

```bash
git clone https://github.com/eidast/frictiontrace.git
cd frictiontrace
npm install
npx playwright install chromium
npm run build   # builds engine + CLI workspaces
```

## Your first journey audit

```bash
node packages/cli/bin/ft run https://example.com
```

This loads `engine/journeys/default-ecommerce.yaml`, drives a real browser through the journey, captures signals, runs the analyzer, and writes artifacts to `runs/<runId>/`:

- `report.html` — executive / client / developer perspectives
- `run.har`, `run.mhtml`, `trace.zip` — network log, page snapshot, Playwright trace
- `audit.db` — all signals, steps, issues, and facts in SQLite
- `screenshots/` — 3 per step (viewport, above-fold, full-page)

Open the report with `node packages/cli/bin/ft replay <runId>`.

To try it without a live site, use the planted-bug fixture under `tests/fixture-site/` (serve it with any static server and point `ft run` at it).

## Your first CrUX sync

```bash
cp .env.example .env
# edit .env → CRUX_API_KEY=<your key>

npm run crux:sync            # fetch up to 40 weeks of history into data/crux.db
npm run crux:dashboard       # interactive dashboard at http://localhost:3000
```

The benchmark roster is defined in `engine/crux-pages.yaml` (see [sites.md](sites.md)). To refresh discovered checkout/PLP/PDP URLs first, run `npx tsx scripts/crux-discover.ts`.

## Your first synthetic lab run

```bash
npm run synthetic:run -- --site www.walmart.com.gt --page homepage --label my-first-run
```

Metrics and image findings land in `data/crux.db`. Generate the image audit report with:

```bash
npm run image:optimize   # builds optimized WebP variants in reports/image-assets/
npm run image:report     # writes reports/image-audit.html
```

## Where outputs land

| Path | Contents | Committed? |
|---|---|---|
| `runs/<runId>/` | journey audit artifacts | no |
| `reports/` | generated HTML reports | selected reports only |
| `reports/image-assets/` | optimized WebP variants + manifest | no |
| `data/crux.db` | CrUX history, synthetic runs, image findings | yes (Git LFS) |

## Next steps

- [CLI & scripts reference](cli-reference.md)
- [CrUX benchmark guide](crux-benchmark.md)
- [Synthetic audits guide](synthetic-audits.md)
- [Image audit guide](image-audit.md)
- [Contributing](../CONTRIBUTING.md)
