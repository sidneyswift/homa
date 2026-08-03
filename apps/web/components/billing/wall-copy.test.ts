import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import * as wallCopy from "./wall-copy";
import {
  TRIAL_GATE_AGE_RANGE,
  TRIAL_GATE_ARTIFACT_CAPTION,
  TRIAL_GATE_WHAT_IT_IS,
  TRIAL_GATE_CHARGE_NOTE,
  TRIAL_GATE_CTA,
  TRIAL_GATE_EVERY_PLAN,
  TRIAL_GATE_FAMILY_PRICE,
  TRIAL_GATE_HEADLINE,
  TRIAL_GATE_MAKERS_LINE,
  TRIAL_GATE_REASSURANCE,
  TRIAL_GATE_SAVED_LINE,
  WALL_STALE_LESSON_LINE,
  tierChargeLine,
  tierDelta,
  trialChargeNoteDated,
  trialDatesFromNow,
  wallIncludedLine,
} from "./wall-copy";
import { PLAN_TIERS } from "../../lib/billing/wall-types";

test("lesson wall copy names the tapped lesson and printable worksheet", () => {
  assert.match(
    wallIncludedLine("lesson", "Maya"),
    /lesson.*printable worksheet/i,
  );
});

test("lesson stale copy reassures before offering the next step", () => {
  assert.equal(
    WALL_STALE_LESSON_LINE,
    "Your report is safe. Refreshing this page will reopen the lesson option.",
  );
});

