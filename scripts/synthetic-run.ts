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
(mobile form factor, simulated throttling) and stores metrics in data/crux.db.

Options:
  --site <origin>        Only audit pages of this origin (e.g. www.walmart.com.gt)
  --page <type>          Only audit this page type (homepage|checkout|plp|pdp)
  --label <text>         Free-text label stored on every row of this run
  --suite-version <v>    Suite version tag (default: v1)
  --concurrency <n>      Parallel workers, each in its own process with its own
                         Chrome instance (integer, default 1 = sequential, max 4)
  --throttling-profile <name>
                         Simulated throttling profile (default: fast4g):
                           fast4g  RTT 60 ms, 9 Mbps down / 1.5 Mbps up, 2x CPU
                                   (realistic median mobile, Central America 2026)
                           slow4g  RTT 150 ms, 1.6 Mbps down / 0.75 Mbps up, 4x CPU
                                   (Lighthouse default, kept as stress test)
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
  throttlingProfile: string;
  list: boolean;
  exclude?: string;
  include?: string;
  help: boolean;
}

interface AuditTarget {
  site: CruxSiteConfigT;
  page: CruxPageEntryT;
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
}

// Lighthouse image audits whose detail items are persisted to image_findings.
const IMAGE_AUDIT_IDS = [
  "modern-image-formats",
  "uses-optimized-images",
  "uses-responsive-images",
  "offscreen-images",
  "unsized-images",
] as const;

/** Wire format sent from parent to worker: one target per audit message. */
interface WireTarget {
  origin: string;
  group: string;
  pageType: string;
  url: string;
}

const MAX_CONCURRENCY = 4;

interface ThrottlingProfile {
  rttMs: number;
  throughputKbps: number;
  uploadThroughputKbps: number;
  cpuSlowdownMultiplier: number;
}

// Simulated throttling profiles. fast4g is the default: a realistic median
// mobile user in Central America 2026. slow4g is Lighthouse's built-in default,
// kept as a stress test.
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
    throttlingProfile: DEFAULT_THROTTLING_PROFILE,
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
  for (const site of config.sites) {
    if (!site.enabled) continue;
    if (args.site && site.origin !== args.site) continue;
    for (const page of site.pages) {
      if (!page.enabled) continue;
      if (!page.url) continue;
      if (args.page && page.type !== args.page) continue;
      targets.push({ site, page });
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
  const findings: ImageFinding[] = [];
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
      findings.push({
        audit_id: auditId,
        resource_url: item.url,
        total_bytes: totalBytes,
        wasted_bytes: wastedBytes,
        wasted_pct: wastedPct,
      });
    }
  }
  return findings;
}

async function runAudit(
  url: string,
  port: number,
  profile: ThrottlingProfile
): Promise<{ metrics: AuditMetrics; findings: ImageFinding[] }> {
  const result = await lighthouse(url, {
    port,
    output: "json",
    logLevel: "error",
    formFactor: "mobile",
    screenEmulation: {
      mobile: true,
      width: 360,
      height: 640,
      deviceScaleFactor: 2.625,
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
    findings: extractImageFindings(result),
  };
}

/**
 * Worker mode (`--worker`, internal): launched by the parent as a separate
 * process so concurrent audits never share the global perf_hooks timeline
 * (Lighthouse's marky marks use fixed names like "lh:runner:gather", which
 * collide fatally when two audits run in one process).
 *
 * Protocol: newline-delimited JSON on stdin/stdout. Logs go to stderr only.
 *   parent -> worker: {"type":"audit","target":{origin,group,pageType,url}}
 *                     {"type":"shutdown"}
 *   worker -> parent: {"type":"ready"} | {"type":"launch-error","message"}
 *                     {"type":"result","target":...,"metrics":{...}}
 *                     {"type":"error","target":...,"message":...}
 */
async function workerMode(): Promise<void> {
  const say = (msg: unknown) => process.stdout.write(JSON.stringify(msg) + "\n");

  // The parent passes the chosen profile via CLI (validated there already).
  const profileArgIndex = process.argv.indexOf("--throttling-profile");
  const profileName =
    profileArgIndex >= 0 ? process.argv[profileArgIndex + 1] : DEFAULT_THROTTLING_PROFILE;
  const profile = THROTTLING_PROFILES[profileName] ?? THROTTLING_PROFILES[DEFAULT_THROTTLING_PROFILE];

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
        const { metrics, findings } = await runAudit(target.url, chrome.port, profile);
        say({ type: "result", target, metrics, findings });
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
      target.url,
      f.audit_id,
      f.resource_url,
      f.total_bytes,
      f.wasted_bytes,
      f.wasted_pct,
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
      ["--import", "tsx", scriptPath, "--worker", "--throttling-profile", ctx.args.throttlingProfile],
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
      const { site, page } = targets[listIndex];
      const target: WireTarget = {
        origin: site.origin,
        group: site.group,
        pageType: page.type,
        url: page.url!,
      };
      attempted++;
      worker.inFlight = target;
      console.log(
        `[${listIndex + 1}/${targets.length}] (worker ${worker.index + 1}) ${target.origin} ${target.pageType} — ${target.url}`
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
            "mobile",
            metrics.lcp_ms,
            metrics.fcp_ms,
            metrics.cls,
            metrics.tbt_ms,
            metrics.speed_index_ms,
            metrics.ttfb_ms,
            metrics.total_byte_weight,
            metrics.performance_score,
            metrics.lighthouse_version,
            ctx.args.throttlingProfile,
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
    `Synthetic run ${runId} — ${targets.length} URL(s), suite=${args.suiteVersion}, config=${configHash}, concurrency=${args.concurrency}, throttling=${args.throttlingProfile}`
  );

  const insert = db.prepare(
    `INSERT INTO synthetic_runs (
       id, run_id, suite_version, label, config_hash, origin, group_name,
       page_type, url, form_factor,
       lcp_ms, fcp_ms, cls, tbt_ms, speed_index_ms, ttfb_ms,
       total_byte_weight, performance_score, lighthouse_version, throttling_profile, fetched_at, excluded
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`
  );

  const insertFinding = db.prepare(
    `INSERT INTO image_findings (
       id, run_id, origin, page_type, url_audited, audit_id,
       resource_url, total_bytes, wasted_bytes, wasted_pct, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        const { site, page } = targets[i];
        attempted++;
        console.log(`[${i + 1}/${targets.length}] ${site.origin} ${page.type} — ${page.url}`);
        try {
          const { metrics, findings } = await runAudit(page.url!, chrome.port, THROTTLING_PROFILES[args.throttlingProfile]);
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
            "mobile",
            metrics.lcp_ms,
            metrics.fcp_ms,
            metrics.cls,
            metrics.tbt_ms,
            metrics.speed_index_ms,
            metrics.ttfb_ms,
            metrics.total_byte_weight,
            metrics.performance_score,
            metrics.lighthouse_version,
            args.throttlingProfile,
            fetchedAt
          );
          saveFindings(
            insertFinding,
            runId,
            fetchedAt,
            { origin: site.origin, group: site.group, pageType: page.type, url: page.url! },
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
