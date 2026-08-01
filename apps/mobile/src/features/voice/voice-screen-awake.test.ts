import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const voiceScreenSource = readFileSync(
  new URL("./voice-screen.tsx", import.meta.url),
  "utf8",
);
const voiceSessionSource = readFileSync(
  new URL("./use-voice-session.ts", import.meta.url),
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

describe("voice-first app opening", () => {
  it("starts voice once when the default screen mounts", () => {
    assert.match(
      voiceScreenSource,
      /const autoStartedRef = useRef\(false\);/u,
      "the mount needs a replay guard",
    );
    assert.match(
      voiceScreenSource,
      /if \(autoStartedRef\.current\) return;\s+autoStartedRef\.current = true;\s+startVoice\(\);/u,
      "opening the default app screen must start voice without a tap",
    );
  });

  it("asks Homa to speak once per logical conversation, not once per reconnect", () => {
    assert.match(
      voiceSessionSource,
      /if \(!preserveLogicalSession \|\| !sessionIdRef\.current\)[\s\S]*openingResponseRequestedRef\.current = false;/u,
      "only a new logical conversation may reset the opening turn",
    );
    assert.match(
      voiceSessionSource,
      /if \(!openingResponseRequestedRef\.current\) \{\s+openingResponseRequestedRef\.current = true;\s+channel\.send\(JSON\.stringify\(openingResponseCreateEvent\(\)\)\);/u,
      "the open data channel must request exactly one opening response",
    );
  });
});
