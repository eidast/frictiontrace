export type RunStatus =
  | "queued"
  | "captured"
  | "analyzed"
  | "narrated"
  | "done"
  | "error"
  | "partial";

export type StepStatus = "ok" | "failed" | "timeout" | "skipped";
export type Severity = "low" | "med" | "high" | "critical";

export type ScreenshotKind = "viewport" | "above_fold" | "full_page";

export interface RunRow {
  id: string;
  target_url: string;
  status: RunStatus;
  started_at: number | null;
  finished_at: number | null;
  config_json: string | null;
  journey_id: string | null;
  warnings_json: string;
}

export interface StepRow {
  id: string;
  run_id: string;
  name: string;
  status: StepStatus;
  started_at: number | null;
  finished_at: number | null;
  screenshot_path: string | null;
}

export interface SignalRow {
  id: string;
  run_id: string;
  step_id: string | null;
  category: string;
  type: string;
  payload_json: string;
  captured_at: number;
}

export interface ScreenshotRow {
  id: string;
  run_id: string;
  step_id: string | null;
  path: string;
  kind: ScreenshotKind;
  width: number | null;
  height: number | null;
}

export interface IssueRow {
  id: string;
  run_id: string;
  kind: string;
  severity: Severity;
  summary: string;
  evidence_json: string;
}

export interface FactRow {
  id: string;
  run_id: string;
  key: string;
  value_json: string;
  source_signal_ids_json: string;
}

export interface ReportDocRow {
  id: string;
  run_id: string;
  executive_json: string | null;
  insights_json: string | null;
  rendered_at: number | null;
}

export interface JourneyRow {
  id: string;
  name: string;
  config_json: string;
}
