import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  anchorDateText,
  quoteAppearsVerbatim,
  verifyDeadlineProposal,
  type DeadlineProposal,
} from "./deadline-anchor-verify";
import { DEADLINE_ANCHORS } from "./deadline-anchors.generated";

/**
 * The rejection paths are the point of this module (gh#342). A model
 * proposing a plausible date is easy; the guarantee is that a proposal
 * the source text does not support gets dropped, and these tests are
 * what make that guarantee testable with no gateway and no network.
 */

const NY_SOURCE =
  "By July 1 annually, or within 14 days of commencing home instruction mid-year";

function proposal(overrides: Partial<DeadlineProposal> = {}): DeadlineProposal {
  return {
    kind: "fixed",
    anchors: [
      {
        month: 7,
        day: 1,
        withinDays: null,
        label: "File by July 1 annually",
        quote: "By July 1 annually",
      },
    ],
    ...overrides,
  };
}

describe("quoteAppearsVerbatim", () => {
  it("accepts an exact substring", () => {
    assert.ok(quoteAppearsVerbatim(NY_SOURCE, "within 14 days"));
  });
  it("accepts typography-only differences", () => {
    assert.ok(quoteAppearsVerbatim("the child’s attendance", "the child's attendance"));
    assert.ok(quoteAppearsVerbatim("July 1   annually", "July 1 annually"));
  });
  it("rejects a paraphrase", () => {
    assert.ok(!quoteAppearsVerbatim(NY_SOURCE, "by the first of July"));
  });
  it("rejects an empty quote", () => {
    assert.ok(!quoteAppearsVerbatim(NY_SOURCE, ""));
  });
});

