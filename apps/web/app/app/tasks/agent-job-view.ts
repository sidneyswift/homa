/**
 * View model + presentation helpers for the parent-facing agent-jobs
 * surface (the "Another Task" card, plan §A2). Directive-free and pure so
 * the server page can map rows and the client card/overlay can render
 * words, and both share one testable source of truth.
 *
 * The DB tables (agent_jobs, agent_job_stages) are GENERAL: the schema
 * knows nothing about weeks or volumes, only stages. So the vocabulary a
 * parent reads ("Volume 3 of 9") is a per-skill presentation choice made
 * HERE, never a column. curriculum-studio is the only job skill today; a
 * new one adds a stageNoun entry, not a migration.
 */

/** The two SELECT lists the page reads under the caller's own RLS (the
 * members-read policies from migration 20260718140000). Bounded columns
 * only: no session_id, no plan/payload jsonb, nothing the card never
 * shows. */
export const AGENT_JOB_SELECT =
  "id, skill, title, status, current_stage, total_stages, progress_note, created_at";
export const AGENT_JOB_STAGE_SELECT = "job_id, stage_number, status, title";

export type AgentJobStatus =
  | "queued"
  | "running"
  | "paused"
  | "awaiting_input"
  | "completed"
  | "cancelled"
  | "failed";

/** The four statuses a parent can still steer. A job outside this set is
 * finished and never gets a card. */
export const ACTIVE_JOB_STATUSES = [
  "queued",
  "running",
  "paused",
  "awaiting_input",
] as const;

export type AgentJobStageStatus =
  | "pending"
  | "in_progress"
  | "ready_for_review"
  | "approved"
  | "superseded"
  | "skipped"
  | "failed";

export interface AgentJobStageRow {
  job_id: string;
  stage_number: number;
  status: AgentJobStageStatus;
  title: string | null;
}

export interface AgentJobRow {
  id: string;
  skill: string;
  title: string;
  status: AgentJobStatus;
  current_stage: number;
  total_stages: number;
  progress_note: string | null;
  created_at: string;
}

export interface AgentJobStageView {
  stageNumber: number;
  status: AgentJobStageStatus;
  title: string | null;
}

export interface AgentJobView {
  id: string;
  skill: string;
  title: string;
  status: AgentJobStatus;
  totalStages: number;
  progressNote: string | null;
  startedAt: string;
  /** The stage the build is working on (or waiting for approval on), 1-based
   * and clamped into [1, totalStages]. Derived, not read raw, because a
   * fresh job sits at current_stage 0. */
  position: number;
  /** Every stage row the runner has created so far, in order. Early on this
   * is just stage 1; the rest are summarized as "up next" by the overlay. */
  stages: AgentJobStageView[];
}

/** Per-skill words for a stage. Keeps the DB generic while the card still
 * reads in the parent's own terms. Unknown skills fall back to neutral
 * "part" language so a new job skill is never wrong, just plain, until it
 * earns its own entry. */
export interface StageNoun {
  singular: string;
  plural: string;
}

const STAGE_NOUNS: Record<string, StageNoun> = {
  "curriculum-studio": { singular: "Volume", plural: "Volumes" },
};

const DEFAULT_STAGE_NOUN: StageNoun = { singular: "Part", plural: "Parts" };

export function stageNoun(skill: string): StageNoun {
  return STAGE_NOUNS[skill] ?? DEFAULT_STAGE_NOUN;
}

/**
 * The parent-facing status word for one stage in the overlay list. Calm by
 * copy law: no red, nothing framed as failure or "behind". "Saved" means
 * the stage is approved and its pages are in the Binder; "Ready for you"
 * is the one that asks for a tap.
 */
