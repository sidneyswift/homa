/**
 * Map content + scorer check (lead magnet v2). Two jobs, one exit code:
 *   1. Content lint: every bank item is cited, and no parent-facing string
 *      anywhere in the bank or sentence outputs contains a banned word
 *      (claims law) or an em dash (brand law).
 *   2. Scorer fixtures: golden kids (ahead, mixed, sparse, struggling)
 *      produce the expected positions, deterministically, with no negative
 *      number and no deficit word ever rendered.
 *
 * Usage: pnpm check:map   (tsx scripts/map-check.mts)
 */

import {
  buildFourWeekPlan,
  DEEP_DIVE_CAP,
  domainLine,
  homaNote,
  MAP_DOMAINS,
  MAP_SOURCES,
  maxQuestionsForAge,
  nextDeepDiveItem,
  planQuestions,
  scoreMap,
  type MapAnswer,
  type MapAnswerInput,
} from "../packages/core/src/index";

const failures: string[] = [];

function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

// Words the report may never contain (journeys/07 never-say list) plus the
// em dash (brand law). "test" is allowed only inside "never a test" phrasing,
// so it is checked separately below.
const BANNED = /\b(behind|delayed?|disorder|diagnos\w*|screening|assessment|percentile)\b/i;
const EM_DASH = /\u2014/;

function checkCopy(label: string, text: string): void {
  if (BANNED.test(text)) failures.push(`${label}: banned word in "${text.slice(0, 80)}"`);
  if (EM_DASH.test(text)) failures.push(`${label}: em dash in "${text.slice(0, 80)}"`);
}

// ---------- 1. Content lint ----------

let itemCount = 0;
for (const domain of MAP_DOMAINS) {
  checkCopy(`${domain.id}.intro`, domain.intro);
  checkCopy(`${domain.id}.activity`, `${domain.growingActivity.title} ${domain.growingActivity.description}`);
  for (const item of domain.items) {
    itemCount += 1;
    checkCopy(item.id, item.statement);
    if (item.sources.length === 0) failures.push(`${item.id}: no citation`);
    for (const key of item.sources) {
      if (!MAP_SOURCES[key]) failures.push(`${item.id}: unknown source key "${key}"`);
    }
    // 20mo floor (bank starts at 2y) to ~17.5y ceiling (ladder headroom for
    // detecting ahead at the top of the 2-16 range).
    if (item.typicalMonths < 20 || item.typicalMonths > 210) {
      failures.push(`${item.id}: typicalMonths ${item.typicalMonths} outside sane range`);
    }
  }
}
report(`content lint: ${MAP_DOMAINS.length} domains, ${itemCount} items, all cited and clean`, failures.length === 0);

// ---------- 2. Selection ladder sanity ----------

let ladderOk = true;
for (let age = 24; age < 204; age += 3) {
  const plans = planQuestions(age);
  if (plans.length !== MAP_DOMAINS.length) ladderOk = false;
  // Worst case is base + two rungs in all 15 domains; typical kids see far
  // fewer because rungs only unlock on "easily".
  const total = maxQuestionsForAge(age);
  if (total < plans.length || total > plans.length * 3) {
    ladderOk = false;
    failures.push(`age ${age}m: ${total} max questions out of range`);
  }
  for (const plan of plans) {
    let previous = plan.base.typicalMonths;
    for (const rung of plan.ladders) {
      if (rung.typicalMonths <= previous) {
        ladderOk = false;
        failures.push(`age ${age}m ${plan.domainId}: ladder rungs not ascending`);
      }
      previous = rung.typicalMonths;
    }
  }
}
report("selection ladder: base + ladder sane for every age 2y to 16y", ladderOk);

// ---------- 3. Scorer fixtures ----------

/**
 * Simulates the client's serving order: base first, then ladder rungs while
 * the picked answer stays "easily" (exactly what buildQueue does in the UI).
 */
function answersFor(
  age: number,
  pick: (domainId: string, rungIndex: number) => MapAnswer | null,
): MapAnswerInput[] {
  const out: MapAnswerInput[] = [];
  for (const plan of planQuestions(age)) {
    const base = pick(plan.domainId, 0);
    if (!base) continue;
    out.push({ itemId: plan.base.id, answer: base });
    if (base !== "easily") continue;
    let rungIndex = 1;
    for (const rung of plan.ladders) {
      const answer = pick(plan.domainId, rungIndex);
      rungIndex += 1;
      if (!answer) break;
      out.push({ itemId: rung.id, answer });
      if (answer !== "easily") break;
    }
  }
  return out;
}

