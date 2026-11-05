import type { ConversationFeedChanges, ConversationFeedMaterials, ConversationFeedMessage, ConversationFeedPage } from "../../lib/conversation-feed";

export const MAX_CONVERSATION_FEED_MESSAGES = 500;
export class ConversationFeedAccessChanged extends Error {}
export class ConversationFeedCursorExpired extends Error {}

export interface ConversationFeedWindow {
  account: string;
  conversationId: string;
  accessEpoch: string;
  messages: ConversationFeedPage["messages"];
  materials: ConversationFeedPage["materials"];
  materialsUnavailable: boolean;
  pendingMaterialMessageIds: string[];
  materialsTruncated: boolean;
  requests: ConversationFeedPage["requests"];
  requestsTruncated: boolean;
  changeCursor: string;
  beforeCursor: string | null;
  hasOlder: boolean;
  followingNewest: boolean;
  hasNewer: boolean;
}

type FeedInput = { account: string; accessToken: string; signal: AbortSignal; fetch?: typeof fetch };
const compare = (a: ConversationFeedMessage, b: ConversationFeedMessage) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
const validMessage = (message: ConversationFeedMessage) => message && typeof message.id === "string" && typeof message.content === "string"
  && typeof message.createdAt === "string" && Number.isFinite(Date.parse(message.createdAt)) && Number.isFinite(message.atMs)
  && typeof message.historyCursor === "string" && Boolean(message.historyCursor)
  && (message.role === "user" || message.role === "assistant");

async function requestFeed(input: FeedInput, parameters: Record<string, string>): Promise<ConversationFeedPage | ConversationFeedChanges | ConversationFeedMaterials> {
  if (!input.accessToken) throw new Error("Invalid feed request");
  const query = new URLSearchParams({ account: input.account, ...parameters });
  const response = await (input.fetch ?? fetch)(`/api/conversation/feed?${query}`, {
    headers: { authorization: `Bearer ${input.accessToken}` }, credentials: "omit", cache: "no-store", redirect: "error",
    signal: AbortSignal.any([input.signal, AbortSignal.timeout(15_000)]),
  });
  if (response.status === 401 || response.status === 403) throw new ConversationFeedAccessChanged("Conversation access changed");
  if (response.status === 409 || response.status === 410) throw new ConversationFeedCursorExpired("Conversation cursor expired");
  if (!response.ok) throw new Error("Conversation history unavailable");
  const page = await response.json() as ConversationFeedPage | ConversationFeedChanges | ConversationFeedMaterials;
  if (input.signal.aborted) throw input.signal.reason;
  if (!page || typeof page !== "object" || typeof page.conversationId !== "string" || typeof page.accessEpoch !== "string"
    || !Array.isArray(page.materials)
    || (page.mode !== "materials" && (!Array.isArray(page.requests) || typeof page.requestsTruncated !== "boolean"))) {
    throw new Error("Invalid conversation history");
  }
  if (page.account !== input.account) throw new ConversationFeedAccessChanged("Conversation account changed");
  return page;
}

export async function fetchConversationFeedPage(input: FeedInput & { before?: string; accessEpoch?: string }): Promise<ConversationFeedPage> {
  const parameters: Record<string, string> = { limit: "50" };
  if (input.before) {
    if (!input.accessEpoch) throw new Error("Missing history access epoch");
    parameters.before = input.before; parameters.accessEpoch = input.accessEpoch;
  }
  const page = await requestFeed(input, parameters);
  if (page.mode !== "snapshot" || typeof page.changeCursor !== "string" || !page.changeCursor
    || typeof page.hasOlder !== "boolean" || (page.nextCursor !== null && typeof page.nextCursor !== "string")
    || (page.hasOlder && !page.nextCursor) || !Array.isArray(page.messages) || page.messages.length > 50
    || !page.messages.every(validMessage)) throw new Error("Invalid conversation history");
  if (input.before && page.accessEpoch !== input.accessEpoch) throw new ConversationFeedCursorExpired("Conversation access epoch changed");
  if (input.before && page.hasOlder && page.nextCursor === input.before) throw new Error("Conversation pagination did not advance");
  return page;
}

