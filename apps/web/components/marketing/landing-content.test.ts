import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CAPABILITY_ITEMS,
  CAPABILITY_FEATURE_HREFS,
  FOUNDER_STORY_COPY,
  HERO_COPY,
  LANDING_SECTION_COPY,
  PLATFORM_ITEMS,
  PRODUCT_PREVIEW_COPY,
  SAMPLE_REPORT_COPY,
  WORKFLOW_ITEMS,
} from "./landing-content";

const QUIET_LANDING_SOURCE = readFileSync(new URL("./QuietLanding.tsx", import.meta.url), "utf8");

test("the landing hero names Homa's category and primary action", () => {
  assert.equal(HERO_COPY.headline, "Homeschool, handled.");
  assert.equal(HERO_COPY.primaryAction, "Start your 7 free days");
  assert.equal(HERO_COPY.eyebrow, "Your homeschool assistant");
  assert.match(HERO_COPY.body, /AI assistant for homeschool parents/i);
  assert.match(HERO_COPY.body, /plans the week/i);
  assert.match(HERO_COPY.body, /practice pages/i);
  assert.match(HERO_COPY.body, /teaching time and finished work/i);
});

test("the trial CTA states the card terms before the click", () => {
  // The signup paywall (founder directive 2026-07-26) requires the trial
  // length, the price, and the way out to be visible at the CTA, not
  // discovered at the card screen.
  assert.match(HERO_COPY.primaryActionNote, /7 free days/);
  assert.match(HERO_COPY.primaryActionNote, /credit card/i);
  assert.match(HERO_COPY.primaryActionNote, /\$19 a month/);
  assert.match(HERO_COPY.primaryActionNote, /before the first charge/i);
  assert.match(HERO_COPY.primaryActionNote, /cancel before then/i);
});

test("the platform strip states only verified access modes", () => {
  assert.deepEqual(
    PLATFORM_ITEMS.map(({ label }) => label),
    ["Text message", "Web chat", "Phone friendly"],
  );
});

test("the how-it-works bridge explains the parent's path without diagnosing her", () => {
  assert.deepEqual(
    WORKFLOW_ITEMS.map(({ id }) => id),
    ["family", "review", "change", "record"],
  );
  assert.doesNotMatch(JSON.stringify(WORKFLOW_ITEMS), /you need help/i);
  assert.match(LANDING_SECTION_COPY.how.headline, /week you actually have/i);
});

test("the capability section exposes four shipped product nouns in parent-day order", () => {
  assert.deepEqual(
    CAPABILITY_ITEMS.map(({ title }) => title),
    ["The weekly plan", "Practice pages", "The binder", "Hours and state rules"],
  );
});

test("each capability card points to its canonical feature page", () => {
  assert.deepEqual(
    CAPABILITY_ITEMS.map(({ id }) => CAPABILITY_FEATURE_HREFS[id]),
    [
      "/features/homeschool-planner",
      "/features/personalized-practice-pages",
      "/features/homeschool-record-keeping",
      "/features/homeschool-hours-tracker",
    ],
  );
});

test("the new landing copy does not publish deferred or unsupported claims", () => {
  const copy = JSON.stringify({
    HERO_COPY,
    LANDING_SECTION_COPY,
    PLATFORM_ITEMS,
    PRODUCT_PREVIEW_COPY,
    WORKFLOW_ITEMS,
    CAPABILITY_ITEMS,
    SAMPLE_REPORT_COPY,
    FOUNDER_STORY_COPY,
  });

  for (const forbidden of [
    /\u2014/,
    /\bbehind\b/i,
    /\bco-pilot\b/i,
    /your town, in the plan/i,
    /compare curriculums/i,
    /right fit the first time/i,
    /state academic standards/i,
    /app store/i,
    /parent community/i,
    // The free-report era ended with the signup paywall (founder
    // directive 2026-07-26): a card-upfront trial page that still says
    // "free report" or "no card" is lying, so both are banned outright.
    /free report/i,
    /free progress report/i,
    /no card/i,
    // The trial is "7 free days", never "free month" (wall-copy.ts
    // vocabulary law: "month" is reserved for the price unit and the
    // child's month plan).
    /free month/i,
  ]) {
    assert.doesNotMatch(copy, forbidden);
  }
});

