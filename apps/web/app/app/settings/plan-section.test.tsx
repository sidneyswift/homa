import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TIER_NAMES, tierDelta } from "../../../components/billing/wall-copy";
import type { FamilyPlanState } from "../../../lib/billing/wall";
import { PlanSection } from "./plan-section";

/**
 * The door the channel gate's denial line promises (gh#412).
 *
 * A parent on the base plan who texts is told "you can add it whenever
 * you like, in your settings". Before this section, settings held no
 * plan anything for her: the only billing control was a portal link
 * gated on having a Stripe customer, which 81 of 82 families did not.
 */

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

  it("gives a base-tier family the way to add Plus, which is the whole point", () => {
    const html = renderToStaticMarkup(<PlanSection plan={state()} />);
    assert.match(html, /Add Homa Plus/u);
    assert.match(html, /buy\.stripe\.test\/plus-monthly/u);
  });

  it("shows a base family with no Stripe customer the same offer", () => {
    // The exact population the channel gate denies. If this ever renders
    // empty, the denial line is lying again.
    const html = renderToStaticMarkup(
      <PlanSection plan={state({ hasBillingRelationship: false })} />,
    );
    assert.match(html, /Add Homa Plus/u);
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

  it("uses the sanctioned tier copy verbatim, never a second description", () => {
    const html = renderToStaticMarkup(<PlanSection plan={state()} />);
    // Escaping differs in HTML, so compare on a distinctive fragment.
    const plusPromise = tierDelta("plus").replace(/&/gu, "&amp;");
    assert.ok(
      html.includes(plusPromise) || html.includes(tierDelta("plus")),
      "the Plus promise must be tierDelta's exact words",
    );
  });
});

describe("the denial line and the door it names", () => {
  it("keeps pointing at settings only while settings can actually sell Plus", () => {
    const gate = readFileSync(
      path.join(
        path.resolve(import.meta.dirname, "..", "..", "..", "lib", "billing"),
        "channel-access.ts",
      ),
      "utf8",
    );
    const namesSettings = /in your settings/iu.test(gate);
    if (!namesSettings) return; // Copy moved the door; nothing to hold shut.

    const section = readFileSync(
      path.join(import.meta.dirname, "plan-section.tsx"),
      "utf8",
    );
    const page = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");
    assert.match(
      section,
      /plusCheckout/u,
      "the denial line sends her to settings, so settings must offer Plus",
    );
    assert.match(
      page,
      /<PlanSection/u,
      "the section must actually be rendered on the settings page",
    );
  });

  it("routes App Store customers to Apple's subscription manager", () => {
    const page = readFileSync(path.join(import.meta.dirname, "page.tsx"), "utf8");
    assert.match(page, /plan\.billingProvider === "apple"/u);
    assert.match(page, /https:\/\/apps\.apple\.com\/account\/subscriptions/u);
    assert.match(page, /Manage App Store subscription/u);
  });
});
