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
  // Neutral stone: gold is reserved for "waiting on you" (conflict), so
  // Homa's own follow-ups never look like the parent's task (UX read
  // 2026-07-12: one color carrying opposite jobs).
  ask_next: {
    background: "var(--stone-100)",
    color: "var(--stone-600)",
  },
  conflict: {
    background: "var(--gold-100)",
    color: "var(--gold-ink)",
  },
};

/** Wired in by the detail panel so a saved answer can be tapped to
 * confirm it; omitted, the answers render as plain boxes. */
export interface ProgressConflictActions {
  pendingEvidenceId: string | null;
  errorConflictId: string | null;
  onPick(input: {
    conflictId: string;
    evidenceId: string;
    answer: OpenProgressConflictView["adultAnswers"][number]["answer"];
  }): void;
}

function ProgressConflictAnswers({
  conflict,
  statement,
  timeZone,
  actions,
}: {
  conflict: OpenProgressConflictView;
  statement: string;
  timeZone: string;
  actions?: ProgressConflictActions;
}) {
  const pending = actions?.pendingEvidenceId ?? null;
  return (
    <>
      <ul
        aria-label={`Saved answers for ${statement}`}
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        {conflict.adultAnswers.map((adultAnswer, index) => {
          const who =
            adultAnswer.adultDisplayName ?? `Adult ${index + 1}`;
          const body = (
            <>
              <p className="text-sm font-semibold text-strong">
                {who}
              </p>
              <p className="mt-1 font-display text-lg font-semibold text-strong">
                {progressAnswerLabel(adultAnswer.answer)}
              </p>
              <p className="mt-1 font-mono text-sm text-muted">
                {progressSourceLabel(adultAnswer.source.kind)}{" "}
                {"\u00b7"}{" "}
                {formatProgressDate(
                  adultAnswer.observedAt,
                  timeZone,
                )}
              </p>
            </>
          );
          return (
            <li key={adultAnswer.evidenceId} className="flex">
              {actions ? (
                <button
                  type="button"
                  aria-label={`Confirm ${who}'s answer: ${progressAnswerLabel(adultAnswer.answer)}`}
                  aria-busy={
                    pending === adultAnswer.evidenceId
                      ? "true"
                      : undefined
                  }
                  disabled={pending !== null}
                  onClick={() =>
                    actions.onPick({
                      conflictId: conflict.id,
                      evidenceId: adultAnswer.evidenceId,
                      answer: adultAnswer.answer,
                    })
                  }
                  className="w-full rounded-md border border-border bg-card p-4 text-left transition-colors duration-(--dur-fast) ease-out hover:border-brand disabled:opacity-60"
                >
                  {body}
                </button>
              ) : (
                <div className="w-full rounded-md border border-border-subtle bg-card p-4">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {actions ? (
        <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-widest text-subtle">
          tap the answer that fits today
        </p>
      ) : null}
      {actions?.errorConflictId === conflict.id ? (
        <p role="alert" className="mt-2 text-sm text-body">
          That didn&apos;t save. Nothing changed, you can try once
          more.
        </p>
      ) : null}
    </>
  );
}

export function ProgressTopicRow({
  topic,
  conflict,
  timeZone,
  conflictActions,
}: {
  topic: ProgressTopicView;
  conflict?: OpenProgressConflictView;
  timeZone: string;
  conflictActions?: ProgressConflictActions;
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
          Nothing shared on this yet. Homa will ask about it at a good
          moment.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm text-body">
            You each noticed something different. Both answers stay
            saved; confirming picks which one fits today.
          </p>
          {conflict ? (
            <ProgressConflictAnswers
              conflict={conflict}
              statement={topic.statement}
              timeZone={timeZone}
              {...(conflictActions
                ? { actions: conflictActions }
                : {})}
            />
          ) : null}
        </>
      )}
    </li>
  );
}
