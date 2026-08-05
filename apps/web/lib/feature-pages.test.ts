import assert from "node:assert/strict";
import test from "node:test";

import { FEATURE_PAGES, FEATURE_PAGE_SLUGS, getFeaturePage } from "./feature-pages";

test("the SEO feature map owns five distinct parent jobs", () => {
  assert.deepEqual(FEATURE_PAGE_SLUGS, [
    "homeschool-planner",
    "homeschool-hours-tracker",
    "homeschool-progress-tracker",
    "homeschool-record-keeping",
    "personalized-practice-pages",
  ]);
  assert.equal(new Set(FEATURE_PAGES.map((page) => page.path)).size, 5);
});

test("feature metadata stays within the blog and search contracts", () => {
  for (const page of FEATURE_PAGES) {
    assert.ok(page.metadataTitle.length > 0);
    assert.ok(page.metadataDescription.length <= 160, page.slug);
    assert.match(page.path, new RegExp(`^/features/${page.slug}$`));
    assert.ok(page.steps.length >= 3, page.slug);
    assert.ok(page.proof.length >= 3, page.slug);
  }
});

test("feature related links resolve to another feature page", () => {
  for (const page of FEATURE_PAGES) {
    for (const relatedSlug of page.related) {
      assert.ok(getFeaturePage(relatedSlug), `${page.slug} -> ${relatedSlug}`);
    }
  }
});

test("feature copy keeps the parent-facing language boundaries", () => {
  const copy = JSON.stringify(FEATURE_PAGES);

  for (const forbidden of [
    /\u2014/,
    /\bbehind\b/i,
    /\bverdict\b/i,
    /\bpercentile/i,
    /\bguarantee/i,
  ]) {
    assert.doesNotMatch(copy, forbidden);
  }
});

test("the record-keeping page describes the binder that ships today", () => {
  const page = getFeaturePage("homeschool-record-keeping");

  assert.ok(page);
  const copy = JSON.stringify(page);
  assert.match(copy, /finalized materials/i);
  assert.match(copy, /binder/i);
  assert.match(copy, /open or print/i);
  assert.doesNotMatch(copy, /photos?|reports?|finished work|lab notes/i);
});
