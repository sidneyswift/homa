import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreMap } from "@homa/core";

import {
  loadChildProgressAgentContext,
  loadEnabledChildProgressAgentContext,
  renderChildProgressAgentContext,
} from "./agent-context";
import type {
  ChildProgressView,
  ProgressCheckInRecord,
} from "./types";
import { nextMoveChatScenario, nextMoveState } from "../../evals/progress-next-move/chat-fixture";

const FAMILY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CHILD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = "2026-07-11T20:30:00.000Z";

function parseContext(rendered: string) {
  return JSON.parse(rendered.slice(rendered.indexOf("{"))) as {
    checkIns: Array<{
      childName: string;
      checkInId: string;
      deliveryBound: boolean;
      promptStatement: string | null;
    }>;
    liveProgress: Array<{ childName: string }>;
    omitted: { checkIns: number; childViews: number };
  };
}

function checkIn(
  overrides: Partial<ProgressCheckInRecord> = {},
): ProgressCheckInRecord {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    childId: CHILD_ID,
    childName: "Maya",
    familyId: FAMILY_ID,
    purpose: "subject_deep_dive",
    scope: { subjectIds: ["math"] },
    state: "active",
    ownerMemberUserId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ownerDisplayName: "Elena",
    recipientMemberUserId:
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    recipientDisplayName: "Elena",
    revision: 2,
    currentItemId: "math.counts-to-5",
    currentDeliveryId:
      "11111111-1111-4111-8111-111111111111",
    episodeId: "episode-1",
    pendingRuntimeSessionId: "runtime-1",
    pendingTurnId: "turn-1",
    pauseReason: null,
    openedAt: NOW,
    pausedAt: null,
    completedAt: null,
    stoppedAt: null,
    updatedAt: NOW,
    ...overrides,
  };
}

function view(
  childId = CHILD_ID,
  childName = "Maya",
): ChildProgressView {
  return {
    childId,
    childName,
    birthDate: "2020-01-01",
    timeZone: "America/Chicago",
    projectedAt: NOW,
    scores: scoreMap(78, []),
    subjects: [],
    conflicts: [],
  };
}

describe("bounded child progress agent context", () => {
  it("keeps saved observations in ambient context without presenting unassessed catalog items as targets", () => {
    const state=nextMoveState(nextMoveChatScenario("all_easy").ledger);
    const original=JSON.stringify(state.view);
    assert.ok(original.includes("fine_motor.fiddly-builds"),"The canonical catalog must still contain the unassessed item");
    const rendered=renderChildProgressAgentContext({views:[state.view],checkIns:[]});
    assert.ok(rendered.includes("fine_motor.cuts-line"));assert.ok(rendered.includes("fine_motor.cuts-curves"));
    assert.ok(!rendered.includes("fine_motor.fiddly-builds"));assert.ok(!rendered.includes('"ask_next"'));
    assert.equal(JSON.stringify(state.view),original,"Do not mutate the canonical view used by assessment or maps");
  });
  it("does not query or inject progress context while the flag is off", async () => {
    const previous = process.env.HOMA_LIVE_PROGRESS_ENABLED;
    try {
      for (const flag of [undefined, "false"]) {
        if (flag === undefined) {
          delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
        } else {
          process.env.HOMA_LIVE_PROGRESS_ENABLED = flag;
        }
        let calls = 0;
        const rendered = await loadEnabledChildProgressAgentContext(
          { familyId: FAMILY_ID, childIds: [CHILD_ID] },
          {
            listFamilyCheckIns: async () => {
              calls += 1;
              return [];
            },
            getChildProgressView: async () => {
              calls += 1;
              return view();
            },
          },
        );

        assert.equal(rendered, "");
        assert.equal(calls, 0);
      }
    } finally {
      if (previous === undefined) {
        delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
      } else {
        process.env.HOMA_LIVE_PROGRESS_ENABLED = previous;
      }
    }
  });

  it("loads progress context only for the exact enabled value", async () => {
    const previous = process.env.HOMA_LIVE_PROGRESS_ENABLED;
    process.env.HOMA_LIVE_PROGRESS_ENABLED = "true";
    let calls = 0;
    try {
      const rendered = await loadEnabledChildProgressAgentContext(
        { familyId: FAMILY_ID, childIds: [CHILD_ID] },
        {
          listFamilyCheckIns: async () => {
            calls += 1;
            return [];
          },
          getChildProgressView: async () => {
            calls += 1;
            return view();
          },
        },
      );

      assert.match(rendered, /Progress data/u);
      assert.equal(calls, 2);
    } finally {
      if (previous === undefined) {
        delete process.env.HOMA_LIVE_PROGRESS_ENABLED;
      } else {
        process.env.HOMA_LIVE_PROGRESS_ENABLED = previous;
      }
    }
  });

  it("represents zero, one, and multiple workflows as JSON data", () => {
    const empty = parseContext(
      renderChildProgressAgentContext({
        checkIns: [],
        views: [],
      }),
    );
    const one = parseContext(
      renderChildProgressAgentContext({
        checkIns: [checkIn()],
        views: [view()],
      }),
    );
    const multiple = parseContext(
      renderChildProgressAgentContext({
        checkIns: [
          checkIn(),
          checkIn({
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            childId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            childName: "Jordan",
            currentDeliveryId: null,
          }),
        ],
        views: [
          view(),
          view(
            "ffffffff-ffff-4fff-8fff-ffffffffffff",
            "Jordan",
          ),
        ],
      }),
    );

    assert.deepEqual(empty.checkIns, []);
    assert.equal(one.checkIns[0].childName, "Maya");
    assert.equal(one.checkIns[0].deliveryBound, true);
    assert.match(
      one.checkIns[0].promptStatement ?? "",
      /counts out loud/iu,
    );
    assert.deepEqual(
      multiple.checkIns.map((entry) => entry.childName),
      ["Maya", "Jordan"],
    );
  });

  it("bounds child arrays and total serialized characters", () => {
    const rendered = renderChildProgressAgentContext({
      checkIns: Array.from({ length: 30 }, (_, index) =>
        checkIn({
          id: `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`,
          childName: `Child ${index}`,
        }),
      ),
      views: Array.from({ length: 30 }, (_, index) =>
        view(
          `${String(index).padStart(8, "0")}-0000-4000-8000-000000000001`,
          `Child ${index}`,
        ),
      ),
    });
    const parsed = parseContext(rendered);

    assert.ok(rendered.length <= 11_700);
    assert.equal(parsed.checkIns.length, 8);
    assert.equal(parsed.liveProgress.length, 6);
    assert.equal(parsed.omitted.checkIns, 22);
    assert.equal(parsed.omitted.childViews, 24);
  });

  it("loads every bounded child view and active workflow each turn", async () => {
    const loaded: string[] = [];
    const rendered = await loadChildProgressAgentContext(
      {
        familyId: FAMILY_ID,
        childIds: [
          CHILD_ID,
          "ffffffff-ffff-4fff-8fff-ffffffffffff",
        ],
      },
      {
        listFamilyCheckIns: async () => [checkIn()],
        getChildProgressView: async (_familyId, childId) => {
          loaded.push(childId);
          return view(childId, childId === CHILD_ID ? "Maya" : "Jordan");
        },
      },
    );

    assert.equal(parseContext(rendered).checkIns.length, 1);
    assert.deepEqual(loaded, [
      CHILD_ID,
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
    ]);
  });
});
