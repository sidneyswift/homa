-- Durable next-skill lessons for one report subject.
--
-- Each lesson row is child-scoped and server-readable only. Parent-facing
-- routes expose bounded projections through permanent tokens or authenticated
-- owner checks. Caller material approval keeps the caller JWT through the
-- security-invoker RPC below. The feature remains dark until
-- HOMA_SUBJECT_LESSONS_ENABLED is exactly "true".
--
-- Expand/contract split (2026-07-18 merge-to-main review finding): this
-- migration is the EXPAND half only. It adds the new table, the widened
-- channel checks, and the finalize_family_material RPC, none of which
-- change what today's already-deployed code is allowed to do -- the three
-- RLS policy replacements below still let an ordinary (subject_lesson_id
-- is null) direct update through, exactly as the policies they replace
-- did. It is safe to apply this migration ahead of the matching code
-- deploy, the normal "additive migrations may lead" rule.
--
-- The CONTRACT half, the enforce_material_status_write_boundary trigger
-- that actually requires the RPC, is deliberately a SEPARATE migration
-- (20260718160000_subject_lessons_enforce_finalization_boundary.sql).
-- That trigger has no subject_lesson_id exception: once it exists, EVERY
-- authenticated-role update to materials.status/approved_at/
-- subject_lesson_id must go through the RPC, including today's live
-- direct-update finalizeMaterialCaller path for ordinary, non-lesson
-- materials. Apply that second migration only after the RPC-aware code
-- in this PR is deployed and confirmed READY in production -- applying it
-- first breaks material approval for every family, flag or no flag.

-- The dedicated builder records its real channel on durable material and
-- model-usage receipts. Both tables predate this lane and constrain channel
-- values, so widen those checks in the same additive rollout migration.
alter table public.materials
  drop constraint if exists worksheets_channel_check,
  drop constraint if exists materials_channel_check;

alter table public.materials
  add constraint materials_channel_check
  check (channel in ('web', 'sms', 'email', 'dispatch', 'subject_lesson'));

-- Added before the lesson table so the caller-JWT finalization function can
-- compile against the provenance field. Its FK is attached after the lesson
-- table exists.
alter table public.materials
  add column subject_lesson_id uuid;

alter table public.model_usage
  drop constraint if exists model_usage_channel_check;

alter table public.model_usage
  add constraint model_usage_channel_check
  check (channel in ('web', 'sms', 'email', 'dispatch', 'subject_lesson'));

