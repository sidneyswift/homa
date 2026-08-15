import Stripe from "stripe";

import {
  configuredStripeSecretKey,
} from "./billing/stripe-checkout-config";

const STRIPE_LIST_LIMIT = 100;
const MAX_PAGES_PER_COLLECTION = 100;
const MAX_DISCOVERED_IDENTIFIERS = 1_000;
const MAX_PROVIDER_REQUESTS = 1_000;
const MAX_CLOCK_SKEW_SECONDS = 300;

const SAFE_UNCERTAINTY_MESSAGE =
  "Homa could not confirm that every future Stripe charge is stopped. Try again in a moment.";

const TERMINAL_STRIPE_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "incomplete_expired",
]);

export type StripeAccountDeletionUncertaintyReason =
  | "not_configured"
  | "provider_request_failed"
  | "pagination_stalled"
  | "safety_limit_exceeded"
  | "unexpected_provider_state";

/**
 * A deliberately log-safe boundary error. The provider error remains in
 * `cause` for structured diagnostics, while the parent-facing message never
 * repeats Stripe request details, object IDs, or credentials.
 */
export class StripeAccountDeletionUncertainError extends Error {
  readonly reason: StripeAccountDeletionUncertaintyReason;

  constructor(reason: StripeAccountDeletionUncertaintyReason, cause?: unknown) {
    super(SAFE_UNCERTAINTY_MESSAGE, cause === undefined ? undefined : { cause });
    this.name = "StripeAccountDeletionUncertainError";
    this.reason = reason;
  }
}

export interface StripeAccountDeletionPage<T extends { id: string }> {
  data: readonly T[];
  hasMore: boolean;
}

export interface StripeDeletionCheckoutSession {
  id: string;
  clientReferenceId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
}

export interface StripeDeletionSubscription {
  id: string;
  customerId: string;
  status: string;
  metadataFamilyId: string | null;
}

export interface StripeCheckoutSessionPageRequest {
  status: "open" | "complete";
  createdGte?: number;
  startingAfter?: string;
  limit: number;
}

export interface StripeSubscriptionPageRequest {
  customerId: string;
  startingAfter?: string;
  limit: number;
}

export interface StripeAllSubscriptionsPageRequest {
  startingAfter?: string;
  limit: number;
}

/** The narrow provider surface needed to make deletion billing-safe. */
export interface StripeAccountDeletionGateway {
  listCheckoutSessions(
    request: StripeCheckoutSessionPageRequest,
  ): Promise<StripeAccountDeletionPage<StripeDeletionCheckoutSession>>;
  expireCheckoutSession(id: string): Promise<{ id: string; status: string | null }>;
  listAllSubscriptions(
    request: StripeAllSubscriptionsPageRequest,
  ): Promise<StripeAccountDeletionPage<StripeDeletionSubscription>>;
  listSubscriptions(
    request: StripeSubscriptionPageRequest,
  ): Promise<StripeAccountDeletionPage<StripeDeletionSubscription>>;
  retrieveSubscription(id: string): Promise<StripeDeletionSubscription>;
  cancelSubscription(id: string): Promise<StripeDeletionSubscription>;
}

export interface StripeAccountDeletionReconciliationInput {
  familyId: string;
  familyCreatedAt: Date;
  /** Exact IDs read from this family's billing mirror and ledger rows. */
  knownCustomerIds: readonly string[];
  /** Exact IDs read from this family's billing mirror and ledger rows. */
  knownSubscriptionIds: readonly string[];
}

export interface StripeAccountDeletionReconciliationResult {
  expiredCheckoutSessionCount: number;
  inspectedCustomerCount: number;
  inspectedSubscriptionCount: number;
  canceledSubscriptionCount: number;
  alreadyTerminalSubscriptionCount: number;
}

function addBoundedExactId(target: Set<string>, id: string): void {
  if (typeof id !== "string" || id.length === 0 || id.trim() !== id) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  target.add(id);
  if (target.size > MAX_DISCOVERED_IDENTIFIERS) {
    throw new StripeAccountDeletionUncertainError("safety_limit_exceeded");
  }
}

