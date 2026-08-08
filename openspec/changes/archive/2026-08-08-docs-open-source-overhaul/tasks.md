# Tasks

- [x] 1.1 Community files: `CHANGELOG.md` (Keep a Changelog, backfilled from git history: 0.1.0 M0 + Unreleased for CrUX integration, dashboard, multisite compare, group report, synthetic runner, image audit v1/v2, Walmart Global), `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), `SECURITY.md`, `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, `.github/PULL_REQUEST_TEMPLATE.md`.
- [x] 1.2 Rewrite `README.md`: pitch + badges (MIT, Node ≥20), features, quickstart, docs index, updated project structure, roadmap (M1 items from audit notes), contributing, license. Remove stale "Status: M0" pointer and inline CrUX walkthrough (moved to `docs/crux-benchmark.md`).
- [x] 1.3 `docs/getting-started.md`: prerequisites (Node ≥20, Chrome for Lighthouse), install, `.env` with `CRUX_API_KEY`, first `ft run`, first CrUX sync + dashboard, where outputs land (`runs/`, `reports/`, `data/`).
- [x] 1.4 `docs/cli-reference.md`: `ft run|validate|replay` and every root npm script (`crux:sync`, `crux:dashboard[:build]`, `crux:group-report`, `synthetic:run`, `image:optimize`, `image:report`, build/test/typecheck) with flags from `scripts/synthetic-run.ts` USAGE.
- [x] 1.5 `docs/crux-benchmark.md`: 4 cohorts (walmart_propios, walmart_subsidiarias, walmart_global, otros), discover→sync→analyze flow, dashboard (7 views, serve vs build), group-compare report (field + lab sections, sortable tables).
- [x] 1.6 `docs/synthetic-audits.md`: targets from `engine/crux-pages.yaml`, `--form-factor`, throttling profiles (fast4g/slow4g/broadband), labels, concurrency, `--exclude`, DB tables.
- [x] 1.7 `docs/image-audit.md`: v2 pipeline (run → `image:optimize` → `image:report`), findings catalog (delivery, VTEX full-res, LCP checks), modal viewer + `image-assets/`, form-factor toggle.
- [x] 1.8 `docs/sites.md`: translate to English, add the 4 `walmart_global` sites (23 total, 4 groups matching `engine/crux-pages.yaml`).
- [x] 1.9 Move `REAL-AUDIT-NOTES.md` → `docs/m0-audit-notes.md` verbatim; delete root file.
- [x] 1.10 Consistency: `CONTRIBUTING.md` (mention walmart_global in site-adding steps, link new docs), one convention line in `AGENTS.md` (docs in `docs/`, English, keep README index current).
- [x] 1.11 Cross-link check: grep all `.md` for relative links and verify targets exist.
- [x] 1.12 Verify: `npm run test:unit`, `npm run typecheck`, `openspec validate docs-open-source-overhaul --strict`.
