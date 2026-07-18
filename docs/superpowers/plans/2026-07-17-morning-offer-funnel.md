# Morning Offer Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Replace fragmented morning-offer counters with one causal cohort
funnel, improve deterministic reply classification, and measure accepted
offers through completed materials or scheduled tasks.

**Architecture:** Keep reply causality in Conversation Continuity, move phrase
classification into a small versioned pure module, persist fulfillment through
a tenant-scoped server-only table, summarize one sent-delivery cohort in a pure
admin helper, and render one counts-only founder card.

**Tech Stack:** TypeScript, Node test runner, Next.js App Router, Eve tools,
postgres.js, Supabase Postgres, Tailwind utility classes.

## Global Constraints

- `familyId` comes only from authenticated context and every id is re-scoped.
- Product truth is durable in Postgres. Events are best-effort analytics.
- No em dash in code, comments, copy, or documentation.
- Imports stay at module tops.
- Use exhaustive checks for TypeScript unions.
- Write and run a failing test before each behavior change.
- Additive migration leads the deployment because code reads its new table.

---

### Task 1: Versioned reply outcome classifier

**Files:**
- Create: `apps/web/lib/conversation-continuity/reply-outcome.ts`
- Create: `apps/web/lib/conversation-continuity/reply-outcome.test.ts`
- Modify: `apps/web/lib/conversation-continuity/reply-policy.ts`
- Modify: `apps/web/lib/conversation-continuity/reply-policy.test.ts`

**Interfaces:**
- Produces `REPLY_CLASSIFIER_VERSION`
- Produces `classifyReplyOutcome(replyKind, text): ReplyOutcome`
- Keeps ambiguous candidate handling unchanged

- [ ] Add failing fixtures for high-precision natural affirmatives and
  declines, plus questions, mixed polarity, and long prose that must remain
  `answered`.
- [ ] Run the new test file and confirm the intended failures.
- [ ] Implement normalization and bounded phrase classification.
- [ ] Replace the inline yes/no regexes in `reply-policy.ts`.
- [ ] Run the classifier and reply-policy tests.

### Task 2: Persist reply audit metadata and backfill legacy outcomes

**Files:**
- Modify: `apps/web/lib/conversation-continuity/reply-policy.ts`
- Modify: `apps/web/lib/conversation-continuity/continuity-service.ts`
- Modify: `apps/web/lib/conversation-continuity/ledger.ts`
- Modify: `apps/web/lib/conversation-continuity/ledger.test.ts`
- Modify: `packages/core/src/events.ts`
- Modify: `packages/core/src/events.test.ts`
- Create: `supabase/migrations/20260718010000_morning_offer_funnel.sql`

**Interfaces:**
- Adds `ReplyResolutionMethod`
- Adds trusted continuity attributes `resolutionMethod` and
  `replyClassifierVersion`
- Adds nullable loop columns `resolution_method` and `classifier_version`

- [ ] Add failing continuity and event tests for method and version.
- [ ] Run the focused tests and confirm failures.
- [ ] Carry method and version from resolution through the transactional claim
  and event.
- [ ] Add migration checks, server-only grants, and a one-time outcome backfill
  for causally resolved legacy rows.
- [ ] Run continuity and event tests.

### Task 3: Durable accepted-offer fulfillment

**Files:**
- Create: `apps/web/lib/conversation-continuity/offer-fulfillment.ts`
- Create: `apps/web/lib/conversation-continuity/offer-fulfillment.test.ts`
- Modify: `apps/web/agent/tools/create_printable.ts`
- Modify: `apps/web/agent/tools/create_task.ts`
- Modify: `packages/core/src/events.ts`
- Modify: `packages/core/src/events.test.ts`
- Modify: `supabase/migrations/20260718010000_morning_offer_funnel.sql`

**Interfaces:**
- Produces `recordAcceptedOfferFulfillment()`
- Adds server-only `conversation_offer_fulfillments`
- Emits `conversation.offer_fulfilled` without message or child content

- [ ] Add failing tests for no-source no-op, foreign-family rejection,
  accepted-morning eligibility, target re-scoping, and idempotency.
- [ ] Run the focused tests and confirm failures.
- [ ] Implement the scoped insert and best-effort event.
- [ ] Record a reviewed material and a created task from trusted
  `repliedDeliveryId` attributes.
- [ ] Run fulfillment, continuity, event, and Eve build tests.

### Task 4: Cohort funnel summary and query

**Files:**
- Modify: `apps/web/lib/admin/morning-brief-metrics.ts`
- Modify: `apps/web/lib/admin/morning-brief-metrics.test.ts`
- Modify: `apps/web/lib/admin/overview-data.ts`
- Modify: `scripts/admin-console-smoke.mts`

**Interfaces:**
- Produces `MorningOfferFunnelSummary`
- Produces `summarizeMorningOfferFunnel(rows, now)`
- Adds `FleetOverview.morningOfferFunnel`

- [ ] Add failing tests for the 38 sent, 8 resolved, 0 classified case; open
  reply windows; expired no-reply rows; decisions; accepted fulfillment; and
  null outcomes.
- [ ] Run `pnpm check:admin` and confirm the new tests fail.
- [ ] Implement the pure cohort summarizer.
- [ ] Replace split morning sent/resolved SQL with one `sent_at`-anchored,
  sandbox-excluded query joined to fulfillment.
- [ ] Keep journal/custom counters and possible interest separate.
- [ ] Add PII-free smoke output and run `pnpm check:admin`.

### Task 5: Founder funnel card

**Files:**
- Create: `apps/web/app/admin/morning-offer-funnel.tsx`
- Create: `apps/web/app/admin/morning-offer-funnel.test.tsx`
- Modify: `apps/web/app/admin/page.tsx`

**Interfaces:**
- Consumes `MorningOfferFunnelSummary`, range label, and possible-interest count
- Produces a full-width, counts-only accessible card

- [ ] Add failing render tests for no decisions, real acceptance, fulfillment,
  waiting, expired, answered, unclassified, and possible-interest copy.
- [ ] Run the component test and confirm failures.
- [ ] Implement the five-stage card with explicit denominator language.
- [ ] Replace the old morning tiles and preserve unrelated overview tiles.
- [ ] Run component and admin tests.

### Task 6: Repository integration and quality gates

**Files:**
- Modify: `README.md`
- Modify: `package.json` only if a focused test command is needed
- Modify: `scripts/isolation-check.mjs`

**Interfaces:**
- Documents the new module and migration
- Proves server-only table posture and composite tenant identity

- [ ] Extend isolation checks without disturbing existing checks.
- [ ] Update the repository map for new source modules and migration.
- [ ] Run copy reviewer, apply accepted feedback, then run copy editor.
- [ ] Render the real admin surface and run the Homa UX/UI review.
- [ ] Run `pnpm check:isolation`, `pnpm check:admin`,
  `pnpm check:continuity`, `pnpm check:research-brief`,
  `pnpm check:events`, `pnpm typecheck`, `pnpm lint`, `pnpm build`,
  `VERCEL=1 pnpm --filter web exec eve build`, and
  `VERCEL=1 pnpm check:eve-stream-duration`.
- [ ] Review the final diff for secrets, unrelated changes, and migration
  ordering.

### Task 7: Deployment handoff

**Files:**
- No additional source files

- [ ] Apply the additive migration to the intended Supabase project.
- [ ] Run the isolation guard against the migrated target.
- [ ] Push the reviewed branch and wait for Vercel READY.
- [ ] Probe `/admin` and one sandbox acceptance-to-fulfillment journey.
- [ ] Record sanitized deployment evidence before calling production complete.
