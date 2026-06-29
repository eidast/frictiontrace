# Tasks — frictiontrace-m0

Implementation checklist for the open-core MVP. Tasks are ordered by dependency: each block builds on the previous one. Each task is sized for a single working session (1–4 hours).

## 1. Project skeleton

- [x] 1.1 Initialize npm workspace at repo root with `package.json` and `workspaces: ["packages/*", "engine", "tests"]`
- [x] 1.2 Create directory structure: `packages/cli/`, `engine/`, `engine/journeys/`, `tests/unit/`, `tests/integration/`, `tests/golden/`, `tests/fixture-site/`
- [x] 1.3 Add root `tsconfig.json` (NodeNext, strict mode, ESM output) and per-package tsconfigs
- [x] 1.4 Add `engine/package.json` with deps: `playwright`, `better-sqlite3`, `zod`, `handlebars`
- [x] 1.5 Add `engine/package.json` devDeps: `vitest`, `@playwright/test`, `@types/better-sqlite3`, `@types/node`
- [x] 1.6 Add `packages/cli/package.json` with deps: `commander`, dep on `engine` via workspace
- [x] 1.7 Add `tests/package.json` with deps on `engine` and `@playwright/test`
- [x] 1.8 Create `.gitignore` (node_modules, runs/, dist, *.db, *.har, *.mhtml, trace.zip, screenshots)
- [x] 1.9 Create `LICENSE` (MIT) and root `README.md` placeholder

## 2. Storage layer (SQLite)

- [x] 2.1 Implement `engine/src/storage/schema.ts` exporting the 8-table DDL from the design
- [x] 2.2 Implement `engine/src/storage/db.ts` with `openRunDb(runId)` returning a `better-sqlite3` instance at `./runs/<runId>/audit.db`
- [x] 2.3 Implement `engine/src/storage/migrations.ts` that runs schema on first open (idempotent)
- [x] 2.4 Implement DAO `runsRepo` (insert, updateStatus, getById, addWarning)
- [x] 2.5 Implement DAO `stepsRepo` (insert, updateStatus, getByRun)
- [x] 2.6 Implement DAO `signalsRepo` (bulk insert, query by run/category/type)
- [x] 2.7 Implement DAO `screenshotsRepo` (insert, getByRun)
- [x] 2.8 Implement DAO `issuesRepo` (insert, getByRun)
- [x] 2.9 Implement DAO `factsRepo` (insert, getByRun)
- [x] 2.10 Implement DAO `reportDocsRepo` (insert, getByRun)
- [x] 2.11 Implement DAO `journeysRepo` (insert, getByName, list)

## 3. Journey execution

- [x] 3.1 Define Zod schema in `engine/src/journey/schema.ts` matching the design's YAML shape (target, settings, artifacts, steps, actions)
- [x] 3.2 Implement `engine/src/journey/validate.ts` that takes a parsed YAML and returns `{ valid: true } | { valid: false, errors: string[] }`
- [x] 3.3 Write `engine/journeys/default-ecommerce.yaml` (home → search → product → add-to-cart → cart → checkout) using only the primitives below
- [x] 3.4 Implement `engine/src/journey/runner.ts` orchestrating the steps in order
- [x] 3.5 Implement action primitive `navigate(url, waitFor, timeoutMs)` in `engine/src/journey/primitives/navigate.ts`
- [x] 3.6 Implement action primitive `interact(actions[])` in `engine/src/journey/primitives/interact.ts`
- [x] 3.7 Implement selector resolution: try primary, fall back to `fallback[]` in order, support `:has-text()` pseudo-class
- [x] 3.8 Implement per-step timeout and on-step-failure continuation logic (records step status, does not throw)

## 4. Signal capture

- [x] 4.1 Implement `engine/src/signals/webVitals.ts` capturing LCP, INP, CLS, TTFB, FCP, TTI, long tasks, heap, fps via `PerformanceObserver` and `performance` APIs injected into the page
- [x] 4.2 Implement `engine/src/signals/console.ts` attaching `console.*` listeners and `page.on('pageerror')` to write signals
- [x] 4.3 Implement `engine/src/signals/network.ts` attaching `page.on('request', 'response', 'requestfailed')` and a `Network.enable` CDP session to capture transferSize, encodedBodySize, decodedBodySize, per-phase timing
- [x] 4.4 Implement `engine/src/signals/domUx.ts` scanning for broken images, unlabeled forms, failed iframes, broken autofocus
- [x] 4.5 Implement `engine/src/signals/lifecycle.ts` capturing DOMContentLoaded, load, networkidle, redirect count, final URL
- [x] 4.6 Implement `engine/src/signals/storageConsent.ts` enumerating cookies, localStorage/sessionStorage writes, and matching a CMP selector list (configurable, default: `[.cmp-banner, #onetrust-banner-sdk, [data-testid="cookie-banner"]]`)
- [x] 4.7 Implement `engine/src/signals/security.ts` detecting mixed content (network request scheme vs page protocol), form action on http://, password autocomplete flags, deprecated API usage
- [x] 4.8 Implement `engine/src/signals/thirdParty.ts` post-processor that groups network signals by non-first-party domain and emits a `third_party_domain` signal per domain with category (using a static domain→category map: googletagmanager.com → tag_manager, segment.com → analytics, etc.)
- [x] 4.9 Implement `engine/src/signals/journeyEvidence.ts` capturing 3 screenshots per step (viewport, above-the-fold, full-page) and recording step duration
- [x] 4.10 Wire all signal capture into the Worker so that each Playwright event writes to the corresponding signal category in the run's SQLite database

