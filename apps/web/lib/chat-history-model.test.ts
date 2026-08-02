import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage } from "eve/client";

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
    turn_id: null,
    role: "user",
    channel: "web",
    content: "hello",
    created_at: "2026-07-10T12:00:00.000Z",
    ...overrides,
  };
}

function liveMessage(
  turnId: string,
  role: "user" | "assistant",
  parts: EveMessage["parts"] = [{ type: "text", text: "hello" }],
): EveMessage {
  return {
    id: `${turnId}:${role}`,
    role,
    parts,
  } as EveMessage;
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
    status: "draft",
    revises: null,
    review_pass: "true",
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
}): {
  id?: string;
  title?: string;
  previewUrl?: string;
  revisesId?: string | null;
  reviewPassed?: boolean | null;
}[] {
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
  it("keeps persisted current-session work unless the live reducer has that exact turn", () => {
    const history = mergeChatHistoryRows(
      [
        [
          row({ id: "past", session_id: "wrun_past" }),
          row({
            id: "represented",
            session_id: "wrun_live",
            turn_id: "turn-represented",
            created_at: "2026-07-10T13:00:00.000Z",
          }),
          row({
            id: "missing",
            session_id: "wrun_live",
            turn_id: "turn-missing",
            created_at: "2026-07-10T13:01:00.000Z",
          }),
        ],
      ],
      10,
    );
    const archive = archiveFromServerHistory(
      { messages: history, materials: [] },
      [liveMessage("turn-represented", "user")],
    );
    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:past", "hist:missing"],
    );
    assert.equal(archive[0].channel, "web");
    assert.equal(archive[0].at, Date.parse("2026-07-10T12:00:00.000Z"));
    const part = archive[0].message.parts[0];
    assert.equal(part.type === "text" ? part.text : null, "hello");
  });

  it("attaches only the latest passing revision to the session's reply", () => {
    // The newer attempt failed review, so scrollback keeps the earlier
    // passing card and still places it above the reply text.
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
            revises: "10000000-0000-0000-0000-000000000001",
            review_pass: "false",
          }),
        ],
      },
      [],
    );

    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:ask", "hist:reply"],
    );
    const reply = archive[1].message;
    assert.deepEqual(
      materialParts(reply).map((entry) => entry.title),
      ["Mateo's Letter M Tracing"],
    );
    assert.equal(
      materialParts(reply)[0]?.previewUrl,
      "https://blob.example/preview.jpg",
    );
    assert.deepEqual(materialParts(reply)[0], {
      id: "10000000-0000-0000-0000-000000000001",
      title: "Mateo's Letter M Tracing",
      previewUrl: "https://blob.example/preview.jpg",
      revisesId: null,
      reviewPassed: true,
      kind: "worksheet",
      skill: "letter M tracing",
      childName: "Mateo",
      pdfUrl: "https://blob.example/page.pdf",
      pageCount: 1,
      sources: [],
      status: "draft",
    });
    // Cards render above the reply words, matching live part order.
    assert.equal(reply.parts.at(-1)?.type, "text");
  });

  it("renders an orphan material as its own message at its timestamp", () => {
    // The reply text never persisted (dead persist hook): the card must
    // still exist somewhere in scrollback.
    const messages = mergeChatHistoryRows([[row({ id: "ask" })]], 10);
    const archive = archiveFromServerHistory(
      { messages, materials: [material({})] },
      [],
    );
    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:ask", "mat:10000000-0000-0000-0000-000000000001"],
    );
    assert.equal(archive[1].message.role, "assistant");
    assert.equal(archive[1].at, Date.parse("2026-07-10T12:04:00.000Z"));
    assert.equal(materialParts(archive[1].message).length, 1);
  });

  it("keeps current-session materials unless the live reducer has that exact card", () => {
    const messages = mergeChatHistoryRows([[row({ id: "ask" })]], 10);
    const represented = material({
      id: "10000000-0000-0000-0000-000000000002",
      session_id: "wrun_live",
      created_at: "2026-07-10T12:05:00.000Z",
    });
    const missing = material({
      id: "10000000-0000-0000-0000-000000000003",
      session_id: "wrun_live",
      created_at: "2026-07-10T12:06:00.000Z",
    });
    const archive = archiveFromServerHistory(
      { messages, materials: [represented, missing] },
      [
        liveMessage("turn-card", "assistant", [
          {
            type: "dynamic-tool",
            state: "output-available",
            toolCallId: "tool-represented",
            toolName: "create_printable",
            input: {},
            output: { material: { id: represented.id } },
          },
        ] as EveMessage["parts"]),
      ],
    );
    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:ask", `mat:${missing.id}`],
    );
  });
});

