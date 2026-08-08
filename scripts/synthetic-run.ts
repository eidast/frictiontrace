#!/usr/bin/env node
import { parse as parseYaml } from "yaml";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import lighthouse from "lighthouse";
import { launch as launchChrome, type LaunchedChrome } from "chrome-launcher";
import { CruxPagesConfig, type CruxSiteConfigT, type CruxPageEntryT } from "../engine/src/crux/config-schema.js";
import { openCruxDb, closeCruxDb, type CruxDb } from "../engine/src/crux/db.js";

const CONFIG_PATH = resolve(process.cwd(), "engine", "crux-pages.yaml");

const USAGE = `Usage: npx tsx scripts/synthetic-run.ts [options]

Runs synthetic Lighthouse audits over the sites/pages in engine/crux-pages.yaml
and stores metrics in data/crux.db.

Options:
  --site <origin>        Only audit pages of this origin (e.g. www.walmart.com.gt)
  --page <type>          Only audit this page type (homepage|checkout|plp|pdp)
  --form-factor <ff>     mobile (default) | desktop | both
                         Desktop audits default to the broadband throttling
                         profile; mobile audits default to fast4g.
  --label <text>         Free-text label stored on every row of this run
  --suite-version <v>    Suite version tag (default: v1)
  --concurrency <n>      Parallel workers, each in its own process with its own
                         Chrome instance (integer, default 1 = sequential, max 4)
  --throttling-profile <name>
                         Override the simulated throttling profile for ALL
                         targets (by default mobile uses fast4g, desktop uses
                         broadband):
                           fast4g     RTT 60 ms, 9 Mbps down / 1.5 Mbps up, 2x CPU
                                      (realistic median mobile, Central America 2026)
                           slow4g     RTT 150 ms, 1.6 Mbps down / 0.75 Mbps up, 4x CPU
                                      (Lighthouse default, kept as stress test)
                           broadband  RTT 40 ms, 20 Mbps down / 5 Mbps up, 1x CPU
                                      (fixed-line desktop)
  --list                 List past runs and exit
  --exclude <run_id>     Mark all rows of a run as excluded and exit
  --include <run_id>     Clear the excluded flag for all rows of a run and exit
  --help                 Show this help
`;

interface CliArgs {
  site?: string;
  page?: string;
  label: string;
  suiteVersion: string;
  concurrency: number;
  throttlingProfile?: string;
  formFactor: FormFactorChoice;
  list: boolean;
  exclude?: string;
  include?: string;
  help: boolean;
}

type FormFactor = "mobile" | "desktop";
type FormFactorChoice = FormFactor | "both";

interface AuditTarget {
  site: CruxSiteConfigT;
  page: CruxPageEntryT;
  formFactor: FormFactor;
}

/** Per-target throttling profile: explicit --throttling-profile wins;
 *  otherwise desktop defaults to broadband, mobile to fast4g. */
function profileForTarget(args: CliArgs, formFactor: FormFactor): string {
  return args.throttlingProfile ?? (formFactor === "desktop" ? "broadband" : "fast4g");
}

interface RunSummaryRow {
  run_id: string;
  fetched_at: number;
  label: string;
  suite_version: string;
  row_count: number;
  excluded: number;
}

interface AuditMetrics {
  lcp_ms: number | null;
  fcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  speed_index_ms: number | null;
  ttfb_ms: number | null;
  total_byte_weight: number | null;
  performance_score: number | null;
  lighthouse_version: string | null;
}

interface ImageFinding {
  audit_id: string;
  resource_url: string;
  total_bytes: number | null;
  wasted_bytes: number | null;
  wasted_pct: number | null;
  displayed_width: number | null;
  displayed_height: number | null;
}

/** Per-page image byte stats, aggregated from the network-requests audit. */
interface PageImageStats {
  image_bytes_modern: number;
  image_bytes_legacy: number;
  image_bytes_third_party: number;
  image_count: number;
}

// Lighthouse image audits whose detail items are persisted to image_findings.
// Lighthouse 13 removed the legacy byte-savings audits (modern-image-formats,
// uses-optimized-images, uses-responsive-images, offscreen-images); their
// findings now live in image-delivery-insight. unsized-images still exists.
const IMAGE_AUDIT_IDS = [
  "image-delivery-insight",
  "unsized-images",
] as const;

