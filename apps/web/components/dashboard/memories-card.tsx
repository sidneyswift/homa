import { forgetMemoryAction } from "../../app/app/actions";
import { ConfirmRemoveButton } from "./confirm-remove-button";

/**
 * "What Homa remembers": the visible face of the memory system (FR-9's
 * auto-apply + visible + undo posture, founder decision 2026-07-09).
 * Every saved memory shows where it came from (a chat, a phone call, the
 * background review) and carries a one-tap remove. Removal is the undo:
 * the row deletes under the parent's own RLS and Homa forgets it
 * everywhere, next turn. The 2026-07-12 reviews promoted the heading to
 * match the other settings cards, unified the source labels to one
 * logic (who it's about, then how Homa learned it), and named the
 * correction path so Remove is never a dead end.
 */

export interface MemoryCardRow {
  id: string;
  content: string;
  kind: string;
  source: string;
  child_id: string | null;
  created_at: string;
}

/** How the memory arrived, two or three words each, no overlap: "you
 * told Homa" when the parent said it outright ("her" pointed readers at
 * the child one row up, 2026-07-13 UX read), "Homa noticed" when she
 * drew it from conversation herself. */
const SOURCE_LABELS: Record<string, string> = {
  homa: "Homa noticed",
  parent: "you told Homa",
  onboarding: "from signup",
  call: "from a call",
  review: "Homa noticed",
};

/** getMyMemories fetches up to this many; hitting it means older
 * memories exist beyond the page. */
const FETCH_LIMIT = 30;

function dateChip(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function MemoriesCard({
  memories,
  childNames,
  loadError = false,
}: {
  memories: MemoryCardRow[];
  childNames: Map<string, string>;
  loadError?: boolean;
}) {
  // Every fetched memory renders: this page is where the whole list
  // lives, with a Remove beside each (2026-07-12 reader gate: "don't
  // send me to chat to see what's remembered about my children").
  const rows = memories;
  return (
    <section className="rounded-lg border border-border-subtle bg-card p-6 shadow-sm">
      <h2 className="font-display text-xl font-semibold text-strong">What Homa remembers</h2>
      {loadError ? (
        <p className="mt-2 text-sm text-muted">
          Homa couldn&apos;t load saved memories right now. You can refresh this page in a minute.
        </p>
      ) : rows.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-body">
            Notes Homa saved for herself from your chats and calls; they shape her
            plans and replies. To change one, remove it and tell her the new
            version in chat.
          </p>
          <ul className="mt-3 divide-y divide-[var(--stone-100)]">
            {rows.map((memory) => {
              const childName = memory.child_id ? childNames.get(memory.child_id) : null;
              const label = [
                childName,
                SOURCE_LABELS[memory.source] ?? "Homa noticed",
                dateChip(memory.created_at),
              ]
                .filter(Boolean)
                .join(" \u00b7 ");
              return (
                <li key={memory.id} className="flex items-start gap-2.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-body">{memory.content}</p>
                    <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.08em] text-subtle">
                      {label}
                    </p>
                  </div>
                  <form action={forgetMemoryAction.bind(null, memory.id)}>
                    <ConfirmRemoveButton ariaLabel="Remove this memory" />
                  </form>
                </li>
              );
            })}
          </ul>
          {memories.length >= FETCH_LIMIT ? (
            <p className="mt-2 text-xs text-muted">
              These are the latest {FETCH_LIMIT}. Ask Homa in chat about anything
              older.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          As you chat with Homa, the things worth keeping land here. You can
          remove any of them, anytime.
        </p>
      )}
    </section>
  );
}
