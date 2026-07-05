-- Migration #8: open signup (founder decision 2026-07-05, "as easy as
-- possible to sign up, no hoops"). Reverses the invite-only gate from
-- migration #7 and the PRD's original invite-only framing.
--
-- Replaces the invite-enforcing trigger with a plain auto-confirm trigger:
-- any new account is confirmed at creation, so signup is email + password
-- with an immediate session and no email round-trip, regardless of the
-- project's email-confirmation setting. Drops the private invite-code store.
--
-- If email confirmation is later turned OFF at the project level
-- (dashboard → Authentication → Sign In / Providers → Email → Confirm
-- email), this trigger becomes redundant and can be dropped.

drop trigger if exists enforce_signup_invite on auth.users;
drop function if exists private.enforce_signup_invite();

create or replace function private.autoconfirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists autoconfirm_new_user on auth.users;
create trigger autoconfirm_new_user
  before insert on auth.users
  for each row execute function private.autoconfirm_new_user();

drop table if exists private.settings;
