## ADDED Requirements

### Requirement: extract_and_click reports click timeouts as failures
An `extract_and_click` step MUST return `ok: false` when the click does not complete within the step timeout. Playwright's own click timeout rejection MUST be the failure mechanism; no resolving timer may mask a hung click.

#### Scenario: Click completes within the timeout
- **WHEN** the resolved element's click succeeds before `timeoutMs` elapses
- **THEN** the step returns `ok: true` with the extracted href

#### Scenario: Click exceeds the timeout
- **WHEN** the click is still pending when `timeoutMs` elapses
- **THEN** the step returns `ok: false` with the extracted href, and the CLI records the step as failed or timed out

### Requirement: Selector-based navigation waiting
A navigate step with `waitFor: "selector"` MUST wait for `step.selector` to become visible after the `load` event, bounded by the step timeout. If the selector does not appear in time, the step MUST report a timeout. A `waitFor: "selector"` step without a selector MUST behave as `waitFor: "load"`.

#### Scenario: Selector appears after load
- **WHEN** a navigate step uses `waitFor: "selector"` and the selector becomes visible within `timeoutMs`
- **THEN** the step succeeds with the final URL

#### Scenario: Selector never appears
- **WHEN** a navigate step uses `waitFor: "selector"` and the selector is not visible within `timeoutMs`
- **THEN** the step result is `ok: false` with `timedOut: true`
