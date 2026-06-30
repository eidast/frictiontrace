# FrictionTrace Audit Context — walmart.com.gt

> **Compiled:** 2026-06-22
> **Purpose:** Complete context for AI analysis and insight generation
> **Sources:** Playwright CLI headless run + Chrome real-browser HAR (2 products)
> **Target:** https://www.walmart.com.gt
> **Platform:** VTEX (checkout-ui v6.147.4, vtex.js v2.13.1)

---

## Project: FrictionTrace M0

Open-core CLI that runs a real browser against e-commerce sites, captures structured signals, and produces friction reports. M0 ships 5 issue kinds: `js_error`, `third_party_blocking`, `slow_lcp`, `mixed_content`, `checkout_broken`. This audit extends beyond M0's scope — it's a real production validation against walmart.com.gt using both automated headless browsing and a human HAR export.

---

## Journey Executed

### Headless CLI (automated, 1 product)
1. Homepage (`/`)
2. Dismiss location modal (select Guatemala → Zona 17)
3. Navigate to `arroz-suli-blanco-1700gr/p` (bypass search due to ERR_ABORTED on search navigation)
4. Click "Agregar" button
5. Navigate to `/checkout/#/cart`

### Human Browser (HAR file, 2 products)
Timeline reconstructed from HAR entries:
1. `02:38:18` — Homepage (onLoad: 2164ms, DOM: 317ms)
2. `02:38:41` — Search "arroz sushi", added **Arroz Sasson Sushi Gourmet 454g** (Q20.00)
3. `02:39:41` — Category nav, added **Arroz Suli Blanco 1700g** (Q15.50)
4. `02:39:51` — Entered checkout (`/checkout/#/cart`, onLoad: 3173ms)
5. `02:40:36` — Set shippingData (changed from Express to Scheduled)
6. `02:40:42` — Loaded VTEX card-ui iframes (credit + debit payment groups)
7. `02:40:57` — Switched payment method multiple times
8. Stopped before "Comprar ahora"

---

## HAR Comparison

| Metric | CLI Headless | Human Browser |
|---|---|---|
| HAR size | 7.8 MB | 95.8 MB |
| Total entries | 2,144 | 3,063 |
| Tracked pages | 1 | 2 |
| Unique domains | 84 | 91 |
| Third-party domains | 83 | 90 |
| Total transferred | ~14 MB | ~8 MB |
| 4xx/5xx errors | 18 | 100 |
| Failed requests (status 0) | 0 | 48 |
| 2xx responses | 1,890 | 2,550 |
| 3xx redirects | 167 | 356 |
| Products in cart | 1 | 2 |
| Journey depth | Cart only | Full checkout (profile → shipping → payment) |

---

## Issues Catalog

### CRITICAL

**C1 — `orderForm 400`**
Endpoint: `GET /api/checkout/pub/orderForm/default-order-form`
Status: 400 Bad Request
Frequency: 10x CLI, 12x human
Description: Cart initialization endpoint fails on every page. System retries without success.
Impact: Broken session initialization, potential cart corruption.
First seen: Homepage; persists through all pages.

**C2 — `ageapproval` DELETE loop**
Endpoint: `DELETE .../customData/ageapproval/ageVerified` + `birthDate`
Frequency: 22x CLI (11 pairs), 32x human (16 pairs)
Description: Redundant DELETE calls scale linearly with cart items. No exit condition.
Impact: Wasted server load, slower checkout.
Note: Products are rice — no age verification should be needed.

**C3 — CSS plugins MIME error**
URLs: `walmartgt.vteximg.com.br/arquivos/plugins-reset.min.css`, `plugins-common.min.css`
Status: `net::ERR_ABORTED` (status 0 in HAR)
Frequency: 4x CLI, 8x human
Description: Server returns empty Content-Type. Chrome rejects with strict MIME checking.
Impact: Checkout forms render without proper VTEX reset/common styles.

**C4 — Cookiebot placeholder template**
ID: `{123e4567-f89a-bced-def0-1234567890ab}` (literal template string, never replaced)
Frequency: 7x CLI, 9x human
Description: Cookiebot CMP configured with documentation placeholder ID instead of real domain ID.
Console warning: "The domain WWW.WALMART.COM.GT is not authorized to show the cookie banner"
Impact: Non-functional consent management, possible legal liability.

**C5 — Google Maps API key exposed**
Key: `AIzaSyBkfKiZpVlezmcE1ywp8T3XYTh9HyuDS5o`
Frequency: 8x per session
Description: Hardcoded in frontend bundle. No HTTP referrer restriction.
Impact: API key abuse potential, cost exposure.

### HIGH

**H1 — `getCustomLastOrderId` 400**
Frequency: 24x (human only, not in CLI)
Description: Personalization endpoint returns 400 when user has no order history instead of empty response.
Impact: Broken personalization, 24 wasted requests per checkout.

