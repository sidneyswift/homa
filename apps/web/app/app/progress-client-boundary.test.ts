import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("progress card client boundary", () => {
  it("uses only the shared client-safe result contract at runtime", () => {
    const parserSource = source("./progress-message-parts.ts");
    const contractSource = source(
      "../../lib/child-progress/tool-result-contract.ts",
    );

    assert.match(
      parserSource,
      /from "\.\.\/\.\.\/lib\/child-progress\/tool-result-contract"/u,
    );
    assert.match(contractSource, /from "zod\/mini"/u);
    for (const forbidden of [
      "tool-contract",
      "operation-receipt",
      "node:crypto",
      "server-only",
    ]) {
      assert.doesNotMatch(parserSource, new RegExp(forbidden, "u"));
      assert.doesNotMatch(contractSource, new RegExp(forbidden, "u"));
    }
  });

  it("makes the server tool contract reuse the shared result schema", () => {
    const serverContractSource = source(
      "../../lib/child-progress/tool-contract.ts",
    );

    assert.match(
      serverContractSource,
      /from "\.\/tool-result-contract"/u,
    );
    assert.doesNotMatch(
      serverContractSource,
      /const conflictPayloadSchema/u,
    );
    assert.doesNotMatch(
      serverContractSource,
      /export const manageChildProgressResultSchema = z\./u,
    );
  });
});
