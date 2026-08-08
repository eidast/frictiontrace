# Design — frictiontrace-m0

## Context

This change creates the first deliverable of FrictionTrace: an open-core CLI that runs a real browser against an e-commerce URL, captures structured signals, and emits a static HTML report. The larger vision (LLM narrative, hosted dashboard, PDF, multi-tenant SaaS) is documented in `docs/superpowers/specs/2026-06-22-frictiontrace-design.md` and explicitly deferred to later milestones (M1, M2, M3). M0 is the smallest system that proves the core thesis: that a real browser navigating a real e-commerce yields signal that, analyzed with simple rules, surfaces meaningful friction the site owner didn't know they had.

The project is greenfield. No existing code, no existing data, no existing users. Constraints come entirely from the locked decisions in the spec: Node.js + Playwright + SQLite, open core, journey configurable via YAML, 10 signal categories.

## Goals / Non-Goals

**Goals:**
- A working `ft` CLI that runs an end-to-end audit on a target URL in under 2 minutes on a typical e-commerce homepage
- A SQLite database per run with all 10 signal categories captured during the default journey
- An analyzer that detects at least 5 high-value issue kinds: `js_error`, `third_party_blocking`, `slow_lcp`, `mixed_content`, `checkout_broken`
- A static HTML report that shows executive summary, top 5 issues, evidence (signal IDs), and the 4 perspectives (Cliente, Developer, Dueño, Impactos) using deterministic templates
- HAR and MHTML artifacts generated from the captured signals
- A planted-bug fixture site and integration test that proves the analyzer detects known bugs
- All code is open-source-ready (clean module boundaries, public APIs, no proprietary strings in the core)

**Non-Goals:**
- LLM narrative layer (M1)
- Hosted web dashboard, auth, billing, multi-tenant (M2)
- PDF generation (M1)
- UI for journey authoring (M2)
- Record-and-replay journey authoring (M3)
- Mobile journeys, authenticated journeys, cross-site comparison (post-M3)
- Historical run comparison, alerts (M2)
- All 12 issue kinds in the spec — M0 ships 5; the rest follow as the rule set grows

## Decisions

### D1. Node.js + Playwright over alternatives

**Choice:** Node.js 20+, Playwright (Chromium only).

**Alternatives considered:**
- **Python + Playwright:** weaker ecosystem for LLM, dashboard, and SaaS work planned in M1–M2. Strong for parsing/scraping but we don't need that yet.
- **Puppeteer:** Playwright is the modern superset (better CDP, multi-language, built-in trace, more reliable auto-wait).
- **Selenium:** legacy; not in our ecosystem.

**Why:** Playwright is the best-in-class for browser automation, has built-in trace export, and Node.js has the richest ecosystem for the LLM/SaaS work that follows M0.

### D2. SQLite (better-sqlite3) over Postgres

**Choice:** Single SQLite file per run (in `./runs/<runId>/audit.db`).

**Alternatives considered:**
- **Postgres:** operationally heavier; M0 runs locally and a single file is easy to inspect, ship as an artifact, and later load into the SaaS.
- **DuckDB:** great for analytics, but the data is record-oriented and SQLite's tooling is universally understood.

**Why:** One file per audit is portable, inspectable with `sqlite3` CLI, easy to upload to the SaaS in M1, and zero-ops for local runs. We accept that the M0 design doesn't aggregate cross-run queries — that's deferred to M2.

### D3. Chromium only in M0

**Choice:** Single browser engine (Chromium via Playwright).

**Why:** The HAR/MHTML/trace ecosystem is best in Chromium. The fixture site is simpler. We explicitly defer Firefox/Webkit to a later milestone — the design supports it (the engine is browser-agnostic in code) but M0 ships one browser for the simplest possible testing surface.

### D4. Closed catalog of 5 issue kinds in M0

**Choice:** Ship exactly 5 issue kinds in M0, with the rule-based structure ready to grow to 12+.

