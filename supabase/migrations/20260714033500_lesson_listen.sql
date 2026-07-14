-- Lesson listen tables (plan 2026-07-13-lesson-listen.md, LL-1).
-- A parent records a whole lesson in 3-minute segments (or uploads one
-- file), each segment gets a Whisper transcript and audio-model tone
-- notes as it lands, and finish runs one synthesis pass that writes a
-- review plus journal-path progress evidence. Raw audio deletes after
-- 30 days (audio_deleted_at stamps the sweep); rows, transcripts, and
-- reviews are kept.
--
-- Posture copied from the ChildProgress tables: RLS on, members read
-- their own family's rows, every write goes through the guarded
-- server connection (mapDb). Additive only, safe to lead the deploy;
-- everything user-facing stays dark behind HOMA_LESSON_LISTEN_ENABLED.
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.lesson_recordings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'recording'
    check (status in ('recording', 'uploaded', 'analyzing', 'ready', 'failed')),
  source text not null default 'recorder'
    check (source in ('recorder', 'upload')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  analysis_claimed_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  audio_deleted_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  constraint lesson_recordings_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade
    on delete cascade
);

create index if not exists lesson_recordings_family_idx
  on public.lesson_recordings (family_id, created_at desc);
-- The cron sweep's two scans: stalled analyzing rows, and finished
-- rows whose audio has outlived the 30-day TTL.
create index if not exists lesson_recordings_sweep_idx
  on public.lesson_recordings (status, analysis_claimed_at)
  where status in ('uploaded', 'analyzing');
create index if not exists lesson_recordings_audio_ttl_idx
  on public.lesson_recordings (finished_at)
  where audio_deleted_at is null and finished_at is not null;

create table if not exists public.lesson_segments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null
    references public.lesson_recordings (id) on delete cascade,
  family_id uuid not null,
  seq integer not null check (seq >= 1),
  blob_url text not null,
  content_type text not null,
  duration_seconds integer
    check (duration_seconds is null or duration_seconds >= 0),
  transcript text,
  transcribe_claimed_at timestamptz,
  transcribed_at timestamptz,
  tone_notes jsonb,
  tone_noted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (lesson_id, seq)
);

create index if not exists lesson_segments_family_idx
  on public.lesson_segments (family_id, created_at desc);

create table if not exists public.lesson_media (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null
    references public.lesson_recordings (id) on delete cascade,
  family_id uuid not null,
  blob_url text not null,
  content_type text not null,
  caption text,
  captured_during_seq integer,
  attached_after_ready boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists lesson_media_lesson_idx
  on public.lesson_media (lesson_id, created_at);

create table if not exists public.lesson_reviews (
  lesson_id uuid primary key
    references public.lesson_recordings (id) on delete cascade,
  family_id uuid not null,
  child_id uuid not null,
  summary text not null,
  insights jsonb not null,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  observation_count integer not null default 0
    check (observation_count >= 0),
  created_at timestamptz not null default now()
);

create index if not exists lesson_reviews_family_idx
  on public.lesson_reviews (family_id, created_at desc);

alter table public.lesson_recordings enable row level security;
alter table public.lesson_segments enable row level security;
alter table public.lesson_media enable row level security;
alter table public.lesson_reviews enable row level security;

drop policy if exists "members read lesson recordings"
  on public.lesson_recordings;
create policy "members read lesson recordings"
  on public.lesson_recordings for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "members read lesson segments"
  on public.lesson_segments;
create policy "members read lesson segments"
  on public.lesson_segments for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "members read lesson media"
  on public.lesson_media;
create policy "members read lesson media"
  on public.lesson_media for select to authenticated
  using (public.is_family_member(family_id));
drop policy if exists "members read lesson reviews"
  on public.lesson_reviews;
create policy "members read lesson reviews"
  on public.lesson_reviews for select to authenticated
  using (public.is_family_member(family_id));

-- Mutations are denied both by missing policies and by table
-- privileges; writes use the guarded server path only.
revoke all on table public.lesson_recordings from public, anon, authenticated;
revoke all on table public.lesson_segments from public, anon, authenticated;
revoke all on table public.lesson_media from public, anon, authenticated;
revoke all on table public.lesson_reviews from public, anon, authenticated;
grant select on table public.lesson_recordings to authenticated;
grant select on table public.lesson_segments to authenticated;
grant select on table public.lesson_media to authenticated;
grant select on table public.lesson_reviews to authenticated;

comment on table public.lesson_recordings is
  'One recorded (or uploaded) lesson per row. Raw audio lives in Blob under families/{family_id}/lessons/{id}/ until the 30-day TTL sweep stamps audio_deleted_at.';
comment on table public.lesson_reviews is
  'The synthesis output a parent reads: summary plus insights JSONB (moments, what worked, friction, next time, open questions). Evidence rides child_progress_evidence, never this table.';

-- Constraint extensions (plan §4.3): lesson evidence and observations
-- carry honest provenance. 'lesson_listen' joins the evidence source
-- vocabulary; 'lesson' joins both channel checks. message_id stays
-- null for lesson rows: the conversation_messages foreign key on
-- child_observations assumes a conversation, and a lesson is not one.

alter table public.child_progress_evidence
  drop constraint if exists child_progress_evidence_source_check;
alter table public.child_progress_evidence
  add constraint child_progress_evidence_source_check
  check (
    source in (
      'journal',
      'conversation',
      'check_in',
      'checklist',
      'deep_dive',
      'correction',
      'report_correction',
      'report_probe',
      'recheck',
      'onboarding_walk',
      'legacy',
      'lesson_listen'
    )
  );

alter table public.child_progress_evidence
  drop constraint if exists child_progress_evidence_channel_check;
alter table public.child_progress_evidence
  add constraint child_progress_evidence_channel_check
  check (
    channel is null
    or channel in ('web', 'sms', 'email', 'lesson')
  );

alter table public.child_observations
  drop constraint if exists child_observations_channel_check;
alter table public.child_observations
  add constraint child_observations_channel_check
  check (channel in ('web', 'sms', 'email', 'lesson'));

-- The normalizer maps unknown sources to 'legacy'; lesson_listen must
-- survive a round trip (reconciliation reads it back verbatim).
create or replace function private.normalize_child_progress_source(
  source_value text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case source_value
    when 'journal' then 'journal'
    when 'conversation' then 'conversation'
    when 'check_in' then 'check_in'
    when 'checklist' then 'checklist'
    when 'deep_dive' then 'deep_dive'
    when 'correction' then 'correction'
    when 'report_correction' then 'report_correction'
    when 'report_probe' then 'report_probe'
    when 'recheck' then 'recheck'
    when 'onboarding_walk' then 'onboarding_walk'
    when 'lesson_listen' then 'lesson_listen'
    when 'legacy' then 'legacy'
    else 'legacy'
  end
$$;

revoke all on function private.normalize_child_progress_source(text)
  from public, anon, authenticated;
