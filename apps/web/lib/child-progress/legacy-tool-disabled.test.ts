import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { describe, it } from "node:test";

const legacyToolUrl = new URL(
  "../../agent/tools/record_observation.ts",
  import.meta.url,
);

describe("legacy progress agent tool", () => {
  it("is absent so Eve cannot discover the retired custom tool", async () => {
    await assert.rejects(
      access(legacyToolUrl),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT",
    );
  });
});
