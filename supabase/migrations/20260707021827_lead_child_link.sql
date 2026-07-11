-- Migration #20: links a mirrored product child (public.children) back to the lead kid it
-- came from, so the family-workspace bridge (founder ruling 2026-07-06:
-- "once they generate a report they create a family workspace") is
-- idempotent: a rescore updates the same product child instead of creating
-- a duplicate, and profile edits mirror forward. Nullable: legacy leads and
-- kids not yet scored have no product row. on delete set null: deleting a
-- product child must never delete lead history, and a nulled link simply
-- re-mirrors on the next score. No RLS change: lead tables stay deny-all
-- (migration #7) and children policies are untouched.
alter table public.lead_children
  add column child_id uuid references public.children (id) on delete set null;
