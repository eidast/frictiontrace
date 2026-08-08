# FrictionTrace

Open-core digital experience monitoring focused on user friction in e-commerce. FrictionTrace drives a real browser through shopping journeys, captures a structured signal stream, and turns it into actionable findings — complemented by field data (Chrome UX Report) and lab data (synthetic Lighthouse) across a 23-site e-commerce benchmark.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node >= 20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)

## Features

- **Journey friction audits** — scripted shopping journeys (home → PLP → PDP → checkout) in a real browser; every issue cites the signals that evidence it. Artifacts: HTML report, HAR, MHTML, Playwright trace, SQLite run DB, step screenshots.
- **CrUX field-data benchmark** — Core Web Vitals history (up to 40 weeks) for 23 e-commerce sites in 4 cohorts (Walmart CAM, Walmart subsidiaries, Walmart Global, competitors), stored in a local SQLite database.
- **Synthetic Lighthouse lab runs** — versioned, labeled Lighthouse audits over all benchmark pages, mobile + desktop, with realistic throttling profiles (fast4g / broadband) and bounded parallel workers.
- **Interactive image audit** — image findings (delivery, VTEX full-resolution originals, LCP priority) with an in-report viewer: original vs locally optimized WebP variant, byte comparison, and one-click download.
- **Reports & dashboards** — cohort comparison report (field + lab, sortable tables) and an interactive D3.js CrUX dashboard with 7 views, filters, presets, and CSV/JSON export.

## Quickstart

```bash
git clone https://github.com/eidast/frictiontrace.git
cd frictiontrace
npm install
npx playwright install chromium

# Run a journey audit against a site
npm run build
node packages/cli/bin/ft run https://example.com
```

For CrUX field data, copy `.env.example` to `.env` and add a `CRUX_API_KEY` from Google Cloud Console, then `npm run crux:sync`. Full walkthrough: [docs/getting-started.md](docs/getting-started.md).

## Documentation

- [Getting started](docs/getting-started.md) — install, first audit, first CrUX sync
- [CLI & scripts reference](docs/cli-reference.md) — `ft` commands and every npm script
- [CrUX benchmark](docs/crux-benchmark.md) — cohorts, sync flow, dashboard, group report
- [Synthetic audits](docs/synthetic-audits.md) — Lighthouse runner, form factors, throttling
- [Image audit](docs/image-audit.md) — findings pipeline and interactive report
- [Benchmark sites](docs/sites.md) — the 23-site roster
- [Engine architecture](engine/ARCHITECTURE.md) — orchestrator, signals, analyzer, render
- [Journey schema](engine/JOURNEY.md) — journey YAML primitives
- [Original design doc](docs/superpowers/specs/2026-06-22-frictiontrace-design.md)
- [M0 validation notes](docs/m0-audit-notes.md) — honest assessment of the first end-to-end run

## Project structure

- `engine/` — the open-core engine: orchestrator, worker, signal capture, analyzer, artifacts, render
- `packages/cli/` — the `ft` command-line interface
- `scripts/` — CrUX sync/discovery/analysis, dashboards, synthetic runner, image audit
- `tests/` — unit, integration, and the planted-bug fixture site
- `data/` — shared SQLite databases (e.g. `crux.db` with CrUX + synthetic metrics)
- `docs/` — user guides (see index above)
- `openspec/` — spec-driven change management (see `AGENTS.md`)

## Status & roadmap

M0 (open-core MVP) is complete and validated end-to-end — see [docs/m0-audit-notes.md](docs/m0-audit-notes.md). The project history lives in [CHANGELOG.md](CHANGELOG.md). Roadmap for M1+:

- LLM narrative layer over findings
- The 7 analyzer rules deferred from the spec (broken images, layout shift, slow interactions, jank, heavy scripts, deprecations, consent)
- Resource Timing-based third-party blocking measurement
- npm publish of `engine` and `packages/cli`
- M2: hosted dashboard, multi-tenant, historical comparisons

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) — analyzer rules, journey templates, signal categories, and the OpenSpec workflow that governs all behavior changes. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
