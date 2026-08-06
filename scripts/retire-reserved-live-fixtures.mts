#!/usr/bin/env tsx
/**
 * Soft-retires old synthetic families created by the authenticated isolation,
 * continuity, recall, task, self-improving, and device-sync harnesses.
 *
 * This is production maintenance, never part of CI. It is dry-run by default,
 * accepts only already-sandboxed families with exact fixture provenance, and
 * requires the operator to confirm the target project before changing rows.
 * Auth users and family data are intentionally not hard-deleted here.
 *
 * Usage:
 *   pnpm fixtures:retire-live -- --project-ref=<ref>
 *   pnpm fixtures:retire-live -- --project-ref=<ref> --apply \
 *     --confirm="RETIRE RESERVED LIVE TEST FIXTURES"
 */
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  mapDb,
  resolveMapDbTarget,
} from "../apps/web/lib/map/db.ts";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // CI or an operator shell may provide the environment directly.
}

const CONFIRMATION = "RETIRE RESERVED LIVE TEST FIXTURES";
const MAX_CANDIDATES = 100;
const MINIMUM_AGE_HOURS = 24;

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(
    prefix.length,
  ) ?? null;
}

const apply = process.argv.includes("--apply");
const expectedProjectRef = argument("project-ref");
const confirmation = argument("confirm");

if (!expectedProjectRef) {
  throw new Error("Pass --project-ref=<ref> so the production target is explicit.");
}

const target = resolveMapDbTarget(process.env);
if (target.kind !== "supabase-pooler") {
  throw new Error("This maintenance command refuses disposable eval databases.");
}
if (target.ref !== expectedProjectRef) {
  throw new Error(
    `Project mismatch: expected ${expectedProjectRef}, resolved ${target.ref}.`,
  );
}
if (apply && confirmation !== CONFIRMATION) {
  throw new Error(`Apply requires --confirm="${CONFIRMATION}".`);
}

const sql = mapDb();

try {
  const candidates = await sql<
    {
      id: string;
      created_at: string;
      reason: string;
      active_check_ins: number;
    }[]
  >`
    select
      f.id,
      f.created_at::text as created_at,
      case
        when exists (
          select 1
          from public.family_members fm
          join auth.users u on u.id = fm.user_id
          where fm.family_id = f.id
            and (
              lower(coalesce(u.email, '')) like 'isolation-%@example.com'
              or lower(coalesce(u.email, '')) like 'continuity-%@example.com'
              or lower(coalesce(u.email, '')) like 'parented-session-%@example.com'
            )
        ) then 'authenticated CI fixture'
        when f.id = '00000000-0000-0000-0000-e2e000000001'::uuid
          then 'self-improving fixture'
        when f.name in (
          'Recall eval (synthetic)',
          'Recall eval bystander (synthetic)'
        ) then 'recall fixture'
        when f.name = 'E2E Tasks Family' and f.email = 'delivered@resend.dev'
          then 'task fixture'
        when f.name = 'Continuity fold stub'
          and f.email = 'continuity-fold-stub@example.test'
          then 'continuity fold fixture'
        else 'device-sync fixture'
      end as reason,
      (
        select count(*)::integer
        from public.progress_check_ins check_in
        where check_in.family_id = f.id
          and check_in.state in ('active', 'paused')
      ) as active_check_ins
    from public.families f
    where f.sandbox
      and f.status <> 'deleted'
      and f.created_at < now() - ${`${MINIMUM_AGE_HOURS} hours`}::interval
      and f.updated_at < now() - ${`${MINIMUM_AGE_HOURS} hours`}::interval
      and (
        exists (
          select 1
          from public.family_members fm
          join auth.users u on u.id = fm.user_id
          where fm.family_id = f.id
            and (
              lower(coalesce(u.email, '')) like 'isolation-%@example.com'
              or lower(coalesce(u.email, '')) like 'continuity-%@example.com'
              or lower(coalesce(u.email, '')) like 'parented-session-%@example.com'
            )
        )
        or f.id = '00000000-0000-0000-0000-e2e000000001'::uuid
        or f.name in (
          'Recall eval (synthetic)',
          'Recall eval bystander (synthetic)'
        )
        or (f.name = 'E2E Tasks Family' and f.email = 'delivered@resend.dev')
        or (
          f.name = 'Continuity fold stub'
          and f.email = 'continuity-fold-stub@example.test'
        )
        or (f.name = 'Sync E2E family' and f.email = 'sync-e2e@example.test')
        or (f.name = 'Other family' and f.email = 'other@example.test')
      )
    order by f.created_at, f.id
  `;

  if (candidates.length > MAX_CANDIDATES) {
    throw new Error(
      `Refusing ${candidates.length} candidates, safety ceiling is ${MAX_CANDIDATES}.`,
    );
  }

  console.log(
    `${candidates.length} reserved live fixture famil${candidates.length === 1 ? "y" : "ies"}:`,
  );
  for (const candidate of candidates) {
    console.log(
      `  ${candidate.id}  ${candidate.created_at}  ${candidate.reason}  ` +
        `${candidate.active_check_ins} active or paused check-ins`,
    );
  }

  if (!apply || candidates.length === 0) {
    console.log(
      apply
        ? "No eligible fixtures to retire."
        : "Dry run. Add --apply and the exact confirmation to retire them.",
    );
    process.exitCode = 0;
  } else {
    const ids = candidates.map((candidate) => candidate.id);
    const retired = await sql.begin(async (transaction) => {
      const locked = await transaction<{ id: string }[]>`
        select f.id
        from public.families f
        where f.id in ${transaction(ids)}
          and f.sandbox
          and f.status <> 'deleted'
          and f.created_at < now() - ${`${MINIMUM_AGE_HOURS} hours`}::interval
          and f.updated_at < now() - ${`${MINIMUM_AGE_HOURS} hours`}::interval
          and (
            exists (
              select 1
              from public.family_members fm
              join auth.users u on u.id = fm.user_id
              where fm.family_id = f.id
                and (
                  lower(coalesce(u.email, '')) like 'isolation-%@example.com'
                  or lower(coalesce(u.email, '')) like 'continuity-%@example.com'
                  or lower(coalesce(u.email, '')) like 'parented-session-%@example.com'
                )
            )
            or f.id = '00000000-0000-0000-0000-e2e000000001'::uuid
            or f.name in (
              'Recall eval (synthetic)',
              'Recall eval bystander (synthetic)'
            )
            or (f.name = 'E2E Tasks Family' and f.email = 'delivered@resend.dev')
            or (
              f.name = 'Continuity fold stub'
              and f.email = 'continuity-fold-stub@example.test'
            )
            or (f.name = 'Sync E2E family' and f.email = 'sync-e2e@example.test')
            or (f.name = 'Other family' and f.email = 'other@example.test')
          )
        order by f.id
        for update
      `;
      if (locked.length !== candidates.length) {
        throw new Error(
          `Candidate provenance changed: locked ${locked.length} of ${candidates.length}.`,
        );
      }
      await transaction`
        delete from public.agent_schedules
        where family_id in ${transaction(ids)}
      `;
      return transaction<{ id: string }[]>`
        update public.families
        set status = 'deleted', updated_at = now()
        where id in ${transaction(ids)}
          and sandbox
          and status <> 'deleted'
        returning id
      `;
    });
    if (retired.length !== candidates.length) {
      throw new Error(
        `Retired ${retired.length} of ${candidates.length}; transaction rolled back.`,
      );
    }
    console.log(`Retired ${retired.length} reserved live fixture families.`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
