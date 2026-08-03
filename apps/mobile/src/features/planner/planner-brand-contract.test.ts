import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sources = [
  "../../app/(tabs)/planner.tsx",
  "./activity-row.tsx",
  "./device-calendar-export-sheet.tsx",
  "./event-card.tsx",
  "./event-composer.tsx",
  "./month-view.tsx",
  "./schedule-activity-sheet.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

test("Planner route uses semantic icons instead of local glyph imports", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /lucide-react-native/u);
  }

  const routeSource = sources[0];
  for (const name of ["back", "next", "calendar", "add", "check"]) {
    assert.match(routeSource, new RegExp(`Icon name="${name}"`, "u"));
  }

  for (const source of sources.filter((candidate) => candidate.includes("components/design/icon"))) {
    assert.match(source, /from ["].*components\/design\/icon/u);
  }
});

test("Planner selected and checked states use the structural Quiet action ink", () => {
  for (const source of sources) {
    assert.doesNotMatch(source, /colors\.brand(?:Hover)?/u);
  }
  assert.match(sources[0], /backgroundColor: colors\.action/u);
  assert.match(sources[1], /borderColor: checked \? colors\.action/u);
  assert.match(sources[5], /entry\.isToday \? colors\.action/u);
});
