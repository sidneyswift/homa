import type { TransactionSql } from "postgres";
import { del, list } from "@vercel/blob";

import { deleteAccountDeletionAvatars } from "./account-deletion-avatars";
import {
  accountDeletionSupabaseCleanupConfigured,
  deleteAccountDeletionAuthUsers,
} from "./account-deletion-auth-users";
import {
  reconcileStripeAccountDeletion,
  StripeAccountDeletionUncertainError,
  type StripeAccountDeletionReconciliationResult,
} from "./account-deletion-billing";
import { blobConfigured, deleteFamilyBlobs } from "./materials/artifact-store";
import { familyBlobToken } from "./family-blob";
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
  accessClosed: boolean;
  deletionReceipt?: string;
}

interface DeletionJobRow {
  id: string;
  family_id: string | null;
  requested_by_user_id: string | null;
  storage_user_ids: string[] | null;
  final_cleanup_after: string;
  artifact_count: number | null;
  can_finalize: boolean;
  status: AccountDeletionStatus;
  attempts: number;
  family_exists?: boolean;
}

export interface DeletionSubscription {
  provider: string;
  provider_subscription_id: string;
  provider_customer_id?: string | null;
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

export async function runAccountDeletionCleanup(input: {
  finalize: boolean;
  eraseDatabaseRecords: () => Promise<readonly string[]>;
  deleteArtifacts: (storageUserIds: readonly string[]) => Promise<readonly number[]>;
}): Promise<{ artifactCount: number; state: "draining" | "verifying" }> {
  const storageUserIds = await input.eraseDatabaseRecords();
  const artifactCounts = await input.deleteArtifacts(storageUserIds);
  return {
    artifactCount: artifactCounts.reduce((total, count) => total + count, 0),
    state: input.finalize ? "verifying" : "draining",
  };
}

export interface AccountDeletionWorkerDependencies {
  deleteAvatars(userIds: readonly string[]): Promise<number>;
  deleteAuthUsers(userIds: readonly string[]): Promise<number>;
  deletePublicFamilyBlobs(familyId: string): Promise<number>;
  deletePrivateFamilyBlobs(familyId: string): Promise<number>;
}

export interface AccountDeletionJobDependencies
  extends AccountDeletionWorkerDependencies {
  supabaseCleanupConfigured: () => boolean;
  artifactCleanupConfigured: () => boolean;
  reconcileStripe: (input: {
    familyId: string;
    familyCreatedAt: Date;
    knownCustomerIds: readonly string[];
    knownSubscriptionIds: readonly string[];
  }) => Promise<StripeAccountDeletionReconciliationResult>;
  acknowledgeAcceptance?: (
    result: AccountDeletionResult,
  ) => Promise<AccountDeletionResult>;
}

const DEFAULT_ACCOUNT_DELETION_WORKER_DEPENDENCIES: AccountDeletionWorkerDependencies = {
  deleteAvatars: deleteAccountDeletionAvatars,
  deleteAuthUsers: deleteAccountDeletionAuthUsers,
  deletePublicFamilyBlobs: deleteFamilyBlobs,
  deletePrivateFamilyBlobs: deletePrivateLessonBlobs,
};

export interface AccountDeletionRequestDependencies {
  supabaseCleanupConfigured: () => boolean;
  artifactCleanupConfigured: () => boolean;
  reconcileStripe: (input: {
    familyId: string;
    familyCreatedAt: Date;
    knownCustomerIds: readonly string[];
    knownSubscriptionIds: readonly string[];
  }) => Promise<StripeAccountDeletionReconciliationResult>;
  worker?: AccountDeletionWorkerDependencies;
  acknowledgeAcceptance?: (
    result: AccountDeletionResult,
  ) => Promise<AccountDeletionResult>;
  acknowledgePreparationCommit?: () => Promise<void>;
}

const DEFAULT_ACCOUNT_DELETION_REQUEST_DEPENDENCIES: AccountDeletionRequestDependencies = {
  supabaseCleanupConfigured: accountDeletionSupabaseCleanupConfigured,
  artifactCleanupConfigured: () => blobConfigured() && lessonBlobConfigured(),
  reconcileStripe: reconcileStripeAccountDeletion,
};

const DEFAULT_ACCOUNT_DELETION_JOB_DEPENDENCIES: AccountDeletionJobDependencies = {
  ...DEFAULT_ACCOUNT_DELETION_WORKER_DEPENDENCIES,
  ...DEFAULT_ACCOUNT_DELETION_REQUEST_DEPENDENCIES,
};

function jobDependenciesForRequest(
  dependencies: AccountDeletionRequestDependencies,
): AccountDeletionJobDependencies {
  return {
    ...DEFAULT_ACCOUNT_DELETION_WORKER_DEPENDENCIES,
    ...dependencies.worker,
    supabaseCleanupConfigured: dependencies.supabaseCleanupConfigured,
    artifactCleanupConfigured: dependencies.artifactCleanupConfigured,
    reconcileStripe: dependencies.reconcileStripe,
    acknowledgeAcceptance: dependencies.acknowledgeAcceptance,
  };
}

async function snapshotFamilyArtifactPrefixes(
  tx: TransactionSql,
  jobId: string,
  familyId: string,
): Promise<void> {
  const unsafe = await tx<Array<{ artifact_family_id: string }>>`
    select candidate.artifact_family_id
    from public.family_artifact_prefix_candidates candidate
    left join public.family_artifact_prefixes prefix
      on prefix.artifact_family_id = candidate.artifact_family_id
     and prefix.owner_family_id = candidate.owner_family_id
    left join public.families live_artifact_family
      on live_artifact_family.id = candidate.artifact_family_id
    where candidate.owner_family_id = ${familyId}
      and (
        prefix.artifact_family_id is null
        or live_artifact_family.id is not null
      )
    union
    select prefix.artifact_family_id
    from public.family_artifact_prefixes prefix
    join public.families live_artifact_family
      on live_artifact_family.id = prefix.artifact_family_id
    where prefix.owner_family_id = ${familyId}
    union
    select candidate.artifact_family_id
    from public.family_artifact_prefix_candidates candidate
    where candidate.owner_family_id <> ${familyId}
      and (
        candidate.artifact_family_id = ${familyId}
        or exists (
          select 1
          from public.family_artifact_prefixes prefix
          where prefix.owner_family_id = ${familyId}
            and prefix.artifact_family_id = candidate.artifact_family_id
        )
      )
  `;
  if (unsafe.length > 0) {
    throw new Error(
      "Account deletion found a historical artifact prefix that needs review.",
    );
  }
  const missing = await tx<Array<{ family_id: string }>>`
    with expected (family_id) as (
      values (${familyId}::uuid)
      union
      select prefix.artifact_family_id
      from public.family_artifact_prefixes prefix
      where prefix.owner_family_id = ${familyId}
    ), recorded as (
      insert into public.account_deletion_artifact_tombstones (
        family_id,
        deletion_job_id
      )
      select expected.family_id, ${jobId}
      from expected
      on conflict (family_id) do update
      set deletion_job_id = excluded.deletion_job_id
      where account_deletion_artifact_tombstones.deletion_job_id
        = excluded.deletion_job_id
      returning family_id
    )
    select expected.family_id
    from expected
    left join recorded using (family_id)
    where recorded.family_id is null
  `;
  if (missing.length > 0) {
    throw new Error(
      "Account deletion found an artifact prefix owned by another deletion job.",
    );
  }
}

async function retireResolvedArtifactCandidates(
  tx: TransactionSql,
  jobId: string,
  familyId: string,
): Promise<void> {
  const unresolved = await tx<Array<{ artifact_family_id: string }>>`
    select candidate.artifact_family_id
    from public.family_artifact_prefix_candidates candidate
    left join public.family_artifact_prefixes prefix
      on prefix.artifact_family_id = candidate.artifact_family_id
     and prefix.owner_family_id = candidate.owner_family_id
    left join public.account_deletion_artifact_tombstones tombstone
      on tombstone.family_id = candidate.artifact_family_id
     and tombstone.deletion_job_id = ${jobId}
    where candidate.owner_family_id = ${familyId}
      and (
        prefix.artifact_family_id is null
        or tombstone.family_id is null
      )
    union
    select candidate.artifact_family_id
    from public.family_artifact_prefix_candidates candidate
    where candidate.owner_family_id <> ${familyId}
      and (
        candidate.artifact_family_id = ${familyId}
        or exists (
          select 1
          from public.family_artifact_prefixes prefix
          where prefix.owner_family_id = ${familyId}
            and prefix.artifact_family_id = candidate.artifact_family_id
        )
      )
  `;
  if (unresolved.length > 0) {
    throw new Error(
      "Account deletion could not prove every historical artifact prefix.",
    );
  }
  await tx`
    delete from public.family_artifact_prefix_candidates
    where owner_family_id = ${familyId}
  `;
}

async function eraseFamilyRecordsInTransaction(
  tx: TransactionSql,
  familyId: string,
): Promise<string[]> {
  const memberRows = await tx<Array<{ user_id: string }>>`
    select target.user_id
    from public.family_members target
    join auth.users auth_user on auth_user.id = target.user_id
    where target.family_id = ${familyId}
    order by target.user_id
    for update of target, auth_user
  `;
  await tx`
    delete from public.phone_leads lead
    where exists (
      select 1
      from public.family_phones phone
      where phone.family_id = ${familyId}
        and phone.phone_e164 = lead.phone_e164
    )
  `;
  await tx`
    delete from public.admin_alert_acknowledgments acknowledgment
    using public.email_sends email_send
    where acknowledgment.source = 'email_send'
      and acknowledgment.source_id = email_send.id
      and email_send.family_id = ${familyId}
  `;
  await tx`delete from public.email_sends where family_id = ${familyId}`;
  await tx`delete from public.model_usage where family_id = ${familyId}`;
  await tx`delete from public.conversation_signals where family_id = ${familyId}`;
  await tx`delete from public.knowledge_gaps where family_id = ${familyId}`;
  await tx`delete from public.response_engagement where family_id = ${familyId}`;
  await tx`delete from public.families where id = ${familyId}`;
  const storageUserIds: string[] = [];
  for (const member of memberRows) {
    const orphanedUsers = await tx<Array<{ id: string }>>`
      select user_row.id
      from auth.users user_row
      where user_row.id = ${member.user_id}
        and not exists (
          select 1
          from public.family_members remaining_member
          where remaining_member.user_id = user_row.id
        )
    `;
    if (orphanedUsers[0]) {
      // Supabase refuses to delete an Auth user while that user owns a
      // Storage object. Revoke refreshable sessions now, retain the identity
      // only until the first successful avatar sweep, then delete it through
      // the supported Auth Admin API.
      await tx`delete from auth.sessions where user_id = ${member.user_id}`;
      storageUserIds.push(member.user_id);
    }
  }
  return storageUserIds;
}

interface PreparedDeletionJob {
  jobId: string;
  shouldRun: boolean;
}

interface LockedDeletionFamily {
  id: string;
  name: string;
  created_at_ms: string | number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  apple_original_transaction_id: string | null;
  apple_subscription_status: string | null;
  apple_purchase_pending: boolean;
}

type LockedDeletionFamilyRow = Omit<
  LockedDeletionFamily,
  "apple_purchase_pending"
>;

async function lockDeletionFamily(
  tx: TransactionSql,
  familyId: string,
  recoveryJobId?: string,
): Promise<LockedDeletionFamily | null> {
  const familyRows = await tx<LockedDeletionFamilyRow[]>`
    select family.id, family.name,
           extract(epoch from family.created_at) * 1000 as created_at_ms,
           family.stripe_customer_id, family.stripe_subscription_id,
           family.apple_original_transaction_id,
           family.apple_subscription_status
    from public.families family
    where family.id = ${familyId}
      and (
        family.status <> 'deleted'
        or exists (
          select 1
          from public.account_deletion_jobs recovery_job
          join public.account_deletion_artifact_tombstones tombstone
            on tombstone.deletion_job_id = recovery_job.id
           and tombstone.family_id = family.id
          where recovery_job.id = ${recoveryJobId ?? null}
            and recovery_job.family_id = family.id
            and recovery_job.status <> 'complete'
        )
      )
    for update
  `;
  const family = familyRows[0];
  if (!family) return null;
  const pendingRows = await tx<Array<{ pending: boolean }>>`
    select exists (
      select 1
      from public.apple_purchase_interlocks interlock
      where interlock.family_id = ${familyId}
        and interlock.state in ('prepared', 'store_started', 'cancel_pending')
    ) as pending
  `;
  return {
    ...family,
    apple_purchase_pending: pendingRows[0]?.pending ?? false,
  };
}

function rejectedDeletion(message: string): AccountDeletionResult {
  return { state: "rejected", message, accessClosed: false };
}

function blockedDeletion(
  provider: "apple" | "google",
  deletionReceipt?: string,
): AccountDeletionResult {
  const providerName = provider === "apple" ? "App Store" : "Google Play";
  return {
    state: "blocked",
    message: `${providerName} controls this subscription. Cancel it there first. Homa can begin deletion after the subscription ends.`,
    accessClosed: false,
    ...(deletionReceipt ? { deletionReceipt } : {}),
  };
}

function durablyBlockedDeletion(jobId: string): AccountDeletionResult {
  return {
    state: "blocked",
    message: "An App Store or Google Play subscription is still active. Cancel it in the store first. Homa can begin deletion after the subscription ends.",
    accessClosed: false,
    deletionReceipt: jobId,
  };
}

function pendingApplePurchaseDeletion(
  deletionReceipt?: string,
): AccountDeletionResult {
  return {
    state: "blocked",
    message: "Return to Homa on the device where you started the App Store purchase. Finish or cancel it, then try deleting your Homa account again.",
    accessClosed: false,
    ...(deletionReceipt ? { deletionReceipt } : {}),
  };
}

function preparingDeletion(jobId: string): AccountDeletionResult {
  return {
    state: "in_progress",
    message: "Homa is confirming billing before closing access. Homa will keep trying. You do not need to do anything.",
    accessClosed: false,
    deletionReceipt: jobId,
  };
}

function acceptedDeletion(jobId: string): AccountDeletionResult {
  return {
    state: "in_progress",
    message: "Your access to this family is closed. Homa is finishing permanent deletion. You do not need to do anything.",
    accessClosed: true,
    deletionReceipt: jobId,
  };
}

function familySubscriptionsWithCompatibility(
  family: Pick<
    LockedDeletionFamily,
    | "apple_original_transaction_id"
    | "apple_subscription_status"
    | "apple_purchase_pending"
  >,
  subscriptions: readonly DeletionSubscription[],
): DeletionSubscription[] {
  const compatible = [...subscriptions];
  if (family.apple_original_transaction_id) {
    compatible.push({
      provider: "apple",
      provider_subscription_id: family.apple_original_transaction_id,
      status: family.apple_subscription_status ?? "unknown",
    });
  }
  if (family.apple_purchase_pending) {
    compatible.push({
      provider: "apple",
      provider_subscription_id: "purchase-in-progress",
      status: "purchase_in_progress",
    });
  }
  return compatible;
}

/**
 * Commits the retry record and checkout/artifact fence before Stripe can be
 * mutated. Billing preparation may retry while family records and sessions
 * remain available; only a later locked acceptance transaction erases access.
 */
export async function requestAccountDeletion(input: {
  familyId: string;
  userId: string;
  confirmation: unknown;
}, dependencies: AccountDeletionRequestDependencies = DEFAULT_ACCOUNT_DELETION_REQUEST_DEPENDENCIES): Promise<AccountDeletionResult> {
  if (
    !dependencies.supabaseCleanupConfigured()
    || !dependencies.artifactCleanupConfigured()
  ) {
    return rejectedDeletion(
      "Homa could not safely start permanent deletion. Nothing was deleted. Try again in a moment.",
    );
  }

  const sql = mapDb();
  let prepared: PreparedDeletionJob | AccountDeletionResult;
  try {
    prepared = await sql.begin(async (tx) => {
      const family = await lockDeletionFamily(tx, input.familyId);
      if (!family) {
        return rejectedDeletion("This family is no longer available.");
      }

      const primaryUsers = await tx<Array<{ user_id: string }>>`
        select user_id
        from public.family_members
        where family_id = ${input.familyId}
        order by created_at, user_id
        limit 1
        for update
      `;
      if (primaryUsers[0]?.user_id !== input.userId) {
        return rejectedDeletion(
          "Only the parent who opened this family can permanently delete its shared record.",
        );
      }
      if (!hasExactDeletionConfirmation(family.name, input.confirmation)) {
        return rejectedDeletion(
          `Type exactly “${deletionConfirmationFor(family.name)}” to continue.`,
        );
      }

      const subscriptions = await tx<DeletionSubscription[]>`
        select provider, provider_subscription_id, provider_customer_id, status
        from public.family_billing_subscriptions
        where family_id = ${input.familyId}
        order by provider, provider_subscription_id
        for update
      `;
      const billing = deletionBillingDecision(
        familySubscriptionsWithCompatibility(family, subscriptions),
      );
      const existingJobs = await tx<DeletionJobRow[]>`
        select id, family_id, requested_by_user_id, storage_user_ids,
               final_cleanup_after, artifact_count,
               final_cleanup_after <= now() as can_finalize, status, attempts
        from public.account_deletion_jobs
        where family_id = ${input.familyId}
          and status <> 'complete'
        order by requested_at desc
        limit 1
        for update
      `;
      const existingJob = existingJobs[0];

      if (billing.blockedProvider) {
        if (existingJob && existingJob.status !== "running") {
          await tx`
            update public.account_deletion_jobs
            set status = 'blocked', updated_at = now(), last_error = null
            where id = ${existingJob.id}
              and status <> 'running'
          `;
        }
        return family.apple_purchase_pending
          ? pendingApplePurchaseDeletion(existingJob?.id)
          : blockedDeletion(billing.blockedProvider, existingJob?.id);
      }

      if (existingJob) {
        await snapshotFamilyArtifactPrefixes(tx, existingJob.id, input.familyId);
        if (existingJob.status === "blocked") {
          const resumed = await tx<Array<{ id: string }>>`
            update public.account_deletion_jobs
            set status = 'preparing', updated_at = now(), last_error = null
            where id = ${existingJob.id}
              and status = 'blocked'
            returning id
          `;
          return { jobId: existingJob.id, shouldRun: Boolean(resumed[0]) };
        }
        if (
          existingJob.status === "waiting_for_artifacts"
          || existingJob.status === "retryable_failed"
        ) {
          await tx`
            update public.account_deletion_jobs
            set status = 'preparing', updated_at = now(), last_error = null
            where id = ${existingJob.id}
              and status in ('waiting_for_artifacts', 'retryable_failed')
          `;
          return { jobId: existingJob.id, shouldRun: true };
        }
        return {
          jobId: existingJob.id,
          shouldRun: existingJob.status === "preparing",
        };
      }

      const familyCreatedAtMs = Number(family.created_at_ms);
      if (!Number.isFinite(familyCreatedAtMs)) {
        return rejectedDeletion(
          "Homa could not verify when this family opened, so nothing was deleted. Try again in a moment.",
        );
      }

      const jobs = await tx<Array<{ id: string }>>`
        insert into public.account_deletion_jobs
          (family_id, requested_by_user_id, status)
        values (${input.familyId}, ${input.userId}, 'preparing')
        on conflict do nothing
        returning id
      `;
      let jobId = jobs[0]?.id;
      if (!jobId) {
        const concurrent = await tx<Array<{ id: string }>>`
          select id
          from public.account_deletion_jobs
          where family_id = ${input.familyId}
            and status <> 'complete'
          order by requested_at desc
          limit 1
          for update
        `;
        jobId = concurrent[0]?.id;
      }
      if (!jobId) {
        throw new Error("Account deletion could not create its recovery job.");
      }
      await snapshotFamilyArtifactPrefixes(tx, jobId, input.familyId);
      return { jobId, shouldRun: true };
    });
    // Production does no work here. The optional adapter fault-injects a lost
    // acknowledgment after the preparation transaction has already committed.
    await dependencies.acknowledgePreparationCommit?.();
  } catch (error) {
    console.error(
      "account deletion preparation could not start:",
      error instanceof Error ? error.message : "unknown error",
    );
    const recovered = await durableResultAfterRequestPreparationError(
      input.familyId,
      input.userId,
    );
    if (recovered) return recovered;
    return rejectedDeletion(
      "Homa could not safely start permanent deletion. Nothing was deleted. Try again in a moment.",
    );
  }

  if ("state" in prepared) return prepared;
  if (!prepared.shouldRun) return preparingDeletion(prepared.jobId);
  try {
    return await runAccountDeletionJob(
      prepared.jobId,
      jobDependenciesForRequest(dependencies),
    );
  } catch (error) {
    console.error(
      `account deletion job ${prepared.jobId} could not return its current state:`,
      error instanceof Error ? error.message : "unknown error",
    );
    return await durableResultAfterPreparationError(prepared.jobId);
  }
}

async function deletePrivateLessonBlobs(familyId: string): Promise<number> {
  if (!lessonBlobConfigured()) {
    throw new Error("The private lesson artifact store is not configured, so Homa cannot verify permanent deletion.");
  }
  const tokens = [
    process.env.HOMA_LESSON_READ_WRITE_TOKEN?.trim(),
    familyBlobToken(),
  ].filter((token, index, all): token is string =>
    Boolean(token) && all.indexOf(token) === index,
  );
  let deleted = 0;
  for (const token of tokens) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: `families/${familyId}/`, cursor, token });
      if (page.blobs.length > 0) {
        await del(page.blobs.map((blob) => blob.url), { token });
        deleted += page.blobs.length;
      }
      cursor = page.cursor;
    } while (cursor);
  }
  return deleted;
}

