import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { conversationRequestResponse, type ConversationRequestRouteDependencies } from "../../lib/conversation-request-route";
import { createConversationHttpTransport } from "./conversation-http-transport";
import { deliverConversationOutbox, type PendingConversationIntent } from "./conversation-outbox";

const account = `${randomUUID()}:${randomUUID()}`, accessEpoch = randomUUID();
const entry: PendingConversationIntent = { account, accessEpoch, intentId: randomUUID(), text: "Exact \n text", submittedAt: 1 };
const receipt = { intentId: entry.intentId, requestId: randomUUID(), messageId: randomUUID() };
const signal = new AbortController().signal;

test("HTTP sender pins bearer, omits cookies and refuses redirects", async () => {
  const seen: RequestInit[] = [];
  const transport = createConversationHttpTransport({ signal, accessToken: async () => "first-adult",
    fetch: async (_url, init) => {
      seen.push(init!);
      return Response.json(init?.method === "POST" ? { receipt } : {
        account, accessEpoch, conversationId: randomUUID(),
      }, { status: init?.method === "POST" ? 202 : 200 });
    },
  });
  const session = await transport.session();
  assert.equal(session?.accessToken, "first-adult");
  assert.deepEqual(await transport.accept(entry, session!.accessToken, signal), { kind: "accepted", receipt });
  for (const init of seen) {
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer first-adult");
    assert.equal(init.credentials, "omit"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store");
  }
  assert.deepEqual(JSON.parse(seen[1].body as string), {
    account, accessEpoch, intentId: entry.intentId, text: entry.text,
  });
});

test("HTTP errors never turn an ambiguous or changed-account result into deletion", async () => {
  const cases = [
    [503, { reason: "retry" }, "retry"], [429, {}, "retry"],
    [409, { reason: "account_changed" }, "retry"], [409, { reason: "access_changed" }, "retry"],
    [403, { reason: "membership" }, "retry"], [200, { receipt: { ...receipt, intentId: randomUUID() } }, "retry"],
    [401, {}, "sign_in"], [409, { reason: "conflict" }, "conflict"],
    [410, { reason: "deleted" }, "deleted"], [400, { reason: "invalid" }, "rejected"],
  ] as const;
  for (const [status, body, expected] of cases) {
    const transport = createConversationHttpTransport({ signal, accessToken: async () => "token",
      fetch: async () => Response.json(body, { status }),
    });
    assert.deepEqual(await transport.accept(entry, "token", signal), { kind: expected });
  }
});

test("malformed access metadata cannot authorize or purge queued work", async () => {
  const transport = createConversationHttpTransport({ signal, accessToken: async () => "token",
    fetch: async () => Response.json({ account, accessEpoch: "bad", conversationId: randomUUID() }),
  });
  await assert.rejects(transport.session(), /Invalid conversation access/);
});

test("lost HTTP receipt retries the same committed intent through the real handler", async () => {
  const [familyId, memberUserId] = account.split(":");
  const persisted = new Map<string, typeof receipt>();
  const attempts: string[] = [];
  let loseReceipt = true;
  const dependencies: ConversationRequestRouteDependencies = {
    enabled: () => true, limited: () => false, principal: async request => {
      assert.equal(request.headers.get("authorization"), "Bearer original-adult");
      return { familyId, memberUserId };
    },
    access: async () => ({ conversationId: randomUUID(), accessEpoch }),
    receipt: async () => null,
    answer: async () => { throw new Error("Unexpected question answer"); },
    questions: async () => [],
    accept: async (_p, input) => {
      attempts.push(input.intentId);
      assert.equal(input.text, entry.text);
      const replayed = persisted.has(input.intentId);
      persisted.set(input.intentId, receipt);
      return { ...receipt, state: "queued", acceptedAt: new Date().toISOString(), replayed };
    },
  };
  const transport = createConversationHttpTransport({ signal, accessToken: async () => "original-adult",
    fetch: async (url, init) => {
      const response = await conversationRequestResponse(new Request(`https://homa.test${url}`, init), dependencies);
      if (init?.method === "POST" && loseReceipt) { loseReceipt = false; throw new Error("connection lost after commit"); }
      return response;
    },
  });
  const pending = [entry];
  const input = { account, currentAccount: () => account, transport, signal, store: {
    list: async () => [...pending], revoke: async () => { throw new Error("must not purge"); },
    reject: async () => { throw new Error("must not reject"); },
    acknowledge: async () => { pending.splice(0, 1); },
  } };
  assert.equal((await deliverConversationOutbox(input)).kind, "paused");
  assert.equal(persisted.size, 1); assert.equal(pending.length, 1);
  assert.deepEqual(await deliverConversationOutbox(input), { kind: "snapshot_drained", delivered: 1, rejected: 0 });
  assert.equal(persisted.size, 1); assert.equal(pending.length, 0);
  assert.deepEqual(attempts, [entry.intentId, entry.intentId]);
});


test("attachment receipts survive automatic delivery without sending browser file URLs", async () => {
  const attachmentIds=[randomUUID(),randomUUID()];
  const pending={...entry,text:"",attachmentIds};
  const transport=createConversationHttpTransport({accessToken:async()=>"exact-token",signal,fetch:async(_url,options)=>{
    assert.deepEqual(JSON.parse(String(options?.body)),{account,accessEpoch,intentId:entry.intentId,text:"",attachmentIds});
    return Response.json({receipt},{status:202});
  }});
  assert.deepEqual(await transport.accept(pending,"exact-token",signal),{kind:"accepted",receipt});
});

test("native response uses immutable choice IDs and never submits a chat prompt", async () => {
  const nativeEntry = { ...entry, nativeInput: { batchId: randomUUID(), responses: [{ requestId: "approval", optionId: "deny" }] } };
  const transport = createConversationHttpTransport({ signal, accessToken: async () => "token",
    fetch: async (url, init) => {
      assert.equal(url, "/api/conversation/native-input");
      assert.deepEqual(JSON.parse(init!.body as string), { account, accessEpoch, intentId: entry.intentId, ...nativeEntry.nativeInput });
      assert.equal(new Headers(init!.headers).get("authorization"), "Bearer token");
      return Response.json({ receipt }, { status: 202 });
    },
  });
  assert.deepEqual(await transport.accept(nativeEntry, "token", signal), { kind: "accepted", receipt });
});
