-- Follow-up to the already-applied family_sms_invites migration. The
-- invitation tool can replay inside Eve, and a network error can happen
-- after Telnyx accepted a message. A durable request key prevents duplicate
-- sends, while the provider id records confirmed submission.

alter table public.family_sms_invites
  add column if not exists request_key text,
  add column if not exists provider_message_id text;

-- The feature had not deployed when this follow-up was written, but make
-- the migration safe if a draft row exists from a manual smoke test.
update public.family_sms_invites
set request_key =
  md5(id::text) || md5('family-sms-invite:' || id::text)
where request_key is null;

alter table public.family_sms_invites
  alter column request_key set not null,
  add constraint family_sms_invites_request_key_length
    check (char_length(request_key) = 64),
  add constraint family_sms_invites_request_key_unique
    unique (request_key);
