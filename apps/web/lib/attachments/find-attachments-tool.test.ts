import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  ATTACHMENT_KINDS,
  subjectLessonAttachmentRestriction,
  toAttachmentSummary,
} from "../../agent/tools/find_attachments";

describe("find_attachments kind vocabulary", () => {
  it("matches migration #80's check constraint exactly", async () => {
    const migration = await readFile(
      new URL(
        "../../../../supabase/migrations/20260713073000_chat_attachments.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const match = /check \(kind in \(([^)]+)\)\)/u.exec(migration);
    assert.ok(match, "chat_attachments kind check constraint not found");
    const migrationKinds = match[1]
      .split(",")
      .map((entry) => entry.trim().replace(/^'|'$/gu, ""));
    assert.deepEqual([...ATTACHMENT_KINDS], migrationKinds);
  });
});

describe("toAttachmentSummary", () => {
  it("maps a db row to the camelCase model-facing shape", () => {
    assert.deepEqual(
      toAttachmentSummary({
        id: "00000000-0000-4000-8000-000000000001",
        url: "https://x.public.blob.vercel-storage.com/families/f1/chat/a.jpg",
        caption: "A hand-drawn letter ring",
        kind: "image",
        media_type: "image/jpeg",
        child_id: "c1",
        created_at: "2026-07-19 12:00:00+00",
      }),
      {
        id: "00000000-0000-4000-8000-000000000001",
        url: "https://x.public.blob.vercel-storage.com/families/f1/chat/a.jpg",
        caption: "A hand-drawn letter ring",
        kind: "image",
        mediaType: "image/jpeg",
        childId: "c1",
        createdAt: "2026-07-19 12:00:00+00",
      },
    );
  });

  it("keeps family-wide filing and missing captions as nulls", () => {
    const summary = toAttachmentSummary({
      id: "00000000-0000-4000-8000-000000000002",
      url: "https://x.public.blob.vercel-storage.com/families/f1/chat/b.pdf",
      caption: null,
      kind: "document",
      media_type: "application/pdf",
      child_id: null,
      created_at: "2026-07-19 12:00:00+00",
    });
    assert.equal(summary.caption, null);
    assert.equal(summary.childId, null);
  });
});

describe("subjectLessonAttachmentRestriction", () => {
  it("refuses only automatic subject lesson builds", () => {
    assert.notEqual(
      subjectLessonAttachmentRestriction({ channel: "subject_lesson" }),
      null,
    );
    for (const attributes of [
      { channel: "sms" },
      { channel: "agent-job" },
      {},
      null,
      undefined,
    ]) {
      assert.equal(subjectLessonAttachmentRestriction(attributes), null);
    }
  });
});
