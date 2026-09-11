import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const sessionSource = readFileSync(
  new URL("./use-voice-session.ts", import.meta.url),
  "utf8",
);
const screenSource = readFileSync(
  new URL("./voice-screen.tsx", import.meta.url),
  "utf8",
);
const characterSource = readFileSync(
  new URL("./homa-character.tsx", import.meta.url),
  "utf8",
);
const auraSource = readFileSync(new URL("./aura.tsx", import.meta.url), "utf8");

describe("native voice audio visualizer", () => {
  it("derives speaking from received audio without waiting for a Realtime response event", () => {
    assert.match(sessionSource, /peer!\.getStats\(\)/u);
    assert.match(sessionSource, /visualLevel > 0 \? "speaking"/u);
    assert.match(sessionSource, /assistantAudioLevel: number \| null/u);
  });

  it("wires the measured level through the character into the aura", () => {
    assert.match(screenSource, /audioLevel=\{session\.assistantAudioLevel\}/u);
    assert.match(characterSource, /<Aura state=\{state\} size=\{size\} audioLevel=\{audioLevel\} \/>/u);
    assert.match(auraSource, /state === "speaking" && audioLevel !== null/u);
  });

  it("keeps reduced-motion users on a stable, non-scaling aura", () => {
    assert.match(auraSource, /if \(reduced\) \{/u);
    assert.match(auraSource, /scale\.value = 1;/u);
  });
});
