#!/usr/bin/env node
import Database from "better-sqlite3";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DB_PATH = process.env.CRUX_DB_PATH ?? resolve(process.cwd(), "data", "crux.db");
const OUT_PATH = resolve(process.cwd(), "reports", "image-audit.html");
const MANIFEST_PATH = resolve(process.cwd(), "reports", "image-assets", "manifest.json");

// Cohorts, same segmentation as the group comparison report.
const COHORTS = [
  { key: "walmart", label: "Walmart CAM", groups: ["walmart_propios", "walmart_subsidiarias"] },
  { key: "walmart_global", label: "Walmart Global", groups: ["walmart_global"] },
  { key: "competencia", label: "Competencia", groups: ["otros"] },
] as const;

function cohortOf(groupName: string): (typeof COHORTS)[number]["key"] | null {
  for (const def of COHORTS) {
    if ((def.groups as readonly string[]).includes(groupName)) return def.key;
  }
  return null;
}

const AUDIT_LABELS: Record<string, string> = {
  "image-delivery-insight": "Entrega de imagen (formato/tamaño/compresión)",
  "vtex-fullres-image": "VTEX sin redimensionar (original full-res)",
  "lcp-lazy-loaded": "LCP con lazy-load",
  "lcp-missing-fetchpriority": "LCP sin fetchpriority=high",
  "lcp-not-discoverable": "LCP no descubrible en HTML inicial",
  // Legacy audit IDs (removed in Lighthouse 13) — kept for historical rows.
  "modern-image-formats": "Formato moderno (WebP/AVIF)",
  "uses-optimized-images": "Compresión",
  "uses-responsive-images": "Tamaño responsive",
  "offscreen-images": "Lazy-load",
  "unsized-images": "Sin dimensiones",
};

const AUDIT_SHORT: Record<string, string> = {
  "image-delivery-insight": "Entrega",
  "vtex-fullres-image": "VTEX full-res",
  "lcp-lazy-loaded": "LCP lazy",
  "lcp-missing-fetchpriority": "LCP sin pri.",
  "lcp-not-discoverable": "LCP no disc.",
  "modern-image-formats": "Formato",
  "uses-optimized-images": "Compresión",
  "uses-responsive-images": "Responsive",
  "offscreen-images": "Lazy-load",
  "unsized-images": "Sin dim.",
};

const AUDIT_ORDER = Object.keys(AUDIT_LABELS);

const FORM_FACTORS = ["mobile", "desktop"] as const;
type FormFactor = (typeof FORM_FACTORS)[number];

interface FindingRow {
  id: string;
  origin: string;
  form_factor: FormFactor;
  audit_id: string;
  resource_url: string;
  total_bytes: number | null;
  wasted_bytes: number | null;
  wasted_pct: number | null;
  displayed_width: number | null;
  displayed_height: number | null;
}

interface SiteRow {
  origin: string;
  label: string;
  group_name: string;
  country: string;
}

interface SynthRow {
  origin: string;
  form_factor: FormFactor;
  url: string;
  total_byte_weight: number | null;
  image_bytes_modern: number | null;
  image_bytes_legacy: number | null;
  image_bytes_third_party: number | null;
  image_count: number | null;
}

interface ManifestEntry {
  file: string;
  fetched_bytes: number;
  optimized_bytes: number;
  width: number;
  height: number;
}

type SiteStatus = "ok" | "limpio" | "parcial" | "sin_datos";

interface SiteReport {
  site: SiteRow;
  formFactor: FormFactor;
  findings: FindingRow[];
  totalWasted: number;
  byAudit: Map<string, number>;
  status: SiteStatus;
  synth: SynthRow | null;
}

