import { defaultMessageReducer } from "eve/client";
import type {
  EveMessage,
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";

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
 * Rotation law: a visit after the most recent 4am local starts a fresh
 * eve session (the Hermes/OpenClaw daily-reset shape; idle-only per
 * M1-15/TE-04). Nothing load-bearing lives in conversation history
 * (01-architecture.md): the family context block, saved memories, and
 * the recall archive make the fresh session behave identically, so the
 * seam never reads as forgetting.
 */

export interface ArchivedMessage {
  /** Client-observed arrival time, null for legacy saves. */
  at: number | null;
  message: EveMessage;
}

export interface SavedChat {
  archived?: ArchivedMessage[];
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
  messageTimes?: Record<string, number>;
  lastActivityAt?: number;
}

/** What the chat client mounts with after the rotation decision. */
export interface PreparedChat {
  archived: ArchivedMessage[];
  initialEvents: readonly HandleMessageStreamEvent[];
  initialSession: SessionState | undefined;
  messageTimes: Record<string, number>;
  lastActivityAt: number | undefined;
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

export function saveChat(storageKey: string, chat: SavedChat): void {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...chat,
        archived: capArchived(chat.archived ?? []),
        events: trimEventsForSave(chat.events ?? []),
      }),
    );
  } catch {
    // Storage full or blocked: the durable session still lives server-side.
  }
}

/**
 * shouldStartFreshSession(lastActivityAt, now): true when the last
 * activity happened before the most recent 4am local, i.e. the first
 * visit of a new chat day. Missing lastActivityAt (legacy saves) counts
 * as stale on purpose: those transcripts predate rotation and a fresh
 * session costs nothing.
 */
export function shouldStartFreshSession(
  lastActivityAt: number | undefined,
  now: number = Date.now(),
): boolean {
  if (!lastActivityAt) return true;
  const boundary = new Date(now);
  boundary.setHours(FRESH_SESSION_BOUNDARY_HOUR, 0, 0, 0);
  if (boundary.getTime() > now) {
    // Before 4am: the live boundary is yesterday's 4am.
    boundary.setDate(boundary.getDate() - 1);
  }
  return lastActivityAt < boundary.getTime();
}

/**
 * prepareChat(storageKey): load + rotation decision in one step, run
 * once at mount. Fresh start folds the previous session's events into
 * the archive and hands the store nothing to resume; a same-day return
 * seeds the store exactly as before. Pure read; the rotated shape
 * persists on the next save (re-folding on reload is idempotent).
 */
export function prepareChat(storageKey: string): PreparedChat {
  const saved = loadSavedChat(storageKey);
  const archived = saved.archived ?? [];
  const times = saved.messageTimes ?? {};

  if (!shouldStartFreshSession(saved.lastActivityAt)) {
    return {
      archived,
      initialEvents: saved.events ?? [],
      initialSession: saved.session,
      messageTimes: times,
      lastActivityAt: saved.lastActivityAt,
      rotated: false,
    };
  }

  return {
    archived: capArchived([
      ...archived,
      ...archiveMessages(foldEventsToMessages(saved.events ?? []), times),
    ]),
    initialEvents: [],
    initialSession: undefined,
    messageTimes: {},
    lastActivityAt: saved.lastActivityAt,
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
): ArchivedMessage[] {
  return messages.map((message) => ({
    at: times[message.id] ?? null,
    message,
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
