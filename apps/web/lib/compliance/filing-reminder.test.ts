import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  planFilingReminders,
  reminderLedgerKind,
  type ReminderCandidate,
} from "./filing-reminder";

/**
 * The reminder decides who hears that a legal deadline is coming
 * (gh#422). Two ways it can be wrong, and both are quiet: it mails
 * nobody and nobody notices, or it mails the same family twice.
 */

const TODAY = "2026-07-29";

function candidate(over: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    familyId: "fam-1",
    email: "robin@example.com",
    firstName: "Robin",
    stateCode: "VA", // August 15, a fixed state calendar date
    planTier: "plus",
    schoolYearStartIso: null,
    ...over,
  };
}

describe("who gets reminded", () => {
  it("reminds a Plus family inside the lead window", () => {
    // Virginia's notice is due August 15, which is 17 days out. At the
    // default 14-day lead that is not yet due; at 21 it is.
    const plan = planFilingReminders([candidate()], TODAY, 21);
    assert.equal(plan.sends.length, 1);
    assert.equal(plan.sends[0].stateCode, "VA");
    assert.equal(plan.sends[0].deadline.dueOn, "2026-08-15");
  });

  it("says nothing when the deadline is still far off", () => {
    const plan = planFilingReminders([candidate()], TODAY, 14);
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.not_due_yet, 1);
  });

  it("holds the line on Plus and Elite", () => {
    const plan = planFilingReminders(
      [
        candidate({ planTier: "regular" }),
        candidate({ familyId: "f2", planTier: "elite" }),
      ],
      TODAY,
      21,
    );
    assert.equal(plan.sends.length, 1);
    assert.equal(plan.sends[0].familyId, "f2");
    assert.equal(plan.skipped.not_entitled, 1);
  });

  it("never emails a state that asks for nothing", () => {
    // New Hampshire repealed its requirement. A reminder there would
    // invent an obligation.
    const plan = planFilingReminders(
      [candidate({ stateCode: "NH" })],
      TODAY,
      365,
    );
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.state_asks_nothing, 1);
  });

  it("skips a family with no address to write to, and no state", () => {
    const plan = planFilingReminders(
      [
        candidate({ email: null }),
        candidate({ familyId: "f2", email: "   " }),
        candidate({ familyId: "f3", stateCode: null }),
      ],
      TODAY,
      21,
    );
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.no_email, 2);
    assert.equal(plan.skipped.no_state, 1);
  });
});

describe("counting the silence", () => {
  it("separates a fixable gap from a state Homa cannot date", () => {
    // The distinction is the whole point: needs_school_year_start is a
    // question Homa can ask, no_deadline is a state with no anchor at
    // all. Reporting both as "skipped" hides a product problem.
    const plan = planFilingReminders(
      [
        // Florida counts 30 days from when the family started, so the
        // deadline is unknowable until they say when that was.
        candidate({ stateCode: "FL", schoolYearStartIso: null }),
        // Texas requires no filing, so there is no anchor at all.
        candidate({ familyId: "f2", stateCode: "TX" }),
      ],
      TODAY,
      21,
    );
    assert.equal(plan.sends.length, 0);
    assert.equal(plan.skipped.needs_school_year_start, 1);
    assert.equal(plan.skipped.no_deadline, 1);
  });

  it("reports every reason as a number, even at zero", () => {
    // A sweep that mails nobody has to be able to say why, so the shape
    // is stable whether or not a reason fired.
    const plan = planFilingReminders([], TODAY);
    assert.deepEqual(plan.sends, []);
    for (const count of Object.values(plan.skipped)) {
      assert.equal(count, 0);
    }
    assert.ok(Object.keys(plan.skipped).length >= 7);
  });

  it("accounts for every candidate exactly once", () => {
    const candidates = [
      candidate({ planTier: "regular" }),
      candidate({ familyId: "f2", email: null }),
      candidate({ familyId: "f3", stateCode: null }),
      candidate({ familyId: "f4", stateCode: "NH" }),
      candidate({ familyId: "f5", stateCode: "FL" }),
      candidate({ familyId: "f6", stateCode: "TX" }),
      candidate({ familyId: "f7" }),
    ];
    const plan = planFilingReminders(candidates, TODAY, 21);
    const total =
      plan.sends.length +
      Object.values(plan.skipped).reduce((sum, n) => sum + n, 0);
    assert.equal(total, candidates.length);
  });
});

describe("the ledger key", () => {
  it("is per deadline, so the reminder is annual and not once ever", () => {
    assert.equal(reminderLedgerKind("2026-08-15"), "filing:2026-08-15");
    assert.notEqual(
      reminderLedgerKind("2026-08-15"),
      reminderLedgerKind("2027-08-15"),
    );
  });

  it("fits the email ledger's 40 character limit", () => {
    assert.ok(reminderLedgerKind("2026-08-15").length <= 40);
  });

  it("is what the plan carries, so a resend cannot be a duplicate", () => {
    const plan = planFilingReminders([candidate()], TODAY, 21);
    assert.equal(plan.sends[0].ledgerKind, "filing:2026-08-15");
  });
});
