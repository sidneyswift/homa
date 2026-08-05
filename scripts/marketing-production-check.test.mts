import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildManifest, buildReport, validateManifest, type MarketingProductionManifest } from "./marketing-production-check.mts";

const manifest = buildManifest();

test("marketing production evidence is current and has every production role", () => {
  const report = buildReport(manifest);
  assert.equal(report.status, "pass");
  assert.equal(report.findings.length, 0);
  assert.equal(report.rowCount, manifest.rows.length);
  for (const role of ["voice", "asset", "campaign", "social-template", "draft-bundle", "published-bundle", "queue", "evaluator"]) {
    assert.ok((report.roleCounts[role] ?? 0) > 0, `missing marketing role: ${role}`);
  }
  const comparePaths = (left: { path: string }, right: { path: string }) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
  assert.equal(manifest.rows.map((row) => row.path).join("\n"), [...manifest.rows].sort(comparePaths).map((row) => row.path).join("\n"));
});

test("bundle records preserve grounding, format approvals, and refusal evidence", () => {
  for (const bundle of manifest.bundles) {
    assert.equal(bundle.sourceResolves, true, bundle.path);
    assert.equal(bundle.sourceRefResolves, true, bundle.path);
    assert.equal(bundle.scorecard.passed, true, bundle.path);
    for (const format of bundle.formats) assert.equal(format.exists, true, `${bundle.path}/${format.file}`);
  }
  for (const row of manifest.rows.filter((candidate) => candidate.path.startsWith("marketing/content/drafts/2026-07-05-"))) {
    assert.equal(row.state, "historical-quarantined", row.path);
  }
  const hoursLaunch = manifest.bundles.find(
    (bundle) => bundle.id === "2026-08-03-how-to-track-homeschool-hours-without-losing-the-week",
  );
  assert.ok(hoursLaunch);
  assert.equal(hoursLaunch.distribution.exists, true);
  assert.equal(hoursLaunch.distribution.publishedFormats, 1);
  assert.equal(hoursLaunch.distribution.refusedFormats, 1);
  assert.deepEqual(hoursLaunch.distribution.urls, ["https://thankshoma.com/blog/how-to-track-homeschool-hours-without-losing-the-week"]);
});

test("the founder-approved SEO wave is published as one closed article library", () => {
  const expectedIds = [
    "2026-08-03-homeschool-hours-tracker-app-or-spreadsheet",
    "2026-08-03-homeschool-portfolio-checklist",
    "2026-08-03-homeschool-progress-report-examples",
    "2026-08-03-homeschool-schedule-for-multiple-children",
    "2026-08-03-how-to-know-if-homeschooling-is-working",
    "2026-08-03-how-to-make-a-homeschool-practice-page",
    "2026-08-03-how-to-organize-homeschool-records",
    "2026-08-03-weekly-homeschool-planner-template",
    "2026-08-04-homeschool-reading-log-that-stays-useful",
    "2026-08-04-how-many-problems-should-a-practice-page-have",
    "2026-08-04-how-to-adapt-a-worksheet-without-changing-the-lesson",
    "2026-08-04-how-to-check-a-generated-worksheet-before-printing",
    "2026-08-04-how-to-choose-homeschool-work-samples",
    "2026-08-04-how-to-document-homeschool-math-progress",
    "2026-08-04-how-to-make-a-flexible-homeschool-schedule",
    "2026-08-04-how-to-track-homeschool-reading-progress",
    "2026-08-04-how-to-write-a-homeschool-narrative-progress-report",
    "2026-08-04-simple-homeschool-daily-checklist",
    "2026-08-04-what-to-write-in-a-homeschool-daily-log",
    "2026-08-04-when-homeschool-lessons-run-long",
  ];
  const wave = manifest.bundles.filter((bundle) => expectedIds.includes(bundle.id));
  assert.deepEqual(wave.map((bundle) => bundle.id).sort(), expectedIds);
  for (const bundle of wave) {
    const slug = bundle.id.replace(/^2026-08-\d{2}-/, "");
    assert.equal(bundle.lifecycle, "published", bundle.path);
    assert.deepEqual(bundle.approval, { approved: 1, draft: 0, killed: 0, blockedByProvider: 0 }, bundle.path);
    assert.equal(bundle.distribution.exists, true, bundle.path);
    assert.equal(bundle.distribution.publishedFormats, 1, bundle.path);
    assert.equal(bundle.distribution.refusedFormats, 0, bundle.path);
    assert.deepEqual(bundle.distribution.urls, [`https://thankshoma.com/blog/${slug}`], bundle.path);
  }
});

test("external publishers are explicit fail-closed records, never simulated receipts", () => {
  const postiz = manifest.integrations.find((integration) => integration.id === "postiz-social");
  const resend = manifest.integrations.find((integration) => integration.id === "resend-email");
  assert.equal(postiz?.state, "blocked-founder-action");
  assert.equal(postiz?.externalStateClaim, false);
  assert.equal(resend?.state, "blocked-founder-decision");
  assert.equal(resend?.externalStateClaim, false);
  for (const integration of manifest.integrations) assert.equal(integration.externalStateClaim, false, integration.id);
});

test("the retired social starter pack remains visible but quarantined and fail-closed", () => {
  const generator = manifest.generators.find((entry) => entry.path === "scripts/socials-starter-pack-assets.mts");
  assert.ok(generator);
  assert.equal(generator.state, "retired-quarantined");
  assert.equal(generator.failClosed, true);
  assert.ok(manifest.rows.some((row) => row.path.startsWith("marketing/assets/socials-starter-pack/") && row.state === "retired-quarantined"));
});

test("hash drift and external-state claims fail closed", () => {
  const drifted = JSON.parse(JSON.stringify(manifest)) as MarketingProductionManifest;
  drifted.rows[0]!.sourceHash = "0".repeat(64);
  drifted.integrations[0]!.externalStateClaim = true;
  const codes = validateManifest(drifted).map((finding) => finding.code);
  assert.ok(codes.includes("row-stale"));
  assert.ok(codes.includes("external-state-claim"));
});

test("committed evidence is generated from the current source", () => {
  const committed = JSON.parse(readFileSync("docs/homa-design/evidence/marketing-production.json", "utf8")) as MarketingProductionManifest;
  assert.deepEqual(committed, manifest);
});