interface StripePreparationContext {
  familyId: string;
  familyCreatedAt: Date;
  knownCustomerIds: string[];
  knownSubscriptionIds: string[];
}

type StripePreparationSnapshot =
  | { kind: "blocked"; result: AccountDeletionResult }
  | { kind: "ready"; context: StripePreparationContext };

async function loadStripePreparationSnapshot(
  job: DeletionJobRow,
  leaseAttempt: number,
): Promise<StripePreparationSnapshot> {
  if (!job.family_id) throw new AccountDeletionLeaseLostError();
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    const family = await lockDeletionFamily(tx, job.family_id!, job.id);
    if (!family) throw new AccountDeletionLeaseLostError();

    const subscriptions = await tx<DeletionSubscription[]>`
      select provider, provider_subscription_id, provider_customer_id, status
      from public.family_billing_subscriptions
      where family_id = ${job.family_id}
      order by provider, provider_subscription_id
      for update
    `;
    const leasedJobs = await tx<Array<{ id: string }>>`
      select id
      from public.account_deletion_jobs
      where id = ${job.id}
        and status = 'running'
        and attempts = ${leaseAttempt}
      for update
    `;
    if (!leasedJobs[0]) throw new AccountDeletionLeaseLostError();

    const billing = deletionBillingDecision(
      familySubscriptionsWithCompatibility(family, subscriptions),
    );
    if (billing.blockedProvider) {
      const blocked = await tx<Array<{ id: string }>>`
        update public.account_deletion_jobs
        set status = 'blocked', updated_at = now(), last_error = null
        where id = ${job.id}
          and status = 'running'
          and attempts = ${leaseAttempt}
        returning id
      `;
      if (!blocked[0]) throw new AccountDeletionLeaseLostError();
      return {
        kind: "blocked",
        result: family.apple_purchase_pending
          ? pendingApplePurchaseDeletion(job.id)
          : blockedDeletion(billing.blockedProvider, job.id),
      };
    }

    const familyCreatedAtMs = Number(family.created_at_ms);
    if (!Number.isFinite(familyCreatedAtMs)) {
      throw new Error("The family creation time could not be verified.");
    }
    return {
      kind: "ready",
      context: {
        familyId: family.id,
        familyCreatedAt: new Date(familyCreatedAtMs),
        knownCustomerIds: [
          family.stripe_customer_id,
          ...subscriptions
            .filter((subscription) => subscription.provider === "stripe")
            .map((subscription) => subscription.provider_customer_id ?? null),
        ].filter((value): value is string => Boolean(value)),
        knownSubscriptionIds: [
          family.stripe_subscription_id,
          ...subscriptions
            .filter((subscription) => subscription.provider === "stripe")
            .map((subscription) => subscription.provider_subscription_id),
        ].filter((value): value is string => Boolean(value)),
      },
    };
  });
}

