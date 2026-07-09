-- Migration #37: hours_log, capture-time school hours (M3-05 slice;
-- round-3/round-4 lab evidence, build-log 2026-07-09 midday: query-time
-- extraction recovered 45% of true hours, capture-time recovered 100%,
-- and the live agent could only refuse the records question).
--
-- One row per mentioned block of school time, written the moment the
-- parent mentions it: by the chat agent's log_hours tool (caller token,
-- RLS insert policy below) or the voice lines' webhook tool (server
-- connection). The compliance report is then a GROUP BY, never a
-- transcript excavation.
--
-- Idempotent on purpose: lands via MCP before the GitHub integration
-- replays this file.

create table if not exists public.hours_log (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Null means family-wide time (co-op mornings count for everyone).
  child_id uuid references public.children (id) on delete set null,
  subject text not null check (subject in
    ('reading','math','science','social studies','art','music','PE','co-op','life skills','other')),
  minutes integer not null check (minutes between 1 and 600),
  happened_on date not null default current_date,
  source text not null default 'chat'
    check (source in ('chat','sms','call')),
  -- The parent's own words, for the audit trail ("about 45 min of math").
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index if not exists hours_log_family_date_idx
  on public.hours_log (family_id, happened_on desc);

alter table public.hours_log enable row level security;

drop policy if exists "members read their hours" on public.hours_log;
create policy "members read their hours"
  on public.hours_log for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members log hours" on public.hours_log;
create policy "members log hours"
  on public.hours_log for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = hours_log.family_id
      )
    )
  );

drop policy if exists "members remove their hours" on public.hours_log;
create policy "members remove their hours"
  on public.hours_log for delete to authenticated
  using (public.is_family_member(family_id));
