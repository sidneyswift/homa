import Stripe from "stripe";
import { del, list } from "@vercel/blob";

import { deleteFamilyBlobs } from "./materials/artifact-store";
import { lessonBlobConfigured } from "./lessons/blobs";
import { mapDb } from "./map/db";
import {
  deletionConfirmationFor,
  hasExactDeletionConfirmation,
} from "./account-deletion-confirmation";

export { deletionConfirmationFor, hasExactDeletionConfirmation } from "./account-deletion-confirmation";

export type AccountDeletionStatus =
  | "preparing"
  | "waiting_for_artifacts"
  | "running"
  | "retryable_failed"
  | "blocked"
  | "complete";

export interface AccountDeletionResult {
  state: "complete" | "in_progress" | "blocked" | "rejected";
  message: string;
}

interface DeletionJobRow {
  id: string;
  family_id: string | null;
  requested_by_user_id: string | null;
  status: AccountDeletionStatus;
}

export interface DeletionSubscription {
  provider: string;
  provider_subscription_id: string;
  status: string;
}

export interface DeletionBillingDecision {
  stripeSubscriptionIds: string[];
  blockedProvider: "apple" | "google" | null;
}

const LAPSED_DELETION_SUBSCRIPTION_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
  "paused",
]);

/** Provider-neutral decision made from verified ledger rows. Stripe can be
 * stopped by Homa; mobile stores retain cancellation control themselves. */
export function deletionBillingDecision(
  subscriptions: readonly DeletionSubscription[],
): DeletionBillingDecision {
  const active = subscriptions.filter(
    (subscription) => !LAPSED_DELETION_SUBSCRIPTION_STATUSES.has(subscription.status),
  );
  return {
    stripeSubscriptionIds: active
      .filter((subscription) => subscription.provider === "stripe")
      .map((subscription) => subscription.provider_subscription_id),
    blockedProvider: active.some((subscription) => subscription.provider === "apple")
      ? "apple"
      : active.some((subscription) => subscription.provider === "google")
        ? "google"
        : null,
  };
}

export function retryableDeletionFailure(error: unknown): {
  status: "retryable_failed";
  message: string;
} {
  return {
    status: "retryable_failed",
    message: error instanceof Error ? error.message : "The deletion job needs another attempt.",
  };
}

function stripeSecretKey(): string | null {
  return process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_TEST_SECRET_KEY || null;
}

async function familyBillingSubscriptions(familyId: string): Promise<DeletionSubscription[]> {
  const sql = mapDb();
  return await sql<DeletionSubscription[]>`
    select provider, provider_subscription_id, status
    from public.family_billing_subscriptions
    where family_id = ${familyId}
  `;
}

async function cancelStripeBilling(
  familyId: string,
  subscriptionIds: readonly string[],
): Promise<void> {
  const sql = mapDb();
  if (subscriptionIds.length === 0) return;

  const key = stripeSecretKey();
  if (!key) throw new Error("Stripe is not configured, so Homa could not stop future charges.");
  const stripe = new Stripe(key);
  for (const subscriptionId of subscriptionIds) {
    // Stripe cancellation is idempotent from Homa's perspective: a webhook
    // may have canceled it between this read and this request.
    try {
      await stripe.subscriptions.cancel(subscriptionId);
    } catch (error) {
      if (!(error instanceof Stripe.errors.StripeInvalidRequestError) || error.code !== "resource_missing") {
        throw error;
      }
    }
  }
  await sql`
    update public.family_billing_subscriptions
    set status = 'canceled', current_period_end = now(), last_observed_at = now(), updated_at = now()
    where family_id = ${familyId} and provider = 'stripe'
  `;
  await sql`
    update public.families
    set stripe_subscription_status = 'canceled', stripe_current_period_end = now(), updated_at = now()
    where id = ${familyId}
  `;
}

