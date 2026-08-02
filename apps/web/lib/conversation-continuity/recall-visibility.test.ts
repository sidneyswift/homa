import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Pins the 2026-07-19 finding: recall's chat search reached rows with
 * visibility = 'internal' (scheduler dispatch prompts, and the subagent
 * rows the same day's cleanup flipped to internal) because the pinned
 * path runs on the server connection where the continuity RLS policy
 * does not apply. Internal rows are server-only; every family-facing
 * conversation_messages read must carry the family-visibility predicate
 * explicitly, and the recall_semantic function must carry it in its own
 * body so the guarantee never depends on which principal executes it.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");

function windowsAfter(source: string, needle: string, span: number): string[] {
  const windows: string[] = [];
  let at = source.indexOf(needle);
  while (at >= 0) {
    windows.push(source.slice(at, at + needle.length + span));
    at = source.indexOf(needle, at + needle.length);
  }
  return windows;
}

describe("recall visibility wall", () => {
  it("filters every pinned-path conversation_messages read to family visibility", () => {
    const source = readFileSync(path.join(here, "../agent-pinned.ts"), "utf8");
    const reads = windowsAfter(source, "from public.conversation_messages", 300);
    assert.ok(reads.length >= 2, "expected the lexical and semantic pinned reads");
    for (const read of reads) {
      assert.ok(
        read.includes("visibility = 'family'"),
        `pinned conversation_messages read lost its visibility filter:\n${read}`,
      );
    }
  });

  it("filters the recall tool's caller-path chat query to family visibility", () => {
    const source = readFileSync(
      path.join(here, "../../agent/tools/recall.ts"),
      "utf8",
    );
    const reads = windowsAfter(source, '.from("conversation_messages")', 300);
    assert.ok(reads.length >= 1, "expected the recall tool's chat query");
    for (const read of reads) {
      assert.ok(
        read.includes('.eq("visibility", "family")'),
        `caller-path conversation_messages read lost its visibility filter:\n${read}`,
      );
    }
  });

  it("keeps the visibility predicate in the latest recall_semantic definition", () => {
    const migrationsDir = path.join(repoRoot, "supabase/migrations");
    const defining = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort()
      // A DEFINITION, not any mention: a grant or revoke names the same
      // function, and selecting one of those as "the latest definition"
      // made this guard fail for having no visibility predicate in it
      // (2026-07-29, gh#382). A guard that cries wolf gets deleted, and
      // this one stands between internal rows and a parent's recall.
      .filter((file) =>
        /create (or replace )?function public\.recall_semantic/u.test(
          readFileSync(path.join(migrationsDir, file), "utf8"),
        ),
      );
    assert.ok(defining.length >= 1, "expected a recall_semantic migration");
    const latest = readFileSync(
      path.join(migrationsDir, defining[defining.length - 1]),
      "utf8",
    );
    const definitionAt = latest.lastIndexOf(
      "create or replace function public.recall_semantic",
    );
    assert.ok(definitionAt >= 0, "expected the latest function definition");
    const definition = latest.slice(definitionAt);
    const chatArms = windowsAfter(
      definition,
      "from public.conversation_messages",
      250,
    );
    assert.ok(chatArms.length >= 1, "expected a conversation_messages arm");
    for (const arm of chatArms) {
      assert.ok(
        /\b(?:c|message)\.visibility = 'family'/u.test(arm),
        `recall_semantic's chat arm lost its visibility filter:\n${arm}`,
      );
    }
  });
});
