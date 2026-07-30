import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FILING_DETAIL_COPY,
  FILING_DETAILS,
  filingDetailsComplete,
  missingFilingDetails,
  type FilingDetailInput,
} from "./filing-details";
import {
  MAX_NUDGES,
  NUDGE_DAYS,
  nudgeLedgerKind,
  planDetailNudges,
  type NudgeCandidate,
} from "./filing-details-drip";

/**
 * This decides what Homa asks a family for, and how often (gh#424).
 * Founder ruling 3 says "nudges until complete"; the tests are mostly
 * about the two ways that becomes nagging.
 */

const TODAY = "2026-07-30";

function input(over: Partial<FilingDetailInput> = {}): FilingDetailInput {
  return {
    stateCode: "FL",
    filingParentName: "Robin Walker",
    addressLine: "44 Mill Lane",
    addressCity: "Gainesville",
    addressZip: "32601",
    schoolYearStartIso: "2026-08-20",
    children: [{ name: "Finn", birthdate: "2018-03-09" }],
    todayIso: TODAY,
    ...over,
  };
}

describe("only things a parent can actually fix", () => {
  it("says nothing is missing when everything is filled in", () => {
    assert.deepEqual(missingFilingDetails(input()), []);
    assert.ok(filingDetailsComplete(input()));
  });

  it("names each missing piece", () => {
    assert.deepEqual(missingFilingDetails(input({ filingParentName: null })), [
      "filing_name",
    ]);
    assert.deepEqual(missingFilingDetails(input({ addressZip: "  " })), [
      "home_address",
    ]);
    assert.deepEqual(
      missingFilingDetails(input({ children: [{ name: "Finn", birthdate: null }] })),
      ["child_birthdate"],
    );
  });

  it("treats a partial address as missing, the same rule the letter uses", () => {
    // Half a mailing address is not deliverable and looks filled in.
    for (const partial of [
      { addressLine: null },
      { addressCity: null },
      { addressZip: null },
    ]) {
      assert.deepEqual(missingFilingDetails(input(partial)), ["home_address"]);
    }
  });

  it("never asks for a school year start the state does not need", () => {
    // Virginia names August 15 outright, so the family's own start date
    // is not part of computing their deadline.
    assert.deepEqual(
      missingFilingDetails(
        input({ stateCode: "VA", schoolYearStartIso: null }),
      ),
      [],
    );
    // Florida counts 30 days from when the family began, so it is.
    assert.deepEqual(
      missingFilingDetails(
        input({ stateCode: "FL", schoolYearStartIso: null }),
      ),
      ["school_year_start"],
    );
  });

  it("asks for nothing at all where the state asks for nothing", () => {
    // New Hampshire repealed its requirement. Asking a family there for
    // their address "for the filing" asks for a filing that does not exist.
    assert.deepEqual(
      missingFilingDetails(
        input({
          stateCode: "NH",
          filingParentName: null,
          addressLine: null,
          addressCity: null,
          addressZip: null,
          schoolYearStartIso: null,
        }),
      ),
      [],
    );
  });

  it("asks for nothing when Homa does not know the state", () => {
    assert.deepEqual(
      missingFilingDetails(input({ stateCode: null, filingParentName: null })),
      [],
    );
  });

  it("never asks for something with nowhere to enter it", () => {
    // Colorado's planned hours, Virginia's curriculum list and statutory
    // qualification are all blanks on the document and none has a home
    // in settings, so none may ever appear here: a nudge for something
    // unfixable never completes, which is nagging forever.
    for (const detail of FILING_DETAILS) {
      assert.ok(
        FILING_DETAIL_COPY[detail].where.startsWith("/app/"),
        `${detail} must point somewhere a parent can go`,
      );
    }
    const co = missingFilingDetails(
      input({ stateCode: "CO", schoolYearStartIso: null }),
    );
    assert.ok(!co.some((d) => String(d).includes("hours")));
  });
});

