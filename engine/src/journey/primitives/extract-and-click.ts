import type { Page } from "playwright";
import { resolveSelector } from "./resolve-selector.js";
import type { StepT } from "../schema.js";

export interface ExtractAndClickResult {
  ok: boolean;
  href: string | null;
}

/**
 * Find an element matching the selector (or fallbacks), read its href,
 * and navigate to it. Used for "click the first product" style steps.
 */
export async function extractAndClickStep(
  page: Page,
  step: StepT,
): Promise<ExtractAndClickResult> {
  if (!step.selector) {
    return { ok: false, href: null };
  }
  const loc = await resolveSelector(page, step.selector, step.fallback);
  if (!loc) {
    return { ok: false, href: null };
  }
  const href = await loc.getAttribute("href").catch(() => null);
  try {
    await Promise.race([
      loc.click({ timeout: step.timeoutMs }),
      page.waitForTimeout(step.timeoutMs),
    ]);
    return { ok: true, href };
  } catch {
    return { ok: false, href };
  }
}
