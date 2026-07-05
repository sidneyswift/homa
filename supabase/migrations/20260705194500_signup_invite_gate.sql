-- Migration #7: founding-family signup gate, enforced at the database.
--
-- Why: the first real signup attempt dead-ended. The project has email
-- confirmation on, so auth.signUp() returned no session and parked the
-- account on a confirmation email (Supabase's default mailer: rate-limited,
-- spam-prone, not configured with our Resend). And the app-layer invite
-- check (HOMA_SIGNUP_CODE env) could be bypassed entirely by calling the
-- Supabase auth API directly with the publishable key.
--
-- This trigger fixes both at the real boundary:
--   1. Signups must carry the invite code in raw_user_meta_data
--      (supabase.auth.signUp({ options: { data: { invite_code } } })).
--   2. A valid code confirms the account at insert (email_confirmed_at),
--      so signInWithPassword works immediately: no email round-trip.
--   3. Rows created already-confirmed (dashboard "Add user", future
--      server-side invite flows) skip the gate.
--
-- The code lives in private.settings (not exposed over the Data API; the
-- private schema has no grants to anon/authenticated). Rotate it with:
--   update private.settings set value = '<new>' where key = 'signup_invite_code';
-- MJ-09's real invite service replaces all of this.

create schema if not exists private;

create table if not exists private.settings (
  key text primary key,
  value text not null
);

insert into private.settings (key, value)
values ('signup_invite_code', 'founding-family-maya-2026')
on conflict (key) do update set value = excluded.value;

create or replace function private.enforce_signup_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  required text;
begin
  if new.email_confirmed_at is not null then
    return new;
  end if;

  select value into required from private.settings where key = 'signup_invite_code';
  if required is null then
    raise exception 'Signups are closed.';
  end if;

  if coalesce(new.raw_user_meta_data->>'invite_code', '') = required then
    -- Founding-family stopgap: confirmed at birth, no email round-trip.
    new.email_confirmed_at := now();
    return new;
  end if;

  raise exception 'Signups require a valid invite code.';
end;
$$;

drop trigger if exists enforce_signup_invite on auth.users;
create trigger enforce_signup_invite
  before insert on auth.users
  for each row execute function private.enforce_signup_invite();