test("lesson does not rename the existing month or legacy plan doors", () => {
  assert.match(wallIncludedLine("month", "Maya"), /Maya's month/);
  assert.match(
    wallIncludedLine("plan", "Maya"),
    /four-week plan/i,
  );
});

/**
 * The trial gate's own copy laws (2026-07-28 redesign). Every one of
 * these encodes a rule that a future edit would otherwise break
 * silently, because none of them fail a typecheck.
 */

const TRIAL_GATE_COPY = JSON.stringify({
  TRIAL_GATE_HEADLINE,
  TRIAL_GATE_REASSURANCE,
  TRIAL_GATE_CTA,
  TRIAL_GATE_CHARGE_NOTE,
  TRIAL_GATE_FAMILY_PRICE,
  TRIAL_GATE_EVERY_PLAN,
  TRIAL_GATE_SAVED_LINE,
  TRIAL_GATE_MAKERS_LINE,
  TRIAL_GATE_ARTIFACT_CAPTION,
  deltas: PLAN_TIERS.map((tier) => tierDelta(tier)),
});

test("the trial gate publishes no social proof it cannot support", () => {
  // Ruling C2 (journeys/10-reconciliation.md) plus the copy rulebook's
  // "no invented numbers, testimonials, or social proof". On the day
  // this shipped Homa had 78 real families, no trial ever started, and
  // no active subscription, so every one of these would be invented.
  // The FTC's 2024 rule on fake reviews and endorsements makes that a
  // legal exposure, not a matter of taste.
  for (const forbidden of [
    /most popular/i,
    /\bpopular\b/i,
    /loved by/i,
    /trusted by/i,
    /join \d/i,
    /\d[\d,]*\+? (families|parents|homeschoolers|customers|users)/i,
    /\b\d(\.\d)? stars?\b/i,
    /rated/i,
    /testimonial/i,
    /best[- ]selling/i,
  ]) {
    assert.doesNotMatch(TRIAL_GATE_COPY, forbidden, `forbidden social proof: ${forbidden}`);
  }
});

test("no tier carries an endorsement badge", () => {
  // "Most popular" was fabricated social proof; "Recommended" replaced
  // it and a ten-persona panel flagged it 10/10, three as a reason to
  // leave, because a green endorsement on the pricier row turns a
  // yes-or-no into a which-one. Plus routes on its own line instead.
  // Re-adding any badge export means re-adding the failure.
  const badgeExports = Object.keys(wallCopy).filter((key) => /BADGE/.test(key));
  assert.deepEqual(
    badgeExports,
    ["BILLING_TOGGLE_ANNUAL_BADGE"],
    "the only badge on this surface states the annual discount",
  );
});

test("no tier makes a claim about any state's filing rules", () => {
  // State filing was the $49 story until the 2026-07-28 ruling and is
  // deliberately gone: it was the page's largest unsupportable claim,
  // and it also asked a question the page could not answer ("does MY
  // state require filing?"), which sent two review personas to a search
  // engine instead of a checkout. Nothing here may name a state or
  // promise filing until one state actually works end to end (gh#297).
  const deltas = PLAN_TIERS.map((tier) => tierDelta(tier)).join(" ");
  assert.doesNotMatch(deltas, /\bfiling\b/i);
  assert.doesNotMatch(deltas, /\bquarterly\b/i);
  assert.doesNotMatch(
    deltas,
    /\b(New York|Texas|California|Missouri|Florida|Virginia|Pennsylvania)\b/i,
  );
});

test("the tiers run on one axis, each stating what it adds", () => {
  // How far Homa comes toward you: the web, then text and phone and
  // your own materials, then a person and a parcel. An anchor only
  // works when the top tier reads as more of the same idea, so the two
  // paid rows both state an addition and the base row states contents.
  assert.doesNotMatch(tierDelta("regular"), /^Adds /);
  assert.match(tierDelta("plus"), /^Adds /);
  // The top tier is the one thing the base tier cannot quietly match.
  assert.match(tierDelta("elite"), /post|person/i);
});

test("the top tier promises a person, never a named founder", () => {
  // A plan description is a standing promise. Naming who delivers it
  // makes it one that has to be kept at customer forty.
  assert.doesNotMatch(tierDelta("elite"), /Alessa|Carolyng|founder/i);
});

test("the trial gate states the card ask, the reminder day, and the way out", () => {
  // The three facts the old three-card timeline spent a screenful on.
  // They are allowed to move, never to disappear.
  assert.match(TRIAL_GATE_CHARGE_NOTE, /card/i);
  assert.match(TRIAL_GATE_CHARGE_NOTE, /day 4/i);
  assert.match(TRIAL_GATE_CHARGE_NOTE, /cancel/i);
  assert.match(TRIAL_GATE_CHARGE_NOTE, /pay nothing/i);
  assert.match(TRIAL_GATE_REASSURANCE, /charged/i);
});

test("the Day 4 promise matches the reminder the webhook actually sends", () => {
  // lib/billing/trial-reminder.ts rides Stripe's trial_will_end webhook,
  // which fires 3 days before trial end at any trial length. Stripe's
  // dashboard reminder fires 7 days before end, which for a 7-day trial
  // is the moment of signup. A "day 2" or "day 6" edit here would make
  // the page promise an email nothing sends.
  assert.match(TRIAL_GATE_CHARGE_NOTE, /day 4, three days before the first charge/i);
});

test("the words before the first price stay inside the scan budget", () => {
  // A teardown of 17 shipping pricing pages put the median distance
  // from the top of a phone screen to the first price at 12 words, with
  // a practical ceiling around 15: above it, no page landed a price in
  // the first screenful. The pre-redesign page had 149 words there and
  // showed no price at all in the first screenful.
  //
  // Three strings precede the picker, and the budget is their sum. The
  // makers line is the deliberate overage: a ten-persona panel named it
  // the most persuasive sentence on the page, and it is the only trust
  // signal a product with no customers to quote legitimately has. The
  // real gate is measured, not counted: the screenshot harness asserts
  // all three prices and the button clear the fold at 390x844, and they
  // do at this length. Anything added here has to pass that harness,
  // not this number.
  const words = [
    TRIAL_GATE_HEADLINE,
    TRIAL_GATE_REASSURANCE,
    TRIAL_GATE_WHAT_IT_IS,
    TRIAL_GATE_MAKERS_LINE,
  ]
    .join(" ")
    .trim()
    .split(/\s+/).length;
  assert.ok(words <= 50, `copy above the picker is ${words} words, budget is 50`);
});

test("each tier row says only what that tier adds, in one scannable line", () => {
  // The old cards ran 35, 41, and 51 words, so reading burden rose with
  // price: the tier needing the most consideration was the hardest to
  // scan. These are one line each and roughly parallel in length.
  for (const tier of PLAN_TIERS) {
    const delta = tierDelta(tier);
    const words = delta.split(/\s+/).length;
    assert.ok(words <= 10, `${tier} delta is ${words} words: "${delta}"`);
    assert.ok(delta.endsWith("."), `${tier} delta is not a sentence: "${delta}"`);
  }
});

test("the base row names artifacts, not categories", () => {
  // "Plans, worksheets, calls, and chat" described any assistant; one
  // persona read it as the ChatGPT tab she already had open. The hours
  // log is the item a free chatbot cannot be, and it is the legal
  // obligation the highest-compliance persona came to solve.
  assert.match(tierDelta("regular"), /hours log/i);
});

test("no tier claims a metering mechanic that nothing enforces", () => {
  // Nothing reads families.plan_tier to meter anything: there is no
  // base allowance, no multiplier, and no priority queue. So "five
  // times the makings" and "no waiting" were both false, in both
  // directions, and eight of ten personas read the second as proof the
  // cheap tier is deliberately throttled. Until enforcement ships,
  // a tier may not claim one.
  const deltas = PLAN_TIERS.map((tier) => tierDelta(tier)).join(" ");
  for (const unsupportable of [
    /\bmakings?\b/i,
    /\bno waiting\b/i,
    /\bno delay\b/i,
    /\bpriority\b/i,
    /\bfaster\b/i,
    /\bunlimited\b/i,
    /\b(five|5)\s*(times|x)\b/i,
  ]) {
    assert.doesNotMatch(deltas, unsupportable, `unenforced claim: ${unsupportable}`);
  }
});

test("the page answers whether the price covers every child", () => {
  // The single most asked question of the ten-persona panel, and a
  // would-leave for both multi-child readers. WALL_BULLETS has carried
  // this fact since the wall shipped; the picker rewrite dropped it
  // once already.
  assert.match(TRIAL_GATE_FAMILY_PRICE, /whole family/i);
  assert.match(TRIAL_GATE_FAMILY_PRICE, /adding children/i);
});

test("the mechanics say how to cancel, not only when", () => {
  // "Cancel anytime" with no mechanism is the sentence the
  // previously-burned persona distrusts most. The path is real and
  // self-serve: /app/settings links the Stripe billing portal.
  assert.match(TRIAL_GATE_CHARGE_NOTE, /in your settings/i);
});

test("the shared list does not promise what only a paid tier includes", () => {
  // Text, email, and the phone line moved to the second tier on
  // 2026-07-28. A shared list that still promised them to every plan
  // would contradict the row two inches above it, and the parent who
  // notices stops believing both.
  const list = TRIAL_GATE_EVERY_PLAN.join(" ");
  assert.doesNotMatch(list, /\btext\b/i);
  assert.doesNotMatch(list, /\bphone\b|\bcall\b/i);
  assert.doesNotMatch(list, /\bemail\b/i);
  // And it never reads as Homa telephoning the children, which is how
  // one persona of ten read the line this replaced.
  assert.doesNotMatch(list, /phone calls with Homa/i);
});

test("the shared list names hours, the state obligation", () => {
  assert.match(TRIAL_GATE_EVERY_PLAN.join(" "), /hours/i);
});

test("the shared contents are a list, and each line is one thing", () => {
  // It was a single 60-word sentence and five of ten personas skipped
  // every word of it, which mattered because it is the only place the
  // page says what is included.
  assert.ok(Array.isArray(TRIAL_GATE_EVERY_PLAN));
  assert.ok(TRIAL_GATE_EVERY_PLAN.length >= 4 && TRIAL_GATE_EVERY_PLAN.length <= 6);
  for (const line of TRIAL_GATE_EVERY_PLAN) {
    const words = line.split(/\s+/).length;
    assert.ok(words <= 12, `list line is ${words} words: "${line}"`);
  }
});

test("no billing surface uppercases a string carrying the brand name", () => {
  // WALL_EYEBROW is "Homa membership". Three surfaces rendered it with
  // an `uppercase` class, which puts "HOMA MEMBERSHIP" on screen: the
  // name is always written "Homa", and a hand-typed imitation of the
  // wordmark is exactly what the 2026-07-28 brand correction retires
  // (`brand-casing-homa`). A CSS transform is still typing it.
  //
  // The stale rule survived in .agents/skills/homa-copy-writer/SKILL.md
  // ("HOMA on UI surfaces, per global founder ruling D8") for long
  // enough to produce all three, which is why this is a test and not a
  // comment.
  const brandEyebrowExports = ["WALL_EYEBROW"];
  const files = [
    "./wall-offer.tsx",
    "./report-lock-offer.tsx",
    "./trial-gate.tsx",
    "./tier-options.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    // Strip comments so the ban can be explained in prose in the file
    // it applies to.
    const code = source.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const exported of brandEyebrowExports) {
      if (!code.includes(exported)) continue;
      assert.doesNotMatch(
        code,
        /uppercase/,
        `${file} renders ${exported} and applies an uppercase transform`,
      );
    }
  }
});

