# cli Specification

## Purpose
TBD - created by archiving change frictiontrace-m0. Update Purpose after archive.
## Requirements
### Requirement: `ft run` executes an audit and returns a run identifier
The system SHALL provide an `ft run <url>` command that, given a target e-commerce URL, executes the default journey against that URL and returns the run identifier and a path to the local HTML report upon success.

#### Scenario: Successful run
- **WHEN** the user runs `ft run https://example.com`
- **THEN** the system creates a run record, executes the default journey, and prints the runId and the path to `report.html` on stdout before exiting 0

#### Scenario: Invalid URL
- **WHEN** the user runs `ft run not-a-url`
- **THEN** the system prints a validation error to stderr and exits with code 2 without creating a run record

#### Scenario: Site unreachable
- **WHEN** the target URL does not respond within the configured timeout
- **THEN** the system marks the run as `partial`, emits a `site_unreachable` warning, and exits with code 1

### Requirement: `ft validate` checks a journey YAML
The system SHALL provide an `ft validate <path-to-yaml>` command that validates a journey YAML file against the journey schema and reports any errors.

#### Scenario: Valid journey
- **WHEN** the user runs `ft validate ./my-journey.yaml` against a schema-conformant file
- **THEN** the system prints `OK: <path>` to stdout and exits 0

#### Scenario: Invalid journey
- **WHEN** the user runs `ft validate ./bad.yaml` against a file with a missing required field
- **THEN** the system prints a list of validation errors to stderr and exits with code 2

### Requirement: `ft replay` opens artifacts for a previous run
The system SHALL provide an `ft replay <runId>` command that locates the artifacts directory for a previous run and opens the local HTML report in the user's default browser.

#### Scenario: Replay existing run
- **WHEN** the user runs `ft replay <runId>` and the run exists locally
- **THEN** the system opens `report.html` for that run in the default browser and exits 0

#### Scenario: Replay missing run
- **WHEN** the user runs `ft replay <runId>` and no run with that identifier exists locally
- **THEN** the system prints a "run not found" error to stderr and exits with code 2

### Requirement: Progress output goes to stderr
The system SHALL write all human-readable progress and logging output to stderr so that stdout remains parseable for scripting.

#### Scenario: Piped output
- **WHEN** the user runs `ft run https://example.com > run.json`
- **THEN** stdout contains only the final JSON summary (runId, status, report path) and all progress logs go to stderr

### Requirement: Exit codes reflect run outcome
The system SHALL use exit codes to communicate outcome: `0` for success, `1` for partial success (run completed but with warnings), `2` for invalid input, and non-zero for engine errors.

#### Scenario: Success exit
- **WHEN** a run completes without warnings
- **THEN** the CLI exits with code 0

#### Scenario: Partial exit
- **WHEN** a run completes but with at least one step failure or warning
- **THEN** the CLI exits with code 1

#### Scenario: Engine error exit
- **WHEN** the engine itself fails (e.g., browser cannot start, disk full)
- **THEN** the CLI exits with a non-zero code distinct from 1 and 2

