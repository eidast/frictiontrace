import type { Page } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Capture an MHTML snapshot of the page using Chrome DevTools Protocol.
 * Writes to disk and returns the path.
 */
export async function captureMhtml(page: Page, outDir: string, filename = "run.mhtml"): Promise<string> {
  const path = join(outDir, filename);
  const client = await page.context().newCDPSession(page);
  await client.send("Page.enable");
  // Page.captureSnapshot returns MHTML data; available in Chromium-based browsers.
  const result = (await client.send("Page.captureSnapshot" as never, { format: "mhtml" } as never)) as {
    data?: string;
  };
  if (result && typeof result.data === "string" && result.data.length > 0) {
    writeFileSync(path, result.data, "utf-8");
  } else {
    // Fallback: write an empty MHTML shell (Playwright will still produce an artifact file)
    writeFileSync(path, "", "utf-8");
  }
  return path;
}
