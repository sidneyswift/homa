-- Atomic single-checkbox toggle for child_plans.progress.
--
-- Web's own check-off sync (POST /api/map/plan/progress, savePlanProgress
-- in apps/web/lib/map/store.ts) is a whole-map replace: the client sends
-- its entire locally-believed progress object and the server overwrites
-- the whole progress column with it, pruned only for key validity. Two
-- clients (e.g. a phone and a laptop) each holding a slightly stale
-- snapshot can each independently clobber the other's most recent check,
-- because the server never reads the current progress value before
-- writing (confirmed: no read-modify-write, no revision column on
-- child_plans). That is fine for one client at a time, but a second
-- writer (mobile) makes it a real race.
--
-- This function is the fix, scoped narrowly to what a second client
-- needs: set exactly one "week.activityIndex" key, atomically, without
-- ever touching the rest of the map. Two concurrent single-key writes
-- from two different devices both land safely regardless of order. It
-- reproduces prunePlanChecks' one real guarantee (a key must name a real
-- activity in the child's current plan) so a stale index from a shifted
-- plan can never write to a slot that no longer means what the caller
-- thinks it means.
create or replace function public.toggle_plan_activity_check(
  target_child_id uuid,
  target_subject_id text,
  target_week smallint,
  target_activity_index smallint,
  target_done boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  plan_row jsonb;
  week_activities jsonb;
  progress_key text := target_week::text || '.' || target_activity_index::text;
begin
  if auth.uid() is null then
    raise exception 'toggle_plan_activity_check requires an authenticated caller'
      using errcode = '42501';
  end if;

  if not public.is_child_family_member(target_child_id) then
    raise exception 'child does not belong to the caller''s family'
      using errcode = '42501';
  end if;

  if target_week not between 1 and 4 then
    raise exception 'week % is out of range', target_week;
  end if;

  if target_activity_index < 0 then
    raise exception 'activity index % is out of range', target_activity_index;
  end if;

  select plan into plan_row
  from public.child_plans
  where child_id = target_child_id and subject_id = target_subject_id
  for update;

  if plan_row is null then
    raise exception 'no plan found for this child and subject';
  end if;

  week_activities := plan_row -> 'weeks' -> (target_week - 1) -> 'activities';
  if week_activities is null
    or jsonb_typeof(week_activities) <> 'array'
    or target_activity_index >= jsonb_array_length(week_activities)
  then
    raise exception 'activity index % is not valid for week %', target_activity_index, target_week;
  end if;

  update public.child_plans
  set
    progress = jsonb_set(
      coalesce(progress, '{}'::jsonb),
      array[progress_key],
      to_jsonb(target_done),
      true
    ),
    updated_at = now()
  where child_id = target_child_id and subject_id = target_subject_id;
end;
$$;

revoke all on function public.toggle_plan_activity_check(uuid, text, smallint, smallint, boolean)
  from public, anon;
grant execute on function public.toggle_plan_activity_check(uuid, text, smallint, smallint, boolean)
  to authenticated;
