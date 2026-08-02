import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  readRemoteAudioLevel,
  smoothVoiceLevel,
  visualVoiceLevel,
} from "./remote-audio-level";

describe("remote WebRTC audio level", () => {
  it("reads the standardized inbound audioLevel and ignores other streams", () => {
    const result = readRemoteAudioLevel(new Map([
      ["outbound", { type: "outbound-rtp", kind: "audio", audioLevel: 0.9 }],
      ["video", { type: "inbound-rtp", kind: "video", audioLevel: 0.8 }],
      ["voice", {
        type: "inbound-rtp",
        kind: "audio",
        audioLevel: 0.12,
        totalAudioEnergy: 8,
        totalSamplesDuration: 20,
      }],
    ]));

    assert.equal(result.level, 0.12);
    assert.deepEqual(result.energy, { totalAudioEnergy: 8, totalSamplesDuration: 20 });
  });

  it("derives RMS level from cumulative energy when audioLevel is unavailable", () => {
    const previous = { totalAudioEnergy: 3, totalSamplesDuration: 10 };
    const result = readRemoteAudioLevel(new Map([
      ["voice", {
        type: "inbound-rtp",
        mediaType: "audio",
        totalAudioEnergy: 3.25,
        totalSamplesDuration: 11,
      }],
    ]), previous);

    assert.equal(result.level, 0.5);
  });

  it("returns no fabricated level before an energy delta exists", () => {
    const result = readRemoteAudioLevel(new Map([
      ["voice", {
        type: "inbound-rtp",
        kind: "audio",
        totalAudioEnergy: 2,
        totalSamplesDuration: 8,
      }],
    ]));

    assert.equal(result.level, null);
    assert.deepEqual(result.energy, { totalAudioEnergy: 2, totalSamplesDuration: 8 });
  });

  it("makes conversational speech visible while gating near-silence", () => {
    assert.equal(visualVoiceLevel(0.01), 0);
    assert.ok(visualVoiceLevel(0.05) > 0.35);
    assert.equal(visualVoiceLevel(1), 1);
  });

  it("attacks faster than it releases so words feel responsive without flicker", () => {
    assert.equal(smoothVoiceLevel(0, 1), 0.68);
    assert.equal(smoothVoiceLevel(1, 0), 0.78);
  });
});
