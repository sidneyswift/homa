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
  aheadCapForAge,
  BANNED_WORDS,
  buildFourWeekPlan,
  buildMonthPlan,
  CORE_SUBJECT_IDS,
  CORE_LADDER_RUNGS,
  MAX_LADDER_RUNGS,
  MONTH_PLAN_SUBJECT,
  DEEP_DIVE_CAP,
  subjectLine,
  EM_DASH,
  getMapItem,
  homaNote,
  MAP_SUBJECTS,
  MAP_SOURCES,
  maxQuestionsForAge,
  nextDeepDiveItem,
  PERSONALIZATION_EXCEPTION_IDS,
  personalizeStatement,
  planQuestions,
  scoreMap,
  validateNarrative,
  validatePlanNarrative,
  type MapAnswer,
  type MapAnswerInput,
  type PlanNarrative,
  type ReportNarrative,
} from "../packages/core/src/index";

const failures: string[] = [];

function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

// Words the report may never contain (journeys/07 never-say list) plus the
// em dash (brand law), imported from map/copy-laws.ts so the runtime
// narrative gate enforces the exact same law. "test" is allowed only
// inside "never a test" phrasing, so it is checked separately below.
const BANNED = BANNED_WORDS;

function checkCopy(label: string, text: string): void {
  if (BANNED.test(text)) failures.push(`${label}: banned word in "${text.slice(0, 80)}"`);
  if (EM_DASH.test(text)) failures.push(`${label}: em dash in "${text.slice(0, 80)}"`);
}

// ---------- 1. Content lint ----------

let itemCount = 0;
for (const domain of MAP_SUBJECTS) {
  checkCopy(`${domain.id}.intro`, domain.intro);
  checkCopy(`${domain.id}.whatItIs`, domain.whatItIs);
  if (!domain.whatItIs.trim()) failures.push(`${domain.id}: empty whatItIs`);
  checkCopy(`${domain.id}.activity`, `${domain.growingActivity.title} ${domain.growingActivity.description}`);
  for (const item of domain.items) {
    itemCount += 1;
    checkCopy(item.id, item.statement);
    if (item.sources.length === 0) failures.push(`${item.id}: no citation`);
    for (const key of item.sources) {
      if (!MAP_SOURCES[key]) failures.push(`${item.id}: unknown source key "${key}"`);
    }
    // Standard codes are optional but never empty or dashed when present.
    for (const code of item.standards ?? []) {
      if (!code.trim()) failures.push(`${item.id}: empty standards code`);
      if (EM_DASH.test(code)) failures.push(`${item.id}: em dash in standards code`);
    }
    // 20mo floor (bank starts at 2y) to ~17.5y ceiling (ladder headroom for
    // detecting ahead at the top of the 2-16 range).
    if (item.typicalMonths < 20 || item.typicalMonths > 210) {
      failures.push(`${item.id}: typicalMonths ${item.typicalMonths} outside sane range`);
    }
    // A typical WINDOW, when documented, must be a real window that
    // contains its own anchor (the band renders around the dot's truth).
    const range = item.typicalRangeMonths;
    if (
      range &&
      (range[0] >= range[1] || item.typicalMonths < range[0] || item.typicalMonths > range[1])
    ) {
      failures.push(`${item.id}: typicalRangeMonths [${range[0]}, ${range[1]}] inconsistent with anchor ${item.typicalMonths}`);
    }
  }
}
report(`content lint: ${MAP_SUBJECTS.length} domains, ${itemCount} items, all cited and clean`, failures.length === 0);

