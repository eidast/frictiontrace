#!/usr/bin/env node
import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DB_PATH = process.env.CRUX_DB_PATH ?? resolve(process.cwd(), "data", "crux.db");
const OUT_PATH = resolve(process.cwd(), "reports", "image-audit.html");

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
  "modern-image-formats": "Formato moderno (WebP/AVIF)",
  "uses-optimized-images": "Compresión",
  "uses-responsive-images": "Tamaño responsive",
  "offscreen-images": "Lazy-load",
  "unsized-images": "Sin dimensiones",
};

const AUDIT_SHORT: Record<string, string> = {
  "modern-image-formats": "Formato",
  "uses-optimized-images": "Compresión",
  "uses-responsive-images": "Responsive",
  "offscreen-images": "Lazy-load",
  "unsized-images": "Sin dim.",
};

const AUDIT_ORDER = Object.keys(AUDIT_LABELS);

interface FindingRow {
  origin: string;
  run_id: string;
  audit_id: string;
  resource_url: string;
  total_bytes: number | null;
  wasted_bytes: number | null;
  wasted_pct: number | null;
  fetched_at: number;
}

interface SiteRow {
  origin: string;
  label: string;
  group_name: string;
  country: string;
}

type SiteStatus = "ok" | "limpio" | "parcial" | "sin_datos";

