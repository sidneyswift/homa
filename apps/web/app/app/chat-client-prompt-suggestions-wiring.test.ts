import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);

describe("ChatClient prompt suggestion pause", () => {
  it("renders neither the fixed starter chips nor the generated rail", () => {
    assert.doesNotMatch(source, /What should we work on this week\?/u);
    assert.doesNotMatch(source, /Make a worksheet for today/u);
    assert.doesNotMatch(source, /We had a rough morning, help me reset/u);
    assert.doesNotMatch(source, /PromptSuggestionRail/u);
    assert.doesNotMatch(source, /showSuggestions/u);
  });

  it("does not request, persist, or emit generated suggestion activity", () => {
    assert.doesNotMatch(source, /requestPromptSuggestionSet/u);
    assert.doesNotMatch(source, /promptSuggestionRequestForMessages/u);
    assert.doesNotMatch(source, /updateSavedPromptSuggestionSet/u);
    assert.doesNotMatch(source, /chat\.prompt_suggestions_shown/u);
    assert.doesNotMatch(source, /chat\.prompt_suggestion_tapped/u);
  });

  it("keeps automatic cutoff recovery independent of suggestion lifecycle", () => {
    const onFinishStart = source.indexOf("onFinish(snapshot)");
    const agentEnd = source.indexOf("const agentError =", onFinishStart);
    assert.ok(onFinishStart >= 0 && agentEnd > onFinishStart);

    const onFinishSource = source.slice(onFinishStart, agentEnd);
    assert.match(
      onFinishSource,
      /if \(autoStopped && !snapshot\.error\) \{\s*startRecoveryRef\.current\?\.\(\);/u,
    );
    assert.match(
      onFinishSource,
      /if \(!snapshot\.error && !autoStopped\) flushQueuedMessages\(\);/u,
    );
  });

  it("leaves the current rounded composer silhouette", () => {
    assert.match(source, /quiet-chat__composer-form w-full/u);
    assert.doesNotMatch(source, /quiet-chat__composer-form--suggestions/u);
  });
});
