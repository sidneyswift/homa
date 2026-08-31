-- Walk v2 resume steps (mobile onboarding + paywall v2,
-- plans/2026-08-30-mobile-onboarding-paywall-v2/walk-v2-proposal.md).
--
-- The walk gains its named climax: "paywall" (S10, presents for
-- everyone, never arms; D8) and "decline" (S11, only from "No thanks";
-- D5). Resumability is the walk's law, so both are legal saved
-- positions. Additive: the constraint widens, every stored value stays
-- valid, and the previous deploy keeps writing the old values happily,
-- so this may lead the code deploy.

alter table public.mobile_onboarding_state
  drop constraint if exists mobile_onboarding_state_step_check;

alter table public.mobile_onboarding_state
  add constraint mobile_onboarding_state_step_check
  check (step in (
    'door', 'hello', 'intent', 'kids', 'making', 'reveal',
    'paywall', 'decline', 'next'
  ));
