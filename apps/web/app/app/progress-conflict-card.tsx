import {
  formatProgressDate,
  progressSourceLabel,
} from "../../lib/child-progress/view-copy";
import type { ProgressConflictCardData } from "./progress-message-parts";

const DATE_UNAVAILABLE_LABEL = "Date unavailable";

function familyDateLabel(
  observedAt: string,
  timeZone: string,
): string {
  try {
    return formatProgressDate(observedAt, timeZone);
  } catch {
    return DATE_UNAVAILABLE_LABEL;
  }
}

export function ProgressConflictCard({
  card,
  timeZone,
  onSendSuggestion,
}: {
  card: ProgressConflictCardData;
  timeZone: string;
  onSendSuggestion?: (message: string) => void;
}) {
  return (
    <section
      className="w-full max-w-[36rem] rounded-lg border border-gold/40 bg-gold/10 p-4 shadow-sm sm:p-5"
      aria-label={`Progress confirmation for ${card.childName}`}
    >
      <p className="inline-flex min-h-8 items-center rounded-pill bg-gold/20 px-3 py-1.5 text-sm font-semibold text-[var(--gold-ink)]">
        {card.label}
      </p>
      <p className="mt-3 text-xs font-semibold text-[var(--gold-ink)]">
        {card.childName} · {card.subjectDisplayName}
      </p>
      <p className="mt-2 text-base font-semibold leading-relaxed text-strong">
        {card.skillStatement}
      </p>
      <ul
        className="mt-4 grid gap-2 sm:grid-cols-2"
        aria-label="Saved adult answers"
      >
        {card.answers.map((answer, index) => {
          const date = familyDateLabel(answer.observedAt, timeZone);
          return (
            <li
              key={`${index}:${answer.adultDisplayName ?? "adult"}`}
              className="rounded-md border border-gold/30 bg-card/80 p-3"
            >
              <p className="font-semibold text-strong">
                {answer.adultDisplayName?.trim() || `Adult ${index + 1}`}
              </p>
              <p className="mt-1 text-sm text-body">{answer.answerLabel}</p>
              <p className="mt-1 text-xs text-muted">
                {progressSourceLabel(answer.source)} · {date}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-base font-semibold text-strong">
        {card.question}
      </p>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Confirmation options"
      >
        {card.optionLabels.map((label, index) => (
          <button
            key={`${index}:${label}`}
            type="button"
            disabled={onSendSuggestion === undefined}
            onClick={() => onSendSuggestion?.(label)}
            className="min-h-11 rounded-pill border border-gold/40 bg-card px-4 py-2 text-sm font-semibold text-strong transition-colors hover:border-[var(--gold-ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
