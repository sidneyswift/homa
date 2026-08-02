import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  applyReviewedStateRequirementCorrections,
  findCitationUrlMismatches,
} from "./state-requirements-reviewed-corrections.mts";
import type { StateDetail } from "./state-requirements-shared.mts";

const STATES_DIR = fileURLToPath(
  new URL("../data/state-requirements/states/", import.meta.url),
);

function state(code: string): StateDetail {
  return JSON.parse(readFileSync(`${STATES_DIR}${code}.json`, "utf8")) as StateDetail;
}

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

describe("reviewed state requirement corrections", () => {
  it("keeps every checked-in snapshot corrected and citation-consistent", () => {
    const codes = readdirSync(STATES_DIR)
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -5))
      .sort();
    assert.equal(codes.length, 51);
    for (const code of codes) {
      const result = applyReviewedStateRequirementCorrections(state(code));
      assert.deepEqual(result.problems, [], code);
      assert.deepEqual(result.applied, [], `${code} still contains an upstream bad value`);
      assert.deepEqual(findCitationUrlMismatches(result.detail), [], code);
    }
  });

  it("repairs the four reviewed upstream values", () => {
    const az = state("AZ");
    record(az.sources).doe_url = "https://www.azed.gov/esa";

    const dc = state("DC");
    const dcPathway = record(dc.pathways[0]);
    record(dcPathway.notification).deadline =
      "Before instruction begins; renewed annually before each school year";

    const ms = state("MS");
    record(ms.citation_urls)["Miss. Code Ann. 37-13-93"] =
      "https://law.justia.com/codes/mississippi/title-37/chapter-13/mississippi-compulsory-school-attendance-law/section-37-13-91/";
    const msSources = record(ms.sources);
    msSources.additional_statutes = [
      ...(msSources.additional_statutes as unknown[]),
      "Miss. Code Ann. 37-13-93 (Penalties for Non-Compliance)",
    ];

    const ok = state("OK");
    record(ok.compulsory_education).notes =
      "Ages 5-18. Compulsory beginning at age 5, but parents may opt a 5-year-old out of kindergarten by notifying the superintendent by certified mail before enrollment or during the first school year. Children must attend until age 18 or high school graduation, whichever comes first.";

    for (const detail of [az, dc, ms, ok]) {
      const result = applyReviewedStateRequirementCorrections(detail);
      assert.deepEqual(result.problems, [], detail.state_code);
      assert.equal(result.applied.length, 1, detail.state_code);
      assert.equal(result.applied[0].state_code, detail.state_code);
    }
  });

  it("fails closed when upstream changes a corrected field again", () => {
    const az = state("AZ");
    record(az.sources).doe_url = "https://www.azed.gov/a-new-homeschool-page";
    const result = applyReviewedStateRequirementCorrections(az);
    assert.equal(result.applied.length, 0);
    assert.match(result.problems.join("\n"), /changed from both/);
  });

  it("detects a section label linked to a different Justia section", () => {
    const ms = state("MS");
    record(ms.citation_urls)["Miss. Code Ann. 37-13-93"] =
      "https://law.justia.com/codes/mississippi/title-37/chapter-13/mississippi-compulsory-school-attendance-law/section-37-13-91/";
    assert.deepEqual(findCitationUrlMismatches(ms), [
      "Miss. Code Ann. 37-13-93: label names section 37-13-93, URL path names section 37-13-91",
    ]);
  });

  it("leaves Montana's shared statute alone because it governs both pathways", () => {
    const mt = state("MT");
    const statutes = mt.pathways.map((pathway) => record(pathway).statute);
    assert.deepEqual(statutes, ["MCA 20-5-109", "MCA 20-5-109"]);
  });
});
