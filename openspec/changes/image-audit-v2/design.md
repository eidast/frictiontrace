# Design — image-audit-v2

## Optimized variants: local sharp vs CDN URLs

Chosen: **`sharp`** (native dependency, prebuilt binaries). Alternatives considered:
(a) VTEX CDN resize URLs only — zero deps but covers only VTEX stores and gives no
byte-truth or download artifact; (b) squoosh/imagemin — unmaintained. sharp converts
to WebP q80 and resizes to `displayed × min(DPR, 2)` (cap 2560 px), matching the
perceptual ceiling from research (2x DPR; 3x+ is wasted bytes).
The optimizer is a separate script (`image:optimize`), not part of the report
generation, so a missing/failed sharp install never breaks `image:report` — the
viewer just shows "optimizada no generada".

## Report becomes HTML + assets folder

The report was a single self-contained HTML. Embedding optimized images as base64
was rejected (multi-MB HTML). The report now references `reports/image-assets/`
relatively; the footer notes the folder must travel with the HTML. Originals are
hotlinked (`referrerpolicy="no-referrer"`) with an onerror fallback message —
they are not downloaded into the repo.

## Desktop form factor

`synthetic_runs.form_factor` already existed (default `'mobile'`); findings lacked
it. Desktop emulation uses Lighthouse's desktop preset (`formFactor:'desktop'`,
`screenEmulation.mobile:false`, 1350×940). Desktop gets its own throttling profile
`broadband` (RTT 40 ms, 20 Mbps down / 5 Mbps up, 1× CPU) — realistic fixed-line
desktop, keeping `fast4g` semantics mobile-only. `--form-factor` defaults to
`mobile` so existing commands behave identically. The report defaults to the mobile
view with a JS toggle; "newest non-excluded run per origin" becomes per
(origin, form_factor).

## New checks and how they're derived

All three LCP checks are read from the LHR — no extra page loads:
- LCP image URL from `largest-contentful-paint-element` details items.
- `lcp-lazy-loaded`, `lcp-missing-fetchpriority`, `lcp-not-discoverable` from
  `lcp-discovery-insight` checklist items. These persist as `image_findings` rows
  with NULL bytes (priority findings, like `unsized-images`).
- `vtex-fullres-image`: scan `network-requests` items (resourceType Image) for
  hosts `*.vtexassets.com` / `*.vteximg.com.br` whose path lacks the `-{w}-{h}`
  resize segment; per VTEX's own docs such URLs serve the original upload.
  `total_bytes` = transferSize. Overlaps with `image-delivery-insight` by design:
  the insight quantifies savings, this check names the VTEX-specific cause.
- Page image stats (modern/legacy/third-party bytes, count) aggregate
  `network-requests` image items by mimeType and host vs. audited host. Stored as
  columns on `synthetic_runs` (one row per audited page) rather than a new table —
  they are per-run scalars, not per-resource rows.

Thresholds are deliberately conservative: resize target 2× DPR; LCP checks follow
Lighthouse's own checklist verdicts; VTEX check is a pure URL pattern (no false
positives beyond intentionally full-res assets).

## References (research, 2026-08-08)

- web.dev — Optimize LCP (fetchpriority, preload, LCP discoverability, carousel
  slide priorities): https://web.dev/articles/optimize-lcp
- web.dev — Browser-level lazy loading (never lazy-load LCP; Chrome distance
  thresholds 1250px/2500px): https://web.dev/articles/browser-level-image-lazy-loading
- HTTP Archive Web Almanac 2024 — Media (format adoption, over-delivery, srcset
  usage): https://almanac.httparchive.org/en/2024/media
- HTTP Archive Web Almanac 2025 — Performance (17% fetchpriority on LCP images,
  ~16% lazy-loaded LCP): https://almanac.httparchive.org/en/2025/performance
- VTEX Help — product image performance (`-{w}-{h}` resize segment; no segment =
  original): https://help.vtex.com/en/docs/tutorials/improving-the-performance-of-product-images
- AVIF ~50% smaller than JPEG, WebP ~25–34% (Cloudinary/SpeedVitals studies).
- Baymard Institute — PDP image resolution/zoom, mobile thumbnails (UX tier,
  out of scope for this change): https://baymard.com/blog/ensure-sufficient-image-resolution-and-zoom