-- Caller-JWT material finalization. One RPC transaction locks the family's
-- current revision rows, validates the selected version, updates the target
-- and siblings together, then returns only the committed receipt and draft
-- URLs that the application may clean up after the call returns.
create or replace function public.finalize_family_material(
  p_family_id uuid,
  p_material_id uuid
)
returns table (
  finalized boolean,
  transitioned boolean,
  title text,
  versions_superseded integer,
  draft_urls text[]
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_row public.materials%rowtype;
  chain_ids uuid[];
  cleanup_urls text[];
  superseded_count integer;
begin
  if auth.uid() is null
    or not public.is_family_member(p_family_id)
  then
    raise exception 'Family access denied' using errcode = '42501';
  end if;

  perform set_config('homa.material_finalization_rpc', 'allowed', true);

  -- Lock in deterministic order before planning. This includes every row in
  -- the target's chain and prevents two approvals from splitting the writes.
  perform 1
  from public.materials material
  where material.family_id = p_family_id
  order by material.id
  for update;

  select material.*
  into target_row
  from public.materials material
  where material.id = p_material_id
    and material.family_id = p_family_id;

  if not found then
    return query
      select false, false, null::text, 0::integer, array[]::text[];
    return;
  end if;

  -- Ordinary family materials retain member approval. A worksheet stamped
  -- to an automatic lesson requires the authenticated account owner.
  if target_row.subject_lesson_id is null then
    null;
  elsif target_row.subject_lesson_id is not null
    and not exists (
    select 1
    from public.family_members member
    where member.family_id = p_family_id
      and member.user_id = auth.uid()
      and member.user_id = (
        select owner.user_id
        from public.family_members owner
        where owner.family_id = p_family_id
        order by owner.created_at, owner.user_id
        limit 1
      )
  ) then
    raise exception 'Account owner approval required'
      using errcode = '42501';
  end if;

  if target_row.status = 'final' then
    return query
      select true, false, target_row.title, 0::integer, array[]::text[];
    return;
  end if;

  -- A superseded draft may already have lost its Blob bytes. approved_at is
  -- the durable proof that this revision was previously final and retained.
  if target_row.status = 'superseded'
    and target_row.approved_at is null
  then
    return query
      select false, false, null::text, 0::integer, array[]::text[];
    return;
  end if;

  with recursive material_chain(id) as (
    select target_row.id
    union
    select candidate.id
    from material_chain current_chain
    join public.materials current_material
      on current_material.id = current_chain.id
      and current_material.family_id = p_family_id
    join public.materials candidate
      on candidate.family_id = p_family_id
      and (
        candidate.revises = current_material.id
        or candidate.id = current_material.revises
      )
  )
  select coalesce(
    array_agg(material_chain.id order by material_chain.id),
    array[]::uuid[]
  )
  into chain_ids
  from material_chain;

  if exists (
    select 1
    from public.materials material
    where material.id = any(chain_ids)
      and material.family_id = p_family_id
      and material.subject_lesson_id is not null
  ) and (
    target_row.subject_lesson_id is null
    or exists (
      select 1
      from public.materials material
      where material.id = any(chain_ids)
        and material.family_id = p_family_id
        and material.subject_lesson_id
          is distinct from target_row.subject_lesson_id
    )
  ) then
    return query
      select false, false, null::text, 0::integer, array[]::text[];
    return;
  end if;

  if exists (
    select 1
    from public.materials material
    where material.id = any(chain_ids)
      and material.family_id = p_family_id
      and material.subject_lesson_id is not null
  ) and not exists (
    select 1
    from public.family_members member
    where member.family_id = p_family_id
      and member.user_id = auth.uid()
      and member.user_id = (
        select owner.user_id
        from public.family_members owner
        where owner.family_id = p_family_id
        order by owner.created_at, owner.user_id
        limit 1
      )
  ) then
    raise exception 'Account owner approval required'
      using errcode = '42501';
  end if;

  perform 1
  from public.materials material
  where material.id = any(chain_ids)
    and material.family_id = p_family_id
  order by material.id
  for update;

  select coalesce(
    array_agg(distinct cleanup.url),
    array[]::text[]
  )
  into cleanup_urls
  from (
    select material.pdf_url as url
    from public.materials material
    where material.id = any(chain_ids)
      and material.id <> target_row.id
      and material.family_id = p_family_id
      and material.status = 'draft'
    union all
    select material.preview_url as url
    from public.materials material
    where material.id = any(chain_ids)
      and material.id <> target_row.id
      and material.family_id = p_family_id
      and material.status = 'draft'
  ) cleanup
  where nullif(btrim(cleanup.url), '') is not null;

  select count(*)::integer
  into superseded_count
  from public.materials material
  where material.id = any(chain_ids)
    and material.id <> target_row.id
    and material.family_id = p_family_id
    and material.status <> 'superseded';

  update public.materials material
  set status = 'final',
      approved_at = now()
  where material.id = target_row.id
    and material.family_id = p_family_id
    and material.status <> 'final';

  if not found then
    raise exception 'Material finalization lost its locked transition';
  end if;

  update public.materials material
  set status = 'superseded'
  where material.id = any(chain_ids)
    and material.id <> target_row.id
    and material.family_id = p_family_id
    and material.status <> 'superseded';

  return query
    select true, true, target_row.title, superseded_count, cleanup_urls;
end;
$$;

revoke all on function public.finalize_family_material(uuid, uuid) from public;
revoke execute on function public.finalize_family_material(uuid, uuid) from anon;
grant execute on function public.finalize_family_material(uuid, uuid) to authenticated;

create table public.subject_lessons (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null
    references public.children (id) on update cascade on delete cascade,
  subject_id text not null
    check (char_length(btrim(subject_id)) between 1 and 40),
  target_item_id text
    check (
      target_item_id is null
      or char_length(btrim(target_item_id)) between 1 and 160
    ),
  target_statement text not null
    check (char_length(btrim(target_statement)) between 1 and 500),
  starting_line text
    check (
      starting_line is null
      or char_length(btrim(starting_line)) between 1 and 500
    ),
  source_report_generated_at timestamptz not null,
  source_fingerprint text not null
    check (source_fingerprint ~ '^[0-9a-f]{64}$'),
  bank_version text not null
    check (char_length(btrim(bank_version)) between 1 and 100),
  content jsonb not null default
    '{"title":"","materials":[],"steps":[],"practice":""}'::jsonb,
  build_status text not null default 'queued'
    check (build_status in ('queued', 'running', 'ready', 'failed')),
  build_phase text not null default 'starting'
    check (
      build_phase in (
        'starting',
        'writing_lesson',
        'making_worksheet',
        'reviewing_worksheet'
      )
    ),
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  idempotency_key text not null
    check (
      idempotency_key ~ '^[0-9a-f]{64}$'
      and idempotency_key = source_fingerprint
    ),
  runtime_session_id text
    check (
      runtime_session_id is null
      or char_length(btrim(runtime_session_id)) between 1 and 255
    ),
  material_id uuid references public.materials (id) on delete set null,
  error_code text
    check (
      error_code is null
      or char_length(btrim(error_code)) between 1 and 80
    ),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subject_lessons_content_shape_check
    check (
      jsonb_typeof(content) = 'object'
      and coalesce(jsonb_typeof(content->'title'), '') = 'string'
      and coalesce(jsonb_typeof(content->'materials'), '') = 'array'
      and coalesce(jsonb_typeof(content->'steps'), '') = 'array'
      and coalesce(jsonb_typeof(content->'practice'), '') = 'string'
      and not (content @? '$.materials[*] ? (@.type() != "string")')
      and not (content @? '$.steps[*] ? (@.type() != "string")')
    ),
  constraint subject_lessons_attempt_status_check
    check (
      (build_status = 'queued' and attempt_count = 0)
      or (build_status <> 'queued' and attempt_count > 0)
    ),
  constraint subject_lessons_error_status_check
    check (
      (build_status = 'failed' and error_code is not null)
      or (build_status <> 'failed' and error_code is null)
    )
);

alter table public.materials
  add constraint materials_subject_lesson_id_fkey
  foreign key (subject_lesson_id)
  references public.subject_lessons (id)
  on update cascade
  on delete set null;

create index materials_subject_lesson_idx
  on public.materials (subject_lesson_id)
  where subject_lesson_id is not null;

-- Browser-created materials can never claim trusted automatic provenance.
drop policy if exists "members read their materials" on public.materials;
create policy "members read their materials"
  on public.materials for select to authenticated
  using (
    public.is_family_member(family_id)
    and (
      subject_lesson_id is null
      or status = 'final'
      or current_setting(
        'homa.material_finalization_rpc',
        true
      ) = 'allowed'
    )
  );

drop policy if exists "members add materials" on public.materials;
create policy "members add materials"
  on public.materials for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and subject_lesson_id is null
    and (
      revises is null
      or exists (
        select 1
        from public.materials prior
        where prior.id = revises
          and prior.family_id = materials.family_id
          and prior.subject_lesson_id is null
      )
    )
    and (
      child_id is null
      or exists (
        select 1
        from public.children child
        where child.id = child_id
          and child.family_id = materials.family_id
      )
    )
  );

