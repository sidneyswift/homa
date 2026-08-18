import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  clearDictationInProgress,
  consumeInterruptedDictation,
  DICTATION_CUTOFF_MESSAGE,
  DICTATION_INTERRUPTED_MESSAGE,
  markDictationInProgress,
  MAX_RECORDING_SECONDS,
  recordingLimitNotice,
} from "./dictation";

/**
 * A take that the clock ended says so (gh#351).
 *
 * On 2026-07-25 a parent dictated a long list of page-by-page edits. The
 * three-minute cap stopped her and accepted the transcript mid-word:
 * 1502 characters ending "...for Amalia to count. Fo". Nothing told her,
 * and the composer is one line, so she only learned it had truncated
 * when Homa replied that the message cut off. She then spent twenty
 * minutes trying to recover it with a screen recording and a screenshot,
 * neither of which the pipeline could read.
 */

const dictation = readFileSync(
  path.join(import.meta.dirname, "dictation.tsx"),
  "utf8",
);
const chatClient = readFileSync(
  path.join(import.meta.dirname, "chat-client.tsx"),
  "utf8",
);

describe("dictation cutoff notice", () => {
  it("names the limit, so she knows what happened rather than guessing", () => {
    assert.equal(MAX_RECORDING_SECONDS, 180);
    assert.match(DICTATION_CUTOFF_MESSAGE, /first 3 minutes/iu);
    assert.match(DICTATION_CUTOFF_MESSAGE, /3-minute limit/iu);
  });

  it("tells her the words are kept, because losing them is the fear", () => {
    assert.match(DICTATION_CUTOFF_MESSAGE, /safe in this message/iu);
  });

  it("offers the next move instead of apologising for a limit", () => {
    assert.match(DICTATION_CUTOFF_MESSAGE, /start a new recording/iu);
    for (const banned of [/sorry/iu, /error/iu, /failed/iu, /too long/iu]) {
      assert.ok(!banned.test(DICTATION_CUTOFF_MESSAGE), `avoid ${banned}`);
    }
  });

  it("is raised only when the cap ended a take that produced words", () => {
    assert.equal(
      recordingLimitNotice({ autoStopped: true, hasTranscript: true }),
      DICTATION_CUTOFF_MESSAGE,
    );
    assert.equal(
      recordingLimitNotice({ autoStopped: false, hasTranscript: true }),
      null,
    );
    assert.equal(
      recordingLimitNotice({ autoStopped: true, hasTranscript: false }),
      null,
    );
    const capEffect = dictation.slice(dictation.indexOf("seconds < MAX_RECORDING_SECONDS"));
    assert.match(capEffect.slice(0, 400), /autoStoppedRef\.current = true/u);
  });

  it("clears when she starts a new take, so it never outlives its take", () => {
    assert.match(dictation, /setAutoStopped\(false\)/u);
    assert.match(chatClient, /dictation\.clearCutoffNotice\(\)/u);
  });

  it("is shown by the composer once the take has settled", () => {
    assert.match(chatClient, /dictation\.autoStopped/u);
    assert.match(chatClient, /DICTATION_CUTOFF_MESSAGE/u);
  });

  it("does not compete with the while-recording hint", () => {
    // The hint's branch is checked first; this one only renders after.
    const hintAt = chatClient.indexOf("RECORDING_HINT_MESSAGE}");
    const cutoffAt = chatClient.indexOf("DICTATION_CUTOFF_MESSAGE}");
    assert.ok(hintAt > 0 && cutoffAt > hintAt);
  });
});

describe("interrupted dictation notice", () => {
  function memoryStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
  }

  it("names an armed take once after chat remounts", () => {
    const storage = memoryStorage();

    markDictationInProgress(storage);
    assert.equal(consumeInterruptedDictation(storage), DICTATION_INTERRUPTED_MESSAGE);
    assert.equal(consumeInterruptedDictation(storage), null);
  });

  it("does not report a take that the parent explicitly cancelled", () => {
    const storage = memoryStorage();
    markDictationInProgress(storage);
    clearDictationInProgress(storage);

    assert.equal(consumeInterruptedDictation(storage), null);
  });

  it("fails soft when session storage is unavailable", () => {
    const unavailable = {
      getItem() {
        throw new Error("unavailable");
      },
      setItem() {
        throw new Error("unavailable");
      },
      removeItem() {
        throw new Error("unavailable");
      },
    };

    assert.doesNotThrow(() => markDictationInProgress(unavailable));
    assert.doesNotThrow(() => clearDictationInProgress(unavailable));
    assert.equal(consumeInterruptedDictation(unavailable), null);
  });

  it("releases a late permission grant before recorder setup", () => {
    const permissionAt = dictation.indexOf(
      "stream = await navigator.mediaDevices.getUserMedia",
    );
    const mountedGuardAt = dictation.indexOf(
      "if (!mountedRef.current)",
      permissionAt,
    );
    const recorderSetupAt = dictation.indexOf(
      "const recorder = new MediaRecorder",
      permissionAt,
    );

    assert.ok(permissionAt > 0);
    assert.ok(mountedGuardAt > permissionAt);
    assert.ok(recorderSetupAt > mountedGuardAt);
    assert.match(
      dictation.slice(mountedGuardAt, recorderSetupAt),
      /stream\.getTracks\(\)\.forEach\(\(track\) => track\.stop\(\)\)/u,
    );
  });

  it("arms the interruption marker only after recording starts", () => {
    const recorderStartedAt = dictation.indexOf("recorder.start();");
    const markerAt = dictation.indexOf(
      "markDictationInProgress(storage)",
      recorderStartedAt,
    );

    assert.ok(recorderStartedAt > 0);
    assert.ok(markerAt > recorderStartedAt);
  });
});
