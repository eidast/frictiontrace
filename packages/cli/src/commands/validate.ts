import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { validateJourney } from "@frictiontrace/engine/journey";
import { createLogger, EXIT } from "../logger.js";

export interface ValidateOptions {
  quiet?: boolean;
  verbose?: boolean;
}

export async function validateCommand(path: string, opts: ValidateOptions = {}): Promise<number> {
  const logger = createLogger(opts);
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    logger.error(`could not read ${path}: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.INVALID_INPUT;
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    logger.error(`invalid YAML: ${err instanceof Error ? err.message : String(err)}`);
    return EXIT.INVALID_INPUT;
  }
  const result = validateJourney(parsed);
  if (result.valid) {
    process.stdout.write(`OK: ${path}\n`);
    return EXIT.SUCCESS;
  }
  logger.error(`validation failed (${result.errors.length} error${result.errors.length > 1 ? "s" : ""}):`);
  for (const e of result.errors) {
    logger.error(`  - ${e}`);
  }
  return EXIT.INVALID_INPUT;
}
