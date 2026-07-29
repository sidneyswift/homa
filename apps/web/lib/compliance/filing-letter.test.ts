import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { EM_DASH } from "@homa/core";

import {
  parseStateRequirementsPayload,
  type StateRequirementsDetail,
  type StateRequirementsSummary,
} from "../map/state-requirements";
import {
  ageOn,
  birthdateLong,
  composeFilingLetter,
  type FilingLetterFamily,
} from "./filing-letter";
import { FILING_METHODS_BY_STATE } from "./filing-methods.data";

/**
 * The letter is the filing (gh#421). These tests are mostly about the
 * two ways it can hurt a family: sending a letter where the state will
 * refuse one, and inventing a detail the family never gave.
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

function loadDetail(code: string): StateRequirementsDetail {
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

const TODAY_ISO = "2026-07-29";
const TODAY_LONG = "July 29, 2026";

const COMPLETE: FilingLetterFamily = {
  parentName: "Robin Walker",
  addressLine: "44 Mill Lane",
  addressCity: "Gainesville, FL",
  addressZip: "32601",
  children: [
    { name: "Finn Walker", birthdate: "2018-03-09", grade: "3rd" },
    { name: "Maya Walker", birthdate: "2020-11-21", grade: "1st" },
  ],
};

function compose(code: string, family = COMPLETE) {
  return composeFilingLetter({
    detail: loadDetail(code),
    method: FILING_METHODS_BY_STATE[code],
    family,
    todayIso: TODAY_ISO,
    todayLong: TODAY_LONG,
    dueLong: "August 15, 2026",
  });
}

describe("birthdateLong", () => {
  it("formats a full date and a month-only date", () => {
    assert.equal(birthdateLong("2018-03-09"), "March 9, 2018");
    assert.equal(birthdateLong("2019-05"), "May 2019");
  });
  it("never invents a day it was not given", () => {
    assert.ok(!String(birthdateLong("2019-05")).match(/\d{1,2},/));
  });
  it("returns nothing for junk", () => {
    assert.equal(birthdateLong(null), null);
    assert.equal(birthdateLong("soon"), null);
  });
});

describe("letter states get a real letter", () => {
  for (const code of ["CO", "FL", "HI", "ME", "NH", "OH", "VA", "WV"]) {
    it(`${code} composes a signable filing`, () => {
      const letter = compose(code);
      assert.equal(letter.kind, "letter");
      assert.match(letter.body, /Signature of parent or guardian/);
      assert.match(letter.body, /Robin Walker/);
      assert.match(letter.body, /Finn Walker/);
      assert.ok(!EM_DASH.test(letter.body), `${code} has an em dash`);
      assert.ok(!/<script/i.test(letter.body));
    });
  }

  it("carries the assurances the state names, in its own terms", () => {
    // West Virginia's notice is incomplete without them, however well
    // addressed it is.
    const wv = compose("WV");
    assert.match(wv.body, /reading, language, mathematics/i);
    assert.match(wv.body, /assessed annually/i);
  });

  it("supplies a required field rather than quoting the statute back", () => {
    // Florida names the fields its notice must carry. The failure this
    // guards is a letter that says "this notice confirms the full legal
    // name, address and date of birth of each child" and then supplies
    // none of them.
    const fl = compose("FL");
    assert.ok(
      !/confirms.*(full legal name|date of birth of each child)/i.test(fl.body),
      "a required field must be answered, never recited",
    );
    assert.match(fl.body, /Finn Walker/);
    assert.match(fl.body, /March 9, 2018/);
    assert.match(fl.body, /44 Mill Lane/);
  });

  it("computes age where the state asks for it, and only from a full birthdate", () => {
    // Colorado wants each child's age. Finn was born 2018-03-09, so on
    // 2026-07-29 he is 8, not 7: the birthday has passed this year.
    const co = compose("CO");
    assert.match(co.body, /<th>Age<\/th>/);
    assert.match(co.body, /<td>8<\/td>/);
    assert.match(co.body, /<td>5<\/td>/); // Maya, born 2020-11-21
    assert.ok(!compose("FL").body.includes("<th>Age</th>"));
  });

  it("leaves the state's unanswerable field blank instead of guessing it", () => {
    // Homa logs hours after they happen; Colorado's notice asks what the
    // family plans before the year starts. Those are different numbers.
    const co = compose("CO");
    assert.ok(co.gaps.some((g) => /Hours of instruction/i.test(g)));
    assert.match(co.body, /only you can answer it/);
    assert.ok(!/\b\d+ hours\b/i.test(co.body), "no invented hour count");
  });

  it("does not put the planner's subject list in a legal filing", () => {
    // Virginia wants the year's subjects and the parent's qualification.
    // Homa's planner knows the first, but the parent signs this.
    const va = compose("VA");
    assert.ok(va.gaps.some((g) => /Subjects you plan to teach/i.test(g)));
    assert.ok(
      va.gaps.some((g) => /What qualifies you to teach under Virginia law/i.test(g)),
    );
  });

  it("tells the family what to enclose rather than omitting it", () => {
    const wv = compose("WV");
    assert.match(wv.body, /Enclose with this letter/);
    assert.match(wv.body, /diploma/i);
    assert.match(wv.body, /Homa cannot produce these/);
  });

  it("addresses it to the body the state named", () => {
    const oh = compose("OH");
    assert.match(oh.body, /superintendent/i);
  });
});

describe("every other state gets a worksheet, never a letter", () => {
  for (const code of ["AZ", "CA", "DC", "PA", "AR", "NY", "MA"]) {
    it(`${code} refuses to produce a mailable filing`, () => {
      const out = compose(code);
      assert.equal(out.kind, "worksheet", `${code} must not send a letter`);
      assert.ok(
        !/Signature of parent or guardian/.test(out.body),
        `${code} worksheet must not look signable`,
      );
      assert.match(out.body, /not the filing/);
    });
  }

  it("says why, in the state's own shape", () => {
    assert.match(compose("DC").body, /online system/i);
    assert.match(compose("AZ").body, /own form/i);
    // Unresearched: honest about not knowing rather than guessing.
    assert.match(compose("NY").body, /has not confirmed/i);
  });
});

describe("gaps are marked, never invented", () => {
  const SPARSE: FilingLetterFamily = {
    parentName: null,
    addressLine: null,
    addressCity: null,
    addressZip: null,
    children: [{ name: "Finn", birthdate: null, grade: null }],
  };

  it("leaves a blank line and names the gap", () => {
    const letter = compose("FL", SPARSE);
    assert.ok(letter.gaps.includes("Parent or guardian"));
    assert.ok(letter.gaps.includes("Home address"));
    assert.ok(letter.gaps.some((g) => g.includes("Grade level for Finn")));
    assert.match(letter.body, /fl-blank/);
  });

  it("still produces the filing, because a gap must not cost a deadline", () => {
    const letter = compose("FL", SPARSE);
    assert.equal(letter.kind, "letter");
    assert.match(letter.body, /Signature of parent or guardian/);
  });

  it("never derives a grade from a birthdate", () => {
    const letter = compose("FL", {
      ...COMPLETE,
      children: [{ name: "Finn Walker", birthdate: "2018-03-09", grade: null }],
    });
    assert.ok(letter.gaps.some((g) => g.includes("Grade level")));
    assert.ok(
      !/3rd|third|grade 3/i.test(letter.body),
      "grade placement is the parent's call, never Homa's arithmetic",
    );
  });

  it("prints a month-only birthdate without a fabricated day", () => {
    const letter = compose("FL", {
      ...COMPLETE,
      children: [{ name: "Story", birthdate: "2022-11", grade: "K" }],
    });
    assert.match(letter.body, /November 2022/);
    assert.ok(!/November \d{1,2}, 2022/.test(letter.body));
  });

  it("reports no gaps when the family is complete", () => {
    assert.deepEqual(compose("FL").gaps, []);
  });
});

describe("ageOn", () => {
  it("counts whole years, and knows whether the birthday has passed", () => {
    assert.equal(ageOn("2018-03-09", "2026-07-29"), 8);
    assert.equal(ageOn("2018-09-09", "2026-07-29"), 7);
    assert.equal(ageOn("2018-07-29", "2026-07-29"), 8, "birthday today counts");
    assert.equal(ageOn("2018-07-30", "2026-07-29"), 7, "tomorrow does not");
  });

  it("refuses a month-only birthdate rather than picking an answer", () => {
    // Ambiguous by up to a month, which near a birthday is two different
    // answers in a filing that can be age-gated.
    assert.equal(ageOn("2018-03", "2026-07-29"), null);
    assert.equal(ageOn(null, "2026-07-29"), null);
    assert.equal(ageOn("not a date", "2026-07-29"), null);
  });
});

describe("across every state", () => {
  it("composes something safe for all 51, and mails only the researched eight", () => {
    const codes = readdirSync(STATES_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    const mailed: string[] = [];
    for (const code of codes) {
      const out = compose(code);
      assert.ok(out.body.length > 0, `${code} produced nothing`);
      assert.ok(!EM_DASH.test(out.body), `${code} has an em dash`);
      assert.ok(!/undefined|\[object Object\]/.test(out.body), `${code} leaked a value`);
      if (out.kind === "letter") mailed.push(code);
    }
    assert.deepEqual(
      mailed.sort(),
      ["CO", "FL", "HI", "ME", "NH", "OH", "VA", "WV"],
    );
  });
});
