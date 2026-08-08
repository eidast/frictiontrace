# Design — docs-open-source-overhaul

## Decisions

### English as the documentation language

Serious open-source projects document in English to maximize contributor reach. The existing `README.md` and `CONTRIBUTING.md` are already in English; `docs/sites.md` was the outlier (Spanish) and is translated. **Generated reports** (`reports/*.html`) stay in Spanish — they are artifacts for Spanish-speaking stakeholders, not project documentation.

### Standards adopted

- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/) with semver versions, backfilled from git history rather than left empty.
- `CODE_OF_CONDUCT.md` is the [Contributor Covenant](https://www.contributor-covenant.org/) v2.1 verbatim (the de-facto standard), with the maintainer email as contact.
- `SECURITY.md` states supported versions and a private reporting channel (GitHub Security Advisories), plus notes on secret handling (`CRUX_API_KEY` in `.env`).
- GitHub templates use YAML front-matter Markdown templates (no YAML forms — keeps the barrier low for a small project).

### Structure: README as index, `docs/` for depth

The README stays scannable (pitch → features → quickstart → docs index → structure → roadmap → license). Detailed guides live in `docs/`:

| File | Covers |
|---|---|
| `getting-started.md` | install, env, first audit, first CrUX sync |
| `cli-reference.md` | `ft` commands + every root npm script with flags |
| `crux-benchmark.md` | cohorts, discover→sync→analyze, dashboard, group report |
| `synthetic-audits.md` | runner: form factors, throttling profiles, labels, concurrency |
| `image-audit.md` | v2 pipeline: run → optimize → report |
| `sites.md` | the 23-site benchmark roster, 4 groups |
| `m0-audit-notes.md` | historical M0 validation notes (moved from root) |

Existing deep docs are reused, not rewritten: `engine/ARCHITECTURE.md`, `engine/JOURNEY.md`, `docs/superpowers/specs/2026-06-22-frictiontrace-design.md` are linked from the README index.

### Alternatives considered

- **MkDocs/Docusaurus site**: rejected — overkill for a single-maintainer pre-1.0 project; plain Markdown in-repo renders fine on GitHub and adds zero build tooling.
- **Doc-only OpenSpec change archived with `--skip-specs`**: rejected per project convention — the change defines a `project-docs` capability so the documentation contract is itself spec'd and validated.
- **Bilingual docs**: rejected — doubles maintenance; English docs + Spanish reports covers both audiences.
