import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EveMessage, HandleMessageStreamEvent } from "eve/client";

import {
  adoptServerBoundSession,
  fetchMobileChatHistory,
  hydratePreparedChatWithServerHistory,
  projectServerChatHistory,
  type MobileChatHistoryPayload,
} from "./chat-history";
import type { PreparedChat } from "./chat-storage";

const payload = (overrides: Partial<MobileChatHistoryPayload> = {}): MobileChatHistoryPayload => ({
  messages: [
    {
      id: "db-user",
      sessionId: "session-one",
      turnId: "turn_1",
      role: "user",
      channel: "web",
      modality: "text",
      content: "Help me plan today.",
      atMs: 100,
    },
    {
      id: "db-assistant",
      sessionId: "session-one",
      turnId: "turn_1",
      role: "assistant",
      channel: "web",
      modality: "text",
      content: "Let us start with ten minutes of reading.",
      atMs: 110,
    },
  ],
  materials: [],
  ...overrides,
});

const prepared = (overrides: Partial<PreparedChat> = {}): PreparedChat => ({
  archived: [],
  initialEvents: [],
  initialSession: undefined,
  messageTimes: {},
  lastActivityAt: undefined,
  rotated: false,
  ...overrides,
});

describe("projectServerChatHistory", () => {
  it("deduplicates only the exact live turn and role", () => {
    const live: EveMessage[] = [
      {
        id: "turn_1:user",
        role: "user",
        parts: [{ type: "text", text: "Help me plan today." }],
      },
    ];
    const archive = projectServerChatHistory(payload(), live);

    assert.deepEqual(
      archive.map((entry) => entry.message.id),
      ["hist:db-assistant"],
    );
  });

  it("rebuilds a durable material card and removes a matching live card", () => {
    const history = payload({
      materials: [
        {
          id: "material-one",
          sessionId: "session-one",
          title: "Reading warm-up",
          kind: "worksheet",
          skill: "materials-studio",
          childName: "Maya",
          previewUrl: "https://files.test/preview.png",
          pdfUrl: "https://files.test/material.pdf",
          pageCount: 1,
          pagePreviewUrls: null,
          sources: [],
          status: "final",
          revisesId: null,
          reviewPass: true,
          atMs: 105,
        },
      ],
    });
    const archive = projectServerChatHistory(history, []);
    const assistant = archive.find((entry) => entry.message.id === "hist:db-assistant");
    assert.equal(assistant?.message.parts[0]?.type, "dynamic-tool");

    const live: EveMessage[] = [
      {
        id: "turn_live:assistant",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            state: "output-available",
            toolName: "create_printable",
            output: { material: { id: "material-one" } },
          },
        ],
      } as EveMessage,
    ];
    const deduped = projectServerChatHistory(history, live);
    const dedupedAssistant = deduped.find(
      (entry) => entry.message.id === "hist:db-assistant",
    );
    assert.equal(dedupedAssistant?.message.parts[0]?.type, "text");
  });
});

describe("hydratePreparedChatWithServerHistory", () => {
  it("makes durable server rows the archive on a fresh install", () => {
    const hydrated = hydratePreparedChatWithServerHistory(prepared(), payload());
    assert.deepEqual(
      hydrated.archived.map((entry) => entry.message.id),
      ["hist:db-user", "hist:db-assistant"],
    );
  });

  it("archives an unmatched sessionless turn instead of erasing its only copy", () => {
    const deadEvents = [
      {
        type: "turn.started",
        data: { sequence: 0, turnId: "turn_unmatched" },
      },
      {
        type: "message.received",
        data: {
          message: "This turn has not reached durable history yet.",
          sequence: 1,
          turnId: "turn_unmatched",
        },
      },
    ] as HandleMessageStreamEvent[];
    const hydrated = hydratePreparedChatWithServerHistory(
      prepared({
        archived: [
          {
            at: 1,
            message: {
              id: "local-only",
              role: "user",
              parts: [{ type: "text", text: "duplicate local cache" }],
            },
          },
        ],
        initialEvents: deadEvents,
        messageTimes: { "turn_unmatched:user": 120 },
      }),
      payload(),
    );

    assert.equal(hydrated.initialEvents.length, 0);
    assert.deepEqual(hydrated.messageTimes, {});
    assert.equal(hydrated.archived.some((entry) => entry.message.id === "local-only"), false);
    assert.equal(
      hydrated.archived.some((entry) => entry.message.id === "turn_unmatched:user"),
      true,
    );
  });
});

