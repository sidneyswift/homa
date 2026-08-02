import AsyncStorage from "@react-native-async-storage/async-storage";
import { defaultMessageReducer } from "eve/client";
import type {
  EveMessage,
  HandleMessageStreamEvent,
  SessionState,
} from "eve/client";

/**
 * Transcript + session cursor persistence, the mobile twin of the web
 * chat's apps/web/app/app/chat-storage.ts: same saved shape, same
 * fresh-morning rotation (one continuous transcript, a fresh model
 * session at the first visit after 4am local), same reasoning. Keep the
 * two aligned until a shared package exists (M1-17 shape). M1-02's
 * Postgres conversations table replaces both as the render source.
 *
 * Why archived messages instead of one merged event log: eve message
 * ids derive from per-session turn sequences (`turn_${sequence}:user`),
 * so two sessions' events replayed through one reducer collide and
 * overwrite each other. Folding finished sessions into plain messages
 * sidesteps that for good.
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

/** What the chat session mounts with after the rotation decision. */
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
const FALLBACK_TIME_ZONE = "America/Chicago";

/** Scrollback cap; the full record lives in Postgres (recall). */
export const MAX_ARCHIVED_MESSAGES = 200;

/** Current-session event cap; trims at a turn boundary so the reducer
 *  replays cleanly. */
export const MAX_SAVED_EVENTS = 2000;

export function chatStorageKey(userId: string): string {
  return `homa-chat-${userId}`;
}

export async function loadSavedChat(storageKey: string): Promise<SavedChat> {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as SavedChat) : {};
  } catch {
    return {};
  }
}

export async function saveChat(
  storageKey: string,
  chat: SavedChat,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
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

export async function clearSavedChat(storageKey: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch {
    // Best effort; the caller resets in-memory state regardless.
  }
}

/**
 * shouldStartFreshSession(lastActivityAt, now, timeZone): true when the last
 * activity belongs to an earlier family-local chat day. Missing activity
 * (legacy saves) counts as stale on purpose.
 */
function localDateKey(timeZone: string, instantMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
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
  const zone = timeZone || FALLBACK_TIME_ZONE;
  return chatDayKey(zone, lastActivityAt) < chatDayKey(zone, now);
}

/**
 * prepareChat(storageKey): load + rotation decision in one step. Fresh
 * start folds the previous session's events into the archive and hands
 * the store nothing to resume; a same-day return seeds the store
 * exactly as before. Pure read; the rotated shape persists on the next
 * save (re-folding on reload is idempotent).
 */
export async function prepareChat(
  storageKey: string,
  timeZone?: string | null,
): Promise<PreparedChat> {
  const saved = await loadSavedChat(storageKey);
  const archived = saved.archived ?? [];
  const times = saved.messageTimes ?? {};

  if (!shouldStartFreshSession(saved.lastActivityAt, Date.now(), timeZone)) {
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
