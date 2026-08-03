import { Icon } from "../../components/design/Icon";
import type { ProgressQuestionCardData } from "./progress-message-parts";
import { ProgressUpdateChip } from "./progress-update-chip";

const SAVE_AND_STOP_LABEL = "Save and stop";

export function ProgressQuestionCard({
  card,
  onSendSuggestion,
  onFocusComposer,
  answeredLabel = null,
}: {
  card: ProgressQuestionCardData;
  onSendSuggestion?: (message: string) => void;
  onFocusComposer?: () => void;
  /** The answer she tapped on THIS card, once she has: the card then
   * reads past tense and nothing on it looks pressable (reader-gate
   * fix: a spent button must never invite a second tap). */
  answeredLabel?: string | null;
}) {
  const spent = answeredLabel !== null || onSendSuggestion === undefined;
  return (
    <section
      className="flex w-full max-w-[36rem] flex-col gap-3"
      aria-label={`Progress question for ${card.childName}`}
    >
      {card.update ? (
        <ProgressUpdateChip
          update={card.update}
          onSendSuggestion={onSendSuggestion}
        />
      ) : null}
      <div className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold text-muted">
          {card.childName} · {card.subjectDisplayName} · one question at a time
        </p>
        <p className="mt-3 text-base font-semibold leading-relaxed text-strong">
          {card.statement}
        </p>
        {answeredLabel !== null ? (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-sage">
            <Icon name="check" size={16} />
            You said: {answeredLabel}
          </p>
        ) : spent ? (
          // An older card with no recorded tap (a reloaded session):
          // the options stay readable but stop looking like buttons.
          <p className="mt-4 text-sm text-subtle">
            {card.answerLabels.join(" · ")}
          </p>
        ) : (
          <div
            className="mt-4 flex flex-wrap gap-2"
            role="group"
            aria-label="Answer options"
          >
            {card.answerLabels.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => onSendSuggestion?.(label)}
                className="min-h-11 rounded-pill border border-border bg-page px-4 py-2 text-sm font-semibold text-strong transition-colors hover:border-brand"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {!spent ? (
          <div
            className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-subtle pt-3"
            role="group"
            aria-label="Check-in controls"
          >
            <button
              type="button"
              disabled={onFocusComposer === undefined}
              onClick={onFocusComposer}
              className="min-h-11 rounded-pill px-2 py-2 text-sm font-medium text-muted transition-colors hover:text-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              Ask HOMA something else
            </button>
            <button
              type="button"
              onClick={() => onSendSuggestion?.(SAVE_AND_STOP_LABEL)}
              className="min-h-11 rounded-pill px-2 py-2 text-sm font-semibold text-brand transition-colors hover:text-[var(--clay-700)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {SAVE_AND_STOP_LABEL}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
