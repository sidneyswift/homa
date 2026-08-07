import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account export routes raw messages through the authenticated adult boundary", async () => {
  const source = await readFile(
    new URL("../../app/api/account-deletion/export/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /const memberUserId = actor\.memberUserId/u);
  assert.match(
    source,
    /exportConversationMessagesForAdult\(sql, \{ familyId, memberUserId \}\)/u,
  );
  assert.doesNotMatch(source, /from public\.conversation_messages/u);
});

test("session review carries authenticated adult identity into the guarded read", async () => {
  const [routeSource, reviewSource] = await Promise.all([
    readFile(
      new URL("../../app/api/learning/review/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../learning/session-review.ts", import.meta.url), "utf8"),
  ]);

  assert.match(routeSource, /memberUserId: auth\.userId/u);
  assert.match(routeSource, /\.neq\("families\.status", "deleted"\)/u);
  assert.match(routeSource, /\.order\("created_at", \{ ascending: false \}\)/u);
  assert.match(reviewSource, /loadAdultSessionReviewMessages\(sql,/u);
  assert.doesNotMatch(reviewSource, /from public\.conversation_messages/u);
});
