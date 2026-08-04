import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCES = [
  "receipts-list.tsx",
  "call-homa-ps.tsx",
  "report-nav.tsx",
].map((file) => [
  file,
  readFileSync(new URL(`./${file}`, import.meta.url), "utf8"),
] as const);
const PRIMITIVES = readFileSync(
  new URL("../../../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);

describe("Quiet report support contract", () => {
  it("keeps evidence, call, and navigation atoms free of retired utilities", () => {
    for (const [file, source] of SOURCES) {
      assert.doesNotMatch(
        source,
        /font-mono|font-serif|font-hand|rounded-pill|rounded-(?:md|lg|xl|2xl|3xl|full)|(?:bg-card|border-border|text-(?:body|strong|muted|subtle))/u,
        `${file} contains a retired report utility`,
      );
    }
  });

  it("preserves correction and call effects while using Quiet hooks", () => {
    const receipts = SOURCES.find(([file]) => file === "receipts-list.tsx")?.[1] ?? "";
    const call = SOURCES.find(([file]) => file === "call-homa-ps.tsx")?.[1] ?? "";
    assert.match(receipts, /\/api\/map\/report\/correct/u);
    assert.match(receipts, /quiet-report__receipt-choice/u);
    assert.match(call, /\/api\/voice\/curriculum\/start/u);
    assert.match(call, /quiet-report__call-action/u);
    assert.match(PRIMITIVES, /\.quiet-report__receipt-choice/u);
    assert.match(PRIMITIVES, /\.quiet-report__nav-logo:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-report__call-action:focus-visible/u);
  });
});