test("the sample proof explains the mechanism before the result", () => {
  assert.equal(SAMPLE_REPORT_COPY.href, "/onboarding/sample");
  assert.match(SAMPLE_REPORT_COPY.body, /about five minutes answering questions/i);
  assert.match(SAMPLE_REPORT_COPY.body, /published national benchmarks/i);
  assert.match(SAMPLE_REPORT_COPY.body, /sources Homa used/i);
  assert.match(SAMPLE_REPORT_COPY.reassurance, /starts with strengths/i);
  assert.doesNotMatch(
    `${SAMPLE_REPORT_COPY.body} ${SAMPLE_REPORT_COPY.reassurance}`,
    /test|score|questionnaire|observation/i,
  );
});

test("the founder story uses the public co-founder signature", () => {
  assert.equal(FOUNDER_STORY_COPY.signature, "Alessa & Carolyng");
  assert.equal(FOUNDER_STORY_COPY.headline, "Homa started at our kitchen table.");
  assert.match(FOUNDER_STORY_COPY.body, /Homa grew from that need/i);
  assert.doesNotMatch(FOUNDER_STORY_COPY.body, /\bcurriculum\b/i);
  assert.doesNotMatch(FOUNDER_STORY_COPY.body, /\bsteady\b/i);
});

test("the live landing composition keeps the approved artifact-first opening", () => {
  for (const marker of [
    "qa-opening__world",
    "qa-authority",
    "qa-product",
    "/images/hero-family.png",
    "HERO_COPY.headline",
    "HERO_COPY.body",
    "LANDING_SECTION_COPY.authority",
    "<Logo",
  ]) {
    assert.match(QUIET_LANDING_SOURCE, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /The Homa feeling/u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /Quiet authority in full/u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /Homa should feel like/u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /Real curiosity\./u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /qa-object|HeroObject|QuietHeroHeadline/u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /4\.5h|1h 45m|30m|45m/u);
});

test("the primary action appears in the first visual viewport", () => {
  const openingStart = QUIET_LANDING_SOURCE.indexOf('<section className="qa-opening"');
  const authorityStart = QUIET_LANDING_SOURCE.indexOf('<div className="qa-authority">');
  const firstTrialAction = QUIET_LANDING_SOURCE.indexOf("<TrialAction />", openingStart);

  assert.ok(openingStart >= 0);
  assert.ok(firstTrialAction > openingStart);
  assert.ok(firstTrialAction < authorityStart);
});

test("the landing keeps functional actions on the approved midnight role", () => {
  assert.doesNotMatch(
    QUIET_LANDING_SOURCE,
    /quiet-action--primary\s*\{[^}]*var\(--homa-visual-coral\)/u,
  );
});

test("the product moment exposes a keyboard-safe, reduced-motion state demo", () => {
  assert.match(QUIET_LANDING_SOURCE, /aria-live="polite"/u);
  assert.match(QUIET_LANDING_SOURCE, /aria-pressed=\{state === nextState\}/u);
  assert.match(QUIET_LANDING_SOURCE, /prefers-reduced-motion: reduce/u);
  assert.match(QUIET_LANDING_SOURCE, /qa-product__control:focus-visible/u);
  assert.match(QUIET_LANDING_SOURCE, /@keyframes qa-thread-draw/u);
  assert.deepEqual(Object.keys(PRODUCT_PREVIEW_COPY.states), ["tell", "updating", "ready"]);
  assert.doesNotMatch(JSON.stringify(PRODUCT_PREVIEW_COPY.states), /\bIdle\b|\bListening\b|\bWorking\b/u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /\.qa-product__state\[data-state="tell"\]/u);
});

test("the product moment records only teaching time the parent supplied", () => {
  assert.match(PRODUCT_PREVIEW_COPY.states.tell.description, /\b\d+\s+minutes\b/iu);
  assert.match(PRODUCT_PREVIEW_COPY.states.updating.description, /records the science time/iu);
});
