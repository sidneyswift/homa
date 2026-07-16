# Reality Checks

Assumptions are not evidence. Before locking a limiting factor, run the checks that can falsify it. Prefer live reality over planning docs.

## Order of trust (high → low)

1. **Live production behavior** you just probed (site, API, authenticated flow)
2. **Production data** (DB queries, analytics, Stripe, logs) with timestamp and scope
3. **Real user artifacts** (support messages, call notes, conversation transcripts the founder is allowed to read, conference feedback with names/dates)
4. **Instrumented product events** (MJ-08 / product event registry) with clear definitions
5. **Recent deploy + reconciliation evidence** in planning docs, only when it cites probes
6. **PRD / journey / plan prose** — context, not proof
7. **Opinions, vibes, "we should," competitor envy** — hypotheses only

## Homa-specific probes (use what applies)

| Question | Where to look |
|---|---|
| Is the live product what we think it is? | Fresh deployment probe; do not infer from repo presence alone (`AGENTS.md`) |
| Are families actually activating? | Onboarding completion, first chat, MAP/report completion, SMS link rates |
| Does the core loop work end to end? | Authenticated Progress, chat, materials, email/SMS delivery with a real or founder test family |
| Are we losing people at a specific step? | Funnel counts with definitions; drop-off with sample size |
| Is retention real? | Return visits, repeat messages, paid conversion/retention in Stripe |
| Did a "fix" land? | Vercel READY + live probe of the user-facing symptom (`prod-bugs-fixed-not-stored`) |
| Are we blocked by policy? | Founder rulings in `docs/homa-planning/journeys/10-reconciliation.md` §5 |

Read `references` in the skill only as method. For product truth, open the real sources and record citations in the log (`source`, `checked_at`, `result`).

## Homa family denominators (required language)

Parent-facing funnel: **landing → signup (Google or email/password) → family setup → kids → report → core loop**.

Never say "real families," "signups," or "started onboarding" for a raw `families` count without naming the filter. Use these labels only:

| Say | Means (SQL / product) | Not |
|---|---|---|
| **Signup-screen abandon** | `status = 'open'`, usually no email/phone/member. Created when landing popup or `/onboarding` opens signup and fires `POST /api/map/start` before submit. Parent never completed Google or email/password. | A lead, a signup, someone who "started the map" as a conscious step |
| **Signed-up family** (or **claimed account**) | `status = 'claimed'` (and usually a `family_members` row + email). Completed ParentStep signup. | Every non-sandbox row |
| **Family setup done** (or **onboarded past setup**) | claimed + `profile_completed_at` set (`map.family_setup`). Finished create-your-family (name, address, phone). | Claimed-but-stuck before setup |
| **Report reached** | claimed family with `map.report_generated` (or a `child_reports` row) | `map.started` alone |
| **Test family** | `sandbox = true` (`+homatest` email or admin flag). Fence out of funnels. | "Not real" as a synonym for open |

Rules:

1. **`sandbox = false` is not "real parents."** It only excludes test families. Most non-sandbox rows can be signup-screen abandons.
2. **`map.started` is not a signup.** It often fires on silent session bootstrap when the signup screen opens. Prefer `map.account_created` / `status = 'claimed'` for "completed signup."
3. When citing daily volume, **split open vs claimed** (e.g. "113 signup-screen abandons, 18 signed-up accounts"), never one blended "signups" number.
4. Phone is collected on **family setup after signup**, not as the web funnel entry. Open rows with null phone are expected for abandons.

## Minimum bar to lock a factor

At least one of:

- A measured break in the value chain (numbers + definition), or
- A reproduced user-facing failure on the live product, or
- Direct user evidence that the missing outcome is why they do not get or keep value

If you only have hypotheses, the limiting factor may be **"we cannot see reality"** (instrumentation, access, or learning loop). That can be a valid factor. Fix visibility before building features on guesses.

## Falsification habit

For every locked factor, write one sentence:

> We would abandon this factor if we saw __________.

If you cannot fill the blank, you do not understand the factor yet.

## Completion evidence

Code merged is not complete. Complete means the success criteria in the log are observed true. Record:

- What you checked
- When
- Result (pass/fail with the actual observation)

## Say-no test

When someone proposes work X, ask:

1. Does X remove the current limiting factor?
2. What evidence says X is on the critical path to PMF this week?

If either answer is weak, say no and log it.
