-- Migration #49: multi-parent v0, additive half (plan
-- 2026-07-11-multi-parent-v0-and-founder-account-merge.md, founder
-- rulings D-mp-1..7). One family can now hold two adults for real:
-- per-member display names, per-number member attribution, and a
-- roster read policy so either parent's caller-RLS context can render
-- both names. The family_phones one-per-family constraint drops in the
-- NEXT migration, applied only after the code that stops naming it is
-- deployed (deploy law: additive may lead, breaking must trail).

-- Who this adult is inside the family, for greetings and channel
-- identity ("you are texting with Sidney"). Null falls back to the
-- family-level parent_display_name.
alter table public.family_members
  add column if not exists display_name text;

-- Which adult carries this number. SET NULL on account deletion keeps
-- the routing row alive (same reasoning as the FK-less added_by, which
-- stays as the pure audit column).
alter table public.family_phones
  add column if not exists member_user_id uuid references auth.users (id) on delete set null;

-- Members could only read their OWN membership row; rendering "the
-- parents go by Sidney and Alessa" under the caller's token needs the
-- family roster. is_family_member is SECURITY DEFINER, so this does
-- not recurse. Anon stays denied (no policy for it, isolation check
-- unchanged).
drop policy if exists "members read their own memberships" on public.family_members;
create policy "members read their family roster"
  on public.family_members
  for select
  to authenticated
  using (public.is_family_member(family_id));
