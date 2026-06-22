#!/usr/bin/env node
import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { validateCommand } from "./commands/validate.js";
import { replayCommand } from "./commands/replay.js";

const program = new Command();
program
  .name("ft")
  .description("FrictionTrace — digital experience monitoring for e-commerce")
  .version("0.1.0");

program
  .command("run")
  .description("Run an audit against a target e-commerce URL")
  .argument("<url>", "target e-commerce URL")
  .option("-j, --journey <path>", "path to journey YAML (overrides default)")
  .option("-o, --out-dir <path>", "output directory (overrides ./runs)")
  .option("-q, --quiet", "suppress info-level logs")
  .option("-v, --verbose", "emit debug-level logs")
  .action(async (url, opts) => {
    const code = await runCommand(url, opts);
    process.exit(code);
  });

program
  .command("validate")
  .description("Validate a journey YAML file against the journey schema")
  .argument("<path>", "path to journey YAML")
  .option("-q, --quiet", "suppress info-level logs")
  .option("-v, --verbose", "emit debug-level logs")
  .action(async (path, opts) => {
    const code = await validateCommand(path, opts);
    process.exit(code);
  });

program
  .command("replay")
  .description("Open the report.html for a previous run in the default browser")
  .argument("<runId>", "the run identifier")
  .option("-o, --out-dir <path>", "output directory (overrides ./runs)")
  .option("-q, --quiet", "suppress info-level logs")
  .option("-v, --verbose", "emit debug-level logs")
  .action(async (runId, opts) => {
    const code = await replayCommand(runId, opts);
    process.exit(code);
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(3);
});