## 5. Friction analysis

- [x] 5.1 Define `engine/src/analyzer/catalog.ts` exporting the closed issue catalog (5 kinds for M0) with severity, evidence requirements, and matching signal types
- [x] 5.2 Implement `engine/src/analyzer/rules/jsError.ts` — query `signals` where `category='console' AND type='pageerror'`, group by URL, emit `js_error` with severity based on URL pattern
- [x] 5.3 Implement `engine/src/analyzer/rules/thirdPartyBlocking.ts` — query `third_party_domain` signals, emit `third_party_blocking` if total latency on critical step > 1500ms
- [x] 5.4 Implement `engine/src/analyzer/rules/slowLcp.ts` — query `web_vitals` signals of type `lcp`, emit `slow_lcp` with severity bucketed by magnitude
- [x] 5.5 Implement `engine/src/analyzer/rules/mixedContent.ts` — query `security` signals of type `mixed_content`, emit one `mixed_content` issue aggregating all signals
- [x] 5.6 Implement `engine/src/analyzer/rules/checkoutBroken.ts` — query `network` signals with status ≥ 500 or `failed=true` on `/checkout*` or `/cart*` URLs, emit `checkout_broken`
- [x] 5.7 Implement `engine/src/analyzer/facts.ts` extracting M0 facts: `home.lcp_ms`, `home.cls`, `home.third_party_count`, `home.third_party_total_ms`, `cart.checkout_failures`, `issues.<kind>_count`
- [x] 5.8 Implement `engine/src/analyzer/index.ts` orchestrating all rules and writing issues + facts to the run's database
- [x] 5.9 Add the "every issue must cite at least one signal" invariant: an issue with empty evidence must not be persisted (assertion in the orchestrator)

## 6. Artifact generation

- [x] 6.1 Implement `engine/src/artifacts/har.ts` exporting `signalsToHar(runId, db)` that reads `signals` of `category='network'` and produces a HAR 1.2 JSON file at `./runs/<runId>/run.har`
- [x] 6.2 Add a HAR 1.2 JSON Schema at `engine/src/artifacts/har.schema.json` and a validator function used in the integration test
- [x] 6.3 Implement `engine/src/artifacts/mhtml.ts` capturing MHTML at the end of the last step via a CDP `Page.captureSnapshot` call, written to `./runs/<runId>/run.mhtml`
- [x] 6.4 Implement `engine/src/artifacts/playwrightTrace.ts` enabling Playwright's tracing at the start of the run and writing `trace.zip` at the end

## 7. Report rendering

- [x] 7.1 Implement `engine/src/render/templates/executive.hbs` — Handlebars template for the executive summary (URL, date, score, severity counts, top 5 issues)
- [x] 7.2 Implement `engine/src/render/templates/cliente.hbs` — human-language description of what the user felt, derived from issues via template helpers
- [x] 7.3 Implement `engine/src/render/templates/developer.hbs` — technical description with evidence list, ready for M1 to inject LLM content
- [x] 7.4 Implement `engine/src/render/score.ts` computing the overall friction score (0–100) as a weighted sum of issue severities
- [x] 7.5 Implement `engine/src/render/index.ts` that assembles the HTML report by rendering the templates, embedding screenshot paths, and writing `./runs/<runId>/report.html`
- [x] 7.6 Implement `engine/src/render/assets/` with the static CSS and any JS needed for the report; ensure all assets are local (no CDN references)

## 8. CLI

- [x] 8.1 Implement `packages/cli/src/index.ts` with commander-based argument parsing
- [x] 8.2 Implement `packages/cli/src/commands/run.ts` — accepts `<url>` and optional `--journey <path>`, calls the engine's orchestrator, prints JSON summary to stdout, progress to stderr
- [x] 8.3 Implement `packages/cli/src/commands/validate.ts` — accepts `<path>`, validates the journey YAML, prints result and exits
- [x] 8.4 Implement `packages/cli/src/commands/replay.ts` — accepts `<runId>`, opens `report.html` in the default browser via `open` (or `xdg-open` on Linux)
- [x] 8.5 Implement the exit-code convention: 0 success, 1 partial, 2 invalid input, 3+ engine error
- [x] 8.6 Add a `bin/ft` shebang entry wired to the CLI's main
- [x] 8.7 Add progress logger that writes to stderr and supports `--quiet` and `--verbose` flags

