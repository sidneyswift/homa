import assert from "node:assert/strict";
import { test } from "node:test";

import { findTokenViolations } from "./design-tokens-check.mts";

const TOKENS = new Set([
  "border",
  "border-subtle",
  "brand",
  "brand-hover",
  "card",
  "page",
  "sage",
  "subtle",
]);
const ROOTS = new Set(["border", "brand", "card", "page", "sage", "subtle"]);

function scan(source: string): string[] {
  return findTokenViolations(source, TOKENS, ROOTS).map((v) => v.className);
}

test("catches a utility whose token was never declared", () => {
  // The 2026-07-22 bug, in miniature. This class compiles, lints and
  // typechecks; the border just comes out currentColor.
  assert.deepEqual(
    scan('className="border border-border-default bg-card"'),
    ["border-border-default"],
  );
});

test("catches a ramp value that is not an exposed token", () => {
  // --sage-700 exists in the palette but was never lifted into @theme,
  // so text-sage-700 resolves to nothing.
  assert.deepEqual(scan('<span className="text-sage-700">'), ["text-sage-700"]);
});

test("passes the tokens that are declared, including opacity modifiers", () => {
  assert.deepEqual(
    scan('className="border border-border-subtle bg-card text-subtle bg-sage/10"'),
    [],
  );
});

test("ignores stock Tailwind utilities that share a prefix", () => {
  // border-dashed and border-2 are border utilities, but "dashed" and "2"
  // are not Homa token roots, so the rule must not reach for them.
  assert.deepEqual(
    scan('className="border-2 border-dashed bg-white text-sm text-center"'),
    [],
  );
});

test("ignores CSS custom properties that contain a token name", () => {
  // bg-[var(--accent-sage-soft)] contains the literal text "accent-sage-soft".
  // Reading that as a utility was the scanner's first false positive.
  assert.deepEqual(
    scan('className="bg-[var(--accent-sage-soft)] [background:var(--bg-page-warm)]"'),
    [],
  );
});

test("reports every use, so a fix cannot miss one", () => {
  const violations = findTokenViolations(
    ['className="border-border-default"', '', 'className="border-border-default"'].join("\n"),
    TOKENS,
    ROOTS,
    "a.tsx",
  );
  assert.equal(violations.length, 2);
  assert.deepEqual(
    violations.map((v) => v.line),
    [1, 3],
  );
});
