# Homa Cloud : Product Brief

> Historical planning snapshot, last updated 2026-07-02. Preserve this file as
> origin rationale, not current product, implementation, production, pricing, or
> provider guidance. Current policy lives in `13-mr-prd.md` as reconciled by
> `journeys/10-reconciliation.md` section 5. Current behavior and production
> require repository and direct deployment evidence. Pricing and provider-state
> statements below are dated proposals or observations, not current verification.

## One-liner

Every homeschool mom gets a personal AI agent for her family : one that knows each child,
builds custom materials daily, tracks progress against real developmental benchmarks, and
handles the paperwork : without her husband needing to be an engineer.

## Why we believe this works

- **It already works.** A production instance (Homa on the Mac Mini) has run Alessa's
  homeschool for months: worksheets printed daily, a 15-domain developmental profile that
  compounds, nightly research, weekly scoring, journal capture, dashboards.
- **The moat is the profile + proof, not "having AI."** (Corrected 2026-07-02 by the
  competitive teardown, journeys/08:) Homeschool Fox already ships an AI assistant at
  $12/mo and ArborSlate sits at exactly $29/mo : "first/only AI homeschool assistant"
  claims are banned. What nobody has: the longitudinal child profile, test-for-the-mother
  benchmarks, and the efficacy attribution loop ("the work moved the numbers").
  Personalization-with-proof *is* the essence of homeschooling : that's the wedge.
- **Demand signal:** Alessa's friend saw it and said "I want one." Conference moms asked for
  hours-to-state tracking and per-child customization.

## The value stack : from the origin user, in her words (added 2026-07-02)

Alessa's articulation of what Homa actually is, which corrects both the "tracker"
framing and the council's "bury the metrics" instinct:

