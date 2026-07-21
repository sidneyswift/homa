import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatHiddenDirective,
  hasVisibleText,
  isHiddenDirective,
  parseHiddenDirective,
} from "./directives";

describe("isHiddenDirective", () => {
  it("matches the bare kickoff marker, with surrounding whitespace", () => {
    assert.equal(isHiddenDirective("[[homa:onboarding kickoff]]"), true);
    assert.equal(isHiddenDirective("  [[homa:onboarding kickoff]]\n"), true);
  });

  it("matches a marker carrying hints", () => {
    assert.equal(
      isHiddenDirective(
        "[[homa:onboarding checklist_complete childId=abc-123 answered=41 skipped=3]]",
      ),
      true,
    );
  });

  it("leaves an ordinary message alone", () => {
    assert.equal(isHiddenDirective("Mia is six and loves dinosaurs"), false);
    assert.equal(isHiddenDirective(""), false);
  });

  it("does not hide half of a message she actually wrote", () => {
    assert.equal(
      isHiddenDirective("here you go [[homa:onboarding kickoff]] thanks"),
      false,
    );
  });

  it("rejects a marker from another namespace", () => {
    assert.equal(isHiddenDirective("[[homa:something else]]"), false);
    assert.equal(isHiddenDirective("[[kickoff]]"), false);
  });
});

describe("parseHiddenDirective", () => {
  it("returns the name and the hints", () => {
    assert.deepEqual(
      parseHiddenDirective(
        "[[homa:onboarding checklist_complete childId=abc-123 answered=41 skipped=3]]",
      ),
      {
        name: "checklist_complete",
        params: { childId: "abc-123", answered: "41", skipped: "3" },
        raw: "[[homa:onboarding checklist_complete childId=abc-123 answered=41 skipped=3]]",
      },
    );
  });

  it("returns a name with no hints for a bare marker", () => {
    const parsed = parseHiddenDirective("[[homa:onboarding resume]]");
    assert.equal(parsed?.name, "resume");
    assert.deepEqual(parsed?.params, {});
  });

  it("returns null for an ordinary message", () => {
    assert.equal(parseHiddenDirective("hello"), null);
  });
});

describe("formatHiddenDirective", () => {
  it("round-trips through its own parser", () => {
    const text = formatHiddenDirective("checklist_complete", {
      childId: "abc-123",
      answered: 41,
      skipped: 0,
    });
    assert.equal(isHiddenDirective(text), true);
    assert.deepEqual(parseHiddenDirective(text)?.params, {
      childId: "abc-123",
      answered: "41",
      // 0 stringifies to "0", which the grammar admits.
      skipped: "0",
    });
  });

  it("drops empty values rather than emitting a marker that fails to parse", () => {
    const text = formatHiddenDirective("kickoff", { childId: null, note: undefined });
    assert.equal(text, "[[homa:onboarding kickoff]]");
    assert.equal(isHiddenDirective(text), true);
  });

  it("strips characters that would break out of the marker", () => {
    const text = formatHiddenDirective("panel_opened", {
      panel: "planner]] and now I am loose",
    });
    assert.equal(isHiddenDirective(text), true);
    assert.equal(parseHiddenDirective(text)?.params.panel, "plannerandnowIamloose");
  });
});

describe("hasVisibleText", () => {
  it("is false for a directive and for whitespace, true for her words", () => {
    assert.equal(hasVisibleText("[[homa:onboarding kickoff]]"), false);
    assert.equal(hasVisibleText("   "), false);
    assert.equal(hasVisibleText("Leo is four"), true);
  });
});
