-- Migration #72: task recipients (founder ruling 2026-07-12: only the main
-- parent, the account owner, is auto-subscribed to daily task texts.
-- An invited adult is never auto-subscribed; they opt in by creating
-- their own task on the web tab, in chat, or over SMS).
--
-- 1. agent_schedules.recipient_member_user_id names the ONE adult a
--    task's deliveries reach. Seeding stamps the family's first member
--    (the account owner); custom-task creation stamps the creator. Null
--    (legacy rows, member-less families) falls back to the first member
--    at delivery time in code.
-- 2. Backfill: every existing row gets the family's oldest member.
-- 3. Data repair: a single-adult family's unattributed phone rows attach
--    to their only member (rows linked before migration #49's per-member
--    attribution), so member-scoped delivery still reaches them by text.
--
-- Additive only, so it may lead the deploy: the running code ignores the
-- column until the next deploy reads it.

alter table public.agent_schedules
  add column if not exists recipient_member_user_id uuid
    references auth.users (id) on delete set null;

comment on column public.agent_schedules.recipient_member_user_id is
  'The one adult this task delivers to (founder ruling 2026-07-12). Null falls back to the family''s first member at delivery time.';

update public.agent_schedules s
set recipient_member_user_id = owner.user_id
from (
  select distinct on (family_id) family_id, user_id
  from public.family_members
  order by family_id, created_at
) owner
where owner.family_id = s.family_id
  and s.recipient_member_user_id is null;

update public.family_phones p
set member_user_id = m.user_id, updated_at = now()
from public.family_members m
where m.family_id = p.family_id
  and p.member_user_id is null
  and (
    select count(*) from public.family_members m2
    where m2.family_id = p.family_id
  ) = 1;
