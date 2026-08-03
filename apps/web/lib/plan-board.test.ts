import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePlanBoardResponse } from "./plan-board";

const CHILD_ID = "11111111-1111-4111-8111-111111111111";

function response() {
  return {
    ok: true,
    board: {
      timeZone: "America/New_York",
      kids: [
        {
          id: CHILD_ID,
          name: "Maya",
          birthMonth: "2019-05-10",
          avatarUrl: null,
          reportToken: null,
        },
      ],
      plans: [
        {
          childId: CHILD_ID,
          subjectId: "math",
          planRevision: 3,
          progressRevision: 7,
          done: 1,
          total: 2,
          retestAt: "2026-08-30T12:00:00.000Z",
          weeks: [
            {
              week: 1,
              focus: "counting",
              activities: ["Count buttons", "Sort buttons"],
            },
          ],
          progress: { "1.0": true },
          activitySources: {},
        },
      ],
    },
  };
}

describe("parsePlanBoardResponse", () => {
  it("accepts a persisted revisioned plan", () => {
    const parsed = parsePlanBoardResponse(response());
    assert.ok(parsed);
    assert.equal(parsed.plans[0].planRevision, 3);
    assert.deepEqual(parsed.plans[0].progress, { "1.0": true });
  });

  it("accepts an explicitly provisional plan only with both revisions null", () => {
    const value = response();
    value.board.plans[0].planRevision = null as unknown as number;
    value.board.plans[0].progressRevision = null as unknown as number;
    Object.assign(value.board.plans[0], { provisional: true });
    assert.ok(parsePlanBoardResponse(value));
  });

  it("rejects missing, negative, unsafe, nonnumeric, or unpaired revisions", () => {
    const mutations: Array<(value: ReturnType<typeof response>) => void> = [
      (value) => {
        delete (value.board.plans[0] as Partial<(typeof value.board.plans)[number]>).planRevision;
      },
      (value) => {
        value.board.plans[0].planRevision = -1;
      },
      (value) => {
        value.board.plans[0].progressRevision = Number.MAX_SAFE_INTEGER + 1;
      },
      (value) => {
        value.board.plans[0].planRevision = "three" as unknown as number;
      },
      (value) => {
        value.board.plans[0].progressRevision = null as unknown as number;
      },
    ];

    for (const mutate of mutations) {
      const value = response();
      mutate(value);
      assert.equal(parsePlanBoardResponse(value), null);
    }
  });

  it("rejects a nonboolean progress map and oversized activity key", () => {
    const nonboolean = response();
    nonboolean.board.plans[0].progress = { "1.0": "yes" as unknown as boolean };
    assert.equal(parsePlanBoardResponse(nonboolean), null);

    const oversized = response();
    Object.assign(oversized.board.plans[0], {
      progress: { "1.1000": true },
    });
    assert.equal(parsePlanBoardResponse(oversized), null);
  });

  it("rejects dates, zones, and week identities that would crash or conflict", () => {
    const invalidDate = response();
    invalidDate.board.plans[0].retestAt = "not-a-date";
    assert.equal(parsePlanBoardResponse(invalidDate), null);

    const invalidZone = response();
    invalidZone.board.timeZone = "Mars/Olympus";
    assert.equal(parsePlanBoardResponse(invalidZone), null);

    const duplicateWeek = response();
    duplicateWeek.board.plans[0].weeks.push({
      week: 1,
      focus: "different meaning",
      activities: ["A different activity"],
    });
    assert.equal(parsePlanBoardResponse(duplicateWeek), null);
  });
});
