import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getPaidAppShellData } from "../../../../lib/app-data";
import { lessonListenEnabled } from "../../../../lib/lessons/flag";
import {
  getLessonForFamily,
  getLessonReview,
  listLessonMedia,
  listLessonSegments,
  MAX_ANALYSIS_ATTEMPTS,
} from "../../../../lib/lessons/store";
import {
  hasUsableLessonTranscript,
  lessonAnalysisRetryState,
  type LessonAnalysisRetryState,
} from "../../../../lib/lessons/retry-state";
import { lessonMomentSchema } from "../../../../lib/lessons/synthesis";
import { PageColumn } from "../../../../components/dashboard/page-column";
import { Icon } from "../../../../components/design/Icon";
import { QuietAction } from "../../../../components/design/QuietAction";
import {
  AddLessonPhotos,
  KeptAudioNotice,
  LessonStatusPoll,
  RetryLessonAnalysis,
} from "./review-client";

/**
 * /app/lessons/[lessonId]: the lesson review (plan
 * 2026-07-13-lesson-listen.md §4.6). Summary up top, tone-grounded
 * moments with their worksheet photos, offers for next time, what the
 * lesson wrote to progress (with the verbatim excerpts), the photo
 * gallery, and the transcript behind a disclosure. While the pipeline
 * runs, the page shows honest progress and polls; a terminal failure
 * keeps the recording safe and says so.
 */

export const metadata: Metadata = {
  title: "Lesson review",
  robots: { index: false },
};

const storedProgressNoteSchema = z.object({
  clause: z.string(),
  excerpt: z.string(),
  segmentSeq: z.number().int(),
  outcome: z.enum([
    "evidence",
    "observation",
    "conflict",
    "rejected",
    "skipped_flag_off",
  ]),
});

const storedInsightsSchema = z
  .object({
    moments: z.array(lessonMomentSchema).catch([]),
    whatWorked: z.array(z.string()).catch([]),
    friction: z.array(z.string()).catch([]),
    nextTime: z.array(z.string()).catch([]),
    openQuestions: z.array(z.string()).catch([]),
    siblingNote: z.string().nullable().catch(null),
    progressNotes: z.array(storedProgressNoteSchema).catch([]),
  })
  .loose();

const MOMENT_LABELS: Record<string, string> = {
  excited: "Lit up",
  engaged: "Focused",
  distracted: "Drifted",
  frustrated: "Frustrated",
  breakthrough: "Breakthrough",
  sweet: "Sweet moment",
};

function aboutMinute(segmentSeq: number): string {
  const minute = (segmentSeq - 1) * 3;
  return minute === 0 ? "right at the start" : `about ${minute} minutes in`;
}

function failedLessonDetail(
  state: LessonAnalysisRetryState,
  audioDeletedAt: string | null,
): string {
  if (state.status === "exhausted") {
    return "Homa tried every safe pass without getting a review she could trust. The lesson is still saved, but she will not pretend the review is ready.";
  }
  if (state.status === "source_unavailable") {
    return "The raw audio has already been deleted, and there is not enough transcript left to build a trustworthy review.";
  }
  if (audioDeletedAt !== null) {
    return "The raw audio has already been deleted, but Homa still has enough transcript to try the review again.";
  }
  return "This was not anything you did. The lesson is saved, and Homa can listen again from where she stopped.";
}

