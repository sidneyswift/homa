import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROMPT_SUGGESTION_FALLBACK,
  createPromptSuggestionAssistantFingerprint,
  type PromptSuggestionRequest,
  type PromptSuggestionSet,
} from "../../lib/chat-suggestions/contract";
import { requestPromptSuggestionSet } from "./prompt-suggestion-client";

const ASSISTANT_MESSAGE_ID = "turn_4:assistant";
const ASSISTANT_TEXT = "Your fractions page is ready.";
const REQUEST: PromptSuggestionRequest = {
  assistantMessageId: ASSISTANT_MESSAGE_ID,
  messages: [
    { role: "user", text: "Make a fractions page" },
    { role: "assistant", text: ASSISTANT_TEXT },
  ],
};
const VALID_SET: PromptSuggestionSet = {
  setId: "11111111-1111-4111-8111-111111111111",
  assistantMessageId: ASSISTANT_MESSAGE_ID,
  assistantMessageFingerprint:
    createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
  promptVersion: "2026.07.15.1",
  source: "model",
  suggestions: ["Email this", "Make another"],
};

function assertFallbackSet(set: PromptSuggestionSet): void {
  assert.equal(set.assistantMessageId, ASSISTANT_MESSAGE_ID);
  assert.equal(
    set.assistantMessageFingerprint,
    createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
  );
  assert.equal(set.source, "fallback");
  assert.deepEqual(set.suggestions, [PROMPT_SUGGESTION_FALLBACK]);
}

function fetchThatWaitsForAbort(
  _input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) {
      reject(new Error("A request signal is required"));
      return;
    }
    const rejectForAbort = () => {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      rejectForAbort();
      return;
    }
    signal.addEventListener("abort", rejectForAbort, { once: true });
  });
}

describe("requestPromptSuggestionSet", () => {
  it("posts only the request contract and returns valid route output", async () => {
    let input: string | URL | Request | undefined;
    let init: RequestInit | undefined;
    const result = await requestPromptSuggestionSet(REQUEST, {
      fetch: async (nextInput, nextInit) => {
        input = nextInput;
        init = nextInit;
        return Response.json(VALID_SET);
      },
    });

    assert.deepEqual(result, VALID_SET);
    assert.equal(input, "/api/chat/suggestions");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(init?.body)), REQUEST);
  });

  it("falls back when route output is not valid JSON or violates the contract", async () => {
    const responses = [
      new Response("{not-json", {
        headers: { "content-type": "application/json" },
      }),
      Response.json({ suggestions: [] }),
    ];

    for (const response of responses) {
      const result = await requestPromptSuggestionSet(REQUEST, {
        fetch: async () => response,
      });
      assertFallbackSet(result);
    }
  });

  it("falls back for a non-success response", async () => {
    const result = await requestPromptSuggestionSet(REQUEST, {
      fetch: async () => Response.json(VALID_SET, { status: 503 }),
    });

    assertFallbackSet(result);
  });

  it("falls back for a network error", async () => {
    const result = await requestPromptSuggestionSet(REQUEST, {
      fetch: async () => {
        throw new TypeError("Network unavailable");
      },
    });

    assertFallbackSet(result);
  });

  it("times out after six seconds and returns the fallback", async (context) => {
    context.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      const pending = requestPromptSuggestionSet(REQUEST, {
        fetch: fetchThatWaitsForAbort,
      });

      context.mock.timers.tick(5_999);
      context.mock.timers.tick(1);

      assertFallbackSet(await pending);
    } finally {
      context.mock.timers.reset();
    }
  });

  it("throws AbortError for an externally cancelled stale request", async () => {
    const controller = new AbortController();
    const pending = requestPromptSuggestionSet(REQUEST, {
      fetch: fetchThatWaitsForAbort,
      signal: controller.signal,
    });

    controller.abort();

    await assert.rejects(
      pending,
      (error: unknown) =>
        error instanceof DOMException && error.name === "AbortError",
    );
  });
});
