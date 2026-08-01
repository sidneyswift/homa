import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EveMessage } from "eve/client";

import { buildTranscript, dayLabelFor, sourceLabelFor } from "./transcript-days";
import type { ArchivedMessage } from "./chat-storage";

function fakeMessage(id: string, role: "user" | "assistant"): EveMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text: `text ${id}` }],
  } as EveMessage;
}

function entry(
  id: string,
  role: "user" | "assistant",
  channel: string | undefined,
  atIso: string,
): ArchivedMessage {
  return {
    at: Date.parse(atIso),
    message: fakeMessage(id, role),
    ...(channel ? { channel } : {}),
  };
}

describe("dayLabelFor", () => {
  it("renders the compact one-line header for every distance", () => {
    const now = Date.parse("2026-07-14T15:00:00");
    assert.equal(dayLabelFor(Date.parse("2026-07-14T09:00:00"), now), "Today · July 14");
    assert.equal(
      dayLabelFor(Date.parse("2026-07-13T09:00:00"), now),
      "Yesterday · July 13",
    );
    assert.equal(
      dayLabelFor(Date.parse("2026-07-07T09:00:00"), now),
      "Tuesday · July 7",
    );
    assert.equal(dayLabelFor(Date.parse("2025-07-03T09:00:00"), now), "July 3 · 2025");
  });

  it("uses the family's explicit time zone on both server and client", () => {
    const now = Date.parse("2026-07-14T08:00:00.000Z");
    assert.equal(
      dayLabelFor(
        Date.parse("2026-07-14T06:30:00.000Z"),
        now,
        "America/Los_Angeles",
      ),
      "Yesterday · July 13",
    );
  });

  it("recognizes yesterday across a 23-hour daylight-saving day", () => {
    const now = Date.parse("2026-03-09T07:30:00.000Z");
    assert.equal(
      dayLabelFor(
        Date.parse("2026-03-08T08:30:00.000Z"),
        now,
        "America/Los_Angeles",
      ),
      "Yesterday · March 8",
    );
  });
});

describe("buildTranscript time-zone grouping (GH #405)", () => {
  it("separates family calendar days even when UTC sees one day", () => {
    const archived = [
      entry("late-13", "user", "web", "2026-07-14T06:30:00.000Z"),
      entry("early-14", "assistant", "web", "2026-07-14T08:00:00.000Z"),
    ];
    const items = buildTranscript({
      archived,
      live: [],
      liveTimes: {},
      now: Date.parse("2026-07-14T08:00:00.000Z"),
      timeZone: "America/Los_Angeles",
    });

    assert.deepEqual(
      items
        .filter((item) => item.kind === "separator")
        .map((item) => (item.kind === "separator" ? item.label : "")),
      ["Yesterday · July 13", "Today · July 14"],
    );
  });
});

describe("sourceLabelFor", () => {
  it("tags the parent's texts and emails, and Homa's scheduled notes", () => {
    assert.equal(sourceLabelFor("user", "sms"), "Texted");
    assert.equal(sourceLabelFor("user", "email"), "By email");
    assert.equal(sourceLabelFor("assistant", "dispatch"), "From Homa's tasks");
  });

  it("stays quiet for the web surface and Homa's channel replies", () => {
    assert.equal(sourceLabelFor("user", "web"), null);
    assert.equal(sourceLabelFor("assistant", "sms"), null);
    assert.equal(sourceLabelFor("assistant", "email"), null);
    assert.equal(sourceLabelFor("user", undefined), null);
  });
});

describe("buildTranscript source labels", () => {
  it("tags where the surface changes, once per run", () => {
    const archived = [
      entry("m1", "user", "web", "2026-07-10T12:00:00.000Z"),
      entry("m2", "user", "sms", "2026-07-10T12:05:00.000Z"),
      entry("m3", "assistant", "sms", "2026-07-10T12:06:00.000Z"),
      entry("m4", "user", "sms", "2026-07-10T12:07:00.000Z"),
      entry("m5", "user", "web", "2026-07-10T12:30:00.000Z"),
      entry("m6", "assistant", "dispatch", "2026-07-11T11:00:00.000Z"),
    ];
    const items = buildTranscript({ archived, live: [], liveTimes: {} });
    const labels = items
      .filter((item) => item.kind === "message")
      .map((item) => (item.kind === "message" ? item.sourceLabel ?? null : null));
    assert.deepEqual(labels, [
      null,
      "Texted",
      null,
      null,
      null,
      "From Homa's tasks",
    ]);
  });

  it("keeps live messages untagged and day separators intact", () => {
    const archived = [entry("m1", "user", "sms", "2026-07-10T12:00:00.000Z")];
    const items = buildTranscript({
      archived,
      live: [fakeMessage("turn_1:user", "user")],
      liveTimes: {},
      now: Date.parse("2026-07-12T12:00:00.000Z"),
    });
    const messageItems = items.filter((item) => item.kind === "message");
    assert.equal(messageItems.length, 2);
    assert.equal(
      messageItems[0].kind === "message" ? messageItems[0].sourceLabel : null,
      "Texted",
    );
    assert.equal(
      messageItems[1].kind === "message"
        ? messageItems[1].sourceLabel ?? null
        : null,
      null,
    );
    assert.equal(items.filter((item) => item.kind === "separator").length, 2);
  });
});