describe("verifyDeadlineProposal", () => {
  it("accepts a well-formed proposal", () => {
    const verdict = verifyDeadlineProposal("NY", NY_SOURCE, proposal());
    assert.ok(verdict.ok);
    assert.equal(verdict.entry.anchors[0].label, "File by July 1 annually");
    assert.equal(verdict.entry.source, NY_SOURCE);
  });

  it("drops a quote that is not in the source", () => {
    const verdict = verifyDeadlineProposal(
      "NY",
      NY_SOURCE,
      proposal({
        anchors: [
          {
            month: 7,
            day: 1,
            withinDays: null,
            label: "File by July 1",
            quote: "on or before the first day of July",
          },
        ],
      }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /not verbatim/);
  });

  it("drops an impossible calendar date", () => {
    const verdict = verifyDeadlineProposal(
      "XX",
      "February 30 of each year",
      proposal({
        anchors: [
          {
            month: 2,
            day: 30,
            withinDays: null,
            label: "File by February 30",
            quote: "February 30",
          },
        ],
      }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /not valid in month/);
  });

  it("drops a counted number the source never states", () => {
    // The real KY and WA case: the source says "two weeks" and a model
    // silently converted it to a number that is not in the text.
    const verdict = verifyDeadlineProposal(
      "KY",
      "Within the first two weeks of the school year",
      proposal({
        kind: "relative",
        anchors: [
          {
            month: null,
            day: null,
            withinDays: 30,
            label: "Within 30 days of the school year starting",
            quote: "Within the first two weeks of the school year",
          },
        ],
      }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /does not appear in the source/);
  });

  it("accepts weeks stated as weeks, because the basis is in the text", () => {
    const verdict = verifyDeadlineProposal(
      "KY",
      "Within the first two weeks of the school year",
      proposal({
        kind: "relative",
        anchors: [
          {
            month: null,
            day: null,
            withinDays: 14,
            label: "Within two weeks of the school year starting",
            quote: "Within the first two weeks of the school year",
          },
        ],
      }),
    );
    assert.ok(verdict.ok);
    assert.equal(verdict.entry.anchors[0].withinDays, 14);
  });

  it("drops a day with no month", () => {
    const verdict = verifyDeadlineProposal(
      "NY",
      NY_SOURCE,
      proposal({
        anchors: [
          {
            month: null,
            day: 1,
            withinDays: null,
            label: "File on the first",
            quote: "July 1",
          },
        ],
      }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /day with no month/);
  });

  it("drops kind fixed when no month is named", () => {
    const verdict = verifyDeadlineProposal(
      "XX",
      "before instruction begins",
      proposal({
        kind: "fixed",
        anchors: [
          {
            month: null,
            day: null,
            withinDays: null,
            label: "Before instruction begins",
            quote: "before instruction begins",
          },
        ],
      }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /names no month/);
  });

  it("drops kind none whether or not it carries anchors", () => {
    const empty = verifyDeadlineProposal("XX", "text", {
      kind: "none",
      anchors: [],
    });
    assert.ok(!empty.ok);
    const withAnchors = verifyDeadlineProposal("XX", "text", {
      kind: "none",
      anchors: proposal().anchors,
    });
    assert.ok(!withAnchors.ok);
  });

  it("drops an em dash in a label", () => {
    const verdict = verifyDeadlineProposal(
      "NY",
      NY_SOURCE,
      proposal({
        anchors: [
          {
            month: 7,
            day: 1,
            withinDays: null,
            label: "File by July 1 \u2014 every year",
            quote: "By July 1 annually",
          },
        ],
      }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /em dash/);
  });
});

describe("anchorDateText", () => {
  it("formats a full date, a bare month, and no date", () => {
    const base = { withinDays: null, label: "x", quote: "y" };
    assert.equal(anchorDateText({ ...base, month: 7, day: 1 }), "July 1");
    assert.equal(anchorDateText({ ...base, month: 9, day: null }), "September");
    assert.equal(anchorDateText({ ...base, month: null, day: null }), "");
  });
});

describe("the shipped anchor set", () => {
  it("covers the states whose deadlines carry real timing", () => {
    assert.ok(Object.keys(DEADLINE_ANCHORS).length >= 35);
  });

  it("pins New York's two branches, the case a parser would break", () => {
    const ny = DEADLINE_ANCHORS.NY;
    assert.ok(ny, "NY has anchors");
    assert.equal(ny.anchors.length, 2);
    const july = ny.anchors.find((a) => a.month === 7 && a.day === 1);
    assert.ok(july, "the July 1 branch survived");
    const midYear = ny.anchors.find((a) => a.withinDays === 14);
    assert.ok(midYear, "the mid-year branch survived");
  });

  it("never ships an anchor whose quote is absent from its own source", () => {
    for (const [code, entry] of Object.entries(DEADLINE_ANCHORS)) {
      for (const anchor of entry.anchors) {
        assert.ok(
          quoteAppearsVerbatim(entry.source, anchor.quote),
          `${code}: ${JSON.stringify(anchor.quote)}`,
        );
      }
    }
  });

  it("keeps every shipped entry passing the admission rules", () => {
    for (const [code, entry] of Object.entries(DEADLINE_ANCHORS)) {
      const verdict = verifyDeadlineProposal(code, entry.source, {
        kind: entry.kind,
        anchors: entry.anchors,
      });
      assert.ok(verdict.ok, `${code}: ${verdict.ok ? "" : verdict.reason}`);
    }
  });

  it("keeps multiple date-less rules distinct", () => {
    // Sampling once dropped one of DC's two conditional rules, because
    // the union dedupe keyed on calendar values and both rules carry
    // none (caught by reading a production pack, 2026-07-29). Any state
    // whose source names two timing rules must ship both.
    const dc = DEADLINE_ANCHORS.DC;
    assert.ok(dc, "DC has anchors");
    assert.equal(dc.anchors.length, 2, "DC must keep both conditional rules");
    const labels = dc.anchors.map((a) => a.label.toLowerCase());
    assert.ok(labels.some((l) => l.includes("before instruction")));
    assert.ok(labels.some((l) => l.includes("renew")));
  });

  it("never ships two anchors that say the same thing", () => {
    for (const [code, entry] of Object.entries(DEADLINE_ANCHORS)) {
      const labels = entry.anchors.map((a) => a.label.trim().toLowerCase());
      assert.equal(
        new Set(labels).size,
        labels.length,
        `${code} ships a duplicate label: ${labels.join(" | ")}`,
      );
    }
  });

  it("states business and school days in the label, never as a bare count", () => {
    // NH and VT count business days; AR counts school days. The pack
    // renders labels precisely because withinDays cannot carry that.
    for (const code of ["NH", "VT"]) {
      const entry = DEADLINE_ANCHORS[code];
      if (!entry) continue;
      const counted = entry.anchors.filter((a) => a.withinDays !== null);
      for (const anchor of counted) {
        assert.match(
          anchor.label.toLowerCase(),
          /business day/,
          `${code} label must say business days: ${anchor.label}`,
        );
      }
    }
  });
});
