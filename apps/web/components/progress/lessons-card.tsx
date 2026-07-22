import Link from "next/link";

/**
 * The lesson-listen door and the reviews it has produced (plan
 * 2026-07-13-lesson-listen.md §4.6). It lived on the kid card until
 * that surface retired; Progress owns the per-child page now, so the
 * recording door moved here with its copy intact. Both copy gates
 * passed on that wording, so it moved verbatim.
 *
 * The card renders only when the caller hands it data: the page passes
 * null while HOMA_LESSON_LISTEN_ENABLED is off, and read-only mirrors
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
      className="mt-6 rounded-lg border border-border-subtle bg-card p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold text-strong">
            Lessons
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Teach like always. Homa listens, then writes a review: how it
            went and ideas for next time.
          </p>
        </div>
        <Link
          href={card.recordHref}
          className="inline-flex min-h-10 items-center rounded-pill bg-brand px-5 py-2 text-sm font-semibold text-on-brand transition-colors hover:bg-brand-hover"
        >
          Record a lesson
        </Link>
      </div>
      {card.lessons.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {card.lessons.map((lesson) => (
            <li key={lesson.id}>
              <Link
                href={`/app/lessons/${lesson.id}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-bg-page px-3 py-2 text-sm transition-colors hover:border-brand"
              >
                <span className="text-body">
                  Lesson from{" "}
                  {new Date(lesson.startedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="text-xs font-medium text-muted">
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
