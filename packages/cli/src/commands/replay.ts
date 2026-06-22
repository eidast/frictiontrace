import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { runsBaseDir } from "@frictiontrace/engine/storage";
import { createLogger, EXIT } from "../logger.js";

export interface ReplayOptions {
  outDir?: string;
  quiet?: boolean;
  verbose?: boolean;
}

export async function replayCommand(runId: string, opts: ReplayOptions = {}): Promise<number> {
  const logger = createLogger(opts);
  const baseDir = opts.outDir ?? runsBaseDir();
  const reportPath = resolve(join(baseDir, runId, "report.html"));
  if (!existsSync(reportPath)) {
    logger.error(`report not found at ${reportPath}`);
    return EXIT.INVALID_INPUT;
  }
  const opener = pickOpener();
  if (!opener) {
    logger.error("could not detect a platform opener. Open the report manually:");
    process.stderr.write(`${reportPath}\n`);
    return EXIT.ENGINE_ERROR;
  }
  logger.info(`opening ${reportPath} with ${opener.cmd}`);
  const child = spawn(opener.cmd, [...opener.args, reportPath], { stdio: "ignore", detached: true });
  child.unref();
  return EXIT.SUCCESS;
}

interface Opener {
  cmd: string;
  args: string[];
}

function pickOpener(): Opener | null {
  const p = process.platform;
  if (p === "darwin") return { cmd: "open", args: [] };
  if (p === "win32") return { cmd: "cmd", args: ["/c", "start", ""] };
  // Linux and others
  return { cmd: "xdg-open", args: [] };
}
