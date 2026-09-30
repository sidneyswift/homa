import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { chatHistoryResponse } from "./chat-history-route";
import { fetchChatHistory } from "./chat-history";

describe("history enrichment failures", () => {
  for (const failure of ["query-error", "transport-rejection"] as const) {
    it(`keeps readable history after a material ${failure}`, async () => {
      const calls: [string, string, unknown][] = [];
      const supabase = {
        from(table: string) {
          const query = {
            select() { return query; },
            eq(column: string, value: unknown) { calls.push([table, column, value]); return query; },
            order() { return query; },
            async limit() {
              if (table === "materials") {
                if (failure === "transport-rejection") throw new Error("synthetic network failure");
                return { data: null, error: { message: "synthetic material failure" } };
              }
              return { error: null, data: table === "conversation_messages" ? [{
                id: "message-one", session_id: "session-one", turn_id: "turn_0",
                role: "assistant", channel: "web", modality: "text",
                content: "Your work is here.", created_at: "2026-09-12T12:00:00Z",
              }] : [] };
            },
          };
          return query;
        },
      } as unknown as SupabaseClient;
      const history = await fetchChatHistory({ familyId: "family-one", userId: "adult-one", supabase });
      assert.equal(history?.messages[0]?.content, "Your work is here.");
      assert.equal(history?.materialsUnavailable, true);
      assert.deepEqual(history?.materials, []);
      assert(calls.some(([table, column, value]) => table === "conversation_messages" && column === "member_user_id" && value === "adult-one"));
    });
  }
});

describe("chatHistoryResponse", () => {
  it("rejects a request with no authenticated family", async () => {
    const response = await chatHistoryResponse(new Request("https://homa.test/api/chat/history"), {
      resolveFamily: async () => null,
      fetchHistory: async () => {
        throw new Error("history must not run without auth");
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { ok: false, reason: "no-session" });
  });

  it("passes server-derived family, adult, and RLS client into the shared history read", async () => {
    const supabase = { marker: "caller-jwt" } as unknown as SupabaseClient;
    let received: unknown = null;
    const response = await chatHistoryResponse(new Request("https://homa.test/api/chat/history"), {
      resolveFamily: async () => ({
        familyId: "family-authenticated",
        userId: "adult-authenticated",
        supabase,
      }),
      fetchHistory: async (input) => {
        received = input;
        return { messages: [], materials: [] };
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(received, {
      familyId: "family-authenticated",
      userId: "adult-authenticated",
      supabase,
    });
    assert.deepEqual(await response.json(), {
      ok: true,
      history: { messages: [], materials: [] },
    });
  });

  it("fails closed at the API while mobile keeps its local fallback", async () => {
    const response = await chatHistoryResponse(new Request("https://homa.test/api/chat/history"), {
      resolveFamily: async () => ({
        familyId: "family-authenticated",
        userId: "adult-authenticated",
        supabase: {} as SupabaseClient,
      }),
      fetchHistory: async () => null,
    });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { ok: false, reason: "read-failed" });
  });
});

describe("chat history completeness contract", () => {
  it("fails closed without reviving unowned legacy or companion rows", async () => {
    const source = await readFile(new URL("./chat-history.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /legacyMine|companionQuery|singleAdult/u);
    assert.match(source, /\.eq\("member_user_id", input\.userId\)/u);
    assert.match(source, /\.eq\("recipient_member_user_id", input\.userId\)/u);
    assert.match(source, /\.eq\("status", "sent"\)/u);
    assert.match(source, /if \(delivered\.error\) return null;/u);
    assert.match(source, /if \(deliveredMessages\.error\) return null;/u);
    assert.match(source, /if \(materialQuery\.error\) return \{ messages, materials: \[\], materialsUnavailable: true \};/u);
  });
});