**H2 — `getPromos` 400**
Endpoint: `GET /getPromos/promos-payment-checkout`
Frequency: 8x (human only)
Impact: Payment method promotions never displayed.

**H3 — GTM `slice` TypeError**
Location: `googletagmanager.com/gtm.js?id=GTM-5CJG27W:1019`
Error: `TypeError: Cannot read properties of undefined (reading 'slice')`
Trigger: Search page only
Impact: Broken analytics for search events. Team cannot track search behavior.

**H4 — TikTok Pixel unconfigured**
Frequency: 93 requests per session
Warning: "TikTok Pixel (TBP) is disabled - no valid Pixel ID configured"
Impact: Wasteful script loading. If TikTok Ads are running, conversion tracking is broken.

**H5 — Meta Pixel version conflict**
Warning: "Multiple pixels with conflicting versions were detected"
Impact: Duplicate/incorrect conversion events. Broken remarketing audiences.

**H6 — Shared Storage attestation fails**
Frequency: 30+ errors
Error: "Attestation check for Shared Storage on googleadservices.com failed"
Description: Chrome Privacy Sandbox API conflict with Google Ad Manager.
Impact: Console noise, potential ad revenue measurement issues.

**H7 — reCAPTCHA webworker broken**
URL: `google.com/recaptcha/enterprise/webworker.js`
Status: 0 (failed to load)
Frequency: 2x (in checkout card-ui iframes)
Impact: reCAPTCHA may not function in payment iframes.

**H8 — shippingData POST failure**
Endpoint: `POST .../attachments/shippingData`
Status: 0 (ERR_ABORTED)
Frequency: 1x
Context: Occurred when user switched from Express (out of coverage) to Scheduled delivery.
Impact: Shipping method change may leave inconsistent state.

### MEDIUM

**M1 — Search page performance**
FCP: 9,472ms | DOMContentLoaded: 8,909ms | LoadComplete: 27,185ms | TTFB: 49ms
Console errors: 52
Impact: Search is unusably slow. High abandonment risk.

**M2 — Checkout resource bloat**
Resources: 250 (CLI) / ~600 (human) | Scripts: 130 | Total transfer: 8-14 MB
Impact: Heavy page weight, especially on mobile/3G.

**M3 — Third-party overhead — 90 domains**
See full inventory below. Cookie syncs block main thread 3-7s.

**M4 — favicon 404**
Impact: Minor brand perception issue.

**M5 — Location modal UX**
Full-screen modal with disabled "Aceptar" button blocks all navigation.
Requires selecting Department AND Municipality before browsing.
Impact: First-visit abandonment.

**M6 — Payment methods hidden**
Cash-on-delivery (dominant in Guatemala) requires scroll to discover.
Default view shows only credit/debit card.

**M7 — "Express out of coverage" message persists**
Warning remains visible after switching to Scheduled delivery.
Console: `deliverySelected with scheduledSLA and no delivery window`

**M8 — Google Maps loaded without `loading=async`**
Impact: Suboptimal map loading performance.

**M9 — VTEX render-runtime race condition**
Warning: `prefetchDefaultPages should only be called before RenderProvider's render`
Impact: Potential slower SPA navigation between routes.

**M10 — CSP violations in card-ui iframes**
Dozens of report-only CSP violations in VTEX Payment iframes.
Malformed directive: `content-security-policy-report-only:` (trailing colon).
Fonts.googleapis.com, cdnfonts.com, and local CSS blocked by style-src.

---

## Third-Party Domain Inventory

### Ads / RTB / DMP (25 domains)
```
doubleclick.net         — Google Ad Manager
googlesyndication.com   — Ad iframes (safeframe)
criteo.com              — Retargeting
criteo.net              — Creative delivery
pinterest.com           — Social ads
tiktok.com              — Social ads (93 calls, unconfigured)
tiktokw.us              — TikTok analytics
facebook.net            — Meta Pixel (version conflict)
facebook.com            — Meta events
openx.net               — Ad exchange
taboola.com             — Native ads
outbrain.com            — Native ads
mgid.com                — Native ads
smartadserver.com       — Ad server
360yield.com            — Ad exchange
bidswitch.net           — Ad exchange
socdm.com               — DMP (Japan market)
clmbtech.com            — DMP sync
e-planning.net          — Ad server
groovinads.com          — Ad network
creativecdn.com         — Creative CDN
ad-stir.com             — Ad exchange (Japan)
toast.com               — DMP sync (cm-exchange)
nhnace.com              — DMP sync
gssprt.jp               — DMP sync
demdex.net              — Adobe Audience Manager
```