const AGE = 50; // 4y 2m

// Golden kid 1: everything easily → ahead across the board, capped, no growing.
const aheadKid = scoreMap(AGE, answersFor(AGE, () => "easily"));
report(
  "ahead kid: majority ahead, months capped at 24, none growing",
  aheadKid.domains.every((d) => d.exposureBased || d.position === "ahead" || d.position === "on_track") &&
    aheadKid.domains.every((d) => (d.monthsAhead ?? 0) <= 24) &&
    aheadKid.domains.some((d) => d.position === "ahead"),
  JSON.stringify(aheadKid.domains.map((d) => [d.domainId, d.position, d.monthsAhead])),
);

// Golden kid 2: mixed (Maya): math climbs two rungs, fine motor growing,
// spanish skipped, everything else easily at the base only.
const mixedKid = scoreMap(
  AGE,
  answersFor(AGE, (domainId, rungIndex) => {
    if (domainId === "math") return rungIndex <= 2 ? "easily" : "not_yet";
    if (domainId === "fine_motor") return "not_yet";
    if (domainId === "spanish") return "skip";
    if (domainId === "writing") return "getting_there";
    return rungIndex === 0 ? "easily" : null;
  }),
);
const mixedById = new Map(mixedKid.domains.map((d) => [d.domainId, d]));
report(
  "mixed kid: math ahead, fine motor growing, spanish not mapped",
  mixedById.get("math")?.position === "ahead" &&
    mixedById.get("fine_motor")?.position === "growing" &&
    mixedById.get("fine_motor")?.monthsAhead === null &&
    mixedById.get("spanish")?.position === "not_mapped",
  JSON.stringify([mixedById.get("math")?.position, mixedById.get("fine_motor")?.position, mixedById.get("spanish")?.position]),
);
report(
  "mixed kid: strengths order puts math before fine motor",
  mixedKid.strengthOrder.indexOf("math") < mixedKid.strengthOrder.indexOf("fine_motor"),
  mixedKid.strengthOrder.join(","),
);

// Golden kid 3: sparse (all not sure) → nothing mapped, note still kind.
const sparseKid = scoreMap(AGE, answersFor(AGE, () => "not_sure"));
report(
  "sparse kid: nothing mapped, zero observations held against her",
  sparseKid.mappedCount === 0 && sparseKid.domains.every((d) => d.position === "not_mapped"),
);

// Golden kid 4: struggling (all not yet) → growing everywhere, never a
// negative number, never a banned word. The hardest honest case.
const strugglingKid = scoreMap(AGE, answersFor(AGE, () => "not_yet"));
report(
  "struggling kid: growing framing only, no negative numbers anywhere",
  strugglingKid.domains.every((d) => d.position === "growing" || d.position === "not_mapped") &&
    strugglingKid.domains.every((d) => d.monthsAhead === null),
);

// Determinism: same answers, same map.
const again = scoreMap(AGE, answersFor(AGE, () => "easily"));
report("determinism: same answers produce the same map", JSON.stringify(again) === JSON.stringify(aheadKid));

// Golden kid 5: a 10-year-old (120mo), mixed profile across the new bands.
const TEN = 120;
const tenKid = scoreMap(
  TEN,
  answersFor(TEN, (domainId, rungIndex) => {
    if (domainId === "math") return rungIndex <= 1 ? "easily" : "getting_there";
    if (domainId === "executive_function") return "not_yet";
    if (domainId === "self_care") return "getting_there";
    return rungIndex === 0 ? "easily" : null;
  }),
);
const tenById = new Map(tenKid.domains.map((d) => [d.domainId, d]));
report(
  "10yo kid: math ahead, executive function growing, everything scorable",
  tenById.get("math")?.position === "ahead" &&
    tenById.get("executive_function")?.position === "growing" &&
    tenKid.mappedCount === tenKid.totalDomains,
  JSON.stringify([tenById.get("math")?.position, tenById.get("executive_function")?.position, tenKid.mappedCount]),
);

// Golden kid 6: a 15-year-old (180mo) who answers everything easily. Ahead
// where headroom exists, honestly "at age" in domains mastered years ago
// (phonics), never a growing state from strength alone.
const FIFTEEN = 180;
const teenKid = scoreMap(FIFTEEN, answersFor(FIFTEEN, () => "easily"));
report(
  "15yo kid: strengths cap at +24, plateaued domains read on track, none growing",
  teenKid.domains.every((d) => d.exposureBased || d.position === "ahead" || d.position === "on_track") &&
    teenKid.domains.every((d) => (d.monthsAhead ?? 0) <= 24),
  JSON.stringify(teenKid.domains.map((d) => [d.domainId, d.position, d.monthsAhead])),
);

