## ADDED Requirements

### Requirement: The system loads a default journey when none is specified
The system SHALL provide a default journey (home → search → product → cart → checkout) that is used automatically by `ft run` when the user does not pass `--journey`.

#### Scenario: Default journey used
- **WHEN** the user runs `ft run https://example.com` without a `--journey` flag
- **THEN** the system loads `engine/journeys/default-ecommerce.yaml` and executes it

#### Scenario: Custom journey override
- **WHEN** the user runs `ft run https://example.com --journey ./custom.yaml`
- **THEN** the system validates the custom journey and, if valid, uses it instead of the default

### Requirement: Journey YAML is validated against a schema before execution
The system MUST validate every journey YAML against the journey schema (defined in `engine/src/journey/schema.ts`) before the Worker begins execution. Invalid journeys MUST cause the run to be marked `error` and not start the browser.

#### Scenario: Schema validation passes
- **WHEN** a journey YAML passes schema validation
- **THEN** the Worker begins execution and the run is marked `queued` → `captured`

#### Scenario: Schema validation fails
- **WHEN** a journey YAML has a missing required field (e.g., a step without a `name`)
- **THEN** the run is marked `error` with `validation_error` in the warnings array, and the browser is never launched

### Requirement: Journey steps execute in declared order
The system MUST execute journey steps in the order declared in the YAML, capturing signals during each step.

#### Scenario: Sequential execution
- **WHEN** a journey declares steps `home`, `search`, `product`, `cart`, `checkout` in that order
- **THEN** the Worker executes them sequentially and writes signals tagged with the corresponding `step_id`

### Requirement: The Worker continues after non-fatal step failures
The system MUST continue executing remaining journey steps when an individual step fails, and MUST record the step's status (`ok`, `failed`, `timeout`, `skipped`) in the `steps` table.

#### Scenario: Step fails but journey continues
- **WHEN** the `search` step fails because the search input is not found
- **THEN** the step is recorded with `status='failed'`, the next step is attempted, and the run is marked `partial` if subsequent steps also fail

#### Scenario: Step times out
- **WHEN** a step exceeds its `timeoutMs` (default 10s)
- **THEN** the step is recorded with `status='timeout'` and execution moves to the next step

### Requirement: Step actions support common interaction primitives
The system MUST support the following action primitives in journey steps: `navigate`, `interact` (with `findSelector`, `type`, `click`, `scroll`, `pressEnter`, `optional`, `fallback`, `onError`), and `extract_and_click`.

#### Scenario: Click action with fallback selector
- **WHEN** a step action declares `findSelector: button[data-testid="add-to-cart"]` with `fallback: [button:has-text("Agregar")]`
- **THEN** the system tries the primary selector first and falls back to the alternatives in order until one resolves

#### Scenario: Optional action is skipped when not found
- **WHEN** a step action has `optional: true` and the selector does not resolve
- **THEN** the action is recorded as `skipped`, the step continues, and no error is raised

#### Scenario: Required action fails the step
- **WHEN** a step action without `optional: true` does not resolve a selector
- **THEN** the step is recorded with `status='failed'` and execution proceeds to the next step (the failure is captured, not raised)
