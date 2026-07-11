# Billing & Credits Design : subscription + pay-per-usage (Stripe)

> Historical billing design and research snapshot from 2026-07-02. Preserve the
> explored ledger, credit, and Stripe alternatives as decision history. Current
> billing policy lives in the founder registry, current repository shape lives in
> the wall plan and code, and current Stripe state requires direct provider evidence.

## Stripe landscape facts (researched 2026-07-02)

- **Stripe acquired Metronome (Jan 2026, ~$1B).** Metronome is now Stripe's "primary
  usage-based billing platform" for complex cases (real-time credit drawdown,
  dimensional pricing, enterprise contracts) : but it's **contact-sales, not
  self-serve GA**. Stripe's native **Billing Meters + Credit Grants stay available**
  under standard Billing pricing and cover: pay-as-you-go, flat-fee+overage, and
  credit-based pricing (burndown applied at **invoice time**, not real-time).
- **Billing Meters API**: create a meter (`event_name`, aggregation `sum`), send
  `POST /v1/billing/meter_events` with `{stripe_customer_id, value}`; decimals OK;
  async aggregation; v2 event-stream does 10k events/s (irrelevant at our scale);
  per-customer limit of 100 unique event combinations per meter.
- **Credit Grants API**: prepaid or promotional credits per customer;
  **monetary-only** (`amount.type=monetary` : no native "credit units");
  apply **only to metered subscription line items**, automatically at invoice
  finalization; immutable ledger (`credit_balance_transactions`); priority +
  expiration ordering; `paid` vs `promotional` categories.
- **Entitlements API** exists for per-plan *feature* access, but there is no native
  per-plan usage quota / reset logic : that's the gap Metronome fills at enterprise
  scale and our internal ledger fills at ours.
- **Fees**: Stripe Billing = **0.7% of billing volume** (flat, consolidated July 2024)
  on top of payment fees (2.9% + $0.30 card). One-off invoices/payments (e.g., credit
  packs via Checkout) are excluded from the 0.7%.

## The design decision

**Internal credit ledger is the source of truth; Stripe is the money layer.**

Why not pure Stripe-native burndown: credit grants settle at *invoice finalization* and
meter aggregation is *async* : but we need **real-time** balance checks to gate actions
mid-conversation ("you're out of credits : top up?") and to keep a hard ceiling on our
model spend. Real-time drawdown is exactly the feature Stripe reserves for Metronome
(contact-sales). At our scale, an internal ledger + Stripe subscriptions/Checkout gives
us Metronome-grade UX with none of the dependency. If we later outgrow it, Metronome is
the graduation path, not a rewrite (same meter-event shape).

```
Mom subscribes ($29/$49 via Stripe Subscription, licensed price; card on file)
        │  invoice.paid webhook
        ▼
credit_ledger: +N included credits (expire end of cycle, no rollover)
        │
Every billable action → chargeCredits(familyId, action) BEFORE execution
        │  balance < threshold? → AUTO TOP-UP (default): off-session PaymentIntent
        │  for the next pack, credits granted instantly, action proceeds uninterrupted
        ▼
Manual packs also available via Stripe Checkout (paid credits, 12-mo expiry)
```

- `credit_ledger` = append-only rows (grant / burn / expire / refund), balance = SUM,
  RLS by family_id like everything else. Mirrors Stripe's own immutable-ledger design.
