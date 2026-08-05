## ADDED Requirements

### Requirement: The system stores synthetic Lighthouse runs in the CrUX database
The system SHALL provide a `synthetic_runs` table in `data/crux.db` recording, per run: run metadata (`run_id`, `suite_version`, `label`, `config_hash`, `fetched_at`, `lighthouse_version`), page identity (`origin`, `group_name`, `page_type`, `url`, `form_factor`), lab metrics (LCP, FCP, CLS, TBT, Speed Index, TTFB, total byte weight, performance score), and an `excluded` flag defaulting to 0.

#### Scenario: Table is created additively
- **WHEN** an existing `data/crux.db` created before this change is opened
- **THEN** the `synthetic_runs` table is created via `CREATE TABLE IF NOT EXISTS` without altering existing tables

### Requirement: Sites and pages can be toggled for synthetic runs via configuration
The pages configuration schema SHALL accept an optional `enabled` boolean on each site and each page entry, defaulting to `true`. The synthetic runner MUST skip any site or page whose `enabled` is `false`.

#### Scenario: Disabled page is skipped
- **WHEN** a page entry in `crux-pages.yaml` has `enabled: false` and the runner executes
- **THEN** that URL is not audited and other pages of the same site still run

#### Scenario: Missing enabled flag defaults to enabled
- **WHEN** a site or page entry has no `enabled` field
- **THEN** it is treated as enabled

### Requirement: The system runs Lighthouse audits over enabled sites and pages
The system SHALL provide `npm run synthetic:run`, which audits every enabled site × page URL using Lighthouse with mobile form factor and simulated throttling, and persists the resulting metrics as one row per URL in `synthetic_runs`, sharing a single `run_id` per invocation.

#### Scenario: Full run covers all enabled URLs
- **WHEN** the user runs `npm run synthetic:run` with all 19 sites enabled
- **THEN** one Lighthouse audit is attempted per site × page URL (76 URLs) and successful audits are persisted with the same `run_id`

#### Scenario: A failing URL does not abort the run
- **WHEN** one URL fails (timeout, DNS, Lighthouse error)
- **THEN** the error is logged, no row is written for that URL, and the runner continues with the next URL

#### Scenario: Chrome missing fails fast
- **WHEN** no Chrome installation can be located
- **THEN** the runner exits with a clear error before starting any audit

#### Scenario: Site filter narrows the run
- **WHEN** the user runs with `--site www.walmart.com.gt`
- **THEN** only that origin's enabled pages are audited

### Requirement: Runs are versioned and individually excludable
Each run SHALL record a `suite_version` (from `--suite-version`, default `v1`) and a free-text `label` (from `--label`, default empty). The script SHALL support `--list` to show past runs, and `--exclude <run_id>` / `--include <run_id>` to toggle the `excluded` flag without running audits.

#### Scenario: Exclude a broken run
- **WHEN** the user runs with `--exclude run_2026-08-05_abc123`
- **THEN** all rows of that run are marked `excluded = 1` and no audits are performed

#### Scenario: List shows exclusion state
- **WHEN** the user runs with `--list`
- **THEN** each past run shows run_id, date, label, row count, and whether it is excluded

### Requirement: The runner supports bounded parallel execution
The script SHALL accept a `--concurrency <n>` flag (integer, default 1, clamped to a maximum of 4). When `n > 1`, the runner MUST launch one Chrome instance per worker and distribute the audit queue across workers, each worker auditing one URL at a time against its own Chrome instance. Omitting the flag MUST preserve fully sequential execution. Invalid values MUST exit with a clear error before any audit.

#### Scenario: Parallel run uses multiple Chrome instances
- **WHEN** the user runs with `--concurrency 3`
- **THEN** up to 3 audits run simultaneously, each in its own Chrome instance, and all rows still share the same `run_id`

#### Scenario: Default stays sequential
- **WHEN** the user runs without `--concurrency`
- **THEN** a single Chrome instance audits URLs one at a time, exactly as before

#### Scenario: Invalid concurrency fails fast
- **WHEN** the user runs with `--concurrency 0` or a non-numeric value
- **THEN** the runner exits with a clear error before launching Chrome or performing any audit

