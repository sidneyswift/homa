-- Links a map lead to a real Supabase Auth account, created either
-- immediately (Google sign-up at S1) or as the last question before the
-- report (email + password, founder call 2026-07-06). Nullable: most
-- leads mid-flow have no account yet, that's the whole point of the
-- anonymous-first design. on delete set null (not cascade): deleting an
-- auth user should not silently delete a family's report history.
alter table public.lead_families
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists lead_families_auth_user_id_key
  on public.lead_families (auth_user_id)
  where auth_user_id is not null;
