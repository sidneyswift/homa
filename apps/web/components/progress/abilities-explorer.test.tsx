import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { buildAbilitiesExplorerPayload } from "../../lib/child-progress/abilities-explorer";
import type { AbilitiesExplorerNode, AbilitiesExplorerPayload } from "../../lib/child-progress/abilities-explorer-types";
import { AbilitiesExplorer } from "./abilities-explorer";
import { PROGRESS_FIXTURE_VIEW } from "./progress-view.fixture";

const ROUTER = {
  back() {},
  forward() {},
  refresh() {},
  hmrRefresh() {},
  push() {},
  replace() {},
  prefetch: async () => {},
};

function render(): string {
  const payload = buildAbilitiesExplorerPayload(
    PROGRESS_FIXTURE_VIEW,
    new Date("2026-08-03T12:00:00.000Z"),
  );
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={ROUTER}>
      <AbilitiesExplorer payload={payload} />
    </AppRouterContext.Provider>,
  );
}

describe("AbilitiesExplorer", () => {
  it("renders the plain status key, age axis, and dense graph", () => {
    const html = render();

    assert.match(html, /Every dot is one ability/);
    assert.match(html, /CURRICULUM AGE WINDOW/);
    assert.match(html, /age 4/);
    assert.match(html, /age 14/);
    assert.match(html, /Maya(?:&#x27;|')s progress/);
    assert.doesNotMatch(html, /var\(--midnight\)|var\(--support\)/);
    assert.ok(html.includes("w-full rounded-[var(--homa-radius-control)]"));
    for (const label of ["Easily", "Getting there", "Not observed", "Not yet", "Different observations"]) {
      assert.match(html, new RegExp(label));
    }
    assert.ok(
      (html.match(/<circle/gu) ?? []).length > 100,
      "the first render should keep the full subject graph visible",
    );
  });

  it("keeps the explanation handoff without an unverified practice suggestion", () => {
    const html = render();

    assert.doesNotMatch(html, /You noticed|Taking shape|Homa connection/);
    assert.doesNotMatch(html, /Preview a next idea/);
    assert.doesNotMatch(html, /Show a practice idea|Hide practice idea|Try a five-minute activity/);
    assert.match(html, /Ask Homa about this ability/);
    assert.ok(!html.includes("—"), "the surface must not contain an em dash");
  });
});


function singleNode(overrides: Partial<AbilitiesExplorerNode> = {}, ageMonths = 96): string {
  const payload: AbilitiesExplorerPayload = {
    childId: "11111111-1111-4111-8111-111111111111", childName: "Maya <script>", timeZone: "America/New_York", ageMonths,
    axisMonths: [48,168], ageRangeMonths: [96,108], subjects: [{id: "math", displayName: "Math", edges: [], nodes: [{
      id: "math.counting", name: "Counting & grouping", description: "Count a collection.", subjectId: "math", domainId: "numbers", domainName: "Numbers",
      x: 0.5, y: 0.5, teachingWindowMonths: [60,72], state: "unobserved",
      evidence: {answer: null, derivation: null, observedAt: null, source: null, conflict: false, conflictingAnswers: []}, ...overrides,
    }]}],
  };
  return renderToStaticMarkup(<AppRouterContext.Provider value={ROUTER}><AbilitiesExplorer payload={payload}/></AppRouterContext.Provider>);
}

it("distinguishes no observation from an explicit Not yet answer in the selected detail", () => {
  const unknown = singleNode();
  const notYet = singleNode({state: "not_yet", evidence: {answer: "not_yet", derivation: "direct", source: "Check-in", observedAt: "2024-01-01T12:00:00Z", conflict: false, conflictingAnswers: []}});
  assert.match(unknown, /No observation is saved/);
  assert.doesNotMatch(unknown, /The saved answer is Not yet/);
  assert.match(notYet, /The saved answer is Not yet/);
  assert.match(notYet, /Shared directly/);
  assert.match(notYet, /Saved Jan 1, 2024/);
});

it("names inferred and unknown provenance without claiming a direct parent answer", () => {
  for (const derivation of ["inferred", "unknown"] as const) {
    const html = singleNode({state: "knows", evidence: {answer: "easily", derivation, source: "Journal", observedAt: "2024-01-01T12:00:00Z", conflict: false, conflictingAnswers: []}});
    assert.match(html, derivation === "inferred" ? /Homa matched this from what was shared/ : /How this was matched was not saved/);
    assert.doesNotMatch(html, /parent answer|Shared directly/);
  }
});

it("shows each conflicting observation's answer and provenance", () => {
  const html = singleNode({state: "conflict", evidence: {answer: null, derivation: null, source: null, observedAt: "2026-08-03T12:00:00Z", conflict: true,
    conflictingAnswers: [{answer: "easily", derivation: "direct", observedAt: "2026-08-01T12:00:00Z"}, {answer: "not_yet", derivation: "inferred", observedAt: "2026-08-03T12:00:00Z"}]}});
  assert.match(html, /Saved observations differ/);
  assert.match(html, /Shared directly/); assert.match(html, /Homa matched this/);
  assert.match(html, /Aug 1, 2026/); assert.match(html, /Aug 3, 2026/);
});

it("explains curriculum links, avoids inventing a starting point, and carries the visible question", () => {
  const html = singleNode();
  assert.match(html, /No connections are listed/);
  assert.match(html, /does not show what .* has mastered or unlock a personal lesson sequence/);
  assert.doesNotMatch(html, /This ability is a starting point/);
  assert.match(html, /Help me understand Maya &lt;script&gt;.*Counting &amp; grouping/);
  assert.match(html, /You can edit it before sending/);
  assert.match(html, /finishing a worksheet alone does not change an ability/);
  assert.doesNotMatch(html, /<script>/);
});

it("does not paint a clamped band as an out-of-axis child's actual age", () => {
  for (const months of [36, 168, 204]) {
    const html = singleNode({}, months);
    assert.match(html, /outside this age 4 to age 14 chart/);
    assert.match(html, /no age band is shown/);
    assert.doesNotMatch(html, /chronological age<\/text>/);
  }
  assert.match(singleNode({}, 48), /chronological age<\/text>/);
});

it("renders saved and conflicting evidence on the family calendar across UTC midnight", () => {
  const observedAt = "2026-09-06T01:00:00Z";
  const single = singleNode({state: "knows", evidence: {answer: "easily", derivation: "direct", source: "Check-in", observedAt, conflict: false, conflictingAnswers: []}});
  assert.match(single, /Saved Sep 5, 2026/);
  assert.doesNotMatch(single, /Sep 6, 2026/);
  const conflicting = singleNode({state: "conflict", evidence: {answer: null, derivation: null, source: null, observedAt, conflict: true,
    conflictingAnswers: [{answer: "easily", derivation: "direct", observedAt}, {answer: "not_yet", derivation: "inferred", observedAt: "2026-09-05T01:00:00Z"}]}});
  assert.match(conflicting, /Sep 4, 2026/);
  assert.match(conflicting, /Sep 5, 2026/);
  assert.doesNotMatch(conflicting, /Sep 6, 2026/);
});
