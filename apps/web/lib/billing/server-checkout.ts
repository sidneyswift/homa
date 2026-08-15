import { createHash } from "node:crypto";

import type { BillingPeriod, PlanTier } from "./wall-types";
import { verifyCheckoutIntent } from "./checkout-intent";

const PAYMENT_LINK_PAGE_SIZE = 100;
const MAX_PAYMENT_LINK_PAGES = 1_000;

export interface ServerPaymentLinkPrice {
  id: string;
  type?: string;
  recurring?: { interval?: string; interval_count?: number } | null;
}

export interface ServerPaymentLinkLineItem {
  price: ServerPaymentLinkPrice | string | null;
  quantity?: number | null;
}

export interface ServerPaymentLink {
  id: string;
  active: boolean;
  url: string;
  line_items?: {
    data: ServerPaymentLinkLineItem[];
    has_more?: boolean;
  } | null;
}

export interface PaymentLinkListParams {
  limit: number;
  expand: string[];
  starting_after?: string;
}

export interface CheckoutSessionCreateParams {
  mode: "subscription";
  payment_method_collection: "always";
  client_reference_id: string;
  metadata: { family_id: string };
  customer_email?: string;
  subscription_data: {
    trial_period_days: number;
    metadata: { family_id: string };
  };
  success_url: string;
  cancel_url: string;
  line_items: Array<{ price: string; quantity: number }>;
}

export interface CreatedCheckoutSession {
  id: string;
  url: string | null;
}

export interface CheckoutSessionRequestOptions {
  idempotencyKey: string;
}

export interface ServerCheckoutGateway {
  paymentLinks: {
    list(params: PaymentLinkListParams): Promise<{
      data: ServerPaymentLink[];
      has_more: boolean;
    }>;
  };
  checkout: {
    sessions: {
      create(
        params: CheckoutSessionCreateParams,
        requestOptions: CheckoutSessionRequestOptions,
      ): Promise<CreatedCheckoutSession>;
    };
  };
}

/** Server configuration keyed by the exact purchase choice in the intent. */
export type ServerPaymentLinkUrls = Readonly<
  Partial<Record<PlanTier, Readonly<Partial<Record<BillingPeriod, string>>>>>
>;

export interface PaymentLinkInactivityOptions {
  /**
   * Checkout creation is deliberately account-wide: an untracked active link
   * could bypass Homa's server-created checkout path. Account deletion has a
   * narrower question, whether this family's configured legacy links remain
   * unable to create a future charge.
   */
  requireAccountWideInactivity?: boolean;
}

export interface CreateServerCheckoutSessionInput {
  gateway: ServerCheckoutGateway;
  intent: string;
  intentSecret: string;
  /** Authenticated family, never a free-form family selected by the client. */
  familyId: string;
  tier: PlanTier;
  billingPeriod: BillingPeriod;
  /** Must be assembled from server environment configuration, never request JSON. */
  paymentLinkUrls: ServerPaymentLinkUrls;
  customerEmail: string | null;
  /** Must come from trusted server configuration, never Host, Origin, or request JSON. */
  trustedOrigin: string;
  /** Canonical Homa trial length, supplied by the server billing contract. */
  trialPeriodDays: number;
  isFamilyActive(familyId: string): Promise<boolean>;
  nowMs?: number;
}

function exactConfiguredPaymentLinkUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("checkout requires a trusted Stripe Payment Link URL");
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "buy.stripe.com" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname === "/"
  ) {
    throw new Error("checkout requires a trusted Stripe Payment Link URL");
  }
  return url.toString();
}

function normalizeTrustedOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("checkout trusted origin is invalid");
  }
  const localHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
  if (
    (url.protocol !== "https:" && !localHttp) ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new Error("checkout trusted origin is invalid");
  }
  return url.origin;
}

/**
 * Resolve every configured legacy public link and prove every Payment Link in
 * the Stripe account is inactive. The returned map lets checkout recover
 * prices without a second Stripe scan; account deletion can call the same
 * assertion and ignore the map.
 */
