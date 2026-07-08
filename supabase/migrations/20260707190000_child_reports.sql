-- Migration #23: product-side report ownership (family workspace, Phase A).
--
-- Founder ruling 2026-07-07: the progress report becomes a native view
-- inside the signed-in family workspace, so its data moves from the
-- token-addressed lead tables (deny-all, reached by a server-only secret)
-- into product tables reached by IDENTITY (the signed-in parent, under
-- RLS). Shapes mirror lead_reports / lead_answers / lead_plans so the
-- deterministic scorer and the report renderer are reused unchanged; the
-- funnel/sharing columns (token, viewed_at, emailed_at, revoked_at) are
-- intentionally dropped, the shareable token page stays on the lead side.
--
-- Tenancy law (BUILD.md, non-negotiable): every row is child-scoped, and
-- every policy resolves the child to its family through
-- is_child_family_member, a SECURITY DEFINER helper so it reads children
-- without RLS recursion (the same shape as is_family_member from
-- migration #2). Anon gets no policy, so anon reads return nothing and
-- anon writes are denied. Product-table writes run under the parent's own
-- session, never a service role.

-- child -> family membership, without tripping children's own RLS.
create or replace function public.is_child_family_member(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.children c
    where c.id = cid
      and public.is_family_member(c.family_id)
  );
$$;

-- EXECUTE is granted to PUBLIC by default, so revoking from anon alone
-- leaves it callable via PUBLIC (advisor 0028); mirror is_family_member's
-- migration #3 hygiene: strip PUBLIC + anon, keep authenticated (RLS
-- policies evaluate this as the calling role and need EXECUTE).
revoke execute on function public.is_child_family_member(uuid) from public;
revoke execute on function public.is_child_family_member(uuid) from anon;
grant execute on function public.is_child_family_member(uuid) to authenticated;

-- 1. child_reports: one live report per product child (mirror of the live
--    lead_reports row, minus the funnel/sharing columns).
create table public.child_reports (
  child_id uuid primary key references public.children (id) on delete cascade,
  scores jsonb not null,
  bank_version text not null,
  history jsonb not null default '[]'::jsonb,
  narrative jsonb,
  narrative_meta jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.child_reports enable row level security;

create policy "members read child reports"
  on public.child_reports for select to authenticated
  using (public.is_child_family_member(child_id));
create policy "members add child reports"
  on public.child_reports for insert to authenticated
  with check (public.is_child_family_member(child_id));
create policy "members update child reports"
  on public.child_reports for update to authenticated
  using (public.is_child_family_member(child_id))
  with check (public.is_child_family_member(child_id));
create policy "members delete child reports"
  on public.child_reports for delete to authenticated
  using (public.is_child_family_member(child_id));

-- 2. child_answers: the parent's raw observations behind the report. The
--    answer check mirrors lead_answers so a forged value cannot land; the
--    scorer still treats answers as its only input.
create table public.child_answers (
  child_id uuid not null references public.children (id) on delete cascade,
  question_id text not null,
  answer text not null
    check (answer in ('easily', 'getting_there', 'not_yet', 'not_sure', 'skip')),
  source text,
  answered_at timestamptz not null default now(),
  primary key (child_id, question_id)
);

alter table public.child_answers enable row level security;

create policy "members read child answers"
  on public.child_answers for select to authenticated
  using (public.is_child_family_member(child_id));
create policy "members add child answers"
  on public.child_answers for insert to authenticated
  with check (public.is_child_family_member(child_id));
create policy "members update child answers"
  on public.child_answers for update to authenticated
  using (public.is_child_family_member(child_id))
  with check (public.is_child_family_member(child_id));
create policy "members delete child answers"
  on public.child_answers for delete to authenticated
  using (public.is_child_family_member(child_id));

-- 3. child_plans: the four-week plans per subject (mirror of lead_plans).
create table public.child_plans (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.children (id) on delete cascade,
  domain_id text not null,
  plan jsonb not null,
  bank_version text not null,
  progress jsonb not null default '{}'::jsonb,
  retest_at timestamptz,
  retest_emailed_at timestamptz,
  narrative jsonb,
  narrative_meta jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (child_id, domain_id)
);

create index child_plans_child_idx on public.child_plans (child_id);

alter table public.child_plans enable row level security;

create policy "members read child plans"
  on public.child_plans for select to authenticated
  using (public.is_child_family_member(child_id));
create policy "members add child plans"
  on public.child_plans for insert to authenticated
  with check (public.is_child_family_member(child_id));
create policy "members update child plans"
  on public.child_plans for update to authenticated
  using (public.is_child_family_member(child_id))
  with check (public.is_child_family_member(child_id));
create policy "members delete child plans"
  on public.child_plans for delete to authenticated
  using (public.is_child_family_member(child_id));

-- Backfill: copy every already-linked lead report / answers / plan into
-- the product tables (one-time; runs as the migration role, so it sees
-- all rows regardless of RLS). lead_children.child_id (migration #18) is
-- the join key; unlinked lead kids carry nothing across and re-mirror on
-- their next score. on-conflict-do-nothing keeps a re-run safe.
insert into public.child_reports (child_id, scores, bank_version, history, narrative, narrative_meta, generated_at)
select lc.child_id, lr.scores, lr.bank_version, coalesce(lr.history, '[]'::jsonb),
       lr.narrative, lr.narrative_meta, lr.generated_at
from public.lead_reports lr
join public.lead_children lc on lc.id = lr.lead_child_id
where lc.child_id is not null and lr.revoked_at is null
on conflict (child_id) do nothing;

insert into public.child_answers (child_id, question_id, answer, source, answered_at)
select lc.child_id, la.question_id, la.answer, la.source, la.answered_at
from public.lead_answers la
join public.lead_children lc on lc.id = la.lead_child_id
where lc.child_id is not null
on conflict (child_id, question_id) do nothing;

insert into public.child_plans (child_id, domain_id, plan, bank_version, progress, retest_at, retest_emailed_at, narrative, narrative_meta)
select lc.child_id, lp.domain_id, lp.plan, lp.bank_version, coalesce(lp.progress, '{}'::jsonb),
       lp.retest_at, lp.retest_emailed_at, lp.narrative, lp.narrative_meta
from public.lead_plans lp
join public.lead_children lc on lc.id = lp.lead_child_id
where lc.child_id is not null
on conflict (child_id, domain_id) do nothing;
