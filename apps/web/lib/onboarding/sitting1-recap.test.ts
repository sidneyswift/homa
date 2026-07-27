import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildSitting1RecapMessage, type DueSitting1Recap } from "./sitting1-recap";

function recap(overrides: Partial<DueSitting1Recap> = {}): DueSitting1Recap {
  return {
    familyId: "family-1",
    timeZone: "America/New_York",
    email: "parent@example.test",
    phoneNumbers: [],
    parentFirstName: "Jamie",
    recipientMemberUserId: null,
    artifactTitle: "Mia's dinosaur page",
    childName: "Mia",
    ...overrides,
  };
}

describe("buildSitting1RecapMessage", () => {
  it("names the artifact and the child by title", () => {
    const message = buildSitting1RecapMessage(recap());
    assert.match(message, /"Mia's dinosaur page"/);
    assert.match(message, /for Mia/);
    assert.match(message, /Binder/);
  });

  it("falls back to a plain reference to the parent when no first name is known", () => {
    const message = buildSitting1RecapMessage(recap({ parentFirstName: null }));
    assert.match(message, /the parent/);
  });

  it("omits the child clause when no child name is known", () => {
    const message = buildSitting1RecapMessage(recap({ childName: null }));
    assert.doesNotMatch(message, /for Mia/);
    assert.match(message, /"Mia's dinosaur page" by title,/);
  });

  it("never claims delivery beyond what the dispatcher itself guarantees", () => {
    const message = buildSitting1RecapMessage(recap());
    assert.match(message, /delivered to her EXACTLY as written/);
  });
});