// Bot-wall heuristic: zero image findings AND (suspiciously low page weight OR
// a blocked/challenge URL). Marks the site's data as partial.
const PARTIAL_MAX_BYTES = 200_000;
const BOT_WALL_PATTERN = /blocked|queue-it|challenge/i;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatBytes(b: number | null): string {
  if (b === null) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPct(p: number | null): string {
  return p === null ? "—" : `${p.toFixed(0)}%`;
}

function shortenUrl(raw: string, maxLen = 90): string {
  let display = raw;
  try {
    const u = new URL(raw);
    display = u.hostname + u.pathname + u.search;
  } catch {
    // keep raw
  }
  return display.length > maxLen ? display.slice(0, maxLen - 1) + "…" : display;
}

// Graduated color scale (same language as the group report): savings magnitude,
// bigger = worse. ≤50 KB green, ≤500 KB amber, above red darkening to 2× poor.
const GREEN: [number, number, number] = [15, 157, 88];
const AMBER: [number, number, number] = [244, 180, 0];
const RED: [number, number, number] = [219, 68, 55];
const DARK_RED: [number, number, number] = [133, 20, 12];

function lerp(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function fgFor(bg: string): string {
  const m = bg.match(/\d+/g)!.map(Number);
  const luminance = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
  return luminance > 0.6 ? "#1a1a2e" : "#ffffff";
}

function savingsStyle(value: number): string {
  const good = 50 * 1024;
  const poor = 500 * 1024;
  let bg: string;
  if (value <= good) {
    bg = lerp([214, 240, 224], GREEN, Math.min(1, value / good) * 0.85);
  } else if (value <= poor) {
    const t = (value - good) / (poor - good);
    bg = t < 0.5 ? lerp(GREEN, AMBER, t * 2) : lerp(AMBER, RED, (t - 0.5) * 2);
  } else {
    bg = lerp(RED, DARK_RED, Math.min(1, (value - poor) / poor));
  }
  return `background:${bg};color:${fgFor(bg)};`;
}

function statusBadge(status: SiteStatus): string {
  switch (status) {
    case "ok":
      return `<span class="badge ok">con hallazgos</span>`;
    case "limpio":
      return `<span class="badge limpio">sin hallazgos</span>`;
    case "parcial":
      return `<span class="badge parcial">parcial — posible bloqueo anti-bot</span>`;
    case "sin_datos":
      return `<span class="badge sin_datos">sin datos</span>`;
  }
}

/** Stacked bar: modern (AVIF/WebP) vs legacy vs third-party image bytes. */
function formatSplitCell(synth: SynthRow | null): string {
  if (!synth || synth.image_count === null) return `<td class="empty">—</td>`;
  const modern = synth.image_bytes_modern ?? 0;
  const legacy = synth.image_bytes_legacy ?? 0;
  const thirdParty = Math.min(synth.image_bytes_third_party ?? 0, modern + legacy);
  const total = modern + legacy;
  if (total <= 0) return `<td class="empty">—</td>`;
  const pct = (n: number) => ((n / total) * 100).toFixed(1);
  const title = `Total imágenes: ${formatBytes(total)} (${synth.image_count} req) · Moderno: ${formatBytes(modern)} · Legacy: ${formatBytes(legacy)} · Third-party: ${formatBytes(thirdParty)}`;
  return `<td class="split" title="${escapeHtml(title)}">
    <div class="bar">
      <span class="seg modern" style="width:${pct(modern)}%"></span>
      <span class="seg legacy" style="width:${pct(legacy)}%"></span>
    </div>
    <div class="bar-meta">${formatBytes(total)} · ${pct(modern)}% moderno${thirdParty > 0 ? ` · ${formatBytes(thirdParty)} 3ros` : ""}</div>
  </td>`;
}

/** Data attributes that power the click-to-view modal. */
function findingDataAttrs(f: FindingRow, manifest: Record<string, ManifestEntry>): string {
  const opt = manifest[f.id];
  const attrs: Record<string, string> = {
    "data-url": f.resource_url,
    "data-audit": AUDIT_LABELS[f.audit_id] ?? f.audit_id,
    "data-total": formatBytes(f.total_bytes),
    "data-wasted": formatBytes(f.wasted_bytes),
    "data-dims":
      f.displayed_width && f.displayed_height
        ? `${Math.round(f.displayed_width)}×${Math.round(f.displayed_height)} px mostrados`
        : "",
    "data-opt": opt ? `image-assets/${opt.file}` : "",
    "data-opt-bytes": opt ? formatBytes(opt.optimized_bytes) : "",
    "data-fetched-bytes": opt ? formatBytes(opt.fetched_bytes) : "",
    "data-opt-dims": opt ? `${opt.width}×${opt.height} px` : "",
  };
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeHtml(v)}"`)
    .join(" ");
}

function findingRow(f: FindingRow, site: SiteRow | null, manifest: Record<string, ManifestEntry>, rank?: number): string {
  return `<tr class="finding" ${findingDataAttrs(f, manifest)}>
    ${rank !== undefined ? `<td class="rank">${rank}</td>` : ""}
    <td class="url" title="${escapeHtml(f.resource_url)}">${escapeHtml(shortenUrl(f.resource_url))}</td>
    ${site ? `<td>${escapeHtml(site.label)}</td>` : ""}
    <td>${escapeHtml(AUDIT_LABELS[f.audit_id] ?? f.audit_id)}</td>
    <td>${formatBytes(f.total_bytes)}</td>
    <td class="heat" style="${savingsStyle(f.wasted_bytes ?? 0)}"><span class="val">${formatBytes(f.wasted_bytes)}</span></td>
    ${rank === undefined ? `<td>${formatPct(f.wasted_pct)}</td>` : ""}
  </tr>`;
}

function renderFormFactorSection(
  ff: FormFactor,
  reports: SiteReport[],
  manifest: Record<string, ManifestEntry>
): string {
  const ffReports = reports.filter((r) => r.formFactor === ff);
  const withFindings = ffReports.filter((r) => r.findings.length > 0);
  const parcialCount = ffReports.filter((r) => r.status === "parcial").length;

  if (withFindings.length === 0) {
    const anyData = ffReports.some((r) => r.status !== "sin_datos");
    return `<section>
      <h2>Sin hallazgos de imágenes (${ff})</h2>
      <p class="run-meta">${anyData
        ? "No hay hallazgos para este form factor en corridas no excluidas."
        : `No hay corridas ${ff} todavía. Ejecuta <code>npm run synthetic:run -- --page homepage --form-factor ${ff}</code> y vuelve a generar este reporte.`}</p>
    </section>`;
  }

  // --- Resumen por sitio (grouped by cohort) ---
  const summarySections = COHORTS.map((c) => {
    const rows = ffReports
      .filter((r) => cohortOf(r.site.group_name) === c.key)
      .sort((a, b) => b.totalWasted - a.totalWasted)
      .map((r) => {
        const breakdown = AUDIT_ORDER
          .filter((id) => r.byAudit.has(id))
          .map((id) => `${r.byAudit.get(id)}× ${AUDIT_SHORT[id]}`)
          .join(" · ");
        const savingsCell = r.findings.length
          ? `<td class="heat" style="${savingsStyle(r.totalWasted)}"><span class="val">${formatBytes(r.totalWasted)}</span></td>`
          : `<td class="empty">—</td>`;
        return `<tr>
          <th class="site-name">${escapeHtml(r.site.label)} <span class="origin">${escapeHtml(r.site.origin)}</span></th>
          ${savingsCell}
          <td>${r.findings.length || "—"}</td>
          ${formatSplitCell(r.synth)}
          <td class="breakdown">${breakdown ? escapeHtml(breakdown) : "—"}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>`;
      })
      .join("\n");
    return `<tr class="cohort-divider"><th colspan="6" class="cohort ${c.key}">${c.label}</th></tr>\n${rows}`;
  }).join("\n");

  // --- Peores ofensores: top 20 across sites, excluding parcial ---
  const worst = ffReports
    .filter((r) => r.status === "ok")
    .flatMap((r) => r.findings.map((f) => ({ report: r, f })))
    .filter((x) => x.f.wasted_bytes !== null)
    .sort((a, b) => (b.f.wasted_bytes ?? 0) - (a.f.wasted_bytes ?? 0))
    .slice(0, 20);

  const worstRows = worst
    .map((x, i) => findingRow(x.f, x.report.site, manifest, i + 1))
    .join("\n");

  // --- Per-site work lists (sites with findings, grouped by cohort) ---
  const workListSections = COHORTS.map((c) => {
    const siteBlocks = ffReports
      .filter((r) => cohortOf(r.site.group_name) === c.key && r.findings.length > 0)
      .sort((a, b) => b.totalWasted - a.totalWasted)
      .map((r) => {
        const rows = r.findings.map((f) => findingRow(f, null, manifest)).join("\n");
        return `<h3>${escapeHtml(r.site.label)} <span class="origin">${escapeHtml(r.site.origin)}</span> — ahorro potencial ${formatBytes(r.totalWasted)}</h3>
        <table>
          <thead>
            <tr><th>Recurso</th><th>Tipo</th><th>Tamaño actual</th><th>Ahorro</th><th>% desperdiciado</th></tr>
          </thead>
          <tbody>
${rows}
          </tbody>
        </table>`;
      })
      .join("\n");
    return siteBlocks
      ? `<h2 class="cohort ${c.key}">${c.label}</h2>\n${siteBlocks}`
      : "";
  })
    .filter(Boolean)
    .join("\n");

  return `<section>
    <h2>Resumen por sitio</h2>
    <table>
      <thead>
        <tr><th>Sitio</th><th>Ahorro potencial</th><th>Hallazgos</th><th>Bytes de imagen</th><th>Por tipo</th><th>Estado</th></tr>
      </thead>
      <tbody>
${summarySections}
      </tbody>
    </table>
    <p class="run-meta">Bytes de imagen: verde = formato moderno (AVIF/WebP), ámbar = legacy (JPEG/PNG/GIF/SVG). Pasa el cursor para el desglose con third-party.</p>
  </section>
  <section>
    <h2>Peores ofensores (top ${worst.length})</h2>
    <p class="run-meta">Los recursos con mayor ahorro potencial entre todos los sitios${parcialCount ? ` (se excluyen ${parcialCount} sitio(s) parciales)` : ""}. Click en una fila para ver la imagen.</p>
    <table>
      <thead>
        <tr><th>#</th><th>Recurso</th><th>Sitio</th><th>Tipo</th><th>Tamaño actual</th><th>Ahorro</th></tr>
      </thead>
      <tbody>
${worstRows}
      </tbody>
    </table>
  </section>
  <section>
    <h2>Listas de trabajo por sitio</h2>
    <p class="run-meta">Click en cualquier hallazgo para ver la original, la versión optimizada y descargarla.</p>
${workListSections}
  </section>`;
}

function loadManifest(): Record<string, ManifestEntry> {
  if (!existsSync(MANIFEST_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf-8")) as Record<string, ManifestEntry>;
  } catch {
    console.warn("warning: no se pudo leer reports/image-assets/manifest.json; el reporte se genera sin variantes optimizadas.");
    return {};
  }
}

function main(): void {
  if (!existsSync(DB_PATH)) {
    console.error(`Error: no se encontró la base de datos en ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  const sites = db
    .prepare("SELECT origin, label, group_name, country FROM crux_origins ORDER BY label")
    .all() as SiteRow[];

  // Homepage findings from non-excluded runs; newest run per (origin, form_factor) wins.
  // The table may not exist yet in databases that predate this feature.
  const hasFindingsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='image_findings'")
    .get();
  const findings = (hasFindingsTable
    ? db
        .prepare(
          `WITH ranked AS (
             SELECT f.*, ROW_NUMBER() OVER (
               PARTITION BY f.origin, f.form_factor ORDER BY f.fetched_at DESC
             ) AS rn
             FROM image_findings f
             JOIN (SELECT DISTINCT run_id FROM synthetic_runs WHERE excluded = 0) s
               ON s.run_id = f.run_id
             WHERE f.page_type = 'homepage'
           ),
           latest AS (SELECT origin, form_factor, run_id FROM ranked WHERE rn = 1)
           SELECT r.id, r.origin, r.form_factor, r.audit_id, r.resource_url,
                  r.total_bytes, r.wasted_bytes, r.wasted_pct,
                  r.displayed_width, r.displayed_height
           FROM ranked r
           JOIN latest l ON l.origin = r.origin AND l.form_factor = r.form_factor
                        AND l.run_id = r.run_id`,
        )
        .all()
    : []) as FindingRow[];

  // Newest non-excluded homepage synthetic row per (origin, form_factor).
  const synthRows = db
    .prepare(
      `SELECT origin, form_factor, url, total_byte_weight,
              image_bytes_modern, image_bytes_legacy, image_bytes_third_party, image_count
       FROM synthetic_runs
       WHERE page_type = 'homepage' AND excluded = 0
       ORDER BY fetched_at DESC`,
    )
    .all() as SynthRow[];

  db.close();

  const synthByKey = new Map<string, SynthRow>();
  for (const r of synthRows) {
    const key = `${r.origin}|${r.form_factor}`;
    if (!synthByKey.has(key)) synthByKey.set(key, r);
  }

  // Per-site, per-form-factor aggregation
  const reports: SiteReport[] = [];
  for (const site of sites) {
    for (const ff of FORM_FACTORS) {
      const siteFindings = findings
        .filter((f) => f.origin === site.origin && f.form_factor === ff)
        .sort((a, b) => (b.wasted_bytes ?? 0) - (a.wasted_bytes ?? 0));
      const byAudit = new Map<string, number>();
      let totalWasted = 0;
      for (const f of siteFindings) {
        byAudit.set(f.audit_id, (byAudit.get(f.audit_id) ?? 0) + 1);
        totalWasted += f.wasted_bytes ?? 0;
      }
      const synth = synthByKey.get(`${site.origin}|${ff}`) ?? null;

      let status: SiteStatus;
      if (siteFindings.length > 0) {
        status = "ok";
      } else if (!synth) {
        status = "sin_datos";
      } else {
        const lowWeight = synth.total_byte_weight !== null && synth.total_byte_weight < PARTIAL_MAX_BYTES;
        const blockedUrl = BOT_WALL_PATTERN.test(synth.url);
        status = lowWeight || blockedUrl ? "parcial" : "limpio";
      }
      reports.push({ site, formFactor: ff, findings: siteFindings, totalWasted, byAudit, status, synth });
    }
  }

  const manifest = loadManifest();
  const manifestCount = Object.keys(manifest).length;
  const coverage = FORM_FACTORS.map(
    (ff) => `${ff}: ${reports.filter((r) => r.formFactor === ff && r.status !== "sin_datos").length}/${sites.length}`
  ).join(" · ");
  const totalFindings = findings.length;

  const ffSections = FORM_FACTORS.map(
    (ff, i) =>
      `<div class="ff${i > 0 ? " hidden" : ""}" data-ff="${ff}">\n${renderFormFactorSection(ff, reports, manifest)}\n</div>`
  ).join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Auditoría de imágenes — Homepages</title>
<style>
  :root {
    --ink: #1a1a2e; --muted: #666; --line: #e2e2ea;
  }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: var(--ink); margin: 0; background: #f7f7fa; }
  header { background: var(--ink); color: #fff; padding: 24px 32px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px 24px; }
  header .titles { flex: 1 1 320px; }
  header h1 { margin: 0 0 6px; font-size: 22px; }
  header p { margin: 0; color: #b9b9cc; font-size: 13px; }
  .ff-toggle { display: inline-flex; border: 1px solid #4a4a6a; border-radius: 8px; overflow: hidden; }
  .ff-toggle button { background: transparent; color: #b9b9cc; border: 0; padding: 8px 18px; font-size: 14px; cursor: pointer; }
  .ff-toggle button.active { background: #fff; color: var(--ink); font-weight: 600; }
  main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
  section { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 20px 24px; margin-bottom: 24px; }
  h2 { margin: 0 0 14px; font-size: 17px; }
  h2.cohort { margin: 22px 0 10px; font-size: 15px; }
  h3 { font-size: 14px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px; }
  th, td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--line); }
  thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  tbody th { text-align: left; font-weight: 600; }
  td .val { display: block; font-weight: 700; font-variant-numeric: tabular-nums; }
  td.url { text-align: left; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; word-break: break-all; }
  td.rank { color: var(--muted); }
  td.empty { color: #bbb; }
  td.heat { border-left: none; }
  tr.finding { cursor: pointer; }
  tr.finding:hover td { background: #f0f4ff; }
  tr.finding:hover td.heat { filter: brightness(0.95); }
  .breakdown { font-size: 12px; color: var(--muted); text-align: left; }
  .cohort-divider th { text-align: left; font-size: 13px; padding-top: 14px; }
  th.cohort.walmart, h2.cohort.walmart { color: #0071ce; }
  th.cohort.walmart_global, h2.cohort.walmart_global { color: #6b3fa0; }
  th.cohort.competencia, h2.cohort.competencia { color: #c25400; }
  .origin { color: var(--muted); font-weight: 400; font-size: 11px; }
  .badge { display: inline-block; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
  .badge.ok { background: #e6f7ee; color: #0a7d44; }
  .badge.limpio { background: #e6f7ee; color: #0a7d44; }
  .badge.parcial { background: #fdecea; color: #c0392b; }
  .badge.sin_datos { background: #eee; color: var(--muted); }
  .run-meta { color: var(--muted); font-size: 13px; margin: 0 0 10px; line-height: 1.5; }
  .run-meta code { background: #eee; border-radius: 4px; padding: 0 5px; font-size: 12px; }
  footer { color: var(--muted); font-size: 12px; text-align: center; padding: 16px; line-height: 1.6; }
  .ff.hidden { display: none; }
  td.split { min-width: 150px; }
  .bar { display: flex; height: 10px; border-radius: 5px; overflow: hidden; background: #eee; }
  .bar .seg.modern { background: #0a7d44; }
  .bar .seg.legacy { background: #f4b400; }
  .bar-meta { font-size: 11px; color: var(--muted); margin-top: 3px; }
  /* --- Modal --- */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(26,26,46,.55); display: none; align-items: center; justify-content: center; padding: 24px; z-index: 10; }
  .modal-backdrop.open { display: flex; }
  .modal { background: #fff; border-radius: 12px; max-width: 980px; width: 100%; max-height: 90vh; overflow: auto; padding: 20px 24px; }
  .modal h3 { margin: 0 0 4px; font-size: 16px; }
  .modal .m-url { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: var(--muted); word-break: break-all; margin-bottom: 14px; }
  .m-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 760px) { .m-grid { grid-template-columns: 1fr; } }
  .m-pane { border: 1px solid var(--line); border-radius: 8px; padding: 12px; text-align: center; }
  .m-pane h4 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  .m-pane img { max-width: 100%; max-height: 320px; object-fit: contain; background: repeating-conic-gradient(#f0f0f4 0% 25%, #fff 0% 50%) 0 0/16px 16px; }
  .m-bytes { font-size: 13px; margin-top: 8px; font-variant-numeric: tabular-nums; }
  .m-missing { color: var(--muted); font-size: 13px; padding: 40px 0; }
  .m-actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .m-actions a, .m-actions button { border-radius: 6px; padding: 8px 14px; font-size: 13px; text-decoration: none; cursor: pointer; border: 1px solid var(--line); background: #fff; color: var(--ink); }
  .m-actions a.primary { background: var(--ink); color: #fff; border-color: var(--ink); }
  .m-actions a.disabled { opacity: .45; pointer-events: none; }
</style>
</head>
<body>
<header>
  <div class="titles">
    <h1>Auditoría de imágenes — Homepages</h1>
    <p>Generado: ${new Date().toISOString().slice(0, 10)} · Cobertura: ${coverage} sitios con datos de laboratorio · Hallazgos: ${totalFindings} · Variantes optimizadas: ${manifestCount}</p>
  </div>
  <div class="ff-toggle" role="tablist">
    <button class="active" data-ff-toggle="mobile">Mobile</button>
    <button data-ff-toggle="desktop">Desktop</button>
  </div>
</header>
<main>
${ffSections}
</main>
<div class="modal-backdrop" id="modal">
  <div class="modal" role="dialog" aria-modal="true">
    <h3 id="m-audit"></h3>
    <div class="m-url" id="m-url"></div>
    <div class="m-grid">
      <div class="m-pane">
        <h4>Original</h4>
        <div id="m-orig-wrap"></div>
        <div class="m-bytes" id="m-orig-bytes"></div>
      </div>
      <div class="m-pane">
        <h4>Optimizada (WebP · tamaño mostrado ×2)</h4>
        <div id="m-opt-wrap"></div>
        <div class="m-bytes" id="m-opt-bytes"></div>
      </div>
    </div>
    <div class="m-actions">
      <a id="m-open" href="#" target="_blank" rel="noopener">Ver original ↗</a>
      <a id="m-download" href="#" download class="primary">Descargar optimizada</a>
      <button id="m-close">Cerrar</button>
    </div>
  </div>
</div>
<footer>FrictionTrace · Fuente: auditorías Lighthouse sintéticas (homepages, mobile fast4g / desktop broadband) · Ahorro potencial = wastedBytes estimados por Lighthouse; cada sitio usa su corrida no excluida más reciente por form factor.<br>
Las variantes optimizadas se generan localmente con <code>npm run image:optimize</code> — la carpeta <code>image-assets/</code> debe acompañar a este HTML para verlas y descargarlas.</footer>
<script>
(function () {
  // Form factor toggle
  var buttons = document.querySelectorAll("[data-ff-toggle]");
  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      buttons.forEach(function (b) { b.classList.toggle("active", b === btn); });
      document.querySelectorAll(".ff").forEach(function (sec) {
        sec.classList.toggle("hidden", sec.getAttribute("data-ff") !== btn.getAttribute("data-ff-toggle"));
      });
    });
  });

  // Finding viewer modal
  var modal = document.getElementById("modal");
  var el = function (id) { return document.getElementById(id); };

  function openModal(row) {
    var d = row.dataset;
    el("m-audit").textContent = d.audit || "";
    el("m-url").textContent = d.url || "";
    el("m-open").href = d.url || "#";

    var origWrap = el("m-orig-wrap");
    origWrap.innerHTML = "";
    var img = new Image();
    img.referrerPolicy = "no-referrer";
    img.alt = "original";
    img.onerror = function () {
      origWrap.innerHTML = '<div class="m-missing">No se pudo cargar la original (hotlink bloqueado o recurso removido).<br>Usa "Ver original" para abrirla directamente.</div>';
    };
    img.src = d.url;
    origWrap.appendChild(img);
    el("m-orig-bytes").textContent =
      "Lighthouse: " + (d.total || "—") + " · ahorro estimado " + (d.wasted || "—") +
      (d.fetchedBytes ? " · descargada: " + d.fetchedBytes : "") +
      (d.dims ? " · " + d.dims : "");

    var optWrap = el("m-opt-wrap");
    var dl = el("m-download");
    if (d.opt) {
      optWrap.innerHTML = "";
      var oimg = new Image();
      oimg.alt = "optimizada";
      oimg.onerror = function () {
        optWrap.innerHTML = '<div class="m-missing">La variante optimizada no está junto a este HTML (falta image-assets/).</div>';
      };
      oimg.src = d.opt;
      optWrap.appendChild(oimg);
      el("m-opt-bytes").textContent = (d.optBytes || "") + (d.optDims ? " · " + d.optDims : "");
      dl.href = d.opt;
      dl.classList.remove("disabled");
    } else {
      optWrap.innerHTML = '<div class="m-missing">Sin variante optimizada.<br>Ejecuta <code>npm run image:optimize</code>.</div>';
      el("m-opt-bytes").textContent = "";
      dl.removeAttribute("href");
      dl.classList.add("disabled");
    }
    modal.classList.add("open");
  }

  document.addEventListener("click", function (ev) {
    var row = ev.target.closest("tr.finding");
    if (row) openModal(row);
  });
  function close() { modal.classList.remove("open"); }
  el("m-close").addEventListener("click", close);
  modal.addEventListener("click", function (ev) { if (ev.target === modal) close(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") close(); });
})();
</script>
</body>
</html>
`;

  mkdirSync(resolve(process.cwd(), "reports"), { recursive: true });
  writeFileSync(OUT_PATH, html, "utf-8");

  const okCount = reports.filter((r) => r.status === "ok").length;
  const parcialCount = reports.filter((r) => r.status === "parcial").length;
  const sinDatos = reports.filter((r) => r.status === "sin_datos").length;
  console.log(`Reporte generado: ${OUT_PATH}`);
  console.log(
    `Sitios: ${sites.length} × ${FORM_FACTORS.length} form factors · con hallazgos: ${okCount} · parciales: ${parcialCount} · sin datos: ${sinDatos} · hallazgos totales: ${totalFindings} · optimizadas en manifest: ${manifestCount}`
  );
}

main();
