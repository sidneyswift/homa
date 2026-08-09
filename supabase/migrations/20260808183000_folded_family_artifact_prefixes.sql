-- Family folds move relational records to the surviving family, but existing
-- Vercel Blob objects keep the family UUID embedded in their path. Retain each
-- historical UUID as a cleanup prefix so a later account deletion can remove
-- every artifact that belongs to the surviving family.

create table public.family_artifact_prefixes (
  artifact_family_id uuid primary key,
  owner_family_id uuid not null
    references public.families (id) on delete cascade,
  inherited_at timestamptz not null default now(),
  check (artifact_family_id <> owner_family_id)
);

create index family_artifact_prefixes_owner_idx
  on public.family_artifact_prefixes (owner_family_id, artifact_family_id);

alter table public.family_artifact_prefixes enable row level security;
revoke all on table public.family_artifact_prefixes
  from public, anon, authenticated;

-- Historical rows can reveal a likely pre-fold Blob prefix, but they are not
-- authoritative ownership records. Persist only privacy-light evidence for a
-- human-reviewed audit. Nothing in this migration promotes a candidate into
-- the deletion ledger automatically.
create table public.family_artifact_prefix_candidates (
  owner_family_id uuid not null,
  artifact_family_id uuid not null,
  evidence_kind text not null
    check (evidence_kind in ('material_output', 'lesson_audio')),
  evidence_count integer not null check (evidence_count > 0),
  observed_at timestamptz not null default now(),
  primary key (owner_family_id, artifact_family_id, evidence_kind),
  foreign key (owner_family_id)
    references public.families (id),
  check (artifact_family_id <> owner_family_id)
);

alter table public.family_artifact_prefix_candidates enable row level security;
revoke all on table public.family_artifact_prefix_candidates
  from public, anon, authenticated;

with surviving_references as (
  select family_id as owner_family_id, pdf_url as artifact_ref,
    'material_output'::text as evidence_kind
  from public.materials
  union all
  select family_id, preview_url, 'material_output'
  from public.materials
  union all
  select recording.family_id, segment.blob_url, 'lesson_audio'
  from public.lesson_segments segment
  join public.lesson_recordings recording on recording.id = segment.lesson_id
  union all
  select recording.family_id, media.blob_url, 'lesson_audio'
  from public.lesson_media media
  join public.lesson_recordings recording on recording.id = media.lesson_id
), exact_references as (
  select
    reference.owner_family_id,
    reference.evidence_kind,
    substring(
      reference.artifact_ref
      from '^https://[a-zA-Z0-9-]+\.(?:public|private)\.blob\.vercel-storage\.com/families/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/'
    ) as artifact_family_id
  from surviving_references reference
)
insert into public.family_artifact_prefix_candidates (
  owner_family_id,
  artifact_family_id,
  evidence_kind,
  evidence_count
)
select
  reference.owner_family_id,
  reference.artifact_family_id::uuid,
  reference.evidence_kind,
  count(*)::integer
from exact_references reference
where reference.artifact_family_id is not null
  and reference.artifact_family_id::uuid <> reference.owner_family_id
group by
  reference.owner_family_id,
  reference.artifact_family_id,
  reference.evidence_kind;

-- One deletion job may now own several historical Blob prefixes. Each prefix
-- gets its own permanent tombstone so delayed uploads are swept as well.
alter table public.account_deletion_artifact_tombstones
  drop constraint account_deletion_artifact_tombstones_deletion_job_id_key;

create index account_deletion_artifact_tombstones_job_idx
  on public.account_deletion_artifact_tombstones (deletion_job_id, family_id);

insert into public.account_deletion_artifact_tombstones (
  family_id,
  deletion_job_id,
  created_at
)
select
  prefix.artifact_family_id,
  deletion_job.id,
  deletion_job.requested_at
from public.account_deletion_jobs deletion_job
join public.family_artifact_prefixes prefix
  on prefix.owner_family_id = deletion_job.family_id
where deletion_job.status <> 'complete';

-- From this point onward, a compatibility job created by the old deployment
-- must snapshot both its primary UUID and every folded Blob prefix. Replace
-- the earlier primary-only trigger body now that the alias table exists.
create or replace function public.ensure_account_deletion_job_tombstones()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_artifact_family_id uuid;
  ensured_family_id uuid;
begin
  if new.family_id is not null and new.status <> 'complete' then
    ensured_family_id := null;
    insert into public.account_deletion_artifact_tombstones (
      family_id,
      deletion_job_id,
      created_at
    )
    values (new.family_id, new.id, new.requested_at)
    on conflict (family_id) do update
    set created_at = least(
      public.account_deletion_artifact_tombstones.created_at,
      excluded.created_at
    )
    where public.account_deletion_artifact_tombstones.deletion_job_id
      = excluded.deletion_job_id
    returning family_id into ensured_family_id;

    if ensured_family_id is null then
      raise exception using
        errcode = '55000',
        message = 'account deletion primary tombstone belongs to another job';
    end if;

    for target_artifact_family_id in
      select prefix.artifact_family_id
      from public.family_artifact_prefixes prefix
      where prefix.owner_family_id = new.family_id
      order by prefix.artifact_family_id
    loop
      ensured_family_id := null;
      insert into public.account_deletion_artifact_tombstones (
        family_id,
        deletion_job_id,
        created_at
      )
      values (target_artifact_family_id, new.id, new.requested_at)
      on conflict (family_id) do update
      set created_at = least(
        public.account_deletion_artifact_tombstones.created_at,
        excluded.created_at
      )
      where public.account_deletion_artifact_tombstones.deletion_job_id
        = excluded.deletion_job_id
      returning family_id into ensured_family_id;

      if ensured_family_id is null then
        raise exception using
          errcode = '55000',
          message = 'account deletion artifact tombstone belongs to another job';
      end if;
    end loop;
  end if;
  return new;
end;
$$;
