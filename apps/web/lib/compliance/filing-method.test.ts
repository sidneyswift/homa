import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isFilingMethodStale,
  mayGenerateLetter,
  verifyFilingMethod,
  type FilingMethodEntry,
} from "./filing-method";
import { FILING_METHODS_BY_STATE } from "./filing-methods.data";

/**
 * This table decides whether Homa puts a document in a family's
 * envelope (gh#420), so the tests are mostly about refusing to.
 */

const TODAY = "2026-07-29";

function entry(overrides: Partial<FilingMethodEntry> = {}): FilingMethodEntry {
  return {
    method: "letter",
    sourceUrl: "https://m.flsenate.gov/statutes/1002.41",
    checkedOn: "2026-07-29",
    evidence:
      "Section 1002.41 requires written notice signed by the parent and filed with the district superintendent.",
    ...overrides,
  };
}

describe("verifyFilingMethod", () => {
  it("accepts a well-researched entry", () => {
    assert.ok(verifyFilingMethod("FL", entry()).ok);
  });

  it("refuses a source that is not the state's own site", () => {
    // A homeschool association's summary may well be accurate and still
    // is not the state saying it, and this entry puts paper in an envelope.
    for (const url of [
      "https://hslda.org/post/florida",
      "https://law.justia.com/codes/florida/",
      "https://www.homeschoolflorida.org/notice",
    ]) {
      const verdict = verifyFilingMethod("FL", entry({ sourceUrl: url }));
      assert.ok(!verdict.ok, `${url} should not be accepted`);
      assert.match(verdict.reason, /not an official state page/);
    }
  });

  it("refuses evidence too thin to tell a finding from a guess", () => {
    const verdict = verifyFilingMethod("FL", entry({ evidence: "letter ok" }));
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /too thin/);
  });

  it("refuses an unknown method or a malformed check date", () => {
    const method = verifyFilingMethod(
      "FL",
      entry({ method: "carrier pigeon" as FilingMethodEntry["method"] }),
    );
    assert.ok(!method.ok);
    const date = verifyFilingMethod("FL", entry({ checkedOn: "last summer" }));
    assert.ok(!date.ok);
  });
});

describe("staleness", () => {
  it("goes stale after a year, because state pages get rewritten", () => {
    const old = entry({ checkedOn: "2025-07-01" });
    assert.ok(isFilingMethodStale(old, TODAY));
    assert.ok(!isFilingMethodStale(entry({ checkedOn: "2026-06-01" }), TODAY));
  });

  it("treats an unreadable date as stale rather than fresh", () => {
    assert.ok(isFilingMethodStale(entry({ checkedOn: "nope" }), TODAY));
  });
});

describe("mayGenerateLetter", () => {
  it("says yes only for a researched, fresh, letter state", () => {
    assert.ok(mayGenerateLetter(entry(), TODAY));
  });

  it("says no for a state nobody has researched", () => {
    assert.ok(!mayGenerateLetter(undefined, TODAY));
  });

  it("says no for a form or portal state", () => {
    assert.ok(!mayGenerateLetter(entry({ method: "state_form" }), TODAY));
    assert.ok(!mayGenerateLetter(entry({ method: "portal" }), TODAY));
  });

  it("says no once the research has gone stale", () => {
    assert.ok(!mayGenerateLetter(entry({ checkedOn: "2024-01-01" }), TODAY));
  });

  it("says no when the source is not the state's own page", () => {
    assert.ok(
      !mayGenerateLetter(entry({ sourceUrl: "https://hslda.org/x" }), TODAY),
    );
  });
});

describe("the researched table", () => {
  it("passes its own verification, every row", () => {
    for (const [code, row] of Object.entries(FILING_METHODS_BY_STATE)) {
      const verdict = verifyFilingMethod(code, row);
      assert.ok(verdict.ok, `${code}: ${verdict.ok ? "" : verdict.reason}`);
    }
  });

  it("keeps Arizona off the letter path", () => {
    // AZ is why the research ruling exists. A generated letter would
    // have gone to the state instead of the county, unnotarized, and
    // without the birth certificate the county files it with.
    const az = FILING_METHODS_BY_STATE.AZ;
    assert.ok(az, "Arizona is researched");
    assert.equal(az.method, "state_form");
    assert.ok(!mayGenerateLetter(az, TODAY));
    assert.match(az.evidence, /notariz/i);
    assert.match(az.evidence, /county/i);
  });

  it("keeps the District of Columbia on its portal", () => {
    const dc = FILING_METHODS_BY_STATE.DC;
    assert.ok(dc);
    assert.equal(dc.method, "portal");
    assert.ok(!mayGenerateLetter(dc, TODAY));
  });

  it("lets Florida and Virginia have a real letter", () => {
    for (const code of ["FL", "VA"]) {
      const row = FILING_METHODS_BY_STATE[code];
      assert.ok(row, `${code} is researched`);
      assert.equal(row.method, "letter");
      assert.ok(mayGenerateLetter(row, TODAY), `${code} may send a letter`);
    }
  });

  it("names where the filing goes wherever it is known", () => {
    for (const [code, row] of Object.entries(FILING_METHODS_BY_STATE)) {
      assert.ok(
        row.submitTo && row.submitTo.length > 3,
        `${code} should say where it goes`,
      );
    }
  });
});
