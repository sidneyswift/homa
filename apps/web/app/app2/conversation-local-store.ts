import { normalizeQuestionAnswer } from "../../lib/conversation-question-answer";
import { sameConversationIntentContent, validAcceptanceReceipt, type PendingConversationIntent,
  type ConversationAcceptanceReceipt } from "./conversation-outbox";

/** Device storage is never a server-save acknowledgement. */
const DATABASE = "homa-conversation-v2";
let database: Promise<IDBDatabase> | undefined;
const accountGenerations = new Map<string,number>();
export const conversationDeviceAccountGeneration = (account:string) => accountGenerations.get(account) ?? 0;

export function openConversationDeviceDatabase() {
  if (database) return database;
  database = new Promise<IDBDatabase>((resolve, reject) => {
    let abandoned = false;
    const request = indexedDB.open(DATABASE, 5);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("access")) request.result.createObjectStore("access");
      if (!request.result.objectStoreNames.contains("drafts")) request.result.createObjectStore("drafts");
      if (!request.result.objectStoreNames.contains("outbox")) {
        const outbox = request.result.createObjectStore("outbox", { keyPath: ["account", "intentId"] });
        outbox.createIndex("account", "account");
      }
      if (!request.result.objectStoreNames.contains("attachments")) {
        const attachments = request.result.createObjectStore("attachments", { keyPath: ["account", "id"] });
        attachments.createIndex("account", "account");
      }
      if (!request.result.objectStoreNames.contains("outbox-order")) request.result.createObjectStore("outbox-order");
    };
    request.onsuccess = () => {
      if (abandoned) { request.result.close(); return; }
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
    request.onerror = () => { database = undefined; reject(request.error); };
    request.onblocked = () => { abandoned = true; database = undefined; reject(new Error("Draft storage is blocked")); };
  });
  return database;
}

/** Commit an explicit Send before clearing its matching draft. If the draft
 * changed in another tab, preserve it. Reusing an intent with new words fails. */
