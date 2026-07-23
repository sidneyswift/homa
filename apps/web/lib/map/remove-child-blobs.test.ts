import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { removeChild } from "./store";

/**
 * The ordering test. This is the whole bug.
 *
 * `lesson_recordings` cascades on (child_id, family_id), so the delete
 * that removes the child also removes every row holding a lesson blob
 * URL. Read the lesson ids after that delete and you get an empty list,
 * the purge finds nothing, and a child's audio stays in Blob forever
 * with no row left pointing at it. The bug is invisible: every other
 * assertion about removeChild still passes.
 *
 * So these tests assert the ORDER of the statements, not their results.
 */

const FAMILY = "11111111-1111-1111-1111-111111111111";
const CHILD = "22222222-2222-2222-2222-222222222222";

interface FakeDb {
  sql: unknown;
  statements: string[];
}

/** Just enough postgres.js: a tagged template that records what it was
 *  asked, plus `.begin` running its callback against the same tag. */
function fakeDb(options: { childExists: boolean; lessonIds: string[] }): FakeDb {
  const statements: string[] = [];
  const tag = (strings: TemplateStringsArray): Promise<unknown[]> => {
    const text = strings.join(" ? ").replace(/\s+/gu, " ").trim();
    statements.push(text);
    if (/from public\.lesson_recordings/u.test(text)) {
      return Promise.resolve(options.lessonIds.map((id) => ({ id })));
    }
    if (/delete from public\.children/u.test(text)) {
      return Promise.resolve(options.childExists ? [{ id: CHILD }] : []);
    }
    return Promise.resolve([]);
  };
  (tag as unknown as { begin: unknown }).begin = (
    run: (tx: unknown) => Promise<unknown>,
  ) => run(tag);
  return { sql: tag, statements };
}

function indexOfMatch(statements: string[], pattern: RegExp): number {
  return statements.findIndex((statement) => pattern.test(statement));
}

describe("removeChild blob purge", () => {
  it("reads the child's lesson ids BEFORE the cascade destroys them", async () => {
    const db = fakeDb({ childExists: true, lessonIds: ["lesson-a"] });
    const seen: unknown[] = [];
    await removeChild(
      FAMILY,
      CHILD,
      db.sql as Parameters<typeof removeChild>[2],
      async (input) => {
        seen.push(input);
        return 0;
      },
    );

    const read = indexOfMatch(db.statements, /from public\.lesson_recordings/u);
    const deleted = indexOfMatch(db.statements, /delete from public\.children/u);
    assert.ok(read >= 0, "the lesson ids were never read");
    assert.ok(deleted >= 0, "the child was never deleted");
    assert.ok(
      read < deleted,
      `lesson ids must be read before the delete, got read=${read} delete=${deleted}`,
    );
    assert.deepEqual(seen, [
      { familyId: FAMILY, childId: CHILD, lessonIds: ["lesson-a"] },
    ]);
  });

  it("purges the photo prefix even for a child with no lessons", async () => {
    const db = fakeDb({ childExists: true, lessonIds: [] });
    const seen: unknown[] = [];
    await removeChild(
      FAMILY,
      CHILD,
      db.sql as Parameters<typeof removeChild>[2],
      async (input) => {
        seen.push(input);
        return 0;
      },
    );
    assert.equal(seen.length, 1, "the purge must run for every deleted child");
  });

  it("never purges when nothing was deleted", async () => {
    // A childId from another family deletes nothing, and must therefore
    // delete nobody's bytes: the tenancy re-scope has to reach Blob too.
    const db = fakeDb({ childExists: false, lessonIds: ["lesson-a"] });
    const seen: unknown[] = [];
    const removed = await removeChild(
      FAMILY,
      CHILD,
      db.sql as Parameters<typeof removeChild>[2],
      async (input) => {
        seen.push(input);
        return 0;
      },
    );
    assert.equal(removed, false);
    assert.deepEqual(seen, [], "purged bytes for a child it did not delete");
  });

  it("keeps the delete even when the purge fails", async () => {
    // The row delete is the promise a parent can verify. A Blob hiccup
    // leaves a logged orphan; it must never leave her the child.
    const db = fakeDb({ childExists: true, lessonIds: ["lesson-a"] });
    const removed = await removeChild(
      FAMILY,
      CHILD,
      db.sql as Parameters<typeof removeChild>[2],
      async () => {
        throw new Error("blob store unreachable");
      },
    ).catch(() => "threw" as const);
    assert.notEqual(
      removed,
      "threw",
      "a blob failure must not fail the parent's delete",
    );
  });
});
