# project-docs Specification

## Purpose
TBD - created by archiving change docs-open-source-overhaul. Update Purpose after archive.
## Requirements
### Requirement: README is the project entry point

The repository root `README.md` MUST present the project in English with: a one-paragraph pitch, a feature list covering all major capabilities (journey friction audits, CrUX field-data benchmark, synthetic Lighthouse lab runs, image audit, cohort comparison report, dashboard), a quickstart that a new contributor can follow to a first successful run, a documentation index linking every guide in `docs/` plus `engine/ARCHITECTURE.md`, `engine/JOURNEY.md`, and `CONTRIBUTING.md`, an up-to-date project structure section, and the license. The README MUST NOT reference archived OpenSpec changes as the current development status.

#### Scenario: New contributor follows the quickstart

- **WHEN** a new contributor clones the repo and follows the README quickstart
- **THEN** they can install dependencies, configure required environment variables, and complete a first `ft run` audit without reading any other file

#### Scenario: README contains no stale status pointers

- **WHEN** the README mentions project status or roadmap
- **THEN** it MUST NOT point to `openspec/changes/` entries that have been archived

### Requirement: Community health files are present

The repository MUST include standard open-source community files: `CHANGELOG.md` following Keep a Changelog, `CODE_OF_CONDUCT.md` following the Contributor Covenant, `SECURITY.md` describing supported versions and a private vulnerability reporting channel, and GitHub templates `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md`, and `.github/PULL_REQUEST_TEMPLATE.md`.

#### Scenario: Contributor looks for how to report a security issue

- **WHEN** a user opens `SECURITY.md`
- **THEN** they find the supported versions, a private reporting channel, and guidance on secret handling (e.g. `CRUX_API_KEY` in `.env` must never be committed)

#### Scenario: Changelog reflects project history

- **WHEN** a reader opens `CHANGELOG.md`
- **THEN** they find a Keep-a-Changelog-formatted history backfilled from the git log, including the M0 release and subsequent capability additions

### Requirement: User guides live in docs/

Task-oriented user guides MUST exist in English under `docs/` and MUST be linked from the README documentation index: `getting-started.md`, `cli-reference.md`, `crux-benchmark.md`, `synthetic-audits.md`, and `image-audit.md`.

#### Scenario: Guide covers its full workflow

- **WHEN** a user opens `docs/image-audit.md`
- **THEN** they find the complete pipeline (synthetic run → `image:optimize` → `image:report`), the findings catalog, and how the interactive report consumes `reports/image-assets/`

#### Scenario: CLI reference matches the actual CLI

- **WHEN** a user opens `docs/cli-reference.md`
- **THEN** every `ft` command and every script defined in the root `package.json` is documented with its flags

### Requirement: Benchmark site list matches crux-pages.yaml

`docs/sites.md` MUST list, in English, every site and group defined in `engine/crux-pages.yaml`. When a site is added to or removed from the YAML, `docs/sites.md` MUST be updated in the same change.

#### Scenario: Site roster is complete

- **WHEN** a reader compares `docs/sites.md` with `engine/crux-pages.yaml`
- **THEN** every origin and group in the YAML appears in `docs/sites.md` (currently 23 sites in 4 groups: `walmart_propios`, `walmart_subsidiarias`, `walmart_global`, `otros`)

