import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const APP_REPORT_SOURCE = readFileSync(
  new URL("./[childId]/report/page.tsx", import.meta.url),
  "utf8",
);
const TOKEN_REPORT_SOURCE = readFileSync(
  new URL("../onboarding/r/[token]/page.tsx", import.meta.url),
  "utf8",
);

describe("report availability while narrative prose is pending", () => {
  for (const [name, source] of [
    ["the signed-in report", APP_REPORT_SOURCE],
    ["the token report", TOKEN_REPORT_SOURCE],
  ] as const) {
    it(`${name} uses the template fallback instead of a writing gate`, () => {
      assert.match(source, /const narrativeView =/u);
      assert.match(source, /flagOn && ready && report\.narrative/u);
      assert.doesNotMatch(source, /NarrativeBeat/u);
    });
  }
});
