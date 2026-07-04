-- Migration #3: function EXECUTE hygiene (security advisor 0028/0029).
-- Functions get EXECUTE granted to PUBLIC by default; revoking from a single
-- role is not enough. is_family_member stays callable by authenticated only
-- (RLS policies evaluate it as the calling role, which needs EXECUTE).

revoke execute on function public.is_family_member(uuid) from public;
revoke execute on function public.is_family_member(uuid) from anon;
grant execute on function public.is_family_member(uuid) to authenticated;

-- Project-level auto-RLS helper should not be callable over the Data API.
revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
