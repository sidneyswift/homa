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
  it("says what a delivery is and keeps the pre-tracking notice", () => {
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

    assert.match(html, /morning briefs, one offer in each/u);
    assert.match(
      html,
      /8 replies were recorded before yes-or-no tracking started on July 16/u,
    );
    assert.match(html, /Yes and completion counts exclude them/u);
  });

  it("centers the delivered-to-replied relationship with its denominator", () => {
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

    assert.match(html, /40% of 10 closed windows/u);
    assert.match(html, /2 windows still open/u);
    assert.match(html, /Of the 4 replies, 3 said yes and 2 got their material or task\./u);
    assert.match(html, /6 briefs closed their 24 hour window with no reply/u);
    assert.match(html, /1 nearby message could not be tied to a brief/u);
    assert.match(html, /40% of closed windows got a reply this week\./u);
    assert.match(html, /the number to move is replies, not yes rates/u);
    // The yes-or-no stage is gone: nobody can reply no, so it carried nothing.
    assert.doesNotMatch(html, /Yes or no/u);
    assert.doesNotMatch(html, /of decisions/u);
  });

  it("stays honest before any window has closed", () => {
    const html = renderToStaticMarkup(
      <MorningOfferFunnel
        summary={summary({ deliveredOffers: 9, waiting: 9 })}
        possibleInterest={0}
        rangeLabel="this week"
      />,
    );

    assert.match(html, /No replies yet this week\./u);
    assert.match(html, /No reply windows have closed yet this week\./u);
    assert.match(html, /9 windows still open/u);
  });
});