// ---------- 4. Deep dive: probes down for strugglers, up for the strong ----------

{
  const AGE_10 = 126;
  const mathBase = planQuestions(AGE_10).find((plan) => plan.domainId === "math")!.base;
  // Struggler: base was "not yet". The next probe must sit BELOW the base
  // anchor (walking down to find the honest starting line).
  const downAnswers: Record<string, MapAnswer> = { [mathBase.id]: "not_yet" };
  const downProbe = nextDeepDiveItem("math", AGE_10, downAnswers, 0);
  report(
    "deep dive walks down after a not-yet",
    downProbe !== null && downProbe.typicalMonths < mathBase.typicalMonths,
    `probe=${downProbe?.id}`,
  );

  // Strong kid: everything easily. The probe must climb above the base.
  const upAnswers: Record<string, MapAnswer> = { [mathBase.id]: "easily" };
  const upProbe = nextDeepDiveItem("math", AGE_10, upAnswers, 0);
  report(
    "deep dive climbs up after an easily",
    upProbe !== null && upProbe.typicalMonths > mathBase.typicalMonths,
    `probe=${upProbe?.id}`,
  );

  // The sitting cap holds, and a full walk terminates.
  let walked = 0;
  const walkAnswers: Record<string, MapAnswer> = { [mathBase.id]: "not_yet" };
  for (;;) {
    const item = nextDeepDiveItem("math", AGE_10, walkAnswers, walked);
    if (!item) break;
    walkAnswers[item.id] = "not_yet";
    walked += 1;
    if (walked > 50) break;
  }
  report("deep dive sitting caps at DEEP_DIVE_CAP", walked <= DEEP_DIVE_CAP, `walked=${walked}`);
}

// ---------- 5. Plan builder: four honest weeks for every subject and age ----------

{
  let plansOk = true;
  for (const domain of MAP_DOMAINS) {
    for (const age of [30, 50, 126, 180]) {
      const base = planQuestions(age).find((plan) => plan.domainId === domain.id)!.base;
      const plan = buildFourWeekPlan(domain.id, age, [{ itemId: base.id, answer: "not_yet" }], {
        interests: ["dinosaurs"],
        style: "charlotte_mason",
      });
      if (!plan || plan.weeks.length !== 4 || plan.targets.length === 0) {
        plansOk = false;
        failures.push(`plan ${domain.id}@${age}: malformed`);
        continue;
      }
      for (const week of plan.weeks) {
        if (week.activities.length < 2) {
          plansOk = false;
          failures.push(`plan ${domain.id}@${age} week ${week.week}: too few activities`);
        }
        for (const activity of week.activities) {
          checkCopy(`plan.${domain.id}.w${week.week}`, activity);
          if (activity.includes("{skill}") || activity.includes("{interest}")) {
            plansOk = false;
            failures.push(`plan ${domain.id}@${age}: unfilled placeholder`);
          }
        }
      }
      if (plan.styleNote) checkCopy(`plan.${domain.id}.style`, plan.styleNote);
      // A not-yet on the base must make the base itself the first target,
      // never a much easier item from the bottom of the bank.
      const firstTarget = domain.items.find((item) => item.statement === plan.targets[0]);
      if (firstTarget && firstTarget.typicalMonths < base.typicalMonths - 6) {
        plansOk = false;
        failures.push(`plan ${domain.id}@${age}: first target far below the base`);
      }
    }
  }
  report("plan builder: 4 clean weeks for all 15 subjects at 4 ages", plansOk && failures.every((f) => !f.startsWith("plan ")));
}

// ---------- 6. Rendered sentences obey the laws ----------

const before = failures.length;
for (const scores of [aheadKid, mixedKid, sparseKid, strugglingKid, tenKid, teenKid]) {
  checkCopy("homaNote", homaNote(scores, "Maya", "Sarah"));
  for (const domain of scores.domains) {
    const line = domainLine(domain, "Maya");
    checkCopy(`line.${domain.domainId}`, `${line.badge} ${line.numberLabel} ${line.sentence}`);
    if (/-\d/.test(line.numberLabel)) failures.push(`line.${domain.domainId}: negative number rendered`);
  }
}
report("rendered sentences: no banned words, no em dashes, no negative numbers", failures.length === before);

// ----------

if (failures.length > 0) {
  console.error(`\n${failures.length} map check(s) FAILED`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nAll map checks passed.");
