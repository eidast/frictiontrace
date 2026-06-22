import type { Page, Locator } from "playwright";

/**
 * Resolve a selector against the page, trying the primary first, then fallbacks in order.
 * Supports :has-text() pseudo-class natively in Playwright.
 * Returns null if none of the selectors match.
 */
export async function resolveSelector(
  page: Page,
  primary: string | undefined,
  fallbacks: string[] = [],
): Promise<Locator | null> {
  const candidates = [primary, ...fallbacks].filter((s): s is string => Boolean(s && s.trim().length > 0));
  for (const sel of candidates) {
    const loc = page.locator(sel).first();
    try {
      const count = await loc.count();
      if (count > 0) {
        const isVisible = await loc.isVisible().catch(() => false);
        if (isVisible) return loc;
      }
    } catch {
      // Bad selector syntax — try next
      continue;
    }
  }
  return null;
}