interface SiteReport {
  site: SiteRow;
  findings: FindingRow[];
  totalWasted: number;
  byAudit: Map<string, number>;
  status: SiteStatus;
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

function main(): void {
  if (!existsSync(DB_PATH)) {
    console.error(`Error: no se encontró la base de datos en ${DB_PATH}`);
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  const sites = db
    .prepare("SELECT origin, label, group_name, country FROM crux_origins ORDER BY label")
    .all() as SiteRow[];

  // Homepage findings from non-excluded runs; newest run per origin wins.
  // The table may not exist yet in databases that predate this feature.
  const hasFindingsTable = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='image_findings'")
    .get();
  const findingRows = (hasFindingsTable
    ? db
        .prepare(
          `SELECT f.origin, f.run_id, f.audit_id, f.resource_url,
                  f.total_bytes, f.wasted_bytes, f.wasted_pct, f.fetched_at
           FROM image_findings f
           JOIN (SELECT DISTINCT run_id FROM synthetic_runs WHERE excluded = 0) s
             ON s.run_id = f.run_id
           WHERE f.page_type = 'homepage'
           ORDER BY f.fetched_at DESC`,
        )
        .all()
    : []) as FindingRow[];

  // Newest non-excluded homepage synthetic row per origin (for partial detection).
  const synthRows = db
    .prepare(
      `SELECT origin, url, total_byte_weight, fetched_at
       FROM synthetic_runs
       WHERE page_type = 'homepage' AND excluded = 0
       ORDER BY fetched_at DESC`,
    )
    .all() as Array<{ origin: string; url: string; total_byte_weight: number | null; fetched_at: number }>;

  db.close();

  const chosenRunByOrigin = new Map<string, string>();
  const findings: FindingRow[] = [];
  for (const r of findingRows) {
    const chosen = chosenRunByOrigin.get(r.origin);
    if (chosen === undefined) {
      chosenRunByOrigin.set(r.origin, r.run_id);
      findings.push(r);
    } else if (chosen === r.run_id) {
      findings.push(r);
    }
  }

  const homepageByOrigin = new Map<string, { url: string; total_byte_weight: number | null }>();
  for (const r of synthRows) {
    if (!homepageByOrigin.has(r.origin)) {
      homepageByOrigin.set(r.origin, { url: r.url, total_byte_weight: r.total_byte_weight });
    }
  }

  // Per-site aggregation
  const reports: SiteReport[] = sites.map((site) => {
    const siteFindings = findings
      .filter((f) => f.origin === site.origin)
      .sort((a, b) => (b.wasted_bytes ?? 0) - (a.wasted_bytes ?? 0));
    const byAudit = new Map<string, number>();
    let totalWasted = 0;
    for (const f of siteFindings) {
      byAudit.set(f.audit_id, (byAudit.get(f.audit_id) ?? 0) + 1);
      totalWasted += f.wasted_bytes ?? 0;
    }

    let status: SiteStatus;
    if (siteFindings.length > 0) {
      status = "ok";
    } else {
      const synth = homepageByOrigin.get(site.origin);
      if (!synth) {
        status = "sin_datos";
      } else {
        const lowWeight = synth.total_byte_weight !== null && synth.total_byte_weight < PARTIAL_MAX_BYTES;
        const blockedUrl = BOT_WALL_PATTERN.test(synth.url);
        status = lowWeight || blockedUrl ? "parcial" : "limpio";
      }
    }
    return { site, findings: siteFindings, totalWasted, byAudit, status };
  });

  const withData = reports.filter((r) => r.status !== "sin_datos").length;
  const runIds = new Set(findings.map((f) => f.run_id));
  const parcialCount = reports.filter((r) => r.status === "parcial").length;

  // --- Resumen por sitio (grouped by cohort) ---
  const summarySections = COHORTS.map((c) => {
    const rows = reports
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
          <td class="breakdown">${breakdown ? escapeHtml(breakdown) : "—"}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>`;
      })
      .join("\n");
    return `<tr class="cohort-divider"><th colspan="5" class="cohort ${c.key}">${c.label}</th></tr>\n${rows}`;
  }).join("\n");

  // --- Peores ofensores: top 20 across sites, excluding parcial ---
  const worst = reports
    .filter((r) => r.status === "ok")
    .flatMap((r) => r.findings.map((f) => ({ report: r, f })))
    .filter((x) => x.f.wasted_bytes !== null)
    .sort((a, b) => (b.f.wasted_bytes ?? 0) - (a.f.wasted_bytes ?? 0))
    .slice(0, 20);

  const worstRows = worst
    .map((x, i) => {
      const { f } = x;
      return `<tr>
        <td class="rank">${i + 1}</td>
        <td class="url" title="${escapeHtml(f.resource_url)}">${escapeHtml(shortenUrl(f.resource_url))}</td>
        <td>${escapeHtml(x.report.site.label)}</td>
        <td>${escapeHtml(AUDIT_LABELS[f.audit_id] ?? f.audit_id)}</td>
        <td>${formatBytes(f.total_bytes)}</td>
        <td class="heat" style="${savingsStyle(f.wasted_bytes ?? 0)}"><span class="val">${formatBytes(f.wasted_bytes)}</span></td>
      </tr>`;
    })
    .join("\n");

  // --- Per-site work lists (sites with findings, grouped by cohort) ---
  const workListSections = COHORTS.map((c) => {
    const siteBlocks = reports
      .filter((r) => cohortOf(r.site.group_name) === c.key && r.findings.length > 0)
      .sort((a, b) => b.totalWasted - a.totalWasted)
      .map((r) => {
        const rows = r.findings
          .map(
            (f) => `<tr>
            <td class="url" title="${escapeHtml(f.resource_url)}">${escapeHtml(shortenUrl(f.resource_url))}</td>
            <td>${escapeHtml(AUDIT_LABELS[f.audit_id] ?? f.audit_id)}</td>
            <td>${formatBytes(f.total_bytes)}</td>
            <td class="heat" style="${savingsStyle(f.wasted_bytes ?? 0)}"><span class="val">${formatBytes(f.wasted_bytes)}</span></td>
            <td>${formatPct(f.wasted_pct)}</td>
          </tr>`,
          )
          .join("\n");
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

  const bodyContent =
    findings.length === 0
      ? `<section>
      <h2>Sin hallazgos de imágenes</h2>
      <p class="run-meta">No hay hallazgos de imágenes en corridas no excluidas. Ejecuta una corrida sintética sobre las homepages (<code>npm run synthetic:run -- --page homepage --label image-audit</code>) y vuelve a generar este reporte.</p>
    </section>`
      : `<section>
    <h2>Resumen por sitio</h2>
    <table>
      <thead>
        <tr><th>Sitio</th><th>Ahorro potencial</th><th>Hallazgos</th><th>Por tipo</th><th>Estado</th></tr>
      </thead>
      <tbody>
${summarySections}
      </tbody>
    </table>
  </section>
  <section>
    <h2>Peores ofensores (top ${worst.length})</h2>
    <p class="run-meta">Los recursos con mayor ahorro potencial entre todos los sitios${parcialCount ? ` (se excluyen ${parcialCount} sitio(s) parciales)` : ""}.</p>
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
${workListSections}
  </section>`;

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
  header { background: var(--ink); color: #fff; padding: 24px 32px; }
  header h1 { margin: 0 0 6px; font-size: 22px; }
  header p { margin: 0; color: #b9b9cc; font-size: 13px; }
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
  footer { color: var(--muted); font-size: 12px; text-align: center; padding: 16px; }
</style>
</head>
<body>
<header>
  <h1>Auditoría de imágenes — Homepages</h1>
  <p>Generado: ${new Date().toISOString().slice(0, 10)} · Cobertura: ${withData}/${sites.length} sitios con datos de laboratorio · Corridas sintéticas aportando hallazgos: ${runIds.size}${parcialCount ? ` · ${parcialCount} sitio(s) parciales (posible bloqueo anti-bot)` : ""}</p>
</header>
<main>
${bodyContent}
</main>
<footer>FrictionTrace · Fuente: auditorías Lighthouse sintéticas (homepages, form factor mobile) · Ahorro potencial = wastedBytes estimados por Lighthouse; cada sitio usa su corrida no excluida más reciente.</footer>
</body>
</html>
`;

  mkdirSync(resolve(process.cwd(), "reports"), { recursive: true });
  writeFileSync(OUT_PATH, html, "utf-8");

  console.log(`Reporte generado: ${OUT_PATH}`);
  console.log(
    `Sitios: ${sites.length} · con hallazgos: ${reports.filter((r) => r.status === "ok").length} · parciales: ${parcialCount} · sin datos: ${reports.filter((r) => r.status === "sin_datos").length} · hallazgos totales: ${findings.length}`
  );
}

main();