### Analytics / Tag Management (4)
```
googletagmanager.com     — GTM container
google-analytics.com     — GA4
google.com (g/collect)   — GA4 protocol
vtexassets.com (adobe)   — Adobe Client Data Layer
```

### VTEX Infrastructure (8)
```
io2.vtex.com             — Checkout scripts CDN
vtexassets.com           — NPM assets CDN
vteximg.com.br           — Image CDN (CloudFront)
vtex.com.br              — IO runtime
vtexpayments.com.br      — Payment iframes (card-ui)
myvtex.com               — Legacy extensions
vtexcommercestable.com.br — Commerce APIs
rc.vtex.com              — Request capture
```

### Consent / Maps / Other
```
cookiebot.com            — CMP (broken)
cookiebotcdn.com         — CMP CDN
maps.googleapis.com      — Google Maps (key exposed)
google.com/recaptcha     — reCAPTCHA enterprise
syndigo.com              — Product content syndication
flixcar.com              — Product media
cdnjs.cloudflare.com     — Slick carousel
fonts.googleapis.com     — Google Fonts
fonts.gstatic.com        — Google Fonts CDN
gstatic.com              — Google static
docs.google.com          — Config spreadsheet (CSV)
```

---

## VTEX Endpoint Analysis

### By frequency (human session, complete)
```
82x  POST /_v/private/graphql/v1
78x  GET  /api/sessions
48x  GET  /_v/segment/graphql/v1
42x  POST /_v/segment/graphql/v1
29x  POST /api/v2/pixel            (TikTok)
21x  POST /api/v2/pixel/act        (TikTok)
20x  GET  /_v/fbe/pixel            (Facebook)
19x  POST /api/v2/pixel/inter      (TikTok)
18x  GET  /api/checkout/pub/regions
17x  GET  /_v/public/graphql/v1
16x  DELETE .../ageapproval/ageVerified   ← REDUNDANT
16x  DELETE .../ageapproval/birthDate     ← REDUNDANT
12x  GET  /api/checkout/pub/orderForm/{id}
12x  GET  /api/checkout/pub/orderForm/default-order-form  ← 400
10x  POST /api/checkout/pub/orderForms/simulation
10x  POST /api/activity-flow/web-vitals
24x  GET  /getCustomLastOrderId     ← 400 (human only)
 8x  GET  /getPromos/promos-payment-checkout  ← 400 (human only)
```

### Slowest VTEX endpoints (>500ms, all segment/graphql)
```
1471ms, 1417ms, 1284ms, 1129ms, 971ms, 942ms, 938ms,
913ms, 891ms, 878ms, 851ms, 826ms, 819ms, 796ms, 777ms
```

---

## Performance Metrics by Page

### Homepage (`/`) — Human
- onLoad: 2,164ms
- DOMContentLoaded: 317ms
- TTFB: ~50ms

### Search (`/arroz%20suli`) — CLI
- FCP: 9,472ms
- DOMContentLoaded: 8,909ms
- LoadComplete: 27,185ms
- TTFB: 49ms
- CLS: 0
- Console errors: 52

### Product (`/arroz-suli-blanco-1700gr/p`) — CLI
- FCP: ~2,000ms (est.)
- Console errors: 5

### Checkout (`/checkout/#/cart`) — CLI
- onLoad: 35,135ms
- DOMContentLoaded: 31,815ms
- Resources: 250
- Scripts: 130
- Total transfer: ~14 MB

### Checkout (`/checkout/`) — Human
- onLoad: 3,173ms
- DOMContentLoaded: 1,845ms
- Total transfer: ~8 MB

### Slowest requests (top 10, both HARs)
```
6,595ms  smartadserver.com      RTB cookie sync
3,570ms  toast.com              DMP pixel
3,144ms  socdm.com              RTB cookie sync
2,970ms  criteo.com             Creative fetch
2,738ms  io.vtex.com.br         Polyfill script
2,736ms  taboola.com            RTB cookie sync
2,710ms  flixcar.com            Product media log
2,673ms  clmbtech.com           DMP sync
2,665ms  360yield.com           RTB cookie sync
2,608ms  bidswitch.net          RTB cookie sync
```

---

## Security Findings

1. **Google Maps API key** (`AIzaSyBkfKiZpVlezmcE1ywp8T3XYTh9HyuDS5o`) — hardcoded, no referrer restriction
2. **reCAPTCHA enterprise key** (`6LdV7CIpAAAAAPUrHXWlFArQ5hSiNQJk6Ja-vcYM`) — visible in client bundle
3. **CSP malformed in VTEX card-ui iframes** — directive `content-security-policy-report-only:` has trailing colon
4. **Dozens of CSP report-only violations** — fonts.googleapis.com, cdnfonts.com, local CSS blocked
5. **No mixed content detected** — all HTTPS
6. **Cookiebot consent non-functional** — legal compliance risk

