-- Migration #50: multi-parent v0, breaking half. Drops the
-- one-number-per-family constraint so each adult's cell can route to
-- the same family (migration #22 predicted this: "multi-number later
-- is just dropping that constraint"). The number itself stays unique
-- across ALL families: an inbound text must resolve to exactly one
-- family, never two.
--
-- DEPLOY ORDER (do not reorder): the previous code upserts with
-- "on conflict on constraint family_phones_one_per_family", which
-- throws once the constraint is gone. Apply this only after the
-- deploy that replaced setFamilyPhone with addFamilyPhone is READY.

alter table public.family_phones
  drop constraint if exists family_phones_one_per_family;
