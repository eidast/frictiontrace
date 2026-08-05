#!/usr/bin/env node
import Database from "better-sqlite3";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DB_PATH = process.env.CRUX_DB_PATH ?? resolve(process.cwd(), "data", "crux.db");
const OUT_PATH = resolve(process.cwd(), "reports", "crux-group-compare.html");

const PAGE_TYPES = ["homepage", "checkout", "plp", "pdp"] as const;
type PageType = (typeof PAGE_TYPES)[number];

const PAGE_TYPE_LABELS: Record<PageType, string> = {
  homepage: "Homepage",
  checkout: "Checkout",
  plp: "PLP (lista de productos)",
  pdp: "PDP (detalle de producto)",
};

interface MetricDef {
  name: string;
  label: string;
  unit: "ms" | "cls";
  good: number;
  poor: number;
  description: string;
}

const METRICS: MetricDef[] = [
  {
    name: "largest_contentful_paint", label: "LCP", unit: "ms", good: 2500, poor: 4000,
    description: "Largest Contentful Paint: tiempo hasta que el elemento visible más grande termina de renderizarse. Bueno ≤ 2.5 s · Pobre > 4 s.",
  },
  {
    name: "interaction_to_next_paint", label: "INP", unit: "ms", good: 200, poor: 500,
    description: "Interaction to Next Paint: latencia de respuesta a las interacciones del usuario (clics, toques). Bueno ≤ 200 ms · Pobre > 500 ms.",
  },
  {
    name: "cumulative_layout_shift", label: "CLS", unit: "cls", good: 0.1, poor: 0.25,
    description: "Cumulative Layout Shift: estabilidad visual; cuánto se mueve el contenido mientras carga (sin unidad). Bueno ≤ 0.1 · Pobre > 0.25.",
  },
  {
    name: "first_contentful_paint", label: "FCP", unit: "ms", good: 1800, poor: 3000,
    description: "First Contentful Paint: tiempo hasta que aparece el primer contenido (texto o imagen) en pantalla. Bueno ≤ 1.8 s · Pobre > 3 s.",
  },
  {
    name: "experimental_time_to_first_byte", label: "TTFB", unit: "ms", good: 800, poor: 1800,
    description: "Time to First Byte: tiempo que tarda el servidor en responder con el primer byte. Bueno ≤ 0.8 s · Pobre > 1.8 s.",
  },
];

type Cohort = "walmart" | "competencia";

const COHORTS: Record<Cohort, { label: string; groups: string[] }> = {
  walmart: { label: "Walmart", groups: ["walmart_propios", "walmart_subsidiarias"] },
  competencia: { label: "Competencia", groups: ["otros"] },
};

interface SnapshotRow {
  origin: string;
  label: string;
  group_name: string;
  page_type: string;
  metric_name: string;
  p75: number | null;
}

interface Stat {
  min: number;
  minLabel: string;
  max: number;
  maxLabel: string;
  values: number[];
}

function median(sortedValues: number[]): number {
  const n = sortedValues.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2;
}

function cohortOf(groupName: string): Cohort | null {
  for (const [cohort, def] of Object.entries(COHORTS) as [Cohort, (typeof COHORTS)[Cohort]][]) {
    if (def.groups.includes(groupName)) return cohort;
  }
  return null;
}

// Graduated color scale: green → amber → red between good and poor thresholds;
// beyond poor, red darkens progressively (capped at 2× poor).
const GREEN: [number, number, number] = [15, 157, 88];
const AMBER: [number, number, number] = [244, 180, 0];
const RED: [number, number, number] = [219, 68, 55];
const DARK_RED: [number, number, number] = [133, 20, 12];

