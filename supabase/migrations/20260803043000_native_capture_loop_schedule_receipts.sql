-- Bind the native Planner capture loop to the exact schedule mutation that
-- happened in the database. The table is server-only; native clients can
-- request the wrapper function but cannot read or write these rows.

create table if not exists public.mobile_capture_loop_receipts (
  loop_id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  receipt_id uuid not null references public.plan_activity_schedule (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  subject_id text not null,
  week smallint not null,
  activity_index smallint not null,
  scheduled_date date not null,
  plan_revision bigint not null,
  created_at timestamptz not null default now()
);

create index if not exists mobile_capture_loop_receipts_family_idx
  on public.mobile_capture_loop_receipts (family_id, created_at desc);

alter table public.mobile_capture_loop_receipts enable row level security;
revoke all on public.mobile_capture_loop_receipts from public, anon, authenticated;

create or replace function public.schedule_plan_activity_native_v1(
  target_loop_id uuid,
  target_child_id uuid,
  target_subject_id text,
  target_week smallint,
  target_activity_index smallint,
  target_scheduled_date date,
  target_expected_text text,
  target_plan_revision bigint,
  target_schedule_id uuid default null
)
returns table (
  status text,
  reason text,
  family_id uuid,
  plan_id uuid,
  plan_revision bigint,
  scheduled_date date,
  activity_text text,
  schedule_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  result record;
  existing_family_id uuid;
  existing_receipt_id uuid;
  existing_child_id uuid;
  existing_subject_id text;
  existing_week smallint;
  existing_activity_index smallint;
  existing_scheduled_date date;
  existing_plan_revision bigint;
begin
  if target_loop_id is null then
    raise exception 'native schedule capture loop id is required'
      using errcode = '22023';
  end if;

  select
      binding.family_id,
      binding.receipt_id,
      binding.child_id,
      binding.subject_id,
      binding.week,
      binding.activity_index,
      binding.scheduled_date,
      binding.plan_revision
    into
      existing_family_id,
      existing_receipt_id,
      existing_child_id,
      existing_subject_id,
      existing_week,
      existing_activity_index,
      existing_scheduled_date,
      existing_plan_revision
  from public.mobile_capture_loop_receipts as binding
  where binding.loop_id = target_loop_id;

  if found and (
    existing_child_id is distinct from target_child_id
    or existing_subject_id is distinct from target_subject_id
    or existing_week is distinct from target_week
    or existing_activity_index is distinct from target_activity_index
    or existing_scheduled_date is distinct from target_scheduled_date
    or existing_plan_revision is distinct from target_plan_revision
  ) then
    raise exception 'native schedule capture loop id was already used for another operation'
      using errcode = '23505';
  end if;

  select *
    into result
  from public.schedule_plan_activity_v2(
    target_child_id,
    target_subject_id,
    target_week,
    target_activity_index,
    target_scheduled_date,
    target_expected_text,
    target_plan_revision,
    target_schedule_id
  );

  if result.status = 'applied' then
    insert into public.mobile_capture_loop_receipts (
      loop_id,
      family_id,
      receipt_id,
      child_id,
      subject_id,
      week,
      activity_index,
      scheduled_date,
      plan_revision
    )
    values (
      target_loop_id,
      result.family_id,
      result.schedule_id,
      target_child_id,
      target_subject_id,
      target_week,
      target_activity_index,
      target_scheduled_date,
      target_plan_revision
    )
    on conflict (loop_id) do nothing;

    select
        binding.family_id,
        binding.receipt_id,
        binding.child_id,
        binding.subject_id,
        binding.week,
        binding.activity_index,
        binding.scheduled_date,
        binding.plan_revision
      into
        existing_family_id,
        existing_receipt_id,
        existing_child_id,
        existing_subject_id,
        existing_week,
        existing_activity_index,
        existing_scheduled_date,
        existing_plan_revision
    from public.mobile_capture_loop_receipts as binding
    where binding.loop_id = target_loop_id;

    if existing_family_id is distinct from result.family_id
      or existing_receipt_id is distinct from result.schedule_id
      or existing_child_id is distinct from target_child_id
      or existing_subject_id is distinct from target_subject_id
      or existing_week is distinct from target_week
      or existing_activity_index is distinct from target_activity_index
      or existing_scheduled_date is distinct from target_scheduled_date
      or existing_plan_revision is distinct from target_plan_revision
    then
      raise exception 'native schedule capture loop id was already used'
        using errcode = '23505';
    end if;
  end if;

  return query select
    result.status::text,
    result.reason::text,
    result.family_id::uuid,
    result.plan_id::uuid,
    result.plan_revision::bigint,
    result.scheduled_date::date,
    result.activity_text::text,
    result.schedule_id::uuid;
end;
$$;

revoke all on function public.schedule_plan_activity_native_v1(
  uuid, uuid, text, smallint, smallint, date, text, bigint, uuid
) from public, anon;
grant execute on function public.schedule_plan_activity_native_v1(
  uuid, uuid, text, smallint, smallint, date, text, bigint, uuid
) to authenticated;
