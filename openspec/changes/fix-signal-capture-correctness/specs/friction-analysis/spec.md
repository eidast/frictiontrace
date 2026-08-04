## ADDED Requirements

### Requirement: The slow_lcp rule emits at most one issue per run
The `slow_lcp` rule MUST evaluate all `lcp` signals for the run, select the maximum observed value, and emit at most one `slow_lcp` issue, citing the signal with that maximum value as evidence. Runs whose LCP signals are all at or below the threshold MUST produce no issue.

#### Scenario: Multiple over-threshold LCP signals
- **WHEN** the run contains three `lcp` signals with values 2600, 5100, and 3400 ms (threshold 2500 ms)
- **THEN** exactly one `slow_lcp` issue is created, its summary reports 5100 ms, and its evidence references the 5100 ms signal

#### Scenario: No over-threshold LCP signal
- **WHEN** all `lcp` signals in the run are at or below 2500 ms
- **THEN** no `slow_lcp` issue is created
