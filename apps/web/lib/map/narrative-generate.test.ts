import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { zodSchema } from "ai";

import { reportParametersSchema } from "./narrative-generate";
import { REPORT_WRITER_PROMPT } from "./report-writer-prompt.generated";

const rawPrompt = readFileSync(new URL("../../agent/report-writer.md", import.meta.url), "utf8");

describe("the generated report writer prompt", () => {
  it("is byte for byte the generated Markdown prompt", () => {
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

describe("the report response schema accepted by Astra", () => {
  it("requires every object property in the provider JSON schema, including nested drawer fields", async () => {
    const schema = await zodSchema(reportParametersSchema(["math", "reading"])).jsonSchema;
    let objects = 0;
    function check(value: unknown): void {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) return value.forEach(check);
      const node = value as Record<string, unknown>;
      if (node.type === "object") {
        objects += 1;
        assert.deepEqual(
          [...(node.required as string[] ?? [])].sort(),
          Object.keys(node.properties as object ?? {}).sort(),
        );
        assert.equal(node.additionalProperties, false);
      }
      Object.values(node).forEach(check);
    }
    check(schema);
    assert.equal(objects, 4, "check the draft, drawers map, and both drawer objects");
  });

  it("accepts explicit empty drawers and materials without inventing content", () => {
    const schema = reportParametersSchema(["math", "reading"]);
    const draft = {
      noteFacts: [],
      drawers: { math: null, reading: { activity: "read together", materials: null } },
    };
    assert.deepEqual(schema.parse(draft), draft);
    assert.deepEqual(schema.parse(JSON.stringify(draft)), draft);
    assert.equal(schema.safeParse({ noteFacts: [], drawers: {} }).success, false);
  });
});
