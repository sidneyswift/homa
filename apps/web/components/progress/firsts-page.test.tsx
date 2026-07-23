import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { FirstsPage } from "./firsts-page";
import type {
  ChildFirstsPage,
  FirstsRowView,
} from "../../lib/child-progress/firsts-from-ledger";

/**
 * The page's job is a receipt ordered by date, the parent's words
 * leading each row. The load-bearing assertions are the ones that would
 * turn it back into a coverage checklist: a "First time" chip, a period
 * heading, a bare count, a sibling's name.
 */

function quoteRow(overrides: Partial<FirstsRowView> = {}): FirstsRowView {
  return {
    provenance: {
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
    },
    lead: { kind: "quote", text: "Story counted five buttons all by himself" },
    contestedLine: null,
    subjectMarker: null,
    ...overrides,
  };
}

function statementRow(overrides: Partial<FirstsRowView> = {}): FirstsRowView {
  return {
    provenance: {
      evidenceId: "ev-2",
      itemId: "phonics.first-sound",
      statement: "Says the first sound in a spoken word",
      subjectDisplayName: "Phonics",
      dateLabel: "Apr 4, 2026",
      metaLine: "a check-in · Apr 4, 2026",
      quote: null,
      quoteLabel: null,
      noQuoteLine: "This came from a check-in. There are no words saved with it.",
      matchedAbilityLine: null,
      channelLine: null,
    },
    lead: { kind: "statement", text: "Says the first sound in a spoken word" },
    contestedLine: null,
    subjectMarker: null,
    ...overrides,
  };
}

function page(rows: FirstsRowView[]): ChildFirstsPage {
  return { childId: "child-1", childName: "Story", rows };
}

function render(p: ChildFirstsPage): string {
  return renderToStaticMarkup(<FirstsPage page={p} />);
}

describe("FirstsPage", () => {
  it("renders one list item per first, oldest first", () => {
    const html = render(page([quoteRow(), statementRow()]));
    const items = html.match(/<li/gu) ?? [];
    assert.equal(items.length, 2);
    assert.ok(
      html.indexOf("Mar 3, 2026") < html.indexOf("Apr 4, 2026"),
      "rows must render in date order",
    );
  });

  it("leads a quote row with the parent's sentence in a blockquote", () => {
    const html = render(page([quoteRow()]));
    assert.match(
      html,
      /<blockquote[^>]*>Story counted five buttons all by himself<\/blockquote>/,
    );
    // The catalog statement is not the lead; it lives in the disclosure.
    assert.ok(
      html.indexOf("Story counted five buttons") <
        html.indexOf("Homa matched this to:"),
    );
  });

  it("leads a statement row with the bank sentence and no blockquote in the lead", () => {
    const html = render(page([statementRow()]));
    assert.match(html, /Says the first sound in a spoken word/);
    // The lead paragraph is not a blockquote.
    assert.doesNotMatch(html, /<blockquote[^>]*>Says the first sound/);
  });

  it("renders no 'First time' chip and no beginning label", () => {
    const html = render(page([quoteRow(), statementRow()]));
    assert.doesNotMatch(html, /First time/i);
    assert.doesNotMatch(html, /where this starts/i);
    assert.doesNotMatch(html, /the beginning/i);
  });

  it("renders no month, year, or period grouping heading", () => {
    const html = render(page([quoteRow(), statementRow()]));
    // No "March 2026" style period header (dates appear only inside meta
    // lines, which read "Mar 3, 2026").
    assert.doesNotMatch(html, /<h[23][^>]*>\s*(?:January|February|March|2026)/);
  });

  it("renders no count of firsts, no percentage, no 'out of'", () => {
    const html = render(page([quoteRow(), statementRow()]));
    assert.doesNotMatch(html, /%/);
    assert.doesNotMatch(html, /out of|\b2 firsts\b|\btotal\b/i);
  });

  it("renders the subject marker exactly once per marked row", () => {
    const marked = quoteRow({
      subjectMarker: {
        heading: "The first thing you told me about Math.",
        body: "This one came from a note. It counts the same as anything else here.",
      },
    });
    const html = render(page([marked, statementRow()]));
    const markers = html.match(/The first thing you told me about/gu) ?? [];
    assert.equal(markers.length, 1);
  });

  it("renders a contested row's line and still renders its quote", () => {
    const contested = quoteRow({
      contestedLine:
        "Two adults in your family remember this one differently. Both answers are saved, and this day stays here.",
    });
    const html = render(page([contested]));
    assert.match(html, /remember this one differently/);
    assert.match(html, /<blockquote/);
  });

  it("renders no second child's name and no comparison language", () => {
    const html = render(page([quoteRow(), statementRow()]));
    assert.doesNotMatch(html, /\bElla\b|\bbrother\b|\bsister\b/i);
  });

  it("contains no em dash, 'behind', 'finally', or 'at last'", () => {
    const html = render(page([quoteRow(), statementRow()]));
    assert.ok(!html.includes("—"), "no em dash");
    assert.doesNotMatch(html, /\bbehind\b/i);
    assert.doesNotMatch(html, /\bfinally\b|\bat last\b/i);
  });

  it("invites rather than reporting zero when empty, with no bare 0", () => {
    const html = render(page([]));
    assert.match(html, /Story(?:&#x27;|')s firsts will land here\./);
    // Scan visible text, not class attributes: Tailwind values like
    // tracking-[-0.015em] carry a bare 0 that is not a count.
    const text = html.replace(/<[^>]*>/gu, " ");
    assert.doesNotMatch(text, /\b0\b/);
  });

  it("exposes each row's provenance behind a details summary", () => {
    const html = render(page([quoteRow()]));
    assert.match(html, /<details[^>]*>/);
    assert.match(html, /<summary[^>]*>Where this came from<\/summary>/);
  });

  it("omits the jump link for one row and includes it for three", () => {
    const one = render(page([quoteRow()]));
    assert.doesNotMatch(one, /Jump to the most recent/);
    const three = render(
      page([
        quoteRow({ provenance: { ...quoteRow().provenance, evidenceId: "a" } }),
        quoteRow({ provenance: { ...quoteRow().provenance, evidenceId: "b" } }),
        quoteRow({ provenance: { ...quoteRow().provenance, evidenceId: "c" } }),
      ]),
    );
    assert.match(three, /Jump to the most recent/);
    assert.match(three, /href="#first-c"/);
  });
});
