import { JourneyConfig, type JourneyConfigT } from "./schema.js";

export type ValidateResult =
  | { valid: true; config: JourneyConfigT }
  | { valid: false; errors: string[] };

/**
 * Validate a parsed YAML object against the journey schema.
 * Returns the typed config on success, or a list of human-readable errors.
 */
export function validateJourney(input: unknown): ValidateResult {
  const result = JourneyConfig.safeParse(input);
  if (result.success) {
    return { valid: true, config: result.data };
  }
  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length === 0 ? "<root>" : issue.path.join(".");
    return `${path}: ${issue.message}`;
  });
  return { valid: false, errors };
}