async function acceptPreparedDeletion(
  job: DeletionJobRow,
  leaseAttempt: number,
  stripe: StripeAccountDeletionReconciliationResult,
  acknowledgeAcceptance?: (
    result: AccountDeletionResult,
  ) => Promise<AccountDeletionResult>,
): Promise<AccountDeletionResult> {
  if (!job.family_id) throw new AccountDeletionLeaseLostError();
  const familyId = job.family_id;
  const sql = mapDb();
  const result = await sql.begin(async (tx) => {
    const family = await lockDeletionFamily(tx, familyId, job.id);
    if (!family) throw new AccountDeletionLeaseLostError();

    const subscriptions = await tx<DeletionSubscription[]>`
      select provider, provider_subscription_id, provider_customer_id, status
      from public.family_billing_subscriptions
      where family_id = ${familyId}
      order by provider, provider_subscription_id
      for update
    `;
    const leasedJobs = await tx<Array<{ id: string }>>`
      select id
      from public.account_deletion_jobs
      where id = ${job.id}
        and family_id = ${familyId}
        and status = 'running'
        and attempts = ${leaseAttempt}
      for update
    `;
    if (!leasedJobs[0]) throw new AccountDeletionLeaseLostError();

    const billing = deletionBillingDecision(
      familySubscriptionsWithCompatibility(family, subscriptions),
    );
    if (billing.blockedProvider) {
      const blocked = await tx<Array<{ id: string }>>`
        update public.account_deletion_jobs
        set status = 'blocked', updated_at = now(), last_error = null
        where id = ${job.id}
          and status = 'running'
          and attempts = ${leaseAttempt}
        returning id
      `;
      if (!blocked[0]) throw new AccountDeletionLeaseLostError();
      return family.apple_purchase_pending
        ? pendingApplePurchaseDeletion(job.id)
        : blockedDeletion(billing.blockedProvider, job.id);
    }

    await snapshotFamilyArtifactPrefixes(tx, job.id, familyId);
    await retireResolvedArtifactCandidates(tx, job.id, familyId);
    await tx`
      select set_config('homa.family_delete_mode', 'account-deletion-v2', true)
    `;
    await tx`
      update public.families
      set status = 'deleted', updated_at = now()
      where id = ${familyId}
    `;
    await tx`delete from public.agent_schedules where family_id = ${familyId}`;
    const storageUserIds = await eraseFamilyRecordsInTransaction(tx, familyId);
    const accepted = await tx<Array<{ id: string }>>`
      update public.account_deletion_jobs
      set requested_by_user_id = null,
          storage_user_ids = ${tx.array(storageUserIds)}::uuid[],
          status = 'waiting_for_artifacts',
          provider_summary = ${tx.json({
            stripe: {
              expiredCheckoutSessions: stripe.expiredCheckoutSessionCount,
              inspectedCustomers: stripe.inspectedCustomerCount,
              inspectedSubscriptions: stripe.inspectedSubscriptionCount,
              canceledSubscriptions: stripe.canceledSubscriptionCount,
              alreadyTerminalSubscriptions: stripe.alreadyTerminalSubscriptionCount,
            },
          })},
          final_cleanup_after = now() + interval '6 hours 30 minutes',
          artifact_quiet_since = null,
          updated_at = now(),
          last_error = null
      where id = ${job.id}
        and status = 'running'
        and attempts = ${leaseAttempt}
      returning id
    `;
    if (!accepted[0]) throw new AccountDeletionLeaseLostError();
    return acceptedDeletion(job.id);
  });
  // Production performs no provider or database work after this commit. The
  // optional adapter lets the Postgres lifecycle test fault-inject a lost
  // commit acknowledgment before the response is returned.
  return acknowledgeAcceptance
    ? await acknowledgeAcceptance(result)
    : result;
}

