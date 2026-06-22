## ADDED Requirements

### Requirement: The analyzer emits a `js_error` issue for uncaught exceptions
The analyzer MUST emit an issue of kind `js_error` whenever one or more `pageerror` signals are present in the run, with severity `critical` if the error occurred on the checkout path (URL matching `/checkout*` or `/cart*`) and `high` otherwise. The issue's `evidence` array MUST reference all `pageerror` signal IDs.

#### Scenario: Console error on homepage
- **WHEN** the run contains a `pageerror` signal whose URL is the homepage
- **THEN** the analyzer emits one `js_error` issue with severity `high` and the error's signal_id in `evidence`

#### Scenario: Console error on checkout
- **WHEN** the run contains a `pageerror` signal whose URL matches `/checkout`
- **THEN** the analyzer emits one `js_error` issue with severity `critical` and the error's signal_id in `evidence`

### Requirement: The analyzer emits a `third_party_blocking` issue for slow third-party calls
The analyzer MUST emit an issue of kind `third_party_blocking` whenever a third-party domain's total latency on a critical path step exceeds 1500ms. The issue's `evidence` array MUST reference the `third_party_domain` signal ID and the underlying network signal IDs.

#### Scenario: Slow analytics vendor
- **WHEN** a third-party domain accumulates more than 1500ms of latency on the `home` step
- **THEN** the analyzer emits one `third_party_blocking` issue with severity `high` and the relevant signal IDs in `evidence`

### Requirement: The analyzer emits a `slow_lcp` issue for poor LCP
The analyzer MUST emit an issue of kind `slow_lcp` whenever a page's LCP exceeds 2500ms, with severity scaling with magnitude: `med` for 2500–4000ms, `high` for 4000–6000ms, `critical` for > 6000ms.

#### Scenario: LCP within threshold
- **WHEN** the home page's LCP is 1800ms
- **THEN** the analyzer does not emit a `slow_lcp` issue

#### Scenario: LCP above threshold
- **WHEN** the home page's LCP is 5000ms
- **THEN** the analyzer emits one `slow_lcp` issue with severity `high` and the `lcp` signal ID in `evidence`

### Requirement: The analyzer emits a `mixed_content` issue
The analyzer MUST emit an issue of kind `mixed_content` whenever any `mixed_content` signal is present. The issue's `evidence` array MUST reference all `mixed_content` signal IDs.

#### Scenario: Mixed content detected
- **WHEN** the run contains a `mixed_content` signal
- **THEN** the analyzer emits one `mixed_content` issue with severity `med` and the signal ID in `evidence`

### Requirement: The analyzer emits a `checkout_broken` issue for failed checkout requests
The analyzer MUST emit an issue of kind `checkout_broken` whenever a network signal with status ≥ 500 or `failed: true` is present on a URL matching `/checkout*` or `/cart*`. The issue's `evidence` array MUST reference the failed network signal IDs.

#### Scenario: Checkout API returns 500
- **WHEN** a request to `https://shop.example.com/api/checkout` returns status 500
- **THEN** the analyzer emits one `checkout_broken` issue with severity `critical` and the network signal ID in `evidence`

### Requirement: Every issue cites at least one signal as evidence
The analyzer MUST attach to every issue an `evidence` array containing at least one signal_id. An issue with empty evidence MUST NOT be persisted.

#### Scenario: Issue with evidence
- **WHEN** the analyzer emits any issue
- **THEN** the issue's `evidence` JSON array contains one or more signal IDs that exist in the run's `signals` table

### Requirement: The analyzer emits structured facts
The analyzer MUST emit facts as key-value pairs derived from signals, used by the template layer. M0 facts include: `home.lcp_ms`, `home.cls`, `home.third_party_count`, `home.third_party_total_ms`, `cart.checkout_failures`, and one fact per detected issue kind (e.g., `issues.js_error_count`).

#### Scenario: Facts derived from signals
- **WHEN** the analyzer processes a run
- **THEN** it writes a `facts` row for each known key with a non-null value derived from the corresponding signals

#### Scenario: Missing fact is not emitted
- **WHEN** the run has no LCP signal (e.g., the page never reached LCP)
- **THEN** the analyzer does not write a `home.lcp_ms` fact
