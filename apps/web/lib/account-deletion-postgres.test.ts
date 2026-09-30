import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import postgres from "postgres";

import {
  deletionConfirmationFor,
  requestAccountDeletion,
  runAccountDeletionJob,
  sweepCompletedDeletionTombstones,
  type AccountDeletionJobDependencies,
  type AccountDeletionWorkerDependencies,
} from "./account-deletion";
import {
  AppleFamilyUnavailableError,
  recordFamilyAppleSubscription,
  recordVerifiedFamilyAppleSubscriptionStatus,
} from "./billing/wall";
import {
  activeApplePurchaseInterlock,
  abandonApplePurchaseInterlock,
  ApplePurchaseAlreadyPendingError,
  ApplePurchaseInterlockUnavailableError,
  beginApplePurchaseInterlock,
  markApplePurchaseInterlockPhase,
  requestApplePurchaseInterlockCancellation,
} from "./billing/apple-purchase-interlock";
import { EVAL_ISOLATION_FLAG } from "./eval-isolation";
import {
  classifyFamilyFoldArtifactSchema,
  foldFamilyDataIntoTx,
  foldStubFamilyIntoTx,
} from "./family-fold";
import { mapDb } from "./map/db";
import { resolveEvalBlobStore } from "./materials/eval-blob-store";

const databaseUrl = process.env.HOMA_EVAL_DATABASE_URL;

after(async () => {
  if (databaseUrl) await mapDb().end({ timeout: 5 });
});

interface FixtureCounts {
  families: number;
  memberships: number;
  children: number;
  users: number;
}

const NOOP_STRIPE_RECONCILIATION = {
  supabaseCleanupConfigured: () => true,
  artifactCleanupConfigured: () => true,
  reconcileStripe: async () => ({
    expiredCheckoutSessionCount: 0,
    inspectedCustomerCount: 0,
    inspectedSubscriptionCount: 0,
    canceledSubscriptionCount: 0,
    alreadyTerminalSubscriptionCount: 0,
  }),
};

const NOOP_ARTIFACT_WORKER: AccountDeletionWorkerDependencies = {
  deleteAvatars: async () => 0,
  deleteAuthUsers: async () => 0,
  deletePublicFamilyBlobs: async () => 0,
  deletePrivateFamilyBlobs: async () => 0,
};

const NOOP_DELETION_JOB: AccountDeletionJobDependencies = {
  ...NOOP_STRIPE_RECONCILIATION,
  ...NOOP_ARTIFACT_WORKER,
};

test("family fold distinguishes old, partial, and ready deletion schemas", () => {
  assert.equal(classifyFamilyFoldArtifactSchema({
    hard_delete_guard_present: false,
    tombstones_present: false,
    prefixes_present: false,
    candidates_present: false,
  }), "legacy");
  assert.equal(classifyFamilyFoldArtifactSchema({
    hard_delete_guard_present: true,
    tombstones_present: true,
    prefixes_present: true,
    candidates_present: true,
  }), "ready");
  assert.equal(classifyFamilyFoldArtifactSchema({
    hard_delete_guard_present: true,
    tombstones_present: false,
    prefixes_present: false,
    candidates_present: false,
  }), "partial");
  assert.equal(classifyFamilyFoldArtifactSchema({
    hard_delete_guard_present: false,
    tombstones_present: true,
    prefixes_present: false,
    candidates_present: false,
  }), "partial");
});

test(
  "family fold keeps an untouched legacy schema operational",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 1 });
    const sourceFamilyId = randomUUID();
    const destinationFamilyId = randomUUID();
    const rollback = new Error("roll back legacy schema fixture");

    try {
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`
            drop trigger families_hard_delete_protocol_guard
            on public.families
          `;
          await tx`
            drop table
              public.family_artifact_prefix_candidates,
              public.family_artifact_prefixes,
              public.account_deletion_artifact_tombstones
            cascade
          `;
          await tx`
            insert into public.families (id, name, email)
            values
              (${sourceFamilyId}, 'Legacy fold source', null),
              (${destinationFamilyId}, 'Legacy fold destination', 'legacy@example.invalid')
          `;

          assert.equal(
            await foldStubFamilyIntoTx(
              tx,
              sourceFamilyId,
              destinationFamilyId,
            ),
            true,
          );
          const [state] = await tx<Array<{ source: number; destination: number }>>`
            select
              count(*) filter (where id = ${sourceFamilyId})::integer as source,
              count(*) filter (where id = ${destinationFamilyId})::integer as destination
            from public.families
          `;
          assert.deepEqual(state, { source: 0, destination: 1 });
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "family fold rejects disabled and rebound deletion guards",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 1 });
    const disabledSourceFamilyId = randomUUID();
    const disabledDestinationFamilyId = randomUUID();
    const reboundSourceFamilyId = randomUUID();
    const reboundDestinationFamilyId = randomUUID();
    const rollback = new Error("roll back deletion guard fixtures");

    try {
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`
            insert into public.families (id, name, email)
            values
              (${disabledSourceFamilyId}, 'Disabled guard source', null),
              (${disabledDestinationFamilyId}, 'Disabled guard destination', 'disabled@example.invalid'),
              (${reboundSourceFamilyId}, 'Rebound guard source', null),
              (${reboundDestinationFamilyId}, 'Rebound guard destination', 'rebound@example.invalid')
          `;
          await tx`
            alter table public.families
            disable trigger families_hard_delete_protocol_guard
          `;
          assert.equal(
            await foldStubFamilyIntoTx(
              tx,
              disabledSourceFamilyId,
              disabledDestinationFamilyId,
            ),
            false,
          );

          await tx`
            drop trigger families_hard_delete_protocol_guard
            on public.families
          `;
          await tx`
            create function public.test_rebound_family_delete_guard()
            returns trigger
            language plpgsql
            as $$
            begin
              return old;
            end;
            $$
          `;
          await tx`
            create trigger families_hard_delete_protocol_guard
            before delete on public.families
            for each row execute function public.test_rebound_family_delete_guard()
          `;
          assert.equal(
            await foldStubFamilyIntoTx(
              tx,
              reboundSourceFamilyId,
              reboundDestinationFamilyId,
            ),
            false,
          );

          const [state] = await tx<Array<{ families: number }>>`
            select count(*)::integer as families
            from public.families
            where id in (
              ${disabledSourceFamilyId},
              ${disabledDestinationFamilyId},
              ${reboundSourceFamilyId},
              ${reboundDestinationFamilyId}
            )
          `;
          assert.equal(state.families, 4);
          throw rollback;
        }),
        (error) => error === rollback,
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);

async function fixtureCounts(
  sql: ReturnType<typeof postgres>,
  familyId: string,
  userId: string,
): Promise<FixtureCounts> {
  const [counts] = await sql<FixtureCounts[]>`
    select
      (select count(*)::integer from public.families where id = ${familyId}) as families,
      (select count(*)::integer from public.family_members where family_id = ${familyId}) as memberships,
      (select count(*)::integer from public.children where family_id = ${familyId}) as children,
      (select count(*)::integer from auth.users where id = ${userId}) as users
  `;
  return counts;
}

