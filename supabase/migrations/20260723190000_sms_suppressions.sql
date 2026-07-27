-- SMS suppression list (morning-brief conversion escalation, 2026-07-23).
-- The durable internal record of numbers Homa must not text. Until now the
-- only STOP enforcement was Telnyx's platform block: after a family texted
-- STOP the dispatcher kept attempting sends, burning an agent run into a
-- guaranteed carrier rejection (40300) every cycle, and a permanently
-- invalid number (40309) failed every daily send with no backoff.
--
-- Keyed by the raw E.164 number, the same shape family_phones and the
-- delivery ledger already store. reason says why:
--   'inbound-stop' : the number texted a carrier opt-out keyword.
--   'telnyx-40300' : Telnyx rejected a send because the recipient opted out.
--   'telnyx-40309' : Telnyx rejected the destination number as invalid.
-- An inbound START/UNSTOP deletes the row: the owner asked to resume, and
-- if the number is truly invalid the next send re-suppresses it.
create table if not exists public.sms_suppressions (
  phone_e164 text primary key check (phone_e164 ~ '^\+[0-9]{8,15}$'),
  reason text not null check (char_length(reason) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_suppressions_created_idx
  on public.sms_suppressions (created_at desc);

alter table public.sms_suppressions enable row level security;
-- Deny-all: no policies on purpose. Server-only table, written by the
-- inbound opt-out handler and the delivery path's permanent-rejection
-- classifier, read before any outbound SMS. Same posture as
-- email_suppressions.
revoke all on table public.sms_suppressions from anon, authenticated;
