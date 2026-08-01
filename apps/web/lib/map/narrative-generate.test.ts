import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { REPORT_WRITER_PROMPT } from "./report-writer-prompt.generated";

const rawPrompt = readFileSync(new URL("../../agent/report-writer.md", import.meta.url), "utf8");

describe("the generated report writer prompt", () => {
  it("is byte for byte the markdown prompt a human edits", () => {
    assert.equal(
      REPORT_WRITER_PROMPT,
      rawPrompt,
      "report-writer-prompt.generated.ts is stale. Run: pnpm build:report-writer-prompt",
    );
  });

  it("is never empty, because report narrative generation depends on it", () => {
    assert.ok(REPORT_WRITER_PROMPT.trim().length > 0);
  });
});
