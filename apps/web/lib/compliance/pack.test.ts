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
  composeStatePack,
  deriveDuties,
  prefillBirthdate,
  verifiedMonthYear,
  type StatePackFamily,
} from "./pack";

/**
 * The state pack derivation, run against the repository's own reviewed
 * snapshots (data/state-requirements/), so every future data refresh
 * surfaces claim changes as failing assertions or reviewable diffs
 * (plans/2026-07-28-state-pack.md D19). No database, no browser.
 */

const STATES_DIR = fileURLToPath(
  new URL("../../../../data/state-requirements/states/", import.meta.url),
);
const INDEX_PATH = fileURLToPath(
  new URL("../../../../data/state-requirements/index.json", import.meta.url),
);

interface IndexEntry {
  state_code: string;
  state_name: string;
  regulation_level: StateRequirementsSummary["regulationLevel"];
  compulsory_education: { start_age: number | null; end_age: number | null };
  notification_required: boolean;
  assessment_required: boolean;
  default_pathway: string | null;
  last_verified: string;
}

const index = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as {
  states: IndexEntry[];
};

function loadDetail(stateCode: string): StateRequirementsDetail {
  const entry = index.states.find((state) => state.state_code === stateCode);
  assert.ok(entry, `index entry for ${stateCode}`);
  const payload = JSON.parse(
    readFileSync(`${STATES_DIR}${stateCode}.json`, "utf8"),
  ) as Record<string, unknown>;
  const summary: StateRequirementsSummary = {
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
  };
  return parseStateRequirementsPayload(summary, payload);
}

const ALL_CODES = readdirSync(STATES_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.replace(".json", ""))
  .sort();

const WALKERS: StatePackFamily = {
  familyName: "Walker",
  parentName: "Robin Walker",
  children: [
    { name: "Finn", birthdate: "2018-03-09" },
    { name: "Maya", birthdate: "2020-11-21" },
  ],
};

const SIX_CHILD_FAMILY: StatePackFamily = {
  familyName: "Alvarez",
  parentName: null,
  children: [
    { name: "Ana", birthdate: "2012-01-05" },
    { name: "Beto", birthdate: "2013-02-06" },
    { name: "Cira", birthdate: "2015-03-07" },
    { name: "Dario", birthdate: "2017-04-08" },
    { name: "Elena", birthdate: "2019-05-09" },
    { name: "Fito", birthdate: "2021-06-10" },
  ],
};

function compose(stateCode: string, family: StatePackFamily = WALKERS) {
  return composeStatePack({
    detail: loadDetail(stateCode),
    family,
    packId: "12345678-abcd-4ef0-8123-456789abcdef",
    generatedOn: "July 28, 2026",
  });
}

describe("verifiedMonthYear", () => {
  it("formats the upstream date as month and year", () => {
    assert.equal(verifiedMonthYear("2026-03-13"), "March 2026");
    assert.equal(verifiedMonthYear("2026-12-01"), "December 2026");
  });
  it("passes unparseable input through untouched", () => {
    assert.equal(verifiedMonthYear("soon"), "soon");
  });
});