export async function queueConversationIntent(entry: PendingConversationIntent, draftRevision?: string | null): Promise<void> {
  const generation = conversationDeviceAccountGeneration(entry.account);
  if (entry.nativeInput) {
    const { batchId, responses } = entry.nativeInput;
    if (!/^[a-f0-9-]{36}$/iu.test(batchId) || entry.questionAnswer || entry.replyToQuestionId ||
        entry.attachmentIds?.length || entry.stagedAttachmentIds?.length || !Array.isArray(responses) ||
        responses.length === 0 || responses.length > 100 || new Set(responses.map(row => row.requestId)).size !== responses.length ||
        responses.some(row => !row.requestId || Object.keys(row).some(key => !["requestId", "optionId", "text"].includes(key)) ||
          (typeof row.optionId === "string") === (typeof row.text === "string") ||
          (row.optionId !== undefined && !row.optionId) || (row.text !== undefined && !row.text.trim()))) {
      throw new Error("Invalid question response");
    }
    entry = structuredClone(entry);
  }
  if(entry.replyToQuestionId && (entry.questionAnswer || !/^[a-f0-9-]{36}$/iu.test(entry.replyToQuestionId))) throw new Error("Invalid question reply");
  const attachmentIds = entry.attachmentIds ?? [];
  const stagedIds = entry.stagedAttachmentIds ?? [];
  if (stagedIds.length > 6 || new Set(stagedIds).size !== stagedIds.length || stagedIds.some(id => !/^[a-f0-9-]{36}$/iu.test(id)) ||
      (stagedIds.length && (entry.questionAnswer || attachmentIds.length))) throw new Error("Invalid staged files");
  if (attachmentIds.length > 6 || attachmentIds.some(id => !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(id)) ||
      new Set(attachmentIds.map(id => id.toLowerCase())).size !== attachmentIds.length ||
      (entry.questionAnswer && attachmentIds.length)) throw new Error("Invalid message attachments");
  if (attachmentIds.length) entry = { ...entry, attachmentIds: attachmentIds.map(id => id.toLowerCase()) };
  if (entry.questionAnswer) entry = { ...entry, questionAnswer: normalizeQuestionAnswer(entry.questionAnswer) };
  if (!entry.account || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(entry.intentId) ||
      (!entry.text.trim() && !attachmentIds.length && !stagedIds.length) || !entry.text.isWellFormed() || entry.text.includes("\0") ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(entry.accessEpoch) ||
      !Number.isFinite(entry.submittedAt)) throw new Error("Invalid submitted message");
  const db = await openConversationDeviceDatabase();
  if (conversationDeviceAccountGeneration(entry.account) !== generation) throw new Error("Account changed while sending");
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["outbox", "drafts", "outbox-order", "attachments"], "readwrite");
    const outbox = transaction.objectStore("outbox");
    const existing = outbox.get([entry.account, entry.intentId]);
    let conflict = false;
    existing.onsuccess = () => {
      if (existing.result) {
        if (!sameConversationIntentContent(existing.result, entry) || existing.result.submittedAt !== entry.submittedAt || existing.result.accessEpoch !== entry.accessEpoch) {
          conflict = true; transaction.abort();
        }
        return;
      }
      for (const id of stagedIds) {
        const staged = transaction.objectStore("attachments").get([entry.account,id]);
        staged.onsuccess = () => {
          if (!staged.result || staged.result.submittedIntentId) { conflict = true; transaction.abort(); return; }
          transaction.objectStore("attachments").put({ ...staged.result, visible: false, submittedIntentId: entry.intentId });
        };
      }
      const orders = transaction.objectStore("outbox-order");
      const order = orders.get(entry.account);
      order.onsuccess = () => {
        const next = (typeof order.result === "number" ? order.result : 0) + 1;
        orders.put(next, entry.account);
        outbox.add({ ...entry, queuePosition: next });
      };
      const drafts = transaction.objectStore("drafts");
      const draft = drafts.get(entry.account);
      draft.onsuccess = () => {
        if ((draftRevision && draft.result?.revision === draftRevision && draft.result?.text === entry.text &&
              (draft.result?.replyToQuestionId ?? null) === (entry.replyToQuestionId ?? null)) ||
            (draftRevision === null && typeof draft.result === "string" && draft.result === entry.text && !entry.replyToQuestionId)) {
          drafts.delete(entry.account);
        }
      };
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error(conflict ? "Submitted message changed" : "Message queue write interrupted"));
  });
}

export async function listConversationIntents(account: string): Promise<PendingConversationIntent[]> {
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("outbox", "readonly");
    const request = transaction.objectStore("outbox").index("account").getAll(account);
    transaction.oncomplete = () => resolve((request.result as (PendingConversationIntent & { queuePosition: number })[])
      .filter(entry => !(entry as { failure?: string }).failure)
      .sort((a, b) => a.queuePosition - b.queuePosition));
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Message queue read interrupted"));
  });
}

export async function listFailedConversationIntents(account: string): Promise<
  (PendingConversationIntent & { failure: "conflict" | "rejected" })[]
> {
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const request = tx.objectStore("outbox").index("account").getAll(account);
    tx.oncomplete = () => resolve(request.result.filter((entry: { failure?: string }) =>
      entry.failure === "conflict" || entry.failure === "rejected"));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Could not read undelivered messages"));
  });
}

/** Preserve rejected words for correction, but remove deleted content. Neither
 * case remains at the head of the automatic delivery queue. */
export async function rejectConversationIntent(entry: PendingConversationIntent,
  reason: "conflict" | "rejected" | "deleted"): Promise<void> {
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["outbox","attachments"], "readwrite");
    const store = transaction.objectStore("outbox");
    const request = store.get([entry.account, entry.intentId]);
    request.onsuccess = () => {
      if (!request.result) return;
      if (reason === "deleted" && request.result.failure === "deleted") return;
      if (!sameConversationIntentContent(request.result, entry) || request.result.accessEpoch !== entry.accessEpoch) { transaction.abort(); return; }
      if(reason === "deleted") for(const id of entry.stagedAttachmentIds ?? []) transaction.objectStore("attachments").delete([entry.account,id]);
      store.put(reason === "deleted"
        ? { account: entry.account, intentId: entry.intentId, failure: reason }
        : { ...request.result, failure: reason });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Could not record undelivered message"));
  });
}

