import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

/**
 * Moving a recording moves everything it caused (gh#353).
 *
 * On 2026-07-27 a parent recorded 28 minutes with her three-year-old
 * while the recorder was armed for her nine-year-old, and asked three
 * times to move it. No capability existed, so the wrong child kept both
 * the lesson and the progress evidence it produced: a preschool phonics
 * claim scored on a nine-year-old.
 *
 * These are source-level assertions because the failure modes are a SQL
 * join that silently matches nothing and a partial move that looks
 * fixed. Both pass a naive behavioural test against a mock that returns
 * whatever it was told to.
 */

const storeSource = readFileSync(
  path.join(import.meta.dirname, "store.ts"),
  "utf8",
);

function reassignBody(): string {
  const start = storeSource.indexOf("export async function reassignLessonRecording");
  assert.ok(start > 0, "reassignLessonRecording must exist");
  const end = storeSource.indexOf("\nexport ", start + 1);
  return storeSource.slice(start, end === -1 ? undefined : end);
}

describe("reassignLessonRecording", () => {
  const body = reassignBody();

  it("moves the recording, the review, and the progress evidence", () => {
    for (const table of [
      "public.lesson_recordings",
      "public.lesson_reviews",
      "public.child_progress_evidence",
    ]) {
      assert.ok(
        body.includes(`update ${table}`),
        `${table} must move with the recording, or the wrong child keeps part of it`,
      );
    }
  });

  it("links evidence by its idempotency key, not by message_id", () => {
    // Verified against a real row: lesson_listen evidence has message_id
    // null, so matching on it moves the recording and silently leaves
    // the scoring behind. The key is shaped `lesson:<id>:<hash>`.
    assert.match(body, /idempotency_key like/u);
    assert.ok(
      !/message_id = \$\{input\.lessonId\}/u.test(body),
      "message_id is null for every lesson_listen row",
    );
  });

  it("does all three in one transaction, so a half-move cannot happen", () => {
    assert.match(body, /sql\.begin\(/u);
  });

  it("re-scopes both the lesson and the child inside the family", () => {
    assert.match(body, /from public\.lesson_recordings[\s\S]*?family_id = \$\{input\.familyId\}/u);
    assert.match(body, /from public\.children[\s\S]*?family_id = \$\{input\.familyId\}/u);
  });

  it("locks the recording before reading its current child", () => {
    const lockAt = body.indexOf("for update");
    const updateAt = body.indexOf("update public.lesson_recordings");
    assert.ok(lockAt > 0 && lockAt < updateAt, "two moves at once must serialize");
  });

  it("reports a no-op instead of pretending it moved something", () => {
    assert.match(body, /already_there/u);
  });
});

describe("the reassign tool", () => {
  const toolSource = readFileSync(
    path.join(
      path.resolve(import.meta.dirname, "..", "..", "agent", "tools"),
      "reassign_lesson_recording.ts",
    ),
    "utf8",
  );

  it("is repeatable, because a replay lands on already_there", () => {
    assert.match(toolSource, /repeatable: true/u);
  });

  it("tells the parent honestly that older wording may still name the other child", () => {
    // The summary is a record of what was said. Rewriting names inside
    // it would falsify provenance, so the tool admits the seam instead.
    assert.match(toolSource, /may still name the other child/u);
  });

  it("never claims a move when nothing moved", () => {
    assert.match(toolSource, /moved: false/u);
  });
});
