# Extracted framework

This document explains the Product Design Playbook as a system. It is an
analysis of the source archive, not a Homa skill and not a final scoring model.
Every claim below links back to the page-level extraction or grouped source.

## What the playbook is

The playbook has three connected layers:

1. **Product strategies** name a product goal, such as onboarding, retention,
   trust, or monetisation.
2. **Modular plays** describe reusable design interventions, such as Time to
   Value, Fail Safe, or Progressive Disclosure.
3. **Measurement loops** connect each strategy to metrics and diagnostic
   questions, so a team can choose plays in response to observed behavior and
   then check whether the intervention worked.

The source explicitly says to "combine, remix, skip," use what fits, and drop
what does not. It provides four workflows:

- Start from a strategy and gather the plays that support the goal.
- Audit the product with individual plays to find quick wins.
- Follow the "Pair with" links to build a connected product design strategy.
- Start from a metric, investigate the data, choose plays that address the
  drop-off, ship, measure, and repeat.

Source: [How to use the playbook, PDF page 4](source/pages/page-004.md).

## Complete page architecture

- Pages 1-5: cover, contents, introduction, usage instructions, and strategy
  overview.
- Pages 6-41: 12 strategies, each presented as a play stack, a metric set, and
  a "Behind the Data" diagnostic page.
- Pages 42-206: 33 modular plays, each presented as an overview, a "Make it
  Yours" prompt set, and three visual examples.

This structure accounts for all 206 pages:

`5 setup pages + (12 strategies × 3 pages) + (33 plays × 5 pages) = 206 pages`

The complete page-to-file mapping is in
[`source/page-manifest.tsv`](source/page-manifest.tsv).

## The 12 strategy modules

Each strategy below links to its complete three-page extraction.

### 1. Onboarding

Goal: get new users familiar with the product and to first value.

Play stack: Empty States, Setup Defaults, Progressive Disclosure, Time to
Value, Success Moments, JTBD Copywriting, Pattern Alignment, Sandbox
Experience, Personalisation, Momentum Bias, Micro Interactions, Permission
Serve, Loading Feedback, Gamified Progress, and Contact Bridge.

Metrics: Activation Rate, Time to Value, Onboarding Completion Rate,
Step-by-Step Drop-off Rate, and Day 1/7/30 Retention.

Diagnostic lenses: conversion funnel analysis, segmentation analysis, and
behavioral patterns.

Source: [Onboarding, PDF pages 6-8](strategies/01-onboarding.md).

### 2. Monetisation

Goal: convert free users into paying customers.

Play stack: The Paywall, Intentional Friction, Limited Offer, Perceived Effort
Delay, Success Moments, Time to Value, Spark Curiosity, Gamified Progress,
Effort Moat, Investment, Personalisation, and JTBD Copywriting.

Metrics: Free-to-Paid Conversion Rate, Paywall Conversion Rate, Average
Revenue Per User, Customer Lifetime Value, Trial-to-Paid Conversion Rate, and
Churn Rate.

Diagnostic lenses: conversion funnel analysis, pricing and packaging
analysis, and user behavior patterns.

Source: [Monetisation, PDF pages 9-11](strategies/02-monetisation.md).

### 3. Activation

Goal: help users experience core value and become active.

Play stack: Time to Value, Success Moments, Setup Defaults, Empty States,
Discovery, Personalisation, Micro Interactions, Momentum Bias, Progressive
Disclosure, JTBD Copywriting, Loading Feedback, Sandbox Experience, and
Contact Bridge.

Metrics: Activation Rate, Time to Value, and Feature Adoption Rate.

Diagnostic lenses: activation pattern analysis, user journey optimisation,
and value discovery patterns.

Source: [Activation, PDF pages 12-14](strategies/03-activation.md).

### 4. Retention

Goal: keep users engaged and coming back.

Play stack: Gamified Progress, System Widget, Value Replay, Effort Moat,
Personalisation, Variable Reward, Commitment, Success Moments, Micro
Interactions, Intent Mirroring, Pattern Alignment, and Deep-link.

Metrics: Day 1/7/30 Retention Rates, Stickiness Ratio, and Streak Length.

Diagnostic lenses: retention curve analysis, feature usage evolution, and
habit formation patterns.

Source: [Retention, PDF pages 15-17](strategies/04-retention.md).

### 5. Growth & Viral

Goal: turn users into advocates and drivers of organic growth.

Play stack: Referral, Shareability, Contact Bridge, Deep-link, Success
Moments, Gamified Progress, Effort Moat, Variable Reward, System Widget, and
Spark Curiosity.

Metrics: Viral Coefficient, Referral Program ROI, Organic Growth Rate, Network
Density Score, and Viral Cycle Time.

