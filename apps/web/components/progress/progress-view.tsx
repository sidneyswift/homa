import Link from "next/link";

import type { ChildProgressView } from "../../lib/child-progress/types";
import { progressEmptyState } from "../../lib/child-progress/view-copy";
import { PageColumn } from "../dashboard/page-column";
import { AskHomaAboutChild } from "./ask-homa-about-child";
import { ProgressSubject } from "./progress-subject";

function ProgressEmptyState({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const copy = progressEmptyState(childName);

  return (
    <section
      aria-labelledby="progress-empty-heading"
      className="rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-6 shadow-sm"
    >
      <h2
        id="progress-empty-heading"
        className="font-display text-xl font-semibold text-strong"
      >
        {copy.heading}
      </h2>
      <p className="mt-2 max-w-2xl text-body">{copy.body}</p>
      <div className="mt-5">
        <AskHomaAboutChild
          childId={childId}
          childName={childName}
          variant="primary"
        />
      </div>
    </section>
  );
}

export function ProgressView({
  view,
  reportHref,
}: {
  view: ChildProgressView;
  /**
   * The child's permanent token report, kept available by the
   * agent-led-live-progress ruling. Null when no report exists yet.
   */
  reportHref: string | null;
}) {
  return (
    <PageColumn>
      <div className="mx-auto w-full max-w-[var(--container-md)]">
        <header>
          <p
            className="inline-flex rounded-pill bg-[var(--accent-sage-soft)] px-3 py-1.5 font-mono text-[0.68rem] font-bold uppercase tracking-widest text-[var(--sage-700)]"
          >
            Latest information
          </p>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-[-0.015em] text-strong sm:text-4xl">
            {view.childName}&apos;s progress
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-body">
            These are the skills you have shared with HOMA. Journal
            notes, check-in answers, and corrections update them here.
          </p>
          {reportHref ? (
            <div className="mt-5">
              <Link
                href={reportHref}
                className="inline-flex min-h-11 items-center rounded-pill border border-border bg-card px-5 py-2.5 text-sm font-semibold text-strong transition-colors hover:border-brand"
              >
                Open the full report
              </Link>
            </div>
          ) : null}
        </header>

        <div className="mt-7">
          {view.subjects.length === 0 ? (
            <ProgressEmptyState
              childId={view.childId}
              childName={view.childName}
            />
          ) : (
            <div className="space-y-5">
              {view.subjects.map((subject) => (
                <ProgressSubject
                  key={subject.subjectId}
                  subject={subject}
                  conflicts={view.conflicts}
                  timeZone={view.timeZone}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageColumn>
  );
}