/** Wire format sent from parent to worker: one target per audit message. */
interface WireTarget {
  origin: string;
  group: string;
  pageType: string;
  url: string;
  formFactor: FormFactor;
  throttlingProfile: string;
}

const MAX_CONCURRENCY = 4;

interface ThrottlingProfile {
  rttMs: number;
  throughputKbps: number;
  uploadThroughputKbps: number;
  cpuSlowdownMultiplier: number;
}

// Simulated throttling profiles. fast4g is the default for mobile: a realistic
// median mobile user in Central America 2026. slow4g is Lighthouse's built-in
// default, kept as a stress test. broadband is the desktop default: fixed-line.
const THROTTLING_PROFILES: Record<string, ThrottlingProfile> = {
  fast4g: {
    rttMs: 60,
    throughputKbps: 9216,
    uploadThroughputKbps: 1536,
    cpuSlowdownMultiplier: 2,
  },
  slow4g: {
    rttMs: 150,
    throughputKbps: 1638,
    uploadThroughputKbps: 750,
    cpuSlowdownMultiplier: 4,
  },
  broadband: {
    rttMs: 40,
    throughputKbps: 20480,
    uploadThroughputKbps: 5120,
    cpuSlowdownMultiplier: 1,
  },
};

const DEFAULT_THROTTLING_PROFILE = "fast4g";

function parseThrottlingProfile(raw: string | undefined): string {
  const name = raw ?? "";
  if (!(name in THROTTLING_PROFILES)) {
    console.error(
      `Error: unknown throttling profile "${name}". Valid profiles: ${Object.keys(THROTTLING_PROFILES).join(", ")}.`
    );
    process.exit(1);
  }
  return name;
}

function parseConcurrency(raw: string | undefined): number {
  const value = Number(raw);
  if (raw === undefined || raw === "" || !Number.isInteger(value) || value < 1) {
    console.error(
      `Error: --concurrency must be a positive integer (1-${MAX_CONCURRENCY}), got "${raw ?? ""}".`
    );
    process.exit(1);
  }
  return Math.min(value, MAX_CONCURRENCY);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    label: "",
    suiteVersion: "v1",
    concurrency: 1,
    formFactor: "mobile",
    list: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--site":
        args.site = argv[++i];
        break;
      case "--page":
        args.page = argv[++i];
        break;
      case "--form-factor": {
        const raw = argv[++i] ?? "";
        if (raw !== "mobile" && raw !== "desktop" && raw !== "both") {
          console.error(`Error: --form-factor must be mobile|desktop|both, got "${raw}".`);
          process.exit(1);
        }
        args.formFactor = raw;
        break;
      }
      case "--label":
        args.label = argv[++i] ?? "";
        break;
      case "--suite-version":
        args.suiteVersion = argv[++i] ?? "v1";
        break;
      case "--concurrency":
        args.concurrency = parseConcurrency(argv[++i]);
        break;
      case "--throttling-profile":
        args.throttlingProfile = parseThrottlingProfile(argv[++i]);
        break;
      case "--list":
        args.list = true;
        break;
      case "--exclude":
        args.exclude = argv[++i];
        break;
      case "--include":
        args.include = argv[++i];
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        console.error(`Unknown argument: ${arg}\n`);
        process.stdout.write(USAGE);
        process.exit(1);
    }
  }
  return args;
}

function newRunId(): string {
  const now = new Date();
  const stamp =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const rand = randomBytes(4)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 6)
    .padEnd(6, "0");
  return `run_${stamp}_${rand}`;
}

function newRowId(): string {
  return `srun_${randomBytes(12).toString("hex")}`;
}

function newFindingId(): string {
  return `ifind_${randomBytes(12).toString("hex")}`;
}

