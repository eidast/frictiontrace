## MODIFIED Requirements

### Requirement: The system runs Lighthouse audits over enabled sites and pages
The system SHALL provide `npm run synthetic:run`, which audits every enabled site × page URL using Lighthouse with simulated throttling, and persists the resulting metrics as one row per URL in `synthetic_runs`, sharing a single `run_id` per invocation.

The script SHALL accept a `--form-factor mobile|desktop|both` flag, defaulting to `mobile` so existing invocations behave identically. `mobile` uses the established mobile emulation (360×640, DPR 2.625); `desktop` uses Lighthouse's desktop emulation (`formFactor: 'desktop'`, non-mobile screen emulation); `both` audits each target URL twice, once per form factor, within the same run invocation. Each persisted row SHALL record the actual `form_factor` used, and each audited page SHALL also store its image byte stats: modern-format bytes (AVIF/WebP), legacy-format bytes (JPEG/PNG/GIF), third-party image bytes, and image count, aggregated from the `network-requests` audit.

#### Scenario: Full run covers all enabled URLs
- **WHEN** the user runs `npm run synthetic:run` with all 19 sites enabled
- **THEN** one Lighthouse audit is attempted per site × page URL (76 URLs) and successful audits are persisted with the same `run_id`

#### Scenario: Both form factors double the targets
- **WHEN** the user runs with `--form-factor both` over 23 homepages
- **THEN** 46 audits are attempted and each row records `form_factor` of `mobile` or `desktop`

#### Scenario: Default stays mobile
- **WHEN** the user runs without `--form-factor`
- **THEN** audits use mobile emulation exactly as before

#### Scenario: A failing URL does not abort the run
- **WHEN** one URL fails (timeout, DNS, Lighthouse error)
- **THEN** the error is logged, no row is written for that URL, and the runner continues with the next URL

#### Scenario: Chrome missing fails fast
- **WHEN** no Chrome installation can be located
- **THEN** the runner exits with a clear error before starting any audit

#### Scenario: Site filter narrows the run
- **WHEN** the user runs with `--site www.walmart.com.gt`
- **THEN** only that origin's enabled pages are audited

### Requirement: The runner supports configurable throttling profiles
The script SHALL accept a `--throttling-profile <name>` flag selecting the simulated throttling settings passed to Lighthouse (`throttlingMethod: 'simulate'`). Three profiles SHALL exist: `fast4g` (RTT 60 ms, 9216 Kbps down / 1536 Kbps up, 2x CPU slowdown — the default for mobile), `slow4g` (RTT 150 ms, 1638 Kbps down / 750 Kbps up, 4x CPU slowdown — Lighthouse's previous default, kept as a stress test), and `broadband` (RTT 40 ms, 20480 Kbps down / 5120 Kbps up, 1x CPU slowdown — the default for desktop form factor). Desktop audits SHALL use `broadband` unless an explicit `--throttling-profile` overrides it. Each persisted row SHALL record the profile used in a `throttling_profile` column; rows written before this column existed MUST read `slow4g` via an additive migration.

#### Scenario: Default profile is fast4g
- **WHEN** the user runs without `--throttling-profile` in mobile form factor
- **THEN** audits use the fast4g throttling settings and rows are persisted with `throttling_profile = 'fast4g'`

#### Scenario: Desktop defaults to broadband
- **WHEN** the user runs with `--form-factor desktop` without an explicit `--throttling-profile`
- **THEN** audits use the broadband throttling settings and rows record `throttling_profile = 'broadband'`

#### Scenario: slow4g preserves previous behavior
- **WHEN** the user runs with `--throttling-profile slow4g`
- **THEN** audits use the slow4g throttling settings (equivalent to the previous Lighthouse default) and rows record `slow4g`

#### Scenario: Unknown profile fails fast
- **WHEN** the user runs with an unknown profile name
- **THEN** the runner exits with a clear error listing the valid profiles before launching Chrome or performing any audit

#### Scenario: Existing databases are migrated additively
- **WHEN** a `data/crux.db` created before the `throttling_profile` column existed is opened
- **THEN** the column is added via `ALTER TABLE ... ADD COLUMN` and pre-existing rows read `throttling_profile = 'slow4g'`
