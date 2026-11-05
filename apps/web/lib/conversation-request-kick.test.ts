import assert from "node:assert/strict";
import { test } from "node:test";

import { conversationWorkerUrl, kickConversationRequests } from "./conversation-request-kick";

test("deployment wake-up uses this deployment, never a public site or local override", () => {
  assert.equal(conversationWorkerUrl({ VERCEL: "1", VERCEL_URL: "this-preview.vercel.app",
    NEXT_PUBLIC_SITE_URL: "https://production.example", HOMA_CONVERSATION_WORKER_ORIGIN: "http://localhost:3002" })?.href,
  "https://this-preview.vercel.app/eve/v1/conversation-request/run-now");
  assert.equal(conversationWorkerUrl({ VERCEL: "1", NEXT_PUBLIC_SITE_URL: "https://production.example" }), null);
});

test("local development only wakes an explicitly configured loopback worker", () => {
  assert.equal(conversationWorkerUrl({ HOMA_CONVERSATION_WORKER_ORIGIN: "http://127.0.0.1:3002" })?.port, "3002");
  for (const origin of ["https://production.example", "http://evil.example", "http://user:secret@localhost", "http://localhost/path", "http://localhost?url=x"])
    assert.equal(conversationWorkerUrl({ HOMA_CONVERSATION_WORKER_ORIGIN: origin }), null);
});

test("disabled or unconfigured wake-up never sends a credential", async () => {
  for (const env of [{}, { HOMA_CONVERSATION_REQUESTS: "1", CRON_SECRET: "synthetic-secret" }]) {
    assert.equal(await kickConversationRequests(env, async () => assert.fail("must not fetch")), false);
  }
});

test("wake-up bounds its wait, refuses redirects, and tolerates failed acknowledgements", async () => {
  const env = { HOMA_CONVERSATION_REQUESTS: "1", CRON_SECRET: "synthetic-secret", HOMA_CONVERSATION_WORKER_ORIGIN: "http://localhost:3002" };
  assert.equal(await kickConversationRequests(env, async (_url, options) => {
    assert.equal(options?.headers && new Headers(options.headers).get("authorization"), "Bearer synthetic-secret");
    assert.equal(options?.redirect, "error"); assert(options?.signal);
    return new Response(null, { status: 200 });
  }), true);
  assert.equal(await kickConversationRequests(env, async () => { throw new Error("lost wake-up"); }), false);
  assert.equal(await kickConversationRequests(env, async () => new Response(null, { status: 503 })), false);
});
