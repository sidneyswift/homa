-- The full account-deletion release is paused until its artifact, billing,
-- and production gates are complete. Keep the historical signature so old
-- clients fail closed, but remove every destructive statement and grant.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'account deletion is temporarily unavailable';
end;
$$;

-- CREATE OR REPLACE preserves existing ACLs, so this revoke is required
-- after the replacement rather than relying on the function body alone.
revoke all on function public.delete_own_account()
  from public, anon, authenticated, service_role;
