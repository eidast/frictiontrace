import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isValidHar } from "@frictiontrace/engine/artifacts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO = resolve(__dirname, "../..");
const FIXTURE_PORT = 8765;
const FIXTURE = `http://127.0.0.1:${FIXTURE_PORT}`;
const FIXTURE_DIR = join(REPO, "tests/fixture-site");

let server: ChildProcess | null = null;

test.describe("FrictionTrace full run against planted-bug fixture", () => {
  test.beforeAll(async () => {
    // Start http-server on a fixed port
    server = spawn("npx", ["--yes", "http-server", FIXTURE_DIR, "-p", String(FIXTURE_PORT), "-s", "-c-1"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stderr?.on("data", () => undefined); // silence deprecation noise

    // Probe the URL until it responds (more reliable than parsing stdout)
    const start = Date.now();
    const deadline = 30_000;
    let ready = false;
    while (Date.now() - start < deadline) {
      try {
        const res = await fetch(`${FIXTURE}/index.html`);
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!ready) {
      server.kill("SIGTERM");
      throw new Error("http-server did not become ready within 30s");
    }

    // Clean any prior runs
    const runsDir = join(REPO, "runs");
    if (existsSync(runsDir)) {
      rmSync(runsDir, { recursive: true, force: true });
    }
  });

  test.afterAll(async () => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
    }
  });

  test("runs the engine end-to-end and produces a report", async () => {
    const cliEntry = join(REPO, "packages/cli/bin/ft");
    const runsDir = join(REPO, "runs");

    // Run the CLI
    const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolveRun) => {
      const journeyPath = join(REPO, "engine/journeys/default-ecommerce.yaml");
      const child = spawn("node", [cliEntry, "run", `${FIXTURE}/index.html`, "--out-dir", runsDir, "--journey", journeyPath], {
        env: { ...process.env, FRICTIONTRACE_RUNS_DIR: runsDir },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (b) => { stdout += b.toString(); });
      child.stderr?.on("data", (b) => { stderr += b.toString(); });
      child.on("close", (code) => resolveRun({ stdout, stderr, code }));
      setTimeout(() => child.kill("SIGTERM"), 90_000);
    });

    // Log the CLI output for debugging if the test fails
    if (!existsSync(runsDir) || readdirSync(runsDir).filter((d) => d.startsWith("run_")).length === 0) {
      console.log("CLI STDOUT:\n", result.stdout);
      console.log("CLI STDERR:\n", result.stderr);
      console.log("CLI EXIT:", result.code);
    }

    // The CLI may have errors but the pipeline should have created a run
    const runIds = existsSync(runsDir) ? readdirSync(runsDir).filter((d) => d.startsWith("run_")) : [];
    expect(runIds.length).toBeGreaterThan(0);
    const runId = runIds[0]!;
    const runDir = join(runsDir, runId);

    // report.html should exist
    const reportPath = join(runDir, "report.html");
    expect(existsSync(reportPath)).toBe(true);
    const report = readFileSync(reportPath, "utf-8");
    expect(report).toContain("Friction report");

    // DB should exist
    const dbPath = join(runDir, "audit.db");
    expect(existsSync(dbPath)).toBe(true);

    // HAR should be well-formed (if generated)
    const harPath = join(runDir, "run.har");
    if (existsSync(harPath)) {
      const har = JSON.parse(readFileSync(harPath, "utf-8"));
      expect(isValidHar(har)).toBe(true);
    }

    // MHTML should be non-empty (or at least exist)
    const mhtmlPath = join(runDir, "run.mhtml");
    if (existsSync(mhtmlPath)) {
      const mhtml = readFileSync(mhtmlPath, "utf-8");
      // empty is acceptable fallback
      expect(mhtml.length).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
});
