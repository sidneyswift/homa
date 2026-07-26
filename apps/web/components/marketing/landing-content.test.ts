import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPABILITY_ITEMS,
  FOUNDER_STORY_COPY,
  HERO_COPY,
  PAIN_ITEMS,
  PLATFORM_ITEMS,
  SAMPLE_REPORT_COPY,
} from "./landing-content";

test("the landing hero names Homa's category and primary action", () => {
  assert.equal(HERO_COPY.headline, "The homeschool assistant that does the prep.");
  assert.equal(HERO_COPY.primaryAction, "Get your free report");
  assert.equal(HERO_COPY.eyebrow, "Made for homeschool parents");
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
