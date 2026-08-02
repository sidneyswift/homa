import { defaultMessageReducer } from "eve/client";
import type {
  EveMessage,
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";

import {
  parsePromptSuggestionSet,
  type PromptSuggestionSet,
} from "../../lib/chat-suggestions/contract";
import { effectiveTimeZone } from "../../lib/time-zone";
import { mergeSavedSessionEvents } from "./chat-session-cache";

export { mergeSavedSessionEvents } from "./chat-session-cache";

/**
 * Transcript + session cursor persistence for the web chat, and the
 * fresh-morning rotation decision (founder direction 2026-07-10 evening:
 * returning to a days-old transcript mid-thought is disorienting; the
 * fix is time boundaries plus a fresh model session, never a thread
 * list). The mobile twin is apps/mobile/src/lib/chat-storage.ts; keep
 * behavior aligned until a shared package exists (M1-17 shape).
 *
 * Storage model (localStorage per user, the eve resumable-sessions
 * pattern; M1-02's Postgres conversations table replaces this as the
 * render source):
 *
 *   archived      messages from PREVIOUS sessions, already folded to
 *                 renderable shape, each with the client-observed time.
 *                 Display only; the model never sees these again (recall
 *                 searches Postgres instead).
 *   events        the CURRENT session's raw event log (reducer replay).
 *   session       the current eve session cursor (resume).
 *   messageTimes  message id -> epoch ms for the current session, the
 *                 only clock the UI has (eve events carry sequence
 *                 numbers, not times).
 *   lastActivityAt when the last turn finished, feeds rotation.
 *
 * Why archived messages instead of one merged event log: eve message ids
 * derive from per-session turn sequences (`turn_${sequence}:user`), so
 * two sessions' events replayed through one reducer collide and
 * overwrite each other. Folding finished sessions into plain messages
 * sidesteps that for good.
 *
 * Rotation law: a visit after the most recent 4am family-local boundary
 * starts a fresh eve session (the Hermes/OpenClaw daily-reset shape;
 * idle-only per M1-15/TE-04). Nothing load-bearing lives in conversation
 * history (01-architecture.md): the family context block, saved
 * memories, and the recall archive make the fresh session behave
 * identically, so the seam never reads as forgetting.
 */

export interface ArchivedMessage {
  /** Client-observed arrival time, null for legacy saves. */
  at: number | null;
  message: EveMessage;
  /** Which surface the message arrived from, when the archive came from
   * the server record (sms, email, dispatch...). Local saves omit it. */
  channel?: string;
  /** Whether the turn was typed or said out loud. In-app voice is
   * channel "web" and modality "voice": it happened in the web app, it
   * just was not typed. Absent means text. */
  modality?: "text" | "voice";
  /** Eve message ids restart in every runtime session. New local archives
   * carry the session so recovery dedupe never crosses that boundary. */
  sessionId?: string;
}

/**
 * A stale-cursor replay temporarily renders the durable server archive plus an
 * in-memory overlay. Later lost-turn recovery must append to that overlay as
 * well as the persisted local archive, or resetting Eve's live reducer makes
 * the recovered turn disappear from this tab.
 */
export function appendRecoveredArchiveState(input: {
  persisted: readonly ArchivedMessage[];
  replayed: readonly ArchivedMessage[];
  additions: readonly ArchivedMessage[];
  persistedArchiveHidden: boolean;
}): { persisted: ArchivedMessage[]; replayed: ArchivedMessage[] } {
  function appendUnique(
    current: readonly ArchivedMessage[],
    additions: readonly ArchivedMessage[],
  ): ArchivedMessage[] {
    const messageIds = new Set(
      current.flatMap((entry) =>
        entry.sessionId ? [`${entry.sessionId}:${entry.message.id}`] : [],
      ),
    );
    const next = [...current];
    for (const addition of additions) {
      const key = addition.sessionId
        ? `${addition.sessionId}:${addition.message.id}`
        : null;
      if (key !== null && messageIds.has(key)) continue;
      if (key !== null) messageIds.add(key);
      next.push(addition);
    }
    return next;
  }

  return {
    persisted: appendUnique(input.persisted, input.additions),
    replayed: input.persistedArchiveHidden
      ? appendUnique(input.replayed, input.additions)
      : [...input.replayed],
  };
}

export function messagesMissingFromDurableHistory(
  restored: readonly EveMessage[],
  durableMessageIds: ReadonlySet<string>,
): EveMessage[] {
  return restored.filter((message) => !durableMessageIds.has(message.id));
}

/**
 * Returns the trustworthy local side of a server-session reconciliation.
 * Events without a session id are a dead partial projection and cannot be
 * deduplicated against an authoritative replay because Eve message ids restart
 * per session. Once replay succeeds, the server session is the only safe source.
 */
export function localMessagesForServerReconciliation(
  events: readonly HandleMessageStreamEvent[],
  sessionId: string | undefined,
  durableMessageIds: ReadonlySet<string>,
): readonly EveMessage[] {
  if (!sessionId) return [];
  return messagesMissingFromDurableHistory(
    foldEventsToMessages(events),
    durableMessageIds,
  );
}

export interface SavedChat {
  archived?: ArchivedMessage[];
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
  messageTimes?: Record<string, number>;
  lastActivityAt?: number;
  promptSuggestions?: PromptSuggestionSet | null;
}

export interface SaveChatOptions {
  /** Merge this turn's absolute Eve stream range with a newer range another
   * tab may already have written. Recovery and rotation deliberately replace. */
  mergeSessionEvents?: boolean;
}

/** What the chat client mounts with after the rotation decision. */
export interface PreparedChat {
  archived: ArchivedMessage[];
  initialEvents: readonly HandleMessageStreamEvent[];
  initialSession: SessionState | undefined;
  messageTimes: Record<string, number>;
  lastActivityAt: number | undefined;
  promptSuggestions: PromptSuggestionSet | null;
  /** True when this visit started a fresh session over old history. */
  rotated: boolean;
}

/** Local hour after which a returning visit starts a fresh model
 *  session: each morning is a fresh start, same memory. */
export const FRESH_SESSION_BOUNDARY_HOUR = 4;

/** Scrollback cap. The full record lives in Postgres (recall); the
 *  client archive is a render cache and stays bounded. */
export const MAX_ARCHIVED_MESSAGES = 200;

/** Current-session event cap, so one marathon day cannot outgrow
 *  localStorage. Trims at a turn boundary for clean reducer replay. */
export const MAX_SAVED_EVENTS = 2000;

export function chatStorageKey(userId: string): string {
  return `homa-chat-${userId}`;
}

export function loadSavedChat(storageKey: string): SavedChat {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SavedChat) : {};
  } catch {
    return {};
  }
}