Diagnostic lenses: viral loop optimisation, network effect analysis, and
growth channel performance.

Source: [Growth & Viral, PDF pages 18-20](strategies/05-growth-and-viral.md).

### 6. Engagement

Goal: increase user activity and depth of interaction.

Play stack: Micro Interactions, Gamified Progress, Variable Reward, Discovery,
Personalisation, Intent Mirroring, Success Moments, System Widget, Loading
Feedback, Progressive Disclosure, and Small Quirk.

Metrics: Pages or Screens Per Session, Feature Adoption Rate, Session
Duration, and Stickiness Ratio.

Diagnostic lenses: engagement flow analysis, discovery optimisation, and
interaction design effectiveness.

Source: [Engagement, PDF pages 21-23](strategies/06-engagement.md).

### 7. Trust Building

Goal: establish credibility and user confidence.

Play stack: Fail Safe, Pattern Alignment, JTBD Copywriting, Loading Feedback,
Perceived Effort Delay, Micro Interactions, Success Moments, Permission Serve,
Progressive Disclosure, and Intentional Friction.

Metrics: Permission Grant Rate, Task Completion Rate for complex flows, and
Trust-Related Support Ticket Volume.

Diagnostic lenses: permission optimisation, flow confidence, and trust
issues.

Source: [Trust Building, PDF pages 24-26](strategies/07-trust-building.md).

### 8. Conversion Optimisation

Goal: improve key conversion points throughout the funnel.

Play stack: The Paywall, Limited Offer, Intentional Friction, Success Moments,
Spark Curiosity, Momentum Bias, Time to Value, JTBD Copywriting, Perceived
Effort Delay, and Personalisation.

Metrics: Conversion Rate, Funnel Drop-off Rate, Average Time to Convert, and
Conversion Rate by Traffic Source.

Diagnostic lenses: funnel optimisation, traffic quality, and timing and
urgency.

Source:
[Conversion Optimisation, PDF pages 27-29](strategies/08-conversion-optimisation.md).

### 9. Experience Refinement

Goal: add delight and a premium feel to interactions.

Play stack: Micro Interactions, Small Quirk, Loading Feedback, Success Moments,
Perceived Effort Delay, Pattern Alignment, JTBD Copywriting, Variable Reward,
and Progressive Disclosure.

Metrics: Task Success Rate, Average Session Duration, User Satisfaction Score,
and Error Rate.

Diagnostic lenses: usability optimisation, experience quality, and design
effectiveness.

Source:
[Experience Refinement, PDF pages 30-32](strategies/09-experience-refinement.md).

### 10. Intent Shaping

Goal: guide user actions to increase commitment and product fit.

Play stack: Investment, Personalisation, Setup Defaults, Progressive
Disclosure, Commitment, Effort Moat, Intent Mirroring, Success Moments, and
Sandbox Experience.

Metrics: Profile Completion Rate, Abandonment Rate, and Task Success Rate.

Diagnostic lenses: collection optimisation, data value, and user behavior.

Source: [Intent Shaping, PDF pages 33-35](strategies/10-intent-shaping.md).

### 11. Habit Formation

Goal: create sticky, repeated usage patterns.

Play stack: Commitment, Gamified Progress, System Widget, Variable Reward,
Value Replay, Investment, Personalisation, Success Moments, Micro
Interactions, Effort Moat, and Deep-link.

Metrics: Weekly Active Users, Session Frequency, Streak Completion Rate, and
Return Rate After 30 or More Days.

The source's diagnostic page is mislabeled or misplaced. PDF page 38 carries
the Habit Formation heading but contains Premium Positioning questions. PDF
page 41 contains the Habit Formation questions.

Sources: [Habit Formation, PDF pages 36-38](strategies/11-habit-formation.md)
and [PDF page 41](source/pages/page-041.md).

### 12. Premium Positioning

Goal: make the product feel high-value and sophisticated.

Play stack: Perceived Effort Delay, Small Quirk, Micro Interactions,
Intentional Friction, Loading Feedback, Success Moments, JTBD Copywriting,
Pattern Alignment, and Progressive Disclosure.

Metrics: Average Revenue Per User, Price Sensitivity by Price Tier, and
Customer Satisfaction for Premium Features.

The source's diagnostic page is also misplaced. PDF page 38 contains the
Premium Positioning questions, while PDF page 41 sits in the Premium
Positioning module but contains Habit Formation questions.

Sources:
[Premium Positioning, PDF pages 39-41](strategies/12-premium-positioning.md)
and [PDF page 38](source/pages/page-038.md).

## The anatomy of every modular play

Each play follows the same decision structure:

