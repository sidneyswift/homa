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
