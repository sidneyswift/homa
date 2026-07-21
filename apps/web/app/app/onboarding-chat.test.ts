import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseHiddenDirective } from "../../lib/onboarding/directives";
import { visitShapeFromHistory } from "../onboarding/onboarding-chat-props";
import {
  kickoffDirectiveFor,
  kickoffKindFor,
  welcomeLinesFor,
  RESUME_GAP_MS,
  type OnboardingChatConfig,
} from "./onboarding-chat";

const base: OnboardingChatConfig = {
  familyId: "fam-1",
  parentName: "Alessa",
  firstVisit: true,
  gapMs: null,
};

describe("kickoffKindFor", () => {
  it("opens a brand new family with the kickoff", () => {
    assert.equal(kickoffKindFor(base), "kickoff");
  });

  it("opens with the kickoff when she has never said anything", () => {
    assert.equal(kickoffKindFor({ ...base, firstVisit: false, gapMs: null }), "kickoff");
  });

  it("says nothing at all for a short pause", () => {
    assert.equal(
      kickoffKindFor({ ...base, firstVisit: false, gapMs: 4 * 60 * 1000 }),
      "none",
    );
    assert.equal(
      kickoffKindFor({ ...base, firstVisit: false, gapMs: RESUME_GAP_MS - 1 }),
      "none",
    );
  });

  it("picks her up out loud once the gap is a real absence", () => {
    assert.equal(
      kickoffKindFor({ ...base, firstVisit: false, gapMs: RESUME_GAP_MS }),
      "resume",
    );
    assert.equal(
      kickoffKindFor({ ...base, firstVisit: false, gapMs: 3 * 24 * 60 * 60 * 1000 }),
      "resume",
    );
  });
});

describe("kickoffDirectiveFor", () => {
  it("carries the device's own zone with the opening message", () => {
    const text = kickoffDirectiveFor(base, "America/Chicago");
    assert.ok(text);
    const parsed = parseHiddenDirective(text);
    assert.equal(parsed?.name, "kickoff");
    assert.equal(parsed?.params.timeZone, "America/Chicago");
  });

  it("still opens when the browser will not name a zone", () => {
    const text = kickoffDirectiveFor(base, null);
    assert.ok(text);
    assert.equal(parseHiddenDirective(text)?.name, "kickoff");
  });

  it("sends nothing for a pause", () => {
    assert.equal(
      kickoffDirectiveFor(
        { ...base, firstVisit: false, gapMs: 60_000 },
        "America/Chicago",
      ),
      null,
    );
  });
});

describe("welcomeLinesFor", () => {
  it("uses her name when Homa has it, and stays whole when it does not", () => {
    assert.deepEqual(welcomeLinesFor(base)[0], "Hi Alessa. I'm Homa.");
    assert.deepEqual(welcomeLinesFor({ ...base, parentName: null })[0], "Hi. I'm Homa.");
  });

  it("promises nothing that could turn out to be wrong", () => {
    for (const line of welcomeLinesFor(base)) {
      assert.doesNotMatch(line, /—/);
      assert.doesNotMatch(line, /behind/i);
    }
  });
});

describe("visitShapeFromHistory", () => {
  const now = 1_800_000_000_000;
  const message = (role: "user" | "assistant", atMs: number) => ({
    id: `m-${role}-${atMs}`,
    sessionId: "s",
    role,
    channel: "web" as const,
    content: "text",
    atMs,
  });

  it("reads an empty history as a first visit", () => {
    assert.deepEqual(visitShapeFromHistory(null, now), {
      firstVisit: true,
      gapMs: null,
    });
    assert.deepEqual(
      visitShapeFromHistory({ messages: [], materials: [] }, now),
      { firstVisit: true, gapMs: null },
    );
  });

  it("measures the gap from HER last message, never from Homa's", () => {
    // A drip email that arrived overnight is not her coming back. Timing
    // the return from it would make a three-day absence look like an
    // hour and skip the beat that picks her up.
    const shape = visitShapeFromHistory(
      {
        messages: [
          message("user", now - 3 * 24 * 60 * 60 * 1000),
          message("assistant", now - 60 * 1000),
        ],
        materials: [],
      },
      now,
    );
    assert.equal(shape.firstVisit, false);
    assert.equal(shape.gapMs, 3 * 24 * 60 * 60 * 1000);
  });

  it("treats a history with only Homa's own messages as a first visit", () => {
    assert.deepEqual(
      visitShapeFromHistory(
        { messages: [message("assistant", now - 1000)], materials: [] },
        now,
      ),
      { firstVisit: true, gapMs: null },
    );
  });

  it("takes the newest of her messages, whatever order they arrive in", () => {
    const shape = visitShapeFromHistory(
      {
        messages: [
          message("user", now - 10_000),
          message("user", now - 900_000),
        ],
        materials: [],
      },
      now,
    );
    assert.equal(shape.gapMs, 10_000);
  });
});
