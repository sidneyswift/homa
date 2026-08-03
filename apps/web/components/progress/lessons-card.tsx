import Link from "next/link";

import { QuietAction } from "../design/QuietAction";

/**
 * The lesson-listen door and the reviews it has produced (plan
 * 2026-07-13-lesson-listen.md §4.6). It lived on the kid card until
 * that surface retired; Progress owns the per-child page now, so the
 * recording door moved here with its copy intact. Both copy gates
 * passed on that wording, so it moved verbatim.
 *
 * The card renders only when the caller hands it data: the page passes
 * null while lesson listening is disabled, and read-only mirrors
 * (the founder console) never pass it at all.
 */

export interface ProgressLessonEntry {
  id: string;
  status: string;
  startedAt: string;
}

export interface ProgressLessonsCardData {
  recordHref: string;
  lessons: ProgressLessonEntry[];
}

/** Honest status in the parent's words: never a pipeline stage name. */
function statusLabel(status: string): string {
  if (status === "ready") return "Review ready";
  if (status === "failed") return "Homa couldn't finish";
  return "Review on the way";
}

export function LessonsCard({ card }: { card: ProgressLessonsCardData }) {
  return (
    <section
      aria-label="Lessons"
      data-brand-surface="lessons-card"
      data-brand-fixture="quiet-authority-v1"
      className="quiet-frame quiet-frame--paper mt-6 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-[color:var(--homa-ink)]">
            Lessons
          </p>
          <p className="mt-0.5 text-sm text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
            Teach like always. Homa listens, then writes a review: how it
            went and ideas for next time.
          </p>
        </div>
        <QuietAction href={card.recordHref} kind="primary" size="default" className="px-5 text-sm">
          Record a lesson
        </QuietAction>
      </div>
      {card.lessons.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {card.lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/app/lessons/${lesson.id}`}
                className="flex items-center justify-between gap-3 rounded-[var(--homa-radius-control)] border border-[var(--homa-control-boundary)] bg-[var(--homa-canvas)] px-3 py-2 text-sm transition-colors hover:border-[var(--homa-midnight-action)]"
              >
                <span className="text-[color:var(--homa-ink)]">
                  Lesson from{" "}
                  {new Date(lesson.startedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="text-xs font-medium text-[color:color-mix(in_srgb,var(--homa-ink)_66%,var(--homa-canvas))]">
                  {statusLabel(lesson.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
