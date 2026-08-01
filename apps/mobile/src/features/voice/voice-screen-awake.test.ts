import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const voiceScreenSource = readFileSync(
  new URL("./voice-screen.tsx", import.meta.url),
  "utf8",
);

/**
 * Voice conversations can last longer than the phone's auto-lock timeout.
 * Pin the keep-awake hook to the screen lifecycle so entry activates it and
 * React cleanup releases it when the parent returns to text chat.
 */
describe("voice screen auto-lock protection", () => {
  it("keeps the phone awake for the entire mounted voice experience", () => {
    assert.match(
      voiceScreenSource,
      /import \{ useKeepAwake \} from "expo-keep-awake";/u,
      "voice mode must use Expo's native idle-timer protection",
    );
    assert.match(
      voiceScreenSource,
      /export function VoiceScreen\(\) \{\n  useKeepAwake\("homa-voice-conversation"\);/u,
      "the protection must span the whole voice screen, not a transient audio state",
    );
  });
});