export default async function LessonReviewPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  if (!lessonListenEnabled()) notFound();
  const { lessonId } = await params;
  const data = await getPaidAppShellData();
  if (!data) redirect("/onboarding");
  const { family, children } = data;

  const lesson = await getLessonForFamily(lessonId, family.id);
  if (!lesson) notFound();
  const childName =
    children.find((child) => child.id === lesson.childId)?.name ??
    "your child";

  const startedAt = new Date(lesson.startedAt).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (lesson.status !== "ready") {
    const segments = await listLessonSegments(lessonId, family.id);
    const transcribed = segments.filter(
      (segment) => segment.transcript !== null,
    ).length;
    const retryState = lessonAnalysisRetryState({
      status: lesson.status,
      attempts: lesson.attempts,
      maxAttempts: MAX_ANALYSIS_ATTEMPTS,
      audioDeletedAt: lesson.audioDeletedAt,
      hasUsableTranscript: hasUsableLessonTranscript(
        segments.map((segment) => segment.transcript),
      ),
    });
    return (
      <PageColumn>
        <div data-brand-surface="lesson-review" data-brand-fixture="quiet-authority-v1">
        <BackToKid childId={lesson.childId} childName={childName} />
        <h1 className="mt-2 font-display text-2xl font-semibold text-[color:var(--homa-ink)]">
          {childName}&apos;s lesson from {startedAt}
        </h1>
        {lesson.status === "failed" ? (
          <section className="quiet-frame quiet-frame--paper mt-4 p-6">
            <p className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">
              Homa couldn&apos;t finish this one.
            </p>
            <p className="mt-1 text-sm text-[color:var(--homa-ink)]">
              {failedLessonDetail(retryState, lesson.audioDeletedAt)}
            </p>
            {retryState.status === "available" ? (
              <RetryLessonAnalysis lessonId={lessonId} />
            ) : null}
          </section>
        ) : (
          <section className="quiet-frame quiet-frame--paper mt-4 p-6">
            <p className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">
              Homa is listening back through the lesson.
            </p>
            <LessonStatusPoll
              lessonId={lessonId}
              initialTranscribed={transcribed}
              initialTotal={segments.length}
            />
            <p className="mt-2 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
              This page updates by itself. Leaving is fine. The review
              will be here when you come back.
            </p>
          </section>
        )}
        </div>
      </PageColumn>
    );
  }

  const [review, media, segments] = await Promise.all([
    getLessonReview(lessonId, family.id),
    listLessonMedia(lessonId, family.id),
    listLessonSegments(lessonId, family.id),
  ]);
  if (!review) notFound();
  const insights = storedInsightsSchema.parse(review.insights ?? {});
  const ledgerNotes = insights.progressNotes.filter(
    (note) => note.outcome === "evidence" || note.outcome === "conflict",
  );
  const observationNotes = insights.progressNotes.filter(
    (note) => note.outcome === "observation",
  );
  const rejectedNotes = insights.progressNotes.filter(
    (note) => note.outcome === "rejected",
  );
  const mediaBySeq = new Map(
    media
      .filter((item) => item.capturedDuringSeq !== null)
      .map((item) => [item.capturedDuringSeq as number, item]),
  );

  return (
    <PageColumn>
      <div data-brand-surface="lesson-review" data-brand-fixture="quiet-authority-v1">
      <BackToKid childId={lesson.childId} childName={childName} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-[color:var(--homa-ink)]">
        {childName}&apos;s lesson from {startedAt}
      </h1>
      {lesson.durationSeconds ? (
        <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
          {Math.max(1, Math.round(lesson.durationSeconds / 60))} minutes
          together
        </p>
      ) : null}

      <section
        aria-label="How it went"
        className="quiet-status quiet-status--constructive mt-4 p-5"
      >
        <p className="text-[color:var(--homa-constructive-ink)]">{review.summary}</p>
        {insights.siblingNote ? (
          <p className="mt-2 text-sm text-[color:var(--homa-constructive-ink)]">{insights.siblingNote}</p>
        ) : null}
      </section>

      {/* Homa kept this recording without being asked, so she is told.
          An automatic retention nobody mentions is not what the
          keep-their-voice ruling authorized, and the undo sits inside
          the same box as the news rather than in a settings page. */}
      {lesson.audioKeptAt !== null && lesson.audioDeletedAt === null ? (
        <KeptAudioNotice
          lessonId={lessonId}
          childName={childName}
          day={startedAt}
        />
      ) : null}

      {insights.moments.length > 0 ? (
        <section aria-label="Moments" className="mt-4">
          <h2 className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">
            Moments from the lesson
          </h2>
          <ol className="mt-2 space-y-2">
            {insights.moments.map((moment, index) => {
              const photo = mediaBySeq.get(moment.segmentSeq);
              return (
                <li
                  key={`${moment.segmentSeq}-${index}`}
                  className="quiet-frame quiet-frame--paper p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                    {MOMENT_LABELS[moment.kind] ?? moment.kind} {"\u00b7"}{" "}
                    {aboutMinute(moment.segmentSeq)}
                  </p>
                  <p className="mt-1 font-medium text-[color:var(--homa-ink)]">
                    {moment.headline}
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--homa-ink)]">{moment.detail}</p>
                  {photo ? (
                    // Family blob URL; nothing here for next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.blobUrl}
                      alt={photo.caption ?? "A photo from this lesson"}
                      className="mt-3 max-h-56 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] object-contain"
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {insights.whatWorked.length > 0 ? (
          <section className="quiet-frame quiet-frame--paper p-5">
            <h2 className="font-display text-base font-semibold text-[color:var(--homa-ink)]">
              What worked
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--homa-ink)]">
              {insights.whatWorked.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="text-[color:var(--homa-constructive-ink)]">
                    {"\u2022"}
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {insights.friction.length > 0 ? (
          <section className="quiet-frame quiet-frame--paper p-5">
            <h2 className="font-display text-base font-semibold text-[color:var(--homa-ink)]">
              Where it dragged
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--homa-ink)]">
              {insights.friction.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                    {"\u2022"}
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {insights.nextTime.length > 0 ? (
        <section className="quiet-frame quiet-frame--paper mt-4 p-5">
          <h2 className="font-display text-base font-semibold text-[color:var(--homa-ink)]">
            Ideas for next time
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--homa-ink)]">
            {insights.nextTime.map((line) => (
              <li key={line} className="flex gap-2">
              <span aria-hidden="true" className="text-[color:var(--homa-visual-coral)]">
                  {"\u2022"}
                </span>
                {line}
              </li>
            ))}
          </ul>
          {insights.openQuestions.length > 0 ? (
            <p className="mt-3 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
              Homa wasn&apos;t sure about: {insights.openQuestions.join(" ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {ledgerNotes.length === 0 &&
      observationNotes.length === 0 &&
      rejectedNotes.length > 0 ? (
        // The honest line for the all-rejected case (2026-07-21): a
        // review without it reads as if the lesson updated progress
        // when nothing was written anywhere.
        <section className="quiet-frame quiet-frame--paper mt-4 p-5">
          <p className="text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            Your lesson and this review are saved. Homa heard skill
            moments but could not tie them to the recording clearly
            enough to update {childName}&apos;s progress this time.
          </p>
        </section>
      ) : null}

      {(ledgerNotes.length > 0 || observationNotes.length > 0) ? (
        <section className="quiet-frame quiet-frame--paper mt-4 p-5">
          <h2 className="font-display text-base font-semibold text-[color:var(--homa-ink)]">
            What this lesson added to {childName}&apos;s progress
          </h2>
          {ledgerNotes.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {ledgerNotes.map((note) => (
                <li key={note.clause}>
                  <p className="text-[color:var(--homa-ink)]">{note.clause}</p>
                  <p className="mt-0.5 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                    From the lesson, {aboutMinute(note.segmentSeq)}:{" "}
                    {"\u201c"}
                    {note.excerpt}
                    {"\u201d"}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
          {observationNotes.length > 0 ? (
            <p className="mt-3 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
              Homa also saved {observationNotes.length} smaller{" "}
              {observationNotes.length === 1 ? "moment" : "moments"} to{" "}
              {childName}&apos;s progress, ready to build on this week.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            Something look off? Tell Homa in chat and she&apos;ll fix it.
          </p>
        </section>
      ) : null}

      <section className="mt-4">
        <h2 className="font-display text-base font-semibold text-[color:var(--homa-ink)]">
          Photos from this lesson
        </h2>
        {media.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-3">
            {media.map((item) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.id}
                src={item.blobUrl}
                alt={item.caption ?? "A photo from this lesson"}
                className="h-28 w-28 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            Add worksheet photos or anything else you want kept with this
            lesson.
          </p>
        )}
        <AddLessonPhotos familyId={family.id} lessonId={lessonId} />
      </section>

      <details className="quiet-frame quiet-frame--paper mt-6 p-5">
        <summary className="cursor-pointer text-sm font-medium text-[color:var(--homa-ink)]">
          Read the whole transcript
        </summary>
        <div className="mt-3 space-y-4">
          {segments
            .filter((segment) => segment.transcript !== null)
            .map((segment) => (
              <div key={segment.id}>
                <p className="text-xs font-medium uppercase tracking-wide text-[color:color-mix(in_srgb,var(--homa-ink)_52%,var(--homa-canvas))]">
                  {aboutMinute(segment.seq)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[color:var(--homa-ink)]">
                  {segment.transcript}
                </p>
              </div>
            ))}
        </div>
      </details>
      </div>
    </PageColumn>
  );
}

/** Back to where the recording door now lives: Progress, not the
 *  retired kid card. */
function BackToKid({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  return (
    <QuietAction
      href={`/app/${childId}/progress`}
      kind="quiet"
      size="default"
      icon={<Icon name="back" size={16} />}
      className="min-h-10 px-0 text-sm"
    >
      Back to {childName}&apos;s progress
    </QuietAction>
  );
}
