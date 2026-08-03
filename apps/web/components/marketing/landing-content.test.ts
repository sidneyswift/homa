import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CAPABILITY_ITEMS,
  CAPABILITY_FEATURE_HREFS,
  FOUNDER_STORY_COPY,
  HERO_COPY,
  PAIN_ITEMS,
  PLATFORM_ITEMS,
  SAMPLE_REPORT_COPY,
} from "./landing-content";

const QUIET_LANDING_SOURCE = readFileSync(new URL("./QuietLanding.tsx", import.meta.url), "utf8");

test("the landing hero names Homa's category and primary action", () => {
  assert.equal(HERO_COPY.headline, "The homeschool assistant that does the prep.");
  assert.equal(HERO_COPY.primaryAction, "Start your free trial");
  assert.equal(HERO_COPY.eyebrow, "Made for homeschool parents");
});

test("the trial CTA states the card terms before the click", () => {
  // The signup paywall (founder directive 2026-07-26) requires the trial
  // length, the price, and the way out to be visible at the CTA, not
  // discovered at the card screen.
  assert.match(HERO_COPY.primaryActionNote, /7 free days/);
  assert.match(HERO_COPY.primaryActionNote, /\$19 a month/);
  assert.match(HERO_COPY.primaryActionNote, /cancel anytime/i);
});

test("the platform strip states only verified access modes", () => {
  assert.deepEqual(
    PLATFORM_ITEMS.map(({ label }) => label),
    ["Text message", "Web chat", "Phone friendly"],
  );
});

test("the pain bridge stays concise and does not diagnose the parent", () => {
  assert.deepEqual(
    PAIN_ITEMS.map(({ id }) => id),
    ["planning", "proof", "scattered", "paperwork"],
  );
  assert.doesNotMatch(JSON.stringify(PAIN_ITEMS), /you need help/i);
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
    PLATFORM_ITEMS,
    PAIN_ITEMS,
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
  assert.match(SAMPLE_REPORT_COPY.body, /five-minute questionnaire per child/i);
  assert.match(SAMPLE_REPORT_COPY.body, /national standards and education research/i);
  assert.match(SAMPLE_REPORT_COPY.reassurance, /starts with strengths/i);
});

test("the founder story uses the public co-founder signature", () => {
  assert.equal(FOUNDER_STORY_COPY.signature, "Alessa & Carolyng");
  assert.match(FOUNDER_STORY_COPY.body, /teaching mattered most/i);
  assert.doesNotMatch(FOUNDER_STORY_COPY.body, /\bcurriculum\b/i);
  assert.doesNotMatch(FOUNDER_STORY_COPY.body, /\bsteady\b/i);
});

test("the live landing composition keeps the approved artifact-first opening", () => {
  for (const marker of [
    "qa-opening__world",
    "qa-authority",
    "qa-product",
    "/images/hero-family.png",
    "Real curiosity.",
    "One useful next move",
    "Quiet authority in full",
    "<Logo",
  ]) {
    assert.match(QUIET_LANDING_SOURCE, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /qa-object|HeroObject|QuietHeroHeadline/u);
});

test("the product moment exposes a keyboard-safe, reduced-motion state demo", () => {
  assert.match(QUIET_LANDING_SOURCE, /aria-live="polite"/u);
  assert.match(QUIET_LANDING_SOURCE, /aria-pressed=\{state === nextState\}/u);
  assert.match(QUIET_LANDING_SOURCE, /prefers-reduced-motion: reduce/u);
  assert.match(QUIET_LANDING_SOURCE, /qa-product__control:focus-visible/u);
  assert.match(QUIET_LANDING_SOURCE, /@keyframes qa-thread-draw/u);
});
