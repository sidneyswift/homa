import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * recall asks the semantic RPC for the scope it was actually asked for
 * (gh#375).
 *
 * The 2026-07-23 incident: a parent asked about a phone call from that
 * morning. The transcript was in call_transcripts, embedded, from 49
 * minutes earlier. Homa made five recall attempts and found nothing, so
 * she told the parent the call did not exist.
 *
 * Two things had to both be true for that. The lexical arm searches
 * transcript text, and that call is the only one of her six that never
 * says the word "call". And the semantic arm, which exists precisely to
 * catch a topic the words miss, ranked memories, chats, and calls
 * together, applied its limit to that global ranking, and only then
 * discarded everything outside the requested scope.
 *
 * These are source-level guards rather than behavioural tests because
 * the failure mode is a contract mismatch between application code and a
 * Postgres function: PostgREST resolves an RPC by the names of the keys
 * in the request body, so a rename on either side fails at runtime, in
 * production, silently returning nothing.
 */

// apps/web/lib -> repo root. This test lives here and not beside
// recall.ts because eve discovers every file under agent/tools as a
// tool, and a .test.ts there fails the deploy build (apps/web/AGENTS.md).
const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const recallSource = readFileSync(
  path.join(repoRoot, "apps", "web", "agent", "tools", "recall.ts"),
  "utf8",
);
const pinnedSource = readFileSync(
  path.join(repoRoot, "apps", "web", "lib", "agent-pinned.ts"),
  "utf8",
);

/** The newest migration that defines recall_semantic. */
function latestRecallSemanticMigration(): string {
  const dir = path.join(repoRoot, "supabase", "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  // Must match a DEFINITION, not any mention. A grant or revoke names the
  // same signature, so a looser substring picked up the revoke migration
  // and then failed for having no scopes argument in it (caught by CI on
  // gh#382, which is exactly the kind of false alarm that gets a guard
  // deleted rather than trusted).
  const defining = files.filter((name) =>
    /create (or replace )?function public\.recall_semantic\(/u.test(
      readFileSync(path.join(dir, name), "utf8"),
    ),
  );
  assert.ok(defining.length > 0, "no migration defines recall_semantic");
  return readFileSync(path.join(dir, defining[defining.length - 1]), "utf8");
}

describe("recall semantic scope contract", () => {
  it("passes a scopes argument the migration actually declares", () => {
    assert.match(
      recallSource,
      /rpc\("recall_semantic", \{[\s\S]*?scopes,/u,
      "recall.ts must send scopes to the RPC",
    );
    assert.match(
      latestRecallSemanticMigration(),
      /scopes text\[\] default null/u,
      "the RPC must declare a defaulted scopes argument",
    );
  });

  it("maps every recall scope to the source name the RPC emits", () => {
    const migration = latestRecallSemanticMigration();
    for (const source of ["call", "chat", "memory"]) {
      assert.ok(
        migration.includes(`'${source}' = any(scopes)`),
        `the RPC must filter on the ${source} source name`,
      );
      assert.ok(
        recallSource.includes(`"${source}"`),
        `recall.ts must know the ${source} source name`,
      );
    }
  });

  it("does not retry a failed scoped RPC with a wider history search", () => {
    assert.doesNotMatch(
      recallSource,
      /semantic === null/u,
      "a failed scoped RPC must fail closed instead of widening raw history",
    );
  });

  it("filters the pinned semantic union by scope in SQL, not after the limit", () => {
    for (const guard of ["wantMemories", "wantChats", "wantCalls"]) {
      assert.ok(
        pinnedSource.includes(`\${${guard}}::boolean`),
        `the pinned union must gate its ${guard} arm inside the query`,
      );
    }
    const unionStart = pinnedSource.indexOf("select 'memories' as source");
    const limitEnd = pinnedSource.indexOf("order by distance asc", unionStart);
    assert.ok(unionStart > 0 && limitEnd > unionStart);
    const union = pinnedSource.slice(unionStart, limitEnd);
    for (const guard of ["wantMemories", "wantChats", "wantCalls"]) {
      assert.ok(
        union.includes(guard),
        `${guard} must be inside the ranked union, before the limit`,
      );
    }
  });
});
