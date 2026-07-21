import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  chatOnboardingEnabled,
  familyOnboardingActive,
  onboardingActiveForRow,
  onboardingRowFromMembership,
  readOnboardingRecord,
} from "./state";

const originalFlag = process.env.HOMA_CHAT_ONBOARDING;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.HOMA_CHAT_ONBOARDING;
  else process.env.HOMA_CHAT_ONBOARDING = originalFlag;
});

describe("readOnboardingRecord", () => {
  it("returns null when the family has never entered the chat flow", () => {
    assert.equal(readOnboardingRecord({ styles: ["charlotte-mason"] }), null);
    assert.equal(readOnboardingRecord({}), null);
    assert.equal(readOnboardingRecord(null), null);
    assert.equal(readOnboardingRecord("not an object"), null);
  });

  it("reads a written record and drops values of the wrong shape", () => {
    assert.deepEqual(
      readOnboardingRecord({
        styles: ["unschooling"],
        onboarding: {
          state: "active",
          beatsDone: ["T2", 7, "T3"],
          checklist: { "child-1": "done", "child-2": 12 },
          updatedAt: "2026-07-21T18:00:00.000Z",
          paywallShownAt: null,
        },
      }),
      {
        state: "active",
        beatsDone: ["T2", "T3"],
        checklist: { "child-1": "done" },
        updatedAt: "2026-07-21T18:00:00.000Z",
        paywallShownAt: null,
      },
    );
  });

  it("reads an unrecognized state as active, never as finished", () => {
    const record = readOnboardingRecord({ onboarding: { state: "paused-for-later" } });
    assert.equal(record?.state, "active");
  });
});

describe("onboardingActiveForRow", () => {
  it("lets the durable record decide once it exists", () => {
    assert.equal(
      onboardingActiveForRow({
        profileCompletedAt: "2026-07-20T10:00:00.000Z",
        context: { onboarding: { state: "active" } },
      }),
      true,
    );
    assert.equal(
      onboardingActiveForRow({
        profileCompletedAt: null,
        context: { onboarding: { state: "done" } },
      }),
      false,
    );
  });

  it("falls back to profile completion for families predating the flow", () => {
    assert.equal(
      onboardingActiveForRow({ profileCompletedAt: null, context: { styles: [] } }),
      true,
    );
    assert.equal(
      onboardingActiveForRow({
        profileCompletedAt: "2026-07-01T10:00:00.000Z",
        context: { styles: [] },
      }),
      false,
    );
  });

  it("does not mark every completed legacy family active", () => {
    // The spec's literal wording (context.onboarding.state != 'done')
    // reads as true for an ABSENT record, which would take the live door
    // wall down for all 46 completed families. Guard that reading.
    assert.equal(
      onboardingActiveForRow({
        profileCompletedAt: "2026-07-01T10:00:00.000Z",
        context: { styles: ["classical"], curriculums: ["TGTB"] },
      }),
      false,
    );
  });
});

describe("onboardingRowFromMembership", () => {
  it("reads the embed whether PostgREST returns an object or an array", () => {
    const family = { profile_completed_at: null, context: { onboarding: { state: "active" } } };
    assert.deepEqual(onboardingRowFromMembership({ families: family }), {
      profileCompletedAt: null,
      context: family.context,
    });
    assert.deepEqual(onboardingRowFromMembership({ families: [family] }), {
      profileCompletedAt: null,
      context: family.context,
    });
  });

  it("degrades an unreadable embed to profile-complete, keeping the wall up", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    for (const shape of [null, undefined, {}, { families: null }, { families: "nope" }]) {
      const row = onboardingRowFromMembership(shape);
      assert.notEqual(row.profileCompletedAt, null);
      assert.equal(familyOnboardingActive(row), false);
    }
  });
});

describe("familyOnboardingActive", () => {
  it("is false for everyone while the flag is off", () => {
    process.env.HOMA_CHAT_ONBOARDING = "";
    assert.equal(chatOnboardingEnabled(), false);
    assert.equal(
      familyOnboardingActive({ profileCompletedAt: null, context: {} }),
      false,
    );
    assert.equal(
      familyOnboardingActive({
        profileCompletedAt: null,
        context: { onboarding: { state: "active" } },
      }),
      false,
    );
  });

  it("applies the predicate once the flag is on", () => {
    process.env.HOMA_CHAT_ONBOARDING = "true";
    assert.equal(chatOnboardingEnabled(), true);
    assert.equal(
      familyOnboardingActive({ profileCompletedAt: null, context: {} }),
      true,
    );
    assert.equal(
      familyOnboardingActive({
        profileCompletedAt: null,
        context: { onboarding: { state: "done" } },
      }),
      false,
    );
  });
});