1. A one-line statement of the intervention.
2. What it is.
3. Why it works.
4. When to use it.
5. Actions to take.
6. Misuses to avoid.
7. A founder tip.
8. Other plays to pair with.
9. Five sets of adaptation and review prompts.
10. Three visual examples from real products.

That repeated shape is important. A future skill should not reduce a play to
its name or one-line definition. The useful judgment lives in applicability,
correct execution, contraindications, companion plays, and evidence.

The complete 33-play catalog is in [CATALOG.md](CATALOG.md), with each entry
linked to its five source pages.

## The relationship model

The playbook forms two overlapping graphs:

- A **strategy-to-play graph** says which interventions may support a product
  goal.
- A **play-to-play graph** uses "Pair with" links to show combinations.

Several plays are high-connectivity foundations. Time to Value, Success
Moments, Progressive Disclosure, Personalisation, Gamified Progress, and
Intentional Friction appear across many strategies and companion lists.
Others are specialized, such as Contact Bridge, System Widget, Limited Offer,
and The Paywall.

This means a flat checklist would lose source meaning. The unit of design is
usually a coherent route through the graph, not the largest possible number
of plays.

## The measurement model

The playbook does not provide one global product score. It provides a closed
learning loop:

`goal → metric → diagnosis → relevant plays → implementation → measurement`

Its metrics fall into five broad families:

- **Value arrival:** activation, time to value, completion, adoption.
- **Return behavior:** retention, stickiness, frequency, streaks, reactivation.
- **Commercial behavior:** free-to-paid, paywall conversion, revenue, lifetime
  value, churn, price sensitivity.
- **Flow quality:** task success, drop-off, time to convert, errors,
  satisfaction.
- **Trust and growth:** permission grants, trust-related support, referrals,
  organic growth, and network density.

The "Behind the Data" pages prevent metrics from being treated as diagnoses.
For example, a low completion rate may come from flow length, audience
segment, device, timing, copy, missing context, or weak value. The metric
identifies where to investigate. It does not choose the play by itself.

## Implications for a future Homa score

The source does not support a score that rewards using every play. It says to
skip what does not fit. A coverage-only score would encourage design bloat and
could reward harmful behavior.

A sound score will likely need separate dimensions:

- **Applicability:** Is this play relevant, irrelevant, or prohibited for this
  surface and user moment?
- **Execution quality:** If relevant, how well does the implementation follow
  the play's positive guidance and avoid its failure modes?
- **Coherence:** Do the selected plays reinforce one another without creating
  conflicting behavior?
- **Evidence:** Is the judgment based on code alone, a rendered state, a real
  flow, user evidence, or measured outcomes?
- **Outcome alignment:** Is the target strategy's metric healthy or improving?
- **Homa constraints:** Does the implementation remain truthful, calm,
  accessible, privacy-safe, parent-controlled, and compliant with Homa's
  existing design authority?

These dimensions should remain separate until we decide what decisions the
score must support. Combining them too early would create a precise-looking
number with ambiguous meaning.

## Relationship to Homa's current design system

Homa already has three distinct design authorities:

- `homa-design` owns exact visual rules, channel profiles, states,
  accessibility, motion truth, and rendered evidence.
- `homa-uxui-reviewer` owns a fresh user's one-pass reaction to real screens
  and flows.
- `homa-copy-writer` and its review gates own the actual words and their
  production layer.

A future playbook skill should complement those authorities. Its clearest
unowned role is product-design strategy:

- Diagnose a product goal or weak metric.
- Select applicable play combinations.
- Review a section, page, flow, or full product through those plays.
- Explain gaps and trade-offs.
- Produce a prioritized improvement path.
- Re-score after implementation with stronger evidence.

It should route exact brand, accessibility, copy, and user-reader checks to the
existing owners instead of copying or replacing their rules.

## Source cautions discovered during extraction

- The Habit Formation and Premium Positioning diagnostic pages appear swapped
  in the source, as described above.
- The System Widget companion list repeats Gamified Progress.
- The Variable Reward companion list repeats Intentional Friction and uses
  "Curiosity" where the play catalog calls the play Spark Curiosity.
- The Monetisation and Premium Positioning sections use different ARPU
  denominators. Any implementation must choose a project-owned definition.
- Some visual headings and words inside example screenshots are missing or
  distorted in the PDF text layer. The full-page screenshots are the source
  of truth for those pages.
- Behavioral claims are presented without citations. Treat them as design
  heuristics to test, not universal laws.
- Some tactics can conflict with Homa's product laws. Fake processing delay,
  manipulative scarcity, addictive reward loops, premature contact access, or
  curiosity without a truthful payoff should not receive positive credit.

