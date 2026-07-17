import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { EveMessage } from "eve/react";

import {
  createPromptSuggestionAssistantFingerprint,
  type PromptSuggestionSet,
} from "../../lib/chat-suggestions/contract";
import {
  foldEventsToMessages,
  loadSavedChat,
  prepareChat,
  saveChat,
  updateSavedPromptSuggestionSet,
} from "./chat-storage";
import { restorePromptSuggestionSetForVisibleMessages } from "./prompt-suggestion-policy";

const STORAGE_KEY = "chat-key";
const TWO_DAYS_MS = 48 * 60 * 60 * 1_000;
const ASSISTANT_TEXT = "Your fractions page is ready.";
const validSet: PromptSuggestionSet = {
  setId: "00000000-0000-4000-8000-000000000001",
  assistantMessageId: "turn_1:assistant",
  assistantMessageFingerprint:
    createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
  promptVersion: "2026.07.15.1",
  source: "model",
  suggestions: ["Email this"],
};

function chatMessage(
  role: "user" | "assistant",
  text: string,
  id: string,
): EveMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  } as unknown as EveMessage;
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let originalWindowDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  originalWindowDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "window",
  );
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: new MemoryStorage() },
    writable: true,
  });
});

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "window");
});

describe("chat prompt suggestion storage", () => {
  it("restores a valid set and clears it after morning rotation", () => {
    const now = Date.now();
    saveChat(STORAGE_KEY, { lastActivityAt: now });
    updateSavedPromptSuggestionSet(STORAGE_KEY, validSet);

    assert.deepEqual(
      prepareChat(STORAGE_KEY, "America/New_York").promptSuggestions,
      validSet,
    );

    updateSavedPromptSuggestionSet(STORAGE_KEY, null);
    assert.equal(
      prepareChat(STORAGE_KEY, "America/New_York").promptSuggestions,
      null,
    );

    updateSavedPromptSuggestionSet(STORAGE_KEY, validSet);
    saveChat(STORAGE_KEY, {
      ...loadSavedChat(STORAGE_KEY),
      lastActivityAt: now - TWO_DAYS_MS,
    });
    assert.equal(
      prepareChat(STORAGE_KEY, "America/New_York").promptSuggestions,
      null,
    );
  });

  it("rejects a malformed stored suggestion set", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        lastActivityAt: Date.now(),
        promptSuggestions: {
          ...validSet,
          suggestions: [],
        },
      }),
    );

    assert.equal(
      prepareChat(STORAGE_KEY, "America/New_York").promptSuggestions,
      null,
    );
  });

  it("restores a recovered set from archived messages after reload", () => {
    const recoveredMessages = [
      chatMessage("user", "Make a fractions page", "turn_1:user"),
      chatMessage(
        "assistant",
        ASSISTANT_TEXT,
        "turn_1:assistant",
      ),
    ];
    saveChat(STORAGE_KEY, {
      archived: recoveredMessages.map((message) => ({
        at: Date.now(),
        message,
      })),
      events: [],
      lastActivityAt: Date.now(),
      promptSuggestions: validSet,
    });

    const prepared = prepareChat(STORAGE_KEY, "America/New_York");
    const restored = restorePromptSuggestionSetForVisibleMessages({
      archivedMessages: prepared.archived.map(({ message }) => message),
      currentMessages: foldEventsToMessages(prepared.initialEvents),
      promptSuggestionSet: prepared.promptSuggestions,
      staleSessionlessEvents: false,
    });

    assert.deepEqual(restored, validSet);
  });
});
