import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import { transcribeAudio, transcribeAudioUrl } from "../voice/transcribe";
import { liveProgressEnabled } from "../child-progress/flag";
import { recordJournalProgressEvidence } from "../child-progress/runtime";
import {
  lessonClauseIdempotencyKey,
  verifyLessonClausePair,
  MAX_LESSON_CLAUSES,
  type LessonClausePair,
  type LessonSegmentText,
} from "./pairs";
import { captureJournalClaims } from "../child-progress/journal-capture";
import { lessonObservedAt } from "./observed-at";
import {
  assembleLessonTranscript,
  synthesizeLessonReview,
  type LessonInsights,
} from "./synthesis";
import {
  segmentToneNotesSchema,
  toneNotesForSegment,
  type SegmentToneNotes,
} from "./tone";
import {
  claimLessonAnalysis,
  claimSegmentWork,
  listAudioTtlLessons,
  listLessonMedia,
  listLessonSegments,
  listSweepableLessons,
  failExhaustedLessons,
  markLessonAudioDeleted,
  markLessonFailed,
  registerLessonSegment,
  releaseSegmentClaim,
  requeueLessonAnalysis,
  markLessonAudioKept,
  saveLessonReview,
  saveSegmentToneNotes,
  saveSegmentTranscript,
  MAX_ANALYSIS_ATTEMPTS,
  type LessonRecordingRow,
  type LessonSegmentRow,
} from "./store";
import { deleteLessonBlob } from "./blobs";
import { lessonAudioKeep } from "./keep-audio";

/**
 * The lesson pipeline's working half (plan 2026-07-13-lesson-listen.md
 * §4.4). No new async primitive anywhere: routes call these functions
 * inline (the recorder never awaits the slow parts), and the hourly
 * cron sweep is the only retry mechanism, riding the claim columns in
 * lib/lessons/store.ts exactly like lib/learning/call-memory.ts.
 */

/** One child speaks per lesson (§7 Q2); one uploaded fallback file
 *  rides as segment 1. */
export const FALLBACK_SEGMENT_SEQ = 1;

