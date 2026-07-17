import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { EveMessage } from "eve/react";

import {
  createPromptSuggestionAssistantFingerprint,
  type PromptSuggestionSet,
} from "../../lib/chat-suggestions/contract";
import {
  archiveFromServerHistory,
  type ChatHistoryMessage,
} from "../../lib/chat-history-model";
import {
  promptSuggestionRequestForMessages,
  promptSuggestionSetMatchesLatestReply,
  restorePromptSuggestionSetForVisibleMessages,
} from "./prompt-suggestion-policy";

const CHECK_IN_ID = "11111111-1111-4111-8111-111111111111";
const SET_ID = "22222222-2222-4222-8222-222222222222";

function userMessage(text: string, id = "user-1"): EveMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
  } as unknown as EveMessage;
}

function assistantMessage(text: string, id = "assistant-1"): EveMessage {
  return {
    id,
    role: "assistant",
    parts: [{ type: "text", text }],
  } as unknown as EveMessage;
}

function assistantProgressQuestionMessage(): EveMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    parts: [
      { type: "text", text: "I can check that." },
      {
        type: "dynamic-tool",
        state: "output-available",
        toolName: "manage_child_progress",
        output: {
          kind: "progress_question",
          prompt: {
            checkInId: CHECK_IN_ID,
            revision: 1,
            childName: "Maya",
            subjectDisplayName: "Math",
            statement: "Can Maya count to 5?",
            answerOptions: [
              "easily",
              "getting_there",
              "not_yet",
              "not_sure",
              "skip",
            ],
          },
        },
      },
    ],
  } as unknown as EveMessage;
}

function assistantSnapCardMessage(): EveMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    parts: [
      { type: "text", text: "You can show me the page." },
      {
        type: "dynamic-tool",
        state: "output-available",
        toolName: "ask_for_photo",
        output: {
          requested: true,
          question: "Can you show me the page?",
          hint: null,
        },
      },
    ],
  } as unknown as EveMessage;
}

function suggestionSet(
  assistantMessageId: string,
  assistantText: string,
): PromptSuggestionSet {
  return {
    setId: SET_ID,
    assistantMessageId,
    assistantMessageFingerprint:
      createPromptSuggestionAssistantFingerprint(assistantText),
    promptVersion: "2026.07.15.1",
    source: "model",
    suggestions: ["Email this"],
  };
}

function serverAssistantMessage(input: {
  id: string;
  content: string;
  atMs: number;
}): ChatHistoryMessage {
  return {
    id: input.id,
    sessionId: "server-session",
    role: "assistant",
    channel: "web",
    content: input.content,
    atMs: input.atMs,
  };
}

