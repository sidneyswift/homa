import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { EM_DASH } from "@homa/core";

import { quoteAppearsVerbatim } from "./deadline-anchor-verify";
import { EXTRA_REQUIREMENTS } from "./deadline-anchors.generated";

import {
  parseStateRequirementsPayload,
  type StateRequirementsDetail,
  type StateRequirementsSummary,
} from "../map/state-requirements";
import {
  composeStatePack,
  deriveStatePackDailyRecords,
  deriveDuties,
  isOfficialSource,
  officialUrl,
  derivePathwayDivergence,
  prefillBirthdate,
  verifiedMonthYear,
  type StatePackFamily,
  type StatePackRecords,
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
    { id: "11111111-1111-4111-8111-111111111111", name: "Finn", birthdate: "2018-03-09" },
    { id: "22222222-2222-4222-8222-222222222222", name: "Maya", birthdate: "2020-11-21" },
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

const SAVED_RECORDS: StatePackRecords = {
  schoolYearStartOn: "2026-08-18",
  entries: [
    {
      childId: "11111111-1111-4111-8111-111111111111",
      childName: "Finn",
      happenedOn: "2026-08-19",
      subject: "math",
      minutes: 45,
    },
    {
      childId: null,
      childName: null,
      happenedOn: "2026-08-19",
      subject: "co-op",
      minutes: 120,
    },
    {
      childId: "22222222-2222-4222-8222-222222222222",
      childName: "Maya",
      happenedOn: "2026-08-20",
      subject: "reading",
      minutes: 30,
    },
  ],
};

describe("actual attendance and hours records", () => {
  it("keeps same-name children separate in both printed summary and daily details", () => {
    const family = { ...WALKERS, children: WALKERS.children.map((child) => ({ ...child, name: "Same" })) };
    const records = { schoolYearStartOn: "2026-09-01", entries: [
      { childId: family.children[0].id!, childName: "Same", happenedOn: "2026-09-01", subject: "reading", minutes: 20 },
      { childId: family.children[1].id!, childName: "Same", happenedOn: "2026-09-01", subject: "math", minutes: 30 },
      { childId: null, childName: null, happenedOn: "2026-09-02", subject: "art", minutes: 10 },
    ] };
    const days = deriveStatePackDailyRecords(family, records);
    assert.equal(days.length, 4);
    assert.deepEqual(days.filter((row) => row.childId === family.children[0].id).map((row) => row.minutes), [20, 10]);
    assert.deepEqual(days.filter((row) => row.childId === family.children[1].id).map((row) => row.minutes), [30, 10]);
    const pack = composeStatePack({ detail: loadDetail("NY"), family, records, packId: "12345678-abcd-4ef0-8123-456789abcdef", generatedOn: "September 6, 2026" });
    assert.match(pack.html, /<td>Same \(record 111111\)<\/td><td>2<\/td><td>30m<\/td>/u);
    assert.match(pack.html, /<td>Same \(record 222222\)<\/td><td>2<\/td><td>40m<\/td>/u);
    assert.match(pack.html, /Same \(record 111111\): reading, 20m · Same \(record 222222\): math, 30m/u);
    assert.match(pack.html, /Whole family: art, 10m/u);
    assert.match(pack.html, /does not establish absence/u);
  });

  it("uses a renamed child's current label without losing entries recorded under the old name", () => {
    const family = { ...WALKERS, children: [{ ...WALKERS.children[0], name: "Finley" }, WALKERS.children[1]] };
    const days = deriveStatePackDailyRecords(family, SAVED_RECORDS);
    assert.deepEqual(days.filter((row) => row.childId === family.children[0].id).map((row) => [row.childName, row.minutes]), [["Finley", 165]]);
  });

  it("refuses records whose child identity cannot be verified instead of matching a display name", () => {
    assert.throws(() => deriveStatePackDailyRecords({ ...WALKERS, children: WALKERS.children.map(({ name, birthdate }) => ({ name, birthdate })) }, SAVED_RECORDS));
    assert.throws(() => deriveStatePackDailyRecords(WALKERS, { ...SAVED_RECORDS, entries: [{ ...SAVED_RECORDS.entries[0], childId: "foreign-child" }] }));
  });

  it("counts family-wide time for every child and keeps child-specific rows exact", () => {
    assert.deepEqual(deriveStatePackDailyRecords(WALKERS, SAVED_RECORDS), [
      {
        childId: WALKERS.children[0].id,
        childName: "Finn",
        happenedOn: "2026-08-19",
        subjects: ["math", "co-op"],
        minutes: 165,
      },
      {
        childId: WALKERS.children[1].id,
        childName: "Maya",
        happenedOn: "2026-08-19",
        subjects: ["co-op"],
        minutes: 120,
      },
      {
        childId: WALKERS.children[1].id,
        childName: "Maya",
        happenedOn: "2026-08-20",
        subjects: ["reading"],
        minutes: 30,
      },
    ]);
  });

  it("embeds saved dates, subjects, time, and the reported school-year start", () => {
    const pack = composeStatePack({
      detail: loadDetail("NY"),
      family: WALKERS,
      packId: "12345678-abcd-4ef0-8123-456789abcdef",
      generatedOn: "August 21, 2026",
      records: SAVED_RECORDS,
    });
    assert.ok(pack.pages.some((page) => page.title === "Recorded learning days and hours"));
    assert.ok(pack.pages.some((page) => page.title === "Logged learning days"));
    assert.match(pack.html, /Aug 18, 2026/u);
    assert.match(pack.html, /Aug 19, 2026/u);
    assert.match(pack.html, /Finn: math, 45m/u);
    assert.match(pack.html, /Whole family: co-op, 2h/u);
  });

  it("prints an explicit blank instead of estimating missing records", () => {
    const pack = composeStatePack({
      detail: loadDetail("TX"),
      family: WALKERS,
      packId: "12345678-abcd-4ef0-8123-456789abcdef",
      generatedOn: "August 21, 2026",
      records: { schoolYearStartOn: null, entries: [] },
    });
    assert.match(pack.html, /Not set in Homa/u);
    assert.match(pack.html, /no saved learning-time entries/u);
    assert.match(pack.html, /not an estimate/u);
    assert.ok(!pack.pages.some((page) => page.title === "Logged learning days"));
  });

  it("keeps a full year of daily family records inside the stored HTML cap", () => {
    const entries = Array.from({ length: 365 }, (_, offset) => ({
      childId: null,
      childName: null,
      happenedOn: new Date(Date.UTC(2026, 7, 18 + offset)).toISOString().slice(0, 10),
      subject: offset % 2 === 0 ? "math" : "reading",
      minutes: 90,
    }));
    const pack = composeStatePack({
      detail: loadDetail("PA"),
      family: WALKERS,
      packId: "12345678-abcd-4ef0-8123-456789abcdef",
      generatedOn: "August 17, 2027",
      records: { schoolYearStartOn: "2026-08-18", entries },
    });
    const stored = pack.pages.map((page) => page.body).join("\n");
    assert.ok(stored.length < 118_000, `stored record packet is ${stored.length} chars`);
    assert.equal(pack.pages.filter((page) => page.title.startsWith("Logged learning days")).length, 22);
  });
});

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
    assert.ok(titles.some((title) => title.includes("Filing preparation")));
  });
  it("points every official-channel line at the state education department", () => {
    // The first shipped DC pack labeled HomeschoolLeap's wizard "the
    // official form" (founder catch, 2026-07-28). The DOE page leads
    // wherever the pack says official, for every jurisdiction.
    for (const code of ALL_CODES) {
      const detail = loadDetail(code);
      if (!detail.doeUrl) continue;
      const pack = compose(code);
      assert.ok(
        !pack.html.includes("official form on your state education department's homeschool page: <span class=\"sp-mono\">https://homeschoolleap.com"),
        `${code} labels a third-party page as the official channel`,
      );
    }
    const dc = compose("DC");
    assert.ok(dc.html.includes("osse.dc.gov"));
    assert.ok(!dc.html.includes("homeschoolleap.com/states/DC/wizard"));
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
  it("renders the default pathway's own rule, with a scope note", () => {
    // CA's notification section carries pathway_varies, but the default
    // Home-Based Private School pathway has its OWN concrete rule and
    // the pack must print it (per-pathway truth, 2026-07-28) rather
    // than the boilerplate that used to replace it.
    const pack = compose("CA");
    assert.ok(pack.html.includes("October 1 through October 15 annually"));
    assert.ok(pack.html.includes("California Department of Education"));
    // Divergent rows carry a marker and the page carries one footnote
    // explaining it, rather than repeating a sentence per row (CA
    // diverges on five of seven rows; visual review 2026-07-28).
    assert.ok(
      pack.html.includes("This rule differs on California's other pathways"),
      "a divergent page must carry the scope footnote",
    );
    assert.ok(
      pack.html.includes("sp-mark"),
      "a genuinely divergent row must carry its marker",
    );
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
    assert.ok(!titles.some((title) => title.includes("Filing preparation")));
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
    // Every SC option requires notification and none publishes a fixed
    // date, so the pack states the requirement and is honest about the
    // missing date rather than inventing or suppressing either.
    const pack = compose("SC");
    assert.ok(pack.html.includes("The source does not list a fixed date"));
    assert.ok(!pack.html.includes("null"));
    assert.ok(!/\bundefined\b/.test(pack.html));
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
  it("states the default pathway's real hours minimum with its scope", () => {
    // PA's Home Education Program carries 900 hours in its own pathway
    // object (Private Tutoring carries the same; only the Religious Day
    // School option differs), so the pack prints the number AND the
    // scope note. Suppressing it left PA families without their
    // instructional-time requirement at all.
    const pack = compose("PA", SIX_CHILD_FAMILY);
    assert.ok(pack.html.includes("900 hours per year"));
    assert.ok(
      pack.html.includes("This rule differs on Pennsylvania's other pathways"),
    );
  });
});

describe("per-pathway truth (the default pathway carries its own values)", () => {
  it("restores Arizona's affidavit filing step to the checklist", () => {
    // The 51-state vision QC found AZ's checklist had no filing step at
    // all: its notification flag fires over an attachments sub-field,
    // and the old reading suppressed the whole section. A family
    // following that checklist would have skipped a real legal filing.
    const pack = compose("AZ");
    const checklist = pack.pages.find((page) =>
      page.title.includes("checklist"),
    );
    assert.ok(checklist, "AZ has a checklist page");
    assert.ok(
      /Arizona requires: file your notice/.test(checklist.body),
      "AZ checklist must carry the affidavit filing step",
    );
  });

  it("gives every notification-required state a filing step", () => {
    // The whole point of the pack: a state that requires notification
    // must tell the family to file, on the page that lists what to do.
    const missing = ALL_CODES.filter((code) => {
      const detail = loadDetail(code);
      if (!detail.defaultPathwayDetail?.notification.required) return false;
      const checklist = compose(code).pages.find((page) =>
        page.title.includes("checklist"),
      );
      return !checklist || !/requires: file your notice/.test(checklist.body);
    });
    assert.deepEqual(missing, [], `states missing a filing step: ${missing}`);
  });

  it("keeps boilerplate off the at-a-glance page", () => {
    // Before per-pathway truth, a quarter of states rendered mostly
    // "This varies by pathway" rows on their core page.
    const boilerplateHeavy = ALL_CODES.filter((code) => {
      const glance = compose(code).pages.find((page) =>
        page.title.includes("at a glance"),
      );
      if (!glance) return false;
      const hits = glance.body.split("This varies by pathway").length - 1;
      return hits > 0;
    });
    assert.deepEqual(boilerplateHeavy, []);
  });

  it("computes divergence from values, not from the section flag", () => {
    const de = loadDetail("DE");
    assert.equal(de.defaultPathwayDetail?.notification.varies, true);
    assert.equal(derivePathwayDivergence(de).notification, false);
    assert.equal(derivePathwayDivergence(loadDetail("CA")).notification, true);
  });

  it("never claims one pathway's rule covers the whole state", () => {
    for (const code of ALL_CODES) {
      const pack = compose(code);
      assert.ok(
        !/\ball pathways\b/i.test(pack.html),
        `${code} claims to cover all pathways`,
      );
    }
  });
});

describe("requirements recovered from pathway detail (gh#322)", () => {
  it("gives Pennsylvania its notarization requirement", () => {
    // The motivating case: a PA family who files an un-notarized
    // affidavit is rejected by the district and believes they filed.
    // The requirement appears nowhere in the payload except the default
    // pathway's own slice of pathway_varies_detail.
    const pack = compose("PA", SIX_CHILD_FAMILY);
    assert.match(pack.html, /notarized/i);
  });

  it("never renders the raw detail field, only verified notes", () => {
    for (const code of ALL_CODES) {
      const pack = compose(code);
      assert.ok(!pack.html.includes("undefined"), `${code} leaks undefined`);
      assert.ok(!pack.html.includes("general_list"), `${code} leaks an enum token`);
      assert.ok(
        !/\bPrivate Tutoring:/.test(pack.html),
        `${code} leaks a raw pathway_varies_detail segment`,
      );
    }
  });

  it("keeps every shipped note backed by a verbatim quote", () => {
    for (const [code, entry] of Object.entries(EXTRA_REQUIREMENTS)) {
      for (const requirement of entry.requirements) {
        assert.ok(
          quoteAppearsVerbatim(entry.source, requirement.quote),
          `${code}: ${JSON.stringify(requirement.quote)}`,
        );
      }
    }
  });
});

describe("source honesty (2026-07-29 citation audit)", () => {
  it("classifies publishers by who published them", () => {
    assert.ok(isOfficialSource("https://www.azleg.gov/ars/15/00802.htm"));
    assert.ok(isOfficialSource("https://alison.legislature.state.al.us/x"));
    assert.ok(!isOfficialSource("https://law.justia.com/codes/x"));
    assert.ok(!isOfficialSource("https://hslda.org/post/x"));
    assert.ok(!isOfficialSource("not a url"));
  });

  it("never dresses a legal publisher as the state's own law", () => {
    // Mississippi's statutes are cited to Justia; the pack may show
    // them, but not under the heading that means "the state published
    // this".
    const pack = compose("MS");
    assert.ok(pack.html.includes("Where to read them elsewhere"));
    assert.ok(
      pack.html.includes("rather than the state"),
      "secondary sources must be named as secondary",
    );
  });

  it("keeps a state with only official sources free of the caveat", () => {
    const pack = compose("NY");
    assert.ok(!pack.html.includes("Where to read them elsewhere"));
  });

  it("only ever points the file-here line at an official destination", () => {
    for (const code of ALL_CODES) {
      const detail = loadDetail(code);
      const url = officialUrl(detail);
      if (url === null) continue;
      assert.ok(
        isOfficialSource(url),
        `${code} sends families to a non-official channel: ${url}`,
      );
    }
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
