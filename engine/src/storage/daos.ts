import type { Database as Db } from "better-sqlite3";
import type {
  FactRow,
  IssueRow,
  JourneyRow,
  RunRow,
  RunStatus,
  ScreenshotRow,
  Severity,
  SignalRow,
  StepRow,
} from "./types.js";

function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

// ---------- runs ----------

export interface CreateRunInput {
  id?: string;
  target_url: string;
  journey_id?: string | null;
  config_json?: string | null;
}

export const runsRepo = {
  insert(db: Db, input: CreateRunInput): RunRow {
    const row: RunRow = {
      id: input.id ?? newId("run"),
      target_url: input.target_url,
      status: "queued",
      started_at: Date.now(),
      finished_at: null,
      config_json: input.config_json ?? null,
      journey_id: input.journey_id ?? null,
      warnings_json: "[]",
    };
    db.prepare(
      `INSERT INTO runs (id, target_url, status, started_at, finished_at, config_json, journey_id, warnings_json)
       VALUES (@id, @target_url, @status, @started_at, @finished_at, @config_json, @journey_id, @warnings_json)`,
    ).run(row);
    return row;
  },

  updateStatus(db: Db, runId: string, status: RunStatus): void {
    const finished = status === "done" || status === "error" || status === "partial";
    db.prepare(
      `UPDATE runs SET status = ?, finished_at = ? WHERE id = ?`,
    ).run(status, finished ? Date.now() : null, runId);
  },

  getById(db: Db, runId: string): RunRow | undefined {
    return db.prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined;
  },

  addWarning(db: Db, runId: string, warning: { code: string; message: string }): void {
    const row = this.getById(db, runId);
    if (!row) return;
    const warnings = JSON.parse(row.warnings_json) as Array<typeof warning>;
    warnings.push(warning);
    db.prepare(`UPDATE runs SET warnings_json = ? WHERE id = ?`).run(JSON.stringify(warnings), runId);
  },
};

// ---------- steps ----------

export interface CreateStepInput {
  name: string;
}

export const stepsRepo = {
  insert(db: Db, runId: string, input: CreateStepInput): StepRow {
    const row: StepRow = {
      id: newId("step"),
      run_id: runId,
      name: input.name,
      status: "ok",
      started_at: Date.now(),
      finished_at: null,
      screenshot_path: null,
    };
    db.prepare(
      `INSERT INTO steps (id, run_id, name, status, started_at, finished_at, screenshot_path)
       VALUES (@id, @run_id, @name, @status, @started_at, @finished_at, @screenshot_path)`,
    ).run(row);
    return row;
  },

  updateStatus(db: Db, stepId: string, status: StepRow["status"]): void {
    db.prepare(
      `UPDATE steps SET status = ?, finished_at = ? WHERE id = ?`,
    ).run(status, Date.now(), stepId);
  },

  getByRun(db: Db, runId: string): StepRow[] {
    return db.prepare(`SELECT * FROM steps WHERE run_id = ? ORDER BY started_at ASC`).all(runId) as StepRow[];
  },
};

// ---------- signals ----------

export interface CreateSignalInput {
  step_id?: string | null;
  category: string;
  type: string;
  payload: unknown;
  captured_at?: number;
}

