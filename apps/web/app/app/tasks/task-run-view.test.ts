import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  TASK_RUN_HISTORY_SELECT,
  mapTaskRunViews,
} from "./task-run-view";

const TASKS_PAGE_SOURCE = readFileSync(
  new URL("./page.tsx", import.meta.url),
  "utf8",
);

describe("mapTaskRunViews", () => {
  it("serializes only the caller's existing feedback with each task run", () => {
    const runs = mapTaskRunViews(
      [
        {
          id: "run-1",
          kind: "morning_brief",
          status: "done",
          title: "Morning research brief",
          summary: "A brief",
          delivered_channel: "sms",
          started_at: "2026-07-16T13:00:00.000Z",
          research_brief_feedback: [
            { member_user_id: "adult-1", signal: "helpful" },
            { member_user_id: "adult-2", signal: "not_for_us" },
          ],
        },
      ],
      "adult-1",
    );

    assert.deepEqual(runs, [
      {
        id: "run-1",
        kind: "morning_brief",
        status: "done",
        title: "Morning research brief",
        summary: "A brief",
        deliveredChannel: "sms",
        startedAt: "2026-07-16T13:00:00.000Z",
        feedbackSignal: "helpful",
      },
    ]);
  });

  it("embeds only bounded feedback fields in the thirty-run history query", () => {
    assert.match(
      TASK_RUN_HISTORY_SELECT,
      /research_brief_feedback\(signal, member_user_id\)/,
    );
    assert.doesNotMatch(TASK_RUN_HISTORY_SELECT, /created_at|updated_at|family_id/);
    assert.match(TASKS_PAGE_SOURCE, /\.select\(TASK_RUN_HISTORY_SELECT\)/);
    assert.match(TASKS_PAGE_SOURCE, /\.limit\(HISTORY_RUN_LIMIT\)/);
    assert.doesNotMatch(
      TASKS_PAGE_SOURCE,
      /\.from\("research_brief_feedback"\)/,
    );
  });
});
