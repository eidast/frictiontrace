type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LoggerOptions {
  level?: LogLevel;
  quiet?: boolean;
  verbose?: boolean;
}

/**
 * Logger that writes to stderr by default so stdout stays parseable.
 * Honors --quiet (suppresses info) and --verbose (emits debug).
 */
export function createLogger(opts: LoggerOptions = {}): {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  setLevel: (l: LogLevel) => void;
} {
  let level: LogLevel = opts.level ?? (opts.quiet ? "warn" : opts.verbose ? "debug" : "info");
  const log = (l: LogLevel, msg: string): void => {
    if (LEVEL_RANK[l] < LEVEL_RANK[level]) return;
    const tag = l.toUpperCase().padEnd(5);
    process.stderr.write(`[${tag}] ${msg}\n`);
  };
  return {
    debug: (m) => log("debug", m),
    info: (m) => log("info", m),
    warn: (m) => log("warn", m),
    error: (m) => log("error", m),
    setLevel: (l) => { level = l; },
  };
}

export const EXIT = {
  SUCCESS: 0,
  PARTIAL: 1,
  INVALID_INPUT: 2,
  ENGINE_ERROR: 3,
} as const;
