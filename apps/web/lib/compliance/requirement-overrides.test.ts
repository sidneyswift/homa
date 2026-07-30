import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  parseStateRequirementsPayload,
  type StateRequirementsDetail,
  type StateRequirementsSummary,
} from "../map/state-requirements";
import { deriveDuties } from "./pack";
import {
  applyRequirementOverride,
  isOverrideStale,
  overrideNoteFor,
  REQUIREMENT_OVERRIDES,
  verifyRequirementOverride,
  type RequirementOverride,
} from "./requirement-overrides";

/**
 * An override SUPPRESSES a legal duty, so these tests are mostly about
 * the ways that could go wrong quietly (gh#436).
 */

const STATES_DIR = fileURLToPath(
  new URL("../../../../data/state-requirements/states/", import.meta.url),
);
const INDEX_PATH = fileURLToPath(
  new URL("../../../../data/state-requirements/index.json", import.meta.url),
);
const index = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as {
  states: {
    state_code: string;
    state_name: string;
    regulation_level: StateRequirementsSummary["regulationLevel"];
    compulsory_education: { start_age: number | null; end_age: number | null };
    notification_required: boolean;
    assessment_required: boolean;
    default_pathway: string | null;
    last_verified: string;
  }[];
};

function rawDetail(code: string): StateRequirementsDetail {
  const entry = index.states.find((s) => s.state_code === code);
  assert.ok(entry, `index entry for ${code}`);
  const payload = JSON.parse(
    readFileSync(`${STATES_DIR}${code}.json`, "utf8"),
  ) as Record<string, unknown>;
  return parseStateRequirementsPayload(
    {
      stateCode: entry.state_code,
      stateName: entry.state_name,
      regulationLevel: entry.regulation_level,
      compulsoryStartAge: entry.compulsory_education?.start_age ?? null,
      compulsoryEndAge: entry.compulsory_education?.end_age ?? null,
      notificationRequired: entry.notification_required,
      assessmentRequired: entry.assessment_required,
      defaultPathway: entry.default_pathway,
      sourcePageUrl: typeof payload.page_url === "string" ? payload.page_url : null,
      sourceLastVerified: entry.last_verified,
    },
    payload,
  );
}

const TODAY = "2026-07-29";

function entry(over: Partial<RequirementOverride> = {}): RequirementOverride {
  return {
    notificationRequired: false,
    sourceUrl: "https://gc.nh.gov/bill_status/pdf.aspx?q=amendment&id=2026-0606H",
    checkedOn: "2026-07-29",
    effectiveOn: "2026-07-10",
    evidence:
      'New RSA 193-A:3 reads "A declaration of home education shall not be required, except to obtain access to public school programs pursuant to RSA 193:1-c or upon withdrawal from a public school."',
    familyNote: "New Hampshire changed its law in July 2026, so there is nothing to file.",
    ...over,
  };
}

