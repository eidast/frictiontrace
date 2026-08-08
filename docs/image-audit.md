# Image audit

The image audit turns [synthetic Lighthouse runs](synthetic-audits.md) into an actionable, interactive report of image problems on every homepage: what each image is, what it weighs, what it *should* weigh, and a ready-to-use optimized variant.

## Pipeline

```bash
# 1. Collect lab data (mobile + desktop recommended)
npm run synthetic:run -- --page homepage --form-factor both \
  --label image-audit-v2-2026-08 --concurrency 4

# 2. Generate optimized variants (requires sharp; concurrency 4; idempotent)
npm run image:optimize

# 3. Generate the interactive report
npm run image:report   # → reports/image-audit.html
```

`image:optimize` downloads the flagged resources from the latest non-excluded run per origin + form factor, resizes them to displayed dimensions ×2 DPR (cap 2560 px), converts to WebP q80, and writes `reports/image-assets/<finding_id>.webp` plus a `manifest.json` (optimized bytes, fetched bytes, dimensions). Download failures (404/500, hotlink protection) are skipped with a log line — the report falls back to the hotlinked original.

## Findings catalog

| Audit id | Meaning |
|---|---|
| `image-delivery` | Format/size/compression savings estimated by Lighthouse image-delivery insight |
| `vtex-fullres-image` | VTEX CDN URL missing the `-{w}-{h}` resize segment → full-resolution original downloaded |
| `lcp-lazy-loaded` | The LCP image is lazy-loaded (should be eager) |
| `lcp-missing-fetchpriority` | The LCP image lacks `fetchpriority="high"` |
| `lcp-not-discoverable` | The LCP image is not discoverable in the initial HTML (e.g. injected by JS/CSS) |

Findings persist in `data/crux.db` (`image_findings`) with `form_factor` and displayed dimensions.

## The report

`reports/image-audit.html` (UI in Spanish for stakeholders):

- **Mobile/Desktop toggle** — every table filters by form factor; default mobile.
- **Per-site summary** — potential savings, finding counts, stacked bar of image bytes (modern AVIF/WebP vs legacy JPEG/PNG vs third-party).
- **Finding rows open a modal** — hotlinked original (`referrerpolicy="no-referrer"`, with an on-error fallback message) next to the locally optimized variant, byte comparison (fetched original vs optimized vs Lighthouse estimate), "Ver original" link, and "Descargar optimizada" download button.

The `reports/image-assets/` folder must travel with the HTML for the optimized variants to render and download; it is not committed to git (regenerate anytime with `npm run image:optimize`).