-- The caller-JWT RPC sets one transaction-local marker. Direct Data API
-- updates cannot set it, so they cannot forge provenance or material status.
drop policy if exists "members update their materials" on public.materials;
create policy "members update their materials"
  on public.materials for update to authenticated
  using (
    public.is_family_member(family_id)
    and (
      subject_lesson_id is null
      or current_setting(
        'homa.material_finalization_rpc',
        true
      ) = 'allowed'
    )
  )
  with check (
    public.is_family_member(family_id)
    and (
      subject_lesson_id is null
      or current_setting(
        'homa.material_finalization_rpc',
        true
      ) = 'allowed'
    )
  );

-- enforce_material_status_write_boundary (the trigger that actually
-- requires the RPC) ships as its own later migration,
-- 20260718160000_subject_lessons_enforce_finalization_boundary.sql -- see
-- this file's header comment for why.

-- One durable claim per logical worksheet creation. A revision keys on the
-- material it revises, while the first creation uses the literal `initial`.
create table public.subject_lesson_effect_receipts (
  subject_lesson_id uuid not null
    references public.subject_lessons (id)
    on update cascade
    on delete cascade,
  attempt integer not null check (attempt > 0),
  create_key text not null
    check (
      create_key = 'initial'
      or create_key ~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  status text not null default 'in_flight'
    check (status in ('in_flight', 'completed')),
  created_material_id uuid unique
    references public.materials (id)
    on update cascade
    on delete restrict,
  material_id uuid unique
    references public.materials (id)
    on update cascade
    on delete restrict,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  primary key (subject_lesson_id, attempt, create_key),
  constraint subject_lesson_effect_receipt_completion_check
    check (
      (
        status = 'in_flight'
        and material_id is null
        and finished_at is null
      )
      or (
        status = 'completed'
        and material_id is not null
        and created_material_id = material_id
        and finished_at is not null
      )
    )
);

alter table public.subject_lesson_effect_receipts enable row level security;
revoke all on table public.subject_lesson_effect_receipts
  from public, anon, authenticated;

create unique index subject_lessons_current_child_subject_idx
  on public.subject_lessons (child_id, subject_id)
  where superseded_at is null;

create unique index subject_lessons_idempotency_idx
  on public.subject_lessons (child_id, subject_id, idempotency_key);

create index subject_lessons_stale_run_idx
  on public.subject_lessons (updated_at)
  where superseded_at is null
    and build_status = 'running';

alter table public.subject_lessons enable row level security;

revoke all on table public.subject_lessons
  from public, anon, authenticated;

comment on table public.subject_lessons is
  'One durable next-skill lesson and worksheet build per child subject and source fingerprint.';
