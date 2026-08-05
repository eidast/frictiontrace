# Tasks

- [x] 1.1 Add `synthetic_runs` table to `engine/src/crux/schema.ts`: id, run_id, suite_version, label, config_hash, origin, group_name, page_type, url, form_factor, metrics (lcp, fcp, cls, tbt, speed_index, ttfb, total_byte_weight, performance_score), lighthouse_version, fetched_at, excluded (0/1). Index on (run_id) and (origin, page_type).
- [x] 1.2 Extend `engine/src/crux/config-schema.ts` with optional `enabled` (default true) on site and page entries.
- [x] 1.3 Add `lighthouse` and `chrome-launcher` dependencies to root `package.json`; add npm script `synthetic:run`.
- [x] 1.4 Implement `scripts/synthetic-run.ts`: loads crux-pages.yaml, filters out disabled sites/pages, applies `--site` filter, runs Lighthouse per URL with mobile form factor + simulated throttling, persists metrics with run metadata (run_id, suite_version from arg or default, label, config_hash of the pages yaml).
- [x] 1.5 Implement run management in the same script: `--list` (runs with id, date, label, count, excluded status), `--exclude <run_id>`, `--include <run_id>` toggling the `excluded` flag without running tests.
- [x] 1.6 Fail gracefully per URL (log error, continue with next) and fail fast with a clear message if Chrome is not found.
- [x] 1.7 Smoke-test the runner with `--site www.walmart.com.gt --page homepage`-style filtering against 1-2 URLs; verify rows land in `synthetic_runs` and `--list`/`--exclude`/`--include` work.
- [x] 1.8 Run `npm run typecheck` and `npm run test:unit`; re-run `openspec validate synthetic-lighthouse-runs --strict`.
- [x] 1.9 Add `--concurrency <n>` flag to `scripts/synthetic-run.ts` (integer, default 1, clamp to max 4, clear error on 0/non-numeric): launch one Chrome instance per worker, workers pull URLs from a shared queue, keep per-URL error handling and the attempted/succeeded/failed summary. Update spec and verify with a parallel smoke test.
