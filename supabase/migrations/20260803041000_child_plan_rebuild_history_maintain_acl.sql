-- PostgreSQL 17 added the MAINTAIN table privilege. Supabase default grants
-- can give it to authenticated on a newly created table, and the explicit
-- pre-17 write revoke in the preceding migration does not name it. Keep the
-- archive exactly read-only for app clients while replaying cleanly on the
-- PostgreSQL 16 CI image.

do $revoke_client_maintain$
begin
  if current_setting('server_version_num')::integer >= 170000 then
    execute
      'revoke maintain on table public.child_plan_rebuild_history '
      'from public, anon, authenticated';
  end if;
end
$revoke_client_maintain$;