async function returnPreparationToRetry(
  job: DeletionJobRow,
  leaseAttempt: number,
  error: unknown,
): Promise<void> {
  if (error instanceof AccountDeletionLeaseLostError) return;
  const safeError = error instanceof StripeAccountDeletionUncertainError
    ? `stripe:${error.reason}`
    : "preparation_failed";
  try {
    const sql = mapDb();
    await sql`
      update public.account_deletion_jobs
      set status = 'preparing', last_error = ${safeError}, updated_at = now()
      where id = ${job.id}
        and status = 'running'
        and attempts = ${leaseAttempt}
    `;
  } catch (statusError) {
    console.error(
      `account deletion job ${job.id} could not record its retry state:`,
      statusError instanceof Error ? statusError.message : "unknown error",
    );
  }
}

async function durableResultAfterPreparationError(
  jobId: string,
): Promise<AccountDeletionResult> {
  try {
    const sql = mapDb();
    const rows = await sql<
      Array<{
        family_id: string | null;
        status: AccountDeletionStatus;
        family_exists: boolean;
        apple_purchase_pending: boolean;
        blocked_provider: "apple" | "google" | null;
      }>
    >`
      select job.family_id, job.status,
             exists (
               select 1
               from public.families family
               where family.id = job.family_id
             ) as family_exists,
             exists (
               select 1
               from public.apple_purchase_interlocks interlock
               where interlock.family_id = job.family_id
                 and interlock.state in (
                   'prepared', 'store_started', 'cancel_pending'
                 )
             ) as apple_purchase_pending,
             case
               when exists (
                 select 1
                 from public.family_billing_subscriptions subscription
                 where subscription.family_id = job.family_id
                   and subscription.provider = 'apple'
                   and subscription.status not in (
                     'canceled', 'unpaid', 'incomplete_expired', 'paused'
                   )
               ) or exists (
                 select 1
                 from public.families family
                 where family.id = job.family_id
                   and family.apple_original_transaction_id is not null
                   and coalesce(family.apple_subscription_status, 'unknown')
                     not in ('canceled', 'unpaid', 'incomplete_expired', 'paused')
               ) or exists (
                 select 1
                 from public.apple_purchase_interlocks interlock
                 where interlock.family_id = job.family_id
                   and interlock.state in (
                     'prepared', 'store_started', 'cancel_pending'
                   )
               ) then 'apple'
               when exists (
                 select 1
                 from public.family_billing_subscriptions subscription
                 where subscription.family_id = job.family_id
                   and subscription.provider = 'google'
                   and subscription.status not in (
                     'canceled', 'unpaid', 'incomplete_expired', 'paused'
                   )
               ) then 'google'
               else null
             end as blocked_provider
      from public.account_deletion_jobs job
      where job.id = ${jobId}
    `;
    const durable = rows[0];
    if (!durable) return preparingDeletion(jobId);
    if (durable.family_id === null || !durable.family_exists) {
      if (durable.status === "complete") {
        return {
          state: "complete",
          message: "This family's Homa data has been permanently deleted.",
          accessClosed: true,
          deletionReceipt: jobId,
        };
      }
      return acceptedDeletion(jobId);
    }
    if (durable.apple_purchase_pending) {
      return pendingApplePurchaseDeletion(jobId);
    }
    if (durable.blocked_provider) {
      return blockedDeletion(durable.blocked_provider, jobId);
    }
    if (durable.status === "blocked") {
      return durablyBlockedDeletion(jobId);
    }
    return preparingDeletion(jobId);
  } catch (error) {
    console.error(
      `account deletion job ${jobId} could not read its durable state:`,
      error instanceof Error ? error.message : "unknown error",
    );
    return preparingDeletion(jobId);
  }
}

