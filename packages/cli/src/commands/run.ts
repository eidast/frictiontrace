import { chromium, type Browser } from "playwright";
import { parse as parseYaml } from "yaml";
import { readFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { runsBaseDir, openRunDb, closeRunDb, runsRepo, stepsRepo } from "@frictiontrace/engine/storage";
import { validateJourney, navigateStep, interactStep, extractAndClickStep, type JourneyConfigT } from "@frictiontrace/engine/journey";
import { attachAllSignals, captureDomUx, captureStorageConsent, captureSecurity, buildThirdPartyInventory, captureStepScreenshots } from "@frictiontrace/engine/signals";
import { analyzeRun } from "@frictiontrace/engine/analyzer";
import { writeHar, captureMhtml, startTrace, stopTrace } from "@frictiontrace/engine/artifacts";
import { renderReport } from "@frictiontrace/engine/render";
import { createLogger, EXIT } from "../logger.js";
import type { Database as Db } from "better-sqlite3";
import type { Page } from "playwright";
import type { StepT } from "@frictiontrace/engine/journey";

export interface RunOptions {
  journey?: string;
  quiet?: boolean;
  verbose?: boolean;
  outDir?: string;
}

export async function runCommand(url: string, opts: RunOptions = {}): Promise<number> {
  const logger = createLogger(opts);
  const baseDir = opts.outDir ?? runsBaseDir();

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    logger.error(`invalid URL: ${url}`);
    return EXIT.INVALID_INPUT;
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    logger.error(`URL must be http(s): ${url}`);
    return EXIT.INVALID_INPUT;
  }

  const journeyPath = opts.journey ?? resolve(process.cwd(), "engine/journeys/default-ecommerce.yaml");
  logger.info(`loading journey: ${journeyPath}`);
  let journeyRaw: string;
  try {
    journeyRaw = readFileSync(journeyPath, "utf-8");
  } catch (err) {
    logger.error(`could not read journey: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.INVALID_INPUT;
  }
  const journeyParsed = parseYaml(journeyRaw);
  const journeyResult = validateJourney(journeyParsed);
  if (!journeyResult.valid) {
    logger.error(`journey validation failed:`);
    for (const e of journeyResult.errors) {
      logger.error(`  - ${e}`);
    }
    return EXIT.INVALID_INPUT;
  }
  const journey: JourneyConfigT = journeyResult.config;
  journey.target.baseUrl = journey.target.baseUrl.replace(/\$\{URL\}/g, parsedUrl.origin);
  const targetUrl = parsedUrl.origin;

  const runId = `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const runOutDir = join(baseDir, runId);
  mkdirSync(runOutDir, { recursive: true });
  const db = openRunDb(runId, { baseDir });
  runsRepo.insert(db, { id: runId, target_url: targetUrl, config_json: JSON.stringify({ url, journey: journeyPath }) });

  let browser: Browser | null = null;
  let hasWarnings = false;
  try {
    logger.info(`launching chromium`);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: journey.settings.viewport,
      locale: journey.settings.locale,
      timezoneId: journey.settings.timezone,
    });
    await startTrace(context);

    const page = await context.newPage();
    await attachAllSignals(page, db, runId);

    const stepResult = await runJourneyWithPostCapture({
      db, runId, config: journey, targetUrl, page, outDir: join(runOutDir, "screenshots"),
    });
    logger.info(
      `journey: ${stepResult.stepsCompleted} ok / ${stepResult.stepsFailed} failed / ${stepResult.stepsTimedOut} timeout`,
    );
    if (stepResult.stepsFailed > 0 || stepResult.stepsTimedOut > 0) {
      hasWarnings = true;
    }

    const tpEntries = buildThirdPartyInventory(db, runId, parsedUrl.hostname);
    logger.info(`third-party domains: ${tpEntries.length}`);

    try {
      const mhtmlPath = await captureMhtml(page, runOutDir, "run.mhtml");
      logger.info(`mhtml: ${mhtmlPath}`);
    } catch (err) {
      logger.warn(`mhtml capture failed: ${err instanceof Error ? err.message : String(err)}`);
      hasWarnings = true;
    }

    try {
      await stopTrace(context, join(runOutDir, "trace.zip"));
    } catch (err) {
      logger.warn(`trace stop failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    await context.close();

    logger.info(`analyzing signals`);
    const analysis = analyzeRun(db, runId);
    logger.info(`analyzer: ${analysis.issues.length} issue(s), ${analysis.factsCount} fact(s)`);
    if (analysis.issues.some((i) => i.severity === "critical")) {
      hasWarnings = true;
    }

    try {
      const harPath = writeHar(db, runId, runOutDir);
      logger.info(`har: ${harPath}`);
    } catch (err) {
      logger.warn(`har write failed: ${err instanceof Error ? err.message : String(err)}`);
      hasWarnings = true;
    }

    const rendered = renderReport(db, runId, { outDir: runOutDir });
    logger.info(`report: ${rendered.reportPath} (score ${rendered.score})`);

    runsRepo.updateStatus(db, runId, hasWarnings ? "partial" : "done");
    const summary = {
      runId,
      status: hasWarnings ? "partial" : "done",
      reportPath: rendered.reportPath,
      score: rendered.score,
    };
    process.stdout.write(JSON.stringify(summary) + "\n");
    return hasWarnings ? EXIT.PARTIAL : EXIT.SUCCESS;
  } catch (err) {
    runsRepo.updateStatus(db, runId, "error");
    runsRepo.addWarning(db, runId, { code: "engine_error", message: err instanceof Error ? err.message : String(err) });
    logger.error(`engine error: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.ENGINE_ERROR;
  } finally {
    closeRunDb(db);
    if (browser) await browser.close().catch(() => undefined);
  }
}

interface JourneyRunInput {
  db: Db;
  runId: string;
  config: JourneyConfigT;
  targetUrl: string;
  page: Page;
  outDir: string;
}

interface JourneyRunResult {
  stepsCompleted: number;
  stepsFailed: number;
  stepsTimedOut: number;
}

async function runJourneyWithPostCapture(input: JourneyRunInput): Promise<JourneyRunResult> {
  const { db, runId, config, targetUrl, page, outDir } = input;
  const summary: JourneyRunResult = { stepsCompleted: 0, stepsFailed: 0, stepsTimedOut: 0 };
  for (const step of config.steps) {
    const stepRow = stepsRepo.insert(db, runId, { name: step.name });
    let status: "ok" | "failed" | "timeout" = "ok";
    try {
      await runSingleStep(page, step, targetUrl);
      status = "ok";
      summary.stepsCompleted++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/timeout/i.test(msg)) {
        status = "timeout";
        summary.stepsTimedOut++;
      } else {
        status = "failed";
        summary.stepsFailed++;
      }
    }
    stepsRepo.updateStatus(db, stepRow.id, status);

    try { await captureDomUx(page, db, runId, stepRow.id); } catch { /* ignore */ }
    try { await captureStorageConsent(page, db, runId, stepRow.id); } catch { /* ignore */ }
    try { await captureSecurity(page, db, runId, stepRow.id); } catch { /* ignore */ }
    try { await captureStepScreenshots(db, page, runId, stepRow.id, step.name, outDir); } catch { /* ignore */ }
  }
  return summary;
}

async function runSingleStep(page: Page, step: StepT, baseUrl: string): Promise<void> {
  if (step.kind === "navigate") {
    const result = await navigateStep(page, step, baseUrl);
    if (!result.ok) {
      throw new Error(result.timedOut ? `timeout navigating to ${step.url}` : `failed to navigate to ${step.url}`);
    }
    return;
  }
  if (step.kind === "interact") {
    const result = await interactStep(page, step.actions ?? [], step.timeoutMs);
    if (result.failed > 0 && step.actions?.some((a) => a.onError === "fail_step")) {
      throw new Error("a fail_step action could not be performed");
    }
    return;
  }
  if (step.kind === "extract_and_click") {
    const result = await extractAndClickStep(page, step);
    if (!result.ok) {
      throw new Error(`could not extract_and_click for step ${step.name}`);
    }
    return;
  }
  throw new Error(`unknown step kind: ${(step as { kind: string }).kind}`);
}
