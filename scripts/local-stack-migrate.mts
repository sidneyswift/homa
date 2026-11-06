/**
 * Replays supabase/migrations onto the local stack's database, in
 * production's order, recording each one so a restart applies only what
 * is new. Split from scripts/local-stack.mts so it can be exercised
 * against any disposable Postgres.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type postgres from "postgres";

import { MIGRATIONS_DIR, orderedMigrations } from "./supabase-migration-order.mts";

/**
 * Applies every migration this database has not seen, in production's
 * order (scripts/supabase-migration-order.mts), one transaction each.
 * The ledger lives in its own schema so it never mixes with product
 * tables. Returns how many ran.
 */
export async function migrate(sql: ReturnType<typeof postgres>): Promise<number> {
  await sql`create schema if not exists local_stack`;
  await sql`
    create table if not exists local_stack.applied_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;
  // Hosted projects ship this event-trigger helper before migration one;
  // 20260704033812_function_grant_hygiene.sql revokes it. The local image
  // may not have it, so it gets the same empty body the eval sandbox uses.
  await sql.unsafe(`
    do $$ begin
      if not exists (
        select 1 from pg_proc
        where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace
      ) then
        create function public.rls_auto_enable() returns event_trigger
          language plpgsql as $f$ begin end $f$;
      end if;
    end $$;
  `);
  const applied = new Set(
    (await sql<{ name: string }[]>`select name from local_stack.applied_migrations`).map(
      (row) => row.name,
    ),
  );
  let count = 0;
  for (const file of await orderedMigrations()) {
    if (applied.has(file)) continue;
    const text = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await sql.begin(async (tx) => {
        await tx.unsafe(text);
        await tx`insert into local_stack.applied_migrations (name) values (${file})`;
      });
    } catch (error) {
      throw new Error(
        `migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    count += 1;
  }
  return count;
}
