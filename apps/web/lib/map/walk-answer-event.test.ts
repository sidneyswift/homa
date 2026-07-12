import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { MAP_ANSWERS } from "@homa/core";

import { walkAnsweredEventProperties } from "./walk-answer-event";

const routePath = new URL("../../app/api/map/walk/route.ts", import.meta.url);

describe("walk answered event properties", () => {
  it("preserves every walk answer in the existing event shape", () => {
    for (const answer of MAP_ANSWERS) {
      assert.deepEqual(
        walkAnsweredEventProperties({
          familyId: "family-1",
          childId: "child-1",
          subject: "math",
          domain: "math.number-sense",
          answer,
        }),
        {
          family_id: "family-1",
          child_id: "child-1",
          subject: "math",
          domain: "math.number-sense",
          answer,
        },
      );
    }
  });

  it("emits only for a newly accepted durable prompt", async () => {
    const source = await readFile(routePath, "utf8");
    const acceptedGuard = source.indexOf(
      'consumed.status === "accepted"',
    );
    const answeredEvent = source.indexOf(
      '"map.walk_answered"',
      acceptedGuard,
    );
    const replayReturn = source.indexOf(
      "return Response.json(consumed.response)",
      acceptedGuard,
    );
    assert.ok(acceptedGuard >= 0);
    assert.ok(answeredEvent > acceptedGuard);
    assert.ok(replayReturn > answeredEvent);
  });

  it("passes API sitting as the answered count when stopping", async () => {
    const source = await readFile(routePath, "utf8");

    assert.match(source, /answeredCount: sitting/u);
    assert.doesNotMatch(source, /answeredCount: sitting \+ 1/u);
    assert.match(source, /questions_answered: sitting/u);
  });
});
