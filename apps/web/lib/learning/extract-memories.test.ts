import assert from "node:assert/strict";
import { test } from "node:test";

import { zodSchema } from "ai";

import { MEMORY_ENTRY_MAX_CHARS } from "../agent-memory";
import { MAX_MEMORIES_PER_EXTRACTION, memoryExtractionSchema } from "./extract-memories";

test("memory extraction sends an Astra-compatible strict schema, including child attribution", async () => {
  const schema = await zodSchema(memoryExtractionSchema).jsonSchema;
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
        "Every property must be required in the provider response schema",
      );
      assert.equal(node.additionalProperties, false);
    }
    Object.values(node).forEach(check);
  }
  check(schema);
  assert.equal(objects, 2, "check the response and each memory entry");
});

test("memory extraction accepts a family-wide null, an exact child name, or no new memories", async () => {
  const result = {
    memories: [
      { content: "The family visits the library on Fridays.", kind: "fact", childName: null },
      { content: "Synthetic Child enjoys counting with blocks.", kind: "what_works", childName: "Synthetic Child" },
    ],
  };
  const validation = await zodSchema(memoryExtractionSchema).validate!(result);
  assert.equal(validation.success, true);
  assert.deepEqual(memoryExtractionSchema.parse(result), result);
  assert.deepEqual(memoryExtractionSchema.parse({ memories: [] }), { memories: [] });
});

test("memory extraction keeps attribution required and preserves entry bounds", () => {
  const entry = { content: "The family visits the library on Fridays.", kind: "fact", childName: null };
  for (const invalid of [
    { content: entry.content, kind: entry.kind },
    { ...entry, childName: 7 },
    { ...entry, childName: "x".repeat(61) },
    { ...entry, content: "abc" },
    { ...entry, content: "x".repeat(MEMORY_ENTRY_MAX_CHARS + 1) },
    { ...entry, kind: "instruction" },
  ]) {
    assert.equal(memoryExtractionSchema.safeParse({ memories: [invalid] }).success, false);
  }
  assert.equal(memoryExtractionSchema.safeParse({
    memories: Array.from({ length: MAX_MEMORIES_PER_EXTRACTION + 1 }, () => entry),
  }).success, false);
});
