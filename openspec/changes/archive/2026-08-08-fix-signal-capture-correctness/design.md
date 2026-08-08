# Design — fix-signal-capture-correctness

## Context

Five correctness bugs were found in M0 code (see proposal). They are independent but share a theme: captured data and step outcomes don't match reality, so downstream facts, issues, and scores are wrong. All fixes are local to one function each; no interfaces change except one added export.

## Decisions

### D1: Deduplicate cumulative vitals in the page buffer, not at insert time

LCP and CLS observers fire repeatedly with *updated values of the same metric* (LCP: latest candidate; CLS: running cumulative total). Pushing every callback into `window.__ftVitals__` and draining them all into SQLite stores N rows for one measurement.

**Choice:** make the in-page `push` latest-wins for `lcp` and `cls` — a new entry replaces any unflushed entry of the same type. Event-style metrics (`long_task`, `inp`) keep append semantics because each entry is a distinct event.

*Alternative considered:* dedupe in the drain loop or with SQL. Rejected — it still ships redundant data across the evaluate boundary and leaves the rule fragile.

### D2: `slowLcp` rule collapses to a single issue using max LCP

Databases written by older versions may already contain duplicate `lcp` signals, and multiple navigations legitimately produce several LCP values. The rule picks the maximum-value LCP signal and emits at most one `slow_lcp` issue per run, citing that signal as evidence. This matches the M0 report model (one score, top-N issues per run) and keeps the change minimal.

*Alternative considered:* one issue per page URL. Rejected for M0 — the report has no per-page grouping and it would complicate severity/score semantics.

### D3: Navigation timing captured on `load`, zeros never persisted

`PerformanceNavigationTiming` fields `domContentLoadedEventEnd`, `loadEventEnd`, and `domInteractive` are `0` until their events fire; `typeof 0 === "number"` passed the old guard. The init script now (a) only pushes values `> 0`, and (b) re-reads navigation timing when the window `load` event fires (immediately if the document is already complete). `ttfb` (`responseStart`) is available early and keeps its existing behavior, guarded the same way.

### D4: Final drain is explicit, not on `page.on("close")`

A Playwright page that emitted `close` can no longer be `evaluate`d, so flushing from the close handler is impossible. `drainWebVitals(page, db, runId)` is exported; the CLI calls it once after the last journey step's post-capture, before `context.close()`. The 1s interval stays for long journeys.

### D5: Click timeout uses Playwright's own rejection

`loc.click({ timeout })` already rejects on timeout. The bug came from racing it against `page.waitForTimeout`, which *resolves*. The race is deleted; the surrounding try/catch already maps rejection to `ok: false`.

### D6: `waitFor: "selector"` = `load` + `waitForSelector`

Playwright has no selector-based `waitUntil`, so navigation proceeds with `"load"` and then waits for `step.selector` (`state: "visible"`, step timeout). If the step has no selector, it behaves as `"load"`. Selector timeout is reported as `timedOut: true` so the CLI records a `timeout` step status, consistent with navigation timeouts.

## Risks

- **Score changes on re-runs:** fewer duplicate `slow_lcp` issues → less severity weight → higher scores. This is the intended correction.
- **`waitFor: "selector"` journeys get slower/stricter:** they now actually wait. Journeys that accidentally relied on the no-op may start timing out — visible as `timeout` step status, not silent corruption.
- **Final drain timing:** LCP entries still pending in the browser at journey end are only flushed if the observer delivered them to `window.__ftVitals__` by then; Chromium may hold the last LCP until page hide. Accepted — no reliable headless alternative in M0.