function lerp(a: [number, number, number], b: [number, number, number], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function heatStyle(def: MetricDef, value: number): string {
  let bg: string;
  if (value <= def.good) {
    // within "good": soft green → full green as it approaches the threshold
    bg = lerp([214, 240, 224], GREEN, Math.min(1, value / def.good) * 0.85);
  } else if (value <= def.poor) {
    const t = (value - def.good) / (def.poor - def.good);
    bg = t < 0.5 ? lerp(GREEN, AMBER, t * 2) : lerp(AMBER, RED, (t - 0.5) * 2);
  } else {
    const t = Math.min(1, (value - def.poor) / def.poor);
    bg = lerp(RED, DARK_RED, t);
  }
  // contrast: dark text on light/saturated-amber backgrounds, white otherwise
  const m = bg.match(/\d+/g)!.map(Number);
  const luminance = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
  const fg = luminance > 0.6 ? "#1a1a2e" : "#ffffff";
  return `background:${bg};color:${fg};`;
}

function pctGoodStyle(pct: number): string {
  // 0% → red, 50% → amber, 100% → green
  const t = pct / 100;
  const bg = t < 0.5 ? lerp(RED, AMBER, t * 2) : lerp(AMBER, GREEN, (t - 0.5) * 2);
  const m = bg.match(/\d+/g)!.map(Number);
  const luminance = (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) / 255;
  const fg = luminance > 0.6 ? "#1a1a2e" : "#ffffff";
  return `background:${bg};color:${fg};`;
}

function formatValue(def: MetricDef, value: number): string {
  if (def.unit === "cls") return value.toFixed(2);
  return `${Math.round(value).toLocaleString("en-US")} ms`;
}

function formatThreshold(def: MetricDef, value: number): string {
  if (def.unit === "cls") return value.toFixed(2).replace(/\.?0+$/, "").replace(/\.$/, "") || "0";
  return `${(value / 1000).toLocaleString("en-US")} s`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function main(): void {
  if (!existsSync(DB_PATH)) {
    console.error(`Error: no se encontró la base de datos en ${DB_PATH}`);
    console.error("Ejecuta primero la sincronización de CrUX (crux:sync).");
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

  const latest = db
    .prepare("SELECT MAX(collection_end) AS latest FROM crux_history")
    .get() as { latest: string | null };

  if (!latest.latest) {
    console.error("Error: crux_history está vacía; no hay datos para reportar.");
    db.close();
    process.exit(1);
  }

  const periodEnd = latest.latest;
  const periodStart = (
    db.prepare("SELECT MIN(collection_start) AS s FROM crux_history WHERE collection_end = ?").get(periodEnd) as { s: string }
  ).s;

  // Prefer url-level rows; fall back to origin-level when a site has no url-level row
  // for that page type + metric in the latest period.
  const rows = db
    .prepare(
      `SELECT o.origin, o.label, o.group_name, q.page_type, h.metric_name,
              CAST(NULLIF(h.p75_value, '') AS REAL) AS p75,
              h.query_level
       FROM crux_history h
       JOIN crux_queries q ON h.query_id = q.id
       JOIN crux_origins o ON q.origin_id = o.id
       WHERE h.collection_end = ?
         AND h.form_factor = 'PHONE'
         AND h.metric_name IN (${METRICS.map(() => "?").join(",")})
       ORDER BY CASE h.query_level WHEN 'url' THEN 0 ELSE 1 END`,
    )
    .all(periodEnd, ...METRICS.map((m) => m.name)) as Array<SnapshotRow & { query_level: string }>;

  const sites = db
    .prepare("SELECT origin, label, group_name, country FROM crux_origins ORDER BY group_name, label")
    .all() as Array<{ origin: string; label: string; group_name: string; country: string }>;

  db.close();

  // Deduplicate: one value per origin × page_type × metric (url-level wins by ORDER BY)
  const seen = new Set<string>();
  const deduped: SnapshotRow[] = [];
  for (const r of rows) {
    const key = `${r.origin}|${r.page_type}|${r.metric_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // stats[cohort][pageType][metric] = Stat
  const stats: Record<Cohort, Record<string, Record<string, Stat>>> = {
    walmart: {},
    competencia: {},
  };
  const siteCounts: Record<Cohort, Set<string>> = { walmart: new Set(), competencia: new Set() };

  for (const r of deduped) {
    const cohort = cohortOf(r.group_name);
    if (!cohort) continue;
    siteCounts[cohort].add(r.origin);
    if (r.p75 === null) continue;
    if (!PAGE_TYPES.includes(r.page_type as PageType)) continue;

    const byPage = (stats[cohort][r.page_type] ??= {});
    const s = byPage[r.metric_name];
    if (!s) {
      byPage[r.metric_name] = { min: r.p75, minLabel: r.label, max: r.p75, maxLabel: r.label, values: [r.p75] };
    } else {
      if (r.p75 < s.min) { s.min = r.p75; s.minLabel = r.label; }
      if (r.p75 > s.max) { s.max = r.p75; s.maxLabel = r.label; }
      s.values.push(r.p75);
    }
  }

  for (const cohort of Object.keys(stats) as Cohort[]) {
    for (const byMetric of Object.values(stats[cohort])) {
      for (const s of Object.values(byMetric)) {
        s.values.sort((a, b) => a - b);
      }
    }
  }

  // Heatmap lookup: origin|pageType|metric -> p75
  const siteValues = new Map<string, number>();
  for (const r of deduped) {
    if (r.p75 === null) continue;
    if (!PAGE_TYPES.includes(r.page_type as PageType)) continue;
    siteValues.set(`${r.origin}|${r.page_type}|${r.metric_name}`, r.p75);
  }

  const heatmapSections = PAGE_TYPES.map((pt) => {
    const headerCells = METRICS.map(
      (def) => `<th><span class="metric-tip" data-tip="${escapeHtml(def.description)}">${def.label}</span></th>`,
    ).join("");

    const cohortRows = (Object.keys(COHORTS) as Cohort[]).map((cohort) => {
      const list = sites.filter((s) => cohortOf(s.group_name) === cohort);
      const rowsHtml = list.map((site, i) => {
        const cells = METRICS.map((def) => {
          const v = siteValues.get(`${site.origin}|${pt}|${def.name}`);
          if (v === undefined) return `<td class="empty">—</td>`;
          return `<td class="heat" style="${heatStyle(def, v)}"><span class="val">${formatValue(def, v)}</span></td>`;
        }).join("");
        const groupHeader = i === 0
          ? `<th class="cohort-row ${cohort}" rowspan="${list.length}">${COHORTS[cohort].label}</th>`
          : "";
        return `<tr>${groupHeader}<th class="site-name">${escapeHtml(site.label)}</th>${cells}</tr>`;
      }).join("\n");
      return rowsHtml;
    }).join("\n");

    return `<section>
      <h2>Semáforo — ${PAGE_TYPE_LABELS[pt]}</h2>
      <table class="heatmap">
        <thead>
          <tr><th colspan="2">Sitio</th>${headerCells}</tr>
        </thead>
        <tbody>
${cohortRows}
        </tbody>
      </table>
    </section>`;
  }).join("\n");

  function cell(def: MetricDef, s: Stat | undefined, field: "min" | "median" | "max"): string {
    if (!s) return `<td class="empty">—</td>`;
    const value = field === "median" ? median(s.values) : s[field];
    let extra = "";
    if (field === "min") extra = `<span class="site">${escapeHtml(s.minLabel)}</span>`;
    if (field === "max") extra = `<span class="site">${escapeHtml(s.maxLabel)}</span>`;
    if (field === "median") extra = `<span class="site">n=${s.values.length}</span>`;
    return `<td class="heat" style="${heatStyle(def, value)}"><span class="val">${formatValue(def, value)}</span>${extra}</td>`;
  }

  function pctGoodCell(def: MetricDef, s: Stat | undefined): string {
    if (!s) return `<td class="empty">—</td>`;
    const goodCount = s.values.filter((v) => v <= def.good).length;
    const pct = Math.round((goodCount / s.values.length) * 100);
    return `<td class="heat" style="${pctGoodStyle(pct)}"><span class="val">${pct}%</span><span class="site">${goodCount}/${s.values.length} sitios</span></td>`;
  }

  const sections = PAGE_TYPES.map((pt) => {
    const rowsHtml = METRICS.map((def) => {
      const w = stats.walmart[pt]?.[def.name];
      const c = stats.competencia[pt]?.[def.name];
      return `<tr>
        <th><span class="metric-tip" data-tip="${escapeHtml(def.description)}">${def.label}</span></th>
        ${cell(def, w, "min")}${cell(def, w, "median")}${cell(def, w, "max")}${pctGoodCell(def, w)}
        ${cell(def, c, "min")}${cell(def, c, "median")}${cell(def, c, "max")}${pctGoodCell(def, c)}
      </tr>`;
    }).join("\n");

    return `<section>
      <h2>${PAGE_TYPE_LABELS[pt]}</h2>
      <table>
        <thead>
          <tr>
            <th rowspan="2">Métrica</th>
            <th colspan="4" class="cohort walmart">Walmart (${siteCounts.walmart.size} sitios)</th>
            <th colspan="4" class="cohort competencia">Competencia (${siteCounts.competencia.size} sitios)</th>
          </tr>
          <tr>
            <th>Min</th><th>Mediana</th><th>Max</th><th>% bueno</th>
            <th>Min</th><th>Mediana</th><th>Max</th><th>% bueno</th>
          </tr>
        </thead>
        <tbody>
${rowsHtml}
        </tbody>
      </table>
    </section>`;
  }).join("\n");

  const legendRows = METRICS.map(
    (def) =>
      `<tr><th><span class="metric-tip" data-tip="${escapeHtml(def.description)}">${def.label}</span></th><td class="good">≤ ${formatThreshold(def, def.good)}</td><td class="ni">${formatThreshold(def, def.good)} – ${formatThreshold(def, def.poor)}</td><td class="poor">> ${formatThreshold(def, def.poor)}</td></tr>`,
  ).join("\n");

  const cohortSitesHtml = (Object.keys(COHORTS) as Cohort[]).map((cohort) => {
    const list = sites.filter((s) => cohortOf(s.group_name) === cohort);
    const items = list.map((s) => {
      const hasData = siteCounts[cohort].has(s.origin);
      const badge = hasData ? "" : ` <span class="nodata" title="Sin datos CrUX en el período">sin datos</span>`;
      return `<li><strong>${escapeHtml(s.label)}</strong> <span class="origin">${escapeHtml(s.origin)}</span> <span class="country">${escapeHtml(s.country)}</span>${badge}</li>`;
    }).join("\n");
    return `<div class="site-col">
      <h3 class="${cohort}">${COHORTS[cohort].label} (${siteCounts[cohort].size}/${list.length} con datos)</h3>
      <ul>
${items}
      </ul>
    </div>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Walmart vs Competencia — CrUX comparativo (móvil)</title>
<style>
  :root {
    --good: #0cce6b; --good-bg: #e6f7ee;
    --ni: #ffa400; --ni-bg: #fff4e0;
    --poor: #ff4e42; --poor-bg: #fdecea;
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
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 8px 10px; text-align: center; border-bottom: 1px solid var(--line); }
  thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  thead .cohort { font-size: 13px; text-transform: none; letter-spacing: 0; }
  thead .cohort.walmart { color: #0071ce; }
  thead .cohort.competencia { color: #c25400; }
  tbody th { text-align: left; font-weight: 600; }
  td .val { display: block; font-weight: 700; font-variant-numeric: tabular-nums; }
  td .site { display: block; font-size: 11px; color: var(--muted); font-weight: 400; }
  td.good { background: var(--good-bg); border-left: 3px solid var(--good); }
  td.ni { background: var(--ni-bg); border-left: 3px solid var(--ni); }
  td.poor { background: var(--poor-bg); border-left: 3px solid var(--poor); }
  td.heat { border-left: none; }
  td.heat .site { color: inherit; opacity: .8; }
  .gradient-bar { height: 16px; border-radius: 8px; background: linear-gradient(to right, rgb(15,157,88), rgb(244,180,0), rgb(219,68,55), rgb(133,20,12)); margin: 4px 0 2px; }
  .gradient-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-bottom: 12px; }
  td.empty { color: #bbb; }
  .legend td.good, .legend td.ni, .legend td.poor { border-left: none; font-weight: 600; }
  .metric-tip { position: relative; cursor: help; border-bottom: 1px dotted var(--muted); }
  .metric-tip::after {
    content: attr(data-tip);
    position: absolute; left: 0; top: calc(100% + 6px); z-index: 10;
    width: 260px; padding: 8px 10px; border-radius: 6px;
    background: var(--ink); color: #fff; font-size: 12px; font-weight: 400; line-height: 1.4;
    text-align: left; white-space: normal;
    opacity: 0; visibility: hidden; transition: opacity .15s;
    pointer-events: none;
  }
  .metric-tip:hover::after { opacity: 1; visibility: visible; }
  .heatmap th.site-name { text-align: left; font-weight: 400; white-space: nowrap; }
  .heatmap th.cohort-row { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 12px; letter-spacing: .05em; padding: 8px 4px; }
  .heatmap th.cohort-row.walmart { color: #0071ce; }
  .heatmap th.cohort-row.competencia { color: #c25400; }
  .sites-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .site-col h3 { margin: 0 0 8px; font-size: 14px; }
  .site-col h3.walmart { color: #0071ce; }
  .site-col h3.competencia { color: #c25400; }
  .site-col ul { margin: 0; padding-left: 18px; font-size: 13px; }
  .site-col li { margin-bottom: 4px; }
  .site-col .origin { color: var(--muted); }
  .site-col .country { display: inline-block; background: #eee; border-radius: 4px; padding: 0 5px; font-size: 11px; color: var(--muted); }
  .site-col .nodata { display: inline-block; background: var(--poor-bg); color: var(--poor); border-radius: 4px; padding: 0 5px; font-size: 11px; }
  @media (max-width: 700px) { .sites-grid { grid-template-columns: 1fr; } }
  footer { color: var(--muted); font-size: 12px; text-align: center; padding: 16px; }
</style>
</head>
<body>
<header>
  <h1>Walmart vs Competencia — Métricas CrUX (móvil)</h1>
  <p>Período de recolección: ${periodStart} → ${periodEnd} (ventana de 28 días) · Form factor: PHONE · Percentil 75 por sitio · Generado: ${new Date().toISOString().slice(0, 10)}</p>
</header>
<main>
  <section>
    <h2>Sitios evaluados</h2>
    <div class="sites-grid">
${cohortSitesHtml}
    </div>
  </section>
  <section class="legend">
    <h2>Escala de colores (umbrales Core Web Vitals)</h2>
    <div class="gradient-bar"></div>
    <div class="gradient-labels"><span>Bueno</span><span>Necesita mejora</span><span>Pobre</span><span>Muy por encima del umbral pobre</span></div>
    <table>
      <thead><tr><th>Métrica</th><th>Bueno</th><th>Necesita mejora</th><th>Pobre</th></tr></thead>
      <tbody>
${legendRows}
      </tbody>
    </table>
  </section>
${sections}
${heatmapSections}
</main>
<footer>FrictionTrace · Fuente: Chrome UX Report (CrUX) History API · Valores p75 por sitio en el último período; min/mediana/max calculados entre sitios de cada cohorte (cada sitio pesa igual) · % bueno = porcentaje de sitios de la cohorte con rating "bueno" en la métrica.</footer>
</body>
</html>
`;

  mkdirSync(resolve(process.cwd(), "reports"), { recursive: true });
  writeFileSync(OUT_PATH, html, "utf-8");

  console.log(`Reporte generado: ${OUT_PATH}`);
  console.log(`Período: ${periodStart} → ${periodEnd} · PHONE · Walmart: ${siteCounts.walmart.size} sitios, Competencia: ${siteCounts.competencia.size} sitios`);
}

main();
