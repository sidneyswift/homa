-- Planner as plan and log (gh#758).
--
-- Generated child-plan activities are positional children of a four-week
-- plan. They cannot honestly represent an independent report such as
-- "Horizons lesson 42 with AD today." This stable record is the additive
-- companion for parent-reported planned and completed learning. It never
-- changes ChildProgress scores. The existing evidence pipeline separately
-- decides whether a parent's words contain an observable capability claim.

create table if not exists public.planner_learning_activities (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 300),
  subject text not null check (subject in
    ('reading','math','science','social studies','art','music','PE','co-op','life skills','other')),
  activity_date date not null,
  status text not null check (status in ('planned', 'completed')),
  duration_minutes integer check (duration_minutes between 1 and 600),
  note text check (char_length(note) <= 500),
  source_channel text not null check (
    source_channel in ('web', 'mobile', 'sms', 'email', 'voice', 'dispatch', 'agent-job', 'other')
  ),
  source_quote text not null check (char_length(btrim(source_quote)) between 1 and 1000),
  source_message_id uuid,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 200),
  completion_source_channel text check (
    completion_source_channel is null or completion_source_channel in
      ('web', 'mobile', 'sms', 'email', 'voice', 'dispatch', 'agent-job', 'other')
  ),
  completion_source_quote text check (
    completion_source_quote is null
    or char_length(btrim(completion_source_quote)) between 1 and 1000
  ),
  completion_source_message_id uuid,
  completion_idempotency_key text check (
    completion_idempotency_key is null
    or char_length(completion_idempotency_key) between 16 and 200
  ),
  completed_by_user_id uuid references auth.users (id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint planner_learning_activity_completion_shape check (
    (
      status = 'completed'
      and completed_at is not null
      and completion_source_channel is not null
    )
    or (
      status = 'planned'
      and completed_at is null
      and completion_source_channel is null
      and completion_source_quote is null
      and completion_source_message_id is null
      and completion_idempotency_key is null
      and completed_by_user_id is null
    )
  ),
  constraint planner_learning_activity_duration_shape check (
    duration_minutes is null or status = 'completed'
  ),
  unique (family_id, idempotency_key)
);

create unique index if not exists planner_learning_activity_family_identity_idx
  on public.planner_learning_activities (id, family_id);

create index if not exists planner_learning_activity_family_date_idx
  on public.planner_learning_activities (family_id, activity_date, created_at);

-- One activity can belong to several children. No child rows means the whole
-- family, matching family_event_children while keeping the learning record
-- canonical and visible only once.
create table if not exists public.planner_learning_activity_children (
  family_id uuid not null references public.families (id) on delete cascade,
  activity_id uuid not null,
  child_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, child_id),
  foreign key (activity_id, family_id)
    references public.planner_learning_activities (id, family_id)
    on delete cascade,
  foreign key (child_id, family_id)
    references public.children (id, family_id)
    on delete cascade
);

create index if not exists planner_learning_activity_children_family_child_idx
  on public.planner_learning_activity_children (family_id, child_id, activity_id);

-- A shared activity may create one Hours row per participating child. A
-- separate junction preserves that exact subset instead of pretending the
-- activity was whole-family time.
create unique index if not exists hours_log_family_identity_idx
  on public.hours_log (id, family_id);

create table if not exists public.planner_learning_activity_hours (
  family_id uuid not null references public.families (id) on delete cascade,
  activity_id uuid not null,
  hours_entry_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (activity_id, hours_entry_id),
  foreign key (activity_id, family_id)
    references public.planner_learning_activities (id, family_id)
    on delete cascade,
  foreign key (hours_entry_id, family_id)
    references public.hours_log (id, family_id)
    on delete cascade
);

create index if not exists planner_learning_activity_hours_family_idx
  on public.planner_learning_activity_hours (family_id, hours_entry_id, activity_id);

alter table public.planner_learning_activities enable row level security;
alter table public.planner_learning_activity_children enable row level security;
alter table public.planner_learning_activity_hours enable row level security;

drop policy if exists "members read their planner learning activities"
  on public.planner_learning_activities;
create policy "members read their planner learning activities"
  on public.planner_learning_activities for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members read their planner learning activity children"
  on public.planner_learning_activity_children;
create policy "members read their planner learning activity children"
  on public.planner_learning_activity_children for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members read their planner learning activity hours"
  on public.planner_learning_activity_hours;
create policy "members read their planner learning activity hours"
  on public.planner_learning_activity_hours for select to authenticated
  using (public.is_family_member(family_id));