async function durableResultAfterRequestPreparationError(
  familyId: string,
  userId: string,
): Promise<AccountDeletionResult | null> {
  try {
    const sql = mapDb();
    const rows = await sql<Array<{ id: string }>>`
      select job.id
      from public.account_deletion_jobs job
      left join public.account_deletion_artifact_tombstones tombstone
        on tombstone.deletion_job_id = job.id
      where (
          job.family_id = ${familyId}
          or tombstone.family_id = ${familyId}
        )
        and (
          job.requested_by_user_id = ${userId}
          or job.requested_by_user_id is null
        )
      order by job.requested_at desc, job.id
      limit 1
    `;
    return rows[0]
      ? await durableResultAfterPreparationError(rows[0].id)
      : null;
  } catch (error) {
    console.error(
      "account deletion could not recover its preparation receipt:",
      error instanceof Error ? error.message : "unknown error",
    );
    return null;
  }
}

async function eraseFamilyRecordsForJob(
  jobId: string,
  familyId: string,
  leaseAttempt: number,
): Promise<string[]> {
  const sql = mapDb();
  return await sql.begin(async (tx) => {
    const rows = await tx<Array<{ storage_user_ids: string[] | null }>>`
      select storage_user_ids
      from public.account_deletion_jobs
      where id = ${jobId}
        and status = 'running'
        and attempts = ${leaseAttempt}
      for update
    `;
    if (!rows[0]) {
      throw new AccountDeletionLeaseLostError();
    }
    const artifactPrefixes = await tx<Array<{ family_id: string }>>`
      select family_id
      from public.account_deletion_artifact_tombstones
      where deletion_job_id = ${jobId}
        and family_id = ${familyId}
    `;
    if (!artifactPrefixes[0]) {
      throw new Error("Account deletion lost its primary artifact prefix.");
    }
    const erasedUserIds = await eraseFamilyRecordsInTransaction(tx, familyId);
    const storageUserIds = rows[0].storage_user_ids ?? erasedUserIds;
    const updated = await tx<Array<{ id: string }>>`
      update public.account_deletion_jobs
      set requested_by_user_id = null,
          storage_user_ids = ${tx.array(storageUserIds)}::uuid[],
          updated_at = now()
      where id = ${jobId}
        and status = 'running'
        and attempts = ${leaseAttempt}
      returning id
    `;
    if (!updated[0]) {
      throw new AccountDeletionLeaseLostError();
    }
    return storageUserIds;
  });
}

