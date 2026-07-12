import type { ProgressUpdateCardData } from "./progress-message-parts";

const UNDO_PROGRESS_MESSAGE = "Undo that progress update.";

export function ProgressUpdateChip({
  update,
  onSendSuggestion,
}: {
  update: ProgressUpdateCardData;
  onSendSuggestion?: (message: string) => void;
}) {
  return (
    <div className="flex max-w-full flex-col items-start gap-1.5">
      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Progress update actions"
      >
        <span className="inline-flex min-h-8 items-center rounded-pill border border-sage/30 bg-sage/10 px-3 py-1.5 text-sm font-semibold text-sage">
          {update.label}
        </span>
        {update.undoAvailable ? (
          <button
            type="button"
            disabled={onSendSuggestion === undefined}
            onClick={() => onSendSuggestion?.(UNDO_PROGRESS_MESSAGE)}
            className="min-h-11 rounded-pill border border-border bg-card px-4 py-2 text-sm font-semibold text-strong transition-colors hover:border-sage disabled:cursor-not-allowed disabled:opacity-60"
          >
            Undo
          </button>
        ) : null}
      </div>
      {update.affectedTopics.length > 0 ? (
        <p className="max-w-prose text-sm leading-relaxed text-muted">
          {update.childName ? `${update.childName}: ` : ""}
          {update.affectedTopics.join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
