# FrictionTrace Architecture (M0)

## Components

Six isolated units, each with one responsibility and a small interface.

```
┌──────────┐   ┌──────────────┐   ┌──────────────┐
│  CLI     │──▶│ Orchestrator │──▶│ Worker       │
│  (ft)    │   │  (engine)    │   │ (Playwright) │
└──────────┘   └──────────────┘   └──────┬───────┘
                                        │ signals
                                        ▼
                                   ┌──────────────┐
                                   │  Storage     │
                                   │  (SQLite)    │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  Analyzer    │
                                   │  (engine)    │
                                   └──────┬───────┘
                                          │ issues + facts
                                          ▼
                                   ┌──────────────┐
                                   │  Artifacts   │  (HAR, MHTML, trace)
                                   │  (engine)    │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │  Renderer    │  (report.html)
                                   │  (engine)    │
                                   └──────────────┘
```

## Module boundaries

| Module | Path | Responsibility |
|---|---|---|
| `storage` | `engine/src/storage/` | SQLite schema, DAOs, open/close lifecycle |
| `journey` | `engine/src/journey/` | YAML schema, validator, runner, action primitives |
| `signals` | `engine/src/signals/` | Capture of 10 signal categories from a Playwright page |
| `analyzer` | `engine/src/analyzer/` | Rule-based signal → issue + fact extraction |
| `artifacts` | `engine/src/artifacts/` | HAR reconstruction, MHTML capture, Playwright trace |
| `render` | `engine/src/render/` | HTML report assembly, scoring, templates |
| `cli` | `packages/cli/` | `ft` command (commander), 3 subcommands |

## Isolation rules

- Worker doesn't know about issues — only writes signals.
- Analyzer doesn't touch the browser — only reads SQLite.
- LLM is called only after facts exist (M1). If it fails, the report ships without it (M0 has no LLM).
- Renderer is stateless: given a report doc, it produces web + PDF.
- Everything is testable with fixtures: analyzer tested against pre-populated SQLite.

## Data flow (one run)

```
Trigger → Orchestrator → Worker → signals → Analyzer → issues+facts
                                                      ↓
                              Renderer ← report doc ← Artifacts
                                  ↓
                              report.html
```

Run states: `queued → captured → analyzed → done`. Any state can transition to `error` with a `warnings[]` array.

## Performance

M0 target: an end-to-end audit on a typical e-commerce homepage completes in under 2 minutes on a modern machine.

## Dependencies

- Node.js 20+
- Playwright 1.48+ (Chromium)
- better-sqlite3 11+
- Zod 3.23+
- Handlebars 4.7+
- commander 12+ (CLI only)
- yaml 2.6+ (CLI only)
- Vitest 2+ (dev)
- @playwright/test 1.48+ (dev)