describe("prompt suggestion policy", () => {
  it("builds a request for an eligible assistant reply", () => {
    assert.equal(
      promptSuggestionRequestForMessages([
        userMessage("Please make a fractions page"),
        assistantMessage("Your fractions page is ready."),
      ])?.assistantMessageId,
      "assistant-1",
    );
  });

  it("rejects a terminal question and assistant replies without visible text", () => {
    assert.equal(
      promptSuggestionRequestForMessages([
        userMessage("Help with reading"),
        assistantMessage("Which book are you using?"),
      ]),
      null,
    );
    assert.equal(
      promptSuggestionRequestForMessages([
        userMessage("Help with reading"),
        assistantMessage("   "),
      ]),
      null,
    );
    assert.equal(
      promptSuggestionRequestForMessages([
        assistantMessage("Your worksheet is ready."),
        userMessage("Thanks"),
      ]),
      null,
    );
  });

  it("rejects assistant replies with an actionable progress card", () => {
    assert.equal(
      promptSuggestionRequestForMessages([
        userMessage("Check progress"),
        assistantProgressQuestionMessage(),
      ]),
      null,
    );
  });

  it("rejects assistant replies with an active snap card", () => {
    assert.equal(
      promptSuggestionRequestForMessages([
        userMessage("Can I show you?"),
        assistantSnapCardMessage(),
      ]),
      null,
    );
  });

  it("includes only the newest six non-empty text messages", () => {
    const request = promptSuggestionRequestForMessages([
      userMessage("Old user", "user-0"),
      assistantMessage("Old assistant.", "assistant-0"),
      userMessage("One", "user-1"),
      assistantMessage("Two.", "assistant-1"),
      userMessage("   ", "user-empty"),
      userMessage("Three", "user-2"),
      assistantMessage("Four.", "assistant-2"),
      userMessage("Five", "user-3"),
      assistantMessage("Six.", "assistant-3"),
    ]);

    assert.deepEqual(request, {
      assistantMessageId: "assistant-3",
      messages: [
        { role: "user", text: "One" },
        { role: "assistant", text: "Two." },
        { role: "user", text: "Three" },
        { role: "assistant", text: "Four." },
        { role: "user", text: "Five" },
        { role: "assistant", text: "Six." },
      ],
    });
  });

  it("matches a persisted set only to the newest assistant reply", () => {
    const messages = [
      userMessage("Start", "user-1"),
      assistantMessage("First reply.", "assistant-1"),
      userMessage("Continue", "user-2"),
      assistantMessage("Newest reply.", "assistant-2"),
    ];

    assert.equal(
      promptSuggestionSetMatchesLatestReply(
        messages,
        suggestionSet("assistant-2", "Newest reply."),
      ),
      true,
    );
    assert.equal(
      promptSuggestionSetMatchesLatestReply(
        messages,
        suggestionSet("assistant-2", "Fingerprint may differ on a live id."),
      ),
      true,
    );
    assert.equal(
      promptSuggestionSetMatchesLatestReply(
        messages,
        suggestionSet("assistant-1", "First reply."),
      ),
      false,
    );
  });

  it("rejects an archived set when the current session has a newer reply", () => {
    assert.equal(
      restorePromptSuggestionSetForVisibleMessages({
        archivedMessages: [
          userMessage("Start", "user-1"),
          assistantMessage("Recovered reply.", "assistant-1"),
        ],
        currentMessages: [
          userMessage("Continue", "user-2"),
          assistantMessage("Current reply.", "assistant-2"),
        ],
        promptSuggestionSet: suggestionSet(
          "assistant-1",
          "Recovered reply.",
        ),
        staleSessionlessEvents: false,
      }),
      null,
    );
  });

  it("rejects restoration when current events belong to a stale sessionless turn", () => {
    assert.equal(
      restorePromptSuggestionSetForVisibleMessages({
        archivedMessages: [
          userMessage("Start", "user-1"),
          assistantMessage("Archived reply.", "assistant-1"),
        ],
        currentMessages: [],
        promptSuggestionSet: suggestionSet(
          "assistant-1",
          "Archived reply.",
        ),
        staleSessionlessEvents: true,
      }),
      null,
    );
  });

  it("matches server history by fingerprint and rejects a newer different reply", () => {
    const repeatedText = "Your fractions page is ready.";
    const savedSet = suggestionSet("turn_9:assistant", repeatedText);
    const firstReply = serverAssistantMessage({
      id: "database-reply-1",
      content: repeatedText,
      atMs: 1,
    });
    const projectedOnce = archiveFromServerHistory(
      { messages: [firstReply], materials: [] },
      undefined,
    );

    assert.equal(projectedOnce[0]?.message.id, "hist:database-reply-1");
    assert.deepEqual(
      restorePromptSuggestionSetForVisibleMessages({
        archivedMessages: projectedOnce.map(({ message }) => message),
        currentMessages: [],
        promptSuggestionSet: savedSet,
        staleSessionlessEvents: false,
      }),
      savedSet,
    );

    const projectedRepeat = archiveFromServerHistory(
      {
        messages: [
          firstReply,
          serverAssistantMessage({
            id: "database-reply-2",
            content: repeatedText,
            atMs: 2,
          }),
        ],
        materials: [],
      },
      undefined,
    );
    assert.deepEqual(
      restorePromptSuggestionSetForVisibleMessages({
        archivedMessages: projectedRepeat.map(({ message }) => message),
        currentMessages: [],
        promptSuggestionSet: savedSet,
        staleSessionlessEvents: false,
      }),
      savedSet,
    );

    const projectedNewerReply = archiveFromServerHistory(
      {
        messages: [
          firstReply,
          serverAssistantMessage({
            id: "database-reply-3",
            content: "A different newer reply.",
            atMs: 3,
          }),
        ],
        materials: [],
      },
      undefined,
    );
    assert.equal(
      restorePromptSuggestionSetForVisibleMessages({
        archivedMessages: projectedNewerReply.map(({ message }) => message),
        currentMessages: [],
        promptSuggestionSet: savedSet,
        staleSessionlessEvents: false,
      }),
      null,
    );
  });
});
