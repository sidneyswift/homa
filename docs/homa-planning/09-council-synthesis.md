# Council Synthesis — adversarial review verdicts & plan changes (2026-07-02)

> Four independent read-only reviewers (skeptical architect, consumer-product strategist,
> security/child-privacy red-team, bootstrapped-founder realist) reviewed docs 00–08.
> This doc records what they converged on, what was adopted into the plan, and the four
> calls that belong to Sidney. Full reports live in the agent transcripts.

## Unanimous verdicts (4/4 reviewers, independently)

### V1 — Default-on auto top-up must change ⚠️ REVISES A FOUNDER DECISION — VETO IF DISAGREE
Attacked from four different angles: **architect** (top-up race conditions — two
concurrent low-balance actions double-charge; trial-period contradiction — J1 says no
card in trial, auto top-up assumes card on file; personal Stripe account freeze risk),
**product** (community-trust time bomb in a Facebook-group-organized niche; one "check
your statements" post kills the channel), **realist** (future #1 support ticket +
dispute magnet), **security** (FTC negative-option/ROSCA exposure; Visa/Mastercard
chargeback-program risk = existential for a solo Stripe account; one of three
refuse-to-launch items).

**Adopted compromise — preserves the actual intent ("never block the mom"):**
- **Grace buffer, not gate:** balance may go modestly negative; the action ALWAYS
  completes. The mom is never blocked mid-worksheet. This was the stated goal.
- After the action: friendly one-tap top-up prompt. First such moment also offers
  **explicit opt-in auto top-up** ("never interrupt me — top up automatically"), with
  its own consent screen stating pack size, threshold, and monthly cap (un-bundled
  from subscription consent, per ROSCA).
- Opted-in families get exactly the experience Sidney specified. The default just
  isn't silent.
- Hardening regardless of default: Postgres advisory lock (singleflight top-up per
  family), DB unique constraints as the idempotency mechanism, monthly credits granted
  by our scheduler at cycle start (webhook = reconciliation, not trigger), trial =
  promotional credits with no card, **global billing kill switch**.