export const signalsRepo = {
  insert(db: Db, runId: string, input: CreateSignalInput): SignalRow {
    const row: SignalRow = {
      id: newId("sig"),
      run_id: runId,
      step_id: input.step_id ?? null,
      category: input.category,
      type: input.type,
      payload_json: JSON.stringify(input.payload),
      captured_at: input.captured_at ?? Date.now(),
    };
    db.prepare(
      `INSERT INTO signals (id, run_id, step_id, category, type, payload_json, captured_at)
       VALUES (@id, @run_id, @step_id, @category, @type, @payload_json, @captured_at)`,
    ).run(row);
    return row;
  },

  bulkInsert(db: Db, runId: string, inputs: CreateSignalInput[]): SignalRow[] {
    const insert = db.prepare(
      `INSERT INTO signals (id, run_id, step_id, category, type, payload_json, captured_at)
       VALUES (@id, @run_id, @step_id, @category, @type, @payload_json, @captured_at)`,
    );
    return db.transaction(() =>
      inputs.map((input) => {
        const row: SignalRow = {
          id: newId("sig"),
          run_id: runId,
          step_id: input.step_id ?? null,
          category: input.category,
          type: input.type,
          payload_json: JSON.stringify(input.payload),
          captured_at: input.captured_at ?? Date.now(),
        };
        insert.run(row);
        return row;
      }),
    )();
  },

  getByRun(db: Db, runId: string): SignalRow[] {
    return db.prepare(`SELECT * FROM signals WHERE run_id = ? ORDER BY captured_at ASC`).all(runId) as SignalRow[];
  },

  query(db: Db, runId: string, filters: { category?: string; type?: string }): SignalRow[] {
    let sql = `SELECT * FROM signals WHERE run_id = ?`;
    const params: unknown[] = [runId];
    if (filters.category) {
      sql += ` AND category = ?`;
      params.push(filters.category);
    }
    if (filters.type) {
      sql += ` AND type = ?`;
      params.push(filters.type);
    }
    sql += ` ORDER BY captured_at ASC`;
    return db.prepare(sql).all(...params) as SignalRow[];
  },

  getById(db: Db, signalId: string): SignalRow | undefined {
    return db.prepare(`SELECT * FROM signals WHERE id = ?`).get(signalId) as SignalRow | undefined;
  },
};

// ---------- screenshots ----------

export interface CreateScreenshotInput {
  step_id?: string | null;
  path: string;
  kind: ScreenshotRow["kind"];
  width?: number | null;
  height?: number | null;
}

export const screenshotsRepo = {
  insert(db: Db, runId: string, input: CreateScreenshotInput): ScreenshotRow {
    const row: ScreenshotRow = {
      id: newId("shot"),
      run_id: runId,
      step_id: input.step_id ?? null,
      path: input.path,
      kind: input.kind,
      width: input.width ?? null,
      height: input.height ?? null,
    };
    db.prepare(
      `INSERT INTO screenshots (id, run_id, step_id, path, kind, width, height)
       VALUES (@id, @run_id, @step_id, @path, @kind, @width, @height)`,
    ).run(row);
    return row;
  },

  getByRun(db: Db, runId: string): ScreenshotRow[] {
    return db.prepare(`SELECT * FROM screenshots WHERE run_id = ? ORDER BY id ASC`).all(runId) as ScreenshotRow[];
  },
};

// ---------- issues ----------

export interface CreateIssueInput {
  kind: string;
  severity: Severity;
  summary: string;
  evidence: string[]; // signal IDs
}

export const issuesRepo = {
  /**
   * Persists an issue. Throws if evidence is empty (invariant from spec:
   * "Every issue cites at least one signal as evidence").
   */
  insert(db: Db, runId: string, input: CreateIssueInput): IssueRow {
    if (input.evidence.length === 0) {
      throw new Error(
        `Refusing to insert issue ${input.kind} for run ${runId}: evidence is empty. ` +
          `Every issue must cite at least one signal_id.`,
      );
    }
    const row: IssueRow = {
      id: newId("iss"),
      run_id: runId,
      kind: input.kind,
      severity: input.severity,
      summary: input.summary,
      evidence_json: JSON.stringify(input.evidence),
    };
    db.prepare(
      `INSERT INTO issues (id, run_id, kind, severity, summary, evidence_json)
       VALUES (@id, @run_id, @kind, @severity, @summary, @evidence_json)`,
    ).run(row);
    return row;
  },

  getByRun(db: Db, runId: string): IssueRow[] {
    return db.prepare(`SELECT * FROM issues WHERE run_id = ? ORDER BY id ASC`).all(runId) as IssueRow[];
  },

  countByKind(db: Db, runId: string): Record<string, number> {
    const rows = db
      .prepare(`SELECT kind, COUNT(*) as count FROM issues WHERE run_id = ? GROUP BY kind`)
      .all(runId) as Array<{ kind: string; count: number }>;
    const out: Record<string, number> = {};
    for (const r of rows) out[r.kind] = r.count;
    return out;
  },
};

