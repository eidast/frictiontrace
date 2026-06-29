#!/usr/bin/env node
import { openCruxDb, closeCruxDb } from "../engine/src/crux/db.js";
import {
  getMetricsByGroup,
  getMetricsByPageType,
  getTimeSeries,
  getLatestSnapshot,
} from "../engine/src/crux/queries.js";

function formatP75(value: string | null): string {
  if (value === null) return "N/A";
  const n = Number(value);
  if (isNaN(n)) return value;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}s`;
  return `${n}ms`;
}

function formatPct(value: number | null): string {
  if (value === null) return "N/A";
  return `${(value * 100).toFixed(1)}%`;
}

function pad(str: string, len: number): string {
  return str.padEnd(len, " ");
}

function printTable(headers: string[], rows: string[][]): void {
  const colWidths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => r[i]?.length ?? 0)),
  );
  const sep = colWidths.map((w) => "-".repeat(w)).join("-+-");
  console.log(headers.map((h, i) => pad(h, colWidths[i])).join(" | "));
  console.log(sep);
  for (const row of rows) {
    console.log(row.map((c, i) => pad(c, colWidths[i])).join(" | "));
  }
  console.log();
}

function printSection(title: string): void {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(72)}\n`);
}

const db = openCruxDb();

printSection("CrUX Analytics Report");

// ---------------------------------------------------------------------------
// Top 5 peores checkouts mobile por LCP p75
// ---------------------------------------------------------------------------
printSection("1. Top 5 Worst Checkout LCP — Mobile");

const checkoutMetrics = getMetricsByPageType(db, "checkout");
const checkoutLcp = checkoutMetrics
  .filter((m) => m.metric_name === "largest_contentful_paint" && m.form_factor === "PHONE" && m.p75_value !== null)
  .sort((a, b) => {
    const aVal = Number(a.p75_value) || 0;
    const bVal = Number(b.p75_value) || 0;
    return bVal - aVal;
  })
  .slice(0, 5);

if (checkoutLcp.length > 0) {
  const rows = checkoutLcp.map((m) => [
    m.label,
    formatP75(m.p75_value),
    formatPct(m.good_pct),
    formatPct(m.ni_pct),
    formatPct(m.poor_pct),
  ]);
  printTable(["Site", "p75 LCP", "Good", "Needs Impr.", "Poor"], rows);
} else {
  console.log("No checkout LCP data available.\n");
}

// ---------------------------------------------------------------------------
// Comparativa Walmart propios vs subsidiarias vs otros (todas las métricas, último snapshot)
// ---------------------------------------------------------------------------
printSection("2. Group Comparison — Latest Snapshot (All Metrics, Mobile)");

const groups = ["walmart_propios", "walmart_subsidiarias", "otros"] as const;
const metricNames = [
  "largest_contentful_paint",
  "cumulative_layout_shift",
  "interaction_to_next_paint",
  "first_contentful_paint",
  "experimental_time_to_first_byte",
];

const groupRows: string[][] = [];
for (const group of groups) {
  const metrics = getMetricsByGroup(db, group);
  const mobile = metrics.filter((m) => m.form_factor === "PHONE");
  for (const mn of metricNames) {
    const m = mobile.find((x) => x.metric_name === mn);
    if (!m || m.avg_good_pct === null) continue;
    groupRows.push([
      group,
      mn.replace(/_/g, " ").replace("experimental ", ""),
      formatPct(m.avg_good_pct),
      formatPct(m.avg_ni_pct),
      formatPct(m.avg_poor_pct),
    ]);
  }
}

if (groupRows.length > 0) {
  printTable(["Group", "Metric", "Good %", "Needs Impr. %", "Poor %"], groupRows);
} else {
  console.log("No group comparison data available.\n");
}

// ---------------------------------------------------------------------------
// Tendencia de INP mobile para los 3 peores sitios (últimos 6 meses)
// ---------------------------------------------------------------------------
printSection("3. INP Trend — Top 3 Worst Sites (Mobile, last 6 months)");

const snapshot = getLatestSnapshot(db);
const inpWorst = snapshot
  .filter((s) => s.metric_name === "interaction_to_next_paint" && s.form_factor === "PHONE" && s.p75_value !== null)
  .sort((a, b) => {
    const aVal = Number(a.p75_value) || 0;
    const bVal = Number(b.p75_value) || 0;
    return bVal - aVal;
  })
  .slice(0, 3);

const worstOrigins = inpWorst.map((s) => s.origin);
const uniqueWorst = [...new Set(worstOrigins)].slice(0, 3);

for (const origin of uniqueWorst) {
  const ts = getTimeSeries(db, origin, "interaction_to_next_paint", "PHONE");
  if (ts.length === 0) {
    console.log(`  ${origin}: No INP time-series data\n`);
    continue;
  }
  console.log(`  ${origin}:`);
  const rows = ts
    .filter((r) => r.p75_value !== null)
    .map((r) => [
      r.collection_end,
      formatP75(r.p75_value),
      formatPct(r.good_pct),
      formatPct(r.ni_pct),
      formatPct(r.poor_pct),
    ]);
  if (rows.length > 0) {
    printTable(["Period End", "p75 INP", "Good", "Needs Impr.", "Poor"], rows);
  }
}

// ---------------------------------------------------------------------------
// Latest snapshot summary
// ---------------------------------------------------------------------------
printSection("4. Full Latest Snapshot — All Sites, All Metrics, Mobile");

const latestMobile = snapshot.filter((s) => s.form_factor === "PHONE");
const summaryRows = latestMobile.map((s) => [
  s.label,
  s.page_type,
  s.metric_name.replace(/_/g, " ").replace("experimental ", ""),
  s.query_level,
  formatP75(s.p75_value),
  formatPct(s.good_pct),
]);
printTable(["Site", "Page", "Metric", "Level", "p75", "Good %"], summaryRows);

closeCruxDb(db);
console.log("Done.\n");
