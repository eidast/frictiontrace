# Synthetic audits (Lighthouse lab data)

`scripts/synthetic-run.ts` runs Lighthouse audits over the sites/pages in `engine/crux-pages.yaml` and stores results in `data/crux.db`. Lab data complements [CrUX field data](crux-benchmark.md): it is reproducible, on-demand, and powers the [image audit](image-audit.md).

## Basic usage

```bash
# One site, one page type
npm run synthetic:run -- --site www.walmart.com.gt --page homepage

# Full cohort, both form factors, labeled, 4 workers
npm run synthetic:run -- --page homepage --form-factor both \
  --label image-audit-v2-2026-08 --concurrency 4
```

All flags: [cli-reference.md](cli-reference.md#syntheticrun-flags).

## Form factors and throttling

- `--form-factor mobile|desktop|both` (default `mobile`). `both` doubles the target list.
- Desktop audits use Lighthouse desktop emulation; mobile uses the default mobile emulation.
- Throttling defaults per form factor and can be overridden globally with `--throttling-profile`:

| Profile | RTT | Down/Up | CPU | Intended for |
|---|---|---|---|---|
| `fast4g` | 60 ms | 9 / 1.5 Mbps | 2× | Realistic median mobile (default mobile) |
| `slow4g` | 150 ms | 1.6 / 0.75 Mbps | 4× | Stress test (Lighthouse default) |
| `broadband` | 40 ms | 20 / 5 Mbps | 1× | Fixed-line desktop (default desktop) |

## Labels, versioning, exclusion

- `--label <text>` tags every row of a run (e.g. `baseline-fast4g-2026-08`) so analyses can pin or compare cohorts.
- `--suite-version <v>` (default `v1`) marks the audit suite version — bump it when the checks change so old runs stay comparable.
- `--exclude <run_id>` marks all rows of a bad run as excluded; reports query only non-excluded rows (newest per origin + page type wins).

## Concurrency

`--concurrency 4` spawns up to 4 worker processes, each with its own Chrome instance. Sequential mode (`--concurrency 1`, default) is the most conservative. Requires a system Chrome (via `chrome-launcher`).

## Storage

Each run writes to `data/crux.db`:

- `synthetic_runs` — one row per (URL, form factor): scores, web vitals, byte weights, throttling profile, label, suite version, plus per-page image byte stats (`image_bytes_modern`, `image_bytes_legacy`, `image_bytes_third_party`, `image_count`).
- `image_findings` — one row per image issue: audit id, resource URL, byte estimates, `form_factor`, and displayed dimensions.

Schema and additive migrations live in `engine/src/crux/schema.ts` and `engine/src/crux/db.ts`.
