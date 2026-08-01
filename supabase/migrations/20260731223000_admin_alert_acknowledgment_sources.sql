-- The alert console gained inbound-receipt and repeated-tool-failure rows
-- after the acknowledgement table shipped. Both are UUID-backed, server-only
-- sources, so expand the existing source constraint without changing rows.
-- Additive only, safe to apply before the matching console deployment.

alter table public.admin_alert_acknowledgments
  drop constraint if exists admin_alert_acknowledgments_source_check,
  add constraint admin_alert_acknowledgments_source_check
    check (source in ('task_run', 'delivery', 'email_send', 'inbound_receipt', 'tool_failure'));