describe("adoptServerBoundSession", () => {
  it("preserves only sessionless messages absent from authenticated replay", () => {
    const localEvents = [
      {
        type: "turn.started",
        data: { sequence: 0, turnId: "turn_unmatched" },
      },
      {
        type: "message.received",
        data: { message: "Keep this.", sequence: 1, turnId: "turn_unmatched" },
      },
    ] as HandleMessageStreamEvent[];
    const restored = adoptServerBoundSession(
      prepared({
        initialEvents: localEvents,
        messageTimes: { "turn_unmatched:user": 120 },
      }),
      [],
      undefined,
    );

    assert.equal(restored.initialEvents.length, 0);
    assert.deepEqual(restored.messageTimes, {});
    assert.equal(
      restored.archived.some((entry) => entry.message.id === "turn_unmatched:user"),
      true,
    );
  });

  it("keeps replayed messages live instead of duplicating their archive rows", () => {
    const replayed = [
      {
        type: "turn.started",
        data: { sequence: 0, turnId: "turn_1" },
      },
      {
        type: "message.received",
        data: { message: "Help me plan today.", sequence: 1, turnId: "turn_1" },
      },
    ] as HandleMessageStreamEvent[];
    const serverFirst = hydratePreparedChatWithServerHistory(prepared(), payload());
    const adopted = adoptServerBoundSession(
      serverFirst,
      replayed,
      { sessionId: "session-one", streamIndex: replayed.length },
    );
    const reconciled = hydratePreparedChatWithServerHistory(adopted, payload());

    assert.equal(
      reconciled.archived.some((entry) => entry.message.id === "hist:db-user"),
      false,
    );
    assert.equal(
      reconciled.archived.some((entry) => entry.message.id === "hist:db-assistant"),
      true,
    );
    assert.equal(reconciled.initialEvents, replayed);
  });
});

describe("fetchMobileChatHistory", () => {
  it("uses bearer auth and returns null on a server failure so local chat survives", async () => {
    let authorization: string | null = null;
    const request = async (_input: string | URL | Request, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get("authorization");
      return new Response(JSON.stringify({ ok: false }), { status: 503 });
    };

    const history = await fetchMobileChatHistory("access-token", {
      apiOrigin: "https://homa.test",
      request,
    });
    assert.equal(authorization, "Bearer access-token");
    assert.equal(history, null);
  });

  it("bounds a hanging history request", async () => {
    const request = async (_input: string | URL | Request, init?: RequestInit) =>
      await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });

    const history = await fetchMobileChatHistory("access-token", {
      apiOrigin: "https://homa.test",
      request,
      timeoutMs: 5,
    });
    assert.equal(history, null);
  });

  it("makes reconstructed Library links absolute for React Native", () => {
    const history = payload({
      materials: [
        {
          id: "material-one",
          sessionId: "session-one",
          title: "Reading warm-up",
          kind: "worksheet",
          skill: "materials-studio",
          childName: "Maya",
          previewUrl: "https://files.test/preview.png",
          pdfUrl: "https://files.test/material.pdf",
          pageCount: 1,
          pagePreviewUrls: null,
          sources: [
            {
              id: "source-one",
              title: "Maya's reader",
              libraryUrl: "/app/library?asset=source-one",
            },
          ],
          status: "final",
          revisesId: null,
          reviewPass: true,
          atMs: 105,
        },
      ],
    });
    const archive = projectServerChatHistory(history, [], {
      apiOrigin: "https://thankshoma.com",
    });
    const assistant = archive.find((entry) => entry.message.id === "hist:db-assistant");
    const part = assistant?.message.parts[0];
    assert.equal(part?.type, "dynamic-tool");
    const sources = part?.type === "dynamic-tool"
      ? (part.output as { material?: { sources?: { libraryUrl: string }[] } })
        .material?.sources
      : null;
    assert.equal(
      sources?.[0]?.libraryUrl,
      "https://thankshoma.com/app/library?asset=source-one",
    );
  });
});
