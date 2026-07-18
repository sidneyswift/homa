import type { ReactNode } from "react";

import type { MorningOfferFunnelSummary } from "../../lib/admin/morning-brief-metrics";
import { percent } from "../../lib/admin/format";

function FunnelStage({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-border-subtle bg-[var(--surface-sunken)] px-3 py-2.5 last:col-span-2 sm:last:col-span-1">
      <p className="text-[0.72rem] font-bold text-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold leading-none text-strong">
        {value}
      </p>
      <p className="mt-1.5 text-[0.72rem] leading-snug text-subtle">{note}</p>
    </div>
  );
}

function countPhrase(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function MorningOfferFunnel({
  summary,
  possibleInterest,
  rangeLabel,
}: {
  summary: MorningOfferFunnelSummary;
  possibleInterest: number;
  rangeLabel: string;
}) {
  const linkedReplyNote =
    summary.maturedOffers > 0
      ? `${summary.linkedReplies} of ${summary.maturedOffers} closed windows replied (${percent(summary.linkedReplies, summary.maturedOffers)}) · ${summary.waiting} still open`
      : `${summary.waiting} reply windows still open`;
  const acceptedNote =
    summary.decisions > 0
      ? `${percent(summary.accepted, summary.decisions)} of decisions`
      : "No clear yes or no yet";
  const fulfilledNote =
    summary.accepted > 0
      ? `${percent(summary.fulfilled, summary.accepted)} of yes replies · saved material or task`
      : "Saved material or task · no yes replies yet";

  return (
    <section
      aria-labelledby="morning-offer-funnel-title"
      className="col-span-2 rounded-lg border border-border-subtle bg-card p-4 shadow-sm md:col-span-3 xl:col-span-4"
    >
      <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-subtle">
        Morning brief offers
      </p>
      <h2
        id="morning-offer-funnel-title"
        className="mt-1 font-display text-xl font-semibold text-strong"
      >
        {summary.deliveredOffers} offers delivered {rangeLabel}
      </h2>
      <div className="mt-1 text-xs text-muted">
        <p>Each stage follows the same delivered offers.</p>
        <p>Test families are excluded.</p>
      </div>

      {summary.unclassified > 0 ? (
        <div className="mt-3 rounded-md bg-[var(--gold-100)] px-3 py-2 text-[0.75rem] font-semibold text-[var(--gold-ink)]">
          <p>
            {countPhrase(
              summary.unclassified,
              "reply was recorded before yes-or-no tracking started on July 16",
              "replies were recorded before yes-or-no tracking started on July 16",
            )}
            .
          </p>
          <p>Decision, yes, and completion rates exclude them.</p>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <FunnelStage
          label="Delivered"
          value={summary.deliveredOffers}
          note="Delivered with one offer"
        />
        <FunnelStage
          label="Replied"
          value={summary.linkedReplies}
          note={linkedReplyNote}
        />
        <FunnelStage
          label="Yes or no"
          value={summary.decisions}
          note={
            summary.decisions > 0
              ? `${summary.accepted} yes · ${summary.declined} no`
              : "No clear yes or no yet"
          }
        />
        <FunnelStage
          label="Said yes"
          value={summary.accepted}
          note={
            summary.decisions > 0
              ? acceptedNote
              : "No yes replies yet"
          }
        />
        <FunnelStage
          label="Completed"
          value={summary.fulfilled}
          note={fulfilledNote}
        />
      </div>

      {summary.noLinkedReply > 0 || summary.answered > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem] text-muted">
          {summary.noLinkedReply > 0 ? (
            <span>
              {countPhrase(
                summary.noLinkedReply,
                "offer reached 24 hours with no reply",
                "offers reached 24 hours with no reply",
              )}
            </span>
          ) : null}
          {summary.answered > 0 ? (
            <span>
              {countPhrase(
                summary.answered,
                "reply asked or said something else",
                "replies asked or said something else",
              )}
            </span>
          ) : null}
        </div>
      ) : null}

      {possibleInterest > 0 ? (
        <p className="mt-2 text-[0.75rem] text-subtle">
          {countPhrase(
            possibleInterest,
            "nearby message could not be tied to an offer",
            "nearby messages could not be tied to an offer",
          )}
          . Checked within four hours and excluded from reply counts.
        </p>
      ) : null}
    </section>
  );
}
