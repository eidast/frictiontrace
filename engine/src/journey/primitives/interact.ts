import type { Page } from "playwright";
import type { ActionT } from "../schema.js";
import { resolveSelector } from "./resolve-selector.js";

export interface InteractResult {
  attempted: number;
  succeeded: number;
  skipped: number;
  failed: number;
}

/**
 * Execute a list of interactions on the page.
 * Each action is attempted; if its selector cannot be resolved:
 *   - if optional: skipped silently
 *   - if onError=skip_step: this step returns the partial result
 *   - if onError=fail_step: this step is marked failed
 *   - if onError=continue: continue to next action
 */
export async function interactStep(
  page: Page,
  actions: ActionT[],
  stepTimeoutMs: number,
): Promise<InteractResult> {
  const result: InteractResult = { attempted: 0, succeeded: 0, skipped: 0, failed: 0 };
  for (const a of actions) {
    result.attempted++;
    const loc = await resolveSelector(page, a.findSelector, a.fallback);
    if (!loc) {
      if (a.optional) {
        result.skipped++;
        continue;
      }
      if (a.onError === "skip_step") {
        result.failed++;
        return result;
      }
      if (a.onError === "fail_step") {
        result.failed++;
        return result;
      }
      // continue
      result.skipped++;
      continue;
    }

    try {
      await performAction(page, loc, a);
      if (a.afterMs && a.afterMs > 0) {
        await page.waitForTimeout(a.afterMs);
      }
      result.succeeded++;
    } catch {
      if (a.optional || a.onError === "continue") {
        result.skipped++;
        continue;
      }
      if (a.onError === "skip_step" || a.onError === "fail_step") {
        result.failed++;
        return result;
      }
    }
  }
  return result;
}

async function performAction(page: Page, loc: ReturnType<Page["locator"]>, a: ActionT): Promise<void> {
  if (a.action === "click") {
    await loc.click({ timeout: 5000 });
  } else if (a.action === "type") {
    if (!a.type) throw new Error("type action requires a `type` field");
    await loc.fill(a.type);
  } else if (a.action === "press_enter") {
    await loc.press("Enter");
  } else if (a.action === "scroll") {
    const smooth = a.scroll?.smooth ?? true;
    if (!a.scroll || a.scroll.to === "bottom") {
      await page.evaluate((s) => window.scrollTo({ top: document.body.scrollHeight, behavior: s ? "smooth" : "auto" }), smooth);
    } else if (a.scroll.to === "top") {
      await page.evaluate((s) => window.scrollTo({ top: 0, behavior: s ? "smooth" : "auto" }), smooth);
    } else if (a.scroll.to === "selector" && a.scroll.selector) {
      const target = page.locator(a.scroll.selector).first();
      await target.scrollIntoViewIfNeeded();
    }
  }
}
