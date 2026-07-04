-- Migration #4: optional first name on the waitlist, for warm invite emails.
alter table public.waitlist add column first_name text;
