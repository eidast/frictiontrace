# FrictionTrace — Agent Rules

## OpenSpec workflow (mandatory for feature/behavior changes)

This repo is managed with [OpenSpec](https://openspec.dev) (CLI v1.7+, schema: `spec-driven`, config in `openspec/config.yaml`). Any change that alters behavior, adds a feature, or fixes a non-trivial bug MUST go through the OpenSpec flow — not straight to code.

### Steps

1. **Create the change** in `openspec/changes/<kebab-case-name>/`:
   - `proposal.md` — `## Why`, `## What Changes`, `## Capabilities` (New / Modified), `## Impact`.
   - `tasks.md` — numbered, checkboxed implementation tasks (`- [ ] 1.1 ...`), ordered by dependency.
   - `design.md` — technical decisions and alternatives (required when the change has real design choices).
   - `specs/<capability>/spec.md` — spec deltas, one file per affected capability.
2. **Validate before implementing:** `openspec validate <change-name> --strict` must pass.
3. **Implement** the tasks in order, checking them off in `tasks.md` as you go (`- [x]`).
4. **Verify:** `npm run test:unit`, `npm run typecheck`, and re-run `openspec validate <change-name> --strict`.
5. **Archive when done:** `openspec archive <change-name>` moves the change to `openspec/changes/archive/` and merges deltas into `openspec/specs/`. Ask the user before archiving.

### Spec delta grammar

- Deltas live in the change's `specs/<capability>/spec.md`, never edit `openspec/specs/` directly — main specs are only updated by `openspec archive`.
- Use `## ADDED Requirements`, `## MODIFIED Requirements`, or `## REMOVED Requirements` headers.
- Each requirement: `### Requirement: <name>` followed by normative text with MUST/SHOULD, then at least one `#### Scenario:` in `**WHEN** / **THEN**` form.
- `MODIFIED`/`REMOVED` requirements must match an existing requirement in the main specs by exact name.
- Capability names are kebab-case and reused across changes (e.g. `signal-capture`, `friction-analysis`, `journey-execution`, `crux-dashboard`).

### Useful commands

- `openspec list` — active changes and task progress
- `openspec list --specs` — merged capabilities
- `openspec show <name>` — inspect a change or spec
- `openspec validate <name> --strict` — validate a change or spec

## Project conventions

- npm workspaces: `engine`, `packages/*`, `tests`. Build with `npm run build`; the CLI resolves the engine via `engine/dist`, so rebuild the engine before typechecking the CLI.
- Test commands: `npm run test:unit` (vitest, engine workspace), `npm run test:integration` (Playwright).
- Do not commit `runs/`, `data/*.db` runtime mutations, or generated reports unless the task explicitly requires it.
- Git mutations (commit/push/reset) require explicit user confirmation each time.
