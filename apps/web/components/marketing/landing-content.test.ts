import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CAPABILITY_ITEMS,
  CAPABILITY_FEATURE_HREFS,
  FOUNDER_STORY_COPY,
  HERO_COPY,
  LANDING_SECTION_COPY,
  MEMBERSHIP_ITEMS,
  MEMBERSHIP_NOTE,
  MONTHLY_MEMBERSHIP_PRICES,
  PLATFORM_ITEMS,
  PRODUCT_PREVIEW_COPY,
  SAMPLE_REPORT_COPY,
} from "./landing-content";

const QUIET_LANDING_SOURCE = readFileSync(new URL("./QuietLanding.tsx", import.meta.url), "utf8");
const LANDING_PAGE_SOURCE = readFileSync(new URL("../../app/page.tsx", import.meta.url), "utf8");

test("the landing hero names Homa's category and primary action", () => {
  assert.equal(HERO_COPY.headline, "Homeschool, handled.");
  assert.equal(HERO_COPY.primaryAction, "Start your 7 free days");
  assert.equal(HERO_COPY.eyebrow, "Your homeschool assistant");
  assert.match(HERO_COPY.body, /AI assistant for homeschool parents/i);
  assert.match(HERO_COPY.body, /plans the week/i);
  assert.match(HERO_COPY.body, /makes practice pages/i);
  assert.match(HERO_COPY.body, /keeps your records together/i);
  assert.match(HERO_COPY.body, /Your child never has to use Homa/i);
  assert.match(HERO_COPY.body, /You review every update/i);
});

test("the trial CTA states the card terms before the click", () => {
  // The signup paywall (founder directive 2026-07-26) requires the trial
  // length, the price, and the way out to be visible at the CTA, not
  // discovered at the card screen.
  assert.match(HERO_COPY.primaryActionNote, /7 free days/);
  assert.match(HERO_COPY.primaryActionNote, /credit card/i);
  assert.match(HERO_COPY.primaryActionNote, /from \$19 a month/i);
  assert.doesNotMatch(HERO_COPY.primaryActionNote, /\$199/);
  assert.match(HERO_COPY.primaryActionNote, /cancel before the first charge/i);
  assert.deepEqual(MONTHLY_MEMBERSHIP_PRICES, [19, 49]);
  assert.match(LANDING_SECTION_COPY.final.body, /from \$19 a month/i);
  assert.match(LANDING_SECTION_COPY.final.body, /credit card required/i);
  assert.match(LANDING_SECTION_COPY.final.body, /cancel before the first charge/i);
});

