import assert from "node:assert/strict";
import { test } from "node:test";
import { EveAgentStore, defaultMessageReducer, type ClientSession } from "eve/client";

import type { PreparedAttachmentSend, StagedAttachment } from "../app/chat-attachments";
import { sendWorkspaceMessage, submitWorkspaceDraft, type WorkspaceAttachmentCache } from "./workspace-send";

test("Send clears the composer synchronously while Homa's response is pending", async () => {
  let draft = "Make a worksheet";
  let finish!: (accepted: boolean) => void;
  const response = new Promise<boolean>(resolve => { finish = resolve; });
  const submitted = submitWorkspaceDraft({ text: draft,
    setDraft: value => { draft = typeof value === "function" ? value(draft) : value; },
    send: () => { assert.equal(draft, ""); return response; },
  });
  assert.equal(draft, "");
  draft = "My next message";
  finish(true);
  assert.equal(await submitted, true);
  assert.equal(draft, "My next message");
});

test("rejected delivery restores an empty composer but never overwrites a newer draft", async () => {
  for (const nextDraft of ["", "Another thought"]) {
    let draft = "Make a worksheet";
    const submitted = submitWorkspaceDraft({ text: draft,
      setDraft: value => { draft = typeof value === "function" ? value(draft) : value; },
      send: async () => false,
    });
    draft = nextDraft;
    assert.equal(await submitted, false);
    assert.equal(draft, nextDraft || "Make a worksheet");
  }
});

test("unexpected delivery errors also retain the submitted draft", async () => {
  let draft = "Make a worksheet";
  await assert.rejects(submitWorkspaceDraft({ text: draft,
    setDraft: value => { draft = typeof value === "function" ? value(draft) : value; },
    send: async () => { throw new Error("Disconnected"); },
  }), /Disconnected/);
  assert.equal(draft, "Make a worksheet");
});

test("the real Eve client displays the message before a delayed server accepts it", async () => {
  let rejectDelivery!: (error: Error) => void;
  const delivery = new Promise<never>((_, reject) => { rejectDelivery = reject; });
  const store = new EveAgentStore({ reducer: defaultMessageReducer(), session: {
    state: {}, send: () => delivery,
  } as unknown as ClientSession });
  let draft = "Make a worksheet";
  const submitted = submitWorkspaceDraft({ text: draft,
    setDraft: value => { draft = typeof value === "function" ? value(draft) : value; },
    send: async () => { await store.send({ message: "Make a worksheet" }); return !store.snapshot.error; },
  });
  await Promise.resolve();
  assert.equal(draft, "");
  assert.equal(store.snapshot.data.messages.length, 1);
  assert.equal(store.snapshot.data.messages[0].role, "user");
  assert.deepEqual(store.snapshot.data.messages[0].parts.map(part => part.type === "text" ? part.text : ""), ["Make a worksheet"]);
  rejectDelivery(new Error("Offline"));
  assert.equal(await submitted, false);
  assert.equal(draft, "Make a worksheet");
  assert.equal(store.snapshot.data.messages[0].metadata?.status, "failed");
});

const file: StagedAttachment = { localId: "test-file", name: "worksheet.pdf", mediaType: "application/pdf", previewUrl: null, status: "ready", blobUrl: "https://example.test/worksheet.pdf" };
const prepared: PreparedAttachmentSend = {
  textBlocks: ["Attached worksheet"], receipts: [],
  parts: [{ type: "image", image: "data:image/png;base64,cGlj" }, { type: "file", data: "data:application/pdf;base64,cGRm", mediaType: "application/pdf", filename: "worksheet.pdf" }],
};

test("an attachment-only turn carries all prepared image and file content", async () => {
  let accepted = false;
  const result = await sendWorkspaceMessage({
    text: "", staged: [file], cache: { current: null }, prepare: async () => prepared,
    dispatch: async message => {
      assert.deepEqual(message, [{ type: "text", text: "Attached worksheet" }, ...prepared.parts]);
      accepted = true;
    }, isAccepted: () => accepted,
  });
  assert.equal(result.accepted, true);
});

test("rejected sends reuse prepared attachments when retried", async () => {
  const cache: WorkspaceAttachmentCache = { current: null };
  let preparations = 0;
  const input = { text: "Read this", staged: [file], cache, prepare: async () => { preparations++; return prepared; }, isAccepted: () => false, dispatch: async () => { throw new Error("offline"); } };
  assert.equal((await sendWorkspaceMessage(input)).accepted, false);
  assert.equal((await sendWorkspaceMessage(input)).accepted, false);
  assert.equal(preparations, 1);
  assert.deepEqual(input.staged, [file]);
});

test("a lost reply after acceptance must not offer to resend the files", async () => {
  let accepted = false;
  const result = await sendWorkspaceMessage({
    text: "Read this", staged: [file], cache: { current: null }, prepare: async () => prepared,
    dispatch: async () => { accepted = true; throw new Error("reply disconnected"); }, isAccepted: () => accepted,
  });
  assert.equal(result.accepted, true);
  assert.match(result.error ?? "", /message reached Homa/);
  assert.doesNotMatch(result.error ?? "", /Try again/);
});

test("unfinished, failed, and oversized selections never prepare or send", async () => {
  for (const staged of [[{ ...file, status: "uploading" as const }], [{ ...file, status: "failed" as const }], Array.from({ length: 7 }, () => file)]) {
    const result = await sendWorkspaceMessage({ text: "", staged, cache: { current: null }, prepare: async () => { assert.fail("must not prepare"); }, dispatch: async () => { assert.fail("must not send"); }, isAccepted: () => false });
    assert.equal(result.accepted, false);
    assert.ok(result.error);
  }
});