1. **The metrics are the emotional core, not a guilt mechanic.** There is quiet
   competitive pressure in the homeschool world ("your child should be doing better
   than the other kids"). Knowing where your child stands against state/national
   standards : **without standardized-testing the child** : *validated the
   homeschooling journey itself*. The assessment is "a test for the mother":
   observational, conversational ("does he count to 40? what books did he read?"),
   never an exam for the kid. This is a category-defining mechanic: every competitor
   either ignores standards or points parents at tests.
2. **The closed efficacy loop is THE selling point** (her words: "the ultimate
   selling point"): metrics identify what the child needs to work on → Homa generates
   materials aimed at exactly that (workbook pages, sensory activities) → the family
   does them → the metrics move → **Homa shows the improvement and attributes it to
   the work**. Not "Homa keeps you organized" : "Homa's activities raised his phonics
   numbers, and here's the before/after." Proof of efficacy is the renewal argument,
   the word-of-mouth artifact, and the answer to "is this worth $29/mo."
3. **Homa is a connector, not a calendar**: compare curriculums; find a co-op nearby;
   surface local community and cultural activities (story hour, the parade this
   weekend, a rainy-day play place, the museum, the zoo) : *contextually tied to what
   the child is learning right now*: "Maya's learning about space this week : want
   tickets to the Air & Space Museum?" "We're studying penguins : your zoo has them,
   should we go Saturday?" (The Mac Mini already prototyped this: the orphaned
   "DC events scout" cron and museum-linked curriculum visuals.)
4. **Connect Homa moms to each other locally** : the community layer, and eventually
   a network effect no tracker can copy.

**Reconciliation with the council's positioning review:** the "am I doing enough?"
hook and the metrics-as-validation testimony are the same insight from two sides :
the weekly note and the standards view ARE the answer to that question, delivered as
evidence. Presentation law stands (strengths-first, "what to work on" framed as
actionable next steps with materials attached, never deficit language, max one nudge
per note) : but the metrics lead, they don't hide one tap deeper.

## The core insight from the Mac Mini

The product is **not** the agent harness (OpenClaw). It's the **domain system** built on top:

| Asset | What it is | Portability |
|---|---|---|
| Child profile schema | 15 domains × subdomains, confidence decay, position vs age band | JSON : fully portable |
| Onboarding questionnaire | ~15 min conversational intake per child (`domains.json`) | JSON : fully portable |
| Benchmarks library | Citation-backed age-band milestones, 15 files | Markdown : fully portable |
| 21 skills | make/track/capture/system skill playbooks | Markdown : mostly portable |
| Generator scripts | Worksheet/PDF/dashboard Python (reportlab, fal.ai) | Python : runs in Sandbox |
| Coaching loops | nightly research → weekly scoring → interventions → weekly plan | Cron + prompts : portable |
| Compiled-view pattern | JSON is truth; vault/dashboard are regenerated renders | Architecture principle |

## The problem the cloud version must solve

The Mac Mini version only survives because Sidney is the ops layer. Evidence from the live
system: heartbeat state frozen 4 days, feedback loop dead since April (unwired Slack event),
cron `channel_not_found` errors, full personal-Gmail access (impossible to offer other
families). **Homa Cloud's core engineering job is to productize Sidney** : self-serve
onboarding, fleet telemetry, per-family health, zero per-customer setup.

## Locked decisions (2026-07-02)

| Decision | Choice | Implications |
|---|---|---|
| v1 audience | **Public self-serve launch** | Billing, legal, abuse protection, support are launch-blocking, not deferred |
| v1 channel | **Web app chat only** (incl. voice notes) | No 10DLC now; proactive touches go via email + web push; SMS/WhatsApp are fast-follows |
| Engine | **eve on Vercel**, gated on a tenancy spike; fallback = custom harness on AI SDK + Workflow + Sandbox | Spike is ticket M0-01, first thing built |
| Business | Entity/EIN handled later; **existing Stripe** available | Stripe from day one; 10DLC needs entity when SMS comes |
| Scope | **Everything ticketed** ("boil the ocean") : sequenced by milestone | Full backlog in `03-backlog.md`; milestones enforce order |
| Open source | **Closed.** homa-template frozen; cloud-first, closed-source | Port template assets into cloud repo; template repo archived |

## Product principles (carried over from the working system)

1. **Files/JSON as truth, views as renders.** Profile JSON → dashboard, reports, plans.
2. **Proactive but earned.** The agent initiates (journal prompt, weekly plan) only where it
   has proven value; no spam.
3. **Read `what-works` before making anything.** Every generated artifact reflects the
   child's interests, modality, and current position.
4. **Confidence decays.** Stale observations force re-measurement; the profile stays honest.
5. **Log everything, compile later.** Capture now (journal, voice notes); compliance reports
   are assembled from logs when needed.
6. **The parent talks, Homa types.** Voice-first capture is the killer interaction (Alessa's
   actual usage pattern) : the web app must make voice notes first-class.

## Positioning & pricing (model decided 2026-07-02; numbers validated in M0)

- **Subscription + usage credits** (see `08-billing-credits-design.md`): $29/$49 plans
  with included monthly credits; **auto top-up by default** : the product never blocks
  mid-action; running low silently adds the next pack (disclosed at signup, monthly cap
  in settings, instant notification, one-tap refund window).
- Every billable action is priced in credits from measured COGS × margin multiplier
  (≥70% gross target) via the `action_costs` registry : new models/features cannot ship
  unpriced (CI-enforced).
- Cost floor: model mix must keep LLM spend well under ~$10/family/mo at typical usage
  (see architecture: shared global research, cheap models for chat, premium for weekly scoring).
- Competitors price $5–15/mo for trackers; we price against "a planning assistant + custom
  curriculum shop," not against trackers. Credits make the premium legible: a mom sees
  exactly what a picture book "costs" and why.

## Naming note

`story_position` and other Story-specific naming in schemas/scripts becomes generic
(`development_position`, `children/{id}.json`) during the port. The Mac Mini keeps running
untouched as Alessa's instance until Homa Cloud is good enough that she migrates : she is
design partner #0 and the dogfood bar for launch.
