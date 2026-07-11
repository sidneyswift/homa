# Founder-only external actions

This is the current queue for decisions, browser logins, payments, read-aloud approvals, and private account actions that an agent cannot complete alone.

An unchecked item is a requested action, not proof that the external state is missing or unchanged. Re-verify the relevant provider or private record before acting. Record sanitized evidence in the build log or reconciliation evidence after completion. Historical setup and superseded steps are preserved in `docs/homa-planning/history/2026-07-11-human-todo-archive.md`.

## Open founder decisions

- [ ] D10: confirm whether "Hegg" means Heggerty before the curriculum library uses that name. Canonical source: `docs/homa-planning/journeys/10-reconciliation.md` §5.
- [ ] DM7: keep waitlist email invite and launch scoped, or approve ongoing-content consent copy before nurture email is sent. Until then, nurture email stays staged. Source: `docs/homa-planning/14-marketing-demand-engine.md` §10.
- [ ] Direct printer integration: approve or reject the reversal proposed in `docs/homa-planning/send-to-printer-plan.md` § Founder decision queue.
- [ ] Minors' media: decide whether child photos and other minors' media are private by default despite global D7. Source: the founder decision registry.
- [ ] Duplicate-family data: ask an agent to re-verify the private records, then authorize the smallest safe merge or deletion. Do not act from the archived snapshot.

## Conference and public discovery

- [ ] Run the public onboarding and waitlist path on the actual conference phone and connection. Record the route, time, outcome, and whether the row and email were verified.
- [ ] Review the phone-based conference field kit in `docs/homa-planning/journeys/09-discovery-research-plan.md` before July 13.
- [ ] Add the `thankshoma.com` domain property in Google Search Console and submit the sitemap after confirming the current DNS path.
- [ ] Import the verified property into Bing Webmaster Tools.
- [ ] Register the approved `@thankshoma` social handles. After verification, provide the profile URLs for the public Organization schema.

## Product activation gates

- [ ] Read the current evening-journal prompt aloud. If approved, ask an agent to re-verify the production flag and deployment before enabling it.
- [ ] Test one material request on a real phone through the intended delivery channel. Record generation, review, PDF persistence, and delivery outcomes without exposing private content.
- [ ] Register a branded Homa RCS agent with Telnyx and add the intended test phones during beta review. Record only the approval stage and test date in the build log. Keep agent IDs and account details in server-only environment configuration. After Telnyx supplies a test agent, ask an agent to design and verify `IS_TYPING`, inbound RCS webhooks, one final-reply transport, and SMS fallback before any production flag exists.
- [ ] Re-verify Vercel AI Gateway credit and Agent Runs access state. Add funds or request access only if the current account view shows the need.
- [x] ~~Handwrytten billing check, read-aloud, production switch~~ DONE 2026-07-11 5pm, founder "send it" after the read-aloud ruling (co-founder signature). Live: first three cards ordered and paid (build-log entry same date). Remaining human moment: the cards land in mailboxes in 4 to 7 days, two of them at the co-founders' own homes, look inside one and check the handwriting before the conference cohort's cards start flowing ~July 15.
- [ ] Complete every prerequisite in `docs/homa-planning/plans/2026-07-11-the-wall.md` before enabling the wall: Stripe links and trial behavior, redirect, pricing publication, migration state, copy read-aloud, and an end-to-end test-mode run.

## Marketing and distribution

- [ ] Authenticate Postiz, then connect only the social accounts that were verified above.
- [ ] Create the approved YouTube channel if Shorts distribution remains in scope.

## Mobile and business

- [ ] If native Google sign-in is approved for implementation, register the mobile redirect before the corresponding code ships.
- [ ] Make the Apple Developer, Google Play, and EAS decisions when a named store-release ticket exists.
- [ ] Re-verify Stripe legal-entity requirements before filing an entity for that purpose. The Telnyx sole-proprietor ruling removed SMS registration as an LLC dependency.