function loadConfig(): { config: ReturnType<typeof CruxPagesConfig.parse>; configHash: string } {
  const raw = readFileSync(CONFIG_PATH, "utf-8");
  const configHash = createHash("sha256").update(raw).digest("hex").slice(0, 12);
  const parsed = parseYaml(raw);
  const validated = CruxPagesConfig.safeParse(parsed);
  if (!validated.success) {
    console.error("Invalid crux-pages.yaml:");
    for (const issue of validated.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return { config: validated.data, configHash };
}

function collectTargets(config: ReturnType<typeof CruxPagesConfig.parse>, args: CliArgs): AuditTarget[] {
  const targets: AuditTarget[] = [];
  const formFactors: FormFactor[] =
    args.formFactor === "both" ? ["mobile", "desktop"] : [args.formFactor];
  for (const site of config.sites) {
    if (!site.enabled) continue;
    if (args.site && site.origin !== args.site) continue;
    for (const page of site.pages) {
      if (!page.enabled) continue;
      if (!page.url) continue;
      if (args.page && page.type !== args.page) continue;
      for (const formFactor of formFactors) {
        targets.push({ site, page, formFactor });
      }
    }
  }
  return targets;
}

function listRuns(db: CruxDb): void {
  const rows = db
    .prepare(
      `SELECT run_id, MIN(fetched_at) AS fetched_at, label, suite_version,
              COUNT(*) AS row_count, MAX(excluded) AS excluded
       FROM synthetic_runs
       GROUP BY run_id
       ORDER BY fetched_at DESC`
    )
    .all() as RunSummaryRow[];

  if (rows.length === 0) {
    console.log("No synthetic runs found.");
    return;
  }
  console.log("Synthetic runs:");
  for (const row of rows) {
    const date = new Date(row.fetched_at * 1000).toISOString();
    const status = row.excluded ? "excluded" : "included";
    console.log(
      `  ${row.run_id}  ${date}  ${row.row_count} row(s)  suite=${row.suite_version}  ${status}  label="${row.label}"`
    );
  }
}

function setExcluded(db: CruxDb, runId: string, excluded: 0 | 1): void {
  const existing = db
    .prepare("SELECT COUNT(*) AS n FROM synthetic_runs WHERE run_id = ?")
    .get(runId) as { n: number };
  if (existing.n === 0) {
    console.error(`Error: run_id "${runId}" not found. Use --list to see past runs.`);
    process.exit(1);
  }
  db.prepare("UPDATE synthetic_runs SET excluded = ? WHERE run_id = ?").run(excluded, runId);
  console.log(
    `Run ${runId}: ${existing.n} row(s) marked as ${excluded ? "excluded" : "included"}.`
  );
}

function metricValue(result: any, auditId: string): number | null {
  const value = result?.lhr?.audits?.[auditId]?.numericValue;
  return typeof value === "number" ? value : null;
}

function extractImageFindings(result: any): ImageFinding[] {
  // Dedupe by (audit_id, resource_url): image-delivery-insight emits one item
  // per DOM node referencing the same resource, with identical wastedBytes —
  // keep the max so savings are not double-counted.
  const byKey = new Map<string, ImageFinding>();
  for (const auditId of IMAGE_AUDIT_IDS) {
    const items = result?.lhr?.audits?.[auditId]?.details?.items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (typeof item?.url !== "string" || !item.url) continue;
      const totalBytes = typeof item.totalBytes === "number" ? item.totalBytes : null;
      const wastedBytes = typeof item.wastedBytes === "number" ? item.wastedBytes : null;
      const wastedPct =
        totalBytes !== null && totalBytes > 0 && wastedBytes !== null
          ? (wastedBytes / totalBytes) * 100
          : null;
      const rect = item?.node?.boundingRect;
      const displayedWidth = typeof rect?.width === "number" && rect.width > 0 ? rect.width : null;
      const displayedHeight = typeof rect?.height === "number" && rect.height > 0 ? rect.height : null;
      const key = `${auditId} ${item.url}`;
      const existing = byKey.get(key);
      if (existing && (existing.wasted_bytes ?? 0) >= (wastedBytes ?? 0)) continue;
      byKey.set(key, {
        audit_id: auditId,
        resource_url: item.url,
        total_bytes: totalBytes,
        wasted_bytes: wastedBytes,
        wasted_pct: wastedPct,
        displayed_width: displayedWidth,
        displayed_height: displayedHeight,
      });
    }
  }
  return [...byKey.values()];
}

/**
 * LCP image prioritization checks, read from lcp-discovery-insight (Lighthouse 13):
 * the first detail item is a checklist {priorityHinted, requestDiscoverable,
 * eagerlyLoaded}, the second is the LCP node whose snippet carries the src URL.
 * These are priority findings, not byte savings: byte columns stay NULL.
 */
function extractLcpFindings(result: any): ImageFinding[] {
  const items = result?.lhr?.audits?.["lcp-discovery-insight"]?.details?.items;
  if (!Array.isArray(items)) return [];
  const checklist = items.find((i: any) => i?.type === "checklist")?.items;
  const node = items.find((i: any) => i?.type === "node");
  if (!checklist || !node) return []; // LCP is not an image (or no checklist): nothing to check
  const src = typeof node.snippet === "string" ? node.snippet.match(/src="([^"]+)"/)?.[1] : null;
  if (!src) return [];

  const blank = (auditId: string): ImageFinding => ({
    audit_id: auditId,
    resource_url: src,
    total_bytes: null,
    wasted_bytes: null,
    wasted_pct: null,
    displayed_width: typeof node.boundingRect?.width === "number" ? node.boundingRect.width : null,
    displayed_height: typeof node.boundingRect?.height === "number" ? node.boundingRect.height : null,
  });

  const findings: ImageFinding[] = [];
  if (checklist.eagerlyLoaded?.value === false) findings.push(blank("lcp-lazy-loaded"));
  if (checklist.priorityHinted?.value === false) findings.push(blank("lcp-missing-fetchpriority"));
  if (checklist.requestDiscoverable?.value === false) findings.push(blank("lcp-not-discoverable"));
  return findings;
}

