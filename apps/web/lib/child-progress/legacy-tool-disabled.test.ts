import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const legacyToolUrl = new URL(
  "../../agent/tools/record_observation.ts",
  import.meta.url,
);

describe("legacy progress agent tool", () => {
  it("exports only the Eve disable sentinel", async () => {
    const source = await readFile(legacyToolUrl, "utf8");

    assert.match(source, /disableTool\(\)/u);
    assert.doesNotMatch(source, /defineTool|itemId/u);
  });
});