describe("state pack across every reviewed jurisdiction", () => {
  it("covers 51 jurisdictions", () => {
    assert.equal(ALL_CODES.length, 51);
  });

  for (const code of ALL_CODES) {
    it(`${code}: composes a clean, honest pack`, () => {
      const pack = compose(code);
      // Never below cover + two content pages.
      assert.ok(pack.pages.length >= 3, `${code} has ${pack.pages.length} pages`);
      // House law: no em dash anywhere in the rendered document.
      assert.ok(!EM_DASH.test(pack.html), `${code} contains an em dash`);
      // No executable markup in a code-authored document, ever.
      assert.ok(!/<script/i.test(pack.html), `${code} contains a script tag`);
      // The two fields council D3 bans from rendering must never leak.
      assert.ok(
        !pack.html.includes("pathway_varies"),
        `${code} leaks pathway_varies`,
      );
      assert.ok(
        !/\bundefined\b/.test(pack.html),
        `${code} renders the word undefined`,
      );
      assert.ok(
        !pack.html.includes("[object Object]"),
        `${code} renders a stringified object`,
      );
      // Trust stamps: verification date and attribution on the document.
      const verified = verifiedMonthYear(loadDetail(code).sourceLastVerified);
      assert.ok(pack.html.includes(verified), `${code} misses verified date`);
      assert.ok(
        pack.html.includes("CC BY-SA 4.0"),
        `${code} misses attribution`,
      );
      assert.ok(
        pack.html.includes("not legal advice"),
        `${code} misses the boundary line`,
      );
      assert.ok(
        pack.html.includes("Make a fresh pack from Homa"),
        `${code} misses the regenerate instruction`,
      );
      // Page-number honesty: first and last stamps match the plan.
      assert.ok(pack.html.includes(`page 1 of ${pack.pages.length}`));
      assert.ok(
        pack.html.includes(`page ${pack.pages.length} of ${pack.pages.length}`),
      );
      // The stored form stays under the materials html cap.
      const stored = pack.pages.map((page) => page.body).join("\n");
      assert.ok(stored.length < 118_000, `${code} stored html ${stored.length}`);
      // No page body large enough to overflow its exact-height box: a
      // rough character proxy pinned well below the visual budget the
      // deep fixtures verify by real render.
      for (const page of pack.pages) {
        assert.ok(
          page.body.length < 30_000,
          `${code} page "${page.title}" is ${page.body.length} chars`,
        );
      }
    });
  }

  it("derives the affirmative zero-duty set from data, conservatively", () => {
    // The council named nine zero-duty states; the typed data says seven,
    // because AK and MI carry pathway_varies flags on their default rows
    // and a varies field may hide a duty, so the pack refuses to print an
    // affirmative "nothing is required" it cannot back (D3 over D2).
    const zeroDuty = ALL_CODES.filter(
      (code) => deriveDuties(loadDetail(code)).zeroDuty,
    );
    assert.deepEqual(zeroDuty, ["CT", "ID", "IL", "NJ", "OK", "TX", "WY"]);
  });
});

describe("New York (detailed plan, verbatim mid-year clause)", () => {
  it("pins the deadline string verbatim, never parsed", () => {
    const pack = compose("NY");
    assert.ok(
      pack.html.includes(
        "By July 1 annually, or within 14 days of commencing home instruction mid-year",
      ),
    );
    assert.ok(pack.html.includes("superintendent of the local school district"));
  });
  it("carries a checklist and a prep sheet", () => {
    const pack = compose("NY");
    const titles = pack.pages.map((page) => page.title);
    assert.ok(titles.some((title) => title.includes("checklist")));
    assert.ok(titles.some((title) => title.includes("notice of intent")));
  });
  it("never stacks a preposition onto the verbatim deadline string", () => {
    // "You send it to {recipient} by {deadline}" produced "by By July 1"
    // (render smoke, 2026-07-28); the deadline is verbatim prose and
    // must only ever follow a labeled clause.
    const pack = compose("NY");
    assert.ok(!/\bby By\b/.test(pack.html));
    // The checklist imperative ends before the deadline; the deadline
    // arrives behind its own "When:" label (review finding, same day).
    assert.ok(
      pack.html.includes(
        "file your notice with superintendent of the local school district.",
      ),
    );
    assert.ok(!/notice with [^.<]*, By /.test(pack.html));
  });
  it("never minimizes the filing burden with invented copy", () => {
    // "Filing is a short form" was false for NY's detailed plan
    // (review blocker, 2026-07-28); the prep sheet intro must not
    // characterize the burden at all.
    for (const code of ["NY", "PA", "CA"]) {
      assert.ok(!compose(code).html.includes("Filing is a short form"));
    }
  });
});

describe("California (pervasive pathway variance)", () => {
  it("renders the varies law instead of flattened rollups", () => {
    const pack = compose("CA");
    assert.ok(pack.html.includes("This varies by pathway in California"));
  });
  it("keeps case law out of the parent packet (D18)", () => {
    const pack = compose("CA");
    assert.ok(!pack.html.includes("Jonathan L."));
    assert.ok(!pack.html.includes("People v. Turner"));
  });
  it("keeps grades_1_6 style detail fragments out entirely", () => {
    const pack = compose("CA");
    assert.ok(!pack.html.includes("grades_1_6"));
    assert.ok(!pack.html.includes("grades_7_12"));
  });
  it("never asserts a varies-flagged recordkeeping duty as uniform", () => {
    // CA's recordkeeping varies by pathway, so the attendance template's
    // header must say so instead of "asks for ... on the default path"
    // (review finding, 2026-07-28).
    const pack = compose("CA");
    assert.ok(
      pack.html.includes("Attendance rules vary by pathway in California"),
    );
    assert.ok(
      !pack.html.includes(
        "California asks for an attendance record on the default path",
      ),
    );
  });
});

