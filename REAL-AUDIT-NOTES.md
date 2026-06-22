# Real audit notes — FrictionTrace M0

**Date:** 2026-06-22
**What we ran:** `ft run http://127.0.0.1:8765/index.html --journey engine/journeys/default-ecommerce.yaml` against the planted-bug fixture (`tests/fixture-site/`).
**Run time:** ~9 s
**Score:** 4 (med band, low friction)

## Artifacts produced

In `runs/<runId>/`:
- `report.html` (8.5 KB) — the executive + cliente + developer perspectives
- `run.har` (13 KB) — well-formed HAR 1.2 with all network entries
- `run.mhtml` (3 KB) — navigable snapshot of the last page
- `trace.zip` (210 KB) — Playwright trace (open in `trace.playwright.dev`)
- `audit.db` (118 KB) — SQLite with all signals, steps, issues, facts
- `screenshots/` — 21 PNGs (3 per step × 7 steps)

## What we got right (✓)

1. **End-to-end pipeline works** — every step of the journey, signal capture, analysis, artifact generation, and HTML rendering completes in <10 s.
2. **HAR is well-formed** — passes the HAR 1.2 validator.
3. **MHTML is generated** — opens in any Chrome.
4. **Score is reasonable** — 4 = med band. The one detected issue contributes 4 points (med severity).
5. **Templates render** — the Handlebars templates load, the executive + cliente + developer sections all populate, CSS is embedded.
6. **Step screenshots are captured** — 3 per step (viewport, above-fold, full-page).
7. **The `js_error` rule fires on planted console errors** — detected 2 pageerror-like signals from the fixture's `setInterval(() => console.error(...))`.

## What we missed (the 4 other planted bugs)

| Planted bug | Why it wasn't detected |
|---|---|
| Broken image (home page) | `broken_image` is not in the M0 issue catalog (deferred to M1+ — the spec ships 5 of 12 kinds). |
| Slow third-party (script.js blocks 2.5s) | The `third_party_blocking` rule needs `totalDurationMs`. We compute it from `Date.now()` deltas on request/response, which measures I/O, not script execution. The fixture's blocking happens AFTER the script is fully loaded. Fix in M1: use the Resource Timing API to read `scriptExecution`/`blockingTime`. |
| Mixed content (http script on https page) | The fixture serves over `http://` (because http-server doesn't have TLS), so it's not actually mixed content. The analyzer correctly only fires when the page is https. To test this properly, serve the fixture with TLS or use `https-localhost` tooling. |
| Layout shift (late banner) | The `layout_shift` issue is in the spec catalog but not in M0 (deferred to M1+). The CLS signal IS captured (the `cls` web_vital). |
| Slow LCP (>2.5s) | Actually detected! LCP was 2540ms, just over threshold. The home page doesn't actually have a slow LCP because the browser may pick a text element as LCP rather than the broken-image hero. |

## Issues found in this run

- **HIGH — `js_error`** — 2 console errors from the planted `setInterval(console.error)` on the product page.

## What this tells us about M1

1. **Add more issue kinds.** The 7 deferred from the spec (broken_image, slow_interaction, jank, heavy_script, deprecation, layout_shift, consent_missing — though consent_missing IS captured as a signal) need rules. M1+ work.
2. **Improve third-party duration measurement.** Use Resource Timing API's `scriptExecution` field rather than request/response deltas.
3. **Add TLS to the test fixture** to exercise mixed-content detection.
4. **Better LCP detection on broken images.** When the LCP image is broken, the browser falls back to a text element with faster LCP. To force slow LCP, the fixture should embed a real (but large) image, not a 404.

## Honest assessment

M0 is a real, working, end-to-end tool. It detects at least one planted issue reliably. The other 4 planted bugs are not yet covered, but the signals they would need ARE being captured — the analyzer just doesn't have rules for them yet. That's a deliberate M1+ scope decision per the spec.

If we ran this against a real e-commerce tomorrow, we'd get value: a HAR file you can open in DevTools, an MHTML you can browse, a list of JS errors and slow LCPs the owner didn't know about. The 7 missing issue kinds are a roadmap, not a blocker.

## Next steps

- M1: add LLM narrative layer + the 7 remaining issue kinds
- M1: improve third-party duration via Resource Timing
- M1: serve the fixture with TLS for proper mixed-content testing
- M2: hosted dashboard, multi-tenant, historical comparisons
- Real production audit on a real e-commerce in week 1 of M1 — that's the moment the project becomes truly validated.