export async function fetchConversationFeedChanges(input: FeedInput & { after: string; accessEpoch: string }): Promise<ConversationFeedChanges> {
  const page = await requestFeed(input, { after: input.after, accessEpoch: input.accessEpoch, limit: "100" });
  if (page.mode !== "changes" || typeof page.nextChangeCursor !== "string" || !page.nextChangeCursor
    || typeof page.hasMore !== "boolean" || !Array.isArray(page.changes) || page.changes.length > 100
    || !Array.isArray(page.materialSessions) || !page.materialSessions.every(session => typeof session === "string")
    || !page.changes.every(change => change.kind === "delete" ? typeof change.messageId === "string"
      : change.kind === "upsert" && validMessage(change.message))) throw new Error("Invalid conversation changes");
  if (page.accessEpoch !== input.accessEpoch) throw new ConversationFeedCursorExpired("Conversation access epoch changed");
  if (page.hasMore && page.nextChangeCursor === input.after) throw new Error("Conversation changes did not advance");
  return page;
}

function assertOwner(window: ConversationFeedWindow, page: ConversationFeedPage | ConversationFeedChanges | ConversationFeedMaterials) {
  if (page.account !== window.account || page.conversationId !== window.conversationId) throw new ConversationFeedAccessChanged("Conversation account changed");
  if (page.accessEpoch !== window.accessEpoch) throw new ConversationFeedCursorExpired("Conversation access epoch changed");
}
function materialsFor(messages: ConversationFeedMessage[], materials: ConversationFeedPage["materials"]) {
  const sessions = new Set(messages.map(message => message.sessionId));
  return materials.filter(material => sessions.has(material.sessionId));
}

export function createConversationFeedWindow(page: ConversationFeedPage): ConversationFeedWindow {
  const messages = [...new Map(page.messages.map(message => [message.id, message])).values()].sort(compare);
  return { account: page.account, conversationId: page.conversationId, accessEpoch: page.accessEpoch,
    messages, materials: materialsFor(messages, page.materials), materialsUnavailable: page.materialsUnavailable === true,
    pendingMaterialMessageIds: page.materialsUnavailable ? messages.map(message => message.id) : [],
    materialsTruncated: page.materialsTruncated === true, requests: page.requests, requestsTruncated: page.requestsTruncated,
    changeCursor: page.changeCursor, beforeCursor: page.nextCursor ?? messages[0]?.historyCursor ?? null,
    hasOlder: page.hasOlder, followingNewest: true, hasNewer: false };
}

/** Moving backward keeps the oldest end of this bounded window. The server's
 * keyset cursor still reaches every older page, regardless of history length. */
export function extendConversationFeedWindow(window: ConversationFeedWindow, page: ConversationFeedPage): ConversationFeedWindow {
  assertOwner(window, page);
  // This snapshot is newer than the loaded window, so its revisions win. Keep
  // our change cursor: adopting the older page's cursor would skip head updates.
  const all = new Map(window.messages.map(message => [message.id, message]));
  for (const message of page.messages) all.set(message.id, message);
  const messages = [...all.values()].sort(compare).slice(0, MAX_CONVERSATION_FEED_MESSAGES);
  const sessions = new Set(page.messages.map(message => message.sessionId));
  const materials = page.materialsUnavailable ? window.materials : [
    ...window.materials.filter(material => !sessions.has(material.sessionId)), ...page.materials,
  ];
  const pendingMaterialMessageIds = pendingMaterials(window, messages, sessions, page.materialsUnavailable === true);
  return { ...window, messages, materials: materialsFor(messages, materials), pendingMaterialMessageIds,
    materialsUnavailable: pendingMaterialMessageIds.length > 0,
    materialsTruncated: window.materialsTruncated || page.materialsTruncated === true,
    beforeCursor: page.nextCursor ?? messages[0]?.historyCursor ?? window.beforeCursor,
    hasOlder: page.hasOlder, followingNewest: false, hasNewer: window.hasNewer || all.size > messages.length };
}

/** Apply only committed changes. Outside-window updates advance the cursor
 * without moving someone who is reading an older part of the conversation. */