const VTEX_CDN_HOST = /(^|\.)(vtexassets\.com|vteximg\.com\.br)$/;
// VTEX serves the full-resolution original when the URL lacks the -{w}-{h}
// resize segment (per VTEX docs). Raster images only; SVGs are dimensionless.
const VTEX_RESIZE_SEGMENT = /-\d+-\d+(?=[./?]|$)/;

function extractVtexFindings(result: any): ImageFinding[] {
  const items = result?.lhr?.audits?.["network-requests"]?.details?.items;
  if (!Array.isArray(items)) return [];
  const findings: ImageFinding[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item?.resourceType !== "Image" || typeof item?.url !== "string") continue;
    if (item.url.startsWith("data:")) continue;
    if (typeof item?.mimeType === "string" && item.mimeType.includes("svg")) continue;
    let host: string;
    let pathname: string;
    try {
      const u = new URL(item.url);
      host = u.hostname;
      pathname = u.pathname;
    } catch {
      continue;
    }
    if (!VTEX_CDN_HOST.test(host)) continue;
    if (VTEX_RESIZE_SEGMENT.test(pathname)) continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    findings.push({
      audit_id: "vtex-fullres-image",
      resource_url: item.url,
      total_bytes: typeof item.transferSize === "number" ? item.transferSize : null,
      wasted_bytes: null,
      wasted_pct: null,
      displayed_width: null,
      displayed_height: null,
    });
  }
  return findings;
}

/** Byte split of image requests: modern (AVIF/WebP) vs legacy raster vs
 *  third-party hosts. SVGs count as legacy for the split; data: URLs ignored. */
function extractPageImageStats(result: any, auditedUrl: string): PageImageStats {
  const items = result?.lhr?.audits?.["network-requests"]?.details?.items;
  const stats: PageImageStats = {
    image_bytes_modern: 0,
    image_bytes_legacy: 0,
    image_bytes_third_party: 0,
    image_count: 0,
  };
  if (!Array.isArray(items)) return stats;
  let auditedHost = "";
  try {
    auditedHost = new URL(auditedUrl).hostname;
  } catch {
    // keep empty: everything counts as third-party
  }
  for (const item of items) {
    if (item?.resourceType !== "Image" || typeof item?.url !== "string") continue;
    if (item.url.startsWith("data:")) continue;
    const bytes = typeof item.transferSize === "number" ? item.transferSize : 0;
    stats.image_count++;
    const mime = typeof item?.mimeType === "string" ? item.mimeType : "";
    if (mime === "image/avif" || mime === "image/webp") {
      stats.image_bytes_modern += bytes;
    } else {
      stats.image_bytes_legacy += bytes;
    }
    let host = "";
    try {
      host = new URL(item.url).hostname;
    } catch {
      // leave empty
    }
    if (auditedHost && host && host !== auditedHost) {
      stats.image_bytes_third_party += bytes;
    }
  }
  return stats;
}

