import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildChildProgressView } from "./projection";
import { parseChildProgressView } from "./view-schema";
import type { ProgressEvidence } from "./types";

const evidence: ProgressEvidence = {
  id: "evidence-1",
  childId: "child-1",
  familyId: "family-1",
  itemId: "math.counts-to-5",
  answer: "easily",
  source: "checklist",
  memberUserId: "adult-1",
  adultDisplayName: "Elena",
  quote: "Maya counted five objects.",
  channel: null,
  messageId: null,
  checkInId: null,
  supersedesId: null,
  supersededAt: null,
  observedAt: "2026-07-11T17:30:00.123456Z",
  createdAt: "2026-07-11T17:30:01.123456Z",
};

function validView() {
  return buildChildProgressView({
    child: {
      id: "child-1",
      name: "Maya",
      birthDate: "2019-07-01",
    },
    familyId: "family-1",
    timeZone: "America/Chicago",
    evidence: [evidence],
    conflicts: [],
    selectionAnswers: [],
    now: new Date("2026-07-11T18:00:00.000Z"),
  });
}

describe("strict ChildProgressView schema", () => {
  it("accepts the exact recursive projection shape", () => {
    const view = validView();
    assert.deepEqual(parseChildProgressView(view), view);
  });

  it("requires the projection's valid family IANA time zone", () => {
    const view = validView();
    const withOptionalTimeZone = view as typeof view & {
      timeZone?: string;
    };
    assert.equal(
      withOptionalTimeZone.timeZone,
      "America/Chicago",
    );
    const withoutTimeZone = {
      ...withOptionalTimeZone,
    } as Record<string, unknown>;
    delete withoutTimeZone.timeZone;

    assert.throws(() => parseChildProgressView(withoutTimeZone));
    assert.throws(() =>
      parseChildProgressView({
        ...view,
        timeZone: "Mars/Olympus_Mons",
      })
    );
  });

  it("rejects unknown nested fields and quote injection", () => {
    const view = validView();
    const subject = view.subjects[0];
    const domain = subject.domains[0];
    const topic = domain.topics[0];
    const injected = {
      ...view,
      subjects: [
        {
          ...subject,
          domains: [
            {
              ...domain,
              topics: [{ ...topic, quote: "private journal text" }],
            },
          ],
        },
      ],
    };

    assert.throws(() => parseChildProgressView(injected));
    assert.throws(() =>
      parseChildProgressView({ ...view, unknownRoot: true })
    );
    assert.throws(() =>
      parseChildProgressView({ ...view, history: [] })
    );
    assert.throws(() =>
      parseChildProgressView({ ...view, snapshots: [] })
    );
  });
});
