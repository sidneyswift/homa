import assert from "node:assert/strict";
import { test } from "node:test";

import { ageInMonths } from "@homa/core";

import { effectiveTimeZone, zonedDateString } from "../time-zone";
import { validateProposedClaims } from "./claim-validation";
import { loadJournalFamilyChildren } from "./journal-capture";
import { renderSkillCatalog } from "./skill-catalog";

const familyId = "00000000-0000-4000-8000-000000000001";
const childId = "00000000-0000-4000-8000-000000000101";
const birthDate = "2022-01-06";

function fixture(timeZone: string | null | undefined) {
  const calls: { query: string; parameters: unknown[] }[] = [];
  const database = (async (chunks: TemplateStringsArray, ...parameters: unknown[]) => {
    calls.push({query: chunks.join("?"), parameters});
    return [{id: childId, name: "Maya", birth_date: birthDate, time_zone: timeZone}];
  }) as unknown as NonNullable<Parameters<typeof loadJournalFamilyChildren>[1]>["database"];
  return { database, calls };
}

test("journal roster uses the canonical family date on both sides of UTC midnight", async () => {
  for (const [timeZone, instant, expected] of [
    ["America/Los_Angeles", "2026-09-06T02:00:00Z", 55],
    ["America/Los_Angeles", "2026-09-06T07:00:00Z", 56],
    ["Asia/Tokyo", "2026-09-05T16:00:00Z", 56],
  ] as const) {
    const {database, calls} = fixture(timeZone);
    const now = new Date(instant);
    const roster = await loadJournalFamilyChildren(familyId, {database, now});
    const canonical = ageInMonths(birthDate, new Date(`${zonedDateString(now, effectiveTimeZone(timeZone))}T12:00:00.000Z`));
    assert.equal(roster[0]?.ageMonths, expected);
    assert.equal(roster[0]?.ageMonths, canonical);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].parameters, [familyId]);
    assert.match(calls[0].query, /join public\.families family on family\.id = child\.family_id/u);
    assert.match(calls[0].query, /where child\.family_id = \?/u);
  }
});

test("missing or empty timezone uses the existing Central fallback; invalid zones refuse", async () => {
  const now = new Date("2026-09-06T02:00:00Z");
  for (const timeZone of [null, undefined, ""]) {
    const {database} = fixture(timeZone);
    const roster = await loadJournalFamilyChildren(familyId, {database, now});
    assert.equal(roster[0]?.ageMonths, 55);
    assert.equal(effectiveTimeZone(timeZone), "America/Chicago");
  }
  await assert.rejects(loadJournalFamilyChildren(familyId, {database: fixture("Invalid/Zone").database, now}), RangeError);
});

test("local monthly birthday controls catalog and unchanged per-child age validation", async () => {
  const now = new Date("2026-09-06T02:00:00Z");
  const children = await loadJournalFamilyChildren(familyId, {database: fixture("America/Los_Angeles").database, now});
  assert.equal(ageInMonths(birthDate, now), 56, "previous UTC calculation crosses the birthday too early");
  assert.equal(children[0].ageMonths, 55);
  assert.ok(!renderSkillCatalog(children.map(child => child.ageMonths)).includes("fine_motor.cuts-curves"));
  const message = "She cuts curves independently.";
  const claims = [{childId, itemId: "fine_motor.cuts-curves", answer: "easily" as const, confidence: "high" as const, quote: message}];
  assert.equal(validateProposedClaims({message, children, claims}).rejected[0]?.reason, "age_implausible");
  const after = await loadJournalFamilyChildren(familyId, {database: fixture("America/Los_Angeles").database, now: new Date("2026-09-06T07:00:00Z")});
  assert.ok(renderSkillCatalog(after.map(child => child.ageMonths)).includes("fine_motor.cuts-curves"));
  assert.equal(validateProposedClaims({message, children: after, claims}).accepted.length, 1);
});