// ---------- 1b. Personalization: every question takes the kid's name ----------
// The checklist and deep dive render personalizeStatement(name, item)
// ("Story counts out loud to 10?"), which prefixes the name and expects a
// third-person verb phrase. A statement shaped any other way must register
// a hand-written exception in map/personalize.ts or it fails here.
{
  const before1b = failures.length;
  const bankIds = new Set(MAP_SUBJECTS.flatMap((domain) => domain.items.map((item) => item.id)));
  for (const id of PERSONALIZATION_EXCEPTION_IDS) {
    if (!bankIds.has(id)) failures.push(`personalize exception "${id}" is not a bank item`);
  }
  for (const domain of MAP_SUBJECTS) {
    for (const item of domain.items) {
      const personalized = personalizeStatement("Story", item);
      checkCopy(`personalized.${item.id}`, personalized);
      if (!personalized.includes("Story")) {
        failures.push(`${item.id}: personalization dropped the child's name`);
      }
      // Third-person singular verbs end in s (Counts, Reads, Has, Gets);
      // anything else ("Someone who just met them...") reads as word salad
      // with a name prefixed and needs its own hand-written line.
      if (
        !PERSONALIZATION_EXCEPTION_IDS.includes(item.id) &&
        !/^[A-Z][A-Za-z'-]*s\b/.test(item.statement)
      ) {
        failures.push(
          `${item.id}: "${item.statement.slice(0, 50)}" doesn't start with a third-person verb; add an exception in map/personalize.ts`,
        );
      }
    }
  }
  report("personalization: every question reads naturally with the kid's name", failures.length === before1b);
}

// ---------- 2. Selection ladder sanity ----------

// Worst case is base + two rungs per non-core domain and base + six rungs
// per core subject; typical kids see far fewer because rungs only unlock
// on "easily".
const MAX_TOTAL_QUESTIONS = MAP_SUBJECTS.reduce(
  (total, domain) =>
    total + 1 + (CORE_SUBJECT_IDS.includes(domain.id) ? CORE_LADDER_RUNGS : MAX_LADDER_RUNGS),
  0,
);

let ladderOk = true;
for (let age = 24; age < 204; age += 3) {
  const plans = planQuestions(age);
  if (plans.length !== MAP_SUBJECTS.length) ladderOk = false;
  const total = maxQuestionsForAge(age);
  if (total < plans.length || total > MAX_TOTAL_QUESTIONS) {
    ladderOk = false;
    failures.push(`age ${age}m: ${total} max questions out of range`);
  }
  for (const plan of plans) {
    let previous = plan.base.typicalMonths;
    for (const rung of plan.ladders) {
      if (rung.typicalMonths <= previous) {
        ladderOk = false;
        failures.push(`age ${age}m ${plan.subjectId}: ladder rungs not ascending`);
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
  pick: (subjectId: string, rungIndex: number) => MapAnswer | null,
): MapAnswerInput[] {
  const out: MapAnswerInput[] = [];
  for (const plan of planQuestions(age)) {
    const base = pick(plan.subjectId, 0);
    if (!base) continue;
    out.push({ itemId: plan.base.id, answer: base });
    if (base !== "easily") continue;
    let rungIndex = 1;
    for (const rung of plan.ladders) {
      const answer = pick(plan.subjectId, rungIndex);
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
  "ahead kid: majority ahead, months capped for their age, none growing",
  aheadKid.subjects.every((d) => d.exposureBased || d.position === "ahead" || d.position === "on_track") &&
    aheadKid.subjects.every((d) => (d.monthsAhead ?? 0) <= aheadCapForAge(AGE)) &&
    aheadKid.subjects.some((d) => d.position === "ahead"),
  JSON.stringify(aheadKid.subjects.map((d) => [d.subjectId, d.position, d.monthsAhead])),
);

// Golden kid 2: mixed (Maya): math climbs two rungs, fine motor growing,
// spanish skipped, everything else easily at the base only.
const mixedKid = scoreMap(
  AGE,
  answersFor(AGE, (subjectId, rungIndex) => {
    if (subjectId === "math") return rungIndex <= 2 ? "easily" : "not_yet";
    if (subjectId === "fine_motor") return "not_yet";
    if (subjectId === "spanish") return "skip";
    if (subjectId === "writing") return "getting_there";
    return rungIndex === 0 ? "easily" : null;
  }),
);
const mixedById = new Map(mixedKid.subjects.map((d) => [d.subjectId, d]));
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
  sparseKid.mappedCount === 0 && sparseKid.subjects.every((d) => d.position === "not_mapped"),
);

// Golden kid 4: struggling (all not yet) → growing everywhere, never a
// negative number, never a banned word. The hardest honest case.
const strugglingKid = scoreMap(AGE, answersFor(AGE, () => "not_yet"));
report(
  "struggling kid: growing framing only, no negative numbers anywhere",
  strugglingKid.subjects.every((d) => d.position === "growing" || d.position === "not_mapped") &&
    strugglingKid.subjects.every((d) => d.monthsAhead === null),
);

// Determinism: same answers, same map.
const again = scoreMap(AGE, answersFor(AGE, () => "easily"));
report("determinism: same answers produce the same map", JSON.stringify(again) === JSON.stringify(aheadKid));

// Golden kid 5: a 10-year-old (120mo), mixed profile across the new bands.
const TEN = 120;
const tenKid = scoreMap(
  TEN,
  answersFor(TEN, (subjectId, rungIndex) => {
    if (subjectId === "math") return rungIndex <= 1 ? "easily" : "getting_there";
    if (subjectId === "executive_function") return "not_yet";
    if (subjectId === "self_care") return "getting_there";
    return rungIndex === 0 ? "easily" : null;
  }),
);
const tenById = new Map(tenKid.subjects.map((d) => [d.subjectId, d]));
report(
  "10yo kid: math ahead, executive function growing, everything scorable",
  tenById.get("math")?.position === "ahead" &&
    tenById.get("executive_function")?.position === "growing" &&
    tenKid.mappedCount === tenKid.totalSubjects,
  JSON.stringify([tenById.get("math")?.position, tenById.get("executive_function")?.position, tenKid.mappedCount]),
);

// Golden kid 6: a 15-year-old (180mo) who answers everything easily. Ahead
// where headroom exists, honestly "at age" in domains mastered years ago
// (phonics), never a growing state from strength alone.
const FIFTEEN = 180;
const teenKid = scoreMap(FIFTEEN, answersFor(FIFTEEN, () => "easily"));
report(
  "15yo kid: strengths cap at +24, plateaued domains read on track, none growing",
  teenKid.subjects.every((d) => d.exposureBased || d.position === "ahead" || d.position === "on_track") &&
    teenKid.subjects.every((d) => (d.monthsAhead ?? 0) <= 24),
  JSON.stringify(teenKid.subjects.map((d) => [d.subjectId, d.position, d.monthsAhead])),
);

// Golden kid 7: the trust regression (2026-07-08). A 2y3m-old whose parent
// taps "easily" on every language question used to read "+19 mo ahead in
// speaking", and the mom rightly didn't believe it. With window credit and
// the age-scaled cap, the strongest possible claim at 27mo is +9.
const TODDLER = 27;
const toddler = scoreMap(TODDLER, answersFor(TODDLER, () => "easily"));
const toddlerLanguage = toddler.subjects.find((d) => d.subjectId === "language");
report(
  "27mo trust case: all-easily language reads +9, never +19",
  toddlerLanguage?.position === "ahead" && toddlerLanguage.monthsAhead === 9,
  JSON.stringify([toddlerLanguage?.position, toddlerLanguage?.monthsAhead]),
);
report(
  "27mo trust case: no subject claims more than a third of the child's age",
  toddler.subjects.every((d) => (d.monthsAhead ?? 0) <= aheadCapForAge(TODDLER)),
  JSON.stringify(toddler.subjects.map((d) => [d.subjectId, d.monthsAhead])),
);

// The proportionality law, swept: at EVERY scored age, the most generous
// possible parent (easily on everything served) can never produce a claim
// past min(24, about a third of age) in any subject.
{
  let capOk = true;
  for (let age = 24; age < 204; age += 1) {
    const swept = scoreMap(age, answersFor(age, () => "easily"));
    for (const d of swept.subjects) {
      if ((d.monthsAhead ?? 0) > aheadCapForAge(age)) {
        capOk = false;
        failures.push(`age ${age}m ${d.subjectId}: +${d.monthsAhead} exceeds cap ${aheadCapForAge(age)}`);
      }
    }
  }
  report("proportional cap: no age, no subject, no answer pattern beats min(24, age/3)", capOk);
}

// Golden kid 8: the truly gifted 4-year-old (48mo). Core ladders climb
// past the display window until the run ends, so the report holds the
// PROOF (a confirmed skill typical of a much older child), the displayed
// number caps honestly, and beyondScale marks it as a floor.
{
  const GIFTED_AGE = 48;
  const gifted = scoreMap(GIFTED_AGE, answersFor(GIFTED_AGE, () => "easily"));
  const giftedMath = gifted.subjects.find((d) => d.subjectId === "math");
  const mathPlan = planQuestions(GIFTED_AGE).find((plan) => plan.subjectId === "math")!;
  const highestServed = mathPlan.ladders[mathPlan.ladders.length - 1];
  report(
    "gifted 4yo: math climbs far past the window (6 rungs served, top rung 2y+ above age)",
    mathPlan.ladders.length === CORE_LADDER_RUNGS &&
      highestServed.typicalMonths >= GIFTED_AGE + 24,
    JSON.stringify(mathPlan.ladders.map((rung) => [rung.id, rung.typicalMonths])),
  );
  report(
    "gifted 4yo: number caps at the age rule AND is marked as a floor (beyondScale)",
    giftedMath?.position === "ahead" &&
      giftedMath.monthsAhead === aheadCapForAge(GIFTED_AGE) &&
      giftedMath.beyondScale === true,
    JSON.stringify([giftedMath?.monthsAhead, giftedMath?.beyondScale]),
  );
  // The evidence line names a skill genuinely past the cap, so the mom of
  // a truly advanced kid SEES it even though the number stays modest.
  const strongest = gifted.subjects
    .filter((d) => d.subjectId === "math")
    .map((d) => d.strongestObservedStatement)[0];
  const strongestItem = MAP_SUBJECTS.find((d) => d.id === "math")!.items.find(
    (item) => item.statement === strongest,
  );
  report(
    "gifted 4yo: the confirmed evidence names a skill past the displayed cap",
    strongestItem !== undefined &&
      strongestItem.typicalMonths > GIFTED_AGE + aheadCapForAge(GIFTED_AGE),
    `strongest=${strongestItem?.id} @${strongestItem?.typicalMonths}mo`,
  );

  // And the floor flag never fires on an honest, uncapped ahead: a kid
  // whose run ends inside the window reads as a measurement, not a floor.
  const modest = scoreMap(
    GIFTED_AGE,
    answersFor(GIFTED_AGE, (subjectId, rungIndex) =>
      subjectId === "math" ? (rungIndex <= 1 ? "easily" : "not_yet") : "not_sure",
    ),
  );
  const modestMath = modest.subjects.find((d) => d.subjectId === "math");
  report(
    "bracketed kid: an in-window frontier is NOT marked as a floor",
    modestMath?.position === "ahead" && modestMath.beyondScale === false,
    JSON.stringify([modestMath?.position, modestMath?.monthsAhead, modestMath?.beyondScale]),
  );
}

// The struggling kid never gets a floor flag (no confirmed frontier), and
// the walk-down machinery has somewhere real to walk: after a base
// not-yet, the next probe sits BELOW the base, and answering it "easily"
// gives the plan an honest confirmed starting line.
{
  const STRUGGLE_AGE = 72;
  const struggling = scoreMap(STRUGGLE_AGE, answersFor(STRUGGLE_AGE, () => "not_yet"));
  report(
    "struggling kid: growing everywhere, never a beyondScale flag",
    struggling.subjects.every((d) => !d.beyondScale),
  );
  const literacyBase = planQuestions(STRUGGLE_AGE).find((plan) => plan.subjectId === "literacy")!.base;
  const walkAnswers: Record<string, MapAnswer> = { [literacyBase.id]: "not_yet" };
  const firstProbe = nextDeepDiveItem("literacy", STRUGGLE_AGE, walkAnswers, 0);
  const probeBelowBase =
    firstProbe !== null && firstProbe.typicalMonths < literacyBase.typicalMonths;
  let honestLine = false;
  if (firstProbe) {
    const rescored = scoreMap(STRUGGLE_AGE, [
      { itemId: literacyBase.id, answer: "not_yet" },
      { itemId: firstProbe.id, answer: "easily" },
    ]);
    const lit = rescored.subjects.find((d) => d.subjectId === "literacy");
    honestLine =
      lit?.position === "growing" &&
      lit.strongestObservedStatement === firstProbe.statement &&
      getMapItem(firstProbe.id) !== undefined;
  }
  report(
    "struggling kid: the walk-down probes below the base and a win becomes the confirmed starting line",
    probeBelowBase && honestLine,
    `probe=${firstProbe?.id}`,
  );
}

// ---------- 4. Deep dive: probes down for strugglers, up for the strong ----------

{
  const AGE_10 = 126;
  const mathBase = planQuestions(AGE_10).find((plan) => plan.subjectId === "math")!.base;
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
  for (const domain of MAP_SUBJECTS) {
    for (const age of [30, 50, 126, 180]) {
      const base = planQuestions(age).find((plan) => plan.subjectId === domain.id)!.base;
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
  report(`plan builder: 4 clean weeks for all ${MAP_SUBJECTS.length} subjects at 4 ages`, plansOk && failures.every((f) => !f.startsWith("plan ")));
}

// ---------- 5b. The unified month: one weighted plan for the whole child ----------

{
  // A growing-heavy 45-month-old: cores behind, music a strength.
  const monthAnswers = [
    { itemId: "math.counts-to-5", answer: "getting_there" },
    { itemId: "math.counts-to-10", answer: "not_yet" },
    { itemId: "literacy.book-handling", answer: "getting_there" },
    { itemId: "literacy.own-name-letters", answer: "not_yet" },
    { itemId: "self_care.spoon-cup", answer: "easily" },
    { itemId: "self_care.toilet-day", answer: "not_yet" },
    { itemId: "music.moves-to-music", answer: "easily" },
    { itemId: "music.sings-along", answer: "easily" },
    { itemId: "music.steady-beat", answer: "easily" },
  ] as const;
  const month = buildMonthPlan(45, [...monthAnswers], { interests: ["trucks"] });
  let monthOk = Boolean(
    month &&
      month.subjectId === MONTH_PLAN_SUBJECT &&
      month.weeks.length === 4 &&
      month.targets.length >= 2 &&
      month.targets.length <= 3,
  );
  if (month) {
    for (const week of month.weeks) {
      // Every focus subject contributes one activity per week, each
      // prefixed with its subject name so the mix reads honestly.
      if (week.activities.length < month.targets.length) monthOk = false;
      for (const activity of week.activities) {
        checkCopy(`month.w${week.week}`, activity);
        if (!/^[A-Z][^:]{1,40}: /.test(activity) && !activity.includes("strength")) monthOk = false;
      }
    }
  }
  report("month plan: weighted, capped at 3 focuses, subject-prefixed weeks", monthOk);

  // A kid with no cores mapped builds no month (nothing to focus).
  const empty = buildMonthPlan(45, [{ itemId: "music.moves-to-music", answer: "easily" }], {});
  report("month plan: no focusable cores means no month, never a filler plan", empty === null);
}

// ---------- 6. Rendered sentences obey the laws ----------

const before = failures.length;
for (const scores of [aheadKid, mixedKid, sparseKid, strugglingKid, tenKid, teenKid]) {
  checkCopy("homaNote", homaNote(scores, "Maya"));
  for (const domain of scores.subjects) {
    const line = subjectLine(domain, "Maya");
    checkCopy(`line.${domain.subjectId}`, `${line.badge} ${line.numberLabel} ${line.sentence}`);
    if (/-\d/.test(line.numberLabel)) failures.push(`line.${domain.subjectId}: negative number rendered`);
  }
}
report("rendered sentences: no banned words, no em dashes, no negative numbers", failures.length === before);

// ---------- 7. Narrative fixtures pass the runtime gate at the current prompt version ----------

{
  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const { REPORT_PROMPT_VERSION } = await import("../apps/web/agent/report-writer-version");
  const {
    SAMPLE_NARRATIVE,
    SAMPLE_NARRATIVE_GATE_CONTEXT,
    SAMPLE_NARRATIVE_PROMPT_VERSION,
  } = await import("../apps/web/app/onboarding/sample/narrative.fixture");

  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const redTeam = JSON.parse(
    readFileSync(path.join(scriptsDir, "fixtures/red-team-narrative.json"), "utf8"),
  ) as {
    promptVersion: string;
    narrative: ReportNarrative;
    gateContext: Parameters<typeof validateNarrative>[1];
  };

  // Version lock: any prompt or schema change bumps REPORT_PROMPT_VERSION,
  // which fails here until fixtures are regenerated and founder re-read.
  report(
    "narrative fixtures: stamped at the current prompt version",
    SAMPLE_NARRATIVE_PROMPT_VERSION === REPORT_PROMPT_VERSION &&
      redTeam.promptVersion === REPORT_PROMPT_VERSION,
    `sample=${SAMPLE_NARRATIVE_PROMPT_VERSION} redteam=${redTeam.promptVersion} current=${REPORT_PROMPT_VERSION}`,
  );

  const sampleVerdicts = validateNarrative(SAMPLE_NARRATIVE, SAMPLE_NARRATIVE_GATE_CONTEXT);
  report(
    "narrative fixtures: sample (Maya) passes the runtime gate clean",
    sampleVerdicts.rejectedPieces.length === 0 && !sampleVerdicts.failed,
    JSON.stringify(sampleVerdicts.rejected),
  );

  const redTeamVerdicts = validateNarrative(redTeam.narrative, redTeam.gateContext);
  report(
    "narrative fixtures: red-team (struggling kid) passes the runtime gate clean",
    redTeamVerdicts.rejectedPieces.length === 0 && !redTeamVerdicts.failed,
    JSON.stringify(redTeamVerdicts.rejected),
  );
}

// ---------- 8. Narrative gate unit checks (pure, no network) ----------

{
  const gateContext = {
    allowedNumbers: ["4", "2", "16", "21"],
    siblingNames: ["Casey"],
    childName: "Maya",
  };
  const goodPiece = "Maya is doing beautifully here, and the next step is clear.";
  const base: ReportNarrative = {
    note: goodPiece,
    subjects: { math: goodPiece },
    drawers: { math: goodPiece },
  };
  const cases: Array<[string, ReportNarrative, string]> = [
    ["banned word", { ...base, note: "She is behind here." }, "note"],
    ["em dash", { ...base, note: "Nice work \u2014 truly." }, "note"],
    ["invented number", { ...base, subjects: { math: "Try counting to 100 together." } }, "subject.math"],
    ["negative number", { ...base, subjects: { math: "She moved -3 months." } }, "subject.math"],
    ["sibling name", { ...base, subjects: { math: "Unlike Casey, Maya counts." } }, "subject.math"],
    ["diagnosis phrasing", { ...base, drawers: { math: "This may suggest ADHD." } }, "drawer.math"],
    ["empty piece", { ...base, note: "  " }, "note"],
    ["pronoun guessed from the name", { ...base, note: "She loves to count." }, "note"],
  ];
  let gateOk = true;
  for (const [label, narrative, expectedKey] of cases) {
    const verdicts = validateNarrative(narrative, gateContext);
    if (!verdicts.rejectedPieces.includes(expectedKey)) {
      gateOk = false;
      failures.push(`gate misses ${label}`);
    }
  }
  const clean = validateNarrative(base, gateContext);
  if (clean.rejectedPieces.length > 0 || clean.failed) {
    gateOk = false;
    failures.push("gate rejects clean copy");
  }
  const allowedNumberPass = validateNarrative(
    { ...base, note: "At 4 years 2 months, all 16 subjects are mapped." },
    gateContext,
  );
  if (allowedNumberPass.rejectedPieces.length > 0) {
    gateOk = false;
    failures.push("gate rejects numbers that ARE in the facts");
  }
  // The parent's own words are the one license for he/she (a boy named
  // Story must never be "she" just because the model liked the name).
  const parentPronounPass = validateNarrative(
    { ...base, note: "You said he lights up during dice games, and it shows." },
    { ...gateContext, genderedPronounsAllowed: true },
  );
  if (parentPronounPass.rejectedPieces.length > 0) {
    gateOk = false;
    failures.push("gate rejects pronouns the parent herself used");
  }
  const planVerdicts = validatePlanNarrative(
    { intro: goodPiece, weeks: [goodPiece, goodPiece, goodPiece], closing: "She is behind." },
    gateContext,
  );
  if (!planVerdicts.rejectedPieces.includes("closing") || !planVerdicts.rejectedPieces.includes("week.3")) {
    gateOk = false;
    failures.push("plan gate misses a missing week or banned closing");
  }
  report("narrative gate: catches banned words, invented numbers, siblings, diagnoses; passes clean copy", gateOk);
}

// ----------

if (failures.length > 0) {
  console.error(`\n${failures.length} map check(s) FAILED`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nAll map checks passed.");
