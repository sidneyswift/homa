import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const screenSource = readFileSync(
  new URL("./voice-screen.tsx", import.meta.url),
  "utf8",
);
const cardsSource = readFileSync(
  new URL("./voice-prompt-starters.tsx", import.meta.url),
  "utf8",
);

describe("native Voice prompt starter wiring", () => {
  it("renders the cards on Voice and uses the existing realtime request path", () => {
    assert.match(screenSource, /<VoicePromptStarters/u);
    assert.match(screenSource, /session\.sendText\(starter\.action\.text\)/u);
  });

  it("keeps direct routes direct and gives every card an accessible label", () => {
    assert.match(screenSource, /router\.navigate\(starter\.action\.href\)/u);
    assert.match(cardsSource, /accessibilityLabel=\{starter\.label\}/u);
    assert.match(cardsSource, /minHeight: 56/u);
  });

  it("makes the cards the only idle call to action", () => {
    assert.match(screenSource, /const statusText = startersVisible \|\| overlayActive/u);
  });
});
