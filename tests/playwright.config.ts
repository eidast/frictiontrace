import { defineConfig } from "@playwright/test";

/**
 * Playwright config for FrictionTrace integration tests.
 * The integration test starts its own http-server on a fixed port (not via webServer)
 * because it spawns the CLI as a child process and needs a deterministic URL.
 */
export default defineConfig({
  testDir: "./integration",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    trace: "off",
    headless: true,
  },
});
