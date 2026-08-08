-- Complete the month-plan approval receipt access boundary.
-- Family members may read their own receipts through RLS. Only server roles
-- may create, change, or remove receipts.

revoke all privileges on table public.month_plan_approvals
  from public, anon, authenticated;

grant select on table public.month_plan_approvals to authenticated;
grant all privileges on table public.month_plan_approvals to service_role;
