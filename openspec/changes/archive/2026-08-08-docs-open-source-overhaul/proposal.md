# Proposal — docs-open-source-overhaul

## Why

The project's documentation no longer matches the codebase and falls short of standard open-source practice:

- `README.md` still describes "Status: M0" and points to `openspec/changes/frictiontrace-m0/` (now archived); it omits the synthetic Lighthouse runner, the cohort comparison report, and the image audit v2, and describes the dashboard as having 5 views (now 7).
- `docs/sites.md` is in Spanish and missing the `walmart_global` group — the benchmark is now 23 sites in 4 groups.
- `REAL-AUDIT-NOTES.md` (M0 scratch notes) sits loose at the repo root.
- Missing entirely: `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, GitHub issue/PR templates, and structured `docs/` guides (getting started, CLI reference, CrUX benchmark, synthetic audits, image audit).

This change was requested previously and never completed.

## What Changes

- Rewrite `README.md` as the project entry point: pitch, badges, features, quickstart, docs index, project structure, roadmap, license — no stale status pointers.
- Add community health files: `CHANGELOG.md` (Keep a Changelog, backfilled from git history), `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), `SECURITY.md`, `.github/ISSUE_TEMPLATE/{bug_report,feature_request}.md`, `.github/PULL_REQUEST_TEMPLATE.md`.
- Create `docs/` guides in English: `getting-started.md`, `cli-reference.md`, `crux-benchmark.md`, `synthetic-audits.md`, `image-audit.md`; translate and update `docs/sites.md` (23 sites, 4 groups); move `REAL-AUDIT-NOTES.md` to `docs/m0-audit-notes.md`.
- Consistency updates: `CONTRIBUTING.md` (walmart_global + docs pointers), one convention line in `AGENTS.md` (docs live in `docs/`, in English; update the README index when adding documented features).

## Capabilities

### New Capabilities
- `project-docs`: the documentation contract for the repository — README as entry point, community health files, user guides in `docs/`, and a benchmark site list kept in sync with `engine/crux-pages.yaml`.

## Impact

- Docs/markdown only: root files, `.github/`, `docs/`, plus one line each in `CONTRIBUTING.md` and `AGENTS.md`.
- No code, schema, or behavior changes. Generated reports remain in Spanish (user-facing artifacts).
- `REAL-AUDIT-NOTES.md` moves to `docs/m0-audit-notes.md` — update nothing else; no code references it.
