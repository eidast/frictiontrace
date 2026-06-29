#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { openCruxDb, closeCruxDb, type CruxDb } from "../engine/src/crux/db.js";

const CRUX_DIR = resolve(process.cwd(), "engine", "src", "crux");
const D3_PATH = join(CRUX_DIR, "d3.v7.min.js");
const D3_URL = "https://d3js.org/d3.v7.min.js";
const DB_PATH = resolve(process.cwd(), "data", "crux.db");
const REPORTS_DIR = resolve(process.cwd(), "reports");
const PORT = parseInt(process.env.CRUX_DASHBOARD_PORT ?? "3000", 10);

const METRICS = [
  "largest_contentful_paint",
  "cumulative_layout_shift",
  "interaction_to_next_paint",
  "first_contentful_paint",
  "experimental_time_to_first_byte",
];

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function jsonError(res: ServerResponse, message: string, status = 500): void {
  json(res, { error: message }, status);
}

function getQueryParams(req: IncomingMessage): URLSearchParams {
  const idx = (req.url ?? "").indexOf("?");
  return new URLSearchParams(idx >= 0 ? req.url!.slice(idx + 1) : "");
}

function buildWhere(params: URLSearchParams): { clauses: string[]; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];

  const group = params.get("group");
  if (group) {
    clauses.push("o.group_name = ?");
    values.push(group);
  }

  const sites = params.get("sites");
  if (sites) {
    const siteList = sites.split(",").filter(Boolean);
    if (siteList.length > 0) {
      clauses.push(`o.origin IN (${siteList.map(() => "?").join(",")})`);
      values.push(...siteList);
    }
  }

  const metric = params.get("metric");
  if (metric) {
    clauses.push("h.metric_name = ?");
    values.push(metric);
  }

  const ff = params.get("ff");
  if (ff) {
    clauses.push("h.form_factor = ?");
    values.push(ff);
  }

  const page = params.get("page");
  if (page) {
    clauses.push("q.page_type = ?");
    values.push(page);
  }

  const level = params.get("level");
  if (level === "url" || level === "origin") {
    clauses.push("h.query_level = ?");
    values.push(level);
  }

  const dateFrom = params.get("dateFrom");
  if (dateFrom) {
    clauses.push("h.collection_end >= ?");
    values.push(dateFrom);
  }

  const dateTo = params.get("dateTo");
  if (dateTo) {
    clauses.push("h.collection_start <= ?");
    values.push(dateTo);
  }

  clauses.push("h.good_pct IS NOT NULL");

  return { clauses, values };
}

