import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import path from "node:path";

/** Synthetic seed data only. This helper cannot run against a hosted database.
 * Runtime writer assertions continue to use public.hours_log and the real APIs. */
export async function installHoursPostgresFixture(sql) {
  const [target] = await sql`select current_setting('data_directory') as directory,
    host(inet_server_addr()) as address, current_database() as database, current_user as owner,
    to_regclass('public.learning_write_operations') is not null as identity_ready`;
  assert(!process.env.VERCEL && process.env.HOMA_EVAL_ALLOW_PROD_WRITES !== "1");
  assert.equal(target.database, "homa_eval"); assert.equal(target.owner, "homa_eval");
  const fixtureRoot = path.dirname(realpathSync(process.env.HOMA_EVAL_BLOB_DIR));
  assert.match(path.basename(fixtureRoot), /^homa-eval-sandbox-/u);
  assert.equal(realpathSync(target.directory), path.join(fixtureRoot, "data"));
  assert.ok(target.address === null || target.address === "127.0.0.1" || target.address === "::1");
  if (!target.identity_ready) throw new Error("Hours fixture requires the identity migrations");
  await sql.unsafe(`
    create schema if not exists homa_test_fixture;
    revoke all on schema homa_test_fixture from public, anon, authenticated;
    create or replace view homa_test_fixture.hours_log as select * from public.hours_log;
    create or replace function homa_test_fixture.insert_hours() returns trigger language plpgsql set search_path='' as $$
    declare operation_id uuid := gen_random_uuid();
    begin
      new.id := coalesce(new.id,gen_random_uuid()); new.source := coalesce(new.source,'chat');
      new.happened_on := coalesce(new.happened_on,current_date); new.created_at := coalesce(new.created_at,now());
      new.capture_operation_id := operation_id;
      insert into public.learning_write_operations(id,family_id,operation_key,request,expected_hours_ids,resolved_date)
        values(operation_id,new.family_id,'synthetic-fixture:'||new.id::text,jsonb_build_object('fixtureHoursId',new.id),array[new.id],new.happened_on);
      insert into public.hours_log(id,family_id,child_id,subject,minutes,happened_on,source,note,custom_label,created_at,capture_operation_id)
        values(new.id,new.family_id,new.child_id,new.subject,new.minutes,new.happened_on,new.source,new.note,new.custom_label,new.created_at,operation_id);
      update public.learning_write_operations set outcome=jsonb_build_object('hoursEntryIds',jsonb_build_array(new.id)) where id=operation_id;
      return new;
    end $$;
    drop trigger if exists fixture_hours_insert on homa_test_fixture.hours_log;
    create trigger fixture_hours_insert instead of insert on homa_test_fixture.hours_log for each row execute function homa_test_fixture.insert_hours();
  `);
}
