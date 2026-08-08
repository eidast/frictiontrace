## ADDED Requirements

### Requirement: The system captures Web Vitals and performance metrics
The system MUST capture the following metrics during the journey: LCP, INP (or FID as fallback), CLS, TTFB, FCP, TTI, long tasks (>50ms), JS heap size, and average frame rate. Each metric MUST be persisted as a signal with `category='web_vitals'`.

#### Scenario: LCP captured
- **WHEN** a page loads and the Largest Contentful Paint fires
- **THEN** a signal of type `lcp` is written to the database with the value in milliseconds and the URL where it occurred

#### Scenario: Long task captured
- **WHEN** a task on the main thread exceeds 50ms
- **THEN** a signal of type `long_task` is written with the duration in milliseconds and the source attribution if available

### Requirement: The system captures console messages
The system MUST capture every `console.log`, `console.info`, `console.warn`, `console.error`, and `console.debug` call, plus uncaught `pageerror` events, as signals with `category='console'`.

#### Scenario: console.error captured
- **WHEN** the page calls `console.error("foo")`
- **THEN** a signal of type `console_error` is written with the message, stack (if available), and timestamp

#### Scenario: Uncaught exception captured
- **WHEN** an uncaught exception occurs during the journey
- **THEN** a signal of type `pageerror` is written with the message, stack, file:line:col, and the URL where it occurred

### Requirement: The system captures network activity
The system MUST capture every network request issued during the journey, including URL, method, status, resource type, transfer size, encoded body size, decoded body size, per-phase timing (DNS, TCP, TLS, TTFB, download), cache hit/miss, and redirect chain. Each request MUST be persisted as a signal with `category='network'`.

#### Scenario: Successful request captured
- **WHEN** a request to `https://cdn.example.com/app.js` returns 200 with a 320KB body
- **THEN** a signal is written with the URL, status 200, resource type `script`, transfer size, and per-phase timings

#### Scenario: Failed request captured
- **WHEN** a request to `https://api.example.com/checkout` returns 500
- **THEN** a signal is written with status 500, the request URL, and a `failed: true` flag

### Requirement: The system captures DOM and UX signals
The system MUST capture the following DOM-level signals: broken images (where `naturalWidth === 0` after `load`), forms without accessible labels, failed iframes, broken autofocus, and detected scroll jank. Each MUST be persisted as a signal with `category='dom_ux'`.

#### Scenario: Broken image detected
- **WHEN** an `<img>` element fires its `error` event or has `naturalWidth === 0` after `load`
- **THEN** a signal of type `broken_image` is written with the `src` URL

### Requirement: The system captures page lifecycle events
The system MUST capture the timings of `DOMContentLoaded`, `load`, and `networkidle`, the number of redirects, and the final URL after redirects, as signals with `category='lifecycle'`.

#### Scenario: Redirect chain captured
- **WHEN** the target URL redirects 2 times before settling
- **THEN** a signal of type `redirect_chain` is written with the chain of URLs and the final URL

### Requirement: The system captures storage and consent signals
The system MUST capture the count and approximate total size of cookies, the count of `localStorage` and `sessionStorage` writes, the presence of a Consent Management Platform (CMP) banner (detected by a configurable selector list), and the count of third-party cookies. Each MUST be persisted as a signal with `category='storage_consent'`.

#### Scenario: No consent banner detected
- **WHEN** the page sets cookies but no element matching the CMP selector list is found
- **THEN** a signal of type `consent_missing` is written with the cookie count

#### Scenario: Consent banner present
- **WHEN** an element matching the CMP selector list is visible
- **THEN** a signal of type `consent_banner_present` is written with the matched selector

### Requirement: The system captures security signals
The system MUST capture mixed content (an `http://` resource loaded on an `https://` page), forms with an action attribute pointing to an `http://` URL, password fields without safe `autocomplete` attributes, and any detected use of deprecated browser APIs. Each MUST be persisted as a signal with `category='security'`.

#### Scenario: Mixed content detected
- **WHEN** an `http://` script is requested on an `https://` page
- **THEN** a signal of type `mixed_content` is written with the resource URL and the page URL

### Requirement: The system captures the third-party inventory
The system MUST, after the run, compute a per-domain third-party inventory that lists each non-first-party domain touched during the journey along with its category (analytics, ads, payments, chat, CDN, tag-manager, marketing, other), total bytes transferred, total latency, and failure count. Each entry MUST be persisted as a signal with `category='third_party'`.

#### Scenario: Tag manager detected
- **WHEN** requests to `https://www.googletagmanager.com/gtm.js` occur
- **THEN** a signal of type `third_party_domain` is written with `domain='googletagmanager.com'`, `category='tag_manager'`, total bytes, and total latency

### Requirement: The system captures journey evidence
The system MUST capture three screenshots per step (viewport, above-the-fold, full-page) and persist them to the filesystem. Each screenshot MUST have a corresponding `screenshots` row referencing the run, step, kind, and file path. The system MUST also record the duration of each step and the success/failure status.

#### Scenario: Step screenshots captured
- **WHEN** a step completes
- **THEN** three screenshot files are written under `./runs/<runId>/screenshots/<step-name>-{viewport,above-fold,full}.png` and three rows are inserted into the `screenshots` table

#### Scenario: Step duration recorded
- **WHEN** a step completes
- **THEN** the `steps` row for that step has a non-null `finished_at` and the duration is computable from `started_at` and `finished_at`
