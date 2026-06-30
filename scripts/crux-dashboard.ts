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
  "largest_contentful_paint_resource_type",
  "largest_contentful_paint_image_time_to_first_byte",
  "largest_contentful_paint_image_resource_load_delay",
  "largest_contentful_paint_image_resource_load_duration",
  "largest_contentful_paint_image_element_render_delay",
  "navigation_types",
  "round_trip_time",
  "form_factors",
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

function buildFractionWhere(params: URLSearchParams): { clauses: string[]; values: unknown[] } {
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
    clauses.push("f.metric_name = ?");
    values.push(metric);
  }

  const ff = params.get("ff");
  if (ff) {
    clauses.push("f.form_factor = ?");
    values.push(ff);
  }

  const page = params.get("page");
  if (page) {
    clauses.push("q.page_type = ?");
    values.push(page);
  }

  const level = params.get("level");
  if (level === "url" || level === "origin") {
    clauses.push("f.query_level = ?");
    values.push(level);
  }

  const dateFrom = params.get("dateFrom");
  if (dateFrom) {
    clauses.push("f.collection_end >= ?");
    values.push(dateFrom);
  }

  const dateTo = params.get("dateTo");
  if (dateTo) {
    clauses.push("f.collection_start <= ?");
    values.push(dateTo);
  }

  return { clauses, values };
}