test("the charged-today answer is rendered, not merely exported", () => {
  // This sentence was dropped from the render by accident when the
  // identity sentence was added above it, and the panel's
  // comprehension score on "am I charged today" fell from ten of ten
  // correct to zero of ten in one round. The string test cannot catch a
  // missing render, so this asserts the wiring instead: the component
  // source must reference it.
  const source = readFileSync(new URL("./trial-gate.tsx", import.meta.url), "utf8");
  const rendered = /\{TRIAL_GATE_REASSURANCE\}/.test(source);
  assert.ok(rendered, "TRIAL_GATE_REASSURANCE is imported but never rendered in trial-gate.tsx");
  assert.match(TRIAL_GATE_REASSURANCE, /charged/i);
});

test("billing presentation surfaces use Quiet markers and actions", () => {
  const trial = readFileSync(new URL("./trial-gate.tsx", import.meta.url), "utf8");
  const tiers = readFileSync(new URL("./tier-options.tsx", import.meta.url), "utf8");
  const modal = readFileSync(new URL("./wall-modal.tsx", import.meta.url), "utf8");
  assert.match(trial, /data-brand-layer="trial-gate"/u);
  assert.match(tiers, /quiet-tier-options/u);
  assert.match(tiers, /quiet-action quiet-action--primary/u);
  assert.match(modal, /quiet-paywall__modal/u);
  assert.doesNotMatch(tiers, /reportButtonClass/u);
});

