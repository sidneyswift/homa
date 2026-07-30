import { mapDb } from "../map/db";

/**
 * Lesson listen's durable state (plan 2026-07-13-lesson-listen.md,
 * LL-1/LL-2/LL-4). One lesson_recordings row per recorded or uploaded
 * lesson, one lesson_segments row per ~3-minute audio segment, media
 * rows for worksheet photos, and one lesson_reviews row once the
 * synthesis pass finishes.
 *
 * Every function takes familyId from the caller's own session
 * resolution (resolveApiFamily or getMyFamily) and re-scopes every id
 * inside the SQL itself, the ChildProgress posture: RLS gives members
 * SELECT, all writes ride the server-only connection here.
 *
 * Claim semantics copy lib/learning/call-memory.ts: a timestamp column
 * is the claim, a stale claim is reclaimable, and the hourly cron
 * sweep is the only retry mechanism (no new async primitive).
 */

export type LessonStatus =
  | "recording"
  | "uploaded"
  | "analyzing"
  | "ready"
  | "failed";

export interface LessonRecordingRow {
  id: string;
  familyId: string;
  childId: string;
  createdBy: string | null;
  status: LessonStatus;
  source: "recorder" | "upload";
  startedAt: string;
  finishedAt: string | null;
  durationSeconds: number | null;
  attempts: number;
  audioDeletedAt: string | null;
  /** Set when the review found a breakthrough or sweet moment: this
   *  lesson's recording is exempt from the 30-day TTL and the parent
   *  has been told (founder ruling `keep-their-voice`). */
  audioKeptAt: string | null;
  error: string | null;
}

export interface LessonSegmentRow {
  id: string;
  lessonId: string;
  seq: number;
  blobUrl: string;
  contentType: string;
  durationSeconds: number | null;
  transcript: string | null;
  toneNotes: unknown;
}

export interface LessonMediaRow {
  id: string;
  lessonId: string;
  blobUrl: string;
  contentType: string;
  caption: string | null;
  capturedDuringSeq: number | null;
  attachedAfterReady: boolean;
  createdAt: string;
}

export interface LessonReviewRow {
  lessonId: string;
  childId: string;
  summary: string;
  insights: unknown;
  evidenceCount: number;
  observationCount: number;
  createdAt: string;
}

/** §7 Q4: bounds abuse, never the habit loop. Rolling 24 hours so the
 *  family's time zone never has to enter cap math. */
export const LESSONS_PER_FAMILY_PER_DAY = 6;
/** §4.9: images only, and enough for a stack of worksheet photos. */
export const MEDIA_ITEMS_PER_LESSON = 12;
/** A segment claim older than this is retryable (route died mid-call). */
const SEGMENT_CLAIM_STALE_MS = 10 * 60_000;
/** An analyzing lesson older than this is re-kickable by the sweep. */
const ANALYSIS_CLAIM_STALE_MS = 15 * 60_000;
/** Bounded attempts, then failed with honest copy (plan §4.8). */
export const MAX_ANALYSIS_ATTEMPTS = 4;
/** Raw audio TTL (§1 item 5): delete blobs, keep rows and transcripts. */
const AUDIO_TTL_DAYS = 30;

interface LessonRecordingSqlRow {
  id: string;
  family_id: string;
  child_id: string;
  created_by: string | null;
  status: LessonStatus;
  source: "recorder" | "upload";
  started_at: string;
  finished_at: string | null;
  duration_seconds: number | null;
  attempts: number;
  audio_deleted_at: string | null;
  audio_kept_at: string | null;
  error: string | null;
}

function toLessonRow(row: LessonRecordingSqlRow): LessonRecordingRow {
  return {
    id: row.id,
    familyId: row.family_id,
    childId: row.child_id,
    createdBy: row.created_by,
    status: row.status,
    source: row.source,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    durationSeconds: row.duration_seconds,
    attempts: row.attempts,
    audioDeletedAt: row.audio_deleted_at,
    audioKeptAt: row.audio_kept_at,
    error: row.error,
  };
}

export type CreateLessonResult =
  | { status: "created"; lesson: LessonRecordingRow }
  | { status: "unknown_child" }
  | { status: "daily_cap" };

/**
 * Opens one lesson row. The child is re-scoped to the caller's family
 * inside the insert; a forged childId inserts nothing.
 */