async function runAudit(
  url: string,
  port: number,
  profile: ThrottlingProfile,
  formFactor: FormFactor
): Promise<{ metrics: AuditMetrics; findings: ImageFinding[]; stats: PageImageStats }> {
  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "error",
    formFactor,
    screenEmulation:
      formFactor === "mobile"
        ? {
            mobile: true,
            width: 360,
            height: 640,
            deviceScaleFactor: 2.625,
            disabled: false,
          }
        : {
            mobile: false,
            width: 1350,
            height: 940,
            deviceScaleFactor: 1,
            disabled: false,
          },
    throttlingMethod: "simulate",
    throttling: {
      rttMs: profile.rttMs,
      throughputKbps: profile.throughputKbps,
      uploadThroughputKbps: profile.uploadThroughputKbps,
      cpuSlowdownMultiplier: profile.cpuSlowdownMultiplier,
    },
    onlyCategories: ["performance"],
  } as any);

  const lhr = (result as any)?.lhr;
  if (!lhr) {
    throw new Error("Lighthouse returned no result");
  }

  return {
    metrics: {
      lcp_ms: metricValue(result, "largest-contentful-paint"),
      fcp_ms: metricValue(result, "first-contentful-paint"),
      cls: metricValue(result, "cumulative-layout-shift"),
      tbt_ms: metricValue(result, "total-blocking-time"),
      speed_index_ms: metricValue(result, "speed-index"),
      ttfb_ms: metricValue(result, "server-response-time"),
      total_byte_weight: metricValue(result, "total-byte-weight"),
      performance_score:
        typeof lhr.categories?.performance?.score === "number"
          ? lhr.categories.performance.score
          : null,
      lighthouse_version: lhr.lighthouseVersion ?? null,
    },
    findings: [
      ...extractImageFindings(result),
      ...extractLcpFindings(result),
      ...extractVtexFindings(result),
    ],
    stats: extractPageImageStats(result, lhr.finalDisplayedUrl ?? url),
  };
}

/**
 * Worker mode (`--worker`, internal): launched by the parent as a separate
 * process so concurrent audits never share the global perf_hooks timeline
 * (Lighthouse's marky marks use fixed names like "lh:runner:gather", which
 * collide fatally when two audits run in one process).
 *
 * Protocol: newline-delimited JSON on stdin/stdout. Logs go to stderr only.
 *   parent -> worker: {"type":"audit","target":{origin,group,pageType,url,formFactor,throttlingProfile}}
 *                     {"type":"shutdown"}
 *   worker -> parent: {"type":"ready"} | {"type":"launch-error","message"}
 *                     {"type":"result","target":...,"metrics":{...},"findings":[...],"stats":{...}}
 *                     {"type":"error","target":...,"message":...}
 */
async function workerMode(): Promise<void> {
  const say = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + "\n");

  let chrome: LaunchedChrome;
  try {
    chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-first-run"] });
  } catch (err) {
    say({ type: "launch-error", message: (err as Error).message });
    process.exit(1);
  }
  say({ type: "ready" });

  const rl = createInterface({ input: process.stdin });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.type === "shutdown") break;
    if (msg.type === "audit") {
      const target = msg.target as WireTarget;
      try {
        const profile =
          THROTTLING_PROFILES[target.throttlingProfile] ?? THROTTLING_PROFILES[DEFAULT_THROTTLING_PROFILE];
        const { metrics, findings, stats } = await runAudit(target.url, chrome.port, profile, target.formFactor);
        say({ type: "result", target, metrics, findings, stats });
      } catch (err) {
        say({ type: "error", target, message: (err as Error).message });
      }
    }
  }

  try {
    await chrome.kill();
  } catch (err) {
    // chrome-launcher temp-profile cleanup can hit EPERM on Windows file locks;
    // audits are already reported, so this must not fail the worker.
    console.error(`warning: Chrome cleanup failed: ${(err as Error).message}`);
  }
  process.exit(0);
}

