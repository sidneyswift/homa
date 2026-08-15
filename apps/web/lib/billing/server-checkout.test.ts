import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mintCheckoutIntent } from "./checkout-intent";
import {
  assertConfiguredPaymentLinksInactive,
  createServerCheckoutSession,
  type CheckoutSessionCreateParams,
  type CheckoutSessionRequestOptions,
  type PaymentLinkListParams,
  type ServerCheckoutGateway,
  type ServerPaymentLink,
} from "./server-checkout";

const FAMILY_ID = "00000000-0000-4000-8000-000000000421";
const SECRET = "server-checkout-test-secret-at-least-32-bytes";
const NOW_MS = Date.UTC(2026, 7, 8, 19, 0, 0);
const PAYMENT_LINK_URL = "https://buy.stripe.com/test_homa_plus_monthly";

function recurringLink(
  overrides: Partial<ServerPaymentLink> = {},
): ServerPaymentLink {
  return {
    id: "plink_target",
    active: false,
    url: PAYMENT_LINK_URL,
    line_items: {
      data: [
        {
          quantity: 1,
          price: {
            id: "price_plus_monthly",
            type: "recurring",
            recurring: { interval: "month" },
          },
        },
      ],
    },
    ...overrides,
  };
}

function createFixture(input?: {
  pages?: ServerPaymentLink[][];
  active?: boolean;
}) {
  const pages = input?.pages ?? [[recurringLink()]];
  const listCalls: PaymentLinkListParams[] = [];
  const createCalls: CheckoutSessionCreateParams[] = [];
  const createRequestOptions: CheckoutSessionRequestOptions[] = [];
  const activeChecks: string[] = [];
  const events: string[] = [];

  const gateway: ServerCheckoutGateway = {
    paymentLinks: {
      async list(params) {
        events.push("payment-link-list");
        listCalls.push(params);
        const pageIndex = params.starting_after
          ? pages.findIndex((page) => page.at(-1)?.id === params.starting_after) + 1
          : 0;
        const data = pages[pageIndex] ?? [];
        return { data, has_more: pageIndex < pages.length - 1 };
      },
    },
    checkout: {
      sessions: {
        async create(params, requestOptions) {
          events.push("session-create");
          createCalls.push(params);
          createRequestOptions.push(requestOptions);
          return { id: "cs_created", url: "https://checkout.stripe.com/c/pay/test" };
        },
      },
    },
  };

  return {
    gateway,
    listCalls,
    createCalls,
    createRequestOptions,
    activeChecks,
    events,
    async isFamilyActive(familyId: string) {
      events.push("family-active-check");
      activeChecks.push(familyId);
      return input?.active ?? true;
    },
  };
}

function intent(): string {
  return mintCheckoutIntent(
    { familyId: FAMILY_ID, tier: "plus", billingPeriod: "monthly" },
    { secret: SECRET, nowMs: NOW_MS },
  );
}

function checkoutInput(fixture: ReturnType<typeof createFixture>) {
  return {
    gateway: fixture.gateway,
    intent: intent(),
    intentSecret: SECRET,
    familyId: FAMILY_ID,
    tier: "plus" as const,
    billingPeriod: "monthly" as const,
    paymentLinkUrls: { plus: { monthly: PAYMENT_LINK_URL } },
    customerEmail: "parent@example.com",
    trustedOrigin: "https://thankshoma.com",
    trialPeriodDays: 7,
    isFamilyActive: fixture.isFamilyActive,
    nowMs: NOW_MS + 1_000,
  };
}