test(
  "family hard-delete protocols block old code and verify each disposition",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const sourceFamilyId = randomUUID();
    const destinationFamilyId = randomUUID();
    const anonymousFamilyId = randomUUID();
    const completedJobId = randomUUID();
    const retainedTombstoneFamilyId = randomUUID();

    try {
      await sql`
        insert into public.families (id, name, email)
        values
          (${sourceFamilyId}, 'Old fold source', null),
          (${destinationFamilyId}, 'Fold destination', 'fold@example.invalid'),
          (${anonymousFamilyId}, 'Empty anonymous lead', null)
      `;
      await sql`
        update public.families
        set created_at = now() - interval '8 days',
            updated_at = now() - interval '8 days'
        where id = ${anonymousFamilyId}
      `;

      await assert.rejects(
        sql`delete from public.families where id = ${sourceFamilyId}`,
        /recognized transaction protocol/u,
      );
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`
            select set_config(
              'homa.family_delete_mode',
              'family-fold-v2',
              true
            )
          `;
          await tx`delete from public.families where id = ${sourceFamilyId}`;
        }),
        /did not prove its artifact disposition/u,
      );
      assert.equal(
        await sql.begin((tx) => foldFamilyDataIntoTx(
          tx,
          sourceFamilyId,
          destinationFamilyId,
        )),
        true,
      );
      const [foldState] = await sql<Array<{
        source_families: number;
        aliases: number;
      }>>`
        select
          (select count(*)::integer
             from public.families
            where id = ${sourceFamilyId}) as source_families,
          (select count(*)::integer
             from public.family_artifact_prefixes
            where artifact_family_id = ${sourceFamilyId}
              and owner_family_id = ${destinationFamilyId}) as aliases
      `;
      assert.deepEqual(foldState, { source_families: 0, aliases: 1 });

      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`
            select set_config(
              'homa.family_delete_mode',
              'empty-anonymous-purge-v1',
              true
            )
          `;
          await tx`
            delete from public.families
            where id = ${anonymousFamilyId}
          `;
        }),
        /anonymous family purge is paused/u,
      );
      const [anonymousState] = await sql<Array<{ families: number }>>`
        select count(*)::integer as families
        from public.families
        where id = ${anonymousFamilyId}
      `;
      assert.equal(anonymousState.families, 1);

      await sql`
        insert into public.account_deletion_jobs (
          id,
          family_id,
          requested_by_user_id,
          status,
          completed_at
        )
        values (${completedJobId}, null, null, 'complete', now())
      `;
      await sql`
        insert into public.account_deletion_artifact_tombstones (
          family_id,
          deletion_job_id
        )
        values (${retainedTombstoneFamilyId}, ${completedJobId})
      `;
      await assert.rejects(
        sql`delete from public.account_deletion_jobs where id = ${completedJobId}`,
        /account_deletion_artifact_tombstones_deletion_job_id_fkey/u,
      );
      const [retainedTombstone] = await sql<Array<{ tombstones: number }>>`
        select count(*)::integer as tombstones
        from public.account_deletion_artifact_tombstones
        where family_id = ${retainedTombstoneFamilyId}
          and deletion_job_id = ${completedJobId}
      `;
      assert.equal(retainedTombstone.tombstones, 1);
      await sql`
        delete from public.account_deletion_artifact_tombstones
        where family_id = ${retainedTombstoneFamilyId}
          and deletion_job_id = ${completedJobId}
      `;
      await sql`
        delete from public.account_deletion_jobs
        where id = ${completedJobId}
      `;
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "old deployment requests roll back while a preexisting partial job recovers",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const guardedFamilyId = randomUUID();
    const guardedUserId = randomUUID();
    const familyId = randomUUID();
    const inheritedArtifactFamilyId = randomUUID();
    const userId = randomUUID();
    const jobId = randomUUID();
    const mismatchFamilyId = randomUUID();
    const mismatchUserId = randomUUID();
    const mismatchJobId = randomUUID();
    const conflictingJobId = randomUUID();

    try {
      const [sessionTable] = await sql<{ present: boolean }[]>`
        select to_regclass('auth.sessions') is not null as present
      `;
      if (!sessionTable.present) {
        await sql`
          create table auth.sessions (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users (id) on delete cascade,
            created_at timestamptz not null default now()
          )
        `;
      }
      await sql`
        insert into auth.users (id, email)
        values
          (${guardedUserId}, ${`guarded-old-delete-${randomUUID()}@example.invalid`}),
          (${userId}, ${`legacy-delete-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into public.families (id, name)
        values
          (${guardedFamilyId}, 'Guarded old deployment family'),
          (${familyId}, 'Legacy cutover family')
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values
          (${guardedFamilyId}, ${guardedUserId}, 'parent'),
          (${familyId}, ${userId}, 'parent')
      `;
      await sql`
        insert into public.family_artifact_prefixes (
          artifact_family_id,
          owner_family_id
        )
        values (${inheritedArtifactFamilyId}, ${familyId})
      `;

      // Once the first guard migration lands, the old deployment cannot close
      // access. Its job insert and status change share one transaction, so the
      // protocol error rolls back both writes.
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`
            insert into public.account_deletion_jobs (
              family_id,
              requested_by_user_id,
              status,
              provider_summary
            )
            values (
              ${guardedFamilyId},
              ${guardedUserId},
              'waiting_for_artifacts',
              '{"stripe":"canceled"}'::jsonb
            )
          `;
          await tx`
            update public.families
            set status = 'deleted', updated_at = now()
            where id = ${guardedFamilyId}
          `;
        }),
        /deletion acceptance requires the account deletion protocol/u,
      );
      const [guardedState] = await sql<Array<{
        family_status: string;
        jobs: number;
        tombstones: number;
      }>>`
        select
          family.status as family_status,
          (select count(*)::integer
             from public.account_deletion_jobs deletion_job
            where deletion_job.family_id = family.id) as jobs,
          (select count(*)::integer
             from public.account_deletion_artifact_tombstones tombstone
            where tombstone.family_id = family.id) as tombstones
        from public.families family
        where family.id = ${guardedFamilyId}
      `;
      assert.deepEqual(guardedState, {
        family_status: "open",
        jobs: 0,
        tombstones: 0,
      });

      // Construct the state that may already exist before the status guard:
      // an old waiting job whose family access was closed, with the migration
      // backfill and invariant trigger supplying its cleanup tombstones.
      await sql.begin(async (tx) => {
        await tx`
          insert into public.account_deletion_jobs (
            id,
            family_id,
            requested_by_user_id,
            status,
            provider_summary
          )
          values (
            ${jobId},
            ${familyId},
            ${userId},
            'waiting_for_artifacts',
            '{"stripe":"canceled"}'::jsonb
          )
        `;
        await tx`
          select set_config(
            'homa.family_delete_mode',
            'account-deletion-v2',
            true
          )
        `;
        await tx`
          update public.families
          set status = 'deleted', updated_at = now()
          where id = ${familyId}
        `;
      });

      const [compatibilityState] = await sql<Array<{
        family_status: string;
        stored_users: string[];
        tombstones: number;
      }>>`
        select
          family.status as family_status,
          deletion_job.storage_user_ids::text[] as stored_users,
          (select count(*)::integer
             from public.account_deletion_artifact_tombstones tombstone
            where tombstone.deletion_job_id = deletion_job.id) as tombstones
        from public.account_deletion_jobs deletion_job
        join public.families family on family.id = deletion_job.family_id
        where deletion_job.id = ${jobId}
      `;
      assert.deepEqual(compatibilityState, {
        family_status: "deleted",
        stored_users: [userId],
        tombstones: 2,
      });

      await assert.rejects(
        sql`delete from public.families where id = ${familyId}`,
        /recognized transaction protocol/u,
      );
      await sql`
        update public.account_deletion_jobs
        set status = 'retryable_failed', updated_at = now()
        where id = ${jobId}
      `;

      const recovered = await runAccountDeletionJob(jobId, NOOP_DELETION_JOB);
      assert.equal(recovered.state, "in_progress");
      assert.equal(recovered.accessClosed, true);
      assert.equal(recovered.deletionReceipt, jobId);

      const [recoveredState] = await sql<Array<{
        families: number;
        memberships: number;
        job_status: string;
        requested_by_user_id: string | null;
        stored_users: string[];
        tombstones: number;
      }>>`
        select
          (select count(*)::integer from public.families
            where id = ${familyId}) as families,
          (select count(*)::integer from public.family_members
            where family_id = ${familyId}) as memberships,
          deletion_job.status as job_status,
          deletion_job.requested_by_user_id::text,
          deletion_job.storage_user_ids::text[] as stored_users,
          (select count(*)::integer
             from public.account_deletion_artifact_tombstones tombstone
            where tombstone.deletion_job_id = deletion_job.id) as tombstones
        from public.account_deletion_jobs deletion_job
        where deletion_job.id = ${jobId}
      `;
      assert.deepEqual(recoveredState, {
        families: 0,
        memberships: 0,
        job_status: "waiting_for_artifacts",
        requested_by_user_id: null,
        stored_users: [userId],
        tombstones: 2,
      });

      const absentFamilyRecovery = await runAccountDeletionJob(
        jobId,
        NOOP_DELETION_JOB,
      );
      assert.equal(absentFamilyRecovery.state, "in_progress");
      assert.equal(absentFamilyRecovery.accessClosed, true);
      const [absentFamilyState] = await sql<Array<{
        status: string;
        attempts: number;
        tombstones: number;
      }>>`
        select
          deletion_job.status,
          deletion_job.attempts,
          (select count(*)::integer
             from public.account_deletion_artifact_tombstones tombstone
            where tombstone.deletion_job_id = deletion_job.id) as tombstones
        from public.account_deletion_jobs deletion_job
        where deletion_job.id = ${jobId}
      `;
      assert.deepEqual(absentFamilyState, {
        status: "waiting_for_artifacts",
        attempts: 2,
        tombstones: 2,
      });

      await sql`
        insert into auth.users (id, email)
        values (${mismatchUserId}, ${`mismatched-tombstone-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into public.families (id, name)
        values (${mismatchFamilyId}, 'Mismatched recovery family')
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values (${mismatchFamilyId}, ${mismatchUserId}, 'parent')
      `;
      await sql`
        insert into public.account_deletion_jobs (
          id,
          family_id,
          requested_by_user_id,
          status,
          provider_summary
        )
        values (
          ${mismatchJobId},
          ${mismatchFamilyId},
          ${mismatchUserId},
          'waiting_for_artifacts',
          '{"stripe":"canceled"}'::jsonb
        )
      `;
      await sql`
        insert into public.account_deletion_jobs (
          id,
          family_id,
          requested_by_user_id,
          status,
          completed_at
        )
        values (${conflictingJobId}, null, null, 'complete', now())
      `;
      await sql`
        update public.account_deletion_artifact_tombstones
        set deletion_job_id = ${conflictingJobId}
        where family_id = ${mismatchFamilyId}
          and deletion_job_id = ${mismatchJobId}
      `;
      await sql.begin(async (tx) => {
        await tx`
          select set_config(
            'homa.family_delete_mode',
            'account-deletion-v2',
            true
          )
        `;
        await tx`
          update public.families
          set status = 'deleted'
          where id = ${mismatchFamilyId}
        `;
      });

      await assert.rejects(
        runAccountDeletionJob(mismatchJobId, NOOP_DELETION_JOB),
        /primary tombstone belongs to another job/u,
      );
      const [mismatchState] = await sql<Array<{
        family_status: string;
        job_status: string;
        tombstone_job_id: string;
      }>>`
        select
          family.status as family_status,
          deletion_job.status as job_status,
          tombstone.deletion_job_id::text as tombstone_job_id
        from public.families family
        join public.account_deletion_jobs deletion_job
          on deletion_job.family_id = family.id
        join public.account_deletion_artifact_tombstones tombstone
          on tombstone.family_id = family.id
        where family.id = ${mismatchFamilyId}
          and deletion_job.id = ${mismatchJobId}
      `;
      assert.deepEqual(mismatchState, {
        family_status: "deleted",
        job_status: "waiting_for_artifacts",
        tombstone_job_id: conflictingJobId,
      });
      await sql`
        delete from public.account_deletion_artifact_tombstones
        where family_id = ${mismatchFamilyId}
          and deletion_job_id = ${conflictingJobId}
      `;
      await sql`
        delete from public.account_deletion_jobs
        where id in (${mismatchJobId}, ${conflictingJobId})
      `;
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "unresolved historical artifact evidence preserves family access",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const familyId = randomUUID();
    const userId = randomUUID();
    const candidateArtifactFamilyId = randomUUID();
    const familyName = `Candidate review ${randomUUID()}`;

    try {
      await sql`
        insert into auth.users (id, email)
        values (${userId}, ${`candidate-review-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into public.families (id, name)
        values (${familyId}, ${familyName})
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values (${familyId}, ${userId}, 'parent')
      `;
      await sql`
        insert into public.family_artifact_prefix_candidates (
          owner_family_id,
          artifact_family_id,
          evidence_kind,
          evidence_count
        )
        values (
          ${familyId},
          ${candidateArtifactFamilyId},
          'material_output',
          1
        )
      `;

      const result = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
      );
      assert.equal(result.state, "rejected");
      assert.equal(result.accessClosed, false);
      const [state] = await sql<Array<{
        families: number;
        memberships: number;
        candidates: number;
        jobs: number;
        tombstones: number;
      }>>`
        select
          (select count(*)::integer from public.families
            where id = ${familyId}) as families,
          (select count(*)::integer from public.family_members
            where family_id = ${familyId}) as memberships,
          (select count(*)::integer from public.family_artifact_prefix_candidates
            where owner_family_id = ${familyId}) as candidates,
          (select count(*)::integer from public.account_deletion_jobs
            where family_id = ${familyId}) as jobs,
          (select count(*)::integer from public.account_deletion_artifact_tombstones
            where family_id = ${familyId}) as tombstones
      `;
      assert.deepEqual(state, {
        families: 1,
        memberships: 1,
        candidates: 1,
        jobs: 0,
        tombstones: 0,
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "cross-family historical artifact candidates preserve family access",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const primaryFamilyId = randomUUID();
    const primaryUserId = randomUUID();
    const primaryCandidateOwnerFamilyId = randomUUID();
    const aliasFamilyId = randomUUID();
    const aliasUserId = randomUUID();
    const aliasCandidateOwnerFamilyId = randomUUID();
    const inheritedArtifactFamilyId = randomUUID();
    const triggerJobId = randomUUID();
    const primaryFamilyName = `Primary conflict ${randomUUID()}`;
    const aliasFamilyName = `Alias conflict ${randomUUID()}`;

    try {
      await sql`
        insert into auth.users (id, email)
        values
          (${primaryUserId}, ${`primary-conflict-${randomUUID()}@example.invalid`}),
          (${aliasUserId}, ${`alias-conflict-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into public.families (id, name)
        values
          (${primaryFamilyId}, ${primaryFamilyName}),
          (${primaryCandidateOwnerFamilyId}, 'Primary candidate owner'),
          (${aliasFamilyId}, ${aliasFamilyName}),
          (${aliasCandidateOwnerFamilyId}, 'Alias candidate owner')
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values
          (${primaryFamilyId}, ${primaryUserId}, 'parent'),
          (${aliasFamilyId}, ${aliasUserId}, 'parent')
      `;
      await sql`
        insert into public.family_artifact_prefixes (
          owner_family_id,
          artifact_family_id
        )
        values (${aliasFamilyId}, ${inheritedArtifactFamilyId})
      `;
      await sql`
        insert into public.family_artifact_prefix_candidates (
          owner_family_id,
          artifact_family_id,
          evidence_kind,
          evidence_count
        )
        values
          (
            ${primaryCandidateOwnerFamilyId},
            ${primaryFamilyId},
            'material_output',
            1
          ),
          (
            ${aliasCandidateOwnerFamilyId},
            ${inheritedArtifactFamilyId},
            'lesson_audio',
            1
          )
      `;

      for (const input of [
        {
          familyId: primaryFamilyId,
          userId: primaryUserId,
          familyName: primaryFamilyName,
        },
        {
          familyId: aliasFamilyId,
          userId: aliasUserId,
          familyName: aliasFamilyName,
        },
      ]) {
        const result = await requestAccountDeletion(
          {
            familyId: input.familyId,
            userId: input.userId,
            confirmation: deletionConfirmationFor(input.familyName),
          },
          { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
        );
        assert.equal(result.state, "rejected");
        assert.equal(result.accessClosed, false);
      }

      // Prove the database guard independently of the application preflight.
      // Every setup write rolls back with the rejected hard delete.
      await assert.rejects(
        sql.begin(async (tx) => {
          await tx`
            insert into public.account_deletion_jobs (
              id,
              family_id,
              requested_by_user_id,
              status
            )
            values (
              ${triggerJobId},
              ${aliasFamilyId},
              ${aliasUserId},
              'running'
            )
          `;
          await tx`
            select set_config(
              'homa.family_delete_mode',
              'account-deletion-v2',
              true
            )
          `;
          await tx`
            update public.families
            set status = 'deleted'
            where id = ${aliasFamilyId}
          `;
          await tx`delete from public.families where id = ${aliasFamilyId}`;
        }),
        /account deletion did not prove its artifact disposition/u,
      );

      const [state] = await sql<Array<{
        families: number;
        open_families: number;
        memberships: number;
        aliases: number;
        candidates: number;
        jobs: number;
        tombstones: number;
      }>>`
        select
          (select count(*)::integer from public.families
            where id in (${primaryFamilyId}, ${aliasFamilyId})) as families,
          (select count(*)::integer from public.families
            where id in (${primaryFamilyId}, ${aliasFamilyId})
              and status = 'open') as open_families,
          (select count(*)::integer from public.family_members
            where family_id in (${primaryFamilyId}, ${aliasFamilyId})) as memberships,
          (select count(*)::integer from public.family_artifact_prefixes
            where owner_family_id = ${aliasFamilyId}
              and artifact_family_id = ${inheritedArtifactFamilyId}) as aliases,
          (select count(*)::integer from public.family_artifact_prefix_candidates
            where (owner_family_id = ${primaryCandidateOwnerFamilyId}
                and artifact_family_id = ${primaryFamilyId})
               or (owner_family_id = ${aliasCandidateOwnerFamilyId}
                and artifact_family_id = ${inheritedArtifactFamilyId})) as candidates,
          (select count(*)::integer from public.account_deletion_jobs
            where family_id in (${primaryFamilyId}, ${aliasFamilyId})) as jobs,
          (select count(*)::integer from public.account_deletion_artifact_tombstones
            where deletion_job_id = ${triggerJobId}) as tombstones
      `;
      assert.deepEqual(state, {
        families: 2,
        open_families: 2,
        memberships: 2,
        aliases: 1,
        candidates: 2,
        jobs: 0,
        tombstones: 0,
      });
    } finally {
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "family fold and deletion serialize both lock orders",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const foldSql = postgres(databaseUrl, { prepare: false, max: 1 });
    const sourceFamilyId = randomUUID();
    const destinationFamilyId = randomUUID();
    const userId = randomUUID();
    const deletionFirstJobId = randomUUID();
    const familyName = `Serialized deletion ${randomUUID()}`;
    let releaseDeletionFirst: () => void = () => undefined;
    let releaseFoldFirst: () => void = () => undefined;

    try {
      const [sessionTable] = await sql<{ present: boolean }[]>`
        select to_regclass('auth.sessions') is not null as present
      `;
      if (!sessionTable.present) {
        await sql`
          create table auth.sessions (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users (id) on delete cascade,
            created_at timestamptz not null default now()
          )
        `;
      }
      await sql`
        insert into public.families (id, name, email)
        values
          (${sourceFamilyId}, 'Serialized stub', null),
          (${destinationFamilyId}, ${familyName}, 'serialized@example.invalid')
      `;

      let announceDeletionLock: () => void = () => undefined;
      const deletionLockHeld = new Promise<void>((resolve) => {
        announceDeletionLock = resolve;
      });
      const finishDeletionFirst = new Promise<void>((resolve) => {
        releaseDeletionFirst = resolve;
      });
      const deletionFence = foldSql.begin(async (tx) => {
        await tx`
          select family.id
          from public.families family
          where family.id = ${destinationFamilyId}
          for update
        `;
        await tx`
          insert into public.account_deletion_jobs (id, family_id, status)
          values (${deletionFirstJobId}, ${destinationFamilyId}, 'preparing')
        `;
        announceDeletionLock();
        await finishDeletionFirst;
      });
      await deletionLockHeld;
      let deletionFirstFoldSettled = false;
      const deletionFirstFold = sql.begin((tx) => foldStubFamilyIntoTx(
        tx,
        sourceFamilyId,
        destinationFamilyId,
      )).finally(() => {
        deletionFirstFoldSettled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(deletionFirstFoldSettled, false);
      releaseDeletionFirst();
      await deletionFence;
      assert.equal(await deletionFirstFold, false);
      const [deletionFirstState] = await sql<Array<{ families: number }>>`
        select count(*)::integer as families
        from public.families
        where id in (${sourceFamilyId}, ${destinationFamilyId})
      `;
      assert.equal(deletionFirstState.families, 2);
      await sql`
        delete from public.account_deletion_artifact_tombstones
        where deletion_job_id = ${deletionFirstJobId}
      `;
      await sql`
        delete from public.account_deletion_jobs
        where id = ${deletionFirstJobId}
      `;

      await sql`
        insert into auth.users (id, email)
        values (${userId}, ${`serialized-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values (${destinationFamilyId}, ${userId}, 'parent')
      `;
      let announceFoldLock: () => void = () => undefined;
      const foldLockHeld = new Promise<void>((resolve) => {
        announceFoldLock = resolve;
      });
      const finishFoldFirst = new Promise<void>((resolve) => {
        releaseFoldFirst = resolve;
      });
      const foldFirst = foldSql.begin((tx) => foldStubFamilyIntoTx(
        tx,
        sourceFamilyId,
        destinationFamilyId,
        {
          afterFamilyLocks: async () => {
            announceFoldLock();
            await finishFoldFirst;
          },
        },
      ));
      await foldLockHeld;
      let foldFirstDeletionSettled = false;
      const foldFirstDeletion = requestAccountDeletion(
        {
          familyId: destinationFamilyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
      ).finally(() => {
        foldFirstDeletionSettled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(foldFirstDeletionSettled, false);
      releaseFoldFirst();
      assert.equal(await foldFirst, true);
      const deletion = await foldFirstDeletion;
      assert.equal(deletion.state, "in_progress");
      assert.equal(deletion.accessClosed, true);
      assert.ok(deletion.deletionReceipt);
      const tombstones = await sql<Array<{ family_id: string }>>`
        select family_id
        from public.account_deletion_artifact_tombstones
        where deletion_job_id = ${deletion.deletionReceipt}
        order by family_id
      `;
      assert.deepEqual(
        new Set(tombstones.map((row) => row.family_id)),
        new Set([sourceFamilyId, destinationFamilyId]),
      );
    } finally {
      releaseDeletionFirst();
      releaseFoldFirst();
      await Promise.all([
        sql.end({ timeout: 5 }),
        foldSql.end({ timeout: 5 }),
      ]);
    }
  },
);

test(
  "family access and Auth sessions close before retryable provider cleanup",
  { skip: databaseUrl === undefined },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const previousIsolationFlag = process.env[EVAL_ISOLATION_FLAG];
    const previousPrivateBlobToken = process.env.HOMA_LESSON_READ_WRITE_TOKEN;
    process.env[EVAL_ISOLATION_FLAG] = "1";
    delete process.env.HOMA_LESSON_READ_WRITE_TOKEN;

    const targetFamilyId = randomUUID();
    const targetUserId = randomUUID();
    const targetChildId = randomUUID();
    const controlFamilyId = randomUUID();
    const controlUserId = randomUUID();
    const controlChildId = randomUUID();
    const sharedUserId = randomUUID();
    const targetSessionId = randomUUID();
    const sharedSessionId = randomUUID();
    const targetAvatarObjectId = randomUUID();
    const staleAvatarObjectId = randomUUID();
    const legacyFamilyId = randomUUID();
    const legacyUserId = randomUUID();
    const legacyChildId = randomUUID();
    const legacyJobId = randomUUID();
    const targetFamilyName = `Deletion target ${randomUUID()}`;

    try {
      assert.ok(resolveEvalBlobStore(process.env), "eval public Blob store must be active");
      assert.equal(process.env.HOMA_LESSON_READ_WRITE_TOKEN, undefined);

      const [legacyRpcPrivilege] = await sql<{ allowed: boolean }[]>`
        select has_function_privilege(
          'authenticated',
          'public.delete_own_account()',
          'execute'
        ) as allowed
      `;
      assert.equal(
        legacyRpcPrivilege.allowed,
        false,
        "authenticated clients must not bypass the server deletion workflow",
      );

      const [sessionTable] = await sql<{ present: boolean }[]>`
        select to_regclass('auth.sessions') is not null as present
      `;
      if (!sessionTable.present) {
        await sql`
          create table auth.sessions (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users (id) on delete cascade,
            created_at timestamptz not null default now()
          )
        `;
      }
      await sql`alter table storage.objects enable row level security`;
      await sql`grant usage on schema storage to authenticated`;
      await sql`
        grant select, insert, update, delete
        on table storage.objects
        to authenticated
      `;

      await sql`
        insert into auth.users (id, email)
        values
          (${targetUserId}, ${`account-delete-target-${randomUUID()}@example.invalid`}),
          (${controlUserId}, ${`account-delete-control-${randomUUID()}@example.invalid`}),
          (${sharedUserId}, ${`account-delete-shared-${randomUUID()}@example.invalid`}),
          (${legacyUserId}, ${`account-delete-legacy-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into auth.sessions (id, user_id)
        values
          (${targetSessionId}, ${targetUserId}),
          (${sharedSessionId}, ${sharedUserId})
      `;
      await sql.begin(async (transaction) => {
        await transaction`
          select set_config('request.jwt.claim.sub', ${targetUserId}, true)
        `;
        await transaction`set local role authenticated`;
        await transaction`
          insert into storage.objects (id, bucket_id, name, owner)
          values (
            ${targetAvatarObjectId},
            'avatars',
            ${`${targetUserId}/before-deletion.jpg`},
            ${targetUserId}
          )
        `;
      });
      await sql`
        insert into public.families (id, name)
        values
          (${targetFamilyId}, ${targetFamilyName}),
          (${controlFamilyId}, 'Deletion control'),
          (${legacyFamilyId}, 'Legacy deletion target')
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role, created_at)
        values
          (${targetFamilyId}, ${targetUserId}, 'parent', now() - interval '2 minutes'),
          (${targetFamilyId}, ${sharedUserId}, 'partner', now() - interval '1 minute'),
          (${controlFamilyId}, ${controlUserId}, 'parent', now() - interval '2 minutes'),
          (${controlFamilyId}, ${sharedUserId}, 'partner', now() - interval '1 minute'),
          (${legacyFamilyId}, ${legacyUserId}, 'parent', now() - interval '2 minutes')
      `;
      await sql`
        insert into public.children (id, family_id, name, birth_month)
        values
          (${targetChildId}, ${targetFamilyId}, 'Target child', '2018-01-01'),
          (${controlChildId}, ${controlFamilyId}, 'Control child', '2017-01-01'),
          (${legacyChildId}, ${legacyFamilyId}, 'Legacy child', '2016-01-01')
      `;

      const missingArtifactCleanup = await requestAccountDeletion(
        {
          familyId: controlFamilyId,
          userId: controlUserId,
          confirmation: deletionConfirmationFor("Deletion control"),
        },
        {
          ...NOOP_STRIPE_RECONCILIATION,
          artifactCleanupConfigured: () => false,
        },
      );
      assert.equal(missingArtifactCleanup.state, "rejected");
      assert.match(missingArtifactCleanup.message, /Nothing was deleted/u);
      assert.deepEqual(await fixtureCounts(sql, controlFamilyId, controlUserId), {
        families: 1,
        memberships: 2,
        children: 1,
        users: 1,
      });
      const [preflightJobs] = await sql<Array<{ count: number }>>`
        select count(*)::integer as count
        from public.account_deletion_jobs
        where family_id = ${controlFamilyId}
      `;
      assert.equal(preflightJobs.count, 0);

      const requested = await requestAccountDeletion(
        {
          familyId: targetFamilyId,
          userId: targetUserId,
          confirmation: deletionConfirmationFor(targetFamilyName),
        },
        NOOP_STRIPE_RECONCILIATION,
      );
      assert.equal(requested.state, "in_progress");
      assert.equal(requested.accessClosed, true);
      assert.ok(requested.deletionReceipt);
      assert.deepEqual(await fixtureCounts(sql, targetFamilyId, targetUserId), {
        families: 0,
        memberships: 0,
        children: 0,
        users: 1,
      });
      assert.deepEqual(await fixtureCounts(sql, controlFamilyId, controlUserId), {
        families: 1,
        memberships: 2,
        children: 1,
        users: 1,
      });

      const [sharedIdentity] = await sql<
        Array<{
          users: number;
          control_memberships: number;
          target_sessions: number;
          shared_sessions: number;
        }>
      >`
        select
          (select count(*)::integer from auth.users where id = ${sharedUserId}) as users,
          (select count(*)::integer
             from public.family_members
            where family_id = ${controlFamilyId}
              and user_id = ${sharedUserId}) as control_memberships,
          (select count(*)::integer
             from auth.sessions
            where id = ${targetSessionId}
              and user_id = ${targetUserId}) as target_sessions,
          (select count(*)::integer
             from auth.sessions
            where id = ${sharedSessionId}
              and user_id = ${sharedUserId}) as shared_sessions
      `;
      assert.deepEqual(sharedIdentity, {
        users: 1,
        control_memberships: 1,
        target_sessions: 0,
        shared_sessions: 1,
      });
      await assert.rejects(
        sql.begin(async (transaction) => {
          await transaction`
            select set_config('request.jwt.claim.sub', ${targetUserId}, true)
          `;
          await transaction`set local role authenticated`;
          await transaction`
            insert into storage.objects (id, bucket_id, name, owner)
            values (
              ${staleAvatarObjectId},
              'avatars',
              ${`${targetUserId}/after-deletion.jpg`},
              ${targetUserId}
            )
          `;
        }),
        /row-level security policy/u,
      );
      await assert.rejects(
        sql`
          insert into public.family_members (family_id, user_id, role)
          values (${controlFamilyId}, ${targetUserId}, 'partner')
        `,
        /membership is unavailable during account deletion/u,
      );

      const firstCleanupAttempt = await runAccountDeletionJob(
        requested.deletionReceipt,
      );
      assert.equal(firstCleanupAttempt.state, "in_progress");
      assert.equal(firstCleanupAttempt.accessClosed, true);

      const [targetJob] = await sql<
        Array<{
          family_id: string | null;
          requested_by_user_id: string | null;
          storage_user_ids: string[] | null;
          status: string;
          last_error: string | null;
        }>
      >`
        select family_id, requested_by_user_id, storage_user_ids, status, last_error
        from public.account_deletion_jobs
        where family_id = ${targetFamilyId}
      `;
      assert.equal(targetJob.family_id, targetFamilyId);
      assert.equal(targetJob.requested_by_user_id, null);
      assert.deepEqual(targetJob.storage_user_ids, [targetUserId]);
      assert.equal(targetJob.storage_user_ids?.includes(sharedUserId), false);
      assert.equal(targetJob.status, "retryable_failed");
      assert.match(targetJob.last_error ?? "", /Supabase avatar cleanup is not configured/u);

      await sql`
        insert into public.account_deletion_jobs
          (id, family_id, requested_by_user_id, status)
        values
          (${legacyJobId}, ${legacyFamilyId}, ${legacyUserId}, 'waiting_for_artifacts')
      `;
      const retriedLegacyJob = await runAccountDeletionJob(
        legacyJobId,
        NOOP_DELETION_JOB,
      );
      assert.equal(retriedLegacyJob.state, "in_progress");
      assert.equal(retriedLegacyJob.accessClosed, true);
      assert.deepEqual(await fixtureCounts(sql, legacyFamilyId, legacyUserId), {
        families: 0,
        memberships: 0,
        children: 0,
        users: 1,
      });

      await runAccountDeletionJob(legacyJobId);

      const [legacyJob] = await sql<
        Array<{
          family_id: string | null;
          storage_user_ids: string[] | null;
          status: string;
          last_error: string | null;
        }>
      >`
        select family_id, storage_user_ids, status, last_error
        from public.account_deletion_jobs
        where id = ${legacyJobId}
      `;
      assert.equal(legacyJob.family_id, legacyFamilyId);
      assert.deepEqual(legacyJob.storage_user_ids, [legacyUserId]);
      assert.equal(legacyJob.status, "retryable_failed");
      assert.match(legacyJob.last_error ?? "", /Supabase Auth cleanup is not configured/u);
      assert.deepEqual(await fixtureCounts(sql, controlFamilyId, controlUserId), {
        families: 1,
        memberships: 2,
        children: 1,
        users: 1,
      });
    } finally {
      await sql`
        delete from storage.objects
        where id in (${targetAvatarObjectId}, ${staleAvatarObjectId})
      `.catch(() => undefined);
      await sql`
        delete from public.account_deletion_jobs
        where family_id in (${targetFamilyId}, ${legacyFamilyId})
           or id = ${legacyJobId}
      `.catch(() => undefined);
      await sql`
        delete from public.families
        where id in (${targetFamilyId}, ${controlFamilyId}, ${legacyFamilyId})
      `.catch(() => undefined);
      await sql`
        delete from auth.users
        where id in (${targetUserId}, ${controlUserId}, ${sharedUserId}, ${legacyUserId})
      `.catch(() => undefined);

      if (previousIsolationFlag === undefined) {
        delete process.env[EVAL_ISOLATION_FLAG];
      } else {
        process.env[EVAL_ISOLATION_FLAG] = previousIsolationFlag;
      }
      if (previousPrivateBlobToken === undefined) {
        delete process.env.HOMA_LESSON_READ_WRITE_TOKEN;
      } else {
        process.env.HOMA_LESSON_READ_WRITE_TOKEN = previousPrivateBlobToken;
      }
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "an App Store purchase interlock closes the StoreKit deletion gap",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const gateSql = postgres(databaseUrl, { prepare: false, max: 1 });
    const familyId = randomUUID();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const familyName = `StoreKit interlock ${randomUUID()}`;
    const subscriptionId = `apple-${randomUUID()}`;
    const conflictingSubscriptionId = `apple-conflict-${randomUUID()}`;
    const conflictingFamilyId = randomUUID();
    let jobId: string | null = null;
    let releaseMarkerTransaction: () => void = () => undefined;

    try {
      const [sessionTable] = await sql<{ present: boolean }[]>`
        select to_regclass('auth.sessions') is not null as present
      `;
      if (!sessionTable.present) {
        await sql`
          create table auth.sessions (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users (id) on delete cascade,
            created_at timestamptz not null default now()
          )
        `;
      }
      await sql`
        insert into auth.users (id, email)
        values (${userId}, ${`storekit-interlock-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into auth.sessions (id, user_id)
        values (${sessionId}, ${userId})
      `;
      await sql`
        insert into public.families (id, name)
        values (${familyId}, ${familyName})
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values (${familyId}, ${userId}, 'parent')
      `;

      let publishAttemptId: (attemptId: string) => void = () => undefined;
      const markerMayCommit = new Promise<void>((resolve) => {
        releaseMarkerTransaction = resolve;
      });
      const pendingAttemptId = new Promise<string>((resolve) => {
        publishAttemptId = resolve;
      });
      const firstAttemptId = randomUUID();
      const markerTransaction = gateSql.begin(async (tx) => {
        await tx`
          select family.id
          from public.families family
          where family.id = ${familyId}
          for update
        `;
        const attempts = await tx<Array<{ attempt_id: string }>>`
          insert into public.apple_purchase_interlocks (
            attempt_id,
            family_id,
            product_id
          )
          values (${firstAttemptId}, ${familyId}, 'homa_regular_monthly')
          returning attempt_id
        `;
        publishAttemptId(attempts[0].attempt_id);
        await markerMayCommit;
      });
      const firstAttempt = { attemptId: await pendingAttemptId };
      let deletionSettled = false;
      const gapDeletion = requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
      ).finally(() => {
        deletionSettled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        deletionSettled,
        false,
        "deletion must wait for the StoreKit family lock",
      );
      releaseMarkerTransaction();
      await markerTransaction;
      const gapBlocked = await gapDeletion;
      assert.equal(gapBlocked.state, "blocked");
      assert.equal(gapBlocked.accessClosed, false);
      assert.match(
        gapBlocked.message,
        /Return to Homa on the device where you started the App Store purchase/u,
      );
      const [gapState] = await sql<
        Array<{ interlocks: number; jobs: number; tombstones: number }>
      >`
        select
          (select count(*)::integer
             from public.apple_purchase_interlocks
            where family_id = ${familyId}) as interlocks,
          (select count(*)::integer
             from public.account_deletion_jobs
            where family_id = ${familyId}) as jobs,
          (select count(*)::integer
             from public.account_deletion_artifact_tombstones
            where family_id = ${familyId}) as tombstones
      `;
      assert.deepEqual(gapState, { interlocks: 1, jobs: 0, tombstones: 0 });
      assert.deepEqual(await activeApplePurchaseInterlock(familyId), {
        attemptId: firstAttempt.attemptId,
        productId: "homa_regular_monthly",
        state: "prepared",
      });
      assert.deepEqual(
        await beginApplePurchaseInterlock(
          familyId,
          "homa_regular_monthly",
          firstAttempt.attemptId,
        ),
        {
          attemptId: firstAttempt.attemptId,
          productId: "homa_regular_monthly",
          state: "prepared",
        },
      );
      await assert.rejects(
        beginApplePurchaseInterlock(
          familyId,
          "homa_regular_monthly",
          randomUUID(),
        ),
        ApplePurchaseAlreadyPendingError,
      );
      await assert.rejects(
        sql`delete from public.families where id = ${familyId}`,
        /blocked by an active App Store purchase/u,
      );

      assert.equal(
        await abandonApplePurchaseInterlock(familyId, randomUUID()),
        false,
      );
      assert.equal(
        await abandonApplePurchaseInterlock(familyId, firstAttempt.attemptId),
        true,
      );
      assert.deepEqual(
        await beginApplePurchaseInterlock(
          familyId,
          "homa_regular_monthly",
          firstAttempt.attemptId,
        ),
        {
          attemptId: firstAttempt.attemptId,
          productId: "homa_regular_monthly",
          state: "canceled",
        },
      );
      assert.equal(await activeApplePurchaseInterlock(familyId), null);

      await sql`
        insert into public.families (id, name)
        values (${conflictingFamilyId}, 'Canonical ledger conflict')
      `;
      await sql`
        insert into public.family_billing_subscriptions (
          family_id,
          provider,
          provider_subscription_id,
          provider_product_id,
          plan_tier,
          billing_period,
          status,
          last_observed_at
        )
        values (
          ${conflictingFamilyId},
          'apple',
          ${conflictingSubscriptionId},
          'homa_regular_monthly',
          'regular',
          'monthly',
          'active',
          now()
        )
      `;
      const rollbackAttempt = await beginApplePurchaseInterlock(
        familyId,
        "homa_regular_monthly",
        randomUUID(),
      );
      const rollbackPurchaseDateMs = Date.now() + 1_000;
      await assert.rejects(
        recordFamilyAppleSubscription(familyId, {
          originalTransactionId: conflictingSubscriptionId,
          status: "active",
          productId: "homa_regular_monthly",
          tier: "regular",
          period: "monthly",
          expiresAtMs: rollbackPurchaseDateMs + 86_400_000,
          purchaseDateMs: rollbackPurchaseDateMs,
          purchaseAttemptId: rollbackAttempt.attemptId,
        }),
        /already belongs to another family/u,
      );
      const [rolledBackPurchase] = await sql<Array<{
        mirror_transaction_id: string | null;
        interlocks: number;
        ledger_owner: string;
      }>>`
        select
          family.apple_original_transaction_id as mirror_transaction_id,
          (select count(*)::integer
             from public.apple_purchase_interlocks interlock
            where interlock.family_id = family.id
              and interlock.attempt_id = ${rollbackAttempt.attemptId})
            as interlocks,
          (select subscription.family_id::text
             from public.family_billing_subscriptions subscription
            where subscription.provider = 'apple'
              and subscription.provider_subscription_id = ${conflictingSubscriptionId})
            as ledger_owner
        from public.families family
        where family.id = ${familyId}
      `;
      assert.deepEqual(rolledBackPurchase, {
        mirror_transaction_id: null,
        interlocks: 1,
        ledger_owner: conflictingFamilyId,
      });
      assert.equal(
        await abandonApplePurchaseInterlock(
          familyId,
          rollbackAttempt.attemptId,
        ),
        true,
      );
      await sql`
        delete from public.family_billing_subscriptions
        where family_id = ${conflictingFamilyId}
          and provider = 'apple'
          and provider_subscription_id = ${conflictingSubscriptionId}
      `;

      const lateTransactionAttempt = await beginApplePurchaseInterlock(
        familyId,
        "homa_regular_monthly",
        randomUUID(),
      );
      assert.deepEqual(
        await markApplePurchaseInterlockPhase(
          familyId,
          lateTransactionAttempt.attemptId,
          "store_started",
        ),
        {
          attemptId: lateTransactionAttempt.attemptId,
          productId: "homa_regular_monthly",
          state: "store_started",
        },
      );
      assert.deepEqual(
        await requestApplePurchaseInterlockCancellation(
          familyId,
          lateTransactionAttempt.attemptId,
        ),
        {
          cleared: false,
          interlock: {
            attemptId: lateTransactionAttempt.attemptId,
            productId: "homa_regular_monthly",
            state: "store_started",
          },
        },
      );
      assert.equal(
        await abandonApplePurchaseInterlock(
          familyId,
          lateTransactionAttempt.attemptId,
        ),
        false,
      );
      assert.deepEqual(
        await markApplePurchaseInterlockPhase(
          familyId,
          lateTransactionAttempt.attemptId,
          "cancel_pending",
        ),
        {
          attemptId: lateTransactionAttempt.attemptId,
          productId: "homa_regular_monthly",
          state: "cancel_pending",
        },
      );
      assert.equal(
        await abandonApplePurchaseInterlock(
          familyId,
          lateTransactionAttempt.attemptId,
        ),
        false,
      );
      const cancellationRaceBlocked = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
      );
      assert.equal(cancellationRaceBlocked.state, "blocked");
      assert.equal(cancellationRaceBlocked.accessClosed, false);
      assert.match(cancellationRaceBlocked.message, /Return to Homa/u);

      const purchaseDateMs = Date.now() + 1_000;
      await recordFamilyAppleSubscription(familyId, {
        originalTransactionId: subscriptionId,
        status: "active",
        productId: "homa_regular_monthly",
        tier: "regular",
        period: "monthly",
        expiresAtMs: purchaseDateMs + 86_400_000,
        purchaseDateMs,
        purchaseAttemptId: lateTransactionAttempt.attemptId,
      });
      assert.deepEqual(
        await beginApplePurchaseInterlock(
          familyId,
          "homa_regular_monthly",
          lateTransactionAttempt.attemptId,
        ),
        {
          attemptId: lateTransactionAttempt.attemptId,
          productId: "homa_regular_monthly",
          state: "resolved",
        },
      );
      assert.equal(await activeApplePurchaseInterlock(familyId), null);
      const newerAttempt = await beginApplePurchaseInterlock(
        familyId,
        "homa_regular_monthly",
        randomUUID(),
      );
      assert.deepEqual(await activeApplePurchaseInterlock(familyId), {
        attemptId: newerAttempt.attemptId,
        productId: "homa_regular_monthly",
        state: "prepared",
      });
      const [completedPurchase] = await sql<
        Array<{
          active_interlocks: number;
          active_attempt_id: string;
          resolved_attempt_state: string;
          mirror_status: string | null;
          ledger_status: string;
        }>
      >`
        select
          (select count(*)::integer
             from public.apple_purchase_interlocks
            where family_id = ${familyId}
              and state in ('prepared', 'store_started', 'cancel_pending'))
            as active_interlocks,
          (select attempt_id::text
             from public.apple_purchase_interlocks
            where family_id = ${familyId}
              and state in ('prepared', 'store_started', 'cancel_pending'))
            as active_attempt_id,
          (select state
             from public.apple_purchase_interlocks
            where family_id = ${familyId}
              and attempt_id = ${lateTransactionAttempt.attemptId})
            as resolved_attempt_state,
          family.apple_subscription_status as mirror_status,
          subscription.status as ledger_status
        from public.families family
        join public.family_billing_subscriptions subscription
          on subscription.family_id = family.id
         and subscription.provider = 'apple'
         and subscription.provider_subscription_id = ${subscriptionId}
        where family.id = ${familyId}
      `;
      assert.deepEqual(completedPurchase, {
        active_interlocks: 1,
        active_attempt_id: newerAttempt.attemptId,
        resolved_attempt_state: "resolved",
        mirror_status: "active",
        ledger_status: "active",
      });

      const newerAttemptBlocked = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
      );
      assert.equal(newerAttemptBlocked.state, "blocked");
      assert.equal(newerAttemptBlocked.accessClosed, false);
      assert.match(newerAttemptBlocked.message, /Return to Homa/u);
      assert.equal(
        await abandonApplePurchaseInterlock(
          familyId,
          newerAttempt.attemptId,
        ),
        true,
      );

      const newerObservedAtMs = purchaseDateMs + 5_000;
      await recordVerifiedFamilyAppleSubscriptionStatus(familyId, {
        originalTransactionId: subscriptionId,
        status: "active",
        productId: "homa_regular_monthly",
        tier: "regular",
        period: "monthly",
        expiresAtMs: purchaseDateMs + 86_400_000,
        providerObservedAtMs: newerObservedAtMs,
      });
      await recordVerifiedFamilyAppleSubscriptionStatus(familyId, {
        originalTransactionId: subscriptionId,
        status: "canceled",
        productId: "homa_regular_monthly",
        tier: "regular",
        period: "monthly",
        expiresAtMs: purchaseDateMs + 86_400_000,
        providerObservedAtMs: purchaseDateMs + 2_000,
      });
      const [monotonicState] = await sql<Array<{
        mirror_status: string | null;
        ledger_status: string;
        mirror_observed_at_ms: string;
        ledger_observed_at_ms: string;
      }>>`
        select family.apple_subscription_status as mirror_status,
               subscription.status as ledger_status,
               (extract(epoch from family.apple_provider_observed_at) * 1000)::bigint::text
                 as mirror_observed_at_ms,
               (extract(epoch from subscription.last_observed_at) * 1000)::bigint::text
                 as ledger_observed_at_ms
        from public.families family
        join public.family_billing_subscriptions subscription
          on subscription.family_id = family.id
         and subscription.provider = 'apple'
         and subscription.provider_subscription_id = ${subscriptionId}
        where family.id = ${familyId}
      `;
      assert.deepEqual(monotonicState, {
        mirror_status: "active",
        ledger_status: "active",
        mirror_observed_at_ms: String(newerObservedAtMs),
        ledger_observed_at_ms: String(newerObservedAtMs),
      });

      const activeBlocked = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
      );
      assert.equal(activeBlocked.state, "blocked");
      assert.equal(activeBlocked.accessClosed, false);

      await recordVerifiedFamilyAppleSubscriptionStatus(familyId, {
        originalTransactionId: subscriptionId,
        status: "canceled",
        productId: "homa_regular_monthly",
        tier: "regular",
        period: "monthly",
        expiresAtMs: purchaseDateMs + 86_400_000,
        purchaseDateMs,
        providerObservedAtMs: purchaseDateMs + 10_000,
      });
      const accepted = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        { ...NOOP_STRIPE_RECONCILIATION, worker: NOOP_ARTIFACT_WORKER },
      );
      assert.equal(accepted.state, "in_progress");
      assert.equal(accepted.accessClosed, true);
      assert.ok(accepted.deletionReceipt);
      jobId = accepted.deletionReceipt;
      assert.deepEqual(await fixtureCounts(sql, familyId, userId), {
        families: 0,
        memberships: 0,
        children: 0,
        users: 1,
      });
    } finally {
      releaseMarkerTransaction();
      if (jobId) {
        await sql`
          delete from public.account_deletion_jobs where id = ${jobId}
        `.catch(() => undefined);
      }
      await sql`
        delete from public.families where id = ${familyId}
      `.catch(() => undefined);
      await sql`
        delete from auth.users where id = ${userId}
      `.catch(() => undefined);
      await Promise.all([
        sql.end({ timeout: 5 }),
        gateSql.end({ timeout: 5 }),
      ]);
    }
  },
);

test(
  "billing preparation failure preserves access and a lost commit acknowledgment recovers",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const familyId = randomUUID();
    const userId = randomUUID();
    const sessionId = randomUUID();
    const familyName = `Preparing deletion ${randomUUID()}`;
    const nativeSubscriptionId = `apple-${randomUUID()}`;
    let jobId: string | null = null;
    let reconciliationAttempts = 0;
    let lostCommitAcknowledgments = 0;
    let preparationCommitAcknowledgments = 0;
    let lostPreparationCommitAcknowledgments = 0;

    const dependencies = {
      ...NOOP_STRIPE_RECONCILIATION,
      worker: NOOP_ARTIFACT_WORKER,
      reconcileStripe: async () => {
        reconciliationAttempts += 1;
        const [committedFence] = await sql<
          Array<{
            jobs: number;
            tombstones: number;
            families: number;
            memberships: number;
            sessions: number;
            status: string;
          }>
        >`
          select
            (select count(*)::integer
               from public.account_deletion_jobs
              where family_id = ${familyId}) as jobs,
            (select count(*)::integer
               from public.account_deletion_artifact_tombstones
              where family_id = ${familyId}) as tombstones,
            (select count(*)::integer
               from public.families
              where id = ${familyId}) as families,
            (select count(*)::integer
               from public.family_members
              where family_id = ${familyId}) as memberships,
            (select count(*)::integer
               from auth.sessions
              where user_id = ${userId}) as sessions,
            (select status
               from public.account_deletion_jobs
              where family_id = ${familyId}) as status
        `;
        assert.deepEqual(committedFence, {
          jobs: 1,
          tombstones: 1,
          families: 1,
          memberships: 1,
          sessions: 1,
          status: "running",
        });
        if (reconciliationAttempts === 1) {
          throw new Error("simulated provider uncertainty");
        }
        return NOOP_STRIPE_RECONCILIATION.reconcileStripe();
      },
      acknowledgeAcceptance: async () => {
        lostCommitAcknowledgments += 1;
        throw new Error("simulated lost commit acknowledgment");
      },
      acknowledgePreparationCommit: async () => {
        preparationCommitAcknowledgments += 1;
        if (preparationCommitAcknowledgments <= 2) {
          lostPreparationCommitAcknowledgments += 1;
          throw new Error("simulated lost preparation commit acknowledgment");
        }
      },
    };

    try {
      const [sessionTable] = await sql<{ present: boolean }[]>`
        select to_regclass('auth.sessions') is not null as present
      `;
      if (!sessionTable.present) {
        await sql`
          create table auth.sessions (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users (id) on delete cascade,
            created_at timestamptz not null default now()
          )
        `;
      }
      await sql`
        insert into auth.users (id, email)
        values (${userId}, ${`account-delete-preparing-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into auth.sessions (id, user_id)
        values (${sessionId}, ${userId})
      `;
      await sql`
        insert into public.families (id, name)
        values (${familyId}, ${familyName})
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values (${familyId}, ${userId}, 'parent')
      `;

      const preparing = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        dependencies,
      );
      assert.equal(preparing.state, "in_progress");
      assert.equal(preparing.accessClosed, false);
      assert.ok(preparing.deletionReceipt);
      jobId = preparing.deletionReceipt;
      assert.equal(reconciliationAttempts, 0);
      assert.equal(lostPreparationCommitAcknowledgments, 1);
      assert.deepEqual(await fixtureCounts(sql, familyId, userId), {
        families: 1,
        memberships: 1,
        children: 0,
        users: 1,
      });
      const [retryState] = await sql<
        Array<{ status: string; last_error: string | null; sessions: number }>
      >`
        select status, last_error,
               (select count(*)::integer
                  from auth.sessions
                 where user_id = ${userId}) as sessions
        from public.account_deletion_jobs
        where id = ${jobId}
      `;
      assert.deepEqual(retryState, {
        status: "preparing",
        last_error: null,
        sessions: 1,
      });

      const providerRetry = await runAccountDeletionJob(jobId, {
        ...NOOP_DELETION_JOB,
        reconcileStripe: dependencies.reconcileStripe,
      });
      assert.equal(providerRetry.state, "in_progress");
      assert.equal(providerRetry.accessClosed, false);
      assert.equal(providerRetry.deletionReceipt, jobId);
      assert.equal(reconciliationAttempts, 1);
      const [providerRetryState] = await sql<
        Array<{ status: string; last_error: string | null }>
      >`
        select status, last_error
        from public.account_deletion_jobs
        where id = ${jobId}
      `;
      assert.deepEqual(providerRetryState, {
        status: "preparing",
        last_error: "preparation_failed",
      });

      await assert.rejects(
        beginApplePurchaseInterlock(
          familyId,
          "homa_regular_monthly",
          randomUUID(),
        ),
        ApplePurchaseInterlockUnavailableError,
      );

      await assert.rejects(
        recordFamilyAppleSubscription(familyId, {
          originalTransactionId: nativeSubscriptionId,
          status: "active",
          productId: "homa_regular_monthly",
          tier: "regular",
          period: "monthly",
          expiresAtMs: Date.now() + 86_400_000,
        }),
        AppleFamilyUnavailableError,
      );
      const [activeNativeState] = await sql<
        Array<{ mirror_status: string | null; ledger_status: string }>
      >`
        select family.apple_subscription_status as mirror_status,
               subscription.status as ledger_status
        from public.families family
        join public.family_billing_subscriptions subscription
          on subscription.family_id = family.id
         and subscription.provider = 'apple'
         and subscription.provider_subscription_id = ${nativeSubscriptionId}
        where family.id = ${familyId}
      `;
      assert.deepEqual(activeNativeState, {
        mirror_status: "active",
        ledger_status: "active",
      });
      await sql`
        update public.account_deletion_jobs
        set status = 'running', updated_at = now()
        where id = ${jobId}
      `;
      const blocked = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        dependencies,
      );
      assert.equal(blocked.state, "blocked");
      assert.equal(blocked.accessClosed, false);
      assert.equal(blocked.deletionReceipt, jobId);
      assert.equal(reconciliationAttempts, 1);
      assert.equal(lostPreparationCommitAcknowledgments, 2);
      const [blockedJob] = await sql<Array<{ status: string }>>`
        select status from public.account_deletion_jobs where id = ${jobId}
      `;
      assert.equal(blockedJob.status, "running");
      await sql`
        update public.account_deletion_jobs
        set updated_at = now() - interval '16 minutes'
        where id = ${jobId}
      `;
      const workerBlocked = await runAccountDeletionJob(
        jobId,
        NOOP_DELETION_JOB,
      );
      assert.equal(workerBlocked.state, "blocked");
      assert.equal(workerBlocked.accessClosed, false);
      assert.equal(workerBlocked.deletionReceipt, jobId);
      const [durablyBlockedJob] = await sql<Array<{ status: string }>>`
        select status from public.account_deletion_jobs where id = ${jobId}
      `;
      assert.equal(durablyBlockedJob.status, "blocked");

      await recordVerifiedFamilyAppleSubscriptionStatus(familyId, {
        originalTransactionId: nativeSubscriptionId,
        status: "canceled",
        productId: "homa_regular_monthly",
        tier: "regular",
        period: "monthly",
        expiresAtMs: Date.now(),
      });
      const [terminalNativeState] = await sql<
        Array<{ mirror_status: string | null; ledger_status: string }>
      >`
        select family.apple_subscription_status as mirror_status,
               subscription.status as ledger_status
        from public.families family
        join public.family_billing_subscriptions subscription
          on subscription.family_id = family.id
         and subscription.provider = 'apple'
         and subscription.provider_subscription_id = ${nativeSubscriptionId}
        where family.id = ${familyId}
      `;
      assert.deepEqual(terminalNativeState, {
        mirror_status: "canceled",
        ledger_status: "canceled",
      });
      const accepted = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        dependencies,
      );
      assert.equal(accepted.state, "in_progress");
      assert.equal(accepted.accessClosed, true);
      assert.equal(accepted.deletionReceipt, jobId);
      assert.equal(reconciliationAttempts, 2);
      assert.equal(lostCommitAcknowledgments, 1);
      assert.equal(preparationCommitAcknowledgments, 3);
      assert.deepEqual(await fixtureCounts(sql, familyId, userId), {
        families: 0,
        memberships: 0,
        children: 0,
        users: 1,
      });
      const [acceptedJob] = await sql<
        Array<{ status: string; sessions: number; drain_seconds: number }>
      >`
        select status,
               (select count(*)::integer
                  from auth.sessions
                 where user_id = ${userId}) as sessions,
               extract(epoch from final_cleanup_after - updated_at)::integer
                 as drain_seconds
        from public.account_deletion_jobs
        where id = ${jobId}
      `;
      assert.equal(acceptedJob.status, "waiting_for_artifacts");
      assert.equal(acceptedJob.sessions, 0);
      assert.ok(acceptedJob.drain_seconds >= 23_399);
      assert.ok(acceptedJob.drain_seconds <= 23_400);
    } finally {
      if (jobId) {
        await sql`
          delete from public.account_deletion_jobs where id = ${jobId}
        `.catch(() => undefined);
      }
      await sql`
        delete from public.families where id = ${familyId}
      `.catch(() => undefined);
      await sql`
        delete from auth.users where id = ${userId}
      `.catch(() => undefined);
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "successful deletion drains providers, verifies quiet, and keeps sweeping its tombstone",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const familyId = randomUUID();
    const userId = randomUUID();
    const childId = randomUUID();
    const sessionId = randomUUID();
    const avatarObjectId = randomUUID();
    const controlFamilyId = randomUUID();
    const inheritedArtifactFamilyId = randomUUID();
    const targetModelUsageId = randomUUID();
    const controlModelUsageId = randomUUID();
    const targetEmailSendId = randomUUID();
    const controlEmailSendId = randomUUID();
    const targetEmailAckId = randomUUID();
    const controlEmailAckId = randomUUID();
    const targetPhoneLeadId = randomUUID();
    const controlPhoneLeadId = randomUUID();
    const targetTaskRunId = randomUUID();
    const retainedKnowledgeId = randomUUID();
    const targetHashSeed = randomUUID().replaceAll("-", "");
    const controlHashSeed = randomUUID().replaceAll("-", "");
    const targetEmailHash = `${targetHashSeed}${targetHashSeed}`;
    const controlEmailHash = `${controlHashSeed}${controlHashSeed}`;
    const targetPhoneDigits = randomUUID()
      .replaceAll(/[^0-9]/gu, "")
      .padEnd(7, "0")
      .slice(0, 7);
    const controlPhoneDigits = randomUUID()
      .replaceAll(/[^0-9]/gu, "")
      .padEnd(7, "1")
      .slice(0, 7);
    const targetPhone = `+1202${targetPhoneDigits}`;
    const controlPhone = `+1303${controlPhoneDigits}`;
    const familyName = `Successful deletion ${randomUUID()}`;
    const operations: string[] = [];
    const workspaceSweeps: string[] = [];
    const artifactFamilyIds: string[] = [familyId, inheritedArtifactFamilyId];
    const publicBlobCounts = new Map<string, number>(
      artifactFamilyIds.map((artifactFamilyId) => [artifactFamilyId, 1]),
    );
    const privateBlobCounts = new Map<string, number>(
      artifactFamilyIds.map((artifactFamilyId) => [artifactFamilyId, 1]),
    );
    const resetBlobCounts = (count: number) => {
      for (const artifactFamilyId of artifactFamilyIds) {
        publicBlobCounts.set(artifactFamilyId, count);
        privateBlobCounts.set(artifactFamilyId, count);
      }
    };
    const remainingBlobCount = () =>
      [...publicBlobCounts.values(), ...privateBlobCounts.values()]
        .reduce((total, count) => total + count, 0);
    let avatarSweeps = 0;
    let authSweeps = 0;
    let jobId: string | null = null;

    const worker: AccountDeletionWorkerDependencies = {
      deleteWorkspaceDrives: async (deletedFamilyId) => {
        workspaceSweeps.push(deletedFamilyId);
        assert.equal(artifactFamilyIds.includes(deletedFamilyId), true);
        return 0;
      },
      deleteAvatars: async (userIds) => {
        operations.push("avatar");
        assert.deepEqual(userIds, [userId]);
        const [state] = await sql<
          Array<{
            families: number;
            memberships: number;
            children: number;
            sessions: number;
            users: number;
            avatars: number;
          }>
        >`
          select
            (select count(*)::integer from public.families where id = ${familyId}) as families,
            (select count(*)::integer from public.family_members where family_id = ${familyId}) as memberships,
            (select count(*)::integer from public.children where family_id = ${familyId}) as children,
            (select count(*)::integer from auth.sessions where user_id = ${userId}) as sessions,
            (select count(*)::integer from auth.users where id = ${userId}) as users,
            (select count(*)::integer from storage.objects where id = ${avatarObjectId}) as avatars
        `;
        assert.deepEqual(state, avatarSweeps === 0
          ? {
              families: 0,
              memberships: 0,
              children: 0,
              sessions: 0,
              users: 1,
              avatars: 1,
            }
          : {
              families: 0,
              memberships: 0,
              children: 0,
              sessions: 0,
              users: 0,
              avatars: 0,
            });
        avatarSweeps += 1;
        const deleted = await sql<Array<{ id: string }>>`
          delete from storage.objects
          where id = ${avatarObjectId}
          returning id
        `;
        return deleted.length;
      },
      deleteAuthUsers: async (userIds) => {
        operations.push("auth");
        assert.deepEqual(userIds, [userId]);
        const [state] = await sql<
          Array<{ sessions: number; users: number; avatars: number }>
        >`
          select
            (select count(*)::integer from auth.sessions where user_id = ${userId}) as sessions,
            (select count(*)::integer from auth.users where id = ${userId}) as users,
            (select count(*)::integer from storage.objects where id = ${avatarObjectId}) as avatars
        `;
        assert.deepEqual(state, {
          sessions: 0,
          users: authSweeps === 0 ? 1 : 0,
          avatars: 0,
        });
        authSweeps += 1;
        const deleted = await sql<Array<{ id: string }>>`
          delete from auth.users
          where id = ${userId}
          returning id
        `;
        return deleted.length;
      },
      deletePublicFamilyBlobs: async (deletedFamilyId) => {
        operations.push("public");
        assert.equal(artifactFamilyIds.includes(deletedFamilyId), true);
        const deleted = publicBlobCounts.get(deletedFamilyId) ?? 0;
        publicBlobCounts.set(deletedFamilyId, 0);
        return deleted;
      },
      deletePrivateFamilyBlobs: async (deletedFamilyId) => {
        operations.push("private");
        assert.equal(artifactFamilyIds.includes(deletedFamilyId), true);
        const deleted = privateBlobCounts.get(deletedFamilyId) ?? 0;
        privateBlobCounts.set(deletedFamilyId, 0);
        return deleted;
      },
    };

    const readJob = async (id: string) => {
      const rows = await sql<
        Array<{
          family_id: string | null;
          requested_by_user_id: string | null;
          storage_user_ids: string[] | null;
          status: string;
          attempts: number;
          artifact_count: number | null;
          drain_seconds: number;
          artifact_quiet_since: string | null;
          completed_at: string | null;
        }>
      >`
        select family_id, requested_by_user_id, storage_user_ids, status, attempts,
               artifact_count,
               extract(epoch from final_cleanup_after - updated_at)::integer as drain_seconds,
               artifact_quiet_since::text as artifact_quiet_since,
               completed_at::text as completed_at
        from public.account_deletion_jobs
        where id = ${id}
      `;
      assert.equal(rows.length, 1);
      return rows[0];
    };

    try {
      const [sessionTable] = await sql<{ present: boolean }[]>`
        select to_regclass('auth.sessions') is not null as present
      `;
      if (!sessionTable.present) {
        await sql`
          create table auth.sessions (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users (id) on delete cascade,
            created_at timestamptz not null default now()
          )
        `;
      }

      await sql`
        insert into auth.users (id, email)
        values (${userId}, ${`account-delete-success-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into auth.sessions (id, user_id)
        values (${sessionId}, ${userId})
      `;
      await sql`
        insert into storage.objects (id, bucket_id, name, owner)
        values (
          ${avatarObjectId},
          'avatars',
          ${`${userId}/successful-deletion.jpg`},
          ${userId}
        )
      `;
      await sql`
        insert into public.families (id, name)
        values
          (${familyId}, ${familyName}),
          (${controlFamilyId}, 'Retained-ledger control')
      `;
      await sql`
        insert into public.family_artifact_prefixes (
          owner_family_id,
          artifact_family_id
        )
        values (${familyId}, ${inheritedArtifactFamilyId})
      `;
      await sql`
        insert into public.family_artifact_prefix_candidates (
          owner_family_id,
          artifact_family_id,
          evidence_kind,
          evidence_count
        )
        values (
          ${familyId},
          ${inheritedArtifactFamilyId},
          'material_output',
          1
        )
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role)
        values (${familyId}, ${userId}, 'parent')
      `;
      await sql`
        insert into public.children (id, family_id, name, birth_month)
        values (${childId}, ${familyId}, 'Successful deletion child', '2018-01-01')
      `;
      await sql`
        insert into public.model_usage
          (id, family_id, surface, model, modality)
        values
          (${targetModelUsageId}, ${familyId}, 'account_deletion_target', 'test-model', 'text'),
          (${controlModelUsageId}, ${controlFamilyId}, 'account_deletion_control', 'test-model', 'text')
      `;
      await sql`
        insert into public.email_sends
          (id, family_id, kind, to_hash, status)
        values
          (${targetEmailSendId}, ${familyId}, 'deletion_target', ${targetEmailHash}, 'submitted'),
          (${controlEmailSendId}, ${controlFamilyId}, 'deletion_control', ${controlEmailHash}, 'submitted')
      `;
      await sql`
        insert into public.admin_alert_acknowledgments
          (id, source, source_id, acknowledged_by)
        values
          (${targetEmailAckId}, 'email_send', ${targetEmailSendId}, 'test@example.invalid'),
          (${controlEmailAckId}, 'email_send', ${controlEmailSendId}, 'test@example.invalid')
      `;
      await sql`
        insert into public.family_phones (family_id, phone_e164, source)
        values
          (${familyId}, ${targetPhone}, 'home'),
          (${controlFamilyId}, ${controlPhone}, 'home')
      `;
      await sql`
        insert into public.phone_leads (id, phone_e164, first_channel)
        values
          (${targetPhoneLeadId}, ${targetPhone}, 'sms'),
          (${controlPhoneLeadId}, ${controlPhone}, 'sms')
      `;
      await sql`
        insert into public.email_suppressions (email_hash, scope, reason)
        values (${targetEmailHash}, 'all', 'deletion-test')
      `;
      await sql`
        insert into public.sms_suppressions (phone_e164, reason)
        values (${targetPhone}, 'deletion-test')
      `;
      await sql`
        insert into public.homa_task_runs
          (id, family_id, kind, status, title)
        values
          (${targetTaskRunId}, ${familyId}, 'custom', 'done', 'Deletion retention fixture')
      `;
      await sql`
        insert into public.knowledge_bank
          (id, topic_type, topic_key, title, summary, content, run_id)
        values (
          ${retainedKnowledgeId},
          'other',
          ${`deletion-${randomUUID()}`},
          'Fleet knowledge survives family deletion',
          'A fleet-wide record used to prove account deletion retention.',
          'This fixture contains no family or child data and must remain.',
          ${targetTaskRunId}
        )
      `;

      await sql`
        insert into public.family_workspace_files (family_id, namespace, path, revision, sha256, byte_size, blob_url)
        values (${familyId}, 'production', 'drafts/delete-me.md', ${randomUUID()}, ${"a".repeat(64)}, 4, 'https://fixture.invalid/file')
      `;
      const requested = await requestAccountDeletion(
        {
          familyId,
          userId,
          confirmation: deletionConfirmationFor(familyName),
        },
        {
          ...NOOP_STRIPE_RECONCILIATION,
          worker,
        },
      );
      assert.equal(requested.state, "in_progress");
      assert.equal(requested.accessClosed, true);
      assert.ok(requested.deletionReceipt);
      jobId = requested.deletionReceipt;
      assert.deepEqual(operations, []);
      assert.equal(remainingBlobCount(), 4);
      assert.deepEqual(await fixtureCounts(sql, familyId, userId), {
        families: 0,
        memberships: 0,
        children: 0,
        users: 1,
      });
      const [resolvedCandidateState] = await sql<Array<{ candidates: number }>>`
        select count(*)::integer as candidates
        from public.family_artifact_prefix_candidates
        where owner_family_id = ${familyId}
      `;
      assert.equal(resolvedCandidateState.candidates, 0);
      const [closedProviderState] = await sql<
        Array<{ sessions: number; avatars: number }>
      >`
        select
          (select count(*)::integer from auth.sessions where user_id = ${userId}) as sessions,
          (select count(*)::integer from storage.objects where id = ${avatarObjectId}) as avatars
      `;
      assert.deepEqual(closedProviderState, { sessions: 0, avatars: 1 });

      const [retentionState] = await sql<
        Array<{
          target_model_usage: number;
          control_model_usage: number;
          target_email_sends: number;
          control_email_sends: number;
          target_email_acks: number;
          control_email_acks: number;
          target_phone_leads: number;
          control_phone_leads: number;
          target_phone_epochs: number;
          target_email_suppressions: number;
          target_sms_suppressions: number;
          retained_knowledge: number;
          retained_knowledge_detached: number;
        }>
      >`
        select
          (select count(*)::integer from public.model_usage
            where id = ${targetModelUsageId}) as target_model_usage,
          (select count(*)::integer from public.model_usage
            where id = ${controlModelUsageId}) as control_model_usage,
          (select count(*)::integer from public.email_sends
            where id = ${targetEmailSendId}) as target_email_sends,
          (select count(*)::integer from public.email_sends
            where id = ${controlEmailSendId}) as control_email_sends,
          (select count(*)::integer from public.admin_alert_acknowledgments
            where id = ${targetEmailAckId}) as target_email_acks,
          (select count(*)::integer from public.admin_alert_acknowledgments
            where id = ${controlEmailAckId}) as control_email_acks,
          (select count(*)::integer from public.phone_leads
            where id = ${targetPhoneLeadId}) as target_phone_leads,
          (select count(*)::integer from public.phone_leads
            where id = ${controlPhoneLeadId}) as control_phone_leads,
          (select count(*)::integer from public.family_phone_access_epochs
            where phone_e164 = ${targetPhone}) as target_phone_epochs,
          (select count(*)::integer from public.email_suppressions
            where email_hash = ${targetEmailHash}) as target_email_suppressions,
          (select count(*)::integer from public.sms_suppressions
            where phone_e164 = ${targetPhone}) as target_sms_suppressions,
          (select count(*)::integer from public.knowledge_bank
            where id = ${retainedKnowledgeId}) as retained_knowledge,
          (select count(*)::integer from public.knowledge_bank
            where id = ${retainedKnowledgeId} and run_id is null)
            as retained_knowledge_detached
      `;
      assert.deepEqual(retentionState, {
        target_model_usage: 0,
        control_model_usage: 1,
        target_email_sends: 0,
        control_email_sends: 1,
        target_email_acks: 0,
        control_email_acks: 1,
        target_phone_leads: 0,
        control_phone_leads: 1,
        target_phone_epochs: 1,
        target_email_suppressions: 1,
        target_sms_suppressions: 1,
        retained_knowledge: 1,
        retained_knowledge_detached: 1,
      });

      const firstSweepJob = await readJob(jobId);
      assert.equal(firstSweepJob.family_id, familyId);
      assert.equal(firstSweepJob.requested_by_user_id, null);
      assert.deepEqual(firstSweepJob.storage_user_ids, [userId]);
      assert.equal(firstSweepJob.status, "waiting_for_artifacts");
      assert.equal(firstSweepJob.attempts, 1);
      assert.equal(firstSweepJob.artifact_count, null);
      assert.equal(firstSweepJob.drain_seconds, 23_400);
      assert.equal(firstSweepJob.artifact_quiet_since, null);
      assert.equal(firstSweepJob.completed_at, null);
      const initialTombstones = await sql<
        Array<{ family_id: string; deletion_job_id: string; last_swept_at: string | null }>
      >`
        select family_id, deletion_job_id, last_swept_at::text as last_swept_at
        from public.account_deletion_artifact_tombstones
        where deletion_job_id = ${jobId}
        order by family_id
      `;
      assert.deepEqual(
        new Set(initialTombstones.map((row) => row.family_id)),
        new Set(artifactFamilyIds),
      );
      assert.equal(
        initialTombstones.every((row) =>
          row.deletion_job_id === jobId && row.last_swept_at === null
        ),
        true,
      );

      await sql`
        update public.account_deletion_jobs
        set status = 'running', updated_at = now()
        where id = ${jobId}
      `;
      const duplicateWorker = await runAccountDeletionJob(jobId, worker);
      assert.equal(duplicateWorker.state, "in_progress");
      assert.equal(duplicateWorker.accessClosed, true);
      assert.equal(duplicateWorker.deletionReceipt, jobId);
      assert.deepEqual(operations, []);
      await sql`
        update public.account_deletion_jobs
        set status = 'waiting_for_artifacts', updated_at = now()
        where id = ${jobId}
      `;

      operations.length = 0;
      const firstArtifactSweep = await runAccountDeletionJob(jobId, worker);
      assert.equal(firstArtifactSweep.state, "in_progress");
      assert.equal(firstArtifactSweep.accessClosed, true);
      assert.equal(firstArtifactSweep.deletionReceipt, jobId);
      assert.deepEqual(operations.slice(0, 2), ["avatar", "auth"]);
      assert.deepEqual(
        operations.slice(2).sort(),
        ["private", "private", "public", "public"],
      );
      assert.equal(remainingBlobCount(), 0);
      assert.deepEqual(await fixtureCounts(sql, familyId, userId), {
        families: 0,
        memberships: 0,
        children: 0,
        users: 0,
      });
      const [closedArtifactState] = await sql<
        Array<{ sessions: number; avatars: number }>
      >`
        select
          (select count(*)::integer from auth.sessions where user_id = ${userId}) as sessions,
          (select count(*)::integer from storage.objects where id = ${avatarObjectId}) as avatars
      `;
      assert.deepEqual(closedArtifactState, { sessions: 0, avatars: 0 });
      assert.deepEqual(new Set(workspaceSweeps), new Set(artifactFamilyIds));
      const [workspaceRemaining] = await sql`select count(*)::int as count from public.family_workspace_files where family_id = ${familyId}`;
      assert.equal(workspaceRemaining.count, 0);
      const firstArtifactSweepJob = await readJob(jobId);
      assert.equal(firstArtifactSweepJob.family_id, familyId);
      assert.equal(firstArtifactSweepJob.status, "waiting_for_artifacts");
      assert.equal(firstArtifactSweepJob.attempts, 2);
      assert.equal(firstArtifactSweepJob.artifact_count, 6);
      assert.equal(firstArtifactSweepJob.artifact_quiet_since, null);
      assert.equal(firstArtifactSweepJob.completed_at, null);

      operations.length = 0;
      const beforeDrain = await runAccountDeletionJob(jobId, worker);
      assert.equal(beforeDrain.state, "in_progress");
      assert.equal(beforeDrain.accessClosed, true);
      assert.equal(beforeDrain.deletionReceipt, jobId);
      const beforeDrainJob = await readJob(jobId);
      assert.equal(beforeDrainJob.family_id, familyId);
      assert.equal(beforeDrainJob.status, "waiting_for_artifacts");
      assert.equal(beforeDrainJob.attempts, 3);
      assert.equal(beforeDrainJob.artifact_count, 6);
      assert.equal(beforeDrainJob.artifact_quiet_since, null);
      assert.equal(beforeDrainJob.completed_at, null);

      resetBlobCounts(1);
      operations.length = 0;
      await sql`
        update public.account_deletion_jobs
        set final_cleanup_after = now() - interval '1 second'
        where id = ${jobId}
      `;
      const delegatedUploadSweep = await runAccountDeletionJob(jobId, worker);
      assert.equal(delegatedUploadSweep.state, "in_progress");
      assert.equal(remainingBlobCount(), 0);
      assert.equal((operations as string[]).includes("public"), true);
      assert.equal((operations as string[]).includes("private"), true);
      const verifyingJob = await readJob(jobId);
      assert.equal(verifyingJob.family_id, familyId);
      assert.equal(verifyingJob.status, "waiting_for_artifacts");
      assert.equal(verifyingJob.attempts, 4);
      assert.equal(verifyingJob.artifact_count, 10);
      assert.ok(verifyingJob.artifact_quiet_since);
      assert.equal(verifyingJob.completed_at, null);
      const quietSince = verifyingJob.artifact_quiet_since;

      operations.length = 0;
      const prematureQuietCheck = await runAccountDeletionJob(jobId, worker);
      assert.equal(prematureQuietCheck.state, "in_progress");
      const prematureQuietJob = await readJob(jobId);
      assert.equal(prematureQuietJob.family_id, familyId);
      assert.equal(prematureQuietJob.status, "waiting_for_artifacts");
      assert.equal(prematureQuietJob.attempts, 5);
      assert.equal(prematureQuietJob.artifact_count, 10);
      assert.equal(prematureQuietJob.artifact_quiet_since, quietSince);
      assert.equal(prematureQuietJob.completed_at, null);

      await sql`
        update public.account_deletion_jobs
        set artifact_quiet_since = now() - interval '2 minutes 1 second'
        where id = ${jobId}
      `;
      const completed = await runAccountDeletionJob(jobId, worker);
      assert.equal(completed.state, "complete");
      assert.equal(completed.deletionReceipt, jobId);
      const completedJob = await readJob(jobId);
      assert.equal(completedJob.family_id, null);
      assert.equal(completedJob.requested_by_user_id, null);
      assert.equal(completedJob.storage_user_ids, null);
      assert.equal(completedJob.status, "complete");
      assert.equal(completedJob.attempts, 6);
      assert.equal(completedJob.artifact_count, 10);
      assert.ok(completedJob.completed_at);

      resetBlobCounts(1);
      operations.length = 0;
      workspaceSweeps.length = 0;
      await sweepCompletedDeletionTombstones(10, worker);
      assert.equal(workspaceSweeps.length, operations.length ? artifactFamilyIds.length : 0);
      assert.equal(remainingBlobCount(), 0);
      assert.deepEqual(
        operations.sort(),
        ["private", "private", "public", "public"],
      );
      const firstCompletedSweeps = await sql<
        Array<{ family_id: string; deletion_job_id: string; last_swept_at: string | null }>
      >`
        select family_id, deletion_job_id, last_swept_at::text as last_swept_at
        from public.account_deletion_artifact_tombstones
        where deletion_job_id = ${jobId}
        order by family_id
      `;
      assert.deepEqual(
        new Set(firstCompletedSweeps.map((row) => row.family_id)),
        new Set(artifactFamilyIds),
      );
      assert.equal(
        firstCompletedSweeps.every((row) =>
          row.deletion_job_id === jobId && Boolean(row.last_swept_at)
        ),
        true,
      );

      resetBlobCounts(1);
      operations.length = 0;
      workspaceSweeps.length = 0;
      await sweepCompletedDeletionTombstones(10, worker);
      assert.equal(workspaceSweeps.length, operations.length ? artifactFamilyIds.length : 0);
      assert.equal(remainingBlobCount(), 4);
      assert.deepEqual(operations, []);

      await sql`
        update public.account_deletion_artifact_tombstones
        set last_swept_at = now() - interval '5 minutes 1 second'
        where deletion_job_id = ${jobId}
      `;
      workspaceSweeps.length = 0;
      await sweepCompletedDeletionTombstones(10, worker);
      assert.equal(workspaceSweeps.length, operations.length ? artifactFamilyIds.length : 0);
      assert.equal(remainingBlobCount(), 0);
      assert.deepEqual(
        operations.sort(),
        ["private", "private", "public", "public"],
      );
      const [permanentTombstone] = await sql<
        Array<{ count: number; last_swept_at: string | null }>
      >`
        select count(*)::integer as count,
               max(last_swept_at)::text as last_swept_at
        from public.account_deletion_artifact_tombstones
        where deletion_job_id = ${jobId}
      `;
      assert.equal(permanentTombstone.count, 2);
      assert.ok(permanentTombstone.last_swept_at);
    } finally {
      await sql`
        delete from public.knowledge_bank
        where id = ${retainedKnowledgeId}
      `.catch(() => undefined);
      await sql`
        delete from public.admin_alert_acknowledgments
        where id in (${targetEmailAckId}, ${controlEmailAckId})
      `.catch(() => undefined);
      await sql`
        delete from public.email_sends
        where id in (${targetEmailSendId}, ${controlEmailSendId})
      `.catch(() => undefined);
      await sql`
        delete from public.model_usage
        where id in (${targetModelUsageId}, ${controlModelUsageId})
      `.catch(() => undefined);
      await sql`
        delete from public.phone_leads
        where id in (${targetPhoneLeadId}, ${controlPhoneLeadId})
      `.catch(() => undefined);
      await sql`
        delete from public.email_suppressions
        where email_hash = ${targetEmailHash}
      `.catch(() => undefined);
      await sql`
        delete from public.sms_suppressions
        where phone_e164 = ${targetPhone}
      `.catch(() => undefined);
      if (jobId) {
        await sql`
          delete from public.account_deletion_jobs
          where id = ${jobId}
        `.catch(() => undefined);
      }
      await sql`
        delete from public.account_deletion_jobs
        where family_id = ${familyId}
      `.catch(() => undefined);
      await sql`
        delete from storage.objects
        where id = ${avatarObjectId}
      `.catch(() => undefined);
      await sql`
        delete from public.families
        where id in (${familyId}, ${controlFamilyId})
      `.catch(() => undefined);
      await sql`
        delete from public.family_phone_access_epochs
        where phone_e164 in (${targetPhone}, ${controlPhone})
      `.catch(() => undefined);
      await sql`
        delete from auth.users
        where id = ${userId}
      `.catch(() => undefined);
      await sql.end({ timeout: 5 });
    }
  },
);

test(
  "simultaneous family deletions safely converge on one shared Auth user",
  { skip: databaseUrl === undefined, timeout: 30_000 },
  async () => {
    assert.ok(databaseUrl);
    const sql = postgres(databaseUrl, { prepare: false, max: 2 });
    const gateSql = postgres(databaseUrl, { prepare: false, max: 1 });
    const previousIsolationFlag = process.env[EVAL_ISOLATION_FLAG];
    const previousPrivateBlobToken = process.env.HOMA_LESSON_READ_WRITE_TOKEN;
    process.env[EVAL_ISOLATION_FLAG] = "1";
    delete process.env.HOMA_LESSON_READ_WRITE_TOKEN;

    const firstFamilyId = randomUUID();
    const firstUserId = randomUUID();
    const secondFamilyId = randomUUID();
    const secondUserId = randomUUID();
    const sharedUserId = randomUUID();
    const controlFamilyId = randomUUID();
    const controlUserId = randomUUID();
    const firstFamilyName = `First concurrent target ${randomUUID()}`;
    const secondFamilyName = `Second concurrent target ${randomUUID()}`;
    const gateClassId = 878_082;
    const gateObjectId = 2;
    let gateHeld = false;

    try {
      assert.ok(resolveEvalBlobStore(process.env), "eval public Blob store must be active");
      assert.equal(process.env.HOMA_LESSON_READ_WRITE_TOKEN, undefined);

      const [sessionTable] = await sql<{ present: boolean }[]>`
        select to_regclass('auth.sessions') is not null as present
      `;
      if (!sessionTable.present) {
        await sql`
          create table auth.sessions (
            id uuid primary key default gen_random_uuid(),
            user_id uuid not null references auth.users (id) on delete cascade,
            created_at timestamptz not null default now()
          )
        `;
      }

      await sql`
        insert into auth.users (id, email)
        values
          (${firstUserId}, ${`account-delete-first-${randomUUID()}@example.invalid`}),
          (${secondUserId}, ${`account-delete-second-${randomUUID()}@example.invalid`}),
          (${sharedUserId}, ${`account-delete-shared-${randomUUID()}@example.invalid`}),
          (${controlUserId}, ${`account-delete-control-${randomUUID()}@example.invalid`})
      `;
      await sql`
        insert into auth.sessions (user_id)
        values
          (${firstUserId}),
          (${secondUserId}),
          (${sharedUserId}),
          (${controlUserId})
      `;
      await sql`
        insert into public.families (id, name)
        values
          (${firstFamilyId}, ${firstFamilyName}),
          (${secondFamilyId}, ${secondFamilyName}),
          (${controlFamilyId}, 'Concurrent deletion control')
      `;
      await sql`
        insert into public.family_members (family_id, user_id, role, created_at)
        values
          (${firstFamilyId}, ${firstUserId}, 'parent', now() - interval '2 minutes'),
          (${firstFamilyId}, ${sharedUserId}, 'partner', now() - interval '1 minute'),
          (${secondFamilyId}, ${secondUserId}, 'parent', now() - interval '2 minutes'),
          (${secondFamilyId}, ${sharedUserId}, 'partner', now() - interval '1 minute'),
          (${controlFamilyId}, ${controlUserId}, 'parent', now() - interval '2 minutes')
      `;

      // Hold both deletion transactions at the same committed trigger. Seeing
      // two distinct waiting backends proves the application pool used two
      // real PostgreSQL connections rather than serializing this regression.
      await sql`
        create or replace function public.account_deletion_test_concurrency_gate()
        returns trigger
        language plpgsql
        as $function$
        begin
          perform pg_advisory_xact_lock_shared(878082, 2);
          return new;
        end;
        $function$
      `;
      await sql`
        create trigger account_deletion_test_concurrency_gate
        before insert on public.account_deletion_jobs
        for each row execute function public.account_deletion_test_concurrency_gate()
      `;
      await gateSql`select pg_advisory_lock(${gateClassId}, ${gateObjectId})`;
      gateHeld = true;

      const deletionOutcome = Promise.all([
        requestAccountDeletion(
          {
            familyId: firstFamilyId,
            userId: firstUserId,
            confirmation: deletionConfirmationFor(firstFamilyName),
          },
          NOOP_STRIPE_RECONCILIATION,
        ),
        requestAccountDeletion(
          {
            familyId: secondFamilyId,
            userId: secondUserId,
            confirmation: deletionConfirmationFor(secondFamilyName),
          },
          NOOP_STRIPE_RECONCILIATION,
        ),
      ]);
      void deletionOutcome.catch(() => undefined);

      let waitingBackendPids: number[] = [];
      const waiterDeadline = Date.now() + 5_000;
      while (Date.now() < waiterDeadline) {
        const waiters = await sql<Array<{ pid: number }>>`
          select distinct pid
          from pg_locks
          where locktype = 'advisory'
            and classid::bigint = ${gateClassId}
            and objid::bigint = ${gateObjectId}
            and objsubid = 2
            and not granted
          order by pid
        `;
        waitingBackendPids = waiters.map((row) => row.pid);
        if (waitingBackendPids.length === 2) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      await gateSql`select pg_advisory_unlock(${gateClassId}, ${gateObjectId})`;
      gateHeld = false;
      const deletionResults = await deletionOutcome;

      assert.equal(waitingBackendPids.length, 2, "both deletion transactions must overlap");
      assert.deepEqual(
        deletionResults.map((result) => result.state),
        ["in_progress", "in_progress"],
      );

      const [finalState] = await sql<
        Array<{
          target_families: number;
          target_memberships: number;
          target_users: number;
          target_sessions: number;
          control_families: number;
          control_memberships: number;
          control_users: number;
          control_sessions: number;
        }>
      >`
        select
          (select count(*)::integer from public.families
            where id in (${firstFamilyId}, ${secondFamilyId})) as target_families,
          (select count(*)::integer from public.family_members
            where family_id in (${firstFamilyId}, ${secondFamilyId})) as target_memberships,
          (select count(*)::integer from auth.users
            where id in (${firstUserId}, ${secondUserId}, ${sharedUserId})) as target_users,
          (select count(*)::integer from auth.sessions
            where user_id in (${firstUserId}, ${secondUserId}, ${sharedUserId})) as target_sessions,
          (select count(*)::integer from public.families
            where id = ${controlFamilyId}) as control_families,
          (select count(*)::integer from public.family_members
            where family_id = ${controlFamilyId} and user_id = ${controlUserId}) as control_memberships,
          (select count(*)::integer from auth.users
            where id = ${controlUserId}) as control_users,
          (select count(*)::integer from auth.sessions
            where user_id = ${controlUserId}) as control_sessions
      `;
      assert.deepEqual(finalState, {
        target_families: 0,
        target_memberships: 0,
        target_users: 3,
        target_sessions: 0,
        control_families: 1,
        control_memberships: 1,
        control_users: 1,
        control_sessions: 1,
      });

      const jobs = await sql<
        Array<{
          family_id: string;
          status: string;
          storage_user_ids: string[] | null;
        }>
      >`
        select family_id, status, storage_user_ids
        from public.account_deletion_jobs
        where family_id in (${firstFamilyId}, ${secondFamilyId})
        order by family_id
      `;
      assert.equal(jobs.length, 2);
      assert.deepEqual(
        jobs.map((job) => job.status),
        ["waiting_for_artifacts", "waiting_for_artifacts"],
      );
      assert.equal(
        jobs.filter((job) => job.storage_user_ids?.includes(sharedUserId)).length,
        1,
        "exactly one cleanup job owns shared avatar cleanup",
      );
      assert.deepEqual(
        jobs.flatMap((job) => job.storage_user_ids ?? []).sort(),
        [firstUserId, secondUserId, sharedUserId].sort(),
      );
    } finally {
      if (gateHeld) {
        await gateSql`
          select pg_advisory_unlock(${gateClassId}, ${gateObjectId})
        `.catch(() => undefined);
      }
      await sql`
        drop trigger if exists account_deletion_test_concurrency_gate
        on public.account_deletion_jobs
      `.catch(() => undefined);
      await sql`
        drop function if exists public.account_deletion_test_concurrency_gate()
      `.catch(() => undefined);
      await sql`
        delete from public.account_deletion_jobs
        where family_id in (${firstFamilyId}, ${secondFamilyId})
      `.catch(() => undefined);
      await sql`
        delete from public.families
        where id in (${firstFamilyId}, ${secondFamilyId}, ${controlFamilyId})
      `.catch(() => undefined);
      await sql`
        delete from auth.users
        where id in (${firstUserId}, ${secondUserId}, ${sharedUserId}, ${controlUserId})
      `.catch(() => undefined);

      if (previousIsolationFlag === undefined) {
        delete process.env[EVAL_ISOLATION_FLAG];
      } else {
        process.env[EVAL_ISOLATION_FLAG] = previousIsolationFlag;
      }
      if (previousPrivateBlobToken === undefined) {
        delete process.env.HOMA_LESSON_READ_WRITE_TOKEN;
      } else {
        process.env.HOMA_LESSON_READ_WRITE_TOKEN = previousPrivateBlobToken;
      }
      await Promise.all([
        sql.end({ timeout: 5 }),
        gateSql.end({ timeout: 5 }),
      ]);
    }
  },
);
