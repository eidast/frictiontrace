import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
import type { Database as Db } from "better-sqlite3";
import { issuesRepo, factsRepo, runsRepo, screenshotsRepo } from "../storage/daos.js";
import type { FactRow, IssueRow, ScreenshotRow } from "../storage/types.js";
import { computeScore, scoreBand, severityCounts, topIssues } from "./score.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Register helpers
Handlebars.registerHelper("ifneq", function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
  return a !== b ? options.fn(this) : options.inverse(this);
});

function loadTemplate(name: string): HandlebarsTemplateDelegate {
  const path = join(__dirname, "templates", `${name}.hbs`);
  const src = readFileSync(path, "utf-8");
  return Handlebars.compile(src);
}

function loadAsset(name: string): string {
  const path = join(__dirname, "assets", name);
  return readFileSync(path, "utf-8");
}

const ISSUE_LABELS: Record<string, { kindLabel: string; clienteText: string; developerText: string }> = {
  js_error: {
    kindLabel: "Error de JavaScript",
    clienteText: "La página mostró errores internos no esperados. El usuario probablemente vio una página rota o un botón que no respondía.",
    developerText: "Inspeccioná las trazas en console/pageerror. Reproducí el paso y revisá si hay llamadas a APIs deprecadas o variables indefinidas.",
  },
  third_party_blocking: {
    kindLabel: "Vendor externo bloqueante",
    clienteText: "Un servicio externo (analytics, ads, chat) está demorando la página. El usuario percibió lentitud o congelamiento.",
    developerText: "Evaluá si el vendor es crítico. Si no, defer/async. Si sí, mové a web worker o tag con estrategia de carga asíncrona.",
  },
  slow_lcp: {
    kindLabel: "Carga visual lenta",
    clienteText: "El elemento más grande de la página tardó demasiado en aparecer. El usuario vio una página en blanco o incompleta durante más de 2.5 segundos.",
    developerText: "Optimizá la imagen o recurso que dispara el LCP. Preload, formato moderno (AVIF/WebP), o crítico inline.",
  },
  mixed_content: {
    kindLabel: "Contenido mixto",
    clienteText: "La página HTTPS está cargando recursos HTTP inseguros. El navegador puede bloquearlos, dejando la página incompleta.",
    developerText: "Asegurate que todas las URLs de assets sean HTTPS. Buscá http:// en el HTML y JS.",
  },
  checkout_broken: {
    kindLabel: "Checkout roto",
    clienteText: "Una llamada clave del carrito o checkout falló. El usuario probablemente no pudo completar la compra.",
    developerText: "Revisá los logs del endpoint. Es crítico: cada fallo acá es revenue perdido.",
  },
};

function describeIssue(issue: IssueRow) {
  const labels = ISSUE_LABELS[issue.kind] ?? { kindLabel: issue.kind, clienteText: issue.summary, developerText: "" };
  return { ...labels, severity: issue.severity, kind: issue.kind, summary: issue.summary, evidence: JSON.parse(issue.evidence_json) };
}

export interface RenderOptions {
  outDir: string;
}

export interface RenderResult {
  reportPath: string;
  score: number;
}

export function renderReport(db: Db, runId: string, opts: RenderOptions): RenderResult {
  const run = runsRepo.getById(db, runId);
  if (!run) throw new Error(`run ${runId} not found`);
  const issues = issuesRepo.getByRun(db, runId);
  const facts = factsRepo.getByRun(db, runId);
  const screenshots = screenshotsRepo.getByRun(db, runId);

  const score = computeScore(issues);
  const band = scoreBand(score);
  const sevCounts = severityCounts(issues);
  const top5 = topIssues(issues, 5);
  const factsMap = factsToMap(facts);
  const issueViews = issues.map(describeIssue);

  const tplExecutive = loadTemplate("executive");
  const tplCliente = loadTemplate("cliente");
  const tplDeveloper = loadTemplate("developer");
  const css = loadAsset("report.css");

  const date = new Date(run.started_at ?? Date.now()).toISOString();
  const executiveHtml = tplExecutive({
    targetUrl: run.target_url,
    date,
    runId,
    score,
    scoreBand: band,
    severityCounts: sevCounts,
    topIssues: top5.map((i) => ({ ...describeIssue(i) })),
  });
  const clienteHtml = tplCliente({ issues: issueViews });
  const developerHtml = tplDeveloper({ issues: issueViews });

  const screenshotsHtml = renderScreenshots(screenshots);

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>FrictionTrace — ${escapeHtml(run.target_url)}</title>
<style>${css}</style>
</head>
<body>
<main>
${executiveHtml}
${clienteHtml}
${developerHtml}
<section class="screenshots-section">
  <h2>Evidence (screenshots per step)</h2>
  <div class="screenshots">
    ${screenshotsHtml}
  </div>
</section>
<footer>
  <p class="meta">Run <code>${escapeHtml(runId)}</code> · facts: ${Object.keys(factsMap).length} · issues: ${issues.length}</p>
</footer>
</main>
</body>
</html>`;

  const reportPath = join(opts.outDir, "report.html");
  writeFileSync(reportPath, html, "utf-8");
  return { reportPath, score };
}

function factsToMap(facts: FactRow[]): Record<string, unknown> {
  const m: Record<string, unknown> = {};
  for (const f of facts) {
    try {
      m[f.key] = JSON.parse(f.value_json);
    } catch {
      m[f.key] = f.value_json;
    }
  }
  return m;
}

function renderScreenshots(screenshots: ScreenshotRow[]): string {
  if (screenshots.length === 0) return '<p class="empty">No screenshots captured.</p>';
  return screenshots
    .map(
      (s) => `<div class="screenshot">
        <img src="screenshots/${escapeHtml(basename(s.path))}" alt="${escapeHtml(s.kind)}">
        <div class="cap">${escapeHtml(s.kind)}</div>
      </div>`,
    )
    .join("\n");
}

function basename(p: string): string {
  return p.split(/[\\/]/).pop() ?? p;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}
