-- family_events (issue #176, CG-03: calendar and homeschool planner in
-- 1). A co-founder's own words: "have an option for each kid and then a
-- family calendar... a doctor's appt, related activities". No table for
-- appointments, trips, or non-school events existed anywhere before this
-- (verified 2026-07-25 in the CG-03 spec); this is that table. It is
-- Homa's OWN calendar, never an external sync (Google, etc. stays out
-- of scope until ruled).
--
-- One row per event. child_id null means a whole-family event (the
-- family lane on /app/calendar); a set child_id scopes it to one kid's
-- own lane, same null-means-family-wide convention as hours_log
-- (migration #37). starts_on/ends_on are always a date range (a single
-- day event sets both to the same date); start_time/end_time are an
-- optional time-of-day window on the FIRST day only, enough for
-- "doctor's appt Tuesday 2 to 3pm" and "camping trip Wed to Sun" without
-- over-modeling a full multi-day scheduling grid this pass does not need.
--
-- RLS follows the exact is_family_member pattern hours_log (#37) and its
-- update policy (2026-07-26) already established twice: select/insert/
-- update/delete for authenticated members, with insert and update
-- re-checking that a model- or client-supplied child_id actually belongs
-- to this family, so a forged id can never attach an event to a child it
-- does not own.
--
-- NOT applied to production by this session on purpose (founder applies
-- prod migrations personally, per the hours_log_update_policy posture
-- tonight); see the PR body.

create table if not exists public.family_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Null means a whole-family event (co-op, a trip everyone takes).
  child_id uuid references public.children (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  starts_on date not null,
  ends_on date not null,
  -- Time-of-day window on the first day only; both null means an
  -- all-day entry ("camping trip Wed to Sun").
  start_time time,
  end_time time,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  constraint family_events_date_order check (ends_on >= starts_on)
);

create index if not exists family_events_family_date_idx
  on public.family_events (family_id, starts_on);

alter table public.family_events enable row level security;

drop policy if exists "members read their family events" on public.family_events;
create policy "members read their family events"
  on public.family_events for select to authenticated
  using (public.is_family_member(family_id));

drop policy if exists "members add family events" on public.family_events;
create policy "members add family events"
  on public.family_events for insert to authenticated
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = family_events.family_id
      )
    )
  );

drop policy if exists "members update their family events" on public.family_events;
create policy "members update their family events"
  on public.family_events for update to authenticated
  using (public.is_family_member(family_id))
  with check (
    public.is_family_member(family_id)
    and (
      child_id is null
      or exists (
        select 1 from public.children c
        where c.id = child_id and c.family_id = family_events.family_id
      )
    )
  );

drop policy if exists "members remove their family events" on public.family_events;
create policy "members remove their family events"
  on public.family_events for delete to authenticated
  using (public.is_family_member(family_id));
