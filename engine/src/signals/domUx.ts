import type { Page } from "playwright";
import type { Database as Db } from "better-sqlite3";
import { signalsRepo } from "../storage/daos.js";

/**
 * Scan the page for DOM/UX signals: broken images, forms without labels, iframes.
 * Runs once per step (caller decides when).
 */
export async function captureDomUx(page: Page, db: Db, runId: string, stepId: string | null): Promise<void> {
  const findings = await page.evaluate(() => {
    const out: Array<{ type: string; payload: Record<string, unknown> }> = [];

    // Broken images
    const imgs = Array.from(document.images);
    for (const img of imgs) {
      if (img.complete && img.naturalWidth === 0) {
        out.push({ type: "broken_image", payload: { src: img.src, alt: img.alt } });
      }
    }

    // Forms without labels
    const forms = Array.from(document.querySelectorAll<HTMLFormElement>("form"));
    for (const form of forms) {
      const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input, textarea, select"));
      const unlabeled = inputs.filter((el) => {
        const id = el.getAttribute("id");
        const name = el.getAttribute("name");
        const ariaLabel = el.getAttribute("aria-label");
        const ariaLabelledBy = el.getAttribute("aria-labelledby");
        const type = (el.getAttribute("type") ?? "").toLowerCase();
        if (type === "hidden" || type === "submit" || type === "button") return false;
        if (ariaLabel || ariaLabelledBy) return false;
        if (id && form.querySelector(`label[for="${id}"]`)) return false;
        if (name && form.querySelector(`[name="${name}"] ~ label`)) return false;
        if (el.closest("label")) return false;
        return !name && !id;
      });
      if (unlabeled.length > 0) {
        out.push({ type: "unlabeled_form", payload: { formAction: form.action, count: unlabeled.length } });
      }
    }

    // Iframes (record src for analysis)
    const iframes = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"));
    for (const iframe of iframes) {
      const src = iframe.getAttribute("src");
      if (src && /^https?:\/\//i.test(src)) {
        out.push({ type: "iframe_found", payload: { src } });
      }
    }

    return out;
  });

  for (const f of findings) {
    signalsRepo.insert(db, runId, {
      step_id: stepId,
      category: "dom_ux",
      type: f.type,
      payload: f.payload,
    });
  }
}