function requireDateInUnixSeconds(value: Date): number {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  const unixSeconds = Math.floor(value.getTime() / 1_000);
  if (
    unixSeconds < 0
    || unixSeconds > Math.floor(Date.now() / 1_000) + MAX_CLOCK_SKEW_SECONDS
  ) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  return unixSeconds;
}

function requirePageItemId(item: { id: string }): string {
  if (typeof item.id !== "string" || item.id.length === 0 || item.id.trim() !== item.id) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  return item.id;
}

function recordSubscription(
  subscriptions: Map<string, StripeDeletionSubscription>,
  value: StripeDeletionSubscription,
): void {
  const id = requirePageItemId(value);
  if (
    typeof value.status !== "string"
    || value.status.length === 0
    || value.status.trim() !== value.status
  ) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  if (
    typeof value.customerId !== "string"
    || value.customerId.length === 0
    || value.customerId.trim() !== value.customerId
  ) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  if (
    value.metadataFamilyId !== null
    && (
      typeof value.metadataFamilyId !== "string"
      || value.metadataFamilyId.length === 0
      || value.metadataFamilyId.trim() !== value.metadataFamilyId
    )
  ) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  const previous = subscriptions.get(id);
  if (
    previous
    && (
      previous.customerId !== value.customerId
      || previous.metadataFamilyId !== value.metadataFamilyId
    )
  ) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  subscriptions.set(id, value);
  if (subscriptions.size > MAX_DISCOVERED_IDENTIFIERS) {
    throw new StripeAccountDeletionUncertainError("safety_limit_exceeded");
  }
}

function stripeObjectId(value: string | { id: string } | null): string | null {
  if (value === null) return null;
  const id = typeof value === "string" ? value : value.id;
  if (typeof id !== "string" || id.length === 0 || id.trim() !== id) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  return id;
}

function requiredStripeObjectId(value: string | { id: string }): string {
  const id = stripeObjectId(value);
  if (id === null) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  return id;
}

function stripeMetadataFamilyId(value: string | undefined): string | null {
  if (value === undefined) return null;
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
  }
  return value;
}

/** Translate the installed Stripe SDK into the small deterministic test seam. */
export function createStripeAccountDeletionGateway(
  stripe: Stripe,
): StripeAccountDeletionGateway {
  return {
    listCheckoutSessions: async (request) => {
      const response = await stripe.checkout.sessions.list({
        status: request.status,
        limit: request.limit,
        ...(request.createdGte === undefined
          ? {}
          : { created: { gte: request.createdGte } }),
        ...(request.startingAfter === undefined
          ? {}
          : { starting_after: request.startingAfter }),
      });
      return {
        data: response.data.map((value) => ({
          id: value.id,
          clientReferenceId: value.client_reference_id,
          customerId: stripeObjectId(value.customer),
          subscriptionId: stripeObjectId(value.subscription),
        })),
        hasMore: response.has_more,
      };
    },
    expireCheckoutSession: async (id) => {
      const response = await stripe.checkout.sessions.expire(id);
      return { id: response.id, status: response.status };
    },
    listAllSubscriptions: async (request) => {
      const response = await stripe.subscriptions.list({
        status: "all",
        limit: request.limit,
        ...(request.startingAfter === undefined
          ? {}
          : { starting_after: request.startingAfter }),
      });
      return {
        data: response.data.map((value) => ({
          id: value.id,
          customerId: requiredStripeObjectId(value.customer),
          status: value.status,
          metadataFamilyId: stripeMetadataFamilyId(value.metadata.family_id),
        })),
        hasMore: response.has_more,
      };
    },
    listSubscriptions: async (request) => {
      const response = await stripe.subscriptions.list({
        customer: request.customerId,
        status: "all",
        limit: request.limit,
        ...(request.startingAfter === undefined
          ? {}
          : { starting_after: request.startingAfter }),
      });
      return {
        data: response.data.map((value) => ({
          id: value.id,
          customerId: requiredStripeObjectId(value.customer),
          status: value.status,
          metadataFamilyId: stripeMetadataFamilyId(value.metadata.family_id),
        })),
        hasMore: response.has_more,
      };
    },
    retrieveSubscription: async (id) => {
      const response = await stripe.subscriptions.retrieve(id);
      return {
        id: response.id,
        customerId: requiredStripeObjectId(response.customer),
        status: response.status,
        metadataFamilyId: stripeMetadataFamilyId(response.metadata.family_id),
      };
    },
    cancelSubscription: async (id) => {
      const response = await stripe.subscriptions.cancel(id, {
        invoice_now: false,
        prorate: false,
      });
      return {
        id: response.id,
        customerId: requiredStripeObjectId(response.customer),
        status: response.status,
        metadataFamilyId: stripeMetadataFamilyId(response.metadata.family_id),
      };
    },
  };
}

