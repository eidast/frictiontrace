import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { screenshotsRepo } from "../storage/daos.js";

/**
 * Capture 3 screenshots for a completed step:
 *  - viewport: current visible area
 *  - above_fold: also current visible (alias of viewport for now; reserved for future split)
 *  - full_page: full scrollable page
 *
 * Returns the paths written.
 */
export async function captureStepScreenshots(
  db: Db,
  page: Page,
  runId: string,
  stepId: string,
  stepName: string,
  outDir: string,
): Promise<{ viewport: string; aboveFold: string; fullPage: string }> {
  mkdirSync(outDir, { recursive: true });
  const safe = stepName.replace(/[^a-z0-9_-]/gi, "_");
  const viewportPath = join(outDir, `${safe}-viewport.png`);
  const aboveFoldPath = join(outDir, `${safe}-above-fold.png`);
  const fullPagePath = join(outDir, `${safe}-full-page.png`);

  try {
    await page.screenshot({ path: viewportPath, fullPage: false });
  } catch {
    // ignore — page may be transitioning
  }
  try {
    await page.screenshot({ path: aboveFoldPath, fullPage: false });
  } catch {
    // ignore
  }
  try {
    await page.screenshot({ path: fullPagePath, fullPage: true });
  } catch {
    // ignore
  }

  const viewport = page.viewportSize();
  const dims = { width: viewport?.width ?? null, height: viewport?.height ?? null };

  screenshotsRepo.insert(db, runId, {
    step_id: stepId,
    path: viewportPath,
    kind: "viewport",
    ...dims,
  });
  screenshotsRepo.insert(db, runId, {
    step_id: stepId,
    path: aboveFoldPath,
    kind: "above_fold",
    ...dims,
  });
  screenshotsRepo.insert(db, runId, {
    step_id: stepId,
    path: fullPagePath,
    kind: "full_page",
    width: null,
    height: null,
  });

  return { viewport: viewportPath, aboveFold: aboveFoldPath, fullPage: fullPagePath };
}
