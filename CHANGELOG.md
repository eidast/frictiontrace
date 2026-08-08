# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Synthetic Lighthouse runner** (`scripts/synthetic-run.ts`) — lab audits over all sites/pages in `engine/crux-pages.yaml`, with suite versioning, run labels, bounded parallel workers, and `--exclude` for bad runs (2026-08-05).
- **Throttling profiles** — `fast4g` (realistic median mobile, default), `slow4g` (stress test), and `broadband` (desktop); mobile/desktop form factors per target (2026-08-05).
- **Cohort comparison report** (`scripts/crux-group-report.ts`) — Walmart vs Competencia field-data report, later extended with lab (Lighthouse) sections per page type and sortable tables (2026-08-05).
- **Walmart Global segment** — 4 sites (US, Canada, Mexico, Chile) added as a third cohort; group report cohorts became data-driven (2026-08-05).
- **Image audit v1** — image findings persisted from Lighthouse audits with a work-list HTML report (2026-08-05).
- **Image audit v2** — interactive report with per-finding viewer, locally optimized WebP variants (`image:optimize`, sharp), mobile/desktop form factors, LCP priority checks, and VTEX full-resolution detection (2026-08-08).

### Fixed

- Signal capture and journey execution bugs in the engine (2026-08-04).

## [0.1.0] - 2026-06-29

### Added

- **M0 open-core engine** — journey-driven friction audits: real-browser runs capture a structured signal stream, analyzer rules produce cited issues, and artifacts include a templated HTML report, HAR, MHTML, and Playwright trace (2026-06-22).
- **`ft` CLI** — `ft run`, `ft validate`, `ft replay`.
- **CrUX data integration** — Google Chrome UX Report history (up to 40 weeks) for an e-commerce benchmark, stored in `data/crux.db`; site URL discovery for checkout/PLP/PDP pages (2026-06-29).
- **28-site benchmark** — Walmart CAM (propios + subsidiarias) and competitor sites with homepage/checkout/PLP/PDP URLs (2026-06-29).
- **Interactive CrUX dashboard** — D3.js views with filters, presets, and CSV/JSON export, as a local server or a self-contained HTML build (2026-06-29).
- **8 additional CrUX metrics** and a multisite comparison view (2026-06-29).

[Unreleased]: https://github.com/eidast/frictiontrace/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/eidast/frictiontrace/releases/tag/v0.1.0
