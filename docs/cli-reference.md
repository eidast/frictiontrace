# CLI & scripts reference

## `ft` — the FrictionTrace CLI

Binary: `packages/cli/bin/ft` (requires `npm run build` first — the CLI resolves the engine via `engine/dist`).

### `ft run <url>`

Runs a journey audit against `url` (must be `http(s)`).

| Option | Default | Description |
|---|---|---|
| `--journey <path>` | `engine/journeys/default-ecommerce.yaml` | Journey YAML to execute (schema: [engine/JOURNEY.md](../engine/JOURNEY.md)) |
| `--out-dir <dir>` | `runs/` | Where to write run artifacts |
| `--quiet` / `--verbose` | — | Log level |

Exit codes: non-zero on invalid input or run failure.

### `ft validate <journey.yaml>`

Validates a journey file against the schema without executing it.

### `ft replay <runId>`

Opens `runs/<runId>/report.html` from a previous run. Accepts `--out-dir` if the run lives elsewhere.

## npm scripts (repo root)

### Data & reports

| Script | Command | Description |
|---|---|---|
| `crux:sync` | `npx tsx scripts/crux-sync.ts` | Fetch CrUX history for all configured pages into `data/crux.db` (loads `.env`) |
| `crux:dashboard` | `npx tsx scripts/crux-dashboard.ts` | Interactive CrUX dashboard server on `localhost:3000` |
| `crux:dashboard:build` | `npx tsx scripts/crux-dashboard.ts --build` | Self-contained `reports/crux-dashboard.html` with embedded data |
| `crux:group-report` | `npx tsx scripts/crux-group-report.ts` | Cohort comparison report (field + lab) → `reports/crux-group-compare.html` |
| `synthetic:run` | `npx tsx scripts/synthetic-run.ts` | Synthetic Lighthouse audits — see flags below |
| `image:optimize` | `npx tsx scripts/image-optimize.ts` | Download flagged images and write optimized WebP variants to `reports/image-assets/` |
| `image:report` | `npx tsx scripts/image-report.ts` | Interactive image audit report → `reports/image-audit.html` |

Additional scripts without an npm alias: `scripts/crux-discover.ts` (discover checkout/PLP/PDP URLs into `engine/crux-pages.yaml`), `scripts/crux-analyze.ts` (ad-hoc analysis), `scripts/crux-dashboard.ts` (also runnable directly).

### `synthetic:run` flags

```
--site <origin>             Only audit pages of this origin
--page <type>               homepage | checkout | plp | pdp
--form-factor <ff>          mobile (default) | desktop | both
--label <text>              Free-text label stored on every row of the run
--suite-version <v>         Suite version tag (default: v1)
--concurrency <n>           Parallel worker processes, own Chrome each (1-4, default 1)
--throttling-profile <name> fast4g | slow4g | broadband (default: fast4g mobile, broadband desktop)
--exclude <run_id>          Mark all rows of a run as excluded and exit
```

Throttling profiles: `fast4g` (RTT 60 ms, 9/1.5 Mbps, 2× CPU — realistic median mobile), `slow4g` (RTT 150 ms, 1.6/0.75 Mbps, 4× CPU — stress test), `broadband` (RTT 40 ms, 20/5 Mbps, 1× CPU — fixed-line desktop).

### Development

| Script | Description |
|---|---|
| `build` | Build all workspaces (run before `typecheck`) |
| `test:unit` | Vitest unit tests (engine workspace) |
| `test:integration` | Playwright integration tests (tests workspace) |
| `typecheck` | `tsc --noEmit` across workspaces |
