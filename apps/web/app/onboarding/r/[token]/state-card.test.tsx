import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import type { StateRequirementsSummary } from "../../../../lib/map/state-requirements";

import { StateCard } from "./state-card";

const SUMMARY: StateRequirementsSummary = {
  stateCode: "VA",
  stateName: "Virginia",
  regulationLevel: "moderate",
  notificationRequired: true,
  assessmentRequired: true,
  compulsoryStartAge: 5,
  compulsoryEndAge: 18,
  defaultPathway: "Home Instruction Statute",
  sourcePageUrl:
    "https://www.doe.virginia.gov/families-students/for-parents/home-instruction",
  sourceLastVerified: "2026-07-01",
};

test("the permanent report sends a parent to the authenticated state-pack entry", () => {
  const html = renderToStaticMarkup(
    <StateCard
      summary={SUMMARY}
      childName="Maya"
      statePackHref="/app/binder?source=report"
    />
  );

  assert.match(html, /Homa can make one printable Virginia pack/u);
  assert.match(html, /Nothing is filed with the state/u);
  assert.match(html, /href="\/app\/binder\?source=report"/u);
  assert.match(html, />Open the Virginia pack page<\/a>/u);
});

test("read-only report mirrors do not offer a family action", () => {
  const html = renderToStaticMarkup(
    <StateCard summary={SUMMARY} childName="Maya" />
  );

  assert.doesNotMatch(html, /Open the Virginia pack page/u);
  assert.match(html, /When your invite opens/u);
});