export async function createLessonRecording(input: {
  familyId: string;
  childId: string;
  createdBy: string;
  source: "recorder" | "upload";
}): Promise<CreateLessonResult> {
  const sql = mapDb();
  const recent = await sql<{ count: string }[]>`
    select count(*)::text as count
    from public.lesson_recordings
    where family_id = ${input.familyId}
      and created_at > now() - interval '24 hours'
  `;
  if (Number(recent[0]?.count ?? "0") >= LESSONS_PER_FAMILY_PER_DAY) {
    return { status: "daily_cap" };
  }
  const rows = await sql<LessonRecordingSqlRow[]>`
    insert into public.lesson_recordings (family_id, child_id, created_by, source)
    select ${input.familyId}, ${input.childId}, ${input.createdBy}, ${input.source}
    where exists (
      select 1 from public.children child
      where child.id = ${input.childId}
        and child.family_id = ${input.familyId}
    )
    returning id, family_id, child_id, created_by, status, source,
              started_at::text, finished_at::text, duration_seconds,
              attempts, audio_deleted_at::text, audio_kept_at::text, error
  `;
  const row = rows[0];
  if (row === undefined) return { status: "unknown_child" };
  return { status: "created", lesson: toLessonRow(row) };
}

export async function getLessonForFamily(
  lessonId: string,
  familyId: string,
): Promise<LessonRecordingRow | null> {
  const sql = mapDb();
  const rows = await sql<LessonRecordingSqlRow[]>`
    select id, family_id, child_id, created_by, status, source,
           started_at::text, finished_at::text, duration_seconds,
           attempts, audio_deleted_at::text, audio_kept_at::text, error
    from public.lesson_recordings
    where id = ${lessonId} and family_id = ${familyId}
  `;
  return rows[0] === undefined ? null : toLessonRow(rows[0]);
}

/**
 * The family's recorded lessons, newest first (gh#353).
 *
 * Homa could not see these at all. On 2026-07-27 a parent asked three
 * times to move a recording filed under the wrong child, and Homa
 * answered "I don't see any recording anywhere" while the row sat in
 * this table, 28 minutes of audio, already analysed. She was not
 * refusing; no tool had ever been able to look.
 */
export async function listLessonRecordingsForFamily(
  familyId: string,
  limit = 20,
): Promise<LessonRecordingRow[]> {
  const sql = mapDb();
  const rows = await sql<LessonRecordingSqlRow[]>`
    select id, family_id, child_id, created_by, status, source,
           started_at::text, finished_at::text, duration_seconds,
           attempts, audio_deleted_at::text, audio_kept_at::text, error
    from public.lesson_recordings
    where family_id = ${familyId}
    order by started_at desc
    limit ${limit}
  `;
  return rows.map(toLessonRow);
}

export type ReassignLessonResult =
  | { status: "reassigned"; movedReviews: number; movedEvidence: number }
  | { status: "unknown_lesson" }
  | { status: "unknown_child" }
  | { status: "already_there" };

/**
 * Move a recording to the child it was actually about (gh#353).
 *
 * Atomic across all three tables on purpose. The recording is the least
 * of it: the review a parent reads names the child, and the progress
 * evidence the lesson produced SCORES that child. Carolyng's 07-27
 * recording had put a preschool phonics claim on her nine-year-old, so
 * moving only the recording would leave the wrong child's record
 * quietly wrong, which is worse than the original mistake because it
 * looks fixed.
 *
 * Both ids are re-scoped inside the family before anything moves. The
 * evidence update deliberately fires the row-revision trigger, so the
 * progress projection recomputes for both children.
 */
