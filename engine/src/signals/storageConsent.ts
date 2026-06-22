import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

const DEFAULT_CMP_SELECTORS = [
  ".cmp-banner",
  "#onetrust-banner-sdk",
  "[data-testid='cookie-banner']",
  "[id*='cookie-banner' i]",
  "[class*='cookie-banner' i]",
  "[aria-label*='cookie' i]",
];

export interface StorageConsentOptions {
  cmpSelectors?: string[];
}

/**
 * Capture cookies, localStorage/sessionStorage writes, and CMP banner presence.
 */
export async function captureStorageConsent(
  page: Page,
  db: Db,
  runId: string,
  stepId: string | null,
  opts: StorageConsentOptions = {},
): Promise<void> {
  const cmpSelectors = opts.cmpSelectors ?? DEFAULT_CMP_SELECTORS;
  const findings = await page.evaluate((selectors: string[]) => {
    const cookies = document.cookie.split(";").map((s: string) => s.trim()).filter(Boolean);
    let lsCount = 0;
    let ssCount = 0;
    try { lsCount = localStorage.length; } catch { /* ignore */ }
    try { ssCount = sessionStorage.length; } catch { /* ignore */ }
    let cmpFound: string | null = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        cmpFound = sel;
        break;
      }
    }
    return {
      cookieCount: cookies.length,
      cookieNames: cookies.map((c: string) => c.split("=")[0]?.trim() ?? ""),
      localStorageCount: lsCount,
      sessionStorageCount: ssCount,
      cmpBanner: cmpFound,
      url: window.location.href,
      isHttps: window.location.protocol === "https:",
    };
  }, cmpSelectors);

  signalsRepo.insert(db, runId, {
    step_id: stepId,
    category: "storage_consent",
    type: "snapshot",
    payload: findings,
  });

  if (findings.cookieCount > 0 && !findings.cmpBanner) {
    signalsRepo.insert(db, runId, {
      step_id: stepId,
      category: "storage_consent",
      type: "consent_missing",
      payload: { cookieCount: findings.cookieCount, isHttps: findings.isHttps },
    });
  } else if (findings.cmpBanner) {
    signalsRepo.insert(db, runId, {
      step_id: stepId,
      category: "storage_consent",
      type: "consent_banner_present",
      payload: { selector: findings.cmpBanner },
    });
  }
}
