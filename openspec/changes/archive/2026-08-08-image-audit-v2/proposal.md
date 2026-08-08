# Proposal — image-audit-v2

## Why

The v1 image audit produces a static work list, but acting on it still requires manual work: you cannot see which image a finding refers to, nor how it would look/weigh optimized. The audit also runs mobile-only, while a large share of e-commerce traffic and revenue is desktop. And research into 2024–2026 best practices (web.dev, HTTP Archive Web Almanac, VTEX docs, Baymard) shows the current checks miss high-impact patterns specific to retail: LCP image prioritization (~17% of pages set `fetchpriority="high"`; ~16% lazy-load their LCP image), VTEX stores downloading full-resolution originals when the resize URL segment is missing, and no visibility of modern-format vs legacy byte split.

## What Changes

- **Interactive report**: each finding row opens a viewer showing the original image (hotlinked) and a locally generated optimized variant, with byte comparison and a download button for the optimized file.
- **Optimized variants**: new `npm run image:optimize` script (`sharp`) downloads flagged resources, resizes to displayed dimensions ×2 DPR, converts to WebP q80, and writes `reports/image-assets/` + `manifest.json`.
- **Desktop + mobile**: `--form-factor mobile|desktop|both` on the synthetic runner (default `mobile`, backward compatible); new `broadband` throttling profile for desktop (RTT 40 ms, 20/5 Mbps, 1× CPU). `image_findings` gains `form_factor`, `displayed_width`, `displayed_height` (additive). Report gets a mobile/desktop toggle.
- **Expanded checks (curated set)**:
  - LCP image checks derived from Lighthouse 13 insights: `lcp-lazy-loaded`, `lcp-missing-fetchpriority`, `lcp-not-discoverable` (priority findings, no byte savings).
  - `vtex-fullres-image`: VTEX CDN image URLs missing the `-{w}-{h}` resize segment = full-resolution original download (per VTEX docs).
  - Per-page image byte stats on `synthetic_runs` (additive columns): modern-format bytes (AVIF/WebP), legacy bytes (JPEG/PNG/GIF), third-party image bytes, image count — rendered as a stacked bar per site in the report.

## Capabilities

### Modified Capabilities
- `image-audit-report`: findings carry form factor and displayed dimensions; new audit ids; report becomes an interactive viewer with optimized variants, form-factor toggle, and per-site format split.
- `synthetic-lighthouse-runs`: the runner supports mobile/desktop/both form factors and a `broadband` desktop throttling profile; per-page image byte stats are stored on each run row.

## Impact

- **Schema**: `engine/src/crux/schema.ts` + `engine/src/crux/db.ts` — additive columns on `image_findings` (form_factor, displayed_width, displayed_height) and `synthetic_runs` (image_bytes_modern, image_bytes_legacy, image_bytes_third_party, image_count), PRAGMA/ALTER migration pattern.
- **Runner**: `scripts/synthetic-run.ts` — `--form-factor`, `broadband` profile, LCP checks, VTEX full-res detection, page image stats (sequential + parallel worker paths).
- **New file**: `scripts/image-optimize.ts`; npm script `image:optimize`; new dependency `sharp`.
- **Report**: `scripts/image-report.ts` — modal viewer, form-factor toggle, format-split bars; output becomes `reports/image-audit.html` + `reports/image-assets/`.
- **Data**: one full-cohort run with `--form-factor both` (~46 audits), then `image:optimize` + `image:report`.
- Research references (web.dev, Web Almanac 2024/2025, VTEX Help, Baymard) documented in design.md.