| Kind | Source signal(s) | Severity model |
|---|---|---|
| `js_error` | `pageerror` with frequency > 0 | `critical` if on checkout path, `high` otherwise |
| `third_party_blocking` | 3rd-party domain with total time > 1500ms on critical path | `high` if in critical journey step |
| `slow_lcp` | LCP > 2500ms | severity scales with magnitude (med/high/critical) |
| `mixed_content` | network requests with `http://` scheme on `https://` page | `med` (security risk) |
| `checkout_broken` | network failures (status ≥ 500 or net::ERR_*) on `/checkout*` or `/cart*` URLs | `critical` |

**Why these 5:** they cover the user's stated concerns ("errores por mala programacion", "latencia por llamados a otros sitios", "riesgos para el cliente final") and are detectable from the signal stream without LLM. The remaining 7 issue kinds in the spec are skipped in M0 because the rule logic is mechanical and can be added incrementally after M0 ships — the catalog is the design's contract for growth.

### D5. HAR reconstructed from signals (not captured via CDP live)

**Choice:** After the run, the engine reads the `signals` table for the network category and writes a HAR file via a deterministic `signalsToHar()` function.

**Why:** The signal stream already has all HAR fields (URL, method, status, sizes, per-phase timings). A live HAR capture (via `puppeteer-har`-style CDP events) would add complexity to the worker for no new data. Reconstructing also gives us a clean unit-test surface: assert that the function produces a well-formed HAR for any signal stream.

### D6. Template-based executive summary (no LLM in M0)

**Choice:** The executive summary is rendered from a Handlebars (or simple string-template) engine reading facts and issues. No LLM call.

**Why:** The owner (semi-technical, executive-focused) reads this section first. It must be deterministic, fast, and never fail. LLM is a feature for the *insights* (developer + impacts) which are deferred to M1. The M0 report explicitly labels the developer and impacts sections as "Coming in M1" so the structure is honest.

### D7. Default journey hardcoded as a YAML fixture

**Choice:** The default journey lives in `engine/journeys/default-ecommerce.yaml` and is loaded automatically when no `--journey` flag is passed. It is overridable via `--journey path/to/file.yaml`.

**Why:** The user's path through the site is well-known (home → search → product → cart → checkout) and the M0 value is the analysis, not journey configurability. Mode 1 (YAML) authoring is supported (override flag) but the UI for authoring is M2.

### D8. Project layout

```
frictiontrace/
├── packages/
│   └── cli/                 # the `ft` binary
│       ├── package.json
│       ├── bin/ft.ts        # command entry
│       └── src/commands/    # run, validate, replay
│
├── engine/                  # reusable engine (Node library)
│   ├── src/
│   │   ├── orchestrator/    # run lifecycle, queue
│   │   ├── worker/          # Playwright runner
│   │   ├── signals/         # 10-category capture
│   │   ├── analyzer/        # rules → issues + facts
│   │   ├── artifacts/       # HAR, MHTML, trace
│   │   ├── render/          # local HTML renderer
│   │   ├── journey/         # YAML schema + validator + runner
│   │   └── storage/         # SQLite DAOs
│   ├── journeys/            # default journeys
│   └── package.json
│
├── tests/
│   ├── fixture-site/        # static planted-bug site
│   ├── unit/                # vitest unit tests
│   ├── integration/         # playwright integration tests
│   └── golden/              # snapshot tests
│
├── docs/
└── package.json             # workspace root
```

**Why monorepo with `engine` and `cli`:** M0's CLI consumes the engine as a library, which mirrors how the future SaaS (M1+) will consume it. Forces clean module boundaries from day 1. Uses npm workspaces (no extra tooling).

### D9. Test fixture = static site served locally

**Choice:** `tests/fixture-site/` is a set of static HTML/CSS/JS files served by Playwright's `webServer` in integration tests. The fixture has bugs planted (broken image, console.error loop, slow fake third-party, mixed content, layout shift, slow LCP).

