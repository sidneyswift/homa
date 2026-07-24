import { formatInt } from "../../lib/admin/format";
import { Spark } from "./ui";

/**
 * Inbound and outbound in one frame (founder ask 2026-07-23: "how can we
 * make it even MORE clear"). Two near-identical numbers in twin tiles
 * made the reader parse verbs to get direction, and the direction got
 * read backwards. One card, an arrow per line, and a pronoun in every
 * sub: they sent, we sent.
 */

export function ConversationCard({
  activeFamilies,
  totalFamilies,
  userMessages,
  messagesByDay,
  messagesPerActiveDay,
  sentTotal,
  briefCount,
  undeliveredCount,
  rangeLabel,
}: {
  activeFamilies: number;
  totalFamilies: number;
  userMessages: number;
  messagesByDay: number[];
  /** Null when nobody was active, so the rate has no denominator. */
  messagesPerActiveDay: number | null;
  sentTotal: number;
  briefCount: number;
  undeliveredCount: number;
  rangeLabel: string;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm md:col-span-2">
      <p className="text-[0.72rem] font-bold text-muted">Conversation {rangeLabel}</p>
      <p className="mt-1 font-display text-[1.55rem] font-semibold leading-none text-strong">
        {activeFamilies} of {totalFamilies}
      </p>
      <p className="mt-1.5 text-[0.72rem] font-semibold text-[var(--sage-600)]">
        families talked with Homa
      </p>

      <dl className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-[0.72rem] font-bold text-muted">
            <span aria-hidden="true">←</span> From families
          </dt>
          <dd className="font-display text-base font-semibold text-strong">
            {formatInt(userMessages)}
          </dd>
          <dd className="text-[0.72rem] text-subtle">
            {messagesPerActiveDay !== null
              ? `messages they sent · about ${messagesPerActiveDay.toFixed(1)} a day per active family`
              : "messages they sent"}
          </dd>
        </div>
        <div className="-mt-1">
          <Spark values={messagesByDay.length > 1 ? messagesByDay : [0, 0]} />
        </div>
        <div className="flex flex-wrap items-baseline gap-x-2">
          <dt className="text-[0.72rem] font-bold text-muted">
            <span aria-hidden="true">→</span> To families
          </dt>
          <dd className="font-display text-base font-semibold text-strong">
            {formatInt(sentTotal)}
          </dd>
          <dd
            className="text-[0.72rem]"
            style={
              undeliveredCount > 0
                ? { color: "var(--rose-600)", fontWeight: 600 }
                : { color: "var(--text-subtle)" }
            }
          >
            {undeliveredCount > 0
              ? `texts and emails we sent · ${undeliveredCount} did not arrive`
              : `texts and emails we sent · ${briefCount} morning briefs among them`}
          </dd>
        </div>
      </dl>
    </section>
  );
}
