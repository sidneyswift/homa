import { forgetMemoryAction } from "../../app/app/actions";

/**
 * "What Homa remembers": the visible face of the memory system (FR-9's
 * auto-apply + visible + undo posture, founder decision 2026-07-09).
 * Every saved memory shows where it came from (a chat, a phone call, the
 * background review) and carries a one-tap remove. Removal is the undo:
 * the row deletes under the parent's own RLS and Homa forgets it
 * everywhere, next turn.
 */

export interface MemoryCardRow {
  id: string;
  content: string;
  kind: string;
  source: string;
  child_id: string | null;
  created_at: string;
}

const SOURCE_LABELS: Record<string, string> = {
  homa: "from chat",
  parent: "you told Homa",
  onboarding: "from setup",
  call: "from a call",
  review: "from chat",
};

function dateChip(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MemoriesCard({
  memories,
  childNames,
}: {
  memories: MemoryCardRow[];
  childNames: Map<string, string>;
}) {
  const rows = memories.slice(0, 6);
  return (
    <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <p className="text-[0.8rem] font-semibold text-muted">What Homa remembers</p>
      {rows.length > 0 ? (
        <ul className="mt-1 flex flex-col">
          {rows.map((memory, index) => {
            const childName = memory.child_id ? childNames.get(memory.child_id) : null;
            const label = [
              childName,
              SOURCE_LABELS[memory.source] ?? "from chat",
              dateChip(memory.created_at),
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <li
                key={memory.id}
                className={`flex items-start gap-2.5 py-2.5 ${index < rows.length - 1 ? "border-b border-[var(--stone-100)]" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[0.86rem] text-body">{memory.content}</p>
                  <p className="mt-0.5 font-mono text-[0.66rem] uppercase tracking-[0.08em] text-subtle">
                    {label}
                  </p>
                </div>
                <form action={forgetMemoryAction.bind(null, memory.id)}>
                  <button
                    type="submit"
                    className="rounded-pill border border-border bg-card px-2.5 py-1 text-[0.7rem] text-muted transition-colors hover:border-brand hover:text-strong"
                    aria-label="Remove this memory"
                  >
                    Remove
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">
          As you chat and talk with Homa, the things worth keeping land here. You can
          remove any of them, anytime.
        </p>
      )}
    </section>
  );
}
