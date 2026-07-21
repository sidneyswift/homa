import type { MapScores } from "@homa/core";

import type {
  ChildProgressView,
  ProgressSubjectView,
  ProgressTopicView,
} from "../features/progress/types";
import type {
  ArchivedScoring,
  TrajectoryEvidenceRow,
} from "../features/progress/trajectory-eras";
import { supabase } from "./supabase";

/**
 * Progress reads for the signed-in app, the mobile twin of the web
 * Progress read path (apps/web/app/app/[childId]/progress/page.tsx and
 * the modules it calls). Every query runs under the caller's RLS
 * context, mirroring lib/family.ts: child_progress_live,
 * child_progress_evidence, and child_reports all carry authenticated
 * family-member select policies (migration 20260711213330), so rows are
 * family-scoped by the database itself.
 *
 * Read-only on purpose. The server owns projection, scoring writes, and
 * conflict resolution; this module only fetches what it stored.
 */

/** Web lib/time-zone.ts FALLBACK_TIME_ZONE: the US middle before a
 * device zone is captured. */
const FALLBACK_TIME_ZONE = "America/Chicago";

export function effectiveTimeZone(stored: string | null | undefined): string {
  return stored || FALLBACK_TIME_ZONE;
}

export async function getFamilyTimeZone(): Promise<string> {
  const { data, error } = await supabase
    .from("families")
    .select("time_zone")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`families read failed: ${error.message}`);
  return effectiveTimeZone((data?.time_zone as string | null) ?? null);
}

