import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { parseHiddenDirective } from "../../lib/onboarding/directives";
import { visitShapeFromHistory } from "../onboarding/onboarding-chat-props";
import {
  appOpensWithBasics,
  kickoffDirectiveFor,
  kickoffKindFor,
  kickoffLockIsStale,
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

  it("sends nothing when the app is drawing the basics card itself", () => {
    // The turn it would have bought does one thing: hand back a card the
    // app already has. Spending it costs 2 to 6 seconds of "working on
    // it" on the first screen after she paid, and risks a second copy of
    // the card she is already filling in.
    assert.equal(
      kickoffDirectiveFor({ ...base, parentName: null }, "America/Chicago"),
      null,
    );
  });
});

describe("appOpensWithBasics", () => {
  const fresh: OnboardingChatConfig = { ...base, parentName: null };

  it("opens with the card for a brand new family", () => {
    assert.equal(appOpensWithBasics(fresh), true);
  });

  it("opens with the card when she has never said anything", () => {
    assert.equal(
      appOpensWithBasics({ ...fresh, firstVisit: false, gapMs: null }),
      true,
    );
  });

  it("leaves a parent who already gave her name alone", () => {
    // She filled the card and closed the tab. Re-asking her name is
    // worse than any wait, so this hands the opening back to Homa, who
    // can see the name in family context and react to it.
    assert.equal(appOpensWithBasics(base), false);
  });

  it("does not take over a real return visit", () => {
    assert.equal(
      appOpensWithBasics({
        ...fresh,
        firstVisit: false,
        gapMs: RESUME_GAP_MS + 1,
      }),
      false,
    );
  });

  it("stays out of a short pause, which opens in silence either way", () => {
    assert.equal(
      appOpensWithBasics({ ...fresh, firstVisit: false, gapMs: 60_000 }),
      false,
    );
  });
});

describe("visitShapeFromHistory", () => {
  const now = 1_800_000_000_000;
  const message = (role: "user" | "assistant", atMs: number) => ({
    id: `m-${role}-${atMs}`,
    sessionId: "s",
    role,
    channel: "web" as const,
    modality: "text" as const,
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

describe("kickoffLockIsStale", () => {
  // The flag is written before the send, so a kickoff that never landed
  // leaves it set over an empty conversation. A brand new parent then
  // opens a permanently blank screen, which is a far worse failure than
  // the doubled hello the flag exists to prevent.
  it("calls the lock stale when nothing was ever said", () => {
    assert.equal(
      kickoffLockIsStale({ liveMessageCount: 0, archivedCount: 0 }),
      true,
    );
  });

  it("keeps the lock once the session carries anything", () => {
    assert.equal(
      kickoffLockIsStale({ liveMessageCount: 1, archivedCount: 0 }),
      false,
    );
  });

  it("keeps the lock on a remount over scrollback", () => {
    // Nothing live, but the archive proves a conversation happened, so
    // saying hello again would be Homa forgetting she already had.
    assert.equal(
      kickoffLockIsStale({ liveMessageCount: 0, archivedCount: 12 }),
      false,
    );
  });
});

describe("one row while Homa works", () => {
  // Founder, 2026-07-22, on the opening turn: the mark "starts at one
  // spot, then moves down a little bit and then moves back up when it
  // answers."
  //
  // Measured on a live turn: the mark sat at y=305, jumped to 329, came
  // back to 305. The 24 is exactly the transcript's gap-6, which is what
  // names the cause. Mid-turn the assistant message mounts carrying only
  // a tool call, so it renders its bare "Worked on it" eyebrow ABOVE the
  // busy row and two rows both say Homa is working. When text starts
  // streaming busyLabel returns null, the busy row leaves, and the layout
  // springs back.
  //
  // A source check, because the bug only exists in the composition of
  // the transcript map and the busy row, which no unit can see.
  it("skips the in-flight message that has nothing to show yet", () => {
    const source = readFileSync(
      new URL("./chat-client.tsx", import.meta.url),
      "utf8",
    );
    assert.match(
      source,
      /busy &&\s*item\.kind === "message" &&\s*itemIndex === transcript\.length - 1 &&\s*item\.message\.role === "assistant" &&\s*!messageSaysSomething\(item\.message\)/u,
    );
  });

  it("still renders the eyebrow once the turn is over", () => {
    // The skip is gated on `busy` on purpose: when the turn ends, a
    // message whose only content was tool calls becomes an honest
    // receipt for work that really happened, and must come back.
    const source = readFileSync(
      new URL("./chat-client.tsx", import.meta.url),
      "utf8",
    );
    const skip = source.slice(source.indexOf("One row for one turn"));
    assert.ok(
      skip.slice(0, 1400).includes("busy &&"),
      "the skip is not gated on busy, so finished turns would vanish too",
    );
  });
});
