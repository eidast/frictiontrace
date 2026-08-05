## Why

CrUX field data (RUM) tells us what real users experience, but it cannot explain *why*: it lacks lab metrics like Total Blocking Time, Speed Index, page weight, and Lighthouse opportunities. Complementing CrUX with scheduled synthetic Lighthouse runs over the same 19 sites × 4 page types gives diagnostic depth. Runs must be versioned and individually excludable so experimental or broken runs never pollute reports.

## What Changes

- Add a `synthetic_runs` table to the CrUX SQLite schema storing Lighthouse lab metrics per site/page/run, with `run_id`, `suite_version`, `label`, `config_hash`, and an `excluded` flag.
- Extend `engine/crux-pages.yaml` schema with optional `enabled` flags (site-level and page-level) so sites/pages can be toggled off without code changes.
- Add `scripts/synthetic-run.ts`: runs Lighthouse (mobile emulation, simulated throttling) against every enabled site × page, persists metrics, and supports `--label`, `--site` filters, and run management (`--list`, `--exclude <run_id>`, `--include <run_id>`).
- Add npm script `synthetic:run`.

## Capabilities

### New Capabilities
- `synthetic-lighthouse-runs`: Scheduled-capable synthetic Lighthouse runner over the configured e-commerce sites, storing versioned lab metrics alongside CrUX field data, with per-site/page toggles and per-run exclusion.

### Modified Capabilities
- `crux-dashboard`: none (report integration is a separate future change).

## Impact

- **Schema**: `engine/src/crux/schema.ts` — new `synthetic_runs` table (additive, backward-compatible).
- **Config**: `engine/src/crux/config-schema.ts` — optional `enabled` on sites and pages; `engine/crux-pages.yaml` unchanged initially (all default to enabled).
- **New file**: `scripts/synthetic-run.ts`.
- **Dependencies**: root `package.json` gains `lighthouse` and `chrome-launcher`; requires a local Chrome install.
- No changes to CrUX sync or the group report generator.
