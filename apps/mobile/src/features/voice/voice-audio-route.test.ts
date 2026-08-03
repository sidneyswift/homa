import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const voiceSessionSource = readFileSync(
  new URL("./use-voice-session.ts", import.meta.url),
  "utf8",
);
const nativeAudioSource = readFileSync(
  new URL("../../../modules/homa-voice-audio/ios/HomaVoiceAudioModule.swift", import.meta.url),
  "utf8",
);

/**
 * WebRTC plays remote audio below React Native, so a rendered speaking state
 * cannot prove that iOS selected the loudspeaker. These wiring checks keep the
 * native route configuration attached to the real microphone-start boundary.
 * Physical output still requires a real-device check.
 */
describe("native voice speaker route", () => {
  it("defaults WebRTC voice playback to the loudspeaker while preserving accessory routes", () => {
    assert.match(nativeAudioSource, /RTCAudioSessionConfiguration\.webRTC\(\)/u);
    assert.match(nativeAudioSource, /\.defaultToSpeaker/u);
    assert.match(nativeAudioSource, /\.allowBluetoothHFP/u);
    assert.doesNotMatch(nativeAudioSource, /overrideOutputAudioPort/u);
  });

  it("configures native audio before WebRTC opens the microphone", () => {
    const prepareIndex = voiceSessionSource.indexOf(
      "prepareVoiceAudioForConversation(),",
    );
    const captureIndex = voiceSessionSource.indexOf(
      "mediaDevices.getUserMedia({ audio: true, video: false })",
    );

    assert.notEqual(prepareIndex, -1, "voice startup must prepare the native audio route");
    assert.notEqual(captureIndex, -1, "voice startup must open WebRTC microphone capture");
    assert.ok(
      prepareIndex < captureIndex,
      "speaker routing must be configured before WebRTC activates its audio session",
    );
  });

  it("does not open the microphone after a cancelled connection attempt", () => {
    const prepareIndex = voiceSessionSource.indexOf(
      "prepareVoiceAudioForConversation(),",
    );
    const captureIndex = voiceSessionSource.indexOf(
      "mediaDevices.getUserMedia({ audio: true, video: false })",
    );
    const cancellationCheck = voiceSessionSource.indexOf(
      "if (returnIfStaleOrThrowIfTimedOut()) return;",
      prepareIndex,
    );

    assert.ok(
      cancellationCheck > prepareIndex && cancellationCheck < captureIndex,
      "a cancelled native preparation must be checked before microphone capture",
    );
    assert.match(
      voiceSessionSource,
      /awaitConnectionStep\(\s*mediaDevices\.getUserMedia[\s\S]*lateStream[\s\S]*track\.stop\(\)/u,
    );
    assert.match(voiceSessionSource, /awaitConnectionStep\(\s*peer\.createOffer\(/u);
    assert.match(voiceSessionSource, /awaitConnectionStep\(\s*peer\.setLocalDescription\(/u);
    assert.match(voiceSessionSource, /awaitConnectionStep\(\s*answer\.text\(\),/u);
    assert.match(voiceSessionSource, /awaitConnectionStep\(\s*peer\.setRemoteDescription\(/u);
    assert.match(voiceSessionSource, /expectedUserId: string \| null = null/u);
    assert.match(voiceSessionSource, /auth-user-changed/u);
    assert.match(voiceSessionSource, /end = useCallback\(\(options: \{ persist\?: boolean \} = \{\}\)/u);
  });
});
