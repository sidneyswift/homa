-- A transport exception can happen after provider acceptance. Preserve the
-- uncertainty and never replay that destination automatically.

alter table public.conversation_deliveries
  drop constraint if exists conversation_deliveries_status_check;
alter table public.conversation_deliveries
  add constraint conversation_deliveries_status_check
  check (status in ('pending', 'sent', 'failed', 'uncertain'));