export function applyConversationFeedChanges(window: ConversationFeedWindow, page: ConversationFeedChanges): ConversationFeedWindow {
  assertOwner(window, page);
  const all = new Map(window.messages.map(message => [message.id, message]));
  const oldest = window.messages[0], newest = window.messages.at(-1);
  let hasNewer = window.hasNewer, hasOlder = window.hasOlder;
  for (const change of page.changes) {
    if (change.kind === "delete") { all.delete(change.messageId); continue; }
    const message = change.message;
    if (all.has(message.id)) { all.set(message.id, message); continue; }
    if (oldest && compare(message, oldest) < 0) { hasOlder = true; continue; }
    if (!window.followingNewest && (!newest || compare(message, newest) > 0)) { hasNewer = true; continue; }
    all.set(message.id, message);
  }
  const sorted = [...all.values()].sort(compare);
  const overflow = sorted.length > MAX_CONVERSATION_FEED_MESSAGES;
  const messages = window.followingNewest ? sorted.slice(-MAX_CONVERSATION_FEED_MESSAGES) : sorted.slice(0, MAX_CONVERSATION_FEED_MESSAGES);
  if (overflow) { if (window.followingNewest) hasOlder = true; else hasNewer = true; }
  const sessions = new Set(page.materialSessions);
  const materials = page.materialsUnavailable ? window.materials : [
    ...window.materials.filter(material => !sessions.has(material.sessionId)), ...page.materials,
  ];
  const pendingMaterialMessageIds = pendingMaterials(window, messages, sessions, page.materialsUnavailable === true);
  return { ...window, messages, hasOlder, hasNewer, pendingMaterialMessageIds,
    changeCursor: page.nextChangeCursor,
    beforeCursor: overflow && window.followingNewest ? messages[0]!.historyCursor : window.beforeCursor,
    materials: materialsFor(messages, materials), materialsUnavailable: pendingMaterialMessageIds.length > 0,
    materialsTruncated: window.materialsTruncated || page.materialsTruncated === true,
    requests: page.requests, requestsTruncated: page.requestsTruncated };
}

function pendingMaterials(window: ConversationFeedWindow, messages: ConversationFeedMessage[], sessions: Set<string>, unavailable: boolean) {
  const pending = new Set(window.pendingMaterialMessageIds);
  for (const message of messages) if (sessions.has(message.sessionId)) {
    if (unavailable) pending.add(message.id); else pending.delete(message.id);
  }
  return messages.filter(message => pending.has(message.id)).map(message => message.id);
}

export async function fetchConversationFeedMaterials(input: FeedInput & { messageIds: string[]; accessEpoch: string }): Promise<ConversationFeedMaterials> {
  if (!input.messageIds.length || input.messageIds.length > 100) throw new Error("Invalid material recovery request");
  const page = await requestFeed(input, { materialsFor: input.messageIds.join(","), accessEpoch: input.accessEpoch });
  const requested = new Set(input.messageIds);
  if (page.mode !== "materials" || !Array.isArray(page.materialSessions) || !page.materialSessions.every(session => typeof session === "string")
    || !Array.isArray(page.requestedMessageIds) || page.requestedMessageIds.length !== requested.size
    || new Set(page.requestedMessageIds).size !== requested.size || !page.requestedMessageIds.every(id => requested.has(id))) {
    throw new Error("Invalid conversation materials");
  }
  if (page.accessEpoch !== input.accessEpoch) throw new ConversationFeedCursorExpired("Conversation access epoch changed");
  return page;
}

/** Artifact recovery never holds back newer text or advances its change cursor. */
export function applyConversationFeedMaterials(window: ConversationFeedWindow, page: ConversationFeedMaterials): ConversationFeedWindow {
  assertOwner(window, page);
  if (page.materialsUnavailable) return window;
  const recovered = new Set(page.requestedMessageIds), sessions = new Set(page.materialSessions);
  const pendingMaterialMessageIds = window.pendingMaterialMessageIds.filter(id => !recovered.has(id));
  return { ...window, pendingMaterialMessageIds, materialsUnavailable: pendingMaterialMessageIds.length > 0,
    materialsTruncated: window.materialsTruncated || page.materialsTruncated === true,
    materials: materialsFor(window.messages, [...window.materials.filter(material => !sessions.has(material.sessionId)), ...page.materials]) };
}
