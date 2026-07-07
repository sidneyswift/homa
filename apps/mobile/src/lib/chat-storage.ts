import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HandleMessageStreamEvent, SessionState } from "eve/client";

/**
 * Transcript + session cursor persistence, the mobile twin of the web
 * chat's localStorage pattern (eve's documented resumable-sessions
 * approach). M1-02's Postgres conversations table replaces both.
 */

export interface SavedChat {
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
}

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
    await AsyncStorage.setItem(storageKey, JSON.stringify(chat));
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