export async function reassignLessonRecording(input: {
  familyId: string;
  lessonId: string;
  childId: string;
}): Promise<ReassignLessonResult> {
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    const lessonRows = await transaction<{ child_id: string }[]>`
      select child_id from public.lesson_recordings
      where id = ${input.lessonId} and family_id = ${input.familyId}
      for update
    `;
    if (lessonRows[0] === undefined) return { status: "unknown_lesson" };
    if (lessonRows[0].child_id === input.childId) return { status: "already_there" };

    const childRows = await transaction<{ id: string }[]>`
      select id from public.children
      where id = ${input.childId} and family_id = ${input.familyId}
    `;
    if (childRows[0] === undefined) return { status: "unknown_child" };

    await transaction`
      update public.lesson_recordings set child_id = ${input.childId}
      where id = ${input.lessonId} and family_id = ${input.familyId}
    `;
    const reviews = await transaction<{ lesson_id: string }[]>`
      update public.lesson_reviews set child_id = ${input.childId}
      where lesson_id = ${input.lessonId} and family_id = ${input.familyId}
      returning lesson_id
    `;
    // The link is the idempotency key, shaped `lesson:<id>:<hash>`, not
    // message_id: lesson evidence carries no message. Verified against a
    // real row, because the first version of this matched on message_id,
    // which is null for every lesson_listen row, so it would have moved
    // the recording and silently left the scoring on the wrong child.
    const evidence = await transaction<{ id: string }[]>`
      update public.child_progress_evidence set child_id = ${input.childId}
      where family_id = ${input.familyId}
        and source = 'lesson_listen'
        and idempotency_key like ${`lesson:${input.lessonId}:%`}
      returning id
    `;
    return {
      status: "reassigned",
      movedReviews: reviews.length,
      movedEvidence: evidence.length,
    };
  });
}

export type RegisterSegmentResult =
  | { status: "registered"; segmentId: string }
  | { status: "duplicate"; segmentId: string }
  | { status: "not_open" };

/**
 * Registers one uploaded segment. Idempotent on (lesson, seq): the
 * recorder retries registration freely after a flaky connection.
 * Only recorder-open or just-finished lessons accept segments; ready
 * and failed lessons never grow.
 */
export async function registerLessonSegment(input: {
  lessonId: string;
  familyId: string;
  seq: number;
  blobUrl: string;
  contentType: string;
  durationSeconds: number | null;
}): Promise<RegisterSegmentResult> {
  const sql = mapDb();
  const inserted = await sql<{ id: string }[]>`
    insert into public.lesson_segments
      (lesson_id, family_id, seq, blob_url, content_type, duration_seconds)
    select ${input.lessonId}, ${input.familyId}, ${input.seq},
           ${input.blobUrl}, ${input.contentType}, ${input.durationSeconds}
    where exists (
      select 1 from public.lesson_recordings lesson
      where lesson.id = ${input.lessonId}
        and lesson.family_id = ${input.familyId}
        and lesson.status in ('recording', 'uploaded')
    )
    on conflict (lesson_id, seq) do nothing
    returning id
  `;
  if (inserted[0] !== undefined) {
    return { status: "registered", segmentId: inserted[0].id };
  }
  const existing = await sql<{ id: string }[]>`
    select id from public.lesson_segments
    where lesson_id = ${input.lessonId}
      and family_id = ${input.familyId}
      and seq = ${input.seq}
  `;
  return existing[0] === undefined
    ? { status: "not_open" }
    : { status: "duplicate", segmentId: existing[0].id };
}

/**
 * Claims one segment for transcription (or tone notes). Returns the
 * segment only when this caller won the claim; a fresh claim by
 * someone else returns null and the sweep retries stale ones.
 */
export async function claimSegmentWork(
  segmentId: string,
  familyId: string,
): Promise<LessonSegmentRow | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      lesson_id: string;
      seq: number;
      blob_url: string;
      content_type: string;
      duration_seconds: number | null;
      transcript: string | null;
      tone_notes: unknown;
    }[]
  >`
    update public.lesson_segments
    set transcribe_claimed_at = now()
    where id = ${segmentId}
      and family_id = ${familyId}
      and (transcript is null or tone_notes is null)
      and (
        transcribe_claimed_at is null
        or transcribe_claimed_at
          < now() - make_interval(secs => ${SEGMENT_CLAIM_STALE_MS / 1000})
      )
    returning id, lesson_id, seq, blob_url, content_type,
              duration_seconds, transcript, tone_notes
  `;
  const row = rows[0];
  if (row === undefined) return null;
  return {
    id: row.id,
    lessonId: row.lesson_id,
    seq: row.seq,
    blobUrl: row.blob_url,
    contentType: row.content_type,
    durationSeconds: row.duration_seconds,
    transcript: row.transcript,
    toneNotes: row.tone_notes,
  };
}