-- Direct writes stay closed. Homa writes through its authenticated,
-- family-pinned transaction. Parent-facing check-offs use the exact RPC
-- below, which derives tenancy rather than accepting a family id.
revoke all on public.planner_learning_activities from anon;
revoke all on public.planner_learning_activity_children from anon;
revoke all on public.planner_learning_activity_hours from anon;
revoke insert, update, delete on public.planner_learning_activities from authenticated;
revoke insert, update, delete on public.planner_learning_activity_children from authenticated;
revoke insert, update, delete on public.planner_learning_activity_hours from authenticated;
grant select on public.planner_learning_activities to authenticated;
grant select on public.planner_learning_activity_children to authenticated;
grant select on public.planner_learning_activity_hours to authenticated;

create or replace function public.set_planner_learning_activity_status(
  target_activity_id uuid,
  target_expected_status text,
  target_status text,
  target_source_channel text
)
returns table (
  result text,
  reason text,
  family_id uuid,
  activity_id uuid,
  activity_status text,
  updated_at timestamptz,
  changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  activity public.planner_learning_activities%rowtype;
  observed_family_id uuid;
  locked_membership_family_id uuid;
begin
  if auth.uid() is null then
    raise exception 'set_planner_learning_activity_status requires an authenticated caller'
      using errcode = '42501';
  end if;
  if target_expected_status not in ('planned', 'completed')
    or target_status not in ('planned', 'completed')
    or target_source_channel not in ('web', 'mobile')
  then
    raise exception 'planner activity status is invalid' using errcode = '22023';
  end if;

  select row.family_id into observed_family_id
  from public.planner_learning_activities row
  where row.id = target_activity_id;

  select member.family_id into locked_membership_family_id
  from public.family_members member
  where member.family_id = observed_family_id
    and member.user_id = auth.uid()
  for key share;

  if locked_membership_family_id is null then
    raise exception 'planner activity does not belong to the caller'
      using errcode = '42501';
  end if;

  select * into activity
  from public.planner_learning_activities row
  where row.id = target_activity_id
    and row.family_id = locked_membership_family_id
  for update;

  if activity.id is null then
    raise exception 'planner activity changed before the status could be saved'
      using errcode = '40001';
  end if;

  if activity.status <> target_expected_status then
    return query select
      'conflict'::text, 'status-mismatch'::text, activity.family_id,
      activity.id, activity.status, activity.updated_at, false;
    return;
  end if;

  if activity.status = target_status then
    return query select
      'applied'::text, null::text, activity.family_id,
      activity.id, activity.status, activity.updated_at, false;
    return;
  end if;

  -- Marking a completed record not finished is one correction, not two.
  -- Remove only Hours rows linked to this exact activity in the same locked
  -- transaction. Deleting the Hours rows cascades their junction rows.
  if target_status = 'planned' then
    delete from public.hours_log as hours
    using public.planner_learning_activity_hours as link
    where link.family_id = activity.family_id
      and link.activity_id = activity.id
      and hours.family_id = link.family_id
      and hours.id = link.hours_entry_id;
  end if;

  update public.planner_learning_activities as target
  set status = target_status,
      completed_at = case when target_status = 'completed' then now() else null end,
      duration_minutes = case when target_status = 'planned' then null else target.duration_minutes end,
      completion_source_channel = case
        when target_status = 'completed' then target_source_channel
        else null
      end,
      completion_source_quote = null,
      completion_source_message_id = null,
      completion_idempotency_key = null,
      completed_by_user_id = case
        when target_status = 'completed' then auth.uid()
        else null
      end,
      updated_at = now()
  where target.id = activity.id
  returning * into activity;

  return query select
    'applied'::text, null::text, activity.family_id,
    activity.id, activity.status, activity.updated_at, true;
end;
$$;

revoke all on function public.set_planner_learning_activity_status(uuid, text, text, text)
  from public, anon;
grant execute on function public.set_planner_learning_activity_status(uuid, text, text, text)
  to authenticated;

-- New Planner mutations are reversible in native Voice. object_kind remains
-- plan_activity so the capture-to-outcome contract keeps one learning-object
-- family while the effect names which storage shape changed.
alter table public.voice_action_receipts
  drop constraint if exists voice_action_receipts_effect_check;
alter table public.voice_action_receipts
  add constraint voice_action_receipts_effect_check check (
    effect in (
      'hours.logged',
      'family_event.added',
      'family_event.updated',
      'family_event.removed',
      'plan_activity.scheduled',
      'plan_activity.completed',
      'planner_activity.recorded',
      'planner_activity.completed',
      'task.created',
      'task.updated',
      'task.deleted'
    )
  );
