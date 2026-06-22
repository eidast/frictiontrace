import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

/**
 * Capture security signals: mixed content, form actions on http://,
 * password fields with unsafe autocomplete.
 */
export async function captureSecurity(
  page: Page,
  db: Db,
  runId: string,
  stepId: string | null,
): Promise<void> {
  const pageUrl = page.url();
  const pageIsHttps = pageUrl.startsWith("https://");

  const findings = await page.evaluate(() => {
    const out: Array<{ type: string; payload: Record<string, unknown> }> = [];

    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form"));
    for (const form of forms) {
      const action = form.getAttribute("action");
      if (action && /^http:\/\//i.test(action)) {
        out.push({ type: "insecure_form_action", payload: { action, method: form.method } });
      }
    }

    const passwords = Array.from(document.querySelectorAll<HTMLInputElement>("input[type='password']"));
    for (const input of passwords) {
      const ac = input.getAttribute("autocomplete");
      if (ac && !["current-password", "new-password", "off", "on"].includes(ac.toLowerCase())) {
        out.push({ type: "password_autocomplete_unsafe", payload: { autocomplete: ac, name: input.getAttribute("name") } });
      }
    }

    return out;
  });

  for (const f of findings) {
    signalsRepo.insert(db, runId, { step_id: stepId, category: "security", type: f.type, payload: f.payload });
  }

  if (pageIsHttps) {
    signalsRepo.insert(db, runId, {
      step_id: stepId,
      category: "security",
      type: "page_is_https",
      payload: { pageUrl },
    });
  }
}