interface ProviderRequestBudget {
  count: number;
}

async function providerRequest<T>(
  budget: ProviderRequestBudget,
  operation: () => Promise<T>,
): Promise<T> {
  budget.count += 1;
  if (budget.count > MAX_PROVIDER_REQUESTS) {
    throw new StripeAccountDeletionUncertainError("safety_limit_exceeded");
  }
  return await operation();
}

async function visitEveryPage<T extends { id: string }>(input: {
  budget: ProviderRequestBudget;
  list: (startingAfter: string | undefined) => Promise<StripeAccountDeletionPage<T>>;
  visit: (item: T) => void;
}): Promise<void> {
  let startingAfter: string | undefined;
  const cursors = new Set<string>();

  for (let pageNumber = 0; pageNumber < MAX_PAGES_PER_COLLECTION; pageNumber += 1) {
    const page = await providerRequest(input.budget, () => input.list(startingAfter));
    if (!page || !Array.isArray(page.data) || typeof page.hasMore !== "boolean") {
      throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
    }
    if (page.data.length > STRIPE_LIST_LIMIT) {
      throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
    }
    for (const item of page.data) {
      requirePageItemId(item);
      input.visit(item);
    }
    if (!page.hasMore) return;

    const nextCursor = page.data.at(-1)?.id;
    if (!nextCursor || nextCursor === startingAfter || cursors.has(nextCursor)) {
      throw new StripeAccountDeletionUncertainError("pagination_stalled");
    }
    cursors.add(nextCursor);
    startingAfter = nextCursor;
  }

  throw new StripeAccountDeletionUncertainError("safety_limit_exceeded");
}

/**
 * Build the reconciliation procedure around an injected gateway. Every Stripe
 * read is provider-owned truth; the local mirror and ledger only supply extra
 * exact object IDs that the provider discovery might otherwise miss.
 */
