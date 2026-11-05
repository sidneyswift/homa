import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ageFromBirthDate, mobileFirstMakingJob } from "./mobile-first-making";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const CHILD_ID = "00000000-0000-4000-8000-0000000000c2";

describe("ageFromBirthDate", () => {
  it("counts whole years, not yet a birthday this year", () => {
    assert.equal(ageFromBirthDate("2020-05-15", NOW), 6);
    assert.equal(ageFromBirthDate("2020-11-05", NOW), 5);
  });

  it("returns null for missing, unparseable, or implausible dates", () => {
    assert.equal(ageFromBirthDate(null, NOW), null);
    assert.equal(ageFromBirthDate("not a date", NOW), null);
    assert.equal(ageFromBirthDate("1990-01-01", NOW), null);
  });
});

describe("mobileFirstMakingJob", () => {
  it("names the love and the age, and omits the edge when no focus was picked", () => {
    const job = mobileFirstMakingJob(
      {
        id: CHILD_ID,
        name: "Theo",
        birth_month: "2020-05-01",
        profile: { interests: ["sharks"] },
      },
      NOW,
    );

    assert.equal(job.title, "Theo's sharks page");
    assert.equal(job.plan.theme, "sharks");
    assert.equal(job.plan.kind, "worksheet");
    assert.equal(job.plan.childName, "Theo");
    assert.match(job.plan.request, /^One printable page for Theo, age 6\./u);
    assert.match(job.plan.request, /Theo loves sharks/u);
    assert.doesNotMatch(job.plan.request, /working on/u);
    assert.ok(job.plan.request.includes(`childId must be ${CHILD_ID}`));
  });

  it("aims at the saved focus when the parent picked one", () => {
    const job = mobileFirstMakingJob(
      {
        id: CHILD_ID,
        name: "Theo",
        birth_month: null,
        profile: { interests: [], focus: "blending short words" },
      },
      NOW,
    );

    assert.equal(job.title, "Theo's first page");
    assert.equal(job.plan.theme, undefined);
    assert.match(job.plan.request, /^One printable page for Theo\./u);
    assert.match(
      job.plan.request,
      /They are working on blending short words; land the practice right at that edge\./u,
    );
  });
});
