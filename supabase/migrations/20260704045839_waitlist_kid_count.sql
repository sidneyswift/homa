-- Migration #5: optional number of kids on the waitlist (5 means 5 or more).
-- Age bands give the distribution; kid_count gives the size two kids in one
-- band would otherwise hide. Feeds cohort prioritization.
alter table public.waitlist add column kid_count smallint
  check (kid_count between 1 and 5);
