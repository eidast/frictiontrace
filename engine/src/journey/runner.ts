import type { Browser, Page } from "playwright";
import { type Database as Db } from "better-sqlite3";
import type { JourneyConfigT, StepT } from "./schema.js";
import { stepsRepo } from "../storage/daos.js";
import { navigateStep } from "./primitives/navigate.js";
import { interactStep } from "./primitives/interact.js";
import { extractAndClickStep } from "./primitives/extract-and-click.js";

export interface RunJourneyOptions {
  browser: Browser;
  db: Db;
  runId: string;
  config: JourneyConfigT;
  targetUrl: string;
  setupPage?: (page: Page) => Promise<void>;
}

export interface RunJourneyResult {
  stepsCompleted: number;
  stepsFailed: number;
  stepsTimedOut: number;
  stepsSkipped: number;
}

const STEP_STATUS_PRIORITY = {
  failed: 1,
  timeout: 1,
  skipped: 1,
  ok: 0,
} as const;

export async function runJourney(opts: RunJourneyOptions): Promise<RunJourneyResult> {
  const { browser, db, runId, config, targetUrl, setupPage } = opts;
  const context = await browser.newContext({
    viewport: config.settings.viewport,
    locale: config.settings.locale,
    timezoneId: config.settings.timezone,
  });
  if (config.settings.cookies.length > 0) {
    await context.addCookies(
      config.settings.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain ?? new URL(targetUrl).hostname,
      })),
    );
  }
  const page = await context.newPage();
  if (setupPage) await setupPage(page);

  const summary: RunJourneyResult = {
    stepsCompleted: 0,
    stepsFailed: 0,
    stepsTimedOut: 0,
    stepsSkipped: 0,
  };

  for (const step of config.steps) {
    const stepRow = stepsRepo.insert(db, runId, { name: step.name });
    let status: "ok" | "failed" | "timeout" | "skipped" = "ok";
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
  }

  await context.close();
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
