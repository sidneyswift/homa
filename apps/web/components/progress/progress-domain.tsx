import type {
  OpenProgressConflictView,
  ProgressDomainView,
} from "../../lib/child-progress/types";
import { ProgressTopicRow } from "./progress-topic-row";

export function ProgressDomain({
  domain,
  conflicts,
  timeZone,
}: {
  domain: ProgressDomainView;
  conflicts: readonly OpenProgressConflictView[];
  timeZone: string;
}) {
  const headingId = `progress-domain-${domain.domainId}`;

  return (
    <section aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="font-mono text-xs font-bold uppercase tracking-widest text-muted"
      >
        {domain.displayName}
      </h3>
      <ul className="mt-3 space-y-3">
        {domain.topics.map((topic) => (
          <ProgressTopicRow
            key={topic.itemId}
            topic={topic}
            conflict={conflicts.find(
              (candidate) => candidate.itemId === topic.itemId,
            )}
            timeZone={timeZone}
          />
        ))}
      </ul>
    </section>
  );
}
