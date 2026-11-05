import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { deliverConversationOutbox, type PendingConversationIntent,
  type ConversationOutboxTransport, type ConversationAcceptanceReceipt } from "./conversation-outbox";

function fixture() {
  const accessEpoch = randomUUID();
  const entries: PendingConversationIntent[] = [0, 1].map(i => ({
    account: "adult-a", accessEpoch, intentId: randomUUID(), text: `Sent ${i}`, submittedAt: i,
  }));
  const sent: PendingConversationIntent[] = [];
  let account: string | null = "adult-a";
  const receipt = (entry: PendingConversationIntent): ConversationAcceptanceReceipt => ({
    intentId: entry.intentId, requestId: randomUUID(), messageId: randomUUID(),
  });
  const transport: ConversationOutboxTransport = {
    session: async () => account ? { account, accessEpoch, accessToken: "pinned-bearer" } : null,
    accept: async entry => { sent.push(entry); return { kind: "accepted", receipt: receipt(entry) }; },
  };
  const store = {
    list: async () => [...entries],
    acknowledge: async (entry: PendingConversationIntent) => { entries.splice(entries.indexOf(entry), 1); },
    reject: async (entry: PendingConversationIntent) => { entries.splice(entries.indexOf(entry), 1); },
    revoke: async (_account: string, epoch: string) => { for (let i = entries.length - 1; i >= 0; i--) if (entries[i].accessEpoch === epoch) entries.splice(i, 1); },
  };
  const controller = new AbortController();
  const run = () => deliverConversationOutbox({ account: "adult-a", currentAccount: () => account,
    transport, store, signal: controller.signal });
  return { entries, sent, receipt, transport, store, controller, run,
    switchAccount(next: string | null) { account = next; } };
}

test("lost server confirmation retries the same intent before later messages", async () => {
  const f = fixture();
  const original = f.entries[0];
  let lost = true;
  f.transport.accept = async entry => {
    f.sent.push(entry);
    if (lost) { lost = false; throw new Error("Server committed; connection disappeared"); }
    return { kind: "accepted", receipt: f.receipt(entry) };
  };
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "network" });
  assert.equal(f.entries.length, 2);
  assert.deepEqual(await f.run(), { kind: "snapshot_drained", delivered: 2, rejected: 0 });
  assert.equal(f.sent[0].intentId, original.intentId);
  assert.equal(f.sent[1].intentId, original.intentId);
  assert.notEqual(f.sent[2].intentId, original.intentId);
});

test("account changes during authentication cannot send another adult's queue", async () => {
  const f = fixture();
  f.transport.session = async () => { f.switchAccount("adult-b"); return { account: "adult-b", accessEpoch: randomUUID(), accessToken: "other-bearer" }; };
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "account_changed" });
  assert.equal(f.sent.length, 0);
  assert.equal(f.entries.length, 2);
});

test("account changes after acceptance acknowledge only the old intent and stop", async () => {
  const f = fixture();
  f.transport.accept = async (entry, bearer) => {
    assert.equal(bearer, "pinned-bearer");
    f.switchAccount("adult-b");
    return { kind: "accepted", receipt: f.receipt(entry) };
  };
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 1, reason: "account_changed" });
  assert.equal(f.entries.length, 1);
});

test("a missing acknowledgement or mismatched receipt never discards pending words", async () => {
  const f = fixture();
  f.transport.accept = async entry => ({ kind: "accepted", receipt: { ...f.receipt(entry), intentId: randomUUID() } });
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "invalid_receipt" });
  assert.equal(f.entries.length, 2);
  f.transport.accept = async entry => ({ kind: "accepted", receipt: f.receipt(entry) });
  f.store.acknowledge = async () => { throw new Error("Device disk failure"); };
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "storage" });
  assert.equal(f.entries.length, 2);
});

