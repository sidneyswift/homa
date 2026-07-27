# Onboarding: decisions parked until the flow is finished

Date: 2026-07-21 · Branch: `claude/chat-first-onboarding-65b569`
Status: OPEN. Nothing here is built, and nothing here is blocking.

The chat-first onboarding spec
(`2026-07-21-chat-first-onboarding.md`) specifies a credit economy in
detail: an allowance, a weekly taper, a refill, a lockout. Building any
of that now means inventing numbers before the flow they are supposed to
govern exists, and an invented number that ships becomes the default by
accident.

So this file holds them. Each one has what would have to be true to
decide it, and where the evidence would come from. Revisit when the
onboarding flow is finished and real families have walked it.

---

## 1. Should there be a limit at all?

The spec assumes yes and moves straight to sizing it. That assumption is
worth testing first, because a limit costs something real: it suppresses
exactly the abundance the free period needs, and every parent who
rations is a parent not forming a habit.

**What would decide it:** the shape of `/admin/makings`. If almost every
family makes a handful of things a week and a small tail makes many,
then a limit only ever touches the families most engaged with the
product, which is the wrong end to squeeze. If cost per family is
genuinely uncomfortable at the tail, that is a different answer.

**What exists now:** counting only, at `/admin/makings`, enforced
nowhere. `lib/onboarding/makings.ts` has no allowance in it.

---

## 2. If yes, what unit, and how many?

The spec proposes "makings", 10 in week one, 10 in week two, 3 after,
refilling Monday.

Two separate questions hide in that. The **noun** was rejected by the
copy editor gate on 2026-07-21: "makings" is an invented word doing
load-bearing work three different ways on the single screen where a
parent is being asked for money, and it has to be decoded exactly there.
Section 7.1 of the spec says the noun goes through the gates once and is
then the only name used anywhere; the gate has run, so the noun is still
open. The dark lockout card currently says what it means instead
("everything I can make for you this week").

The **number** has no evidence behind it yet. First read, 2026-07-21: of
four families who made anything that week, the busiest made 38.

---

## 3. What the lockout supersedes

Turning a meter on overrides four recorded decisions, which is why it is
a founder ruling rather than an implementation detail:

- `paywall-door-placement` (doors become the lockout for chat families)
- `report-lock-four-open` (the report's status in this flow)
- **D2** (the meter is internal-only, never parent-visible)
- **T1** (what the free period actually is)

**What exists now:** `components/billing/lockout-card.tsx`, built dark
and constructed by nothing in a live path. It is previewed on
`/admin/makings` so the conversion moment can be looked at while the
beats leading to it are still being tuned. Its copy has been through the
editor gate; it would need another pass before it is ever shown.

---

## 4. The interim rule, and its hole

Right now, families in chat onboarding never see the $19 door wall
(`wallExemption` in `lib/billing/wall.ts`, gated on
`HOMA_CHAT_ONBOARDING`). That was non-negotiable: the wall is live in
prod and fires on the first chat send, so without the bypass a new family
would meet a paywall before meeting Homa.

The hole: onboarding ends when `families.context.onboarding.state`
becomes `done`, and nothing forces that to happen. A family that never
finishes is un-walled indefinitely. Acceptable while the flow is being
built and every family in it is a test family. Not acceptable once real
families are in it, so this needs either a real end condition or the
decision in 1 to 3.

---

## 5. Smaller ones, same rule

- **Card kinds.** Two of the spec's seven are built (`onboarding_checklist`,
  the report reveal). `kid_setup`, `family_setup`, `tag_pick`,
  `panel_door` and `promise` are not, so Homa asks for the basics in
  prose, which is the form-like feel the rebuild exists to remove. This
  is a build gap rather than a decision, and it is the next chunk.
- **The panel chassis.** The report opens as its own page. Whether the
  planner, binder and progress should be panels inside the chat, or
  pages, is worth deciding after watching someone use it.
- **Which aha beats.** The spec catalogs about forty. Picking them from a
  list before the spine has been felt is guessing; picking them after
  watching a real sitting is not.
- **Lesson listen's progress claim.** Embargoed until the clause-gate
  defect in spec §14 is fixed. Homa may promise the review, never that
  recording moves a child's progress. Already enforced in the skill.
