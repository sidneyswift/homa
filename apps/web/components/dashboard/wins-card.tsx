import { personalizeStatement } from "@homa/core";

import type { RecentWin } from "../../lib/dashboard";

/**
 * "Recent wins": the parent's own confirmed observations ("does it
 * easily"), newest first, each dated from the answer row itself. Nothing
 * is generated and nothing is guessed; the fridge-magnet note appears
 * only once there are three real wins to celebrate (one Caveat moment
 * per surface, per the design system).
 */

function dateChip(value: string): string {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WinsCard({
  wins,
  childNames,
}: {
  wins: RecentWin[];
  childNames: Map<string, string>;
}) {
  const rows = wins.slice(0, 3);
  return (
    <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <p className="text-[0.8rem] font-semibold text-muted">Recent wins</p>
      {rows.length > 0 ? (
        <>
          <ul className="mt-1 flex flex-col">
            {rows.map((win, index) => (
              <li
                key={`${win.childId}-${win.statement}`}
                className={`flex items-center gap-2.5 py-2.5 ${index < rows.length - 1 ? "border-b border-[var(--stone-100)]" : ""}`}
              >
                <span aria-hidden="true" className="text-[15px]" style={{ color: "var(--gold-500)" }}>
                  {"\u2726"}
                </span>
                <span className="min-w-0 flex-1 text-[0.86rem] text-body">
                  {/* personalizeStatement handles items where the child is
                      not the sentence's subject (core's exception list). */}
                  {personalizeStatement(childNames.get(win.childId) ?? "Your kid", {
                    id: win.itemId,
                    statement: win.statement,
                  })}
                </span>
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.08em] text-subtle">
                  {dateChip(win.answeredAt)}
                </span>
              </li>
            ))}
          </ul>
          {rows.length >= 3 ? (
            <p className="mt-1.5 inline-block -rotate-[1.5deg] font-hand text-xl font-semibold" style={{ color: "var(--sage-600)" }}>
              worth a fridge magnet {"\u2726"}
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Wins land here as you check things off. Every &ldquo;does it easily&rdquo; you notice
          becomes one.
        </p>
      )}
    </section>
  );
}