/**
 * Starts permanent deletion only after the exact server-validated phrase,
 * Stripe cancellation, and an ownership check. "deleted" immediately fences
 * every existing family resolver and outbound sweep; the job then performs
 * Blob cleanup and the final database cascade.
 */
export async function requestAccountDeletion(input: {
  familyId: string;
  userId: string;
  confirmation: unknown;
}): Promise<AccountDeletionResult> {
  const sql = mapDb();
  const familyRows = await sql<Array<{ name: string; status: string; primary_user_id: string | null }>>`
    select family.name, family.status,
           (select member.user_id from public.family_members member
            where member.family_id = family.id order by member.created_at, member.user_id limit 1)
             as primary_user_id
    from public.families family
    where family.id = ${input.familyId}
  `;
  const family = familyRows[0];
  if (!family || family.status === "deleted") {
    return { state: "rejected", message: "This family is no longer available." };
  }
  if (!hasExactDeletionConfirmation(family.name, input.confirmation)) {
    return {
      state: "rejected",
      message: `Type exactly “${deletionConfirmationFor(family.name)}” to continue.`,
    };
  }
  if (family.primary_user_id !== input.userId) {
    return {
      state: "rejected",
      message: "Only the parent who opened this family can permanently delete its shared record.",
    };
  }

  const existing = await sql<DeletionJobRow[]>`
    select id, family_id, requested_by_user_id, status
    from public.account_deletion_jobs
    where family_id = ${input.familyId}
      and status <> 'complete'
    order by requested_at desc
    limit 1
  `;
  if (existing[0]) return await runAccountDeletionJob(existing[0].id);

  const billing = deletionBillingDecision(await familyBillingSubscriptions(input.familyId));
  if (billing.blockedProvider) {
    const provider = billing.blockedProvider === "apple" ? "App Store" : "Google Play";
    return {
      state: "blocked",
      message: `${provider} controls this subscription. Cancel it there first so it cannot renew, then return here to permanently delete your family data.`,
    };
  }

  try {
    await cancelStripeBilling(input.familyId, billing.stripeSubscriptionIds);
  } catch (error) {
    return {
      state: "rejected",
      message: `Homa could not confirm that future charges are stopped. Your account is still available. ${error instanceof Error ? error.message : "Try again in a moment."}`,
    };
  }

  const job = await sql.begin(async (tx) => {
    const rows = await tx<DeletionJobRow[]>`
      insert into public.account_deletion_jobs (family_id, requested_by_user_id, status, provider_summary)
      values (${input.familyId}, ${input.userId}, 'waiting_for_artifacts', ${tx.json({ stripe: "canceled" })})
      on conflict do nothing
      returning id, family_id, requested_by_user_id, status
    `;
    if (!rows[0]) return null;
    // This revokes product access and makes every existing scheduler query
    // skip the family before we touch a Blob. Sessions are removed for every
    // shared parent, because the whole shared family is being erased.
    await tx`update public.families set status = 'deleted', updated_at = now() where id = ${input.familyId}`;
    await tx`delete from public.agent_schedules where family_id = ${input.familyId}`;
    await tx`
      delete from auth.sessions
      where user_id in (select user_id from public.family_members where family_id = ${input.familyId})
    `;
    return rows[0];
  });
  if (!job) {
    const concurrent = await sql<DeletionJobRow[]>`
      select id, family_id, requested_by_user_id, status
      from public.account_deletion_jobs
      where family_id = ${input.familyId} and status <> 'complete'
      order by requested_at desc
      limit 1
    `;
    return concurrent[0]
      ? await runAccountDeletionJob(concurrent[0].id)
      : { state: "in_progress", message: "Your deletion is being prepared." };
  }
  return await runAccountDeletionJob(job.id);
}

