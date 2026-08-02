import { PageColumn } from "../dashboard/page-column";
import { AskHomaAboutChild } from "./ask-homa-about-child";
import { RetryProgress } from "./retry-progress";

export function ProgressUnavailable({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  return (
    <PageColumn>
      <section
        aria-labelledby="progress-unavailable-heading"
        className="mx-auto w-full max-w-[var(--container-md)] rounded-lg border border-sage/30 bg-[var(--accent-sage-soft)] p-6 shadow-sm"
      >
        <h1
          id="progress-unavailable-heading"
          className="font-display text-2xl font-semibold text-strong"
        >
          {childName}&apos;s progress is still safe
        </h1>
        <p className="mt-2 max-w-2xl text-body">
          Progress could not load right now. Nothing was changed. You
          can try again or ask Homa about {childName}.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <RetryProgress />
          <AskHomaAboutChild
            childId={childId}
            childName={childName}
          />
        </div>
      </section>
    </PageColumn>
  );
}
