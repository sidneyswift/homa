import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ConversationCard } from "./conversation-card";

const base = {
  activeFamilies: 36,
  totalFamilies: 49,
  userMessages: 365,
  messagesByDay: [69, 8, 37, 49, 42, 43, 52],
  messagesPerActiveDay: 1.52,
  sentTotal: 371,
  briefCount: 131,
  undeliveredCount: 0,
  rangeLabel: "this week",
};

describe("ConversationCard", () => {
  it("names who sent what in both directions", () => {
    const html = renderToStaticMarkup(<ConversationCard {...base} />);

    assert.match(html, /36 of 49/u);
    assert.match(html, /families talked with Homa/u);
    assert.match(html, /From families/u);
    assert.match(html, /messages they sent · about 1\.5 a day per active family/u);
    assert.match(html, /To families/u);
    assert.match(html, /texts and emails we sent · 131 morning briefs among them/u);
    // Direction arrows carry the meaning visually.
    assert.match(html, /←/u);
    assert.match(html, /→/u);
  });

  it("swaps the outbound sub for undelivered sends, in danger tone", () => {
    const html = renderToStaticMarkup(
      <ConversationCard {...base} undeliveredCount={6} />,
    );
    assert.match(html, /texts and emails we sent · 6 did not arrive/u);
    assert.match(html, /--rose-600/u);
    assert.doesNotMatch(html, /morning briefs among them/u);
  });

  it("drops the rate when nobody was active", () => {
    const html = renderToStaticMarkup(
      <ConversationCard
        {...base}
        activeFamilies={0}
        userMessages={0}
        messagesPerActiveDay={null}
      />,
    );
    assert.match(html, /messages they sent/u);
    assert.doesNotMatch(html, /a day per active family/u);
  });
});
