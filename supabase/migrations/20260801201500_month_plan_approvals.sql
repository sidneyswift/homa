-- Approved month-plan drafts. Drafts themselves stay in a session-bound,
-- signed token and never touch Postgres. One row lands only after the parent
-- approves the exact preview. The unique draft id is the idempotency receipt.

create table if not exists public.month_plan_approvals (
  draft_id uuid primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  final_revision smallint not null check (final_revision >= 1),
  revision_history jsonb not null check (jsonb_typeof(revision_history) = 'array'),
  approved_at timestamptz not null default now()
);

create index if not exists month_plan_approvals_family_month_idx
  on public.month_plan_approvals (family_id, month_start desc);

alter table public.month_plan_approvals enable row level security;

drop policy if exists "members read approved month plan history"
  on public.month_plan_approvals;
create policy "members read approved month plan history"
  on public.month_plan_approvals for select to authenticated
  using (public.is_family_member(family_id));

-- Approval writes stay server-side through the authenticated agent tool.
-- Browser clients may read their own history, but cannot forge approval rows.
revoke insert, update, delete on public.month_plan_approvals from authenticated;
