import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROMPT_SUGGESTION_FALLBACK,
  PROMPT_SUGGESTION_MAX_CHARS,
  createPromptSuggestionAssistantFingerprint,
  createFallbackPromptSuggestionSet,
  parsePromptSuggestionSet,
  promptSuggestionRequestSchema,
} from "./contract";

const ASSISTANT_TEXT = "Your fractions page is ready.";

describe("prompt suggestion contract", () => {
  it("accepts one or two distinct suggestions at the visible character ceiling", () => {
    assert.equal(
      parsePromptSuggestionSet({
        setId: "00000000-0000-4000-8000-000000000001",
        assistantMessageId: "turn_1:assistant",
        assistantMessageFingerprint:
          createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
        promptVersion: "2026.07.15.1",
        source: "model",
        suggestions: ["Add picture clues", "Email the worksheet"],
      })?.suggestions.length,
      2,
    );
    assert.equal(PROMPT_SUGGESTION_MAX_CHARS, 20);
  });

  it("rejects zero, three, duplicate, overlong, and em-dash suggestions", () => {
    const base = {
      setId: "00000000-0000-4000-8000-000000000001",
      assistantMessageId: "turn_1:assistant",
      assistantMessageFingerprint:
        createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
      promptVersion: "2026.07.15.1",
      source: "model",
    } as const;
    for (const suggestions of [
      [],
      ["One", "Two", "Three"],
      ["Email this", "email this"],
      ["This suggestion is far too long"],
      ["Change this\u2014please"],
    ]) {
      assert.equal(parsePromptSuggestionSet({ ...base, suggestions }), null);
    }
  });

  it("creates a versioned normalized content-free assistant fingerprint", () => {
    const fingerprint = createPromptSuggestionAssistantFingerprint(
      "  Line one\r\nLine two  ",
    );

    assert.match(fingerprint, /^v1:[0-9a-f]{8}$/u);
    assert.equal(
      fingerprint,
      createPromptSuggestionAssistantFingerprint("Line one\nLine two"),
    );
    assert.notEqual(
      fingerprint,
      createPromptSuggestionAssistantFingerprint("Different reply"),
    );
    assert.equal(fingerprint.includes("Line"), false);
  });

  it("requires the versioned fingerprint in every parsed set", () => {
    const base = {
      setId: "00000000-0000-4000-8000-000000000001",
      assistantMessageId: "turn_1:assistant",
      promptVersion: "2026.07.15.1",
      source: "model",
      suggestions: ["Email this"],
    } as const;

    assert.equal(parsePromptSuggestionSet(base), null);
    assert.equal(
      parsePromptSuggestionSet({
        ...base,
        assistantMessageFingerprint: "unversioned",
      }),
      null,
    );
  });

  it("creates the same safe fallback for model and network failures", () => {
    const fallback = createFallbackPromptSuggestionSet(
      "turn_1:assistant",
      ASSISTANT_TEXT,
    );
    assert.deepEqual(fallback.suggestions, [PROMPT_SUGGESTION_FALLBACK]);
    assert.equal(fallback.source, "fallback");
    assert.equal(
      fallback.assistantMessageFingerprint,
      createPromptSuggestionAssistantFingerprint(ASSISTANT_TEXT),
    );
  });

  it("rejects malformed and oversized transcript requests", () => {
    assert.equal(
      promptSuggestionRequestSchema.safeParse({
        assistantMessageId: "turn_1:assistant",
        messages: [{ role: "assistant", text: "Only one message" }],
      }).success,
      false,
    );
  });

});