### V2 — Invite-gated rollout; public GA becomes a scheduled milestone, not the launch
3/4 explicitly (architect, product, realist; security implicitly via "refuse to launch
without" list). Decisive argument (realist): **the same self-serve architecture is
built either way** — the only change is an invite-code check at signup. What it buys:
revenue in ~6 weeks instead of ~4+ months, retention signal (the existential risk)
2 months earlier, "AI said something weird about my kid" failures discovered on
forgiving invitees, and half of M4's launch blockers converted into a funded roadmap.
**Adopted:** self-serve mechanics + invite codes for the first 20–50 families
(friend + conference waitlist); **public GA is a switch flipped after 10 stranger
families survive onboarding + week-4 unassisted.** The public-launch decision stands —
as the GA milestone. **[Superseded in part 2026-07-05, build-log: the founder opened
signup ("no hoops", migration #8); the invite-code check at signup was built, then
removed. Invites survive as MJ-09 distribution to the waitlist cohort.]**

### V3 — The timeline was lying
Realist's arithmetic: the backlog's own ticket sizes sum to **~26 focused weeks**, not
15; with realistic solo hours it's a 9–12 month plan. Architect: M4 contains an
irreducible 2-week calendar test plus lawyer lead time; eve churn tax (~15%/milestone)
budgeted nowhere. **Adopted:** the resequenced **"first dollar in ~6 weeks"** track
(see 03-backlog.md §M-R) with concierge loops — weekly scoring/notes run as
Sidney-triggered, Sidney-reviewed sends until volume hurts (which is also the
fail-closed human review the security reviewer wanted on outbound developmental
claims). Alessa's parity test moves from month ~4 to **week 5**, where its lesson is
cheap.

## Strong-consensus adoptions (2–3 reviewers)

1. **Onboarding inversion (product #1, realist #6):** 3-minute wow — 4 questions per
   child → personalized worksheet — THEN the 15-min questionnaire becomes a week-one
   drip ("3 questions a day"), doubling as the day-1→7 engagement mechanic. The
   confidence system already tolerates sparse profiles. M2-03 re-scoped and split
   (boring form intake / conversational questionnaire / in-chat wow).
2. **Hours/compliance pulled forward (product #5):** the only externally validated
   demand ships with journal capture in the first build wave, not after the coaching
   loops. It shares the journal routing pipeline anyway. Concierge state-report at
   first ("ask Homa" → compiled from the log).
3. **Session rotation gets real mechanics (architect #3):** new ticket — rotate only
   at idle, never while parked; structured episode-summary written to Postgres on
   rotation (our template, not eve's 280-char compaction); atomic cursor swap;
   `recall_conversations` promoted to launch-blocking since rotation makes recall
   load-bearing.
4. **Billing/dispatcher get distributed-systems rigor (architect #2/#5):** lease TTL +
   reaper, fan-out as a durable workflow, outbox pattern with
   `(schedule_row_id, scheduled_for)` uniqueness on every outbound send, dispatcher
   heartbeat + gap alert, chaos tests (kill dispatcher mid-run) in M0.
5. **The moat gets a backup story (architect #6):** Supabase PITR day one, nightly
   dump to Blob, append-only `profile_revisions` with writing-job identity ("revert
   everything job X wrote between T1–T2" = one query), delta/rate guards on the
   learning review (a turn moving >N subdomains gets staged, not auto-applied).
6. **Safe mode before first customer (realist #8, architect #7):** one global switch
   pauses all proactive loops, outbound emails, and charges; chat degrades to
   reactive-only. Fail-closed: unacknowledged doctor alert ⇒ loops pause. Runbooks
   written as-built (agent-drafted per feature at merge), not as an M4 batch.
7. **M0 re-scoped to what a week can falsify (architect #8, realist #9):** the spike
   was structurally unable to say NO-GO. New adversarial checklist: eve upgrade drill
   mid-parked-session, deploy + rollback with an in-flight run, dispatcher kill,
   rotation-while-parked, synthetic 100-family fan-out. Un-testable risks become dated
   tripwires (e.g., ">2 breaking eve changes >1 day each in any 4-week window before
   M1 ends ⇒ eject; after M2 starts ⇒ never eject, fork/vendor the pinned version").
8. **Harness escape hatch made real (architect #1):** define the
   `startTurn/parkForHuman/resume/scheduleDispatch/persistEvent` TypeScript contract
   now; eve is an adapter behind it (including wrapping `useEveAgent`). The fallback
   stops being fictional the day this interface exists.
9. **Positioning reframed (product #7), then CORRECTED by the origin user (00 §value
   stack):** the council said bury the metrics; Alessa's testimony says the metrics
   *are* the validation and the closed **efficacy loop** (assess without testing the
   child → target → generate materials → prove the metric moved) is "the ultimate
   selling point." Resolution: metrics LEAD, presentation law stands — strengths-first,
   next-steps-with-materials-attached, never deficit language, max one nudge per
   weekly note. Market "know exactly where your child stands and watch the numbers
   move," anchored against curriculum spend. New tickets: M3-11 ⛔ (efficacy
   attribution view), M3-12 (local discovery), M3-13 (curriculum comparison),
   M5-08/09 (co-op finder, moms network). Cohort-one concierge notes hand-write the
   before/after from week one.

## Security red-team adoptions (all — this data class earns it)

| # | Control | Ticket |
|---|---|---|
| S1 | **Benchmark quarantine pipeline**: research job emits typed fields only (never prose-to-library), citation-must-resolve check, invisible-char/HTML-stripped diff review, content-addressed versioned publishes with one-action fleet revert | M3-04 rewrite |
| S2 | **RLS must actually engage**: agent DB access via non-service role + `SET LOCAL` per-request transaction (never session SET under Supavisor pooling); every tool re-scopes ALL model-supplied IDs (childId, artifactId, …) by family_id server-side | M1-02, M1-07 |
| S3 | M1-07 adversarial suite expanded: service-role/pooling RLS regression, IDOR probes on every ID-taking tool, cross-tenant FTS/pgvector search probes, dispatcher/learning-review principal integrity, continuation-token takeover | M1-07 |
| S4 | **Learning review hardened**: schema-constrained output (enumerated domains, bounded scores, no free text that becomes instruction); ingestion turns run with reduced toolset (no schedule/billing/web tools) | M2-13 |
| S5 | **M2-14 promoted to ⛔** and expanded to cover textbook photos + web-research content; scanning is one layer — structural defenses (labeled untrusted-data blocks, least privilege, output validation) are the real control | M2-14 |
| S6 | **Continuation tokens are secrets**: server-side custody only, ownership check on every resume/append, never logged, rotated on rollover | M1-04 |
| S7 | **Admin inspector = break-glass**: metadata-only by default; content access requires reason-tagged time-boxed grant, immutable audit, family-visible access notice, no export; `recordInputs/recordOutputs:false` in traces | M4-02 acceptance criteria |
| S8 | **Egress/artifact holes**: per-job ephemeral generation sandboxes (nothing cross-tenant to exfil), DNS locked to allowlisted names, generated PDFs flattened/sanitized (no remote resources/JS/metadata), credential brokering as proxy (key never in sandbox env), Blob signed URLs checked for ownership at serve time | M0-03, M1-03, M2-05 |
| S9 | **Compliance floor is executed artifacts, not a lawyer pass**: retention schedule with concrete TTLs per data class, deletion propagation (Blob, backups, subprocessors), published subprocessor list, executed no-training/ZDR DPAs, written breach-response plan with notification clocks — breach plan is launch-blocking | M4-04/05 + new ⛔ |

## Four calls that belong to Sidney

1. **Auto top-up default (V1).** Council: unanimous change to grace-buffer +
   explicit opt-in. Plan updated to the compromise (never blocks, not silent).
   **Veto restores default-on** — but read the security reviewer's ROSCA/chargeback
   section first; the downside lands on the Stripe account everything runs through.
2. **Customer-facing credits vs invisible accounting (product #3).** The engagement
   argument: a visible per-worksheet price makes moms ration the exact daily habit the
   moat needs; plans sized so "daily materials" forces top-ups contradicts the
   one-liner. Proposal: keep the full internal `action_costs`/ledger machinery
   (margin law intact), but sell flat plans with generous fair-use allotments and gate
   only genuinely expensive items (picture books) as labeled premium. Plan text keeps
   both options open pending this call.
3. **Age-range ICP (product #4).** The asset serves ages 2–7; the median homeschool
   family has kids 5–12; J2's own persona has an 8-year-old the product can't serve.
   Options: (a) own "the early-years homeschool assistant (preK–2)" for launch —
   honest, defensible, matches the asset (council recommendation); (b) pull a minimal
   8–12 track forward (+2–3 weeks). Signup must handle out-of-range kids gracefully
   either way.
4. **Child voice & likeness scope (security #5).** Voice notes containing the child's
   own voice and photo-referenced picture-book characters flip the parent-directed
   COPPA posture and touch biometric statutes (BIPA has a private right of action).
   Options: (a) v1 constraint — parent is the speaker/uploader, no child-likeness
   uploads (cheap, clean posture; council recommendation); (b) keep them in-scope and
   fund the COPPA/biometric workup + consent flows + subprocessor DPAs now.

## What the council did NOT change

The engine bet (eve on Vercel) survived all four reviews — the architect attacked its
*fallback story* and *churn budget*, not the choice. The tenancy model, Supabase,
the domain-layer port, the margin-law registry, and the closed-source decision all
stand. The moat thesis survived with a sharpened wording (realist/product): the
durable asset is the accumulating family record — hours, journal, portfolio,
what-works — with the profile as its engine, which is why hours-capture moves forward.