describe("server checkout", () => {
  it("fails closed for a missing or deleted family", async () => {
    const fixture = createFixture({ active: false });

    await assert.rejects(
      createServerCheckoutSession(checkoutInput(fixture)),
      /family is not active/u,
    );
    assert.deepEqual(fixture.activeChecks, [FAMILY_ID]);
    assert.equal(fixture.createCalls.length, 0);
  });

  it("rejects foreign, unmatched, and ambiguous configured links", async (context) => {
    await context.test("foreign URL", async () => {
      const fixture = createFixture();
      await assert.rejects(
        createServerCheckoutSession({
          ...checkoutInput(fixture),
          paymentLinkUrls: {
            plus: { monthly: "https://checkout.attacker.example/homa" },
          },
        }),
        /trusted Stripe Payment Link URL/u,
      );
      assert.equal(fixture.listCalls.length, 0);
    });

    await context.test("unmatched URL", async () => {
      const fixture = createFixture({ pages: [[recurringLink({ url: "https://buy.stripe.com/other" })]] });
      await assert.rejects(
        createServerCheckoutSession(checkoutInput(fixture)),
        /does not match/u,
      );
      assert.equal(fixture.createCalls.length, 0);
    });

    await context.test("ambiguous URL", async () => {
      const fixture = createFixture({
        pages: [[recurringLink()], [recurringLink({ id: "plink_duplicate" })]],
      });
      await assert.rejects(
        createServerCheckoutSession(checkoutInput(fixture)),
        /more than one/u,
      );
      assert.equal(fixture.createCalls.length, 0);
    });
  });

  it("paginates explicitly until it resolves the exact configured link", async () => {
    const firstLink = recurringLink({
      id: "plink_first",
      url: "https://buy.stripe.com/not_the_target",
    });
    const fixture = createFixture({ pages: [[firstLink], [recurringLink()]] });

    await createServerCheckoutSession(checkoutInput(fixture));

    assert.deepEqual(fixture.listCalls, [
      { limit: 100, expand: ["data.line_items"] },
      { limit: 100, expand: ["data.line_items"], starting_after: "plink_first" },
    ]);
  });

  it("requires every configured legacy Payment Link to be inactive", async () => {
    const inactiveFixture = createFixture();
    const resolved = await assertConfiguredPaymentLinksInactive(
      inactiveFixture.gateway,
      { plus: { monthly: PAYMENT_LINK_URL } },
    );
    assert.equal(resolved.get(PAYMENT_LINK_URL)?.id, "plink_target");

    const activeFixture = createFixture({
      pages: [[recurringLink({ active: true })]],
    });
    await assert.rejects(
      createServerCheckoutSession(checkoutInput(activeFixture)),
      /zero active Payment Links/u,
    );
    assert.equal(activeFixture.createCalls.length, 0);

    const forgottenActiveFixture = createFixture({
      pages: [
        [recurringLink()],
        [recurringLink({
          id: "plink_forgotten_active",
          active: true,
          url: "https://buy.stripe.com/forgotten_active",
        })],
      ],
    });
    await assert.rejects(
      assertConfiguredPaymentLinksInactive(
        forgottenActiveFixture.gateway,
        { plus: { monthly: PAYMENT_LINK_URL } },
      ),
      /zero active Payment Links/u,
    );

    const deletionFixture = createFixture({
      pages: [
        [recurringLink()],
        [recurringLink({
          id: "plink_unrelated_active",
          active: true,
          url: "https://buy.stripe.com/unrelated_active",
        })],
      ],
    });
    const deletionResolved = await assertConfiguredPaymentLinksInactive(
      deletionFixture.gateway,
      { plus: { monthly: PAYMENT_LINK_URL } },
      { requireAccountWideInactivity: false },
    );
    assert.equal(deletionResolved.get(PAYMENT_LINK_URL)?.id, "plink_target");
  });

  it("rejects a link without exactly one fixed recurring price", async (context) => {
    await context.test("one-time price", async () => {
      const fixture = createFixture({
        pages: [[
          recurringLink({
            line_items: {
              data: [{
                quantity: 1,
                price: { id: "price_once", type: "one_time", recurring: null },
              }],
            },
          }),
        ]],
      });
      await assert.rejects(createServerCheckoutSession(checkoutInput(fixture)), /recurring price/u);
    });

    await context.test("multiple prices", async () => {
      const line = recurringLink().line_items?.data[0];
      assert.ok(line);
      const fixture = createFixture({
        pages: [[recurringLink({ line_items: { data: [line, line] } })]],
      });
      await assert.rejects(createServerCheckoutSession(checkoutInput(fixture)), /exactly one/u);
    });

    await context.test("missing quantity", async () => {
      const fixture = createFixture({
        pages: [[recurringLink({
          line_items: {
            data: [{
              quantity: null,
              price: {
                id: "price_plus_monthly",
                type: "recurring",
                recurring: { interval: "month" },
              },
            }],
          },
        })]],
      });
      await assert.rejects(createServerCheckoutSession(checkoutInput(fixture)), /quantity/u);
    });

    await context.test("quantity above one", async () => {
      const fixture = createFixture({
        pages: [[recurringLink({
          line_items: {
            data: [{
              quantity: 2,
              price: {
                id: "price_plus_monthly",
                type: "recurring",
                recurring: { interval: "month" },
              },
            }],
          },
        })]],
      });
      await assert.rejects(createServerCheckoutSession(checkoutInput(fixture)), /quantity.*one/u);
    });
  });

  it("creates the exact family-scoped subscription session after the final family check", async () => {
    const fixture = createFixture();

    const session = await createServerCheckoutSession(checkoutInput(fixture));

    assert.deepEqual(session, {
      id: "cs_created",
      url: "https://checkout.stripe.com/c/pay/test",
    });
    assert.deepEqual(fixture.activeChecks, [FAMILY_ID]);
    assert.deepEqual(fixture.createCalls, [
      {
        mode: "subscription",
        payment_method_collection: "always",
        client_reference_id: FAMILY_ID,
        metadata: { family_id: FAMILY_ID },
        customer_email: "parent@example.com",
        subscription_data: {
          trial_period_days: 7,
          metadata: { family_id: FAMILY_ID },
        },
        success_url:
          "https://thankshoma.com/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}",
        cancel_url: "https://thankshoma.com/app",
        line_items: [{ price: "price_plus_monthly", quantity: 1 }],
      },
    ]);
    assert.match(
      fixture.createRequestOptions[0]?.idempotencyKey ?? "",
      /^homa-checkout:[a-f0-9]{64}$/u,
    );
    assert.deepEqual(fixture.events, [
      "payment-link-list",
      "family-active-check",
      "session-create",
    ]);
  });

  it("omits customer_email when the family has none", async () => {
    const fixture = createFixture();

    await createServerCheckoutSession({
      ...checkoutInput(fixture),
      customerEmail: null,
    });

    assert.equal("customer_email" in (fixture.createCalls[0] ?? {}), false);
  });

  it("rejects a nonpositive or fractional trial before touching Stripe", async () => {
    for (const trialPeriodDays of [0, -1, 7.5]) {
      const fixture = createFixture();
      await assert.rejects(
        createServerCheckoutSession({
          ...checkoutInput(fixture),
          trialPeriodDays,
        }),
        /trialPeriodDays must be a positive integer/u,
      );
      assert.equal(fixture.listCalls.length, 0);
      assert.equal(fixture.createCalls.length, 0);
    }
  });

  it("uses one stable idempotency key for concurrent replays of an intent", async () => {
    const fixture = createFixture();
    const input = checkoutInput(fixture);

    await Promise.all([
      createServerCheckoutSession(input),
      createServerCheckoutSession(input),
    ]);

    assert.equal(fixture.createCalls.length, 2);
    assert.equal(fixture.createRequestOptions.length, 2);
    assert.equal(
      fixture.createRequestOptions[0]?.idempotencyKey,
      fixture.createRequestOptions[1]?.idempotencyKey,
    );
    assert.match(
      fixture.createRequestOptions[0]?.idempotencyKey ?? "",
      /^homa-checkout:[a-f0-9]{64}$/u,
    );
  });

  it("selects the Payment Link from the verified tier and period", async () => {
    const regularLink = recurringLink({
      id: "plink_regular",
      url: "https://buy.stripe.com/regular_monthly",
      line_items: {
        data: [{
          quantity: 1,
          price: {
            id: "price_regular_monthly",
            type: "recurring",
            recurring: { interval: "month" },
          },
        }],
      },
    });
    const fixture = createFixture({ pages: [[regularLink, recurringLink()]] });

    await createServerCheckoutSession({
      ...checkoutInput(fixture),
      paymentLinkUrls: {
        regular: { monthly: "https://buy.stripe.com/regular_monthly" },
        plus: { monthly: PAYMENT_LINK_URL },
      },
    });

    assert.equal(fixture.createCalls.length, 1);
    assert.equal(fixture.createCalls[0]?.line_items[0]?.price, "price_plus_monthly");
  });

  it("fails before Stripe when the verified tier and period have no configured link", async () => {
    const fixture = createFixture();

    await assert.rejects(
      createServerCheckoutSession({
        ...checkoutInput(fixture),
        paymentLinkUrls: { regular: { monthly: PAYMENT_LINK_URL } },
      }),
      /no Payment Link is configured/u,
    );
    assert.equal(fixture.listCalls.length, 0);
  });
});