test("metadata and structured offers reuse the catalog-derived landing contract", () => {
  assert.match(LANDING_PAGE_SOURCE, /HERO_COPY\.primaryActionNote/u);
  assert.match(LANDING_PAGE_SOURCE, /MEMBERSHIP_ITEMS\.map/u);
  assert.doesNotMatch(LANDING_PAGE_SOURCE, /Monthly memberships cost \$19/u);
  assert.doesNotMatch(LANDING_PAGE_SOURCE, /price:\s*["']19["']/u);
});

test("the platform strip states only verified access modes", () => {
  assert.deepEqual(
    PLATFORM_ITEMS.map(({ label }) => label),
    ["Text message", "Web chat", "Phone friendly"],
  );
});

test("the capability section exposes four shipped product nouns in parent-day order", () => {
  assert.deepEqual(
    CAPABILITY_ITEMS.map(({ title }) => title),
    ["The weekly plan", "Practice pages", "The binder", "Teaching hours and state rules"],
  );
});

test("the landing states the current practice-page age boundary before signup", () => {
  const practice = CAPABILITY_ITEMS.find(({ id }) => id === "practice");

  assert.ok(practice);
  assert.match(practice.body, /ages 2 to 7/i);
  assert.doesNotMatch(HERO_COPY.body, /ages? \d/i);
});

test("the landing shows every purchasable membership before the final signup ask", () => {
  assert.deepEqual(
    MEMBERSHIP_ITEMS.map(({ name, monthlyPrice, annualPrice }) => ({ name, monthlyPrice, annualPrice })),
    [
      { name: "Homa", monthlyPrice: 19, annualPrice: 182 },
      { name: "Homa Plus", monthlyPrice: 49, annualPrice: 470 },
    ],
  );
  assert.match(LANDING_SECTION_COPY.memberships.headline, /whole family/i);
  assert.match(LANDING_SECTION_COPY.memberships.body, /no extra cost/i);
  assert.match(MEMBERSHIP_NOTE, /paid once a year/i);
  assert.match(MEMBERSHIP_NOTE, /stop renewal anytime/i);
});

test("the landing names built Plus services and keeps unbuilt Max out of checkout", () => {
  const plus = MEMBERSHIP_ITEMS.find(({ tier }) => tier === "plus");

  assert.ok(plus);
  assert.equal(MEMBERSHIP_ITEMS.some(({ tier }) => tier === "elite"), false);
  assert.match(plus.body, /phone number for texting or calling Homa/i);
  assert.match(plus.body, /curriculum file uploads/i);
  assert.match(plus.body, /weekly plan/i);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /COMING_SOON_MEMBERSHIP|Homa Max|Coming soon/u);
});

test("the fictional product example proves Homa can plan for an older child", () => {
  assert.match(PRODUCT_PREVIEW_COPY.eyebrow, /Leo, age 9/i);
  assert.match(PRODUCT_PREVIEW_COPY.states.tell.description, /Leo's unfinished fractions review/i);
  assert.equal(PRODUCT_PREVIEW_COPY.states.tell.title, "Parent's note");
  assert.equal(PRODUCT_PREVIEW_COPY.states.tell.control, "Read note");
  assert.equal(LANDING_SECTION_COPY.authority.secondaryAction, "See what Homa handles");
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
  assert.match(SAMPLE_REPORT_COPY.reassurance, /about five minutes per child/i);
  assert.match(SAMPLE_REPORT_COPY.body, /one practical activity for each subject/i);
  assert.match(SAMPLE_REPORT_COPY.body, /never turns your child into a number or a verdict/i);
  assert.match(SAMPLE_REPORT_COPY.body, /You decide what fits/i);
  assert.doesNotMatch(
    `${SAMPLE_REPORT_COPY.body} ${SAMPLE_REPORT_COPY.reassurance}`,
    /score|questionnaire|diagnosis/i,
  );
});

test("the founder story uses the public co-founder signature", () => {
  assert.equal(FOUNDER_STORY_COPY.signature, "Alessa & Carolyng");
  assert.equal(FOUNDER_STORY_COPY.headline, "Homa started at our kitchen table.");
  assert.match(FOUNDER_STORY_COPY.body, /Homa prepares the week/i);
  assert.match(FOUNDER_STORY_COPY.body, /You stay in charge/i);
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
    "MEMBERSHIP_ITEMS",
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
  assert.match(QUIET_LANDING_SOURCE, /Leo · This week/u);
  assert.match(QUIET_LANDING_SOURCE, /Teaching hours[\s\S]*recorded by child/u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /Leo · Tuesday|Teaching time[\s\S]*saved by child/u);
});

test("the phone reading order explains the product before asking for a price decision", () => {
  const howAnchor = QUIET_LANDING_SOURCE.indexOf('<div id="how" className="qa-authority">');
  const reportSection = QUIET_LANDING_SOURCE.indexOf('<section id="sample-report"');
  const membershipsSection = QUIET_LANDING_SOURCE.indexOf('<section id="memberships"');
  const featuresSection = QUIET_LANDING_SOURCE.indexOf('<section id="features"');
  const faqSection = QUIET_LANDING_SOURCE.indexOf('<section id="faq"');
  const storySection = QUIET_LANDING_SOURCE.indexOf('<section id="stories"');

  assert.ok(howAnchor >= 0);
  assert.ok(featuresSection > howAnchor);
  assert.ok(reportSection > featuresSection);
  assert.ok(membershipsSection > reportSection);
  assert.ok(faqSection > membershipsSection);
  assert.ok(storySection > faqSection);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /<section id="how"/u);
  assert.doesNotMatch(QUIET_LANDING_SOURCE, /qa-pain-grid|WORKFLOW_ITEMS/u);
  assert.match(QUIET_LANDING_SOURCE, /href="#features"/u);
});

test("the public landing copy keeps each decision-sized block concise", () => {
  const wordCount = (value: string) => value.trim().split(/\s+/u).filter(Boolean).length;

  assert.ok(wordCount(HERO_COPY.body) <= 34);
  assert.ok(wordCount(HERO_COPY.primaryActionNote) <= 22);
  assert.ok(wordCount(LANDING_SECTION_COPY.authority.body) <= 18);
  assert.ok(wordCount(LANDING_SECTION_COPY.features.body) <= 12);
  assert.ok(wordCount(LANDING_SECTION_COPY.memberships.body) <= 16);
  assert.ok(wordCount(LANDING_SECTION_COPY.final.body) <= 22);

  for (const capability of CAPABILITY_ITEMS) {
    assert.ok(wordCount(capability.body) <= 28, `${capability.id} copy is too dense`);
  }

  assert.ok(wordCount(SAMPLE_REPORT_COPY.reassurance) <= 14);
  assert.ok(wordCount(SAMPLE_REPORT_COPY.body) <= 38);
  assert.ok(wordCount(FOUNDER_STORY_COPY.body) <= 34);
});

test("the primary action appears in the first visual viewport", () => {
  const openingStart = QUIET_LANDING_SOURCE.indexOf('<section className="qa-opening"');
  const authorityStart = QUIET_LANDING_SOURCE.indexOf('<div id="how" className="qa-authority">');
  const firstTrialAction = QUIET_LANDING_SOURCE.indexOf("<TrialAction />", openingStart);

  assert.ok(openingStart >= 0);
  assert.ok(firstTrialAction > openingStart);
  assert.ok(firstTrialAction < authorityStart);
});

test("the decorative Homa mark yields to hero proof on narrow phones", () => {
  assert.match(
    QUIET_LANDING_SOURCE,
    /@media \(max-width: 480px\)[\s\S]*?\.qa-opening__character \{ display: none; \}/u,
  );
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
  assert.match(PRODUCT_PREVIEW_COPY.dayBody, /35 minutes of science are recorded/iu);
  assert.match(PRODUCT_PREVIEW_COPY.states.tell.description, /unfinished fractions review/iu);
  assert.match(PRODUCT_PREVIEW_COPY.dayBody, /fractions review moved to Thursday/iu);
  assert.doesNotMatch(
    PRODUCT_PREVIEW_COPY.states.updating.description,
    /35 minutes|fractions review|counting page/iu,
  );
});