describe("Texas (zero duty)", () => {
  it("gets the affirmative legal-status pack", () => {
    const pack = compose("TX");
    assert.ok(pack.zeroDuty);
    const titles = pack.pages.map((page) => page.title);
    assert.ok(titles.some((title) => title === "You are legal in Texas"));
    assert.ok(!titles.some((title) => title.includes("checklist")));
    assert.ok(!titles.some((title) => title.includes("notice of intent")));
    assert.ok(!titles.some((title) => title.startsWith("Attendance")));
  });
  it("keeps the status citation on the legality page", () => {
    const pack = compose("TX");
    assert.ok(/Leeper/.test(pack.html));
  });
});

describe("South Carolina (notification without a published deadline)", () => {
  it("says so instead of inventing a date", () => {
    const detail = loadDetail("SC");
    const duties = deriveDuties(detail);
    assert.equal(duties.notification, true);
    // SC's notification field varies by pathway, so the prep sheet's
    // requirements column must show the confirm-at-source law, and no
    // checklist imperative may carry an invented date.
    const pack = compose("SC");
    assert.ok(pack.html.includes("This varies by pathway in South Carolina"));
    assert.ok(!pack.html.includes("null"));
  });
});

describe("Pennsylvania (every duty on, high variance, six children)", () => {
  it("renders one attendance page per child and stays page-complete", () => {
    const pack = compose("PA", SIX_CHILD_FAMILY);
    const attendanceTitles = pack.pages.filter((page) =>
      page.title.startsWith("Attendance"),
    );
    assert.equal(attendanceTitles.length, 6);
    for (const child of SIX_CHILD_FAMILY.children) {
      assert.ok(
        pack.pages.some((page) => page.title === `Attendance · ${child.name}`),
        `missing attendance page for ${child.name}`,
      );
    }
    const stored = pack.pages.map((page) => page.body).join("\n");
    assert.ok(stored.length < 118_000);
  });
  it("suppresses the varies-flagged hours minimum from imperatives", () => {
    // PA's instructional_time varies (900 elementary vs 990 secondary),
    // so no checklist line may assert one number as the requirement.
    const pack = compose("PA", SIX_CHILD_FAMILY);
    assert.ok(!pack.html.includes("900 hours per year"));
  });
});

describe("prefill law (D5)", () => {
  it("prefills complete values and leaves labeled blanks for the rest", () => {
    const pack = compose("NY", WALKERS);
    assert.ok(pack.html.includes("Robin Walker"));
    assert.ok(pack.html.includes("Finn"));
    assert.ok(pack.html.includes("born March 9, 2018"));
    assert.ok(pack.html.includes("Grade level (you choose this)"));
    assert.ok(pack.html.includes("Check every detail Homa filled in"));
  });
  it("renders a blank parent line when the name is incomplete", () => {
    const pack = compose("NY", { ...WALKERS, parentName: null });
    assert.ok(!pack.html.includes("Robin Walker"));
    assert.ok(pack.html.includes("Parent name"));
  });
  it("never renders a signature line", () => {
    for (const code of ["NY", "PA", "CA", "TX"]) {
      const pack = compose(code, WALKERS);
      assert.ok(!/signature/i.test(pack.html), `${code} has a signature line`);
    }
  });
  it("renders month-only birthdates without a fabricated day", () => {
    const pack = compose("NY", {
      ...WALKERS,
      children: [{ name: "Story", birthdate: "2019-05" }],
    });
    assert.ok(pack.html.includes("Story · born May 2019"));
    assert.ok(!pack.html.includes("May 1, 2019"));
  });
});

describe("prefillBirthdate (D5: only collected values)", () => {
  it("keeps real full birthdays", () => {
    assert.equal(
      prefillBirthdate("2019-05-17", "2026-07-20T10:00:00Z"),
      "2019-05-17",
    );
  });
  it("truncates day-01 rows from the month-only intake window", () => {
    // 2026-07-08 to 2026-07-11 rows carry a placeholder day of 01
    // (migration #55); printing that day on a notice-of-intent prep
    // sheet would be fabrication.
    assert.equal(
      prefillBirthdate("2019-05-01", "2026-07-09T10:00:00Z"),
      "2019-05",
    );
  });
  it("trusts day-01 birthdays collected after the window", () => {
    assert.equal(
      prefillBirthdate("2019-05-01", "2026-07-20T10:00:00Z"),
      "2019-05-01",
    );
  });
  it("returns null for missing or malformed values", () => {
    assert.equal(prefillBirthdate(null, "2026-07-20T10:00:00Z"), null);
    assert.equal(prefillBirthdate("soon", "2026-07-20T10:00:00Z"), null);
  });
});
