import type {
  OpenProgressConflictView,
  ProgressTopicView,
} from "../../lib/child-progress/types";
import {
  formatProgressDate,
  progressAnswerLabel,
  progressSourceLabel,
  progressTopicStateLabel,
} from "../../lib/child-progress/view-copy";

const TOPIC_STATE_TONES: Record<
  ProgressTopicView["state"],
  { background: string; color: string }
> = {
  observed_today: {
    background: "var(--accent-sage-soft)",
    color: "var(--sage-700)",
  },
  older: {
    background: "var(--info-soft)",
    color: "var(--pop-navy)",
  },
  ask_next: {
    background: "var(--gold-100)",
    color: "var(--gold-ink)",
  },
  conflict: {
    background: "var(--gold-100)",
    color: "var(--gold-ink)",
  },
};

function ProgressConflictAnswers({
  conflict,
  statement,
  timeZone,
}: {
  conflict: OpenProgressConflictView;
  statement: string;
  timeZone: string;
}) {
  return (
    <ul
      aria-label={`Saved answers for ${statement}`}
      className="mt-4 grid gap-3 sm:grid-cols-2"
    >
      {conflict.adultAnswers.map((adultAnswer, index) => (
        <li
          key={adultAnswer.evidenceId}
          className="rounded-md border border-border-subtle bg-card p-4"
        >
          <p className="text-sm font-semibold text-strong">
            {adultAnswer.adultDisplayName ??
              `Adult ${index + 1}`}
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-strong">
            {progressAnswerLabel(adultAnswer.answer)}
          </p>
          <p className="mt-1 font-mono text-sm text-muted">
            {progressSourceLabel(adultAnswer.source.kind)} {"\u00b7"}{" "}
            {formatProgressDate(
              adultAnswer.observedAt,
              timeZone,
            )}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function ProgressTopicRow({
  topic,
  conflict,
  timeZone,
}: {
  topic: ProgressTopicView;
  conflict?: OpenProgressConflictView;
  timeZone: string;
}) {
  const tone = TOPIC_STATE_TONES[topic.state];
  const hasEvidence =
    topic.state === "observed_today" || topic.state === "older";

  return (
    <li className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="font-display text-lg font-semibold leading-snug text-strong">
          {topic.statement}
        </h4>
        <span
          className="w-fit shrink-0 rounded-pill px-3 py-1 font-mono text-[0.68rem] font-bold uppercase tracking-wide"
          style={tone}
        >
          {progressTopicStateLabel(topic.state)}
        </span>
      </div>

      {hasEvidence ? (
        <>
          <p className="mt-3 font-display text-lg font-semibold text-strong">
            {progressAnswerLabel(topic.answer)}
          </p>
          <p className="mt-1 text-sm text-body">
            {topic.detail}
            {topic.source.adultDisplayName
              ? ` Shared by ${topic.source.adultDisplayName}.`
              : ""}
          </p>
          <p className="mt-1 font-mono text-sm text-muted">
            {formatProgressDate(topic.observedAt, timeZone)}
          </p>
        </>
      ) : topic.state === "ask_next" ? (
        <p className="mt-3 text-sm text-body">
          HOMA can ask about this later.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-body">
            Two adults shared different observations. Both answers are
            saved until you confirm.
          </p>
          {conflict ? (
            <ProgressConflictAnswers
              conflict={conflict}
              statement={topic.statement}
              timeZone={timeZone}
            />
          ) : null}
        </>
      )}
    </li>
  );
}
