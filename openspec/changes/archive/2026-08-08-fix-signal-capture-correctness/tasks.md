# Tasks — fix-signal-capture-correctness

## 1. Web Vitals capture (`engine/src/signals/webVitals.ts`)

- [x] 1.1 Make the in-page `push` latest-wins for `lcp` and `cls` (new entry replaces unflushed entries of the same type); keep append semantics for `fcp`, `long_task`, `inp`
- [x] 1.2 Capture navigation timing on the window `load` event (and immediately if `document.readyState === "complete"`); never persist `dcl`/`load`/`tti`/`ttfb` values of `0`
- [x] 1.3 Export `drainWebVitals(page, db, runId)` and reuse it in the 1s interval
- [x] 1.4 Call `drainWebVitals` from the CLI (`packages/cli/src/commands/run.ts`) after the last journey step's post-capture, before `context.close()`

## 2. Analyzer (`engine/src/analyzer/rules/slowLcp.ts`)

- [x] 2.1 Emit at most one `slow_lcp` issue per run, using the maximum-value `lcp` signal as evidence

## 3. Journey primitives

- [x] 3.1 `extract-and-click.ts`: remove the `Promise.race` with `waitForTimeout`; rely on `loc.click({ timeout })` rejection, keep `ok: false` mapping on catch
- [x] 3.2 `navigate.ts`: when `waitFor === "selector"` and `step.selector` is set, wait for the selector (`state: "visible"`, `timeout: step.timeoutMs`) after `load`; report absence as `timedOut`

## 4. Tests

- [x] 4.1 Extend `tests/unit/analyzer/slowLcp.test.ts`: multiple over-threshold `lcp` signals → exactly one issue with the max value
- [x] 4.2 Add `tests/unit/journey/navigate.test.ts`: `waitFor: "selector"` waits for the selector (stubbed page); missing selector within timeout → `timedOut: true`
- [x] 4.3 Add `tests/unit/journey/extractAndClick.test.ts`: rejecting click → `ok: false`; resolving click → `ok: true` (stubbed locator)
- [x] 4.4 Add `tests/unit/signals/webVitalsDrain.test.ts`: `drainWebVitals` flushes buffered entries to SQLite and clears the buffer (stubbed `page.evaluate`)

## 5. Validation

- [x] 5.1 `npm run test:unit` passes
- [x] 5.2 `npm run typecheck` passes
- [x] 5.3 `openspec validate fix-signal-capture-correctness --strict` passes
