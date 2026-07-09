import type { WeekHours } from "../../lib/hours";

/**
 * "School time this week": the visible face of the hours record (M3-05
 * slice). Every number is summed from real hours_log rows the parent's
 * own mentions created; nothing is estimated. Growth framing only: the
 * card celebrates what was logged and never compares to a target here
 * (per-state targets belong to the compliance surface, M3-06).
 */
export function HoursCard({ hours }: { hours: WeekHours }) {
  return (
    <section className="rounded-lg border border-border-subtle bg-card p-5 shadow-sm">
      <p className="text-[0.8rem] font-semibold text-muted">School time this week</p>
      <p className="mt-1 font-display text-2xl font-semibold text-strong">{hours.totalLabel}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {hours.bySubject.map((entry) => (
          <li
            key={entry.subject}
            className="rounded-pill border border-border bg-card px-3 py-1 text-[0.75rem] text-body"
          >
            {entry.subject} · {entry.label}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[0.75rem] text-subtle">
        Logged from what you tell Homa in chat and on calls. Mention a time
        (&ldquo;we did 45 minutes of math&rdquo;) and it lands here.
      </p>
    </section>
  );
}