export async function saveSegmentTranscript(input: {
  segmentId: string;
  familyId: string;
  transcript: string;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_segments
    set transcript = ${input.transcript}, transcribed_at = now()
    where id = ${input.segmentId} and family_id = ${input.familyId}
  `;
}

export async function saveSegmentToneNotes(input: {
  segmentId: string;
  familyId: string;
  toneNotes: unknown;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_segments
    set tone_notes = ${sql.json(input.toneNotes as never)},
        tone_noted_at = now()
    where id = ${input.segmentId} and family_id = ${input.familyId}
  `;
}

/** Clears a claim after a failed pass so the sweep can retry sooner. */
export async function releaseSegmentClaim(
  segmentId: string,
  familyId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_segments
    set transcribe_claimed_at = null
    where id = ${segmentId} and family_id = ${familyId}
  `;
}

export async function listLessonSegments(
  lessonId: string,
  familyId: string,
): Promise<LessonSegmentRow[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      lesson_id: string;
      seq: number;
      blob_url: string;
      content_type: string;
      duration_seconds: number | null;
      transcript: string | null;
      tone_notes: unknown;
    }[]
  >`
    select id, lesson_id, seq, blob_url, content_type,
           duration_seconds, transcript, tone_notes
    from public.lesson_segments
    where lesson_id = ${lessonId} and family_id = ${familyId}
    order by seq
  `;
  return rows.map((row) => ({
    id: row.id,
    lessonId: row.lesson_id,
    seq: row.seq,
    blobUrl: row.blob_url,
    contentType: row.content_type,
    durationSeconds: row.duration_seconds,
    transcript: row.transcript,
    toneNotes: row.tone_notes,
  }));
}

export type RegisterMediaResult =
  | { status: "registered"; mediaId: string; afterReady: boolean }
  | { status: "cap" }
  | { status: "unknown_lesson" };

/**
 * Attaches one photo to the lesson: mid-recording (stamped with the
 * segment playing when she tapped), at the finish screen, or after the
 * review exists (§4.9). Capped at MEDIA_ITEMS_PER_LESSON.
 */
export async function registerLessonMedia(input: {
  lessonId: string;
  familyId: string;
  blobUrl: string;
  contentType: string;
  capturedDuringSeq: number | null;
}): Promise<RegisterMediaResult> {
  const sql = mapDb();
  const lesson = await getLessonForFamily(input.lessonId, input.familyId);
  if (lesson === null || lesson.status === "failed") {
    return { status: "unknown_lesson" };
  }
  const afterReady = lesson.status === "ready";
  const rows = await sql<{ id: string }[]>`
    insert into public.lesson_media
      (lesson_id, family_id, blob_url, content_type,
       captured_during_seq, attached_after_ready)
    select ${input.lessonId}, ${input.familyId}, ${input.blobUrl},
           ${input.contentType}, ${input.capturedDuringSeq}, ${afterReady}
    where (
      select count(*) from public.lesson_media
      where lesson_id = ${input.lessonId}
        and family_id = ${input.familyId}
    ) < ${MEDIA_ITEMS_PER_LESSON}
    returning id
  `;
  const row = rows[0];
  if (row === undefined) return { status: "cap" };
  return { status: "registered", mediaId: row.id, afterReady };
}

export async function saveLessonMediaCaption(input: {
  mediaId: string;
  familyId: string;
  caption: string;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_media
    set caption = ${input.caption}
    where id = ${input.mediaId} and family_id = ${input.familyId}
  `;
}

export async function listLessonMedia(
  lessonId: string,
  familyId: string,
): Promise<LessonMediaRow[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      lesson_id: string;
      blob_url: string;
      content_type: string;
      caption: string | null;
      captured_during_seq: number | null;
      attached_after_ready: boolean;
      created_at: string;
    }[]
  >`
    select id, lesson_id, blob_url, content_type, caption,
           captured_during_seq, attached_after_ready, created_at::text
    from public.lesson_media
    where lesson_id = ${lessonId} and family_id = ${familyId}
    order by created_at
  `;
  return rows.map((row) => ({
    id: row.id,
    lessonId: row.lesson_id,
    blobUrl: row.blob_url,
    contentType: row.content_type,
    caption: row.caption,
    capturedDuringSeq: row.captured_during_seq,
    attachedAfterReady: row.attached_after_ready,
    createdAt: row.created_at,
  }));
}