---

## UX Friction Points

1. Full-screen location modal with disabled "Aceptar" blocks first-time visitors from browsing
2. "Express delivery unavailable" message persists after switching methods
3. Cash payment option hidden below scroll fold; default view implies card-only
4. Phone field rejects non-Guatemala formats despite international code selector
5. Search takes 9.5s to first paint
6. No favicon (404)
7. "Agregar" button provides no visual feedback when clicked

---

## Data Sources

### Files in this repo
- `walmart-checkout.har` (7.8 MB) — CLI headless HAR
- `www.walmart.com.gt-2productos.har` (95.8 MB) — Human browser HAR
- `walmart-network-requests.txt` — CLI network dump
- `walmart-console-errors.txt` — CLI console dump
- `scripts/capture-har.cjs` — HAR capture script
- `scripts/compare-har.cjs` — HAR comparison script
- `reports/audit-executive.md` — Non-technical executive report
- `reports/audit-summary.md` — Semi-technical summary
- `reports/audit-detailed.md` — Full technical report

### Human HAR details
- Browser: Chrome 148 on macOS
- Viewport: ~1280x720 (reconstructed from requests)
- Auth state: Logged in (session cookies present)
- Cart: c3a68056c9284270b60d76b559d01579
- Products: 15346 (Sasson Sushi 454g) + 34126 (Suli Blanco 1700g)
- Checkout flow: Email → Shipping (Express→Scheduled) → Payment (Cash on Delivery)
- Payment method selected: Efectivo (Contra Entrega)

---

## Known VTEX Bugs / Patterns

1. **VTEX `orderForm` session pattern**: VTEX creates an anonymous `orderForm` on first visit. The `default-order-form` endpoint should return a new form, but returns 400. Successful forms get IDs via `/api/checkout/pub/orderForm/{id}`.

2. **VTEX checkout-ui v6**: Ships 30+ script dependencies (jQuery 1.8.3, Knockout 2.3.0, Underscore 1.7.0, Dust.js 2.3.5, Parsley 2.0.3). Legacy-heavy stack.

3. **VTEX IO runtime**: Assets served via `vtexassets.com` CDN (CloudFront) with `x-vtex-*` headers. Multiple cache layers (CloudFront + VTEX internal router).

4. **VTEX Payment card-ui v1.38.1**: Loaded in iframes per payment group. Each iframe loads its own CSS/JS bundles, fonts, and has its own CSP.

5. **VTEX segment/graphql**: Event tracking GraphQL endpoint. Most frequent API call. Handles analytics, session events, page views. Consistently slow (>750ms p50).

---

## What This Means (Synthesis)

### The site has three systemic problems:

1. **Backend configuration debt**: `default-order-form` 400, `getCustomLastOrderId` 400, `getPromos` 400, Cookiebot placeholder, TikTok unconfigured, Meta Pixel duplicated. These are not code bugs — they are features that were deployed but never configured or tested.

2. **Frontend architecture issues**: `ageapproval` DELETE loop, CSS plugins MIME type, missing favicon. These are bugs in the VTEX customization layer (checkout6-custom), likely from a deployment that didn't include all required static files.

3. **Third-party bloat**: 90 external domains, cookie syncs dominating the slowest requests (3-7s), unconfigured tracking scripts loading anyway. This is a governance problem — no one is auditing what tags are active or measuring their performance impact.

### The impact hierarchy:
```
Revenue loss (highest confidence): Search speed (27s), cart init 400
Revenue loss (medium confidence): Payment methods hidden, location modal blocking
Cost waste (high confidence): 32 ageapproval DELETEs, 93 TikTok calls, 90 third-party domains
Data blindness (confirmed): GTM TypeError breaks search analytics
Security exposure (confirmed): Google Maps API key unrestricted
Legal risk (potential): Cookiebot non-functional consent management
```

---

## Suggested AI Analysis Prompts

When sharing this context file with another AI agent, use prompts like:

- "Analyze the VTEX endpoint patterns and identify which ones indicate architectural problems vs configuration problems"
- "Based on the third-party domain inventory, recommend which 5 domains should be removed or lazy-loaded first to improve LCP"
- "The search page has FCP 9.5s with 52 console errors. Diagnose the likely root cause from the data provided"
- "Compare the CLI and human HAR files and identify which issues are deterministic vs session-dependent"
- "Given the UX friction points and payment method data, estimate the conversion impact of making cash-on-delivery the default view"
- "Create a prioritized 30-day remediation plan for the engineering team based on impact and effort"
- "What does the ageapproval DELETE loop pattern suggest about the React component architecture of this VTEX checkout?"
- "The CLI headless run captured 14 MB transfer vs 8 MB for the human browser. Why might this be, and what does it imply about caching?"
