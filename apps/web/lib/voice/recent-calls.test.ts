import assert from "node:assert/strict";
import test from "node:test";

import {
  callGist,
  loadRecentCallsContext,
  renderRecentCalls,
} from "./recent-calls";

const TZ = "America/New_York";

// #171: a parent finished a call, opened chat, and Homa had never heard of
// it. This block is what makes her aware without being asked.
test("renders a recent call as one short line", () => {
  const out = renderRecentCalls(
    [
      {
        line: "general",
        summary: "Talked through the week and moved math to Thursday.",
        transcript_text: null,
        started_at: "2026-07-27T15:00:00Z",
      },
    ],
    TZ,
  );
  assert.match(out, /## Calls you have already had with her/);
  assert.match(out, /phone call: Talked through the week/);
  assert.match(out, /already happened on the phone, they are not happening now/);
});

test("no calls renders nothing at all, not an empty heading", () => {
  assert.equal(renderRecentCalls([], TZ), "");
});

test("the curriculum line is named as the report call", () => {
  const out = renderRecentCalls(
    [{ line: "curriculum", summary: "Went over Ruby's report.", transcript_text: null, started_at: "2026-07-27T15:00:00Z" }],
    TZ,
  );
  assert.match(out, /phone call about the report/);
});

test("a call with no summary still says it happened", () => {
  const out = renderRecentCalls(
    [{ line: "general", summary: null, transcript_text: null, started_at: "2026-07-27T15:00:00Z" }],
    TZ,
  );
  assert.match(out, /- \w+, \w+ \d+, phone call$/mu);
});

// This rides in EVERY turn's prompt, so a long call must not crowd out the
// family block.
test("callGist prefers the summary and caps its length", () => {
  const long = "x".repeat(500);
  const gist = callGist({ line: "general", summary: long, transcript_text: "ignored", started_at: null });
  assert.ok(gist.length <= 180, `gist was ${gist.length} chars`);
  assert.match(gist, /…$/u);
});

test("callGist falls back to the transcript when there is no summary", () => {
  const gist = callGist({
    line: "general",
    summary: null,
    transcript_text: "  we talked   about\n reading  ",
    started_at: null,
  });
  assert.equal(gist, "we talked about reading");
});

// Ruling voice-transcript-per-adult (2026-07-28): a call belongs to the
// adult who made it, the way their chats do. Failing closed is the only
// safe default for a privacy rule.
test("without a member id it returns nothing rather than the family's calls", async () => {
  const sql = (() => {
    throw new Error("must not query without a member id");
  }) as never;
  const out = await loadRecentCallsContext({
    familyId: "11111111-1111-1111-1111-111111111111",
    memberUserId: null,
    timeZone: TZ,
    sql,
  });
  assert.equal(out, "");
});