- **COUNCIL REVISION (2026-07-02, V1 in 09-council-synthesis.md : veto-able by Sidney):
  never-block via GRACE BUFFER; auto top-up is an explicit opt-in.** All four reviewers
  independently attacked silent default-on off-session charges (races that double-charge,
  FTC negative-option/ROSCA exposure, chargeback-program risk to the Stripe account,
  community-trust blast radius in a Facebook-group-organized niche). The revised design
  preserves the actual intent : the mom is NEVER blocked mid-action:
  1. **Grace buffer:** balance may go modestly negative; the action always completes.
  2. Post-action, a friendly one-tap top-up prompt. The first low-balance moment also
     offers **opt-in auto top-up** ("never interrupt me : top up automatically") on its
     own consent screen stating pack size, threshold, and monthly cap : un-bundled from
     subscription consent (ROSCA). Opted-in families get exactly the silent experience.
  3. Instant notification on every auto top-up (email/push) with one-tap refund window.
  4. Concurrency + replay hardening (architect #2): **Postgres advisory lock** makes
     top-up singleflight per family; idempotency is enforced by **DB unique
     constraints**, not keys alone; monthly included credits are granted by OUR
     scheduler at cycle start (the `invoice.paid` webhook reconciles, it doesn't
     trigger) so webhook lag can't cause a spurious charge at cycle boundary.
  5. **Trial economics defined:** trial = promotional credits (e.g., 300), no card,
     hard stop at zero during trial (resolves the J1 card-after-trial contradiction).
  6. **Global billing kill switch:** one flag stops all off-session charges fleet-wide.
- We still never bill metered usage in arrears in v1 → no Stripe meters at launch;
  add a metered overage price later only if a true pay-as-you-go tier proves wanted.
- **Sequencing (realist #2):** this entire system is a POST-REVENUE build. Cohort one
  pays via a Stripe **Payment Link** ($29/mo) with usage watched manually in the AI
  Gateway dashboard; the ledger gets built when 20+ payers provide real usage curves.
- Webhooks (idempotent, signature-verified): `invoice.paid` (grant monthly credits),
  `checkout.session.completed` (packs), `customer.subscription.updated/deleted`
  (entitlements), `charge.refunded`/`charge.dispute.created` (claw back credits).
- Customer portal for card/plan management ($10/mo custom-domain add-on if wanted).

## Credits: the unit and the margin law

**1 credit = $0.01 of retail value.** Every billable action has a credit price derived
from measured COGS:

```
credit_price(action) = ceil( COGS(action) × margin_multiplier / $0.01 )
margin_multiplier = 3.3   (≥70% gross margin target, set per action class)
```

### The `action_costs` registry (the "consider costs with every new feature" mechanism)

A config table + versioned file, one row per billable action × model tier:

| action | COGS source | est. COGS | credits | retail |
|---|---|---|---|---|
| chat turn (fast model) | Gateway report | ~$0.005–0.01 | 2–3 | $0.02–0.03 |
| worksheet (illustrated, NB2 @1K) | fal $0.08 + sandbox ~$0.02 + LLM | ~$0.12 | 40 | $0.40 |
| coloring page (Seedream) | fal $0.04 + sandbox | ~$0.06 | 20 | $0.20 |
| picture book (10 imgs) | fal $0.80 + LLM | ~$1.00 | 330 | $3.30 |
| weekly scoring run | batched LLM | ~$0.05–0.15 | 0 (plan-included, costed not charged) | : |
| voice-note transcription | Whisper | ~$0.006/min | 2/min | $0.02/min |

Governance rules (enforced, not aspirational):
1. **No unpriced actions ship** : CI check: every eve tool that consumes paid resources
   must reference an `action_costs` entry (lint on the tool registry).
2. **New model = new row** : switching or adding a model tier requires a COGS estimate
   and credit price before merge. The PR template asks for it.
3. **Monthly margin review** : a scheduled job joins AI Gateway Custom Reporting
   (`user`/`tags` actuals) + fal invoices + sandbox usage against credits burned,
   producing per-action realized margin in the admin console. Reprice when drift >20%.
4. **Two backstops under the ledger**: eve per-session token limits + AI Gateway
   per-key USD budget caps. Ledger protects margin; backstops protect against bugs.

### eve integration

- `chargeCredits` runs in the tool `execute` (app runtime), **before** the side effect;
  refund-on-failure in a `finally`. Idempotency key = `sessionId:turnId:toolCall`.
- Balance + plan ride into the session via dynamic instructions (agent can say "that'll
  use about 40 credits : you have 220 left" naturally when asked, never nags).
- Low balance → grace buffer lets the action complete; opted-in families top up
  inline (advisory-locked, off-session PaymentIntent); others get the post-action
  one-tap prompt. The agent never mentions billing unless asked or the card fails.
  Only a dead card after retry produces a typed "payment_needed" result, where the
  agent gently points to the payment-update link.
- Schedule-dispatched loops (scoring, research) are **plan-included**: costed in
  telemetry but not charged : subscription margin covers them, and the registry's
  monthly review keeps that honest.

## Plans : FOUNDER DECISIONS 2026-07-03 (D2/D9/T1/T2 in journeys/10 §5)

Structure decided; numbers deliberately NOT final : they get derived from the margin
system's first 60 days of real cohort data (T2), not invented here.

- **Unlimited children on every plan** (D9). Tiers differ by monthly usage allotment
  (internal credits), marketed as usage tiers : never a per-action meter (D2), never a
  family-size cap. "We never charge for your kids."
- **Overflow = add credits or auto-bump to the next tier for that month.** No hard
  caps, no degraded experience, harmonized with the D1 grace buffer.
- **Trial: card upfront + uncapped power-user experience** (T1) : best models,
  unlimited generation, abuse guardrails only. The trial manufactures the
  Alessa-vs-Fox felt difference; ~$25–45 trial token cost = CAC. Post-conversion never
  feels worse than the trial.
- Premium items (picture books; later video/3D) are the only visibly-priced things.
- Old sizing table (1,500/3,500 credits, child caps) is SUPERSEDED : retained in git
  history only.

Gross margin at full credit burn ≈ 60–70% before Stripe fees (~3.6% + 0.7%); most
families won't burn fully → realized margin higher.

### REAL NUMBERS LANDED (2026-07-02, see 10-real-usage-cost-model.md : 95 days of logs)

Alessa's measured usage: **~3 human turns/day (95/mo)** but **~116 automated LLM
runs/day**; 450M tokens/mo at June peak; ~70 PDFs/mo; ~104K-token stable context per
cold call. Verdict: **as-is on Opus = $100–200+/mo per family : fails at any price**;
tiered remix (cheap models for automation, mid for chat) = **$25–45/mo : works at $49**.

**Why the cloud design fixes this structurally, not just by model choice:** the two
dominant Mac Mini costs are architecture we already deleted : the 30-min heartbeat
(~83M tokens/mo) doesn't exist in event-driven eve, and the every-30-min ambient
Slack sweep (~66M tokens/mo, mostly null runs) is replaced by the post-turn review
(M2-13) which only fires on the ~3 real turns/day. That alone removes ~⅓ of peak token
burn before any model downgrade. Remaining optimization targets, now quantified:
**29 LLM calls per human turn** (tool loops : cap subagent depth, tighten tool
results) and the **104K-token stable context** (our per-turn dynamic instructions must
carry the profile + memory only : benchmarks are global server-side data, never
in-context; eve loads skills on demand). M0-06's cost model is now seeded with
measured, not simulated, numbers.

## What we deliberately did NOT choose

- **Metronome**: right tool at 100× our scale; contact-sales dependency and enterprise
  surface today. Revisit when self-serve or when we want real-time Stripe-native
  drawdown, commits, or dimensional rate cards.
- **Stripe-native credit burndown at invoice time**: elegant, but invoice-time-only
  application + monetary-only grants + async meters still forces an internal ledger for
  gating : running both systems doubles reconciliation surface for zero v1 benefit.
- **Uncapped in-arrears usage billing**: bill-shock risk for the audience; revisit as an
  opt-in tier with the meter wiring described above.

## Backlog impact

- M1-06 expands: Subscription + Checkout packs + webhook suite + customer portal.
- NEW M1-12 ⛔: `credit_ledger` (append-only, RLS) + `chargeCredits` helper + grant/
  expiry jobs + refund clawback.
- NEW M1-13 ⛔: `action_costs` registry + CI "no unpriced actions" check + admin
  margin view fed by Gateway Custom Reporting.
- Auto top-up: folded into M1-12 as the opt-in path (council V1) : no separate ticket.
- OPEN CALL (Sidney, council #2 in 09): customer-facing credit meter vs invisible
  accounting (flat plans + fair-use, internal ledger unchanged). Plan sizing must also
  be re-checked against the "materials daily" promise either way : the product reviewer
  showed the advertised use case (~2,400 credits/mo for two kids) structurally exceeds
  the Basic allotment.
- M0-06 (cost model) now outputs: per-action COGS table → initial `action_costs` rows
  and included-credit sizing per plan.
