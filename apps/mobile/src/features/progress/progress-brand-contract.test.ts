import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sources = [
  "../../app/(tabs)/progress.tsx",
  "./kid-switcher.tsx",
  "./progress-next-move-card.tsx",
  "./subject-card.tsx",
  "./topic-row.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

test("Progress route keeps controls on the semantic icon adapter", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /lucide-react-native/u);
  }
  assert.match(sources[3], /name="collapse"/u);
  assert.match(sources[3], /expanded \? "180deg" : "0deg"/u);
});

test("Progress selection stays structural and evidence remains text-first", () => {
  assert.match(sources[1], /backgroundColor: active \? colors\.action/u);
  assert.match(sources[1], /accessibilityState=\{\{ selected: active \}\}/u);
  assert.match(sources[2], /nextMove\.minutes/u);
  assert.doesNotMatch(sources[2], /Clock3/u);
  assert.match(sources[3], /progressSubjectSummary\(subject, timeZone, conflicts\)/u);
  assert.match(sources[4], /progressTopicStateLabel\(topic\.state\)/u);
});