interface ParallelWorker {
  index: number;
  proc: ChildProcess;
  inFlight: WireTarget | null;
  dead: boolean;
}

interface ParallelRunContext {
  targets: AuditTarget[];
  runId: string;
  fetchedAt: number;
  args: CliArgs;
  configHash: string;
  insert: { run: (...values: unknown[]) => unknown };
  insertFinding: { run: (...values: unknown[]) => unknown };
}

// Persists image-audit findings for one audited URL. Rows share the run_id.
function saveFindings(
  insertFinding: { run: (...values: unknown[]) => unknown },
  runId: string,
  fetchedAt: number,
  target: WireTarget,
  findings: ImageFinding[]
): void {
  for (const f of findings) {
    insertFinding.run(
      newFindingId(),
      runId,
      target.origin,
      target.pageType,
      target.formFactor,
      target.url,
      f.audit_id,
      f.resource_url,
      f.total_bytes,
      f.wasted_bytes,
      f.wasted_pct,
      f.displayed_width,
      f.displayed_height,
      fetchedAt
    );
  }
}

/**
 * Parallel execution: one child process per worker, each child with its own
 * Chrome instance. The parent keeps the shared queue (cursor) and hands the
 * next URL to whichever worker just became idle.
 */
async function runParallel(ctx: ParallelRunContext): Promise<{ attempted: number; succeeded: number; failed: number }> {
  const { targets } = ctx;
  const scriptPath = fileURLToPath(import.meta.url);
  const workerCount = Math.min(ctx.args.concurrency, targets.length);

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let cursor = 0;
  let finished = 0;

  const workers: ParallelWorker[] = [];

  const spawnWorker = (index: number): ParallelWorker => {
    const proc = spawn(
      process.execPath,
      ["--import", "tsx", scriptPath, "--worker"],
      { stdio: ["pipe", "pipe", "inherit"], cwd: process.cwd() }
    );
    return { index, proc, inFlight: null, dead: false };
  };

  // Launch all workers and wait until each reports ready. Any launch failure
  // aborts before a single audit is dispatched (Chrome-missing fail fast).
  const readyPromises: Promise<void>[] = [];
  for (let i = 0; i < workerCount; i++) {
    const worker = spawnWorker(i);
    workers.push(worker);
    readyPromises.push(
      new Promise<void>((resolvePromise, rejectPromise) => {
        const rl = createInterface({ input: worker.proc.stdout! });
        rl.once("line", (line) => {
          const msg = JSON.parse(line);
          if (msg.type === "ready") {
            resolvePromise();
          } else {
            rejectPromise(new Error(msg.message ?? "worker failed to start"));
          }
          rl.close();
        });
        worker.proc.once("exit", (code) => {
          rejectPromise(new Error(`worker ${i + 1} exited before ready (code ${code})`));
        });
      })
    );
  }

  try {
    await Promise.all(readyPromises);
  } catch (err) {
    for (const worker of workers) {
      worker.proc.kill();
    }
    throw new Error(
      `Could not launch Chrome in a worker process. A local Chrome/Chromium installation is required for synthetic runs.\n  ${(err as Error).message}`
    );
  }

  await new Promise<void>((resolveRun) => {
    const maybeResolve = () => {
      if (finished >= targets.length) {
        resolveRun();
      }
    };

    const dispatch = (worker: ParallelWorker) => {
      if (worker.dead) return;
      if (cursor >= targets.length) {
        worker.proc.stdin!.write(JSON.stringify({ type: "shutdown" }) + "\n");
        worker.dead = true;
        return;
      }
      const listIndex = cursor++;
      const { site, page, formFactor } = targets[listIndex];
      const target: WireTarget = {
        origin: site.origin,
        group: site.group,
        pageType: page.type,
        url: page.url!,
        formFactor,
        throttlingProfile: profileForTarget(ctx.args, formFactor),
      };
      attempted++;
      worker.inFlight = target;
      console.log(
        `[${listIndex + 1}/${targets.length}] (worker ${worker.index + 1}) ${target.origin} ${target.pageType} ${formFactor} — ${target.url}`
      );
      worker.proc.stdin!.write(JSON.stringify({ type: "audit", target }) + "\n");
    };

    for (const worker of workers) {
      const rl = createInterface({ input: worker.proc.stdout! });
      rl.on("line", (line) => {
        if (!line.trim()) return;
        const msg = JSON.parse(line);
        if (msg.type === "result") {
          const target = msg.target as WireTarget;
          const metrics = msg.metrics as AuditMetrics;
          const findings = (msg.findings ?? []) as ImageFinding[];
          const stats = msg.stats as PageImageStats | undefined;
          ctx.insert.run(
            newRowId(),
            ctx.runId,
            ctx.args.suiteVersion,
            ctx.args.label,
            ctx.configHash,
            target.origin,
            target.group,
            target.pageType,
            target.url,
            target.formFactor,
            metrics.lcp_ms,
            metrics.fcp_ms,
            metrics.cls,
            metrics.tbt_ms,
            metrics.speed_index_ms,
            metrics.ttfb_ms,
            metrics.total_byte_weight,
            metrics.performance_score,
            metrics.lighthouse_version,
            target.throttlingProfile,
            stats?.image_bytes_modern ?? null,
            stats?.image_bytes_legacy ?? null,
            stats?.image_bytes_third_party ?? null,
            stats?.image_count ?? null,
            ctx.fetchedAt
          );
          saveFindings(ctx.insertFinding, ctx.runId, ctx.fetchedAt, target, findings);
          succeeded++;
          finished++;
          console.log(
            `  ok — LCP=${metrics.lcp_ms} ms, score=${metrics.performance_score}, ${findings.length} hallazgos de imagen`
          );
        } else if (msg.type === "error") {
          const target = msg.target as WireTarget;
          failed++;
          finished++;
          console.warn(`  warning: audit failed for ${target.url}: ${msg.message}`);
        } else {
          return; // unknown message; ignore
        }
        worker.inFlight = null;
        dispatch(worker);
        maybeResolve();
      });

      worker.proc.on("exit", () => {
        if (worker.inFlight) {
          failed++;
          finished++;
          console.warn(
            `  warning: worker ${worker.index + 1} died while auditing ${worker.inFlight.url}`
          );
          worker.inFlight = null;
        }
        if (!worker.dead) {
          worker.dead = true;
          if (workers.every((w) => w.dead) && cursor < targets.length) {
            const remaining = targets.length - cursor;
            console.warn(
              `  warning: all workers exited early; ${remaining} URL(s) not audited`
            );
            attempted += remaining;
            failed += remaining;
            finished += remaining;
            cursor = targets.length;
          }
        }
        maybeResolve();
      });

      dispatch(worker);
    }
  });

  // All audits accounted for; make sure workers are shut down.
  for (const worker of workers) {
    if (!worker.dead) {
      worker.proc.stdin!.write(JSON.stringify({ type: "shutdown" }) + "\n");
    }
  }
  await Promise.all(
    workers.map(
      (worker) =>
        new Promise<void>((res) => {
          worker.proc.once("exit", () => res());
          setTimeout(() => {
            worker.proc.kill();
            res();
          }, 15000).unref();
        })
    )
  );

  return { attempted, succeeded, failed };
}

