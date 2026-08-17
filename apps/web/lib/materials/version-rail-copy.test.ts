import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * The version rail is a keepsake, not an audit trail (gh#350).
 *
 * She kept every earlier try because she wanted to SEE them, not because
 * anything was wrong with them. Copy that labels an earlier version
 * "superseded", "rejected", or "failed" turns a record of her work into
 * a list of her mistakes, which is the opposite of why she asked.
 *
 * Source-level because the rail fetches through a server action, so
 * rendering it in a test would mean standing up the whole data path to
 * assert on wording.
 */

const railSource = readFileSync(
  path.join(
    path.resolve(import.meta.dirname, "..", "..", "app", "app", "binder"),
    "version-rail.tsx",
  ),
  "utf8",
);

/** Only the parts a parent reads: JSX text and template strings. */
function visibleCopy(source: string): string {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .replace(/^\s*\/\/.*$/gmu, "");
  return withoutComments;
}

describe("version rail copy", () => {
  const copy = visibleCopy(railSource);

  for (const banned of [
    "superseded",
    "rejected",
    "failed",
    "discarded",
    "obsolete",
    "outdated",
    "attempt",
  ]) {
    it(`never shows the word "${banned}" to a parent`, () => {
      assert.ok(
        !new RegExp(`["\`>][^"\`<]*\\b${banned}\\b`, "iu").test(copy),
        `rail copy must not call her earlier work "${banned}"`,
      );
    });
  }

  it("says the versions were made together, not that some were wrong", () => {
    assert.match(copy, /You and Homa made \$\{versions\.length\} versions/u);
  });

  it("says exactly what restore does before the parent taps", () => {
    assert.match(copy, /Bring back/u);
    assert.match(copy, /without deleting the versions you made after it/u);
  });

  it("admits plainly when an older preview is gone rather than hiding the gap", () => {
    assert.match(copy, /older versions no longer have/u);
  });

  it("stays hidden for a material with only one version", () => {
    assert.match(copy, /versions\.length < 2\) return null/u);
  });
});
