## Why

A code review of the M0 engine found five correctness bugs in signal capture, the analyzer, and journey execution that make reports and scores wrong — not just incomplete:

- `slow_lcp` issues are duplicated: the LCP observer pushes an entry on every callback, and the `slowLcp` rule inserts one issue per signal over threshold, so a single slow page yields N identical issues and an inflated (worse) score.
- Navigation-timing signals (`dcl`, `load`, `tti`) are read once at document-start when they are still `0`, permanently recording garbage facts.
- Vitals captured in the last ≤1s of a run are silently dropped: the drain interval is cleared on page close with no final flush (often losing the final LCP/CLS of the last step).
- `extract_and_click` reports success when the click hangs: the race against `page.waitForTimeout` resolves instead of rejecting, so a click that never landed returns `ok: true`.
- `waitFor: "selector"` is accepted by the journey schema but silently does nothing — it maps to `"load"` and nothing ever waits for the selector.

## What Changes

- **Latest-wins buffering for cumulative vitals** (`webVitals.ts`): pending LCP and CLS entries replace earlier unflushed entries of the same type, so each drain writes at most one `lcp` and one `cls` signal.
- **Single `slow_lcp` issue per run** (`rules/slowLcp.ts`): the rule evaluates the maximum observed LCP and emits at most one issue, citing that signal as evidence (defense in depth against duplicates already stored by older runs).
- **Honest navigation timing** (`webVitals.ts`): `dcl`/`load`/`tti` are captured after the window `load` event, and zero-valued entries are never persisted.
- **Final vitals flush** (`webVitals.ts`, `signals/setup.ts`, CLI `run.ts`): the drain function is exported and invoked after the last journey step, before the page/context closes.
- **Correct click timeout semantics** (`primitives/extract-and-click.ts`): the click relies on Playwright's own timeout (which rejects); the resolving `waitForTimeout` race is removed.
- **Working `waitFor: "selector"`** (`primitives/navigate.ts`): after `load`, navigation waits for `step.selector` to appear; absence within `timeoutMs` is reported as a timeout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `signal-capture`: latest-wins buffering for cumulative vitals, non-zero navigation timing captured after `load`, and a final flush before page close.
- `friction-analysis`: `slow_lcp` emits at most one issue per run using the maximum observed LCP.
- `journey-execution`: `extract_and_click` reports click timeouts as failures; `waitFor: "selector"` actually waits for the selector.

## Impact

- **Affected code:** `engine/src/signals/webVitals.ts`, `engine/src/signals/setup.ts`, `engine/src/analyzer/rules/slowLcp.ts`, `engine/src/journey/primitives/extract-and-click.ts`, `engine/src/journey/primitives/navigate.ts`, `packages/cli/src/commands/run.ts` (one added drain call).
- **Behavior change:** reports may show fewer (correct) `slow_lcp` issues and slightly different scores; journeys using `waitFor: "selector"` now wait as documented; timed-out clicks now fail steps instead of silently passing.
- **Tests:** new/extended unit tests for the `slowLcp` rule, selector navigation waiting, click timeout semantics, and the vitals drain.
- **No schema, API, or artifact-format changes.** Existing run databases remain valid.
