# Journey Workstream — PM Kickoff (2026-07-02)

> Senior-PM coordination doc. Five specialist workstreams produce the journey library in
> this folder. This doc pins the shared persona cast, the journey template, and the
> quality bar so the documents compose instead of drifting.

## Shared persona cast (use these names/codes everywhere)

Grounded in: the origin user's testimony (00-product-brief §value stack), the design
system's brand foundation ("she's short on bandwidth and reassurance; the fear is
*am I doing enough?*"), council findings (median family = 2–3 kids, 5–12), and market
research (05/07). The personas workstream deepens these; nobody renames them.

| Code | Name | Snapshot |
|---|---|---|
| P1 | **Alessa** (origin archetype) | One preschooler (3), enrichment-driven, wants ahead-of-standards validation, urban, tech-adjacent household, voice-notes-from-pocket habit. Money: comfortable but scrutinizes subscriptions. |
| P2 | **Rachel** (the median) | Three kids (4, 7, 10), suburban/rural, co-op member, single income, price-sensitive, drowning in planning across ages; hours tracking is a legal must. The 10-year-old is OUTSIDE the v1 materials range — her journey must handle that honestly. |
| P3 | **Danielle** (the newcomer) | Pulling her 6-year-old out of public school mid-year. Anxious, guilt-prone, doesn't know her state's law, second-guesses everything. Needs "you're allowed, here's the path" energy. Highest support load, highest word-of-mouth upside. |
| P4 | **Monica** (compliance-heavy state) | NY/PA: IHIPs, quarterly reports, portfolio evaluations. Records ARE the job. Will churn instantly over a wrong legal claim; will evangelize over a generated quarterly report that works. |
| P5 | **Jess** (working homeschooler) | Part-time WFH, schools evenings/weekends, time-starved, voice-first, efficiency over enrichment. Most sensitive to friction; most likely to convert on "it makes the plan so I don't have to." |
| S1–S4 | Secondary cast | **Marcus** (dad, secondary account user), **Grandma Sue** (co-teaching grandparent), **the skeptical co-op friend** (buys nothing, influences everyone), **the child** — NEVER a user (design + legal constraint; the assessment is a test for the mother). |

## The journey template (every journey uses this structure)

1. **Frame**: persona, trigger, job story ("When…, I want…, so I can…"), entry channel.
2. **Stage table**: stage → touchpoints → what she does → what Homa does → time-in-stage
   → emotional state (map to the brand arc *overwhelmed → calm & confident*) → friction
   risks → delight opportunities.
3. **The moment that decides** (aha/abandon): name it explicitly.
4. **Instrumentation**: events to emit per stage (name them like `onboarding.wow_delivered`),
   the one metric that says this journey works, and the counter-metric that says it's lying.
5. **Edge/failure branches**: at least 5 per journey, with expected product behavior.
6. **Ticket mapping**: which backlog items (03-backlog.md) cover it; NEW-TICKET flags for gaps.
7. **Open questions** for the founder, marked ❓.

## Quality bar

- Write for a builder: every stage must be concrete enough to design a screen or a prompt from.
- Voice/emotion constraints are LAW: reassurance-first, no guilt mechanics, metrics lead
  but never "behind" framing (docs/homa-design/readme.md §brand foundation + §content fundamentals).
- Phone-first always. She is standing in a kitchen holding a 4-year-old.
- The child is never the user. Voice/likeness constraint per 09 §open-call-4 (assume
  option (a): parent is the speaker/uploader) unless marked ❓.
- Cite personas by code. Cross-reference other journey docs rather than duplicating.
- Honest about v1 vs post-GA: tag stages [M-R] (revenue-first cohort), [GA], [POST-GA].

## Workstream index

| Doc | Workstream | Primary pm-os methods |
|---|---|---|
| 01-personas-jtbd.md | Personas, empathy maps, JTBD jobs + forces | proto-persona, create-empathy-maps, jtbd-jobs, jtbd-forces |
| 02-acquisition-activation.md | Discover → land → sign up → onboard → wow → week 1 | journey-map, aha-moment, onboarding-redesign, friction-reduce |
| 03-retention-monetization.md | Daily/weekly habit → month curve → trial→paid → renewal → churn/win-back | journey-map, churn-reduction, power-user-shift |
| 04-feature-journeys.md | Worksheets, voice capture, benchmarks/efficacy, hours/compliance, discover/local, curriculum compare, multi-child | use-case-map, gherkin-stories, jtbd-jobs |
| 05-edge-cases-failures.md | Failure/trust journeys + expected-behavior catalog | ux-edge-cases, adversarial-roleplay, edge-case-balance |
| 06-metrics-instrumentation.md | North Star + metric tree, event tracking schema, guardrail metrics | success-metric, tracking-schema, measure, impact-model |
| 07-positioning-messaging.md | Positioning, working-backwards PR/FAQ, objection handling, message house | positioning, press-release, objection-scan, cta-copy, winning-position |
| 08-competitive-moats.md | Competitor teardown, parity-vs-differentiation, moat strategy | netmba-competitor-analysis, parity-vs-differentiation, moats, seven-powers |
| 09-discovery-research-plan.md | Mom-Test conference kit, interview guides, riskiest-assumption tests | mom-test-guide, interview-guide, research-brief, risky-assumptions, experiment-design |

Senior-PM reconciliation pass happens after all workstreams land: consistency, gaps,
ticket deltas rolled into 03-backlog.md, open questions consolidated for Sidney, then
the roadmap synthesis (vision-to-okrs, now-next-later, ost, p0-p1-p2) and the M-R PRD
as the capstone deliverables — those two are the senior PM's own job, not delegated.
