import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { gateStoredQuote } from "./quote-gate";

/**
 * The gate is a security floor, so the tests hardest on it are the ones
 * that prove a sibling's name and a banned word never reach a parent's
 * keepsake, and that a mother's own clean sentence passes through
 * byte-identical.
 */

const NO_ROSTER = { otherChildNames: [] as string[] };

describe("gateStoredQuote", () => {
  it("passes a clean quote through byte-identical and untruncated", () => {
    const quote = "Story read the whole page out loud tonight.";
    const verdict = gateStoredQuote(quote, NO_ROSTER);
    assert.deepEqual(verdict, { kind: "render", quote });
  });

  it("suppresses a quote naming another child in the roster", () => {
    const verdict = gateStoredQuote("Noah read it before Ella did", {
      otherChildNames: ["Ella"],
    });
    assert.deepEqual(verdict, { kind: "suppress", reason: "other_child" });
  });

  it("matches a roster name case-insensitively", () => {
    const verdict = gateStoredQuote("ella already knows this one", {
      otherChildNames: ["Ella"],
    });
    assert.equal(verdict.kind, "suppress");
  });

  it("respects word boundaries: 'Ana' does not match 'banana'", () => {
    const verdict = gateStoredQuote("She ate a whole banana", {
      otherChildNames: ["Ana"],
    });
    assert.deepEqual(verdict, {
      kind: "render",
      quote: "She ate a whole banana",
    });
  });

  it("matches a non-ASCII name on a real boundary", () => {
    const verdict = gateStoredQuote("Zoë read it first", {
      otherChildNames: ["Zoë"],
    });
    assert.equal(verdict.kind, "suppress");
  });

  it("never suppresses a quote for the child the page is about", () => {
    // The page's own child is never in otherChildNames, so her name in
    // her own quote is fine.
    const quote = "Ella sounded out every word herself";
    const verdict = gateStoredQuote(quote, NO_ROSTER);
    assert.deepEqual(verdict, { kind: "render", quote });
  });

  it("suppresses a quote containing 'behind'", () => {
    const verdict = gateStoredQuote("I worried he was behind", NO_ROSTER);
    assert.deepEqual(verdict, { kind: "suppress", reason: "banned_words" });
  });

  it("suppresses a quote containing 'diagnosis'", () => {
    const verdict = gateStoredQuote(
      "before the diagnosis we were unsure",
      NO_ROSTER,
    );
    assert.deepEqual(verdict, { kind: "suppress", reason: "banned_words" });
  });

  it("suppresses a quote containing an em dash", () => {
    const verdict = gateStoredQuote("She read it — all of it", NO_ROSTER);
    assert.deepEqual(verdict, { kind: "suppress", reason: "em_dash" });
  });

  it("suppresses a null and a whitespace-only quote as blank", () => {
    assert.deepEqual(gateStoredQuote(null, NO_ROSTER), {
      kind: "suppress",
      reason: "blank",
    });
    assert.deepEqual(gateStoredQuote("   \n ", NO_ROSTER), {
      kind: "suppress",
      reason: "blank",
    });
  });

  it("reuses BANNED_WORDS across calls with no flag-state leak", () => {
    // A stray `g` flag would make the second .test skip from lastIndex
    // and flip the verdict. Same input, same verdict, twice.
    const quote = "he was behind on this";
    assert.deepEqual(
      gateStoredQuote(quote, NO_ROSTER),
      gateStoredQuote(quote, NO_ROSTER),
    );
  });

  it("suppresses nothing on the other_child rule for an empty roster", () => {
    const verdict = gateStoredQuote("Anyone can read this", NO_ROSTER);
    assert.equal(verdict.kind, "render");
  });
});
