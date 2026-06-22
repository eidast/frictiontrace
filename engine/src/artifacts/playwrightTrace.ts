import type { BrowserContext, Page } from "playwright";

/**
 * Start a Playwright trace session for a context. Caller is responsible for stopping.
 */
export async function startTrace(context: BrowserContext): Promise<void> {
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
}

export async function stopTrace(context: BrowserContext, outPath: string): Promise<string> {
  await context.tracing.stop({ path: outPath });
  return outPath;
}

/**
 * Convenience: capture a Playwright trace zip for a single page inside a context.
 * Wraps `fn(page)` with trace start/stop. The trace is written to `outPath`.
 */
export async function captureTraceFor(
  fn: (page: Page) => Promise<void>,
  context: BrowserContext,
  outPath: string,
): Promise<string> {
  await startTrace(context);
  try {
    const page = await context.newPage();
    await fn(page);
  } finally {
    await stopTrace(context, outPath);
  }
  return outPath;
}