export function createStripeAccountDeletionReconciler(
  gateway: StripeAccountDeletionGateway,
): (
  input: StripeAccountDeletionReconciliationInput,
) => Promise<StripeAccountDeletionReconciliationResult> {
  return async (input) => {
    if (
      typeof input.familyId !== "string"
      || input.familyId.length === 0
      || input.familyId.trim() !== input.familyId
    ) {
      throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
    }
    const familyCreatedAtUnixSeconds = requireDateInUnixSeconds(input.familyCreatedAt);
    const budget: ProviderRequestBudget = { count: 0 };

    try {
      const customerIds = new Set<string>();
      const exactFamilyCustomerIds = new Set<string>();
      const legacySubscriptionIds = new Set<string>();
      for (const id of input.knownCustomerIds) {
        addBoundedExactId(customerIds, id);
        addBoundedExactId(exactFamilyCustomerIds, id);
      }
      for (const id of input.knownSubscriptionIds) {
        addBoundedExactId(legacySubscriptionIds, id);
      }

      const openSessionIds = new Set<string>();
      const checkoutSubscriptionIds = new Set<string>();
      await visitEveryPage({
        budget,
        list: async (startingAfter) => await gateway.listCheckoutSessions({
          status: "open",
          startingAfter,
          limit: STRIPE_LIST_LIMIT,
        }),
        visit: (checkoutSession) => {
          if (
            checkoutSession.clientReferenceId !== null
            && typeof checkoutSession.clientReferenceId !== "string"
          ) {
            throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
          }
          if (checkoutSession.clientReferenceId === input.familyId) {
            openSessionIds.add(checkoutSession.id);
            if (openSessionIds.size > MAX_DISCOVERED_IDENTIFIERS) {
              throw new StripeAccountDeletionUncertainError("safety_limit_exceeded");
            }
          }
        },
      });

      for (const checkoutSessionId of openSessionIds) {
        const expired = await providerRequest(budget, async () =>
          await gateway.expireCheckoutSession(checkoutSessionId));
        if (expired.id !== checkoutSessionId || expired.status !== "expired") {
          throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
        }
      }

      await visitEveryPage({
        budget,
        list: async (startingAfter) => await gateway.listCheckoutSessions({
          status: "complete",
          createdGte: familyCreatedAtUnixSeconds,
          startingAfter,
          limit: STRIPE_LIST_LIMIT,
        }),
        visit: (checkoutSession) => {
          if (
            checkoutSession.clientReferenceId !== null
            && typeof checkoutSession.clientReferenceId !== "string"
          ) {
            throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
          }
          if (checkoutSession.clientReferenceId !== input.familyId) return;
          if (checkoutSession.customerId !== null) {
            addBoundedExactId(customerIds, checkoutSession.customerId);
          }
          if (checkoutSession.subscriptionId !== null) {
            addBoundedExactId(checkoutSubscriptionIds, checkoutSession.subscriptionId);
          }
        },
      });

      const inspectedSubscriptions = new Map<string, StripeDeletionSubscription>();
      const verifiedCheckoutSubscriptions = new Map<string, StripeDeletionSubscription>();
      const verifiedLegacySubscriptions = new Map<string, StripeDeletionSubscription>();
      const listedCustomerIds = new Set<string>();

      await visitEveryPage({
        budget,
        list: async (startingAfter) => await gateway.listAllSubscriptions({
          startingAfter,
          limit: STRIPE_LIST_LIMIT,
        }),
        visit: (subscription) => {
          if (subscription.metadataFamilyId !== input.familyId) return;
          recordSubscription(inspectedSubscriptions, subscription);
          addBoundedExactId(exactFamilyCustomerIds, subscription.customerId);
          addBoundedExactId(customerIds, subscription.customerId);
        },
      });

      const customerQueue = [...customerIds];

      const listQueuedCustomers = async (): Promise<void> => {
        while (customerQueue.length > 0) {
          const customerId = customerQueue.shift();
          if (!customerId || listedCustomerIds.has(customerId)) continue;
          listedCustomerIds.add(customerId);
          await visitEveryPage({
            budget,
            list: async (startingAfter) => await gateway.listSubscriptions({
              customerId,
              startingAfter,
              limit: STRIPE_LIST_LIMIT,
            }),
            visit: (subscription) => {
              if (subscription.customerId !== customerId) {
                throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
              }
              recordSubscription(inspectedSubscriptions, subscription);
              if (subscription.metadataFamilyId === input.familyId) {
                addBoundedExactId(exactFamilyCustomerIds, customerId);
              }
            },
          });
        }
      };

      await listQueuedCustomers();

      for (const subscriptionId of checkoutSubscriptionIds) {
        // Legacy Payment Links put client_reference_id in a user-editable URL,
        // so it discovers candidates but never proves tenant ownership. Stripe
        // metadata proves ownership. Missing metadata also needs this family's
        // exact mirror or ledger association.
        const subscription = await providerRequest(budget, async () =>
          await gateway.retrieveSubscription(subscriptionId));
        if (
          subscription.id !== subscriptionId
          || (
            subscription.metadataFamilyId === null
            && !legacySubscriptionIds.has(subscriptionId)
          )
          || (
            subscription.metadataFamilyId !== null
            && subscription.metadataFamilyId !== input.familyId
          )
        ) {
          throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
        }
        recordSubscription(inspectedSubscriptions, subscription);
        recordSubscription(verifiedCheckoutSubscriptions, subscription);
        addBoundedExactId(exactFamilyCustomerIds, subscription.customerId);
        if (!customerIds.has(subscription.customerId)) {
          addBoundedExactId(customerIds, subscription.customerId);
          customerQueue.push(subscription.customerId);
        }
      }

      for (const subscriptionId of legacySubscriptionIds) {
        // Older rows can predate family metadata. Trust only the exact ID read
        // from this family's mirror or ledger. Conflicting provider metadata
        // is never overridden by the local row.
        const subscription = verifiedCheckoutSubscriptions.get(subscriptionId)
          ?? await providerRequest(budget, async () =>
            await gateway.retrieveSubscription(subscriptionId));
        if (
          subscription.id !== subscriptionId
          || (
            subscription.metadataFamilyId !== null
            && subscription.metadataFamilyId !== input.familyId
          )
        ) {
          throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
        }
        recordSubscription(inspectedSubscriptions, subscription);
        recordSubscription(verifiedLegacySubscriptions, subscription);
        addBoundedExactId(exactFamilyCustomerIds, subscription.customerId);
        if (!customerIds.has(subscription.customerId)) {
          addBoundedExactId(customerIds, subscription.customerId);
          customerQueue.push(subscription.customerId);
        }
      }

      // Exact subscription lookups can reveal customers absent from Checkout
      // history. Inspect those customers, but metadata remains the authority
      // for every sibling subscription discovered through the customer.
      await listQueuedCustomers();

      const subscriptionsToReconcile = new Map<string, StripeDeletionSubscription>();
      for (const subscription of inspectedSubscriptions.values()) {
        if (subscription.metadataFamilyId === input.familyId) {
          recordSubscription(subscriptionsToReconcile, subscription);
          continue;
        }
        const hasExactSubscriptionProof = verifiedCheckoutSubscriptions.has(subscription.id)
          || verifiedLegacySubscriptions.has(subscription.id);
        if (
          subscription.metadataFamilyId === null
          && exactFamilyCustomerIds.has(subscription.customerId)
          && !hasExactSubscriptionProof
          && !TERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status)
        ) {
          // A shared customer can legitimately carry another family's
          // subscription. Without metadata or an exact family association,
          // cancellation would be unsafe, but ignoring a charge-capable
          // subscription would make deletion unsafe. Preserve access.
          throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
        }
      }
      const includeVerifiedExactSubscriptions = (
        verifiedSubscriptions: ReadonlyMap<string, StripeDeletionSubscription>,
      ): void => {
        for (const [subscriptionId, verified] of verifiedSubscriptions) {
          const latest = inspectedSubscriptions.get(subscriptionId) ?? verified;
          if (
            latest.metadataFamilyId !== null
            && latest.metadataFamilyId !== input.familyId
          ) {
            throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
          }
          recordSubscription(subscriptionsToReconcile, latest);
        }
      };
      includeVerifiedExactSubscriptions(verifiedCheckoutSubscriptions);
      includeVerifiedExactSubscriptions(verifiedLegacySubscriptions);

      let canceledSubscriptionCount = 0;
      let alreadyTerminalSubscriptionCount = 0;
      for (const subscription of subscriptionsToReconcile.values()) {
        if (TERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
          alreadyTerminalSubscriptionCount += 1;
          continue;
        }
        const canceled = await providerRequest(budget, async () =>
          await gateway.cancelSubscription(subscription.id));
        if (
          canceled.id !== subscription.id
          || canceled.customerId !== subscription.customerId
          || canceled.metadataFamilyId !== subscription.metadataFamilyId
          || !TERMINAL_STRIPE_SUBSCRIPTION_STATUSES.has(canceled.status)
        ) {
          throw new StripeAccountDeletionUncertainError("unexpected_provider_state");
        }
        canceledSubscriptionCount += 1;
      }

      return {
        expiredCheckoutSessionCount: openSessionIds.size,
        inspectedCustomerCount: listedCustomerIds.size,
        inspectedSubscriptionCount: inspectedSubscriptions.size,
        canceledSubscriptionCount,
        alreadyTerminalSubscriptionCount,
      };
    } catch (error) {
      if (error instanceof StripeAccountDeletionUncertainError) throw error;
      throw new StripeAccountDeletionUncertainError("provider_request_failed", error);
    }
  };
}

/** Production entry point. Tests use createStripeAccountDeletionReconciler. */
export async function reconcileStripeAccountDeletion(
  input: StripeAccountDeletionReconciliationInput,
): Promise<StripeAccountDeletionReconciliationResult> {
  const secretKey = configuredStripeSecretKey();
  if (!secretKey) {
    throw new StripeAccountDeletionUncertainError("not_configured");
  }
  try {
    const stripe = new Stripe(secretKey);
    return await createStripeAccountDeletionReconciler(
      createStripeAccountDeletionGateway(stripe),
    )(input);
  } catch (error) {
    if (error instanceof StripeAccountDeletionUncertainError) throw error;
    throw new StripeAccountDeletionUncertainError("provider_request_failed", error);
  }
}
