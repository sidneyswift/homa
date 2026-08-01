import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const here = new URL(".", import.meta.url);

describe("native state-record boundaries", () => {
  it("keeps history family-scoped and append-only", async () => {
    const source = await readFile(new URL("state-records.ts", here), "utf8");
    assert.match(source, /where family_id = \$\{familyId\}/u);
    assert.match(source, /status in \('final', 'superseded'\)/u);
    assert.doesNotMatch(source, /delete from public\.materials/u);
  });

  it("reads packet attendance and hours only through the authenticated family", async () => {
    const source = await readFile(new URL("pack-store.ts", here), "utf8");
    assert.match(source, /from public\.hours_log h/u);
    assert.match(source, /where h\.family_id = \$\{familyId\}/u);
    assert.match(source, /c\.id = h\.child_id and c\.family_id = h\.family_id/u);
    assert.match(source, /schoolYearStartOn/u);
  });

  it("uses the existing compliance composers and reviewed requirements", async () => {
    const source = await readFile(new URL("state-records.ts", here), "utf8");
    assert.match(source, /getStateRequirementsDetail/u);
    assert.match(source, /composeFilingLetter/u);
    assert.match(source, /FILING_METHODS_BY_STATE/u);
    assert.match(source, /schoolYearStartFor/u);
  });

  it("lets native bearer auth reach the existing generators without a cookie fallback", async () => {
    for (const routeName of ["pack", "filing"]) {
      const route = await readFile(
        new URL(`../../app/api/compliance/${routeName}/route.ts`, here),
        "utf8",
      );
      assert.match(route, /request\.headers\.has\("authorization"\)/u);
      assert.match(route, /requireFamilyFromBearer\(request\)/u);
      assert.match(route, /access = hasBearer/u);
    }
  });

  it("keeps generation, submission, printing, and sharing outside the UI signal tool", async () => {
    const tool = await readFile(
      new URL("../../agent/tools/open_state_records.ts", here),
      "utf8",
    );
    assert.match(tool, /does not itself print or share/u);
    assert.doesNotMatch(tool, /insertStatePackRow|insertFilingRow|printWithSystemSheet|Share\.share/u);
    assert.doesNotMatch(tool, /submit.*fetch|send.*state/iu);
  });

  it("verifies an explicitly stated school-year date before the family-scoped write", async () => {
    const tool = await readFile(
      new URL("../../agent/tools/save_school_year_start.ts", here),
      "utf8",
    );
    assert.match(tool, /resolveAgentAccess/u);
    assert.match(tool, /parseSchoolYearStart/u);
    assert.match(tool, /setSchoolYearStart\(familyId, parsed\.value\)/u);
    assert.doesNotMatch(tool, /Date\.now\(\).*startOn|schoolYearStartFor/u);
  });
});