**Why:** A real local server is fast to spin up in tests, no external network dependency, deterministic. The fixture is a *test asset*, not a deployed product — it lives in the repo and is the integration test's contract.

### D10. Integration test = Worker run against fixture

**Choice:** Playwright Test launches the fixture site, the engine's Worker runs the default journey, and asserts:
1. Expected `signal` rows are present
2. Each planted bug produces the expected `issue` with the expected `severity`
3. The HAR file is well-formed (passes a JSON Schema check)
4. The MHTML file is non-empty
5. The HTML report renders and contains the expected issue IDs

**Why:** End-to-end assertion of the full pipeline against a known input. If a planted bug stops being detected, the test fails — the analyzer has regressed.

## Risks / Trade-offs

- **[Risk] M0 ships only 5 of 12 issue kinds from the spec.** → Mitigation: the analyzer is rule-based and the catalog is open. Adding the remaining 7 is a matter of writing rules; the design is ready for that growth without refactoring. M1 (LLM) and M2 (dashboard) can add kinds in parallel.

- **[Risk] Default journey is brittle on non-standard e-commerce sites.** → Mitigation: the journey YAML supports `optional: true` on actions, fallback selectors, and `onError: skip_step`. The journey is overridable via `--journey`. The test fixture validates the happy path; ad-hoc sites are explicitly an M2+ concern.

- **[Risk] `better-sqlite3` native binding complicates CI on diverse platforms.** → Mitigation: ship prebuilt binaries via `node-pre-gyp`. If a platform lacks binaries, install falls back to a build-from-source step documented in `README.md`.

- **[Risk] MHTML capture depends on Chrome DevTools Protocol semantics that can change across Chromium versions.** → Mitigation: pin Playwright's bundled Chromium version; integration test asserts MHTML is non-empty. If the API changes, the test fails loudly.

- **[Risk] Long journey times on slow sites exceed CLI timeout expectations.** → Mitigation: per-step timeouts (10s default) and overall timeout (120s default) configurable via CLI flag. If timeout fires, partial report is produced and the run is marked `partial` in the database.

- **[Risk] LLM is not in M0, so the developer and impacts sections will be thin / placeholder.** → Mitigation: the M0 report explicitly labels those sections as "Coming in M1 — for now, see the raw issue list". The structure is honest; the user is not misled.

- **[Risk] SQLite file-per-run makes cross-run analytics hard.** → Mitigation: deferred to M2. M0 doesn't claim cross-run features. The data model is forward-compatible (a future aggregation layer can read all run files).

## Migration Plan

N/A — greenfield. There is nothing to migrate.

For deployment: M0 is a local CLI. Users install via `npm install -g frictiontrace` (or run from a clone). The release process is a tagged commit on `main` and a published npm package. No infrastructure to provision.

For rollback: since M0 has no users yet, "rollback" means not tagging a release. If a bug is found post-release, a patch release is published; existing users re-install.

## Open Questions

1. **Default journey timeout budget** — 120s for the full journey is a guess. Will validate with the first real audits; configurable via `--total-timeout-ms`.
2. **Screenshots per step (3) for every step** — could bloat storage for long custom journeys. M0 default is 7 steps × 3 = 21 PNGs ≈ 5–10MB. Acceptable. If a user adds 30 steps, we may need a `--screenshots every-N-steps` flag in a later patch.
3. **Anonymization of captured URLs** — the MHTML and HAR contain full URLs including query strings (which may carry PII like email or session tokens). M0 doesn't anonymize; users are warned in the CLI output. Anonymization layer is a fast follow-up if we see real PII in early runs.
4. **Choosing the "first" real audit customer** — out of scope for this design, but a real audit on a real e-commerce in week 1 will tell us more than any further spec work. Suggested as the first task of M0 implementation.
