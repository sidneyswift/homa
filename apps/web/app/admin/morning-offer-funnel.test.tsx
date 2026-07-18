import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { MorningOfferFunnelSummary } from "../../lib/admin/morning-brief-metrics";
import { MorningOfferFunnel } from "./morning-offer-funnel";

function summary(
  overrides: Partial<MorningOfferFunnelSummary> = {},
): MorningOfferFunnelSummary {
  return {
    deliveredOffers: 0,
    linkedReplies: 0,
    waiting: 0,
    noLinkedReply: 0,
    maturedOffers: 0,
    decisions: 0,
    accepted: 0,
    declined: 0,
    answered: 0,
    unclassified: 0,
    fulfilled: 0,
    ...overrides,
  };
}

describe("MorningOfferFunnel", () => {
  it("shows no-data language instead of a false zero acceptance rate", () => {
    const html = renderToStaticMarkup(
      <MorningOfferFunnel
        summary={summary({
          deliveredOffers: 38,
          linkedReplies: 8,
          waiting: 30,
          maturedOffers: 8,
          unclassified: 8,
        })}
        possibleInterest={0}
        rangeLabel="this week"
      />,
    );

    assert.match(html, /38 offers delivered this week/u);
    assert.match(html, /No clear yes or no yet/u);
    assert.match(
      html,
      /8 replies were recorded before yes-or-no tracking started on July 16/u,
    );
    assert.match(html, /Decision, yes, and completion rates exclude them/u);
    assert.doesNotMatch(html, /0% accepted/u);
  });

  it("names every denominator in the causal chain", () => {
    const html = renderToStaticMarkup(
      <MorningOfferFunnel
        summary={summary({
          deliveredOffers: 12,
          linkedReplies: 4,
          noLinkedReply: 6,
          waiting: 2,
          maturedOffers: 10,
          decisions: 4,
          accepted: 3,
          declined: 1,
          fulfilled: 2,
        })}
        possibleInterest={1}
        rangeLabel="this week"
      />,
    );

    assert.match(html, /4 of 10 closed windows replied \(40%\) · 2 still open/u);
    assert.match(html, /75% of decisions/u);
    assert.match(html, /67% of yes replies · saved material or task/u);
    assert.match(html, /1 nearby message could not be tied to an offer/u);
  });

  it("keeps waiting, no-reply, and other replies outside the main chain", () => {
    const html = renderToStaticMarkup(
      <MorningOfferFunnel
        summary={summary({
          deliveredOffers: 9,
          linkedReplies: 3,
          waiting: 2,
          noLinkedReply: 4,
          maturedOffers: 7,
          decisions: 2,
          accepted: 1,
          declined: 1,
          answered: 1,
        })}
        possibleInterest={2}
        rangeLabel="last 4 weeks"
      />,
    );

    assert.match(html, /3 of 7 closed windows replied \(43%\) · 2 still open/u);
    assert.match(html, /4 offers reached 24 hours with no reply/u);
    assert.match(html, /1 reply asked or said something else/u);
    assert.match(html, /excluded from reply counts/u);
  });
});