test("the first thing the list offers is an outcome, not a chore", () => {
  assert.doesNotMatch(TRIAL_GATE_EVERY_PLAN[0], /^The questionnaire/i);
  assert.match(TRIAL_GATE_EVERY_PLAN[0], /report/i);
});

test("the page says what Homa is before it says what she costs", () => {
  // Ten of ten personas recalled the prices and none could say what
  // they bought. The identity sentence names the category plainly and
  // grounds the pronoun the rest of the page uses.
  assert.match(TRIAL_GATE_WHAT_IT_IS, /\bAI\b/);
  assert.match(TRIAL_GATE_WHAT_IT_IS, /homeschool/i);
  // Verb-first about work removed, not nouns delivered.
  assert.match(TRIAL_GATE_WHAT_IT_IS, /plans the week/i);
});

test("the age claim states the range that exists in code", () => {
  // packages/core/src/map/bands.ts: SCORED_MIN_MONTHS 24,
  // SCORED_MAX_MONTHS 204. It is a claim about the REPORT, never about
  // the worksheets, whose v1 range is narrower.
  assert.match(TRIAL_GATE_AGE_RANGE, /\b2\b/);
  assert.match(TRIAL_GATE_AGE_RANGE, /\b16\b/);
  assert.match(TRIAL_GATE_AGE_RANGE, /report/i);
});

test("the dated charge note keeps every fact the relative one carries", () => {
  // The dates render from the visitor's own clock after mount. The
  // sentence must not lose the card ask, the reminder, the way out, or
  // the months after the trial when it gains them.
  const dated = trialChargeNoteDated("August 1", "August 4");
  assert.match(dated, /card starts the trial/i);
  assert.match(dated, /August 1/);
  assert.match(dated, /August 4/);
  assert.match(dated, /in your settings/i);
  assert.match(dated, /pay nothing/i);
  assert.match(dated, /any month after that/i);
  assert.doesNotMatch(dated, /day 4|day 7/i);
});

test("the trial dates are day 4 and day 7 counted from the visit", () => {
  const { remindOn, chargeOn } = trialDatesFromNow(new Date("2026-07-28T12:00:00"));
  assert.equal(remindOn, "August 1");
  assert.equal(chargeOn, "August 4");
});

test("the cancellation promise covers the months after the trial", () => {
  // ROSCA requires a simple cancellation mechanism, and the silence on
  // month two was read as evasive by the previously-charged persona.
  assert.match(TRIAL_GATE_CHARGE_NOTE, /any month after that/i);
});

test("the way out is a statement, never a question that invites leaving", () => {
  // Six of ten personas named "Not ready today?" as the exact sentence
  // that let them close the tab. The fact stays; the invitation goes.
  assert.doesNotMatch(TRIAL_GATE_SAVED_LINE, /\?/);
  assert.match(TRIAL_GATE_SAVED_LINE, /saved/i);
});

test("the button commits to a price without carrying it in the label", () => {
  // One short tap target, with the number it commits to directly under
  // it, so the two can never disagree.
  assert.ok(TRIAL_GATE_CTA.length <= 24, `CTA is ${TRIAL_GATE_CTA.length} chars`);
  assert.doesNotMatch(TRIAL_GATE_CTA, /\$/);
  assert.equal(tierChargeLine("regular", "monthly"), "Then $19 a month.");
  assert.equal(tierChargeLine("plus", "monthly"), "Then $49 a month.");
  assert.equal(tierChargeLine("elite", "annual"), "Then $1,910 a year.");
});

test("the proof row names real people and never a fabricated crowd", () => {
  // The public co-founder signature, matching the landing page's
  // FOUNDER_STORY_COPY. This is first-party evidence a pre-revenue
  // product legitimately has.
  assert.match(TRIAL_GATE_MAKERS_LINE, /Alessa and Carolyng/);
});

test("the trial gate keeps the surface vocabulary laws", () => {
  // "7 free days" never "free month" ("month" is the price unit and the
  // child's month plan), the name is always written "Homa", and the way
  // out is named rather than implied.
  assert.doesNotMatch(TRIAL_GATE_COPY, /free month/i);
  assert.doesNotMatch(TRIAL_GATE_COPY, /HOMA/);
  // Escaped, not literal: the em-dash guard scans this file too, and a
  // literal one here would trip it (same reason landing-content.test.ts
  // writes it this way).
  assert.doesNotMatch(TRIAL_GATE_COPY, /\u2014/);
  assert.doesNotMatch(TRIAL_GATE_COPY, /\bbehind\b/i);
});
