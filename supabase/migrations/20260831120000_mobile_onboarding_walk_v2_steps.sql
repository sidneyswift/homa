-- Walk v2 resume steps (mobile onboarding + paywall v2,
-- plans/2026-08-30-mobile-onboarding-paywall-v2/walk-v2-proposal.md).
--
-- The walk gains its named climax: "paywall" (S10, presents for
-- everyone, never arms; D8) and "decline" (S11, only from "No thanks";
-- D5), plus a real "you" step (S7 moves AFTER the kids in the v2
-- order, and the old workaround of leaving it stepless breaks once it
-- sits directly before making). Resumability is the walk's law, so all
-- three are legal saved positions. Additive: the constraint widens,
-- every stored value stays valid, and the previous deploy keeps
-- writing the old values happily, so this may lead the code deploy.

alter table public.mobile_onboarding_state
  drop constraint if exists mobile_onboarding_state_step_check;

alter table public.mobile_onboarding_state
  add constraint mobile_onboarding_state_step_check
  check (step in (
    'door', 'hello', 'intent', 'kids', 'you', 'making', 'reveal',
    'paywall', 'decline', 'next'
  ));