test("permanent rejection preserves a failure and lets later valid messages through", async () => {
  for (const kind of ["deleted", "conflict", "rejected"] as const) {
    const f = fixture();
    const firstId = f.entries[0].intentId;
    f.transport.accept = async entry => entry.intentId === firstId ? { kind }
      : { kind: "accepted", receipt: f.receipt(entry) };
    assert.deepEqual(await f.run(), { kind: "snapshot_drained", delivered: 1, rejected: 1 });
    assert.equal(f.entries.length, 0);
  }
});

test("sign-in failure preserves ordering for a later authenticated pass", async () => {
  const f = fixture();
  f.transport.accept = async () => ({ kind: "sign_in" });
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "sign_in" });
  assert.equal(f.entries.length, 2);
});

test("aborted delivery leaves pending intents intact", async () => {
  const f = fixture();
  f.controller.abort();
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "aborted" });
  assert.equal(f.sent.length, 0);
});

test("rejoining with a new access generation cannot resend the old queue", async () => {
  const f = fixture();
  f.transport.session = async () => ({ account: "adult-a", accessEpoch: randomUUID(), accessToken: "new-access" });
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "access_changed" });
  assert.equal(f.sent.length, 0);
  assert.equal(f.entries.length, 0);
});

test("malformed access information never destroys pending messages", async () => {
  const f = fixture();
  f.transport.session = async () => ({ account: "adult-a", accessEpoch: "", accessToken: "valid-token" });
  assert.deepEqual(await f.run(), { kind: "paused", delivered: 0, reason: "invalid_session" });
  assert.equal(f.entries.length, 2);
  assert.equal(f.sent.length, 0);
});

test("a bounded pass does not mistake a concurrent enqueue for an empty queue", async () => {
  const f = fixture();
  const queued = { ...f.entries[0], intentId: randomUUID(), text: "Sent during acceptance" };
  let added = false;
  f.transport.accept = async entry => {
    if (!added) { added = true; f.entries.push(queued); }
    return { kind: "accepted", receipt: f.receipt(entry) };
  };
  assert.deepEqual(await f.run(), { kind: "snapshot_drained", delivered: 2, rejected: 0 });
  assert.deepEqual(f.entries, [queued]);
  assert.deepEqual(await f.run(), { kind: "snapshot_drained", delivered: 1, rejected: 0 });
});

test("pending files finish before first admission and acknowledgement uses frozen receipts", async () => {
  const f=fixture();f.entries.splice(1);f.entries[0].text="";f.entries[0].stagedAttachmentIds=[randomUUID()];
  const original=f.entries[0],receiptIds=[randomUUID()];let retry=true;
  Object.assign(f.store,{prepare:async(entry:PendingConversationIntent,token:string)=>{
    assert.equal(token,"pinned-bearer");assert.equal(entry.intentId,original.intentId);
    if(retry){retry=false;throw new Error("Offline file");}
    return {...entry,attachmentIds:receiptIds};
  }});
  f.store.acknowledge=async entry=>{assert.deepEqual(entry.attachmentIds,receiptIds);f.entries.splice(0);};
  assert.deepEqual(await f.run(),{kind:"paused",delivered:0,reason:"network"});assert.equal(f.sent.length,0);
  assert.deepEqual(await f.run(),{kind:"snapshot_drained",delivered:1,rejected:0});
  assert.equal(f.sent[0].intentId,original.intentId);assert.deepEqual(f.sent[0].attachmentIds,receiptIds);
});

test("switching adults during file preparation cannot submit the finished upload", async()=>{
  const f=fixture();f.entries[0].stagedAttachmentIds=[randomUUID()];
  Object.assign(f.store,{prepare:async(entry:PendingConversationIntent)=>{
    f.switchAccount("adult-b");return {...entry,attachmentIds:[randomUUID()]};
  }});
  assert.deepEqual(await f.run(),{kind:"paused",delivered:0,reason:"account_changed"});assert.equal(f.sent.length,0);
});
