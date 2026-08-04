import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const SOURCES = [
  readFileSync(new URL("./report-rail.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./r/[token]/report-snapshot.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./r/[token]/state-card.tsx", import.meta.url), "utf8"),
  readFileSync(new URL("./r/[token]/narrative-beat.tsx", import.meta.url), "utf8"),
];
const PRIMITIVES = readFileSync(
  new URL("../../components/design/quiet-primitives.css", import.meta.url),
  "utf8",
);
const GLOBALS = readFileSync(new URL("../globals.css", import.meta.url), "utf8");

describe("Quiet report supporting surfaces", () => {
  it("uses canonical report hooks instead of retired utility and font aliases", () => {
    assert.ok(SOURCES.some((source) => source.includes("quiet-report-rail")));
    assert.ok(SOURCES.some((source) => source.includes("quiet-report__snapshot")));
    assert.ok(SOURCES.some((source) => source.includes("quiet-report__state")));
    assert.ok(SOURCES.some((source) => source.includes("quiet-narrative-beat")));
    for (const source of SOURCES) {
      assert.doesNotMatch(source, /font-(?:mono|hand)|text-(?:body|strong|muted|subtle)|rounded-(?:lg|xl|2xl|3xl|full)/u);
      assert.doesNotMatch(source, /(?:bg-card|border-border(?:-subtle)?)/u);
    }
  });

  it("owns typography, focus, disclosure, and reduced-motion behavior in the canonical adapter", () => {
    assert.match(PRIMITIVES, /\.quiet-report__state\s*\{/u);
    assert.match(PRIMITIVES, /\.quiet-report__state\[open\] \.quiet-report__state-chevron/u);
    assert.match(PRIMITIVES, /\.quiet-report__source-link:focus-visible/u);
    assert.match(PRIMITIVES, /\.quiet-narrative-beat__refresh:focus-visible/u);
    assert.match(GLOBALS, /\.nb-line\s*\{[\s\S]*animation:/u);
    assert.match(GLOBALS, /\.nb-line\s*\{\s*animation: none;/u);
  });
});