function serveStatic(res: ServerResponse, filePath: string, mime: string): void {
  try {
    const content = readFileSync(filePath, "utf-8");
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function downloadD3(): Promise<boolean> {
  if (existsSync(D3_PATH)) return true;
  console.log("Downloading D3.js v7...");
  try {
    const resp = await fetch(D3_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const js = await resp.text();
    writeFileSync(D3_PATH, js, "utf-8");
    console.log(`D3.js saved to ${D3_PATH}`);
    return true;
  } catch (err) {
    console.error(`Failed to download D3.js: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function buildDashboard(db: CruxDb): string {
  const html = readFileSync(join(CRUX_DIR, "dashboard.html"), "utf-8");
  const css = readFileSync(join(CRUX_DIR, "dashboard.css"), "utf-8");
  const js = readFileSync(join(CRUX_DIR, "dashboard.js"), "utf-8");
  const d3 = existsSync(D3_PATH) ? readFileSync(D3_PATH, "utf-8") : "";

  const data = getDashboardData(db);

  return html
    .replace('<link rel="stylesheet" href="dashboard.css">', `<style>${css}</style>`)
    .replace('<script src="dashboard.js"></script>', "")
    .replace("</body>", `<script>${d3}</script><script>${js}</script><script>window.CRUX_DATA = ${JSON.stringify(data)};</script></body>`);
}

function getDashboardData(db: CruxDb): unknown {
  const origins = db.prepare("SELECT * FROM crux_origins").all();

  const snapshot = db.prepare(`
    SELECT o.origin, o.label, o.group_name, q.page_type, q.query_level,
           h.metric_name, h.form_factor, h.p75_value, h.good_pct, h.ni_pct, h.poor_pct,
           h.collection_start, h.collection_end
    FROM crux_history h
    JOIN crux_queries q ON h.query_id = q.id
    JOIN crux_origins o ON q.origin_id = o.id
    WHERE h.good_pct IS NOT NULL
    ORDER BY h.collection_end ASC
  `).all();

  const timeseries = db.prepare(`
    SELECT o.origin, o.label, q.page_type, q.query_level,
           h.metric_name, h.form_factor, h.p75_value, h.good_pct, h.ni_pct, h.poor_pct,
           h.collection_start, h.collection_end
    FROM crux_history h
    JOIN crux_queries q ON h.query_id = q.id
    JOIN crux_origins o ON q.origin_id = o.id
    WHERE h.good_pct IS NOT NULL
    ORDER BY h.collection_end ASC
  `).all();

  const dateRange = db.prepare(`
    SELECT MIN(collection_start) as min_date, MAX(collection_end) as max_date
    FROM crux_history
  `).get() as { min_date: string; max_date: string };

  return { origins, snapshot, timeseries, dateRange };
}

function handleApi(req: IncomingMessage, res: ServerResponse, db: CruxDb): void {
  const url = req.url ?? "";
  const path = url.split("?")[0];
  const params = getQueryParams(req);

  try {
    if (path === "/api/sites") {
      const rows = db.prepare("SELECT origin, label, group_name, country FROM crux_origins ORDER BY group_name, label").all();
      json(res, rows);
      return;
    }

    if (path === "/api/summary") {
      const { clauses, values } = buildWhere(params);

      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const metric = params.get("metric") ?? "largest_contentful_paint";

      const avg = db.prepare(`
        SELECT AVG(h.good_pct) as avg_good, AVG(h.ni_pct) as avg_ni, AVG(h.poor_pct) as avg_poor
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
      `).all(...values) as Array<{ avg_good: number; avg_ni: number; avg_poor: number }>;

      const top5 = db.prepare(`
        SELECT o.label, o.origin, o.group_name,
               h.p75_value, h.good_pct, h.ni_pct, h.poor_pct
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
        ORDER BY h.good_pct DESC
        LIMIT 5
      `).all(...values);

      const bottom5 = db.prepare(`
        SELECT o.label, o.origin, o.group_name,
               h.p75_value, h.good_pct, h.ni_pct, h.poor_pct
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
        ORDER BY h.good_pct ASC
        LIMIT 5
      `).all(...values);

      const byGroupClauses = [...clauses];
      const metricIdx = byGroupClauses.indexOf("h.metric_name = ?");
      const byGroupValues = [...values];
      if (metricIdx !== -1) {
        byGroupClauses.splice(metricIdx, 1);
        byGroupValues.splice(metricIdx, 1);
      }
      const byGroupWhere = byGroupClauses.length > 0 ? `WHERE ${byGroupClauses.join(" AND ")}` : "";

      const byGroup = db.prepare(`
        SELECT o.group_name, h.metric_name, h.form_factor,
               AVG(h.good_pct) as avg_good, AVG(h.ni_pct) as avg_ni, AVG(h.poor_pct) as avg_poor,
               COUNT(DISTINCT o.origin) as site_count
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${byGroupWhere}
        GROUP BY o.group_name, h.metric_name, h.form_factor
        ORDER BY o.group_name, h.metric_name
      `).all(...byGroupValues);

      json(res, { avg: avg[0] ?? {}, top5, bottom5, byGroup });
      return;
    }

    if (path === "/api/compare") {
      const { clauses, values } = buildWhere(params);
      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

      const rows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, q.page_type, h.query_level,
               h.metric_name, h.form_factor, h.p75_value, h.good_pct, h.ni_pct, h.poor_pct,
               h.collection_end
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
        ORDER BY h.good_pct DESC
      `).all(...values);

      json(res, rows);
      return;
    }

    if (path === "/api/timeseries") {
      const { clauses, values } = buildWhere(params);
      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

      const rows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, h.query_level,
               h.metric_name, h.form_factor, h.p75_value, h.good_pct, h.ni_pct, h.poor_pct,
               h.collection_start, h.collection_end
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
        ORDER BY h.collection_end ASC
      `).all(...values);

      json(res, rows);
      return;
    }

    if (path === "/api/export/csv") {
      const { clauses, values } = buildWhere(params);
      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

      const rows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, q.page_type, h.query_level,
               h.metric_name, h.form_factor, h.p75_value, h.good_pct, h.ni_pct, h.poor_pct,
               h.collection_end
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
        ORDER BY o.label, h.metric_name, h.collection_end
      `).all(...values) as Array<Record<string, unknown>>;

      const headers = ["Site", "Origin", "Group", "Page", "Level", "Metric", "FF", "p75", "Good%", "NI%", "Poor%", "Period End"];
      const csvRows = [headers.join(",")];
      for (const r of rows) {
        csvRows.push([
          `"${r.label ?? ""}"`,
          r.origin,
          r.group_name,
          r.page_type,
          r.query_level,
          r.metric_name,
          r.form_factor,
          r.p75_value ?? "",
          r.good_pct ?? "",
          r.ni_pct ?? "",
          r.poor_pct ?? "",
          r.collection_end,
        ].join(","));
      }

      const today = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="crux-export-${today}.csv"`,
      });
      res.end(csvRows.join("\n"));
      return;
    }

    if (path === "/api/export/json") {
      const { clauses, values } = buildWhere(params);
      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

      const rows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, q.page_type, h.query_level,
               h.metric_name, h.form_factor, h.p75_value, h.good_pct, h.ni_pct, h.poor_pct,
               h.collection_end
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
        ORDER BY o.label, h.metric_name, h.collection_end
      `).all(...values);

      const today = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="crux-export-${today}.json"`,
      });
      res.end(JSON.stringify(rows, null, 2));
      return;
    }

    jsonError(res, "Not found", 404);
  } catch (err) {
    jsonError(res, err instanceof Error ? err.message : "Internal error");
  }
}

function startServer(db: CruxDb): void {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    const path = url.split("?")[0];

    if (path === "/" || path === "/index.html") {
      serveStatic(res, join(CRUX_DIR, "dashboard.html"), MIME[".html"]);
      return;
    }
    if (path === "/dashboard.css") {
      serveStatic(res, join(CRUX_DIR, "dashboard.css"), MIME[".css"]);
      return;
    }
    if (path === "/dashboard.js") {
      serveStatic(res, join(CRUX_DIR, "dashboard.js"), MIME[".js"]);
      return;
    }
    if (path === "/d3.v7.min.js") {
      serveStatic(res, D3_PATH, MIME[".js"]);
      return;
    }
    if (path.startsWith("/api/")) {
      handleApi(req, res, db);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    }
    console.error("Server error:", err.message);
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`\nCrUX Dashboard running at http://localhost:${PORT}\n`);
    console.log("Press Ctrl+C to stop.\n");
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    closeCruxDb(db);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--build") ? "build" : "serve";

  if (!existsSync(DB_PATH)) {
    console.error("Base de datos no encontrada.");
    console.error("Ejecutá `npx tsx scripts/crux-sync.ts` para reconstruir la información o contactá al administrador.");
    process.exit(1);
  }

  const d3ok = await downloadD3();
  if (!d3ok) {
    console.error("D3.js is required but could not be downloaded and is not present locally.");
    process.exit(1);
  }

  const db = openCruxDb();

  if (mode === "build") {
    console.log("Building dashboard...");
    mkdirSync(REPORTS_DIR, { recursive: true });
    const html = buildDashboard(db);
    const outPath = join(REPORTS_DIR, "crux-dashboard.html");
    writeFileSync(outPath, html, "utf-8");
    console.log(`Dashboard written to ${outPath}`);
    closeCruxDb(db);
    return;
  }

  startServer(db);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
