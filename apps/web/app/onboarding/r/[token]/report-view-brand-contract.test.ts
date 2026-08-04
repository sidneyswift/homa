import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const REPORT_VIEW = readFileSync(new URL("./report-view.tsx", import.meta.url), "utf8");
const PRIMITIVES = readFileSync(
  new URL("../../../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet report-view contract", () => {
  it("keeps the shared renderer free of retired typography and utility authorities", () => {
    assert.doesNotMatch(
      REPORT_VIEW,
      /font-mono|font-serif|font-hand|rounded-pill|(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u,
    );
    for (const hook of [
      "quiet-report__meta",
      "quiet-report__title",
      "quiet-report__metrics",
      "quiet-report__note-eyebrow",
      "quiet-report__subject",
      "quiet-report__detail-label",
      "quiet-report__source-link",
    ]) {
      assert.match(REPORT_VIEW, new RegExp(hook, "u"), `missing semantic hook ${hook}`);
    }
  });

  it("keeps evidence disclosure and subject controls on the Quiet focus contract", () => {
    assert.match(REPORT_VIEW, /<details[^>]+data-brand-layer="report-methodology"/u);
    assert.match(REPORT_VIEW, /quiet-report__subject-summary/u);
    assert.match(PRIMITIVES, /\.quiet-report a:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-report summary:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-report__subject-chevron/u);
  });
});
