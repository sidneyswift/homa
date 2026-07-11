-- A recipient's yes proves control of the entered phone number, not that
-- the number belongs to the family member the parent intended. Hold access
-- until the original linked parent confirms the full number with a code.

alter table public.family_sms_invites
  add column if not exists inviter_phone_e164 text,
  add column if not exists confirmation_code_hash text,
  add column if not exists confirmation_message_id text,
  add column if not exists accepted_message_id text,
  add column if not exists recipient_accepted_at timestamptz,
  add column if not exists inviter_confirmed_at timestamptz;

-- No invitation rows existed when this migration was authored, so the
-- source phone can become required without guessing a historical sender.
alter table public.family_sms_invites
  alter column inviter_phone_e164 set not null,
  add constraint family_sms_invites_inviter_e164_shape
    check (inviter_phone_e164 ~ '^\+1\d{10}$'),
  add constraint family_sms_invites_confirmation_hash_length
    check (
      confirmation_code_hash is null
      or char_length(confirmation_code_hash) = 64
    );

alter table public.family_sms_invites
  drop constraint family_sms_invites_status_check,
  add constraint family_sms_invites_status_check
    check (
      status in (
        'sending',
        'pending',
        'recipient_accepted',
        'accepted',
        'declined',
        'superseded',
        'expired',
        'failed'
      )
    );

drop index if exists public.family_sms_invites_one_pending_per_phone;
create unique index family_sms_invites_one_pending_per_phone
  on public.family_sms_invites (phone_e164)
  where status in ('sending', 'pending', 'recipient_accepted');

create unique index family_sms_invites_inviter_confirmation_idx
  on public.family_sms_invites (
    inviter_phone_e164,
    confirmation_code_hash
  )
  where confirmation_code_hash is not null;
