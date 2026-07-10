-- Migration #40: conversation_messages idempotency key fix (gateway-plan
-- GW-6 finding). eve's message.received and message.completed events
-- carry INDEPENDENT sequence counters, so a user message and the
-- assistant reply in the same turn can both be sequence 0; the old
-- unique (session_id, sequence) key made "on conflict do nothing"
-- silently swallow the assistant row on the email adapter. The real
-- identity of a captured message is (session, turn, role, sequence).
-- Existing rows are unique under the old stricter key, so they are
-- unique under the wider one too; this is safe on live data.

alter table public.conversation_messages
  drop constraint if exists conversation_messages_session_id_sequence_key;
drop index if exists conversation_messages_session_seq_idx;

create unique index if not exists conversation_messages_identity_idx
  on public.conversation_messages
  (session_id, (coalesce(turn_id, '')), role, sequence);

-- Hours can now arrive from the email adapter and dispatcher sessions
-- too; the source label must say where the record really came from.
alter table public.hours_log
  drop constraint if exists hours_log_source_check;
alter table public.hours_log
  add constraint hours_log_source_check
  check (source in ('chat', 'sms', 'call', 'email', 'dispatch'));
