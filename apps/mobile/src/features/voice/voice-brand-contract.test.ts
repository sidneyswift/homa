import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screenSource = readFileSync(new URL("./voice-screen.tsx", import.meta.url), "utf8");
const dockSource = readFileSync(new URL("./voice-dock.tsx", import.meta.url), "utf8");

test("Voice route controls use the semantic icon adapter", () => {
  assert.doesNotMatch(screenSource, /lucide-react-native/u);
  assert.doesNotMatch(dockSource, /lucide-react-native/u);

  for (const name of ["close", "voice", "muted"]) {
    assert.match(screenSource, new RegExp(`Icon name="${name}"`, "u"));
  }
  for (const name of ["chat", "voice", "muted", "end", "collapse"]) {
    assert.match(dockSource, new RegExp(`Icon name="${name}"`, "u"));
  }
});

test("Voice controls keep the Quiet touch and appearance contracts", () => {
  assert.match(screenSource, /width: 44, height: 44/u);
  assert.match(dockSource, /useColorScheme/u);
  assert.match(dockSource, /darkColors\.surfaceRaised/u);
  assert.match(dockSource, /accessibilityState=\{\{ busy:/u);
});