async function deletePrivateLessonBlobs(familyId: string): Promise<number> {
  if (!lessonBlobConfigured()) {
    throw new Error("The private lesson artifact store is not configured, so Homa cannot verify permanent deletion.");
  }
  const token = process.env.HOMA_LESSON_READ_WRITE_TOKEN?.trim();
  let cursor: string | undefined;
  let deleted = 0;
  do {
    const page = await list({ prefix: `families/${familyId}/`, cursor, token });
    if (page.blobs.length > 0) {
      await del(page.blobs.map((blob) => blob.url), { token });
      deleted += page.blobs.length;
    }
    cursor = page.cursor;
  } while (cursor);
  return deleted;
}

async function eraseFamilyRecords(familyId: string): Promise<void> {
  const sql = mapDb();
  await sql.begin(async (tx) => {
    const memberRows = await tx<Array<{ user_id: string }>>`
      select user_id from public.family_members where family_id = ${familyId} for update
    `;
    await tx`delete from public.conversation_signals where family_id = ${familyId}`;
    await tx`delete from public.knowledge_gaps where family_id = ${familyId}`;
    await tx`delete from public.response_engagement where family_id = ${familyId}`;
    await tx`delete from public.families where id = ${familyId}`;
    for (const member of memberRows) {
      await tx`
        delete from auth.users user_row
        where user_row.id = ${member.user_id}
          and not exists (select 1 from public.family_members member where member.user_id = user_row.id)
      `;
    }
  });
}

/** Runs one idempotent deletion attempt. A failure leaves its job retryable
 * and its family already inaccessible, never pretends that a soft delete is
 * completed erasure. */
export async function runAccountDeletionJob(jobId: string): Promise<AccountDeletionResult> {
  const sql = mapDb();
  const jobs = await sql<DeletionJobRow[]>`
    update public.account_deletion_jobs
    set status = 'running', attempts = attempts + 1, started_at = coalesce(started_at, now()),
        updated_at = now(), last_error = null
    where id = ${jobId}
      and (
        status in ('waiting_for_artifacts', 'retryable_failed')
        or (status = 'running' and updated_at < now() - interval '15 minutes')
      )
    returning id, family_id, requested_by_user_id, status
  `;
  const job = jobs[0];
  if (!job) {
    return { state: "in_progress", message: "Your deletion is already being completed." };
  }
  if (!job.family_id) {
    return { state: "complete", message: "Your account and family data have been permanently deleted." };
  }

  try {
    const [publicArtifacts, privateArtifacts] = await Promise.all([
      deleteFamilyBlobs(job.family_id),
      deletePrivateLessonBlobs(job.family_id),
    ]);
    await eraseFamilyRecords(job.family_id);
    await sql`
      update public.account_deletion_jobs
      set family_id = null, requested_by_user_id = null, status = 'complete',
          artifact_count = ${publicArtifacts + privateArtifacts}, completed_at = now(), updated_at = now()
      where id = ${job.id}
    `;
    return { state: "complete", message: "Your account and family data have been permanently deleted." };
  } catch (error) {
    const failure = retryableDeletionFailure(error);
    await sql`
      update public.account_deletion_jobs
      set status = ${failure.status}, last_error = ${failure.message.slice(0, 500)}, updated_at = now()
      where id = ${job.id}
    `;
    console.error(`account deletion job ${job.id} did not finish:`, failure.message);
    return {
      state: "in_progress",
      message: "Your access is closed and future charges are stopped. Homa is still finishing permanent deletion, and will retry safely.",
    };
  }
}

/** The schedule is a reliability floor. It never runs a blocked native-billing
 * request, and the job itself is idempotent if the process is retried. */
export async function retryPendingAccountDeletions(limit = 20): Promise<void> {
  const sql = mapDb();
  const jobs = await sql<Array<{ id: string }>>`
    select id from public.account_deletion_jobs
    where status in ('waiting_for_artifacts', 'retryable_failed')
       or (status = 'running' and updated_at < now() - interval '15 minutes')
    order by requested_at
    limit ${limit}
  `;
  for (const job of jobs) await runAccountDeletionJob(job.id);
}