function removeWhereClause(
  where: { clauses: string[]; values: unknown[] },
  clauseToRemove: string,
): { clauses: string[]; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];
  let valueIdx = 0;

  for (const clause of where.clauses) {
    const valueCount = (clause.match(/\?/g) ?? []).length;
    const clauseValues = where.values.slice(valueIdx, valueIdx + valueCount);
    valueIdx += valueCount;
    if (clause === clauseToRemove) continue;
    clauses.push(clause);
    values.push(...clauseValues);
  }

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

  const fractions = db.prepare(`
    SELECT o.origin, o.label, o.group_name, q.page_type, q.query_level,
           f.metric_name, f.form_factor, f.category, f.fraction_value,
           f.collection_start, f.collection_end
    FROM crux_fractions f
    JOIN crux_queries q ON f.query_id = q.id
    JOIN crux_origins o ON q.origin_id = o.id
    ORDER BY f.collection_end ASC
  `).all();

  return { origins, snapshot, timeseries, dateRange, fractions };
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

      const today = new Date().toISOString().slice(0, 10);
      const headers = ["Site", "Origin", "Group", "Page", "Level", "Metric", "FF", "p75", "Good%", "NI%", "Poor%", "Category", "Fraction", "Period End"];

      const fractionWhere = buildFractionWhere(params);
      const fractionWhereClause = fractionWhere.clauses.length > 0 ? `WHERE ${fractionWhere.clauses.join(" AND ")}` : "";
      const fracRows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, q.page_type, f.query_level,
               f.metric_name, f.form_factor, f.category, f.fraction_value, f.collection_end
        FROM crux_fractions f
        JOIN crux_queries q ON f.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${fractionWhereClause}
        ORDER BY o.label, f.metric_name, f.category, f.collection_end
      `).all(...fractionWhere.values) as Array<Record<string, unknown>>;

      const metaLines = [
        "# CrUX Dashboard Export",
        `# Date: ${today}`,
        "# Source: crux.db",
        `# Records (histogram): ${rows.length}`,
        `# Records (fractions): ${fracRows.length}`,
        "#"
      ];
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
          "",
          "",
          r.collection_end,
        ].join(","));
      }
      for (const r of fracRows) {
        csvRows.push([
          `"${r.label ?? ""}"`,
          r.origin,
          r.group_name,
          r.page_type,
          r.query_level,
          r.metric_name,
          r.form_factor,
          "",
          "",
          "",
          "",
          r.category,
          r.fraction_value,
          r.collection_end,
        ].join(","));
      }

      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="crux-export-${today}.csv"`,
      });
      res.end(metaLines.concat(csvRows).join("\n"));
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

      const todayJson = new Date().toISOString().slice(0, 10);
      const meta = {
        exported_at: new Date().toISOString(),
        source: "crux.db",
        record_count: rows.length
      };
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="crux-export-${todayJson}.json"`,
      });

      const fractionWhere = buildFractionWhere(params);
      const fractionWhereClause = fractionWhere.clauses.length > 0 ? `WHERE ${fractionWhere.clauses.join(" AND ")}` : "";
      const fracRows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, q.page_type, f.query_level,
               f.metric_name, f.form_factor, f.category, f.fraction_value, f.collection_end
        FROM crux_fractions f
        JOIN crux_queries q ON f.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${fractionWhereClause}
        ORDER BY o.label, f.metric_name, f.category, f.collection_end
      `).all(...fractionWhere.values);

      res.end(JSON.stringify({ _metadata: meta, data: rows, fractions: fracRows }, null, 2));
      return;
    }

    if (path === "/api/fractions") {
      const { clauses, values } = buildFractionWhere(params);
      const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

      const rows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, q.page_type, f.query_level,
               f.metric_name, f.form_factor, f.category, f.fraction_value,
               f.collection_end
        FROM crux_fractions f
        JOIN crux_queries q ON f.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${whereClause}
        ORDER BY f.collection_end DESC
      `).all(...values);

      json(res, rows);
      return;
    }

    if (path === "/api/compare-grid") {
      const histogramWhere = removeWhereClause(buildWhere(params), "h.metric_name = ?");
      const fractionWhere = removeWhereClause(buildFractionWhere(params), "f.metric_name = ?");

      const metric = params.get("metric") ?? "largest_contentful_paint";
      const metricMeta = METRICS.includes(metric) ? metric : "largest_contentful_paint";
      const hWhereClause = histogramWhere.clauses.length > 0 ? `WHERE ${histogramWhere.clauses.join(" AND ")} AND h.metric_name = ?` : "WHERE h.metric_name = ?";
      const fWhereClause = fractionWhere.clauses.length > 0 ? `WHERE ${fractionWhere.clauses.join(" AND ")} AND f.metric_name = ?` : "WHERE f.metric_name = ?";

      const hRows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, h.metric_name, h.form_factor,
               h.p75_value, h.good_pct, h.ni_pct, h.poor_pct, h.collection_end
        FROM crux_history h
        JOIN crux_queries q ON h.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${hWhereClause}
        ORDER BY h.collection_end ASC
      `).all(...histogramWhere.values, metricMeta);

      const fRows = db.prepare(`
        SELECT o.label, o.origin, o.group_name, f.metric_name, f.form_factor,
               f.category, f.fraction_value, f.collection_end
        FROM crux_fractions f
        JOIN crux_queries q ON f.query_id = q.id
        JOIN crux_origins o ON q.origin_id = o.id
        ${fWhereClause}
        ORDER BY f.collection_end ASC
      `).all(...fractionWhere.values, metricMeta);

      const periodInfo = db.prepare(`
        SELECT DISTINCT collection_end FROM crux_history ORDER BY collection_end DESC LIMIT 2
      `).all() as Array<{ collection_end: string }>;

      const currPeriod = periodInfo[0]?.collection_end ?? null;
      const prevPeriod = periodInfo[1]?.collection_end ?? null;

      json(res, {
        metrics: [{ name: metricMeta, data: hRows }],
        fractions: fRows,
        periods: { current: currPeriod, previous: prevPeriod },
      });
      return;
    }

    if (path === "/api/meta") {
      const maxDate = db.prepare("SELECT MAX(collection_end) as max_date FROM crux_history").get() as { max_date: string };
      const urlCount = (db.prepare("SELECT COUNT(*) as cnt FROM crux_history WHERE query_level = 'url'").get() as { cnt: number }).cnt;
      const originCount = (db.prepare("SELECT COUNT(*) as cnt FROM crux_history WHERE query_level = 'origin'").get() as { cnt: number }).cnt;
      const total = urlCount + originCount;
      const periodCount = (db.prepare("SELECT COUNT(DISTINCT collection_end) as cnt FROM crux_history").get() as { cnt: number }).cnt;
      const totalSites = (db.prepare("SELECT COUNT(*) as cnt FROM crux_origins").get() as { cnt: number }).cnt;
      const sitesWithData = (db.prepare("SELECT COUNT(DISTINCT o.id) as cnt FROM crux_origins o JOIN crux_queries q ON q.origin_id = o.id JOIN crux_history h ON h.query_id = q.id").get() as { cnt: number }).cnt;
      const fracCount = (db.prepare("SELECT COUNT(*) as cnt FROM crux_fractions").get() as { cnt: number }).cnt;
      const fracMetrics = db.prepare("SELECT DISTINCT metric_name FROM crux_fractions").all() as Array<{ metric_name: string }>;

      json(res, {
        max_date: maxDate?.max_date || null,
        url_pct: total > 0 ? (urlCount / total * 100).toFixed(1) : 0,
        origin_pct: total > 0 ? (originCount / total * 100).toFixed(1) : 0,
        period_count: periodCount,
        sites_with_data: sitesWithData,
        total_sites: totalSites,
        fraction_count: fracCount,
        fraction_metrics: fracMetrics.map((r) => r.metric_name),
      });
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