function parseToneNotes(value: unknown): SegmentToneNotes | null {
  if (value === null || value === undefined) return null;
  const parsed = segmentToneNotesSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * processLessonSegment(segmentId, familyId): both ears for one segment
 * (transcribe, then tone notes), claim-guarded so a retried register
 * call or a concurrent sweep cannot double-pay. Fail-soft: a tone
 * failure leaves the transcript standing; a transcript failure
 * releases the claim so the sweep retries.
 */
export async function processLessonSegment(
  segmentId: string,
  familyId: string,
): Promise<void> {
  const segment = await claimSegmentWork(segmentId, familyId);
  if (segment === null) return;

  let transcript = segment.transcript;
  if (transcript === null) {
    transcript = await transcribeSegment(segment);
    if (transcript === null) {
      await releaseSegmentClaim(segmentId, familyId);
      return;
    }
    await saveSegmentTranscript({
      segmentId,
      familyId,
      transcript,
    });
  }

  if (parseToneNotes(segment.toneNotes) === null) {
    const toneNotes = await toneNotesForSegment({
      audioUrl: segment.blobUrl,
      mediaType: segment.contentType,
      familyId,
    });
    if (toneNotes !== null) {
      await saveSegmentToneNotes({ segmentId, familyId, toneNotes });
    }
  }
}

/** The recorder's 3-minute segments come as bytes-sized files; the
 *  fallback's single long file rides Telnyx's file_url lane instead so
 *  30 to 60MB never passes through this function (§4.2). */
async function transcribeSegment(
  segment: LessonSegmentRow,
): Promise<string | null> {
  if (segment.seq === FALLBACK_SEGMENT_SEQ && isLikelyLongFile(segment)) {
    return transcribeAudioUrl(segment.blobUrl);
  }
  try {
    const response = await fetch(segment.blobUrl);
    if (!response.ok) return null;
    const bytes = await response.arrayBuffer();
    return transcribeAudio(bytes, segment.contentType);
  } catch (error) {
    console.error(
      "lesson segment fetch failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/** A recorder segment runs ~3 minutes; anything reporting longer came
 *  through the fallback upload page. */
function isLikelyLongFile(segment: LessonSegmentRow): boolean {
  return (
    segment.durationSeconds !== null && segment.durationSeconds > 10 * 60
  );
}

export interface LessonAnalysisOutcome {
  status: "ready" | "requeued" | "failed" | "not_claimable";
}

/**
 * runLessonAnalysis(lessonId, familyId): the finish pass. Claims the
 * lesson, sweeps straggler segments through both ears, assembles the
 * transcript, runs the synthesis, verifies every clause pair against
 * the transcript, fans verified pairs through the journal path (source
 * lesson_listen), and writes the review. Any throw requeues for the
 * sweep until attempts run out, then fails with honest state.
 */
export async function runLessonAnalysis(
  lessonId: string,
  familyId: string,
): Promise<LessonAnalysisOutcome> {
  const lesson = await claimLessonAnalysis(lessonId, familyId);
  if (lesson === null) return { status: "not_claimable" };

  try {
    const segments = await listLessonSegments(lessonId, familyId);
    for (const segment of segments) {
      if (
        segment.transcript === null ||
        parseToneNotes(segment.toneNotes) === null
      ) {
        await processLessonSegment(segment.id, familyId);
      }
    }
    const processed = await listLessonSegments(lessonId, familyId);
    const synthesisSegments = processed.map((segment) => ({
      seq: segment.seq,
      transcript: segment.transcript,
      toneNotes: parseToneNotes(segment.toneNotes),
    }));
    const transcript = assembleLessonTranscript(synthesisSegments);
    if (transcript.trim().length === 0) {
      await markLessonFailed({
        lessonId,
        familyId,
        error: "no speech transcribed",
      });
      await emitMapEvent("lesson.failed", {
        family_id: familyId,
        child_id: lesson.childId,
        stage: "transcription",
      });
      return { status: "failed" };
    }

    const childName = await lessonChildName(lesson);
    const media = await listLessonMedia(lessonId, familyId);
    const insights = await synthesizeLessonReview({
      familyId,
      childName,
      segments: synthesisSegments,
      mediaCaptions: media.flatMap((item) =>
        item.caption === null
          ? []
          : [{
              caption: item.caption,
              capturedDuringSeq: item.capturedDuringSeq,
            }],
      ),
    });

    const ledger = await recordVerifiedClauses({
      lesson,
      childName,
      segments: processed.map((segment) => ({
        seq: segment.seq,
        transcript: segment.transcript,
      })),
      pairs: insights.clausePairs,
    });

    await saveLessonReview({
      lessonId,
      familyId,
      childId: lesson.childId,
      summary: insights.summary,
      insights: storedInsights(insights, ledger.notes),
      evidenceCount: ledger.evidenceCount,
      observationCount: ledger.observationCount,
    });
    // Keep their voice (founder ruling 2026-07-22). The model already
    // made the only judgment when it labelled a moment; this reads that
    // typed enum and exempts the recording from the 30-day TTL. The
    // parent is told on the review page, and deletes it in one tap.
    const keep = lessonAudioKeep(insights.moments, processed.length);
    if (keep !== null) {
      await markLessonAudioKept(lessonId, familyId);
    }
    const toneCovered = processed.filter(
      (segment) => parseToneNotes(segment.toneNotes) !== null,
    ).length;
    // rejected_count makes gate loss visible: pairs existed but the
    // trust gate turned every one away (the 2026-07-21 silent-failure
    // class, where a healthy review shipped and the ledger gained
    // nothing with no error anywhere).
    await emitMapEvent("lesson.review_ready", {
      family_id: familyId,
      child_id: lesson.childId,
      evidence_count: ledger.evidenceCount,
      observation_count: ledger.observationCount,
      rejected_count: ledger.rejectedCount,
      moment_count: insights.moments.length,
      tone_coverage:
        processed.length === 0 ? 0 : toneCovered / processed.length,
      audio_kept: keep !== null,
      audio_kept_kind: keep?.kind ?? null,
    });
    return { status: "ready" };
  } catch (error) {
    console.error(
      "lesson analysis failed:",
      error instanceof Error ? error.message : "unknown",
    );
    if (lesson.attempts >= MAX_ANALYSIS_ATTEMPTS) {
      await markLessonFailed({
        lessonId,
        familyId,
        error: error instanceof Error ? error.message : "analysis failed",
      });
      await emitMapEvent("lesson.failed", {
        family_id: familyId,
        child_id: lesson.childId,
        stage: "synthesis",
      });
      return { status: "failed" };
    }
    await requeueLessonAnalysis(lessonId, familyId);
    return { status: "requeued" };
  }
}

async function lessonChildName(
  lesson: LessonRecordingRow,
): Promise<string> {
  const sql = mapDb();
  const rows = await sql<{ name: string }[]>`
    select name from public.children
    where id = ${lesson.childId} and family_id = ${lesson.familyId}
  `;
  return rows[0]?.name ?? "the child";
}

export interface LessonProgressNote {
  clause: string;
  excerpt: string;
  segmentSeq: number;
  outcome:
    | "evidence"
    | "observation"
    | "conflict"
    | "rejected"
    | "skipped_flag_off";
}

interface LedgerFanOutResult {
  evidenceCount: number;
  observationCount: number;
  rejectedCount: number;
  notes: LessonProgressNote[];
}


/**
 * The trust boundary in motion (§4.5): verify each pair, then ride the
 * SAME journal path chat uses, from runtime.ts so the MJ-08 events
 * fire. The sha256 clause key makes retried passes replay instead of
 * double-writing. Tone never reaches this function.
 */
async function recordVerifiedClauses(input: {
  lesson: LessonRecordingRow;
  childName: string;
  segments: readonly LessonSegmentText[];
  pairs: LessonClausePair[];
}): Promise<LedgerFanOutResult> {
  const notes: LessonProgressNote[] = [];
  let rejectedCount = 0;
  const flagOn = liveProgressEnabled();
  const observedAt = lessonObservedAt(input.lesson.finishedAt);

  // Pass one: provenance. Every clause is checked against the segment it
  // claims before anything is judged.
  const verified: LessonClausePair[] = [];
  for (const pair of input.pairs.slice(0, MAX_LESSON_CLAUSES)) {
    const verdict = verifyLessonClausePair(
      pair,
      input.segments,
      input.childName,
    );
    if (!verdict.ok) {
      rejectedCount += 1;
      notes.push({ ...pair, outcome: "rejected" });
      continue;
    }
    if (!flagOn) {
      notes.push({ ...pair, outcome: "skipped_flag_off" });
      continue;
    }
    verified.push(pair);
  }
  if (verified.length === 0) {
    return { evidenceCount: 0, observationCount: 0, rejectedCount, notes };
  }

  // Pass two: judgment, ONCE for the whole lesson rather than once per
  // clause. A lesson is one sitting with one child, and the clauses
  // describe the same few skills from different moments of it. Judging
  // clause by clause meant nothing could reconcile them: a real lesson
  // on 2026-07-22 wrote math.one-to-one-counting twice with opposite
  // answers, because "counted the coins out of order" and "counted two
  // yellow boxes correctly" were separate calls that never met. Judging
  // the lesson as a whole lets the deterministic gate's own dedupe
  // (strongest answer per child and skill) do its job, and costs one
  // model call instead of one per clause.
  const message = verified.map((pair) => pair.clause).join(" ");
  const capture = await captureJournalClaims({
    familyId: input.lesson.familyId,
    childId: input.lesson.childId,
    message,
    surface: "lesson",
  });
  const claims = capture.claims?.filter(
    (claim) => claim.childId === input.lesson.childId,
  );

  const result = await recordJournalProgressEvidence({
    familyId: input.lesson.familyId,
    childId: input.lesson.childId,
    memberUserId: input.lesson.createdBy,
    quote: message,
    ...(claims ? { claims } : {}),
    channel: "lesson",
    messageId: null,
    observedAt,
    // Keyed on the lesson, not on a clause: one lesson is one operation,
    // so a re-analysis replays instead of stacking a second opinion.
    idempotencyKey: lessonClauseIdempotencyKey(input.lesson.id, message),
    source: "lesson_listen",
  });
  const status =
    result.status === "duplicate" ? result.original.status : result.status;

  // The parent-facing list still reads clause by clause, so map each
  // accepted claim back to the clause its quote came from.
  const scoredClauses = new Set<string>();
  for (const claim of claims ?? []) {
    const origin = verified.find((pair) =>
      pair.clause.toLocaleLowerCase("en-US").includes(
        claim.quote.toLocaleLowerCase("en-US"),
      ),
    );
    if (origin) scoredClauses.add(origin.clause);
  }
  const wrote = status === "recorded" || status === "conflict_open";
  for (const pair of verified) {
    notes.push({
      ...pair,
      outcome: wrote && scoredClauses.has(pair.clause)
        ? status === "conflict_open"
          ? "conflict"
          : "evidence"
        : "observation",
    });
  }

  const evidenceCount = wrote
    ? notes.filter(
        (note) => note.outcome === "evidence" || note.outcome === "conflict",
      ).length
    : 0;
  return {
    evidenceCount,
    observationCount: notes.filter((note) => note.outcome === "observation")
      .length,
    rejectedCount,
    notes,
  };
}

/** The review row keeps the verified pairs and their outcomes so the
 *  page can show "what this lesson wrote to progress" with excerpts
 *  (plan §4.5), and drops the raw model pairs. */
function storedInsights(
  insights: LessonInsights,
  notes: LessonProgressNote[],
): Record<string, unknown> {
  return {
    summary: insights.summary,
    moments: insights.moments,
    whatWorked: insights.whatWorked,
    friction: insights.friction,
    nextTime: insights.nextTime,
    openQuestions: insights.openQuestions,
    siblingNote: insights.siblingNote,
    progressNotes: notes,
  };
}

export interface LessonSweepResult {
  analysesRun: number;
  lessonsFailed: number;
  audioDeleted: number;
}

/**
 * sweepLessons(): the hourly cron's lesson job (§4.4 step 4). Re-kicks
 * stalled analyses (bounded by attempts), fails the exhausted, and
 * enforces the 30-day raw-audio TTL: segment blobs delete, rows and
 * transcripts stay.
 */
export async function sweepLessons(): Promise<LessonSweepResult> {
  let analysesRun = 0;
  for (const candidate of await listSweepableLessons()) {
    const outcome = await runLessonAnalysis(
      candidate.id,
      candidate.familyId,
    );
    if (outcome.status !== "not_claimable") analysesRun += 1;
  }
  const lessonsFailed = await failExhaustedLessons();

  let audioDeleted = 0;
  for (const lesson of await listAudioTtlLessons()) {
    for (const blobUrl of lesson.blobUrls) {
      await deleteLessonBlob(blobUrl, lesson.familyId);
    }
    await markLessonAudioDeleted(lesson.id, lesson.familyId);
    audioDeleted += 1;
  }
  return { analysesRun, lessonsFailed, audioDeleted };
}

/**
 * registerFallbackUpload(...): the "already recorded it?" lane. The
 * whole file rides as segment 1 and the same finish path takes over.
 */
export async function registerFallbackUpload(input: {
  lessonId: string;
  familyId: string;
  blobUrl: string;
  contentType: string;
  durationSeconds: number | null;
}): Promise<"registered" | "not_open"> {
  const result = await registerLessonSegment({
    lessonId: input.lessonId,
    familyId: input.familyId,
    seq: FALLBACK_SEGMENT_SEQ,
    blobUrl: input.blobUrl,
    contentType: input.contentType,
    durationSeconds: input.durationSeconds ?? 11 * 60,
  });
  return result.status === "not_open" ? "not_open" : "registered";
}