export function stageStatusLabel(status: AgentJobStageStatus): string {
  switch (status) {
    case "approved":
      return "Saved";
    case "ready_for_review":
      return "Ready for you";
    case "in_progress":
      return "Building";
    case "pending":
      return "Up next";
    case "skipped":
      return "Skipped";
    case "superseded":
      return "Updated";
    case "failed":
      return "Needs another try";
    default: {
      const exhaustive: never = status;
      throw new Error(`unhandled stage status: ${String(exhaustive)}`);
    }
  }
}

export type JobPillTone = "attention" | "building" | "muted";

export interface JobPill {
  tone: JobPillTone;
  label: string;
}

/**
 * The card's at-a-glance pill, the job's answer to the Next/Off pill on a
 * scheduled task. awaiting_input is the one that earns the warm, eye-drawing
 * tone because it is the only state that needs the parent; building and
 * paused stay calm.
 */
export function jobPill(status: AgentJobStatus): JobPill {
  switch (status) {
    case "awaiting_input":
      return { tone: "attention", label: "Ready for you" };
    case "paused":
      return { tone: "muted", label: "Paused" };
    case "queued":
    case "running":
      return { tone: "building", label: "Building" };
    default:
      // Finished jobs never reach a card, but keep the function total.
      return { tone: "muted", label: "Done" };
  }
}

/** The working stage number, honest for a job that has not started a stage
 * yet. Prefers a stage the runner has actually opened (in progress or
 * waiting for review); falls back to current_stage, then to 1. */
function derivePosition(row: AgentJobRow, stages: AgentJobStageView[]): number {
  const open = stages.find(
    (stage) => stage.status === "in_progress" || stage.status === "ready_for_review",
  );
  const raw = open ? open.stageNumber : row.current_stage >= 1 ? row.current_stage : 1;
  return Math.min(Math.max(raw, 1), row.total_stages);
}

/**
 * mapAgentJobViews(jobRows, stageRows): join active jobs to their stage
 * rows (grouped by job_id) into render-ready views. Stage rows arrive from
 * a single `.in("job_id", ids)` read, so this groups them in memory rather
 * than issuing a query per job.
 */
export function mapAgentJobViews(
  jobRows: AgentJobRow[],
  stageRows: AgentJobStageRow[],
): AgentJobView[] {
  const stagesByJob = new Map<string, AgentJobStageView[]>();
  for (const stage of stageRows) {
    const list = stagesByJob.get(stage.job_id) ?? [];
    list.push({
      stageNumber: stage.stage_number,
      status: stage.status,
      title: stage.title,
    });
    stagesByJob.set(stage.job_id, list);
  }

  return jobRows.map((row) => {
    const stages = (stagesByJob.get(row.id) ?? []).sort(
      (a, b) => a.stageNumber - b.stageNumber,
    );
    return {
      id: row.id,
      skill: row.skill,
      title: row.title,
      status: row.status,
      totalStages: row.total_stages,
      progressNote: row.progress_note,
      startedAt: row.created_at,
      position: derivePosition(row, stages),
      stages,
    };
  });
}

/**
 * The not-yet-opened stages, summarized as one "up next" line in the
 * overlay (matches the mockup's "Volumes 4-9 · Up next"). Returns the
 * inclusive range beyond the highest stage the runner has created, or null
 * when every stage already has its own row.
 */
export function remainingStageRange(
  job: AgentJobView,
): { from: number; to: number } | null {
  const highest = job.stages.reduce((max, stage) => Math.max(max, stage.stageNumber), 0);
  const from = highest + 1;
  if (from > job.totalStages) return null;
  return { from, to: job.totalStages };
}

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/** "started Jul 14" in the family's own zone. */
export function startedLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleDateString("en-US", { ...MONTH_DAY, timeZone });
}

/** The card's meta line: "Volume 3 of 9 · started Jul 14". The one place
 * that carries position, so the pill can stay a plain status word. */
export function jobMetaLine(job: AgentJobView, timeZone: string): string {
  const noun = stageNoun(job.skill).singular;
  return `${noun} ${job.position} of ${job.totalStages} · started ${startedLabel(
    job.startedAt,
    timeZone,
  )}`;
}