export async function assertConfiguredPaymentLinksInactive(
  gateway: ServerCheckoutGateway,
  paymentLinkUrls: ServerPaymentLinkUrls,
  options: PaymentLinkInactivityOptions = {},
): Promise<ReadonlyMap<string, ServerPaymentLink>> {
  const requireAccountWideInactivity = options.requireAccountWideInactivity ?? true;
  const configuredUrls: string[] = [];
  for (const periods of Object.values(paymentLinkUrls)) {
    if (!periods) continue;
    for (const value of Object.values(periods)) {
      if (value) configuredUrls.push(exactConfiguredPaymentLinkUrl(value));
    }
  }
  if (new Set(configuredUrls).size !== configuredUrls.length) {
    throw new Error("each tier and billing period must use a distinct Payment Link");
  }

  const matches = new Map<string, ServerPaymentLink[]>(
    configuredUrls.map((url) => [url, []]),
  );
  const seenCursors = new Set<string>();
  let startingAfter: string | undefined;
  let activeLinkSeen = false;

  for (let pageNumber = 0; pageNumber < MAX_PAYMENT_LINK_PAGES; pageNumber += 1) {
    const page = await gateway.paymentLinks.list({
      limit: PAYMENT_LINK_PAGE_SIZE,
      expand: ["data.line_items"],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const link of page.data) {
      if (link.active) activeLinkSeen = true;
      matches.get(link.url)?.push(link);
    }
    if (!page.has_more) break;

    const cursor = page.data.at(-1)?.id;
    if (!cursor || seenCursors.has(cursor)) {
      throw new Error("Stripe Payment Link pagination did not advance");
    }
    seenCursors.add(cursor);
    startingAfter = cursor;

    if (pageNumber === MAX_PAYMENT_LINK_PAGES - 1) {
      throw new Error("Stripe Payment Link pagination exceeded its safety limit");
    }
  }

  if (requireAccountWideInactivity && activeLinkSeen) {
    throw new Error("Stripe account must have zero active Payment Links");
  }

  const resolved = new Map<string, ServerPaymentLink>();
  for (const configuredUrl of configuredUrls) {
    const links = matches.get(configuredUrl) ?? [];
    if (links.length === 0) {
      throw new Error("configured Payment Link does not match this Stripe account");
    }
    if (links.length > 1) {
      throw new Error("configured Payment Link matched more than one Stripe object");
    }
    const link = links[0];
    if (!link) throw new Error("configured Payment Link does not match this Stripe account");
    if (link.active) {
      throw new Error("configured legacy Payment Link must be inactive");
    }
    resolved.set(configuredUrl, link);
  }
  return resolved;
}

function recurringPriceAndQuantity(
  link: ServerPaymentLink,
  billingPeriod: BillingPeriod,
): { price: string; quantity: number } {
  if (link.active) throw new Error("configured legacy Payment Link must be inactive");
  const lineItems = link.line_items;
  if (!lineItems || lineItems.has_more === true || lineItems.data.length !== 1) {
    throw new Error("configured Payment Link must contain exactly one line item");
  }
  const lineItem = lineItems.data[0];
  if (!lineItem || !lineItem.price || typeof lineItem.price === "string") {
    throw new Error("configured Payment Link must expose exactly one recurring price");
  }
  const price = lineItem.price;
  if (price.type !== "recurring" || !price.recurring || price.id.length === 0) {
    throw new Error("configured Payment Link must expose exactly one recurring price");
  }
  const expectedInterval = billingPeriod === "annual" ? "year" : "month";
  if (
    price.recurring.interval !== expectedInterval ||
    (price.recurring.interval_count ?? 1) !== 1
  ) {
    throw new Error("configured Payment Link recurring price does not match the billing period");
  }
  if (lineItem.quantity !== 1) {
    throw new Error("configured Payment Link quantity must be exactly one");
  }
  return { price: price.id, quantity: lineItem.quantity as number };
}

/**
 * Turn a short-lived, family-bound intent into a Stripe-hosted subscription
 * session. Payment Link lookup happens against the authenticated Stripe
 * account, then family activity is rechecked as the final awaited operation
 * before the external session write.
 */
export async function createServerCheckoutSession(
  input: CreateServerCheckoutSessionInput,
): Promise<CreatedCheckoutSession> {
  const verifiedIntent = verifyCheckoutIntent(input.intent, {
    secret: input.intentSecret,
    expected: {
      familyId: input.familyId,
      tier: input.tier,
      billingPeriod: input.billingPeriod,
    },
    nowMs: input.nowMs,
  });
  if (!verifiedIntent) throw new Error("checkout intent is invalid or expired");
  if (!Number.isSafeInteger(input.trialPeriodDays) || input.trialPeriodDays <= 0) {
    throw new Error("checkout trialPeriodDays must be a positive integer");
  }

  const configuredPaymentLinkUrl =
    input.paymentLinkUrls[verifiedIntent.tier]?.[verifiedIntent.billingPeriod];
  if (!configuredPaymentLinkUrl) {
    throw new Error("no Payment Link is configured for this tier and billing period");
  }
  const configuredUrl = exactConfiguredPaymentLinkUrl(configuredPaymentLinkUrl);
  const trustedOrigin = normalizeTrustedOrigin(input.trustedOrigin);
  const resolvedLinks = await assertConfiguredPaymentLinksInactive(
    input.gateway,
    input.paymentLinkUrls,
  );
  const paymentLink = resolvedLinks.get(configuredUrl);
  if (!paymentLink) {
    throw new Error("configured Payment Link does not match this Stripe account");
  }
  const lineItem = recurringPriceAndQuantity(paymentLink, verifiedIntent.billingPeriod);
  const createParams: CheckoutSessionCreateParams = {
    mode: "subscription",
    payment_method_collection: "always",
    client_reference_id: verifiedIntent.familyId,
    metadata: { family_id: verifiedIntent.familyId },
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    subscription_data: {
      trial_period_days: input.trialPeriodDays,
      metadata: { family_id: verifiedIntent.familyId },
    },
    success_url:
      `${trustedOrigin}/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${trustedOrigin}/app`,
    line_items: [lineItem],
  };

  const idempotencyKey =
    `homa-checkout:${createHash("sha256").update(input.intent, "utf8").digest("hex")}`;
  if (!(await input.isFamilyActive(verifiedIntent.familyId))) {
    throw new Error("checkout family is not active");
  }
  return await input.gateway.checkout.sessions.create(createParams, { idempotencyKey });
}
