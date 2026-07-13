import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  archiveFromServerHistory,
  mergeChatHistoryRows,
  recentSessionIds,
  toChatHistoryMessage,
  type ChatHistoryRow,
} from "./chat-history-model";

function row(overrides: Partial<ChatHistoryRow>): ChatHistoryRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    session_id: "wrun_a",
    role: "user",
    channel: "web",
    content: "hello",
    created_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

describe("toChatHistoryMessage", () => {
  it("maps a valid row", () => {
    const message = toChatHistoryMessage(row({}));
    assert.equal(message?.role, "user");
    assert.equal(message?.channel, "web");
    assert.equal(message?.atMs, Date.parse("2026-07-10T12:00:00.000Z"));
  });

  it("drops unknown roles, unknown channels, empty content, bad dates", () => {
    assert.equal(toChatHistoryMessage(row({ role: "system" })), null);
    assert.equal(toChatHistoryMessage(row({ channel: "voice" })), null);
    assert.equal(toChatHistoryMessage(row({ content: "   " })), null);
    assert.equal(toChatHistoryMessage(row({ created_at: "nope" })), null);
  });
});

describe("mergeChatHistoryRows", () => {
  it("dedupes across slices and sorts oldest first", () => {
    const shared = row({ id: "b", created_at: "2026-07-10T12:05:00.000Z" });
    const merged = mergeChatHistoryRows(
      [
        [row({ id: "c", created_at: "2026-07-10T12:10:00.000Z" }), shared],
        [shared, row({ id: "a", created_at: "2026-07-10T12:00:00.000Z" })],
      ],
      10,
    );
    assert.deepEqual(
      merged.map((message) => message.id),
      ["a", "b", "c"],
    );
  });

  it("keeps only the most recent rows under the cap", () => {
    const rows = [0, 1, 2, 3, 4].map((minute) =>
      row({
        id: `id-${minute}`,
        created_at: `2026-07-10T12:0${minute}:00.000Z`,
      }),
    );
    const merged = mergeChatHistoryRows([rows], 2);
    assert.deepEqual(
      merged.map((message) => message.id),
      ["id-3", "id-4"],
    );
  });
});

describe("recentSessionIds", () => {
  it("returns distinct sessions, newest first, capped", () => {
    const rows = [
      row({ id: "1", session_id: "old", created_at: "2026-07-08T10:00:00.000Z" }),
      row({ id: "2", session_id: "mid", created_at: "2026-07-09T10:00:00.000Z" }),
      row({ id: "3", session_id: "new", created_at: "2026-07-10T10:00:00.000Z" }),
      row({ id: "4", session_id: "new", created_at: "2026-07-10T11:00:00.000Z" }),
    ];
    assert.deepEqual(recentSessionIds(rows, 2), ["new", "mid"]);
  });
});

describe("archiveFromServerHistory", () => {
  it("excludes the live session and builds renderable messages", () => {
    const history = mergeChatHistoryRows(
      [
        [
          row({ id: "past", session_id: "wrun_past" }),
          row({
            id: "live",
            session_id: "wrun_live",
            created_at: "2026-07-10T13:00:00.000Z",
          }),
        ],
      ],
      10,
    );
    const archive = archiveFromServerHistory(history, "wrun_live");
    assert.equal(archive.length, 1);
    assert.equal(archive[0].message.id, "hist:past");
    assert.equal(archive[0].channel, "web");
    assert.equal(archive[0].at, Date.parse("2026-07-10T12:00:00.000Z"));
    const part = archive[0].message.parts[0];
    assert.equal(part.type === "text" ? part.text : null, "hello");
  });
});