class AccountDeletionLeaseLostError extends Error {
  constructor() {
    super("A newer deletion worker owns this job.");
    this.name = "AccountDeletionLeaseLostError";
  }
}

async function deletionAlreadyInProgress(
  jobId: string,
): Promise<AccountDeletionResult> {
  return await durableResultAfterPreparationError(jobId);
}

/** Runs one idempotent attempt across both durable phases. A family row means
 * billing is still preparing; an absent family row means artifact cleanup owns
 * the attempt. Every write after claim is fenced by the incremented attempt. */
export async function runAccountDeletionJob(
  jobId: string,
  providedDependencies:
    | AccountDeletionWorkerDependencies
    | AccountDeletionJobDependencies = DEFAULT_ACCOUNT_DELETION_JOB_DEPENDENCIES,
): Promise<AccountDeletionResult> {
  const dependencies: AccountDeletionJobDependencies = {
    ...DEFAULT_ACCOUNT_DELETION_JOB_DEPENDENCIES,
    ...providedDependencies,
  };
  const sql = mapDb();
  const jobs = await sql<DeletionJobRow[]>`
    with claimed as (
      update public.account_deletion_jobs
      set status = 'running', attempts = attempts + 1,
          started_at = coalesce(started_at, now()),
          updated_at = now(), last_error = null
      where id = ${jobId}
        and (
          status in ('preparing', 'waiting_for_artifacts', 'retryable_failed')
          or (status = 'running' and updated_at < now() - interval '15 minutes')
        )
      returning id, family_id, requested_by_user_id, storage_user_ids,
                final_cleanup_after, artifact_count, status, attempts
    )
    select claimed.*,
           claimed.final_cleanup_after <= now() as can_finalize,
           exists (
             select 1 from public.families family
             where family.id = claimed.family_id
           ) as family_exists
    from claimed
  `;
  const job = jobs[0];
  if (!job) {
    return await deletionAlreadyInProgress(jobId);
  }
  const leaseAttempt = job.attempts;
  if (!job.family_id) {
    const completed = await sql<Array<{ id: string }>>`
      update public.account_deletion_jobs
      set requested_by_user_id = null, storage_user_ids = null,
          status = 'complete', completed_at = coalesce(completed_at, now()),
          updated_at = now()
      where id = ${job.id}
        and status = 'running'
        and attempts = ${leaseAttempt}
      returning id
    `;
    if (!completed[0]) return await deletionAlreadyInProgress(job.id);
    return {
      state: "complete",
      message: "This family's Homa data has been permanently deleted.",
      accessClosed: true,
      deletionReceipt: job.id,
    };
  }

  if (job.family_exists) {
    try {
      if (
        !dependencies.supabaseCleanupConfigured()
        || !dependencies.artifactCleanupConfigured()
      ) {
        throw new Error("Required cleanup providers are not configured.");
      }
      const snapshot = await loadStripePreparationSnapshot(job, leaseAttempt);
      if (snapshot.kind === "blocked") return snapshot.result;
      const stripe = await dependencies.reconcileStripe(snapshot.context);
      return await acceptPreparedDeletion(
        job,
        leaseAttempt,
        stripe,
        dependencies.acknowledgeAcceptance,
      );
    } catch (error) {
      await returnPreparationToRetry(job, leaseAttempt, error);
      if (!(error instanceof AccountDeletionLeaseLostError)) {
        console.error(
          `account deletion job ${job.id} could not confirm billing:`,
          error instanceof StripeAccountDeletionUncertainError
            ? error.reason
            : error instanceof Error
              ? error.message
              : "unknown error",
        );
      }
      return await durableResultAfterPreparationError(job.id);
    }
  }

  try {
    const cleanup = await runAccountDeletionCleanup({
      finalize: job.can_finalize,
      eraseDatabaseRecords: async () => eraseFamilyRecordsForJob(
        job.id,
        job.family_id!,
        leaseAttempt,
      ),
      deleteArtifacts: async (storageUserIds) => {
        // Supabase Auth hard deletion must follow Storage deletion. Do it on
        // the first successful avatar sweep, not after the longer Vercel Blob
        // token drain. The durable membership trigger prevents a stale JWT
        // from reattaching one of these identities during this boundary.
        const avatarCount = await dependencies.deleteAvatars(storageUserIds);
        const authUserCount = await dependencies.deleteAuthUsers(storageUserIds);
        const artifactPrefixes = await sql<Array<{ family_id: string }>>`
          select family_id
          from public.account_deletion_artifact_tombstones
          where deletion_job_id = ${job.id}
          order by family_id
        `;
        if (artifactPrefixes.length === 0) {
          throw new Error("Account deletion has no artifact cleanup prefixes.");
        }
        const blobCounts: number[] = [];
        for (const prefix of artifactPrefixes) {
          const [publicCount, privateCount] = await Promise.all([
            dependencies.deletePublicFamilyBlobs(prefix.family_id),
            dependencies.deletePrivateFamilyBlobs(prefix.family_id),
          ]);
          blobCounts.push(publicCount, privateCount);
        }
        return [...blobCounts, avatarCount, authUserCount];
      },
    });
    if (cleanup.state === "draining") {
      const updated = await sql<Array<{ id: string }>>`
        update public.account_deletion_jobs
        set status = 'waiting_for_artifacts',
            artifact_count = coalesce(artifact_count, 0) + ${cleanup.artifactCount},
            artifact_quiet_since = null,
            updated_at = now()
        where id = ${job.id}
          and status = 'running'
          and attempts = ${leaseAttempt}
        returning id
      `;
      if (!updated[0]) return await deletionAlreadyInProgress(job.id);
      return {
        state: "in_progress",
        message: "Your access to this family is closed. Homa is finishing permanent deletion. You do not need to do anything.",
        accessClosed: true,
        deletionReceipt: job.id,
      };
    }
    if (cleanup.artifactCount === 0) {
      const completed = await sql<Array<{ id: string }>>`
        update public.account_deletion_jobs
        set family_id = null, requested_by_user_id = null, storage_user_ids = null,
            status = 'complete', completed_at = now(), updated_at = now()
        where id = ${job.id}
          and status = 'running'
          and attempts = ${leaseAttempt}
          and artifact_quiet_since <= now() - interval '2 minutes'
        returning id
      `;
      if (completed[0]) {
        return {
          state: "complete",
          message: "This family's Homa data has been permanently deleted.",
          accessClosed: true,
          deletionReceipt: job.id,
        };
      }
    }
    const updated = await sql<Array<{ id: string }>>`
      update public.account_deletion_jobs
      set status = 'waiting_for_artifacts',
          artifact_count = coalesce(artifact_count, 0) + ${cleanup.artifactCount},
          artifact_quiet_since = case
            when ${cleanup.artifactCount} > 0 then now()
            else coalesce(artifact_quiet_since, now())
          end,
          updated_at = now()
      where id = ${job.id}
        and status = 'running'
        and attempts = ${leaseAttempt}
      returning id
    `;
    if (!updated[0]) return await deletionAlreadyInProgress(job.id);
    return {
      state: "in_progress",
      message: "Your access to this family is closed. Permanent deletion is still in progress. You do not need to do anything.",
      accessClosed: true,
      deletionReceipt: job.id,
    };
  } catch (error) {
    const failure = retryableDeletionFailure(error);
    await sql`
      update public.account_deletion_jobs
      set status = ${failure.status}, last_error = ${failure.message.slice(0, 500)}, updated_at = now()
      where id = ${job.id}
        and status = 'running'
        and attempts = ${leaseAttempt}
    `;
    if (!(error instanceof AccountDeletionLeaseLostError)) {
      console.error(`account deletion job ${job.id} did not finish:`, failure.message);
    }
    return {
      state: "in_progress",
      message: "Your access to this family is closed. Permanent deletion is still in progress. Homa will keep trying. You do not need to do anything.",
      accessClosed: true,
      deletionReceipt: job.id,
    };
  }
}