/** Recorder taps done (or the fallback file finished uploading). */
export async function finishLessonRecording(input: {
  lessonId: string;
  familyId: string;
  durationSeconds: number | null;
}): Promise<LessonRecordingRow | null> {
  const sql = mapDb();
  const rows = await sql<LessonRecordingSqlRow[]>`
    update public.lesson_recordings
    set status = 'uploaded',
        finished_at = coalesce(finished_at, now()),
        duration_seconds = coalesce(${input.durationSeconds}, duration_seconds)
    where id = ${input.lessonId}
      and family_id = ${input.familyId}
      and status in ('recording', 'uploaded')
    returning id, family_id, child_id, created_by, status, source,
              started_at::text, finished_at::text, duration_seconds,
              attempts, audio_deleted_at::text, audio_kept_at::text, error
  `;
  return rows[0] === undefined ? null : toLessonRow(rows[0]);
}

/**
 * Claims the analysis (uploaded -> analyzing). Idempotent under
 * retries: a live claim loses, a stale one is taken over, and a lesson
 * past MAX_ANALYSIS_ATTEMPTS fails instead of spinning forever.
 */
export async function claimLessonAnalysis(
  lessonId: string,
  familyId: string,
): Promise<LessonRecordingRow | null> {
  const sql = mapDb();
  const rows = await sql<LessonRecordingSqlRow[]>`
    update public.lesson_recordings
    set status = 'analyzing', analysis_claimed_at = now(),
        attempts = attempts + 1
    where id = ${lessonId}
      and family_id = ${familyId}
      and attempts < ${MAX_ANALYSIS_ATTEMPTS}
      and (
        status = 'uploaded'
        or (
          status = 'analyzing'
          and analysis_claimed_at
            < now() - make_interval(secs => ${ANALYSIS_CLAIM_STALE_MS / 1000})
        )
      )
    returning id, family_id, child_id, created_by, status, source,
              started_at::text, finished_at::text, duration_seconds,
              attempts, audio_deleted_at::text, audio_kept_at::text, error
  `;
  return rows[0] === undefined ? null : toLessonRow(rows[0]);
}

