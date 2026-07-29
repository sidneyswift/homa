import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { parseSchoolYearStart } from "./school-year";

/**
 * The one fact that unlocks filing deadlines in 25 states (gh#418), so
 * what it refuses matters: a bad date here becomes a wrong legal
 * deadline in a family's inbox.
 */

const TODAY = "2026-07-29";

describe("parseSchoolYearStart", () => {
  it("accepts a real date", () => {
    const parsed = parseSchoolYearStart("2026-08-17", TODAY);
    assert.ok(parsed.ok);
    assert.equal(parsed.value, "2026-08-17");
  });

  it("accepts a start already behind us this year", () => {
    const parsed = parseSchoolYearStart("2026-01-05", TODAY);
    assert.ok(parsed.ok);
  });

  it("accepts a start planned for next year", () => {
    const parsed = parseSchoolYearStart("2027-08-20", TODAY);
    assert.ok(parsed.ok);
  });

  it("trims surrounding whitespace", () => {
    const parsed = parseSchoolYearStart("  2026-08-17  ", TODAY);
    assert.ok(parsed.ok);
    assert.equal(parsed.value, "2026-08-17");
  });

  it("asks for the date when nothing was given", () => {
    for (const empty of ["", "   ", null, undefined]) {
      const parsed = parseSchoolYearStart(empty, TODAY);
      assert.ok(!parsed.ok);
      assert.match(parsed.reason, /Add the date/);
    }
  });

  it("refuses a shape it cannot read", () => {
    for (const bad of ["August 17", "08/17/2026", "2026-8-17", "soon"]) {
      const parsed = parseSchoolYearStart(bad, TODAY);
      assert.ok(!parsed.ok, `${bad} should not parse`);
      assert.match(parsed.reason, /like 2026-08-17/);
    }
  });

  it("refuses a day that is not on the calendar", () => {
    // The round trip matters: Date.UTC would roll February 30 into
    // March 2 and save a date the family never gave.
    for (const bad of ["2026-02-30", "2026-13-01", "2026-04-31", "2026-00-10"]) {
      const parsed = parseSchoolYearStart(bad, TODAY);
      assert.ok(!parsed.ok, `${bad} should not parse`);
      assert.match(parsed.reason, /not a date on the calendar/);
    }
  });

  it("accepts February 29 in a leap year", () => {
    const parsed = parseSchoolYearStart("2028-02-29", "2027-07-29");
    assert.ok(parsed.ok);
  });

  it("refuses February 29 in a year without one", () => {
    const parsed = parseSchoolYearStart("2027-02-29", TODAY);
    assert.ok(!parsed.ok);
    assert.match(parsed.reason, /not a date on the calendar/);
  });

  it("refuses dates too far out to be a school year", () => {
    const old = parseSchoolYearStart("2019-08-17", TODAY);
    assert.ok(!old.ok);
    assert.match(old.reason, /too far in the past/);
    const far = parseSchoolYearStart("2031-08-17", TODAY);
    assert.ok(!far.ok);
    assert.match(far.reason, /too far ahead/);
  });

  it("always explains why, never just fails", () => {
    for (const bad of ["", "nope", "2026-02-30", "2019-08-17"]) {
      const parsed = parseSchoolYearStart(bad, TODAY);
      assert.ok(!parsed.ok);
      assert.ok(parsed.reason.length > 10, "a parent has to know what to fix");
    }
  });
});

describe("the writer's tenancy posture", () => {
  it("scopes the update to one family and never takes an id from input", () => {
    const source = readFileSync(
      fileURLToPath(new URL("./school-year.ts", import.meta.url)),
      "utf8",
    );
    const update = source.slice(source.indexOf("update public.families"));
    assert.match(
      update,
      /where id = \$\{familyId\}/,
      "the write must be scoped to the caller's own family",
    );
    assert.ok(
      !/familyId\s*=\s*(formData|input|body)/.test(source),
      "familyId must come from session auth, never from a request",
    );
  });
});