describe("spoken turns in the thread", () => {
  const spokenLine = (id: string, role: "user" | "assistant", at: number) => ({
    at,
    channel: "web",
    modality: "voice" as const,
    message: {
      id,
      role,
      parts: [{ type: "text", text: `${role} said something` }],
    } as EveMessage,
  });

  it("renders a spoken turn as an ordinary message in the thread", () => {
    const now = Date.UTC(2026, 6, 29, 15, 0);
    const items = buildTranscript({
      archived: [],
      live: [],
      liveTimes: {},
      spoken: [spokenLine("v0", "user", now)],
      now,
    });
    const messages = items.filter((item) => item.kind === "message");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].kind === "message" && messages[0].message.role, "user");
  });

  it("interleaves typed and spoken turns by the clock", () => {
    // She typed, then talked, then typed again. The thread has to read in
    // the order it happened, not archived-then-live-then-voice.
    const now = Date.UTC(2026, 6, 29, 15, 0);
    const typedFirst = { id: "t1", role: "user", parts: [{ type: "text", text: "before" }] } as EveMessage;
    const typedLast = { id: "t2", role: "user", parts: [{ type: "text", text: "after" }] } as EveMessage;
    const items = buildTranscript({
      archived: [],
      live: [typedFirst, typedLast],
      liveTimes: { t1: now, t2: now + 60_000 },
      spoken: [spokenLine("v0", "user", now + 30_000)],
      now,
    });
    const ids = items
      .filter((item) => item.kind === "message")
      .map((item) => (item.kind === "message" ? item.message.id : ""));
    assert.deepEqual(ids, ["t1", "v0", "t2"]);
  });

  it("tags a spoken stretch once, on the turn that opened it", () => {
    // The pill marks a surface CHANGE. Four spoken turns are one stretch.
    const now = Date.UTC(2026, 6, 29, 15, 0);
    const items = buildTranscript({
      archived: [],
      live: [],
      liveTimes: {},
      spoken: [
        spokenLine("v0", "assistant", now),
        spokenLine("v1", "user", now + 1000),
        spokenLine("v2", "assistant", now + 2000),
      ],
      now,
    });
    const labels = items
      .filter((item) => item.kind === "message")
      .map((item) => (item.kind === "message" ? (item.sourceLabel ?? null) : null));
    assert.deepEqual(labels, ["Spoken", null, null]);
  });

  it("tags a second conversation later in the same visit", () => {
    // Typing between the two stretches ends the run, so the second one
    // earns its own pill instead of inheriting the first one's silence.
    const now = Date.UTC(2026, 6, 29, 15, 0);
    const typed = { id: "t1", role: "user", parts: [{ type: "text", text: "typed" }] } as EveMessage;
    const items = buildTranscript({
      archived: [],
      live: [typed],
      liveTimes: { t1: now + 10_000 },
      spoken: [spokenLine("v0", "user", now), spokenLine("v1", "user", now + 20_000)],
      now,
    });
    const labelled = items
      .filter((item) => item.kind === "message")
      .map((item) =>
        item.kind === "message"
          ? [item.message.id, item.sourceLabel ?? null]
          : [],
      );
    assert.deepEqual(labelled, [
      ["v0", "Spoken"],
      ["t1", null],
      ["v1", "Spoken"],
    ]);
  });

  it("marks Homa's spoken turn too, so a stretch she opened is not bare", () => {
    // Voice mode almost always starts with Homa greeting her. The
    // assistant-tags-are-noise rule that applies to device channels would
    // leave the whole conversation unmarked here.
    assert.equal(sourceLabelFor("assistant", "web", "voice"), "Spoken");
    assert.equal(sourceLabelFor("user", "web", "voice"), "Spoken");
  });

  it("does not tag a typed web message", () => {
    assert.equal(sourceLabelFor("user", "web", "text"), null);
    assert.equal(sourceLabelFor("assistant", "web", undefined), null);
  });
});

describe("buildTranscript archived-before-live ordering (GH #466)", () => {
  it("renders an archived message before a live one even when the archived entry's own clock time is later", () => {
    // The guarantee chat-client.tsx's startLostTurnRecovery now relies on
    // for its abort branch: once a stale, timed-out turn is folded into
    // the archive, it renders before anything still live no matter what
    // either side's timestamp says. Before that fix, a timed-out turn
    // stayed live forever with no reset, so its position depended purely
    // on a timestamp comparison against whatever sent next.
    const items = buildTranscript({
      archived: [entry("a1", "user", undefined, "2026-07-30T06:24:40.000Z")],
      live: [fakeMessage("m1", "user")],
      liveTimes: { m1: Date.parse("2026-07-30T06:20:00.000Z") },
      now: Date.parse("2026-07-30T06:30:00.000Z"),
    });
    const order = items
      .filter((item) => item.kind === "message")
      .map((item) => (item.kind === "message" ? item.message.id : ""));
    assert.deepEqual(order, ["a1", "m1"]);
  });
});
