import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { chatHistoryResponse } from "./chat-history-route";

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
  it("rejects every partial query before mobile replaces local scrollback", async () => {
    const source = await readFile(new URL("./chat-history.ts", import.meta.url), "utf8");
    assert.match(source, /if \(legacy\.error\) return null;/u);
    assert.match(source, /if \(companionQuery\.error\) return null;/u);
    assert.match(source, /if \(delivered\.error\) return null;/u);
    assert.match(source, /if \(deliveredMessages\.error\) return null;/u);
    assert.match(source, /if \(materialQuery\.error\) return null;/u);
  });
});