async function main(): Promise<void> {
  // Internal worker mode: separate process per parallel worker (see workerMode).
  if (process.argv.includes("--worker")) {
    await workerMode();
    return;
  }

  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(USAGE);
    return;
  }

  const db = openCruxDb();

  if (args.list) {
    listRuns(db);
    closeCruxDb(db);
    return;
  }
  if (args.exclude) {
    setExcluded(db, args.exclude, 1);
    closeCruxDb(db);
    return;
  }
  if (args.include) {
    setExcluded(db, args.include, 0);
    closeCruxDb(db);
    return;
  }

  const { config, configHash } = loadConfig();
  const targets = collectTargets(config, args);

  if (targets.length === 0) {
    console.error("No URLs to audit (check --site/--page filters and enabled flags).");
    closeCruxDb(db);
    process.exit(1);
  }

  const runId = newRunId();
  const fetchedAt = Math.floor(Date.now() / 1000);

  console.log(
    `Synthetic run ${runId} — ${targets.length} URL(s), suite=${args.suiteVersion}, config=${configHash}, concurrency=${args.concurrency}, form-factor=${args.formFactor}, throttling=${args.throttlingProfile ?? "auto (fast4g mobile / broadband desktop)"}`
  );

  const insert = db.prepare(
    `INSERT INTO synthetic_runs (
       id, run_id, suite_version, label, config_hash, origin, group_name,
       page_type, url, form_factor,
       lcp_ms, fcp_ms, cls, tbt_ms, speed_index_ms, ttfb_ms,
       total_byte_weight, performance_score, lighthouse_version, throttling_profile,
       image_bytes_modern, image_bytes_legacy, image_bytes_third_party, image_count,
       fetched_at, excluded
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  );

  const insertFinding = db.prepare(
    `INSERT INTO image_findings (
       id, run_id, origin, page_type, form_factor, url_audited, audit_id,
       resource_url, total_bytes, wasted_bytes, wasted_pct,
       displayed_width, displayed_height, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;

  if (args.concurrency > 1 && targets.length > 1) {
    // Parallel: workers are separate processes, each with its own Chrome.
    try {
      const result = await runParallel({ targets, runId, fetchedAt, args, configHash, insert, insertFinding });
      attempted = result.attempted;
      succeeded = result.succeeded;
      failed = result.failed;
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      closeCruxDb(db);
      process.exit(1);
    }
    closeCruxDb(db);
  } else {
    // Sequential (default): one Chrome instance, audits one at a time.
    let chrome: LaunchedChrome;
    try {
      chrome = await launchChrome({ chromeFlags: ["--headless=new", "--no-first-run"] });
    } catch (err) {
      console.error(
        "Error: could not launch Chrome. A local Chrome/Chromium installation is required for synthetic runs."
      );
      console.error(`  ${(err as Error).message}`);
      closeCruxDb(db);
      process.exit(1);
    }

    try {
      for (let i = 0; i < targets.length; i++) {
        const { site, page, formFactor } = targets[i];
        const throttlingProfile = profileForTarget(args, formFactor);
        attempted++;
        console.log(`[${i + 1}/${targets.length}] ${site.origin} ${page.type} ${formFactor} — ${page.url}`);
        try {
          const { metrics, findings, stats } = await runAudit(
            page.url!,
            chrome.port,
            THROTTLING_PROFILES[throttlingProfile],
            formFactor
          );
          insert.run(
            newRowId(),
            runId,
            args.suiteVersion,
            args.label,
            configHash,
            site.origin,
            site.group,
            page.type,
            page.url!,
            formFactor,
            metrics.lcp_ms,
            metrics.fcp_ms,
            metrics.cls,
            metrics.tbt_ms,
            metrics.speed_index_ms,
            metrics.ttfb_ms,
            metrics.total_byte_weight,
            metrics.performance_score,
            metrics.lighthouse_version,
            throttlingProfile,
            stats.image_bytes_modern,
            stats.image_bytes_legacy,
            stats.image_bytes_third_party,
            stats.image_count,
            fetchedAt
          );
          saveFindings(
            insertFinding,
            runId,
            fetchedAt,
            {
              origin: site.origin,
              group: site.group,
              pageType: page.type,
              url: page.url!,
              formFactor,
              throttlingProfile,
            },
            findings
          );
          succeeded++;
          console.log(
            `  ok — LCP=${metrics.lcp_ms} ms, score=${metrics.performance_score}, ${findings.length} hallazgos de imagen`
          );
        } catch (err) {
          failed++;
          console.warn(`  warning: audit failed for ${page.url}: ${(err as Error).message}`);
        }
      }
    } finally {
      try {
        await chrome.kill();
      } catch (err) {
        // chrome-launcher temp-profile cleanup can hit EPERM on Windows file locks;
        // audits are already persisted, so this must not fail the run.
        console.warn(`warning: Chrome cleanup failed: ${(err as Error).message}`);
      }
      closeCruxDb(db);
    }
  }

  console.log(`\nDone: ${attempted} attempted, ${succeeded} succeeded, ${failed} failed.`);
  if (succeeded === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
