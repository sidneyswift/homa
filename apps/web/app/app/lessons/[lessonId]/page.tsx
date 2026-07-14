import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { getMyChildren, getMyFamily } from "../../../../lib/family";
import { lessonListenEnabled } from "../../../../lib/lessons/flag";
import {
  getLessonForFamily,
  getLessonReview,
  listLessonMedia,
  listLessonSegments,
} from "../../../../lib/lessons/store";
import { lessonMomentSchema } from "../../../../lib/lessons/synthesis";
import { PageColumn } from "../../../../components/dashboard/page-column";
import {
  AddLessonPhotos,
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
    whatWorked: z.array(
      z.union([
        z.string(),
        z.object({ description: z.string(), modality: z.string().nullable().optional() }),
      ]),
    ).catch([]),
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

export default async function LessonReviewPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  if (!lessonListenEnabled()) notFound();
  const { lessonId } = await params;
  const family = await getMyFamily();
  if (!family) redirect("/onboarding");

  const lesson = await getLessonForFamily(lessonId, family.id);
  if (!lesson) notFound();
  const children = await getMyChildren(family.id);
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
    return (
      <PageColumn>
        <BackToKid childId={lesson.childId} childName={childName} />
        <h1 className="mt-2 font-display text-2xl font-semibold text-strong">
          {childName}&apos;s lesson from {startedAt}
        </h1>
        {lesson.status === "failed" ? (
          <section className="mt-4 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
            <p className="font-display text-lg font-semibold text-strong">
              Homa couldn&apos;t finish this one.
            </p>
            <p className="mt-1 text-sm text-body">
              This was not anything you did. The recording is safe and
              nothing was lost. Homa can listen again from where she
              stopped.
            </p>
            <RetryLessonAnalysis lessonId={lessonId} />
          </section>
        ) : (
          <section className="mt-4 rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
            <p className="font-display text-lg font-semibold text-strong">
              Homa is listening back through the lesson.
            </p>
            <LessonStatusPoll
              lessonId={lessonId}
              initialTranscribed={transcribed}
              initialTotal={segments.length}
            />
            <p className="mt-2 text-xs text-muted">
              This page updates by itself. Leaving is fine. The review
              will be here when you come back.
            </p>
          </section>
        )}
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
  const mediaBySeq = new Map(
    media
      .filter((item) => item.capturedDuringSeq !== null)
      .map((item) => [item.capturedDuringSeq as number, item]),
  );

  return (
    <PageColumn>
      <BackToKid childId={lesson.childId} childName={childName} />
      <h1 className="mt-2 font-display text-2xl font-semibold text-strong">
        {childName}&apos;s lesson from {startedAt}
      </h1>
      {lesson.durationSeconds ? (
        <p className="mt-1 text-sm text-muted">
          {Math.max(1, Math.round(lesson.durationSeconds / 60))} minutes
          together
        </p>
      ) : null}

      <section
        aria-label="How it went"
        className="mt-4 rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-5"
      >
        <p className="text-body">{review.summary}</p>
        {insights.siblingNote ? (
          <p className="mt-2 text-sm text-muted">{insights.siblingNote}</p>
        ) : null}
      </section>

      {insights.moments.length > 0 ? (
        <section aria-label="Moments" className="mt-4">
          <h2 className="font-display text-lg font-semibold text-strong">
            Moments from the lesson
          </h2>
          <ol className="mt-2 space-y-2">
            {insights.moments.map((moment, index) => {
              const photo = mediaBySeq.get(moment.segmentSeq);
              return (
                <li
                  key={`${moment.segmentSeq}-${index}`}
                  className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    {MOMENT_LABELS[moment.kind] ?? moment.kind} {"\u00b7"}{" "}
                    {aboutMinute(moment.segmentSeq)}
                  </p>
                  <p className="mt-1 font-medium text-strong">
                    {moment.headline}
                  </p>
                  <p className="mt-1 text-sm text-body">{moment.detail}</p>
                  {photo ? (
                    // Family blob URL; nothing here for next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.blobUrl}
                      alt={photo.caption ?? "A photo from this lesson"}
                      className="mt-3 max-h-56 rounded-md border border-border-subtle object-contain"
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
          <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-strong">
              What worked
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-body">
              {insights.whatWorked.map((entry) => {
                const text = typeof entry === "string" ? entry : entry.description;
                return (
                <li key={text} className="flex gap-2">
                  <span aria-hidden="true" className="text-sage-700">
                    {"\u2022"}
                  </span>
                  {text}
                </li>
              );
              })}
            </ul>
          </section>
        ) : null}
        {insights.friction.length > 0 ? (
          <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-semibold text-strong">
              Where it dragged
            </h2>
            <ul className="mt-2 space-y-1.5 text-sm text-body">
              {insights.friction.map((line) => (
                <li key={line} className="flex gap-2">
                  <span aria-hidden="true" className="text-muted">
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
        <section className="mt-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-strong">
            Ideas for next time
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-body">
            {insights.nextTime.map((line) => (
              <li key={line} className="flex gap-2">
                <span aria-hidden="true" className="text-brand">
                  {"\u2022"}
                </span>
                {line}
              </li>
            ))}
          </ul>
          {insights.openQuestions.length > 0 ? (
            <p className="mt-3 text-xs text-muted">
              Homa wasn&apos;t sure about: {insights.openQuestions.join(" ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {(ledgerNotes.length > 0 || observationNotes.length > 0) ? (
        <section className="mt-4 rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-strong">
            What this lesson added to {childName}&apos;s progress
          </h2>
          {ledgerNotes.length > 0 ? (
            <ul className="mt-2 space-y-2 text-sm">
              {ledgerNotes.map((note) => (
                <li key={note.clause}>
                  <p className="text-body">{note.clause}</p>
                  <p className="mt-0.5 text-xs text-muted">
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
            <p className="mt-3 text-xs text-muted">
              Homa also saved {observationNotes.length} smaller{" "}
              {observationNotes.length === 1 ? "moment" : "moments"} to{" "}
              {childName}&apos;s progress, ready to build on this week.
            </p>
          ) : null}
          <p className="mt-3 text-xs text-muted">
            Something look off? Tell Homa in chat and she&apos;ll fix it.
          </p>
        </section>
      ) : null}

      <section className="mt-4">
        <h2 className="font-display text-base font-semibold text-strong">
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
                className="h-28 w-28 rounded-md border border-border-subtle object-cover"
              />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">
            Add worksheet photos or anything else you want kept with this
            lesson.
          </p>
        )}
        <AddLessonPhotos familyId={family.id} lessonId={lessonId} />
      </section>

      <details className="mt-6 rounded-lg border border-border-subtle bg-card p-5">
        <summary className="cursor-pointer text-sm font-medium text-body">
          Read the whole transcript
        </summary>
        <div className="mt-3 space-y-4">
          {segments
            .filter((segment) => segment.transcript !== null)
            .map((segment) => (
              <div key={segment.id}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  {aboutMinute(segment.seq)}
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-body">
                  {segment.transcript}
                </p>
              </div>
            ))}
        </div>
      </details>
    </PageColumn>
  );
}

function BackToKid({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  return (
    <Link
      href={`/app/kids/${childId}`}
      className="text-sm font-medium text-muted transition-colors hover:text-strong"
    >
      {"\u2190"} Back to {childName}&apos;s page
    </Link>
  );
}
