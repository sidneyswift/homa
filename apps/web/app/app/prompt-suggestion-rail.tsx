import { ArrowRight } from "lucide-react";

export type PromptSuggestionPhase = "idle" | "pending" | "loading" | "ready";

export interface PromptSuggestionRailProps {
  phase: PromptSuggestionPhase;
  suggestions: readonly string[];
  onSelect: (index: number, suggestion: string) => void;
}

/**
 * Keeps generated next-message actions inside one flat composer cap.
 * Pending and empty states render nothing, so no blank rail takes up space.
 */
export function PromptSuggestionRail({
  phase,
  suggestions,
  onSelect,
}: PromptSuggestionRailProps) {
  if (phase === "idle" || phase === "pending") return null;
  if (phase === "ready" && suggestions.length === 0) return null;

  return (
    <section
      aria-label="Suggested next messages"
      className="overflow-hidden rounded-t-[22px] border border-border-subtle bg-card"
    >
      {phase === "loading" ? (
        <div
          className="flex min-h-12 items-center gap-2.5 px-4 text-sm font-semibold text-muted"
          role="status"
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--clay-300)] motion-reduce:animate-none"
            aria-hidden="true"
          />
          Finding another idea...
        </div>
      ) : (
        <div
          className={`grid ${
            suggestions.length === 2 ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSelect(index, suggestion)}
              className="relative flex min-h-12 items-center justify-center gap-1.5 px-2.5 text-center text-[0.8rem] font-semibold text-muted transition-colors hover:bg-page hover:text-strong active:bg-brand-soft"
            >
              {index > 0 ? (
                <span
                  className="absolute inset-y-3 left-0 w-px bg-border-subtle"
                  aria-hidden="true"
                />
              ) : null}
              <span>{suggestion}</span>
              <ArrowRight
                size={14}
                className="text-[var(--clay-400)]"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