/** The schedule is a reliability floor. It never runs a blocked native-billing
 * request, and the job itself is idempotent if the process is retried. */
export async function retryPendingAccountDeletions(limit = 20): Promise<void> {
  const sql = mapDb();
  const jobs = await sql<Array<{ id: string }>>`
    select id from public.account_deletion_jobs
    where status in ('preparing', 'waiting_for_artifacts', 'retryable_failed')
       or (status = 'running' and updated_at < now() - interval '15 minutes')
    order by updated_at, requested_at, id
    limit ${limit}
  `;
  for (const job of jobs) await runAccountDeletionJob(job.id);
  await sweepCompletedDeletionTombstones(limit);
}

/**
 * A permanent tombstone is the backstop for a direct upload or abandoned
 * agent operation that finishes after the deletion job itself completed.
 * Sweep frequently for the first day, then daily. The marker contains only
 * the random former family UUID and never restores product access.
 */
export async function sweepCompletedDeletionTombstones(
  limit = 20,
  worker: Pick<
    AccountDeletionWorkerDependencies,
    "deletePublicFamilyBlobs" | "deletePrivateFamilyBlobs"
  > = DEFAULT_ACCOUNT_DELETION_WORKER_DEPENDENCIES,
): Promise<void> {
  const sql = mapDb();
  const rows = await sql<Array<{ family_id: string }>>`
    select tombstone.family_id
    from public.account_deletion_artifact_tombstones tombstone
    join public.account_deletion_jobs job on job.id = tombstone.deletion_job_id
    where job.status = 'complete'
      and (
        tombstone.last_swept_at is null
        or (
          tombstone.created_at > now() - interval '1 day'
          and tombstone.last_swept_at < now() - interval '5 minutes'
        )
        or (
          tombstone.created_at <= now() - interval '1 day'
          and tombstone.last_swept_at < now() - interval '1 day'
        )
      )
    order by tombstone.last_swept_at asc nulls first, tombstone.created_at
    limit ${limit}
  `;
  for (const row of rows) {
    try {
      await Promise.all([
        worker.deletePublicFamilyBlobs(row.family_id),
        worker.deletePrivateFamilyBlobs(row.family_id),
      ]);
      await sql`
        update public.account_deletion_artifact_tombstones
        set last_swept_at = now()
        where family_id = ${row.family_id}
      `;
    } catch (error) {
      console.error(
        "account deletion tombstone sweep did not finish:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }
}
