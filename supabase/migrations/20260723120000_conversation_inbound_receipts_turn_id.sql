-- Turn-scoped completion for inbound SMS/email receipts. eve's session auth
-- context has a single mutable "current" slot (AuthKey), not one per turn, so
-- reading attributes.inboundReceiptId at message.completed can pick up a
-- LATER turn's attributes when a family sends two texts close together on
-- the same long-lived session, silently orphaning the earlier receipt as
-- 'claimed' forever (the BUG-P3-2 silent stall, confirmed live: two real
-- families' SMS replies never got an answer). runtime_turn_id is stamped
-- once, at turn.started, before any later turn on the same session can
-- overwrite the auth context, then used to look the receipt back up at
-- turn.completed instead of trusting session.auth.current.
alter table public.conversation_inbound_receipts
  add column if not exists runtime_turn_id text;

create index if not exists conversation_inbound_receipts_turn_idx
  on public.conversation_inbound_receipts (runtime_session_id, runtime_turn_id)
  where status = 'claimed';