describe("toChatHistoryMaterial", () => {
  it("maps a full row and drops rows missing card essentials", () => {
    const mapped = toChatHistoryMaterial(materialRow({}));
    assert.equal(mapped?.sessionId, "wrun_a");
    assert.equal(mapped?.childName, "Mateo");
    assert.equal(mapped?.status, "draft");
    assert.equal(mapped?.revisesId, null);
    assert.equal(mapped?.reviewPass, true);
    assert.equal(
      toChatHistoryMaterial(materialRow({ review_pass: "false" }))
        ?.reviewPass,
      false,
    );
    assert.equal(
      toChatHistoryMaterial(materialRow({ review_pass: null }))?.reviewPass,
      null,
    );
    assert.equal(toChatHistoryMaterial(materialRow({ session_id: null })), null);
    assert.equal(toChatHistoryMaterial(materialRow({ preview_url: null })), null);
    assert.equal(toChatHistoryMaterial(materialRow({ pdf_url: null })), null);
    assert.equal(toChatHistoryMaterial(materialRow({ created_at: "nope" })), null);
  });

  it("legacy single-page rows default to one page with no page previews", () => {
    const mapped = toChatHistoryMaterial(materialRow({}));
    assert.equal(mapped?.pageCount, 1);
    assert.equal(mapped?.pagePreviewUrls, null);
  });

  it("packet rows carry their page count and per-page previews", () => {
    const mapped = toChatHistoryMaterial(
      materialRow({
        page_count: 4,
        page_preview_urls: [
          "https://blob.example/p1.jpg",
          "https://blob.example/p2.jpg",
          "https://blob.example/p3.jpg",
          "https://blob.example/p4.jpg",
        ],
      }),
    );
    assert.equal(mapped?.pageCount, 4);
    assert.equal(mapped?.pagePreviewUrls?.length, 4);
  });

  it("rebuilds Family Library source links from verified snapshots", () => {
    const mapped = toChatHistoryMaterial(
      materialRow({
        family_sources: [
          {
            id: "20000000-0000-4000-8000-000000000001",
            title: "Forest habitats workbook",
          },
        ],
      }),
    );
    assert.deepEqual(mapped?.sources, [
      {
        id: "20000000-0000-4000-8000-000000000001",
        title: "Forest habitats workbook",
        libraryUrl:
          "/app/library?asset=20000000-0000-4000-8000-000000000001",
      },
    ]);
  });
});

describe("packet cards in scrollback", () => {
  it("rebuilt create_printable parts carry pageCount and pagePreviewUrls", () => {
    const messages = mergeChatHistoryRows([[row({ id: "ask" })]], 10);
    const archive = archiveFromServerHistory(
      {
        messages,
        materials: [
          material({
            page_count: 4,
            page_preview_urls: [
              "https://blob.example/p1.jpg",
              "https://blob.example/p2.jpg",
              "https://blob.example/p3.jpg",
              "https://blob.example/p4.jpg",
            ],
          }),
        ],
      },
      [],
    );
    const part = archive[1].message.parts[0] as {
      output: { material: { pageCount?: number; pagePreviewUrls?: string[] } };
    };
    assert.equal(part.output.material.pageCount, 4);
    assert.equal(part.output.material.pagePreviewUrls?.length, 4);
  });
});