export function saveChat(
  storageKey: string,
  chat: SavedChat,
  options: SaveChatOptions = {},
): void {
  try {
    const next = options.mergeSessionEvents
      ? mergeSavedSessionEvents(loadSavedChat(storageKey), chat)
      : chat;
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...next,
        archived: capArchived(next.archived ?? []),
        events: trimEventsForSave(next.events ?? []),
      }),
    );
  } catch {
    // Storage full or blocked: the durable session still lives server-side.
  }
}

export function updateSavedPromptSuggestionSet(
  storageKey: string,
  set: PromptSuggestionSet | null,
): void {
  const saved = loadSavedChat(storageKey);
  saveChat(storageKey, {
    ...saved,
    promptSuggestions: set,
  });
}

/**
 * shouldStartFreshSession(lastActivityAt, now, timeZone): true when the
 * last activity happened before the most recent 4am family-local
 * boundary, i.e. the first visit of a new chat day. Missing
 * lastActivityAt (legacy saves) counts as stale on purpose: those
 * transcripts predate rotation and a fresh session costs nothing.
 */
function localDateKey(timeZone: string, instantMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function localHour(timeZone: string, instantMs: number): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(new Date(instantMs));
  return Number(value) % 24;
}

function previousDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

function chatDayKey(timeZone: string, instantMs: number): string {
  const dateKey = localDateKey(timeZone, instantMs);
  return localHour(timeZone, instantMs) < FRESH_SESSION_BOUNDARY_HOUR
    ? previousDateKey(dateKey)
    : dateKey;
}