export async function clearConversationDeviceAccount(account: string): Promise<void> {
  accountGenerations.set(account,conversationDeviceAccountGeneration(account)+1);
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["drafts", "outbox", "outbox-order", "attachments", "access"], "readwrite");
    transaction.objectStore("drafts").delete(account);
    transaction.objectStore("access").delete(account);
    transaction.objectStore("outbox-order").delete(account);
    const files = transaction.objectStore("attachments").index("account").openCursor(account);
    files.onsuccess = () => { const cursor=files.result; if(cursor){cursor.delete();cursor.continue();} };
    const request = transaction.objectStore("outbox").index("account").openCursor(account);
    request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.delete(); cursor.continue(); } };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Could not clear device conversation data"));
  });
}

export async function acknowledgeConversationIntent(entry: PendingConversationIntent,
  receipt: ConversationAcceptanceReceipt): Promise<void> {
  if (!validAcceptanceReceipt(entry, receipt)) throw new Error("Invalid request receipt");
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["outbox","attachments"], "readwrite");
    const outbox = transaction.objectStore("outbox");
    const request = outbox.get([entry.account, entry.intentId]);
    request.onsuccess = () => {
      if (!request.result) return;
      if (!sameConversationIntentContent(request.result, entry) || request.result.submittedAt !== entry.submittedAt || request.result.accessEpoch !== entry.accessEpoch) {
        transaction.abort(); return;
      }
      outbox.delete([entry.account, entry.intentId]);
      for(const id of entry.stagedAttachmentIds ?? []) transaction.objectStore("attachments").delete([entry.account,id]);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(new Error("Request receipt could not be kept"));
  });
}

export async function readConversationDraft(account: string): Promise<string> {
  return (await readConversationDraftState(account)).text;
}

export async function readConversationDraftState(account: string): Promise<{ text: string; revision: string | null; replyToQuestionId: string | null }> {
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction("drafts", "readonly").objectStore("drafts").get(account);
    request.onsuccess = () => resolve(typeof request.result === "string"
      ? { text: request.result, revision: null, replyToQuestionId: null }
      : { text: request.result?.text ?? "", revision: request.result?.revision ?? null, replyToQuestionId: request.result?.replyToQuestionId ?? null });
    request.onerror = () => reject(request.error);
  });
}

export async function writeConversationDraft(account: string, draft: string, revision = crypto.randomUUID(), replyToQuestionId: string | null = null): Promise<void> {
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drafts", "readwrite");
    const store = transaction.objectStore("drafts");
    if (draft || replyToQuestionId) store.put({ text: draft, revision, replyToQuestionId }, account);
    else store.delete(account);
    // A request succeeding is not enough: acknowledge only the committed transaction.
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Draft write interrupted"));
  });
}

/** A fresh authenticated server generation must confirm this revocation. */
export async function revokeConversationIntents(account: string, accessEpoch: string): Promise<void> {
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["outbox","attachments"], "readwrite");
    const request = tx.objectStore("outbox").index("account").openCursor(account);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.accessEpoch === accessEpoch) {
        for(const id of cursor.value.stagedAttachmentIds ?? []) tx.objectStore("attachments").delete([account,id]);
        cursor.delete();
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Could not remove revoked pending messages"));
  });
}

/** Last verified generation permits offline staging only. Every delivery still
 * reauthenticates and compares the current server generation before sending. */
export async function readConversationDeviceAccess(account: string): Promise<string | null> {
  const db = await openConversationDeviceDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("access", "readonly");
    const read = tx.objectStore("access").get(account);
    tx.oncomplete = () => resolve(typeof read.result === "string" ? read.result : null);
    tx.onerror = () => reject(tx.error); tx.onabort = () => reject(new Error("Account state could not be restored"));
  });
}
export async function writeConversationDeviceAccess(account: string, accessEpoch: string): Promise<void> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(accessEpoch)) throw new Error("Invalid account generation");
  const generation = conversationDeviceAccountGeneration(account);
  const db = await openConversationDeviceDatabase();
  if (generation !== conversationDeviceAccountGeneration(account)) return;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("access", "readwrite"); tx.objectStore("access").put(accessEpoch, account);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(new Error("Account state could not be kept"));
  });
}
