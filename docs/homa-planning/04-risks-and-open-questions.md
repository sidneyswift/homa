# Homa Cloud : Risks & Open Questions

> Historical risk review, last updated 2026-07-02. Preserve the original risk
> reasoning, but do not treat an open question, mitigation, price, provider fact,
> or channel assumption here as current. Current policy lives in the founder
> registry. Surviving implementation risks require a current ticket and evidence.

## Top risks

### R1 : eve is 16 days old (beta churn)
42 releases in two weeks; APIs will change under us during a ~4-month build.
**Mitigation:** harness-isolation rule : all domain logic lives in `packages/core` and
tool implementations; eve touches only the thin adapter layer. Pin versions, upgrade
deliberately. Fallback (custom harness on AI SDK + Workflow + Sandbox) stays viable
because of the same isolation. **Known by:** M0-01 + ongoing.

### R2 : Public launch scope on a solo founder
Chosen deliberately, but it makes billing, legal, abuse, and support launch-blocking
(~M4 is a full milestone of non-product work). The classic failure is drowning in M4
while retention bugs pile up in M2/M3.
**Mitigation:** milestones are strictly ordered; nothing in M4 starts before M2 core
journeys work end-to-end for Alessa. If timeline pressure hits, the fallback is a
soft-launch waitlist (self-serve mechanics, throttled intake) : same code, less blast
radius. **Known by:** end of M2 reality check.

### R3 : LLM cost per family vs subscription price
Mac Mini runs Opus-class on everything for one family. At N families × $29–49/mo, model
mix is an existential parameter, not a tuning detail.
**Mitigation:** M0-06 cost model before pricing is printed; global (not per-family)
research job; cheap-model-first scoring; per-family metering + soft caps from day one.
**Known by:** M0-06, re-verified at M4-10 dry run.

### R4 : Cross-tenant leakage (children's data)
One deployment serving all families means a scoping bug is a catastrophic breach of the
most sensitive data category we could have chosen.
**Mitigation:** `familyId` from auth context only (never model output); adversarial
isolation test suite in CI (M1-07); no third-party OAuth in v1; audit-logged admin access.
**Known by:** M1-07 green and kept green.

### R5 : Web-chat-only kills the magic
Alessa's actual usage is voice notes to Slack from her pocket. A web app she must
remember to open may not sustain the ambient relationship : and ambient capture is what
feeds the profile that is our moat.
**Mitigation:** voice-first web UX (M0-04 spike is about this, not nice-to-have); PWA
install prompt; email/push deep links that land in-chat in one tap; SMS fast-follow
(M5-01) with paperwork started as soon as the entity exists. Alessa's 2-week parity test
(M4-11) is the honest measure. **Known by:** M4-11.

### R6 : Retention beyond the wow
Competitors are cheap trackers; we're 3–5× their price. If weekly value isn't felt,
churn eats the launch.
**Mitigation:** journeys J2/J5 are designed around visible compounding ("logged : that
moves her counting up"); weekly note is the retention artifact; measure D7/D30 artifact
generation + journal reply rates from day one (events table exists in M1-02).
**Known by:** first 60 days post-launch.

### R7 : Benchmarks/advice quality at scale
One global benchmarks library feeding all families raises the stakes of a bad research
update; developmental guidance to parents has real-world consequences.
**Mitigation:** Sidney review queue before publish (M3-04); citations mandatory
(inherited from template); positioning as "informational, not diagnostic" in ToS + tone;
never alarm-frame delays. **Known by:** M3-04 process design.

### R8 : Closed-source decision forfeits the community funnel
Chosen. Cost: no OSS distribution channel, homa-template goodwill ends.
**Accepted trade:** focus. Revisit only if CAC proves brutal post-launch.

## Open questions (assigned to milestones)

| # | Question | Resolve at |
|---|---|---|
| Q1 | ~~eve per-tenant sandbox/session semantics~~ Resolved 2026-07-02 from eve 0.19 bundled docs: one deployment / many tenant principals; per-session persistent sandboxes; dispatcher-cron fan-out. M0-01 verifies behavior (longevity, latency, cost) | M0-01 |
| Q2 | ~~Neon vs Supabase~~ Resolved 2026-07-02: **Supabase** (Sidney's call) : RLS as a second tenant wall, bundled Auth as Q3 candidate, MCP already in the dev workspace (see 05-vercel-platform-facts.md) | Closed |
| Q3 | Auth provider : now Supabase Auth vs Clerk vs Auth.js (Supabase Auth is the default candidate since it ships with the chosen DB: one vendor, unlimited MAU on Pro, and its JWT maps cleanly to the eve route-auth `AuthFn`) | M1-01 |
| Q4 | Price point + trial mechanics ($19/29/49 probe) | M0-07 conference + M0-06 cost floor |
| Q5 | v1 supported age range (template covers 2–7; be honest on marketing) | M0-10 |
| Q6 | Font redistribution rights | M0-08 |
| Q7 | Product name/trademark check ("Homa" collision scan) + domain | M4-07 latest |
| Q8 | Entity formation timing (blocks Stripe *branding* + 10DLC, not dev) | Sidney, by M4 |
| Q9 | Does card-after-trial vs card-upfront fit this audience? | M4 A/B or founder call |
| Q10 | What does Alessa's friend's half-built system become? (Candidate: first migration test after Alessa) | Post-M4 |
