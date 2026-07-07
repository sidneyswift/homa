#!/usr/bin/env node --experimental-strip-types
/**
 * Deterministic checks for the skills-bank targeting + merge logic
 * (apps/web/lib/agent-skills.ts). No model, no network: pure functions.
 * Usage: node --experimental-strip-types scripts/skills-targeting-check.mjs
 */

import {
  bankSkillMatchesChildren,
  childTargetingInfo,
  mergeSkillRows,
} from "../apps/web/lib/agent-skills.ts";

const failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
  if (!ok) failures.push(label);
}

const maya5 = childTargetingInfo(62, { interests: ["Paw Patrol", "dogs"], focus: "letter sounds" });
const finn3 = childTargetingInfo(40, { interests: ["trucks"], focus: "counting to 10" });
const teen14 = childTargetingInfo(170, { interests: ["robotics"], focus: "algebra basics" });
const teenLetters = childTargetingInfo(170, { interests: [], focus: "letter writing to pen pals" });

const general = { min_age_months: null, max_age_months: null, tags: [] };
const letterSkill = { min_age_months: 30, max_age_months: 84, tags: ["letter", "phonic", "alphabet"] };
const countSkill = { min_age_months: 24, max_age_months: 72, tags: ["count", "number", "math"] };
const preschoolOnly = { min_age_months: 24, max_age_months: 60, tags: [] };

check("general skill advertises to any family", bankSkillMatchesChildren(general, [teen14]), true);
check("general skill advertises even with no children", bankSkillMatchesChildren(general, []), true);
check("age+tag skill matches the letter-sounds 5yo", bankSkillMatchesChildren(letterSkill, [maya5]), true);
check("letter skill skips a counting-focused 3yo", bankSkillMatchesChildren(letterSkill, [finn3]), false);
check("letter skill skips a teens-only family", bankSkillMatchesChildren(letterSkill, [teen14]), false);
check(
  "both gates must hit the SAME child (teen with letters focus is out of band)",
  bankSkillMatchesChildren(letterSkill, [finn3, teenLetters]),
  false,
);
check("one matching child is enough", bankSkillMatchesChildren(letterSkill, [teen14, maya5]), true);
check("counting skill matches the counting 3yo", bankSkillMatchesChildren(countSkill, [finn3]), true);
check("age-only gate needs a child in band", bankSkillMatchesChildren(preschoolOnly, [teen14]), false);
check("age-only gate passes with an in-band child", bankSkillMatchesChildren(preschoolOnly, [finn3]), true);
check("age-gated skill never advertises to a childless family", bankSkillMatchesChildren(preschoolOnly, []), false);
check("tag matching is case-insensitive", bankSkillMatchesChildren({ ...general, tags: ["PAW"] }, [maya5]), true);

const familyRows = [{ name: "letter-sounds-worksheets", description: "family version", markdown: "family way" }];
const bankRows = [
  { name: "letter-sounds-worksheets", description: "bank version", markdown: "bank way" },
  { name: "counting-worksheets", description: "bank counting", markdown: "count way" },
];
const merged = mergeSkillRows(familyRows, bankRows);
check("merge keeps one entry per name", merged.length, 2);
check(
  "family skill overrides the same-named bank skill",
  merged.find((row) => row.name === "letter-sounds-worksheets")?.description,
  "family version",
);
check(
  "bank-only skills survive the merge",
  merged.find((row) => row.name === "counting-worksheets")?.description,
  "bank counting",
);

if (failures.length > 0) {
  console.error(`\n${failures.length} targeting check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll targeting checks passed.");
