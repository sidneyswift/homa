import type { MorningOfferFunnelSummary } from "../../lib/admin/morning-brief-metrics";
import { percent } from "../../lib/admin/format";

/**
 * The morning-brief panel, rebuilt around the one question it can answer:
 * do families reply to the brief (founder ask 2026-07-23). Delivered and
 * Replied are the panel; everything after a reply is one line, because
 * nobody can reply no (the SMS offers no way to), so acceptance rate is a
 * constant dressed as a metric. The working note at the bottom names the
 * lever to test next, so the panel reads as a decision aid, not a scoreboard.
 */

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
  const replyRate =
    summary.maturedOffers > 0 ? percent(summary.linkedReplies, summary.maturedOffers) : null;

  const footnotes: string[] = [];
  if (summary.noLinkedReply > 0) {
    footnotes.push(
      countPhrase(
        summary.noLinkedReply,
        "brief went a full 24 hours with no reply",
        "briefs went a full 24 hours with no reply",
      ),
    );
  }
  if (summary.answered > 0) {
    footnotes.push(
      countPhrase(summary.answered, "reply said something else", "replies said something else"),
    );
  }
  if (possibleInterest > 0) {
    footnotes.push(
      countPhrase(
        possibleInterest,
        "nearby message could not be tied to a brief, so it is not counted as a reply",
        "nearby messages could not be tied to a brief, so they are not counted as replies",
      ),
    );
  }

  return (
    <section
      aria-labelledby="morning-offer-funnel-title"
      className="rounded-lg border border-border-subtle bg-card p-4 shadow-sm"
    >
      <p
        id="morning-offer-funnel-title"
        className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-subtle"
      >
        Morning brief offers
      </p>

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
          <p>Yes and completion counts exclude them.</p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-baseline gap-x-10 gap-y-3">
        <div>
          <p className="text-[0.72rem] font-bold text-muted">Delivered</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-none text-strong">
            {summary.deliveredOffers}
          </p>
          <p className="mt-1.5 text-[0.72rem] text-subtle">morning briefs, one offer in each</p>
        </div>
        <div>
          <p className="text-[0.72rem] font-bold text-muted">Replied</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-none text-strong">
            {summary.linkedReplies}
            {replyRate ? (
              <span className="ml-2 font-sans text-sm font-normal text-muted">
                {replyRate} of the {summary.maturedOffers} briefs old enough to judge
              </span>
            ) : null}
          </p>
          <p className="mt-1.5 text-[0.72rem] text-subtle">
            {summary.waiting > 0
              ? `${countPhrase(summary.waiting, "brief was", "briefs were")} sent too recently to count yet`
              : "every brief has had its full 24 hours"}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">
        {summary.linkedReplies > 0
          ? `Of the ${countPhrase(summary.linkedReplies, "reply", "replies")}, ${
              summary.accepted
            } said yes and ${summary.fulfilled} got their material or task.`
          : `No replies yet ${rangeLabel}.`}
      </p>
      {footnotes.length > 0 ? (
        <p className="mt-1 text-[0.75rem] text-subtle">{footnotes.join(". ")}.</p>
      ) : null}

      <div
        className="mt-4 rounded-md bg-[var(--surface-sunken)] px-4 py-3"
        style={{ borderLeft: "3px solid var(--border-brand)" }}
      >
        <p className="font-mono text-[0.62rem] font-bold uppercase tracking-[0.1em] text-subtle">
          What this panel is for
        </p>
        <p className="mt-1.5 text-sm text-body">
          {replyRate
            ? `${replyRate} of the briefs old enough to judge got a reply ${rangeLabel}. A brief counts once it has had a full 24 hours to be answered.`
            : `No brief has had its full 24 hours yet ${rangeLabel}.`}{" "}
          Nearly everyone who replies says yes, so the number to move is replies, not yes rates.
          The next lever is the message itself: end the brief with one concrete question a parent
          can answer in a word, then compare reply rates week over week.
        </p>
      </div>
    </section>
  );
}
