import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  archiveFromServerHistory,
  mergeChatHistoryRows,
  recentSessionIds,
  toChatHistoryMaterial,
  toChatHistoryMessage,
  type ChatHistoryMaterial,
  type ChatHistoryMaterialRow,
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

function materialRow(
  overrides: Partial<ChatHistoryMaterialRow>,
): ChatHistoryMaterialRow {
  return {
    id: "10000000-0000-0000-0000-000000000001",
    title: "Mateo's Letter M Tracing",
    kind: "worksheet",
    skill: "letter M tracing",
    preview_url: "https://blob.example/preview.jpg",
    pdf_url: "https://blob.example/page.pdf",
    created_at: "2026-07-10T12:04:00.000Z",
    session_id: "wrun_a",
    child_name: "Mateo",
    ...overrides,
  };
}

function material(
  overrides: Partial<ChatHistoryMaterialRow>,
): ChatHistoryMaterial {
  const mapped = toChatHistoryMaterial(materialRow(overrides));
  assert.ok(mapped, "fixture material should map");
  return mapped;
}

/** All create_printable parts of one archive message, output shapes. */
function materialParts(message: {
  parts: readonly { type: string; [key: string]: unknown }[];
}): { title?: string; previewUrl?: string }[] {
  return message.parts
    .filter(
      (part) =>
        part.type === "dynamic-tool" &&
        part.toolName === "create_printable" &&
        part.state === "output-available",
    )
    .map(
      (part) =>
        (part.output as { material: { title?: string; previewUrl?: string } })
          .material,
    );
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
    const archive = archiveFromServerHistory(
      { messages: history, materials: [] },
      "wrun_live",
    );
    assert.equal(archive.length, 1);
    assert.equal(archive[0].message.id, "hist:past");
    assert.equal(archive[0].channel, "web");
    assert.equal(archive[0].at, Date.parse("2026-07-10T12:00:00.000Z"));
    const part = archive[0].message.parts[0];
    assert.equal(part.type === "text" ? part.text : null, "hello");
  });

  it("attaches material cards to the session's reply, cards above text", () => {
    // The Vega shape (2026-07-13): ask 12:00, two create_printable
    // versions 12:04 and 12:05, reply text 12:06. Scrollback must show
    // both cards on the reply, in creation order, like the live turn.
    const messages = mergeChatHistoryRows(
      [
        [
          row({ id: "ask" }),
          row({
            id: "reply",
            role: "assistant",
            created_at: "2026-07-10T12:06:00.000Z",
          }),
        ],
      ],
      10,
    );
    const archive = archiveFromServerHistory(
      {
        messages,
        materials: [
          material({}),
          material({
            id: "10000000-0000-0000-0000-000000000002",
            title: "Mateo's Letter M Tracing v2",
            created_at: "2026-07-10T12:05:00.000Z",
          }),
        ],
      },
      undefined,
    );

    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:ask", "hist:reply"],
    );
    const reply = archive[1].message;
    assert.deepEqual(
      materialParts(reply).map((entry) => entry.title),
      ["Mateo's Letter M Tracing", "Mateo's Letter M Tracing v2"],
    );
    assert.equal(
      materialParts(reply)[0]?.previewUrl,
      "https://blob.example/preview.jpg",
    );
    // Cards render above the reply words, matching live part order.
    assert.equal(reply.parts.at(-1)?.type, "text");
  });

  it("renders an orphan material as its own message at its timestamp", () => {
    // The reply text never persisted (dead persist hook): the card must
    // still exist somewhere in scrollback.
    const messages = mergeChatHistoryRows([[row({ id: "ask" })]], 10);
    const archive = archiveFromServerHistory(
      { messages, materials: [material({})] },
      undefined,
    );
    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:ask", "mat:10000000-0000-0000-0000-000000000001"],
    );
    assert.equal(archive[1].message.role, "assistant");
    assert.equal(archive[1].at, Date.parse("2026-07-10T12:04:00.000Z"));
    assert.equal(materialParts(archive[1].message).length, 1);
  });

  it("keeps the live session's materials out of the archive", () => {
    const messages = mergeChatHistoryRows([[row({ id: "ask" })]], 10);
    const archive = archiveFromServerHistory(
      { messages, materials: [material({ session_id: "wrun_live" })] },
      "wrun_live",
    );
    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:ask"],
    );
  });
});

describe("toChatHistoryMaterial", () => {
  it("maps a full row and drops rows missing card essentials", () => {
    const mapped = toChatHistoryMaterial(materialRow({}));
    assert.equal(mapped?.sessionId, "wrun_a");
    assert.equal(mapped?.childName, "Mateo");
    assert.equal(toChatHistoryMaterial(materialRow({ session_id: null })), null);
    assert.equal(toChatHistoryMaterial(materialRow({ preview_url: null })), null);
    assert.equal(toChatHistoryMaterial(materialRow({ pdf_url: null })), null);
    assert.equal(toChatHistoryMaterial(materialRow({ created_at: "nope" })), null);
  });
});