describe("verifyRequirementOverride", () => {
  it("accepts a well-evidenced entry", () => {
    assert.ok(verifyRequirementOverride("NH", entry()).ok);
  });

  it("refuses a source that is not the state's own", () => {
    // This entry removes a legal duty. A homeschool association saying so
    // is not the legislature saying so.
    for (const url of [
      "https://hslda.org/post/nh",
      "https://law.justia.com/codes/new-hampshire/",
      "https://en.wikipedia.org/wiki/Homeschooling",
    ]) {
      const verdict = verifyRequirementOverride("NH", entry({ sourceUrl: url }));
      assert.ok(!verdict.ok, url);
      assert.match(verdict.reason, /not an official state page/);
    }
  });

  it("refuses evidence too thin to suppress a duty", () => {
    const verdict = verifyRequirementOverride(
      "NH",
      entry({ evidence: "the law changed" }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /too thin/);
  });

  it("refuses an entry that removes nothing", () => {
    const verdict = verifyRequirementOverride(
      "NH",
      entry({ notificationRequired: undefined }),
    );
    assert.ok(!verdict.ok);
    assert.match(verdict.reason, /removes nothing/);
  });

  it("refuses an impossible date", () => {
    assert.ok(!verifyRequirementOverride("NH", entry({ checkedOn: "2026-02-30" })).ok);
    assert.ok(!verifyRequirementOverride("NH", entry({ effectiveOn: "soon" })).ok);
  });
});

describe("staleness fails toward the snapshot", () => {
  it("expires after the window, because a suppression must not outlive its reading", () => {
    assert.ok(isOverrideStale(entry({ checkedOn: "2025-01-01" }), TODAY));
    assert.ok(!isOverrideStale(entry(), TODAY));
  });

  it("stops applying once stale, restoring the reviewed snapshot", () => {
    // The snapshot overstates duties rather than understating them, so
    // falling back to it is the safe direction.
    const raw = rawDetail("NH");
    const late = applyRequirementOverride(raw, "2030-01-01");
    assert.equal(late.notificationRequired, raw.notificationRequired);
    assert.equal(overrideNoteFor("NH", "2030-01-01"), null);
  });
});

describe("New Hampshire, after the 2026 repeal", () => {
  it("was telling families to do three things the legislature deleted", () => {
    // The bug, pinned. 2026 Chapter 297 repealed and reenacted RSA
    // 193-A:1-5 and repealed 193-A:6 outright.
    const before = deriveDuties(rawDetail("NH"));
    assert.equal(before.notification, true);
    assert.equal(before.assessmentConcrete, true);
    assert.equal(before.portfolio, true);
    assert.equal(before.zeroDuty, false);
  });

  it("now asks for nothing", () => {
    const after = deriveDuties(applyRequirementOverride(rawDetail("NH"), TODAY));
    assert.equal(after.notification, false);
    assert.equal(after.assessmentConcrete, false);
    assert.equal(after.portfolio, false);
    assert.equal(after.attendance, false);
    assert.equal(after.zeroDuty, true);
  });

  it("clears every pathway, not just the default", () => {
    // Otherwise the pack's own other-pathways page would still name a
    // notice the legislature deleted.
    const fixed = applyRequirementOverride(rawDetail("NH"), TODAY);
    for (const pathway of fixed.pathways) {
      assert.equal(pathway.notification.required, false);
      assert.equal(pathway.assessment.required, false);
      assert.equal(pathway.recordkeeping.portfolioRequired, false);
    }
  });

  it("collapses three notify-someone pathways into one", () => {
    // They differed only by which body received the notice.
    assert.equal(rawDetail("NH").pathways.length, 3);
    assert.equal(applyRequirementOverride(rawDetail("NH"), TODAY).pathways.length, 1);
  });

  it("renames the pathway, so no page says Notify under No notification", () => {
    const fixed = applyRequirementOverride(rawDetail("NH"), TODAY);
    assert.equal(fixed.defaultPathwayDetail?.name, "Home education program");
    for (const pathway of fixed.pathways) {
      assert.ok(!/notify/i.test(pathway.name), pathway.name);
    }
    assert.ok(!/notify/i.test(String(fixed.defaultPathway)));
  });

  it("restamps the verified date, so July rules are not stamped March", () => {
    assert.equal(rawDetail("NH").sourceLastVerified, "2026-03-14");
    assert.equal(
      applyRequirementOverride(rawDetail("NH"), TODAY).sourceLastVerified,
      "2026-07-29",
    );
  });

  it("gives the family a plain sentence about why", () => {
    const note = overrideNoteFor("NH", TODAY);
    assert.ok(note && note.length > 20);
    assert.match(note, /July 2026/);
  });
});

describe("the shipped table", () => {
  it("passes its own verification, every row", () => {
    for (const [code, row] of Object.entries(REQUIREMENT_OVERRIDES)) {
      const verdict = verifyRequirementOverride(code, row);
      assert.ok(verdict.ok, `${code}: ${verdict.ok ? "" : verdict.reason}`);
    }
  });

  it("is none of my business for every other state", () => {
    // A silent change to a state nobody researched is the failure this
    // guards: overrides are a correction layer, not a second data source.
    for (const code of ["CA", "FL", "NY", "PA", "TX", "VA"]) {
      const raw = rawDetail(code);
      const after = applyRequirementOverride(raw, TODAY);
      assert.deepEqual(after, raw, `${code} must pass through untouched`);
    }
  });

  it("stays small, and every entry names the act it rests on", () => {
    for (const [code, row] of Object.entries(REQUIREMENT_OVERRIDES)) {
      assert.ok(row.evidence.includes('"'), `${code} evidence must quote the law`);
      assert.ok(row.effectiveOn <= row.checkedOn, `${code} read before it took effect`);
    }
  });
});
