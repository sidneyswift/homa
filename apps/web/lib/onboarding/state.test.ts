import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  chatOnboardingEnabled,
  familyOnboardingActive,
  appWouldAdmit,
  ONBOARDING_BACKSTOP_DAYS,
  onboardingActiveForRow,
  onboardingCompletionCause,
  onboardingCompletionReached,
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

describe("appWouldAdmit", () => {
  it("admits a finished profile with a child", () => {
    assert.equal(
      appWouldAdmit({ profileCompletedAt: "2026-07-22T00:00:00Z", childCount: 1 }),
      true,
    );
  });

  it("refuses a finished profile with no children", () => {
    // The redirect loop: /onboarding used to hand this family to /app on
    // the profile column alone, and /app sent it straight back.
    assert.equal(
      appWouldAdmit({ profileCompletedAt: "2026-07-22T00:00:00Z", childCount: 0 }),
      false,
    );
  });

  it("refuses an unfinished profile however many children", () => {
    assert.equal(appWouldAdmit({ profileCompletedAt: null, childCount: 3 }), false);
  });
});

describe("onboardingCompletionReached", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date("2026-08-01T00:00:00.000Z");
  const base = {
    profileCompletedAt: "2026-07-24T00:00:00.000Z",
    childCount: 2,
    scoredReportCount: 1,
    recordUpdatedAt: "2026-07-24T00:00:00.000Z",
    now,
  };

  it("finishes when setup, one child, and one scored report are complete", () => {
    assert.equal(onboardingCompletionReached(base), true);
  });

  it("keeps onboarding active until every happy-path milestone exists", () => {
    assert.equal(
      onboardingCompletionReached({ ...base, profileCompletedAt: null }),
      false,
    );
    assert.equal(onboardingCompletionReached({ ...base, childCount: 0 }), false);
    assert.equal(
      onboardingCompletionReached({ ...base, scoredReportCount: 0 }),
      false,
    );
  });

  it("releases a family stranded past the backstop", () => {
    assert.equal(
      onboardingCompletionReached({
        ...base,
        scoredReportCount: 0,
        recordUpdatedAt: new Date(
          now.getTime() - ONBOARDING_BACKSTOP_DAYS * day,
        ).toISOString(),
      }),
      true,
    );
  });

  it("holds a family one day short of the backstop", () => {
    assert.equal(
      onboardingCompletionReached({
        ...base,
        scoredReportCount: 0,
        recordUpdatedAt: new Date(
          now.getTime() - (ONBOARDING_BACKSTOP_DAYS - 1) * day,
        ).toISOString(),
      }),
      false,
    );
  });

  it("does not strand a record that predates updatedAt", () => {
    // A null updatedAt must not read as age zero forever; it simply
    // cannot be aged out, so an incomplete family stays active.
    assert.equal(onboardingCompletionReached({
      ...base,
      scoredReportCount: 0,
      recordUpdatedAt: null,
    }), false);
  });
});

describe("onboardingCompletionCause", () => {
  const day = 24 * 60 * 60 * 1000;
  const now = new Date("2026-08-01T00:00:00.000Z");
  const base = {
    profileCompletedAt: "2026-07-24T00:00:00.000Z",
    childCount: 2,
    scoredReportCount: 1,
    recordUpdatedAt: "2026-07-24T00:00:00.000Z",
    now,
  };

  it("names the real arc keystone", () => {
    assert.equal(onboardingCompletionCause(base), "keystone");
  });

  it("names the stranded release backstop", () => {
    assert.equal(
      onboardingCompletionCause({
        ...base,
        scoredReportCount: 0,
        recordUpdatedAt: new Date(
          now.getTime() - ONBOARDING_BACKSTOP_DAYS * day,
        ).toISOString(),
      }),
      "backstop",
    );
  });

  it("lets the keystone win the telling when both doors are open", () => {
    // A family who scored a report and then sat past the backstop really
    // finished the arc; folding her into "backstop" would pollute the
    // abandonment population the funnel reads that cause for.
    assert.equal(
      onboardingCompletionCause({
        ...base,
        recordUpdatedAt: new Date(
          now.getTime() - (ONBOARDING_BACKSTOP_DAYS + 5) * day,
        ).toISOString(),
      }),
      "keystone",
    );
  });

  it("stays null while neither door is open", () => {
    assert.equal(
      onboardingCompletionCause({ ...base, scoredReportCount: 0 }),
      null,
    );
  });
});