// ---------- facts ----------

export interface CreateFactInput {
  key: string;
  value: unknown;
  source_signal_ids?: string[];
}

export const factsRepo = {
  insert(db: Db, runId: string, input: CreateFactInput): FactRow {
    const row: FactRow = {
      id: newId("fact"),
      run_id: runId,
      key: input.key,
      value_json: JSON.stringify(input.value),
      source_signal_ids_json: JSON.stringify(input.source_signal_ids ?? []),
    };
    db.prepare(
      `INSERT INTO facts (id, run_id, key, value_json, source_signal_ids_json)
       VALUES (@id, @run_id, @key, @value_json, @source_signal_ids_json)`,
    ).run(row);
    return row;
  },

  upsert(db: Db, runId: string, input: CreateFactInput): FactRow {
    const existing = db
      .prepare(`SELECT id FROM facts WHERE run_id = ? AND key = ?`)
      .get(runId, input.key) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE facts SET value_json = ?, source_signal_ids_json = ? WHERE id = ?`,
      ).run(
        JSON.stringify(input.value),
        JSON.stringify(input.source_signal_ids ?? []),
        existing.id,
      );
      return {
        id: existing.id,
        run_id: runId,
        key: input.key,
        value_json: JSON.stringify(input.value),
        source_signal_ids_json: JSON.stringify(input.source_signal_ids ?? []),
      };
    }
    return this.insert(db, runId, input);
  },

  getByRun(db: Db, runId: string): FactRow[] {
    return db.prepare(`SELECT * FROM facts WHERE run_id = ? ORDER BY key ASC`).all(runId) as FactRow[];
  },
};

// ---------- report_docs ----------

export interface CreateReportDocInput {
  executive_json?: string | null;
  insights_json?: string | null;
  rendered_at?: number | null;
}

export const reportDocsRepo = {
  insert(db: Db, runId: string, input: CreateReportDocInput): void {
    db.prepare(
      `INSERT INTO report_docs (id, run_id, executive_json, insights_json, rendered_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(run_id) DO UPDATE SET
         executive_json = excluded.executive_json,
         insights_json = excluded.insights_json,
         rendered_at = excluded.rendered_at`,
    ).run(
      newId("rd"),
      runId,
      input.executive_json ?? null,
      input.insights_json ?? null,
      input.rendered_at ?? Date.now(),
    );
  },

  getByRun(db: Db, runId: string) {
    return db.prepare(`SELECT * FROM report_docs WHERE run_id = ?`).get(runId) as
      | { id: string; run_id: string; executive_json: string | null; insights_json: string | null; rendered_at: number | null }
      | undefined;
  },
};

// ---------- journeys ----------

export interface CreateJourneyInput {
  name: string;
  config: unknown;
}

export const journeysRepo = {
  insert(db: Db, input: CreateJourneyInput): JourneyRow {
    const row: JourneyRow = {
      id: newId("jny"),
      name: input.name,
      config_json: JSON.stringify(input.config),
    };
    db.prepare(
      `INSERT INTO journeys (id, name, config_json) VALUES (?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET config_json = excluded.config_json`,
    ).run(row.id, row.name, row.config_json);
    return row;
  },

  getByName(db: Db, name: string): JourneyRow | undefined {
    return db.prepare(`SELECT * FROM journeys WHERE name = ?`).get(name) as JourneyRow | undefined;
  },

  list(db: Db): JourneyRow[] {
    return db.prepare(`SELECT * FROM journeys ORDER BY name ASC`).all() as JourneyRow[];
  },
};
