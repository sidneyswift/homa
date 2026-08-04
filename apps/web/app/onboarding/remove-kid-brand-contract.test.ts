import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCE = readFileSync(new URL("./remove-kid.tsx", import.meta.url), "utf8");
const PRIMITIVES = readFileSync(
  new URL("../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet remove-child affordance", () => {
  it("keeps confirmation and failure behavior on shared actions", () => {
    assert.match(SOURCE, /QuietAction/u);
    assert.match(SOURCE, /QuietFeedback/u);
    assert.doesNotMatch(SOURCE, /<button/u);
    assert.doesNotMatch(SOURCE, /rounded-(?:lg|xl|2xl|3xl|full)|bg-card|border-border/u);
  });

  it("keeps the destructive control touch-sized and focusable", () => {
    assert.match(PRIMITIVES, /\.quiet-remove__trigger\s*\{[\s\S]*min-height:\s*44px/u);
    assert.match(PRIMITIVES, /\.quiet-remove__confirm\s*\{/u);
    assert.match(PRIMITIVES, /\.quiet-remove__destructive:hover/u);
    assert.match(PRIMITIVES, /\.quiet-action:focus-visible/u);
  });
});
