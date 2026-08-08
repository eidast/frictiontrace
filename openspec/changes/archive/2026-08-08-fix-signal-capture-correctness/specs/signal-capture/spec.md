## ADDED Requirements

### Requirement: Cumulative Web Vitals use latest-wins buffering
Pending (unflushed) buffer entries for cumulative metrics — `lcp` and `cls` — MUST be replaced by newer entries of the same type, so each drain flush writes at most one `lcp` and one `cls` signal carrying the latest observed value. Event-style metrics (`long_task`, `inp`) MUST keep append semantics.

#### Scenario: Multiple LCP callbacks within one drain interval
- **WHEN** the LCP observer fires 3 times between flushes with values 1200, 2400, and 3100 ms
- **THEN** exactly one `lcp` signal is written, with value 3100 ms

#### Scenario: Distinct long tasks are all captured
- **WHEN** two long tasks of 80 ms and 120 ms occur between flushes
- **THEN** two `long_task` signals are written, one per task

### Requirement: Navigation timing signals are complete and non-zero
The system MUST NOT persist `dcl`, `load`, `tti`, or `ttfb` signals with a value of `0`. Navigation timing MUST be (re)captured when the window `load` event fires, or immediately if the document is already complete.

#### Scenario: Init script runs at document-start
- **WHEN** the capture script initializes before `DOMContentLoaded` and the navigation timing fields are still `0`
- **THEN** no `dcl`, `load`, or `tti` signal with value `0` is written

#### Scenario: Timing captured after load
- **WHEN** the window `load` event fires
- **THEN** `dcl`, `load`, and `tti` signals are written with their final, non-zero values

### Requirement: Pending vitals are flushed before the page closes
The system MUST expose a drain operation and invoke it after the last journey step, before the page/context closes, so vitals captured since the previous interval flush are persisted.

#### Scenario: LCP fires shortly before journey end
- **WHEN** an LCP entry is buffered less than one drain interval before the journey finishes
- **THEN** the final flush writes it to the database before the page is closed
