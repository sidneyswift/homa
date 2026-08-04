import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { TrialGate } from "./trial-gate";

const checkout = {
  regular: {
    monthlyUrl: "https://checkout.stripe.test/monthly",
    annualUrl: null,
  },
  plus: null,
  elite: null,
};

describe("TrialGate", () => {
  it("replaces checkout controls with one account-recovery action after a duplicate trial is stopped", () => {
    const html = renderToStaticMarkup(
      <TrialGate
        checkout={checkout}
        lapsed={false}
        portalAvailable={false}
        duplicateTrialPrevented
      />,
    );

    assert.match(html, /We stopped a second Homa trial\./u);
    assert.match(html, /it will not be charged again\./u);
    assert.match(html, /href="\/signin\?next=\/app"/u);
    assert.doesNotMatch(html, /checkout\.stripe\.test/u);
  });
});
