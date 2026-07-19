import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { staleSubjectLessonFailureEvent } from "./stale-reaper";

describe("stale subject lesson failure event", () => {
  it("maps one transition receipt to the bounded failed event", () => {
    assert.deepEqual(
      staleSubjectLessonFailureEvent({
        familyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        childId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        subject: "literacy",
        attempt: 2,
        errorCode: "stale_run",
      }),
      {
        family_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        child_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        subject: "literacy",
        attempt: 2,
        error_code: "stale_run",
      },
    );
  });
});
