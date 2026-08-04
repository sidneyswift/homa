import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const CHART = readFileSync(new URL("./trajectory-chart.tsx", import.meta.url), "utf8");
const PRIMITIVES = readFileSync(
  new URL("../../../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);
const ACTION = readFileSync(
  new URL("../../../../components/design/QuietAction.tsx", import.meta.url),
  "utf8",
);

describe("Quiet trajectory chart contract", () => {
  it("keeps interactive chart controls on the shared action atom", () => {
    assert.match(CHART, /QuietAction/u);
    assert.match(CHART, /quiet-trajectory__legend-row/u);
    assert.match(CHART, /quiet-trajectory__chart-frame/u);
    assert.doesNotMatch(CHART, /<button/u);
    assert.doesNotMatch(CHART, /font-mono|font-hand|rounded-(?:md|lg|xl|2xl|3xl|full)/u);
    assert.doesNotMatch(CHART, /(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u);
    assert.doesNotMatch(CHART, /var\(--(?:stone|gold|sage|clay|sky|pop|text-|surface-|accent-)/u);
  });

  it("uses Quiet semantic inks and responsive focus geometry", () => {
    for (const token of ["--homa-midnight-action", "--homa-info-ink", "--homa-constructive-ink", "--homa-highlight-ink", "--homa-brand-text"]) {
      assert.ok(CHART.includes(token), `missing canonical token ${token}`);
    }
    assert.match(PRIMITIVES, /\.quiet-trajectory__legend\s*\{[\s\S]*display:\s*grid/u);
    assert.match(PRIMITIVES, /\.quiet-trajectory__legend-row:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-trajectory__legend-row--selected/u);
  });

  it("lets the atom carry pointer emphasis without changing keyboard behavior", () => {
    assert.match(ACTION, /onPointerEnter\?/u);
    assert.match(ACTION, /onPointerLeave\?/u);
    assert.match(ACTION, /onPointerEnter=\{onPointerEnter\}/u);
    assert.match(ACTION, /onPointerLeave=\{onPointerLeave\}/u);
  });
});
