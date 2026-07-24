import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProvenanceBody } from "./provenance-body";
import type { FirstsProvenanceView } from "../../lib/child-progress/firsts-from-ledger";

function view(overrides: Partial<FirstsProvenanceView> = {}): FirstsProvenanceView {
  return {
    evidenceId: "ev-1",
    itemId: "math.how-many-5",
    statement: "Counts 5 objects and tells you how many",
    subjectDisplayName: "Math",
    dateLabel: "Mar 3, 2026",
    metaLine: "Alessa · a note · Mar 3, 2026",
    quote: "Story counted five buttons all by himself",
    quoteLabel: "Alessa's own words",
    noQuoteLine: null,
    matchedAbilityLine: "Homa matched this to: Counts 5 objects and tells you how many",
    channelLine: "By text",
    ...overrides,
  };
}

function render(provenance: FirstsProvenanceView): string {
  return renderToStaticMarkup(
    <ProvenanceBody data={{ kind: "reported", provenance }} />,
  );
}

describe("ProvenanceBody", () => {
  it("renders date, channel line, meta line and the quote under its label", () => {
    const html = render(view());
    assert.match(html, /Mar 3, 2026/);
    assert.match(html, /By text/);
    assert.match(html, /Alessa · a note/);
    assert.match(html, /Alessa(?:&#x27;|')s own words/);
    assert.match(html, /<blockquote[^>]*>Story counted five buttons/);
  });

  it("renders the quote whole, including a 500-character quote", () => {
    const long = "a".repeat(500);
    const html = render(view({ quote: long, quoteLabel: "Alessa's own words" }));
    assert.ok(html.includes(long), "the full quote must render, untruncated");
  });

  it("renders the matched-ability line when the row led with a quote", () => {
    const html = render(view());
    assert.match(html, /Homa matched this to: Counts 5 objects/);
  });

  it("renders the honest no-quote line and no blockquote when nothing was stored", () => {
    const html = render(
      view({
        quote: null,
        quoteLabel: null,
        noQuoteLine: "This came from a check-in. There are no words saved with it.",
        matchedAbilityLine: null,
      }),
    );
    assert.match(html, /There are no words saved with it/);
    assert.doesNotMatch(html, /<blockquote/);
  });

  it("renders NEITHER a blockquote NOR a no-quote line for a suppressed quote", () => {
    // quote null AND noQuoteLine null is the suppressed case: say nothing.
    const html = render(
      view({ quote: null, quoteLabel: null, noQuoteLine: null }),
    );
    assert.doesNotMatch(html, /<blockquote/);
    assert.doesNotMatch(html, /no words saved/);
    assert.doesNotMatch(html, /filtered|held back|removed/i);
  });

  it("renders a lesson-sourced row's date and channel but no quote", () => {
    const html = render(
      view({
        channelLine: "In a lesson you recorded",
        quote: null,
        quoteLabel: null,
        noQuoteLine: null,
        matchedAbilityLine: "Homa matched this to: Counts 5 objects and tells you how many",
      }),
    );
    assert.match(html, /In a lesson you recorded/);
    assert.doesNotMatch(html, /<blockquote/);
  });

  it("contains no em dash and no banned word", () => {
    const html = render(view());
    assert.ok(!html.includes("—"));
    assert.doesNotMatch(html, /\bbehind\b|\bdiagnos/i);
  });
});