export function shouldStartFreshSession(
  lastActivityAt: number | undefined,
  now: number = Date.now(),
  timeZone: string | null | undefined = null,
): boolean {
  if (!lastActivityAt) return true;
  const zone = effectiveTimeZone(timeZone);
  return chatDayKey(zone, lastActivityAt) < chatDayKey(zone, now);
}

/**
 * prepareChat(storageKey): load + rotation decision in one step, run
 * once at mount. Fresh start folds the previous session's events into
 * the archive and hands the store nothing to resume; a same-day return
 * seeds the store exactly as before. Pure read; the rotated shape
 * persists on the next save (re-folding on reload is idempotent).
 */
export function prepareChat(storageKey: string, timeZone?: string | null): PreparedChat {
  const saved = loadSavedChat(storageKey);
  const archived = saved.archived ?? [];
  const times = saved.messageTimes ?? {};
  const promptSuggestions = parsePromptSuggestionSet(saved.promptSuggestions);

  if (!shouldStartFreshSession(saved.lastActivityAt, Date.now(), timeZone)) {
    return {
      archived,
      initialEvents: saved.events ?? [],
      initialSession: saved.session,
      messageTimes: times,
      lastActivityAt: saved.lastActivityAt,
      promptSuggestions,
      rotated: false,
    };
  }

  return {
    archived: capArchived([
      ...archived,
      ...archiveMessages(
        foldEventsToMessages(saved.events ?? []),
        times,
        saved.session?.sessionId,
      ),
    ]),
    initialEvents: [],
    initialSession: undefined,
    messageTimes: {},
    lastActivityAt: saved.lastActivityAt,
    promptSuggestions: null,
    rotated: true,
  };
}

/** Replays a finished session's event log into renderable messages
 *  (eve's own default projection, minus a live store). */
export function foldEventsToMessages(
  events: readonly HandleMessageStreamEvent[],
): readonly EveMessage[] {
  const reducer = defaultMessageReducer();
  let data = reducer.initial();
  for (const event of events) {
    data = reducer.reduce(data, event);
  }
  return data.messages;
}

/** Pairs live messages with their observed times for the archive. */
export function archiveMessages(
  messages: readonly EveMessage[],
  times: Record<string, number>,
  sessionId?: string,
): ArchivedMessage[] {
  return messages.map((message) => ({
    at: times[message.id] ?? null,
    message,
    ...(sessionId ? { sessionId } : {}),
  }));
}

/** Keeps only times for messages that still exist (optimistic ids get
 *  replaced by server ids and would otherwise pile up forever). */
export function pruneMessageTimes(
  times: Record<string, number>,
  messages: readonly EveMessage[],
): Record<string, number> {
  const keep: Record<string, number> = {};
  for (const message of messages) {
    const at = times[message.id];
    if (at !== undefined) keep[message.id] = at;
  }
  return keep;
}

/** Stamps `at` onto any message id not seen before (called when a turn
 *  finishes, so every stamp lands within minutes of arrival). Returns
 *  the same object when nothing was missing. */
export function stampMessageTimes(
  times: Record<string, number>,
  messages: readonly EveMessage[],
  at: number = Date.now(),
): Record<string, number> {
  let changed = false;
  const next = { ...times };
  for (const message of messages) {
    if (next[message.id] === undefined) {
      next[message.id] = at;
      changed = true;
    }
  }
  return changed ? next : times;
}

function capArchived(archived: ArchivedMessage[]): ArchivedMessage[] {
  return archived.length > MAX_ARCHIVED_MESSAGES
    ? archived.slice(archived.length - MAX_ARCHIVED_MESSAGES)
    : archived;
}

/** Drops the oldest events beyond the cap, cutting at the next turn
 *  boundary so the replayed transcript never starts mid-message. */
export function trimEventsForSave(
  events: readonly HandleMessageStreamEvent[],
): readonly HandleMessageStreamEvent[] {
  if (events.length <= MAX_SAVED_EVENTS) return events;
  const cut = events.length - MAX_SAVED_EVENTS;
  for (let index = cut; index < events.length; index += 1) {
    if (events[index].type === "turn.started") return events.slice(index);
  }
  return events.slice(cut);
}