describe("the cadence stops", () => {
  function candidate(over: Partial<NudgeCandidate> = {}): NudgeCandidate {
    return {
      ...input({ filingParentName: null }),
      familyId: "fam-1",
      email: "robin@example.com",
      firstName: "Robin",
      planTier: "plus",
      eligibleSinceIso: "2026-07-01",
      nudgesSent: [],
      ...over,
    };
  }

  it("sends the first nudge two days in, not before", () => {
    // Joined two days ago: due.
    const due = planDetailNudges(
      [candidate({ eligibleSinceIso: "2026-07-28" })],
      TODAY,
    );
    assert.equal(due.sends.length, 1);
    // Joined yesterday: not yet. A parent who signed up last night is
    // still setting up, and the ruling says "a couple days into it".
    for (const since of ["2026-07-29", "2026-07-30"]) {
      const tooSoon = planDetailNudges(
        [candidate({ eligibleSinceIso: since })],
        TODAY,
      );
      assert.equal(tooSoon.sends.length, 0, since);
      assert.equal(tooSoon.skipped.too_soon, 1, since);
    }
  });

  it("widens, so a parent who has not answered is not asked weekly", () => {
    assert.deepEqual([...NUDGE_DAYS], [2, 9, 30]);
    // Sent step 1, five days in: step 2 is not due until day 9.
    const mid = planDetailNudges(
      [candidate({ eligibleSinceIso: "2026-07-25", nudgesSent: [1] })],
      TODAY,
    );
    assert.equal(mid.sends.length, 0);
    assert.equal(mid.skipped.too_soon, 1);
  });

  it("stops after three, forever", () => {
    const done = planDetailNudges(
      [
        candidate({
          eligibleSinceIso: "2026-01-01",
          nudgesSent: [1, 2, 3],
        }),
      ],
      TODAY,
    );
    assert.equal(done.sends.length, 0);
    assert.equal(done.skipped.sequence_finished, 1);
    assert.equal(MAX_NUDGES, 3);
  });

  it("stops the moment she fills everything in, mid-sequence", () => {
    const complete = planDetailNudges(
      [
        candidate({
          filingParentName: "Robin Walker",
          eligibleSinceIso: "2026-01-01",
          nudgesSent: [1],
        }),
      ],
      TODAY,
    );
    assert.equal(complete.sends.length, 0);
    assert.equal(complete.skipped.nothing_missing, 1);
  });

  it("holds the line on Plus and Elite", () => {
    const plan = planDetailNudges(
      [
        candidate({ planTier: "regular" }),
        candidate({ familyId: "f2", planTier: "elite" }),
      ],
      TODAY,
    );
    assert.equal(plan.sends.length, 1);
    assert.equal(plan.sends[0].familyId, "f2");
    assert.equal(plan.skipped.not_entitled, 1);
  });

  it("carries exactly what is missing, so the email can name it", () => {
    const plan = planDetailNudges(
      [candidate({ addressZip: null, children: [{ name: "Finn", birthdate: null }] })],
      TODAY,
    );
    assert.deepEqual(plan.sends[0].missing, [
      "filing_name",
      "home_address",
      "child_birthdate",
    ]);
    assert.equal(plan.sends[0].index, 1);
    assert.equal(plan.sends[0].ledgerKind, "filing_details_1");
  });

  it("accounts for every candidate exactly once", () => {
    const candidates = [
      candidate({ planTier: "regular" }),
      candidate({ familyId: "f2", email: null }),
      candidate({ familyId: "f3", filingParentName: "Robin Walker" }),
      candidate({ familyId: "f4", eligibleSinceIso: "2026-07-30" }),
      candidate({ familyId: "f5", nudgesSent: [1, 2, 3] }),
      candidate({ familyId: "f6" }),
    ];
    const plan = planDetailNudges(candidates, TODAY);
    const total =
      plan.sends.length +
      Object.values(plan.skipped).reduce((sum, n) => sum + n, 0);
    assert.equal(total, candidates.length);
  });

  it("keys each step separately, so a resend cannot duplicate", () => {
    assert.equal(nudgeLedgerKind(1), "filing_details_1");
    assert.equal(nudgeLedgerKind(3), "filing_details_3");
    assert.ok(nudgeLedgerKind(1).length <= 40);
  });
});
