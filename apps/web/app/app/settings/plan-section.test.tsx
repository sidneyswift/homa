import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TIER_NAMES, tierDelta } from "../../../components/billing/wall-copy";
import type { FamilyPlanState } from "../../../lib/billing/wall";
import { PlanSection } from "./plan-section";

function state(overrides: Partial<FamilyPlanState> = {}): FamilyPlanState {
  return {
    tier: "regular",
    billingProvider: null,
    plusCheckout: {
      monthlyUrl: "https://buy.stripe.test/plus-monthly?client_reference_id=fam",
      annualUrl: null,
    },
    hasBillingRelationship: false,
    ...overrides,
  };
}

describe("PlanSection", () => {
  it("anchors the plan offer to the Quiet authority frame", () => {
    const html = renderToStaticMarkup(<PlanSection plan={state()} />);
    assert.match(html, /quiet-frame/u);
    assert.match(html, /homa-soft-boundary/u);
  });

  it("does not offer an unavailable Plus plan from a stale checkout URL", () => {
    const html = renderToStaticMarkup(<PlanSection plan={state()} />);
    assert.doesNotMatch(html, /Add Homa Plus/u);
    assert.doesNotMatch(html, /buy\.stripe\.test\/plus-monthly/u);
  });

  it("does not offer Plus to a base family without a Stripe customer", () => {
    const html = renderToStaticMarkup(
      <PlanSection plan={state({ hasBillingRelationship: false })} />,
    );
    assert.doesNotMatch(html, /Add Homa Plus/u);
  });

  it("names her current plan", () => {
    const html = renderToStaticMarkup(<PlanSection plan={state()} />);
    assert.match(html, new RegExp(TIER_NAMES.regular, "u"));
  });

  it("never sells Plus to someone already on Plus or Max", () => {
    for (const tier of ["plus", "elite"] as const) {
      const html = renderToStaticMarkup(<PlanSection plan={state({ tier })} />);
      assert.ok(!/Add Homa Plus/u.test(html), `${tier} must not be offered Plus`);
      assert.match(html, new RegExp(TIER_NAMES[tier], "u"));
    }
  });

  it("offers nothing rather than a dead button when checkout is unconfigured", () => {
    const html = renderToStaticMarkup(
      <PlanSection plan={state({ plusCheckout: null })} />,
    );
    assert.ok(!/Add Homa Plus/u.test(html));
    // She still learns which plan she is on.
    assert.match(html, new RegExp(TIER_NAMES.regular, "u"));
  });

  it("keeps the sanctioned current-tier description", () => {
    const html = renderToStaticMarkup(<PlanSection plan={state()} />);
    assert.match(html, new RegExp(tierDelta("regular"), "u"));
  });
});

describe("subscription management", () => {
  it("routes App Store customers to Apple's subscription manager", () => {
    const page = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");
    assert.match(page, /plan\.billingProvider === "apple"/u);
    assert.match(page, /https:\/\/apps\.apple\.com\/account\/subscriptions/u);
    assert.match(page, /Manage App Store subscription/u);
  });
});
