# BUILD.md — Engineering Agent Start Here

You are building **Homa Cloud**: a multi-tenant AI homeschool assistant for
homeschooling mothers. One Vercel deployment (Next.js + the eve agent framework)
serves all families; Supabase Postgres holds all durable state; Stripe handles money.
The planning phase is complete — your job is execution, not re-planning.

**The contract you build against is `docs/homa-planning/13-mr-prd.md`.** Everything else
below tells you what to read, in what order, and what to build first.

---

## ⏰ THE ONLY REAL DEADLINE

**July 13, 2026 — Alessa demos Homa at a homeschool conference.**
By then, DEPLOYED AND LIVE, no exceptions:

1. **Marketing website** (single landing page is fine)
2. **Waitlist email capture** that reliably stores signups

Everything else is sequenced by dependency, not by calendar. There are no week/day
estimates anywhere in this plan on purpose — agents build at agent speed; order and
gates are what matter.

---

## Deliverable 0 — Conference landing page + waitlist (BUILD THIS FIRST)

| What | Where the spec lives |
|---|---|
| Copy: hero variants (3), CTAs, taglines, pitch | `docs/homa-planning/journeys/07-positioning-messaging.md` §copy kit |
| Positioning rules (category, anchor, never-say list) | same doc §1 and §6 |
| Landing structure + channel-variant bands, waitlist flow | `docs/homa-planning/journeys/02-acquisition-activation.md` §1 + MJ-09 in `docs/homa-planning/journeys/10-reconciliation.md` §2 |
| Visual system: tokens, components, landing UI kit | `docs/homa-design/` — read `docs/homa-design/SKILL.md` first, then `readme.md`; kit at `docs/homa-design/ui_kits/landing/` |
| Waitlist storage | Supabase table `waitlist` (email, source/utm, state, kids' age bands optional, created_at) + confirmation state. RLS on. Double-opt-in email can wait; reliable capture cannot. |
| Conference mode | A QR-friendly URL (e.g. `/conference`) with the conference band variant; capture works flawlessly on a phone on bad convention-center wifi (optimistic UI + retry) |

Hard constraints (violations = do not ship):
- **NO fabricated social proof** (no invented family counts/testimonials — ruling C2).
- **No pricing on the page** — "Founding families" framing + waitlist only (pricing is
  deliberately undecided until real margin data exists — decision T2).
- Brand voice law: sentence case, **no em dashes ever**, reassure-before-inform, HOMA
  in UI surfaces / Homa in prose (D8). Never claim "first/only AI homeschool
  assistant" (ruling C3).
- Copy leads with the efficacy story ("know exactly where your child stands, without
  ever testing them — and watch the numbers move"), anchored per positioning doc.

Definition of done: deployed to production URL, waitlist rows verified in Supabase,
tested from a phone, Alessa can read every word out loud at a booth without wincing.

---

## Reading order (before writing product code beyond Deliverable 0)

1. `docs/homa-planning/13-mr-prd.md` — THE CONTRACT. FR-1…FR-11, non-goals, launch gates.
2. `docs/homa-planning/01-architecture.md` — tenancy model, state model, session rotation,
   verified eve facts. The "laws" in it are binding.
3. `docs/homa-planning/journeys/10-reconciliation.md` §5 — every founder decision
   (D1–D9, T1–T3). Do not relitigate any of these in code.
4. Feature specs as you build each FR:
   - Onboarding/wow/drip → `journeys/02` (copy is binding)
   - Features + Gherkin acceptance criteria → `journeys/04`
   - Weekly loop + example notes (tone is binding) → `journeys/03`
   - Edge behavior catalog (launch-blocking rows = acceptance criteria) → `journeys/05`
   - Event names/properties for EVERYTHING → `journeys/06` (emit via typed registry;
     no feature merges without its events)
5. `docs/homa-design/SKILL.md` → tokens/components for all UI.
   - **Chat UI stack (decided 2026-07-03):** eve `useEveAgent` drives state →
     **shadcn** chat components render (init shadcn in `apps/web` during M1-04; verify
     current component APIs via the shadcn skill) → homa-design tokens re-theme them.
     Never ship the default shadcn look. eve messages are AI-SDK `UIMessage`-shaped, so
     they feed shadcn's AI-SDK primitives directly. Do not use shadcn's own data/chat
     hooks — eve owns session state.
6. Reference when relevant: `docs/homa-planning/05` (platform limits/pricing),
   `docs/homa-planning/07` (eve source-code findings), `docs/homa-planning/11` (Hermes
   implementation patterns for the learning loop/memory/search),
   `docs/homa-planning/10-real-usage-cost-model.md` (real usage numbers).

The `homa-macmini/` and `homa-template/` folders are READ-ONLY reference (the working
single-family system and its templatized domain assets — port from `homa-template/`,
never modify either).

## Build order after Deliverable 0 (dependency-sequenced)

- **Phase A — Engine proof:** M0-01 adversarial prototype (STRICT timebox; GO/NO-GO
  criteria written BEFORE starting; throwaway code), M0-03 worksheet-in-sandbox,
  M0-04 voice-on-real-phones, M0-05 Supabase schema v0 + RLS, M0-09 monorepo
  bootstrap: **pnpm workspaces + Turborepo** — `apps/web` (Next.js, the ONE
  deployable, with the eve agent mounted inside it via `withEve()` at
  `apps/web/agent/`), `packages/core` (domain system ported from the
  template-archive branch), `packages/design` (homa-design tokens/components as a
  workspace package), `supabase/` (migrations at repo root — the Supabase GitHub
  integration watches this; connect the integration right after migration #1
  lands). Enable Vercel remote caching. The existing Supabase project is
  **homa-prod** (org: Homa, East US N. Virginia; auto-RLS on, auto-expose off).
- **Phase B — Walking skeleton, one family end-to-end:** FR-1 (invite+auth),
  FR-2 (3-minute wow), FR-4 (chat+voice), FR-5 (materials + photo consent floor),
  platform laws (M1-07 isolation suite in CI from the FIRST schema migration).
- **Phase C — The living product:** FR-3 (drip), FR-6 (journal+hours), FR-7
  (dashboard), FR-9 (learning loop), FR-10 (trust floor), FR-11 (founder ops).
- **Phase D — Money + gates:** FR-8 concierge tooling, Payment Link trial-with-card,
  the 8 launch gates in PRD §7, then invite #1.
- **Parallel lane (independent agents):** 8–12 benchmarks/questionnaire track (D3,
  behind the rigor bar), SEO state-page content, runbooks-as-built.

## Non-negotiable laws (grep-able summary — full text in PRD/architecture)

1. `familyId` comes from auth context only; every tool re-scopes every model-supplied
   ID; RLS via non-service role + `SET LOCAL`; isolation tests green in CI always.
2. Nothing load-bearing lives in conversation history or sandbox filesystems —
   Postgres is truth, Blob for artifacts, upload before turn end.
3. No feature merges without its events (typed registry) or, if billable, its
   `action_costs` row.
4. Anti-guilt display law: no red, no "behind", growth framing only; max one nudge
   per weekly note; never compare siblings.
5. Child photos: consent screen + TTL + no-training DPAs + zero face recognition (D4).
6. Distress-data firewall; companion-not-therapist (D5).
7. Brand voice: no em dashes, sentence case, reassure-before-inform, offers never
   commands.
8. eve stays behind the harness interface (M1-14) — including the frontend hook.

## When you are unsure

Prefer the PRD over journey docs, journey docs over your judgment, and founder
decisions (journeys/10 §5) over everything. If two documents conflict, check
`journeys/10-reconciliation.md` §1 rulings first; if still unresolved, stop and ask
Sidney rather than inventing policy. Log anything you were forced to decide alone in
`docs/homa-planning/build-log.md` (create it) so decisions stay auditable.
