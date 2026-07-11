-- Consent-first family invitations over SMS. A linked parent may supply
-- another adult's number, but child information stays here until that
-- number replies yes. The accepted phone then routes to the same family
-- through family_phones; web membership remains the email /join flow.
--
-- Deny-all like every phone and token table. Only server code may read or
-- write these rows, and no phone number or learning update enters events.

create table if not exists public.family_sms_invites (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  -- Audit only. SMS-born families can have no auth member yet, so null is
  -- valid and no FK is used, matching family_invites.invited_by.
  invited_by uuid,
  inviter_name text,
  phone_e164 text not null,
  child_id uuid references public.children (id) on delete set null,
  learning_update text not null,
  status text not null default 'sending'
    check (status in ('sending', 'pending', 'accepted', 'declined', 'superseded', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  responded_at timestamptz,
  constraint family_sms_invites_e164_shape check (phone_e164 ~ '^\+1\d{10}$'),
  constraint family_sms_invites_name_length
    check (inviter_name is null or char_length(inviter_name) between 1 and 120),
  constraint family_sms_invites_update_length
    check (char_length(btrim(learning_update)) between 1 and 240),
  constraint family_sms_invites_response_shape check (
    (status in ('sending', 'pending') and responded_at is null)
    or (status not in ('sending', 'pending') and responded_at is not null)
  )
);

-- One phone can consider only one family invitation at a time. A row is
-- non-actionable while Telnyx submission is in progress, then becomes
-- pending only after the provider accepts the send.
create unique index if not exists family_sms_invites_one_pending_per_phone
  on public.family_sms_invites (phone_e164)
  where status in ('sending', 'pending');

create index if not exists family_sms_invites_family_created_idx
  on public.family_sms_invites (family_id, created_at desc);

create index if not exists family_sms_invites_phone_created_idx
  on public.family_sms_invites (phone_e164, created_at desc);

alter table public.family_sms_invites enable row level security;

-- No policies on purpose. Grants decide whether a Data API role can reach
-- the table, and RLS remains the second wall if grants change later.
revoke all on table public.family_sms_invites from anon, authenticated;

-- Every phone access-boundary change rotates the Eve SMS continuation
-- token. The row remains after unlinking so an unlinked phone cannot resume
-- model history from an earlier access cycle.
create table if not exists public.family_phone_access_epochs (
  phone_e164 text primary key,
  epoch uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now(),
  constraint family_phone_access_epochs_e164_shape
    check (phone_e164 ~ '^\+1\d{10}$')
);

alter table public.family_phone_access_epochs enable row level security;
revoke all on table public.family_phone_access_epochs from anon, authenticated;

insert into public.family_phone_access_epochs (phone_e164)
select phone_e164 from public.family_phones
on conflict (phone_e164) do nothing;

create or replace function public.rotate_family_phone_access_epoch()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_phone text;
begin
  if tg_op = 'DELETE' then
    target_phone := old.phone_e164;
  else
    target_phone := new.phone_e164;
  end if;

  insert into public.family_phone_access_epochs (phone_e164, epoch, updated_at)
  values (target_phone, gen_random_uuid(), now())
  on conflict (phone_e164) do update
    set epoch = excluded.epoch, updated_at = excluded.updated_at;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.rotate_family_phone_access_epoch()
  from public, anon, authenticated;

drop trigger if exists family_phones_rotate_access_epoch
  on public.family_phones;
create trigger family_phones_rotate_access_epoch
after insert or delete on public.family_phones
for each row execute function public.rotate_family_phone_access_epoch();
