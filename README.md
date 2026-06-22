# FrictionTrace

Open-core digital experience monitoring focused on user friction in e-commerce. Runs a real browser against a target site, captures a structured signal stream, and produces a templated local report (HTML, HAR, MHTML, Playwright trace).

## Status

M0 — open-core MVP. See `openspec/changes/frictiontrace-m0/` for the change being implemented and `docs/superpowers/specs/2026-06-22-frictiontrace-design.md` for the full design.

## Install (local dev)

```bash
git clone <this-repo> frictiontrace
cd frictiontrace
npm install
npx playwright install chromium
```

## Use

```bash
# Run an audit
node packages/cli/bin/ft run https://example.com

# Validate a journey YAML
node packages/cli/bin/ft validate engine/journeys/default-ecommerce.yaml

# Replay a previous run
node packages/cli/bin/ft replay <runId>
```

## Architecture (M0)

- `engine/` — the open-core engine: orchestrator, worker, signal capture, analyzer, artifacts, render
- `packages/cli/` — the `ft` command-line interface
- `tests/` — unit, integration, golden, and the planted-bug fixture site
- `docs/superpowers/specs/` — design document
- `openspec/changes/` — active OpenSpec changes

## License

MIT
