import { supabase } from "./supabase";

/**
 * Lesson listen reads for the signed-in app. The web twin
 * (apps/web/lib/lessons/store.ts) reads through a server-only postgres
 * connection; the underlying tables grant SELECT to authenticated
 * family members ("members read lesson ..." policies in
 * supabase/migrations/20260714033500_lesson_listen.sql), so mobile does
 * the equivalent reads directly under the caller's RLS context. Writes
 * (retry, photos, delete) stay on the web's guarded server paths, which
 * is why this module is read-only on purpose.
 *
 * Every query still re-scopes by family_id explicitly, matching the
 * house defense-in-depth style: RLS is the wall, the predicate is the
 * habit.
 */

export type LessonStatus =
  | "recording"
  | "uploaded"
  | "analyzing"
  | "ready"
  | "failed";

/** The fields the review screen renders (a trim of web's LessonRecordingRow). */
export interface LessonRecording {
  id: string;
  familyId: string;
  childId: string;
  status: LessonStatus;
  source: "recorder" | "upload";
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
}

export interface LessonSegment {
  id: string;
  seq: number;
  transcript: string | null;
}

export interface LessonMedia {
  id: string;
  blobUrl: string;
  caption: string | null;
  capturedDuringSeq: number | null;
  createdAt: string;
}

export interface LessonReview {
  lessonId: string;
  childId: string;
  summary: string;
  insights: unknown;
  createdAt: string;
}

export async function getLessonRecording(
  lessonId: string,
  familyId: string,
): Promise<LessonRecording | null> {
  const { data, error } = await supabase
    .from("lesson_recordings")
    .select(
      "id, family_id, child_id, status, source, started_at, finished_at, duration_seconds",
    )
    .eq("id", lessonId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) throw new Error(`lesson read failed: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    familyId: data.family_id,
    childId: data.child_id,
    status: data.status,
    source: data.source,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    durationSeconds: data.duration_seconds,
  };
}

export async function listLessonSegments(
  lessonId: string,
  familyId: string,
): Promise<LessonSegment[]> {
  const { data, error } = await supabase
    .from("lesson_segments")
    .select("id, seq, transcript")
    .eq("lesson_id", lessonId)
    .eq("family_id", familyId)
    .order("seq", { ascending: true });
  if (error) throw new Error(`lesson segments read failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    seq: row.seq,
    transcript: row.transcript,
  }));
}

export async function listLessonMedia(
  lessonId: string,
  familyId: string,
): Promise<LessonMedia[]> {
  const { data, error } = await supabase
    .from("lesson_media")
    .select("id, blob_url, caption, captured_during_seq, created_at")
    .eq("lesson_id", lessonId)
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`lesson media read failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    blobUrl: row.blob_url,
    caption: row.caption,
    capturedDuringSeq: row.captured_during_seq,
    createdAt: row.created_at,
  }));
}

export async function getLessonReview(
  lessonId: string,
  familyId: string,
): Promise<LessonReview | null> {
  const { data, error } = await supabase
    .from("lesson_reviews")
    .select("lesson_id, child_id, summary, insights, created_at")
    .eq("lesson_id", lessonId)
    .eq("family_id", familyId)
    .maybeSingle();
  if (error) throw new Error(`lesson review read failed: ${error.message}`);
  if (!data) return null;
  return {
    lessonId: data.lesson_id,
    childId: data.child_id,
    summary: data.summary,
    insights: data.insights,
    createdAt: data.created_at,
  };
}
