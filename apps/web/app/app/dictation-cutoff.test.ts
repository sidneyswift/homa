import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { DICTATION_CUTOFF_MESSAGE } from "./dictation";

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
    assert.match(DICTATION_CUTOFF_MESSAGE, /three minutes/iu);
  });

  it("tells her the words are kept, because losing them is the fear", () => {
    assert.match(DICTATION_CUTOFF_MESSAGE, /in the box/iu);
  });

  it("offers the next move instead of apologising for a limit", () => {
    assert.match(DICTATION_CUTOFF_MESSAGE, /tap the mic again/iu);
    for (const banned of [/sorry/iu, /error/iu, /failed/iu, /too long/iu]) {
      assert.ok(!banned.test(DICTATION_CUTOFF_MESSAGE), `avoid ${banned}`);
    }
  });

  it("is raised by the cap, not by a parent tapping the check", () => {
    const capEffect = dictation.slice(dictation.indexOf("seconds < MAX_RECORDING_SECONDS"));
    assert.match(capEffect.slice(0, 400), /setAutoStopped\(true\)/u);
  });

  it("clears when she starts a new take, so it never outlives its take", () => {
    assert.match(dictation, /setAutoStopped\(false\)/u);
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