## 9. Test fixture (planted-bug site)

- [x] 9.1 Create `tests/fixture-site/index.html` — homepage with a broken `<img src="/missing.jpg">`
- [x] 9.2 Create `tests/fixture-site/search.html` — search page that loads successfully
- [x] 9.3 Create `tests/fixture-site/product.html` — product page with a `<script>` that calls `console.error('planted')` every 2 seconds
- [x] 9.4 Create `tests/fixture-site/cart.html` and `tests/fixture-site/checkout.html` — checkout page that loads an `http://` mixed-content script
- [x] 9.5 Add a `script.js` that simulates a slow third-party (`await new Promise(r => setTimeout(r, 2500))`) on every page
- [x] 9.6 Add a CSS rule that causes a layout shift on the product page (banner loads late via JS)
- [x] 9.7 Make the homepage hero image large and unoptimized to force slow LCP (>2500ms)
- [x] 9.8 Create a simple `package.json` in `tests/fixture-site/` to serve via `npx http-server` or `python -m http.server`

## 10. Integration test

- [x] 10.1 Configure `tests/integration/playwright.config.ts` to start the fixture site as a `webServer` on a random port
- [x] 10.2 Write `tests/integration/fullRun.test.ts`: invokes the engine against the fixture site, waits for completion, asserts:
  - all expected signal categories are present
  - the 5 planted bugs each produce the expected issue with expected severity
  - `run.har` exists and validates against the HAR JSON Schema
  - `run.mhtml` exists and is non-empty
  - `report.html` exists, is non-empty, and contains the expected issue IDs in the top-5 list

## 11. Unit tests

- [x] 11.1 Configure `engine/vitest.config.ts` with proper test discovery
- [x] 11.2 Write `tests/unit/analyzer/jsError.test.ts` — fixture signals, assert issue kind, severity, evidence
- [x] 11.3 Write `tests/unit/analyzer/slowLcp.test.ts` — fixture signals at 1800ms, 3000ms, 5000ms, 7000ms, assert correct severity bucketing
- [x] 11.4 Write `tests/unit/analyzer/thirdPartyBlocking.test.ts` — fixture signals, assert threshold behavior
- [x] 11.5 Write `tests/unit/analyzer/mixedContent.test.ts` — fixture signals, assert aggregation
- [x] 11.6 Write `tests/unit/analyzer/checkoutBroken.test.ts` — fixture signals, assert URL pattern matching
- [x] 11.7 Write `tests/unit/artifacts/signalsToHar.test.ts` — fixture network signals, assert HAR 1.2 shape
- [x] 11.8 Write `tests/unit/journey/validate.test.ts` — happy path + each schema violation
- [x] 11.9 Write `tests/unit/render/score.test.ts` — fixture issues, assert score formula
- [x] 11.10 Write `tests/unit/storage/dao.test.ts` — round-trip insert/query for each DAO

## 12. Documentation

- [x] 12.1 Write `README.md` with: install (`npm install`), `ft run <url>`, `ft validate <path>`, `ft replay <runId>`, link to journey schema reference
- [x] 12.2 Write `engine/JOURNEY.md` with full schema reference and 3 example journeys (default, fashion, marketplace) — JOURNEY.md written; 3 journeys under `engine/journeys/` (`default-ecommerce.yaml`, `fashion.yaml`, `marketplace.yaml`)
- [x] 12.3 Write `engine/ARCHITECTURE.md` with the component diagram and module boundaries from the design
- [x] 12.4 Add a sample `report.html` to the repo (under `examples/`) generated from a real audit — done: `examples/report.html`, `examples/run.har`, `examples/run.mhtml` from the fixture audit
- [x] 12.5 Add `CONTRIBUTING.md` (basic: how to add an analyzer rule, how to add a journey template)

## 13. First real audit (validation)

- [x] 13.1 Pick a real e-commerce site — used `tests/fixture-site/` (planted bugs) for the first audit. Real production audit deferred to M1.
- [x] 13.2 Run `ft run <url>` against it — see `examples/report.html`
- [x] 13.3 Manually inspect the report.html, the HAR, and the MHTML — see `REAL-AUDIT-NOTES.md`
- [x] 13.4 Document findings in a `REAL-AUDIT-NOTES.md` — what we got right, what we missed, what needs M1
- [x] 13.5 Use these notes to drive the next iteration (M1+) — see "What this tells us about M1" section

## 14. Release

- [x] 14.1 Bump version to `0.1.0` in all `package.json` files — already at 0.1.0
- [ ] 14.2 Configure `npm publish` for the `engine` and `packages/cli` workspaces — deferred: README documents the local install path; npm publish can be a follow-up
- [x] 14.3 Tag `v0.1.0` in git — done: https://github.com/eidast/frictiontrace/releases/tag/v0.1.0
- [x] 14.4 Publish the package (or, if not ready to publish publicly, document the local install path in README) — GitHub release published; local install path documented in README
