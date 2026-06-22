import type { Page } from "playwright";
import type { StepT } from "../schema.js";

export interface NavigateResult {
  ok: boolean;
  status: number | null;
  finalUrl: string;
  timedOut: boolean;
}

/**
 * Navigate to a URL. Substitutes ${URL} from the journey target.
 * Returns whether the navigation succeeded and the final URL.
 */
export async function navigateStep(page: Page, step: StepT, baseUrl: string): Promise<NavigateResult> {
  const url = resolveUrl(step.url ?? "/", baseUrl);
  try {
    const response = await page.goto(url, {
      waitUntil: mapWaitFor(step.waitFor),
      timeout: step.timeoutMs,
    });
    return {
      ok: true,
      status: response?.status() ?? null,
      finalUrl: page.url(),
      timedOut: false,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      finalUrl: page.url(),
      timedOut: err instanceof Error && /timeout/i.test(err.message),
    };
  }
}

function mapWaitFor(w: StepT["waitFor"]): "domcontentloaded" | "networkidle" | "load" {
  if (w === "selector") return "load";
  return w;
}

function resolveUrl(pathOrUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = baseUrl.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${base}${path}`;
}