/** "YYYY-MM-DD" for `now` as seen in `timeZone` (web zonedDateString). */
function zonedDateString(now: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(now);
    const get = (type: string) =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month").padStart(2, "0")}-${get("day").padStart(2, "0")}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Shape check for the stored projection. The web reader validates with
 * a zod schema plus freshness counters and re-projects on any mismatch;
 * mobile cannot re-project (the projector and taxonomy are server
 * modules), so it verifies the load-bearing shape of the server-written
 * JSON and renders it, demoting day-relative freshness below.
 */
function parseStoredProjection(
  value: unknown,
  childId: string,
): ChildProgressView | null {
  if (!isRecord(value)) return null;
  if (value.childId !== childId) return null;
  if (typeof value.childName !== "string") return null;
  if (typeof value.birthDate !== "string") return null;
  if (typeof value.timeZone !== "string") return null;
  if (typeof value.projectedAt !== "string") return null;
  if (!isRecord(value.scores)) return null;
  if (!Array.isArray(value.scores.subjects)) return null;
  if (!Array.isArray(value.scores.strengthOrder)) return null;
  if (!Array.isArray(value.subjects)) return null;
  if (!Array.isArray(value.conflicts)) return null;
  return value as unknown as ChildProgressView;
}

/**
 * "Updated today" is a claim about TODAY. The stored projection wrote
 * that state on its own projection day; when the page is opened on a
 * later day the web read path would re-project and those states would
 * come back as "older". Mobile mirrors that outcome directly: a
 * projection from a previous day (in the family's zone) keeps every
 * fact but demotes the day-relative states, so the screen never says
 * "today" about yesterday.
 */
function demoteStaleFreshness(
  view: ChildProgressView,
  now: Date,
): ChildProgressView {
  const projectedDay = zonedDateString(
    new Date(view.projectedAt),
    view.timeZone,
  );
  const today = zonedDateString(now, view.timeZone);
  if (projectedDay === today) return view;

  const demoteTopic = (topic: ProgressTopicView): ProgressTopicView =>
    topic.state === "observed_today" ? { ...topic, state: "older" } : topic;
  const demoteSubject = (
    subject: ProgressSubjectView,
  ): ProgressSubjectView => ({
    ...subject,
    state:
      subject.state === "updated_recently" ? "older" : subject.state,
    domains: subject.domains.map((domain) => ({
      ...domain,
      topics: domain.topics.map(demoteTopic),
    })),
  });
  return { ...view, subjects: view.subjects.map(demoteSubject) };
}

/**
 * The live projection for one child, or null when no row exists yet.
 * Web twin: lib/child-progress/postgres-repository.ts loadLiveView.
 * The childId filter is a convenience; RLS is the boundary.
 */
export async function getChildProgressLiveView(
  childId: string,
  now: Date = new Date(),
): Promise<ChildProgressView | null> {
  const { data, error } = await supabase
    .from("child_progress_live")
    .select("projection")
    .eq("child_id", childId)
    .maybeSingle();
  if (error) {
    throw new Error(`child_progress_live read failed: ${error.message}`);
  }
  if (!data) return null;
  const view = parseStoredProjection(data.projection, childId);
  if (view === null) return null;
  return demoteStaleFreshness(view, now);
}

/** The mobile slice of the web DashboardReport (lib/dashboard.ts). */
export interface ChildReportRecord {
  childId: string;
  /** The permanent report URL token; session-scoped screens may link it
   * (the web report tab's sanctioned pattern). */
  token: string | null;
  scores: MapScores;
  generatedAt: string;
  /** Prior scorings, newest first, with basis stamps after migration #78. */
  history: ArchivedScoring[];
}

/** Web twin: lib/dashboard.ts getReportsForChildren, narrowed to one child. */
export async function getChildReport(
  childId: string,
): Promise<ChildReportRecord | null> {
  const { data, error } = await supabase
    .from("child_reports")
    .select("child_id, token, scores, generated_at, history")
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw new Error(`child_reports read failed: ${error.message}`);
  if (!data) return null;
  return {
    childId: data.child_id as string,
    token: (data.token as string | null) ?? null,
    scores: data.scores as MapScores,
    generatedAt: data.generated_at as string,
    history: (data.history ?? []) as ArchivedScoring[],
  };
}

const TRAJECTORY_ANSWERS = new Set(["easily", "getting_there", "not_yet"]);

/**
 * The evidence ledger slice the trajectory re-normalization reads:
 * every row (active and superseded) for one child, so answer sets can
 * be reconstructed as of any past scoring. Web twin: lib/map/store.ts
 * getTrajectoryEvidence (same columns, same order).
 */
export async function getTrajectoryEvidence(
  childId: string,
): Promise<TrajectoryEvidenceRow[]> {
  const { data, error } = await supabase
    .from("child_progress_evidence")
    .select("item_id, answer, observed_at, superseded_at, created_at")
    .eq("child_id", childId)
    .order("observed_at", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(`child_progress_evidence read failed: ${error.message}`);
  }
  const rows: TrajectoryEvidenceRow[] = [];
  for (const row of data ?? []) {
    const answer = row.answer as string;
    if (!TRAJECTORY_ANSWERS.has(answer)) continue;
    rows.push({
      itemId: row.item_id as string,
      answer: answer as TrajectoryEvidenceRow["answer"],
      observedAt: row.observed_at as string,
      supersededAt: (row.superseded_at as string | null) ?? null,
      createdAt: row.created_at as string,
    });
  }
  return rows;
}

/**
 * The canonical empty live view (web lib/child-progress/page-state.ts
 * builds the same thing through the projector when no projection
 * exists). Only the fields the read-only screen reads are populated;
 * the scores stub carries no subjects, so no tile and no badge can be
 * derived from it, which is exactly the truth before the first answer.
 */
export function emptyChildProgressView(input: {
  childId: string;
  childName: string;
  birthDate: string;
  timeZone: string;
  now?: Date;
}): ChildProgressView {
  return {
    childId: input.childId,
    childName: input.childName,
    birthDate: input.birthDate,
    timeZone: input.timeZone,
    projectedAt: (input.now ?? new Date()).toISOString(),
    scores: {
      subjects: [],
      strengthOrder: [],
      mappedCount: 0,
      totalSubjects: 0,
      observationCount: 0,
    },
    subjects: [],
    conflicts: [],
  };
}