export async function saveLessonReview(input: {
  lessonId: string;
  familyId: string;
  childId: string;
  summary: string;
  insights: unknown;
  evidenceCount: number;
  observationCount: number;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    insert into public.lesson_reviews
      (lesson_id, family_id, child_id, summary, insights,
       evidence_count, observation_count)
    values
      (${input.lessonId}, ${input.familyId}, ${input.childId},
       ${input.summary}, ${sql.json(input.insights as never)},
       ${input.evidenceCount}, ${input.observationCount})
    on conflict (lesson_id) do update
      set summary = excluded.summary,
          insights = excluded.insights,
          evidence_count = excluded.evidence_count,
          observation_count = excluded.observation_count
  `;
  await sql`
    update public.lesson_recordings
    set status = 'ready', error = null
    where id = ${input.lessonId} and family_id = ${input.familyId}
  `;
}

export async function markLessonFailed(input: {
  lessonId: string;
  familyId: string;
  error: string;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_recordings
    set status = 'failed', error = ${input.error.slice(0, 500)}
    where id = ${input.lessonId} and family_id = ${input.familyId}
  `;
}

/** Puts a stalled or failed-soft lesson back in the sweep's reach. */
export async function requeueLessonAnalysis(
  lessonId: string,
  familyId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_recordings
    set status = 'uploaded', analysis_claimed_at = null
    where id = ${lessonId}
      and family_id = ${familyId}
      and status = 'analyzing'
  `;
}

export async function getLessonReview(
  lessonId: string,
  familyId: string,
): Promise<LessonReviewRow | null> {
  const sql = mapDb();
  const rows = await sql<
    {
      lesson_id: string;
      child_id: string;
      summary: string;
      insights: unknown;
      evidence_count: number;
      observation_count: number;
      created_at: string;
    }[]
  >`
    select lesson_id, child_id, summary, insights,
           evidence_count, observation_count, created_at::text
    from public.lesson_reviews
    where lesson_id = ${lessonId} and family_id = ${familyId}
  `;
  const row = rows[0];
  if (row === undefined) return null;
  return {
    lessonId: row.lesson_id,
    childId: row.child_id,
    summary: row.summary,
    insights: row.insights,
    evidenceCount: row.evidence_count,
    observationCount: row.observation_count,
    createdAt: row.created_at,
  };
}

export async function listLessonsForChild(
  familyId: string,
  childId: string,
  limit = 20,
): Promise<LessonRecordingRow[]> {
  const sql = mapDb();
  const rows = await sql<LessonRecordingSqlRow[]>`
    select id, family_id, child_id, created_by, status, source,
           started_at::text, finished_at::text, duration_seconds,
           attempts, audio_deleted_at::text, audio_kept_at::text, error
    from public.lesson_recordings
    where family_id = ${familyId} and child_id = ${childId}
    order by created_at desc
    limit ${limit}
  `;
  return rows.map(toLessonRow);
}

/** The cron sweep's first scan: analysis work that stalled or never
 *  started (finish route died before its inline analysis completed). */
export async function listSweepableLessons(
  limit = 3,
): Promise<Array<{ id: string; familyId: string }>> {
  const sql = mapDb();
  const rows = await sql<{ id: string; family_id: string }[]>`
    select id, family_id
    from public.lesson_recordings
    where attempts < ${MAX_ANALYSIS_ATTEMPTS}
      and (
        status = 'uploaded'
        or (
          status = 'analyzing'
          and analysis_claimed_at
            < now() - make_interval(secs => ${ANALYSIS_CLAIM_STALE_MS / 1000})
        )
      )
      and finished_at is not null
    order by finished_at
    limit ${limit}
  `;
  return rows.map((row) => ({ id: row.id, familyId: row.family_id }));
}

/** Lessons that ran out of analysis attempts get honest failure state. */
export async function failExhaustedLessons(): Promise<number> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    update public.lesson_recordings
    set status = 'failed',
        error = coalesce(error, 'analysis attempts exhausted')
    where status = 'analyzing'
      and attempts >= ${MAX_ANALYSIS_ATTEMPTS}
      and analysis_claimed_at
        < now() - make_interval(secs => ${ANALYSIS_CLAIM_STALE_MS / 1000})
    returning id
  `;
  return rows.length;
}

/** The 30-day audio TTL scan (§1 item 5): lessons whose raw audio has
 *  outlived its window, with every segment blob URL to delete. */
export async function listAudioTtlLessons(
  limit = 3,
): Promise<
  Array<{ id: string; familyId: string; blobUrls: string[] }>
> {
  const sql = mapDb();
  const rows = await sql<
    { id: string; family_id: string; blob_urls: string[] | null }[]
  >`
    select lesson.id, lesson.family_id,
           array_remove(array_agg(segment.blob_url), null) as blob_urls
    from public.lesson_recordings lesson
    left join public.lesson_segments segment
      on segment.lesson_id = lesson.id
    where lesson.audio_deleted_at is null
      and lesson.audio_kept_at is null
      and lesson.finished_at is not null
      and lesson.finished_at
        < now() - make_interval(days => ${AUDIO_TTL_DAYS})
    group by lesson.id, lesson.family_id
    order by lesson.finished_at
    limit ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    familyId: row.family_id,
    blobUrls: row.blob_urls ?? [],
  }));
}

/**
 * markLessonAudioKept(...): exempts one lesson's raw audio from the
 * 30-day TTL (founder ruling `keep-their-voice`). Idempotent, and it
 * never resurrects audio the sweep or the parent already deleted: a row
 * with `audio_deleted_at` set has no bytes left to keep, so stamping it
 * would only produce a lesson that claims to hold a recording it does
 * not have.
 */
export async function markLessonAudioKept(
  lessonId: string,
  familyId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_recordings
    set audio_kept_at = now()
    where id = ${lessonId}
      and family_id = ${familyId}
      and audio_kept_at is null
      and audio_deleted_at is null
  `;
}

/** Stamped after the TTL delete; rows and transcripts stay forever. */
export async function markLessonAudioDeleted(
  lessonId: string,
  familyId: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.lesson_recordings
    set audio_deleted_at = now()
    where id = ${lessonId} and family_id = ${familyId}
  `;
}

/**
 * The consent screen's delete promise: removes the lesson row, and the
 * cascades take segments, media, and the review with it. The caller
 * deletes the blobs FIRST (this function returns the row's existence
 * so a forged id deletes nothing and reveals nothing). Progress
 * evidence is deliberately untouched: corrections own score changes.
 */
export async function deleteLessonRecording(
  lessonId: string,
  familyId: string,
): Promise<boolean> {
  const sql = mapDb();
  const rows = await sql<{ id: string }[]>`
    delete from public.lesson_recordings
    where id = ${lessonId} and family_id = ${familyId}
    returning id
  `;
  return rows.length > 0;
}
