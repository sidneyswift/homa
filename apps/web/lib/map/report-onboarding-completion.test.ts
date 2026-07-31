import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const storeUrl = new URL("./store.ts", import.meta.url);

describe("createReport onboarding completion", () => {
  it("releases eligible families immediately after a report exists", async () => {
    const source = await readFile(storeUrl, "utf8");
    const createReport = source.slice(
      source.indexOf("export async function createReport"),
      source.indexOf("export async function claimReportEmail"),
    );

    assert.match(
      createReport,
      /await resolveOnboardingCompletion\(familyId\);/u,
      "createReport must resolve onboarding before returning the scored report",
    );
    assert.ok(
      createReport.indexOf("await resolveOnboardingCompletion(familyId);") >
        createReport.indexOf("if (report === null) return null;"),
      "onboarding completion must run only after a report was created or found",
    );
  });
});
