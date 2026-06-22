## Why

E-commerce sites accumulate invisible friction — slow third-party scripts, console errors, broken journeys, layout shifts — that hurts conversion and that site owners can't see from inside their stack. FrictionTrace M0 builds the **open-core engine** that runs a real browser against a target e-commerce, captures a structured signal stream, and produces a templated local report. This proves the core thesis and produces a tangible artifact to validate demand before any LLM or SaaS work.

## What Changes

- **New CLI tool** `ft` with `run`, `validate`, and `replay` commands
- **Playwright-based Worker** that executes a default e-commerce journey (home → search → product → cart → checkout) in Chromium
- **SQLite storage** for runs, steps, signals, screenshots, issues, facts, report docs, and journeys
- **Signal capture** in 10 categories: Web Vitals, console, network, JS exceptions, DOM/UX, page lifecycle, storage & consent, security, third-party inventory, journey evidence
- **Analyzer** that turns signals into issues (closed catalog: `js_error`, `third_party_blocking`, `slow_lcp`, `mixed_content`, `checkout_broken` for M0) and structured facts
- **Template-based executive summary** (no LLM in M0) with scores and top 5 issues
- **HAR + MHTML artifact generation** from captured signals
- **Local HTML renderer** that produces a static report file (`report.html`) — no dashboard, no auth
- **YAML journey config** with declarative schema, validator, and sensible default
- **Planted-bug fixture site** for integration testing the analyzer

## Capabilities

### New Capabilities

- `cli`: the `ft` command-line interface (`run`, `validate`, `replay`) and its argument/flag handling
- `journey-execution`: the YAML journey schema, validator, and Playwright-based journey runner that interprets and executes steps
- `signal-capture`: capture of 10 signal categories during the journey and persistence to SQLite
- `friction-analysis`: the analyzer that transforms signals into issues (with severity and evidence) and structured facts
- `report-rendering`: local static HTML renderer plus HAR and MHTML artifact generation from the captured signals

### Modified Capabilities

None — this is a greenfield project. `openspec/specs/` is empty.

## Impact

- **New project** (no existing code to integrate with)
- **New dependencies:** Node.js 20+, Playwright (with Chromium), better-sqlite3, Zod (for YAML validation), Vitest (for tests)
- **Hosting:** none in M0 — runs locally as a CLI
- **External services:** none — no LLM calls, no remote APIs
- **Test infrastructure:** a static HTML/JS fixture site served locally during integration tests; adds Playwright Test as a dev dependency
