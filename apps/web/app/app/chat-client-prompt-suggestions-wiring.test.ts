import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(
  new URL("./chat-client.tsx", import.meta.url),
  "utf8",
);
const eventsCheckSource = readFileSync(
  new URL("../../../../scripts/events-check.mts", import.meta.url),
  "utf8",
);

describe("ChatClient prompt suggestion wiring", () => {
  it("uses the policy, request, storage, and rail interfaces", () => {
    assert.match(source, /promptSuggestionRequestForMessages/u);
    assert.match(source, /restorePromptSuggestionSetForVisibleMessages/u);
    assert.match(source, /requestPromptSuggestionSet/u);
    assert.match(source, /executePromptSuggestionLifecycleAction/u);
    assert.match(source, /updateSavedPromptSuggestionSet/u);
    assert.match(source, /PromptSuggestionRail/u);
  });

  it("runs a stale-safe pending to loading to ready state machine", () => {
    assert.match(
      source,
      /PROMPT_SUGGESTION_LOADING_DELAY_MS\s*=\s*500/u,
    );
    assert.match(source, /useState<PromptSuggestionPhase>/u);
    assert.match(source, /promptSuggestionAbortRef/u);
    assert.match(source, /promptSuggestionLoadingTimerRef/u);
    assert.match(
      source,
      /promptSuggestionAbortRef\.current\s*!==\s*controller/u,
    );
    assert.match(source, /clearTimeout\(promptSuggestionLoadingTimerRef\.current\)/u);
    assert.match(
      source,
      /requestPromptSuggestionSet\(request,\s*\{\s*signal: controller\.signal/u,
    );
  });

  it("decides auto-stop recovery before any snapshot suggestion request", () => {
    const onFinishStart = source.indexOf("onFinish(snapshot)");
    const agentEnd = source.indexOf("const agentError =", onFinishStart);
    assert.ok(onFinishStart >= 0 && agentEnd > onFinishStart);
    const onFinishSource = source.slice(onFinishStart, agentEnd);
    const readAutoStop = onFinishSource.indexOf(
      "const autoStopped = autoStoppedRef.current;",
    );
    const decideLifecycle = onFinishSource.indexOf(
      "promptSuggestionActionForLifecycleEvent({",
    );
    const executeLifecycle = onFinishSource.indexOf(
      "executePromptSuggestionLifecycleAction(",
    );

    assert.ok(readAutoStop >= 0);
    assert.ok(decideLifecycle > readAutoStop);
    assert.ok(executeLifecycle > decideLifecycle);
  });

  it("cancels suggestions across recovery and requests from recovered messages", () => {
    const recoveryStart = source.indexOf(
      "const startLostTurnRecovery = useCallback",
    );
    const recoveryEnd = source.indexOf(
      "startRecoveryRef.current = startLostTurnRecovery",
      recoveryStart,
    );
    assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart);
    const recoverySource = source.slice(recoveryStart, recoveryEnd);
    const startLifecycle = recoverySource.indexOf(
      'type: "recovery_started"',
    );
    const recoverRequest = recoverySource.indexOf("recoverLostTurn({");
    const foldRecovered = recoverySource.indexOf(
      "const messages = foldEventsToMessages(recovered.events);",
    );

    assert.ok(startLifecycle >= 0 && startLifecycle < recoverRequest);
    assert.ok(foldRecovered >= 0);
    assert.match(
      recoverySource,
      /type: "recovery_finished",\s*outcome: "recovered"/u,
    );
    assert.match(
      recoverySource,
      /type: "recovery_finished",\s*outcome: "failed"/u,
    );
    assert.match(
      recoverySource,
      /type: "recovery_finished",\s*outcome: "aborted"/u,
    );
    assert.ok(
      (recoverySource.match(/executePromptSuggestionLifecycleAction\(/gu)
        ?.length ?? 0) >= 4,
    );
  });

  it("restores only suggestions belonging to the newest assistant reply", () => {
    assert.match(
      source,
      /restorePromptSuggestionSetForVisibleMessages\(\{[\s\S]{0,400}archivedMessages:[\s\S]{0,240}currentMessages:[\s\S]{0,240}prepared\.promptSuggestions/u,
    );
    assert.match(
      source,
      /updateSavedPromptSuggestionSet\(storageKey, suggestionSet\)/u,
    );
    assert.match(
      source,
      /updateSavedPromptSuggestionSet\(storageKey, null\)/u,
    );
  });

  it("hides the rail around every competing composer or card interaction", () => {
    // The list grew on 2026-07-22: the founder's walk ended on a
    // checklist invite, an "Explain next step" chip, and an open
    // composer all at once, because the gate knew the snap and question
    // cards but had never been taught onboarding, the checklist invite,
    // or the report reveal.
    assert.match(
      source,
      /!busy[\s\S]{0,320}promptSuggestionPhase !== "idle"[\s\S]{0,320}progressInteraction === null[\s\S]{0,320}activeSnap === null[\s\S]{0,320}activeQuestion === null[\s\S]{0,900}onboarding === null[\s\S]{0,900}activeChecklist === null[\s\S]{0,320}activeReport === null[\s\S]{0,320}draft\.trim\(\)\.length === 0[\s\S]{0,320}attachments\.staged\.length === 0[\s\S]{0,320}dictation\.phase === "idle"/u,
    );
    assert.match(source, /!recovering[\s\S]{0,120}promptSuggestionPhase/u);
  });

  it("sends exact visible suggestion text and correlates accepted turns", () => {
    assert.match(source, /const result = sendMessage\(suggestion\);/u);
    assert.match(source, /if \(result === "rejected"\) return;/u);
    assert.match(
      source,
      /suggestionSetIdForTurnRef\.current = suggestionSet\.setId/u,
    );
    assert.match(source, /"chat\.prompt_suggestions_shown"/u);
    assert.match(source, /"chat\.prompt_suggestion_tapped"/u);
    assert.match(
      source,
      /suggestion_set_id: suggestionSetId/u,
    );
    const suggestionEventStart = source.indexOf(
      "const emitPromptSuggestionsShown",
    );
    const turnEventStart = source.indexOf(
      "const emitTurnCompleted",
      suggestionEventStart,
    );
    assert.ok(suggestionEventStart >= 0 && turnEventStart > suggestionEventStart);
    assert.doesNotMatch(
      source.slice(suggestionEventStart, turnEventStart),
      /fingerprint/iu,
    );
  });

  it("clears accepted sends only after the wall has allowed them", () => {
    const sendStart = source.indexOf("function sendMessage(");
    const attachmentStart = source.indexOf(
      "async function sendMessageWithAttachments(",
    );
    assert.ok(sendStart >= 0 && attachmentStart > sendStart);
    const sendSource = source.slice(sendStart, attachmentStart);
    const wallRejection = sendSource.indexOf('if (wall) {');
    const clearAfterWall = sendSource.indexOf("clearPromptSuggestionState();");

    assert.ok(wallRejection >= 0);
    assert.ok(clearAfterWall > wallRejection);
  });

  it("uses one rounded composer silhouette without changing static starters", () => {
    assert.match(
      source,
      /"What should we work on this week\?",\s*"Make a worksheet for today",\s*"We had a rough morning, help me reset"/u,
    );
    assert.match(
      source,
      /max-w-\[780px\] rounded-\[22px\] shadow-md/u,
    );
    assert.match(source, /-mt-px rounded-b-\[22px\] rounded-t-none/u);
    assert.match(source, /<PromptSuggestionRail/u);
  });

  it("removes only the now-live prompt suggestion entries from staged events", () => {
    const stagedEvents =
      eventsCheckSource.match(
        /const STAGED_EVENTS[\s\S]*?=\s*\[[\s\S]*?\];/u,
      )?.[0] ?? "";

    assert.doesNotMatch(stagedEvents, /chat\.prompt_suggestions_shown/u);
    assert.doesNotMatch(stagedEvents, /chat\.prompt_suggestion_tapped/u);
  });
});
