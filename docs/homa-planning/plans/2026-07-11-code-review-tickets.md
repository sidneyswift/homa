# Full-repo code review tickets · 2026-07-11

> **STATUS: IN PROGRESS.** CR-01 through CR-50, CR-52 through CR-55, CR-58 through CR-68, and CR-72 are fixed in
> the worktree. CR-51 is partially cleaned. Remaining tickets are still open unless separately noted. A deep review of the whole tree (apps/web,
> apps/mobile, packages, scripts, supabase) run the night of 2026-07-11. Ten
> parallel review agents covered every area file by file; every load-bearing
> finding below was then hand-verified against source before it was written
> down. Claims that did not survive that check are listed at the very bottom so
> nobody re-flags them.

Baseline health at review time, all green: `pnpm typecheck`, `pnpm lint`,
`pnpm build` (FULL TURBO cache hit), and all five guards, `pnpm check:isolation`
(66 checks), `pnpm check:map` (31 checks), `pnpm check:events` (registry
parity both directions), `pnpm check:skills-targeting`, `pnpm check:taxonomy`
(1590 topics, DAG intact). CI (`.github/workflows/ci.yml`) runs typecheck +
lint + all five guards + `pnpm build` + `eve build` on every push/PR, matching
what AGENTS.md claims. No tracked secrets, no `.env` files tracked,
`apps/web/.output/` is correctly gitignored (the conversation-start `git status`
snapshot was stale).

How to read severity:

- **P0**: a bug or security issue affecting behavior right now, or a guard that
  can hide one. Fix first.
- **P1**: real debt that will bite soon (a latent bug on an untriggered path, a
  law violation, a DRY/SRP fault that is actively causing drift).
- **P2**: polish, cosmetics, dead surface.
- **Tracked**: already known-deliberate (re-confirmed against the 2026-07-06
  audit's Tracked list). Do not "fix" out of band.

Because there is no unit-test suite, none of these were caught by machine; the
guards structurally cannot see any of them. That is the theme: the green checks
are real but narrow.

---

## P0 · Active bugs and security

### CR-01 · Checklist "undo last answer" never clears the server save

- **Status 2026-07-11 late night:** Fixed in the worktree. Undo now calls
  `DELETE /api/map/answer`, waits for in-flight saves, and completion only
  continues after pending saves clear.
- **Where:** `apps/web/app/onboarding/checklist-step.tsx:170-181` (`goBack`) + `apps/web/lib/map/store.ts:353-372` (`saveAnswer` is upsert-only, no delete).
- **What:** Every chip tap calls `postAnswer()`, which upserts into `child_answers` immediately. `goBack()` only deletes the answer from local React state. Scoring (`/api/map/score` → `createReport`) reads all rows from the DB, not the client. Undo a mis-tap, finish, and the mis-tapped answer is still scored. The report is the lead magnet's entire artifact, so a wrong number here is a wrong first impression. Deep-dive undo has the identical shape (`deep-dive-step.tsx` per the onboarding review).
- **Fix:** On undo, POST a delete/clear for that `itemId` (needs a new server route + a `deleteAnswer` in `store.ts`), and block `onComplete` until the server matches local state. Verified: high.

### CR-02 · Phone claim can orphan a number on partial failure

- **Where:** `apps/web/lib/phone-claim.ts:110-129` (`confirmPhoneClaim`).
- **What:** When a real family holds the number, the code calls `removeFamilyPhone(holderId, phoneE164)` and then `addFamilyPhone(...)`. If the add fails (race, constraint), the function returns `{ ok: false, reason: "no-code" }` with the number already unlinked from the old family and never linked to the new one, so it belongs to nobody. Not transactional. The misleading `"no-code"` reason (it was a link failure, not a missing code) sends the caller down the wrong recovery path.
- **Fix:** Wrap remove + add + code-consume in one `sql.begin()` transaction, and return a distinct `"link-failed"` reason. Verified: high.

### CR-03 · `/api/link-phone` consumes a single-use token on an unauthenticated GET

- **Where:** `apps/web/app/api/link-phone/route.ts:25-33` → `apps/web/lib/phone-link.ts:57-98` (`consumePhoneLinkRequest`).
- **What:** The GET handler immediately folds the phone stub and links the number. Email security scanners and mail-client prefetchers routinely fire GETs on links before the human clicks, which burns the token and links the number without intent.
- **Fix:** Split preview (GET, no side effects, renders a confirm button) from consume (POST). Verified: high (behavior), medium (real-world prefetch likelihood).

### CR-04 · `isolation-check` passes on any HTTP error (vacuous green)

- **Where:** `scripts/isolation-check.mjs:47-52` (`expectEmptyRead`).
- **What:** `const ok = !response.ok || (empty array)`. Any non-2xx (a 404 from a renamed table, a 500 from misconfigured RLS, an auth outage) counts as PASS. This is the seed of the M1-07 adversarial suite and law #1's CI enforcement; a broken or missing table silently greens the single most safety-critical guard in the repo.
- **Fix:** Require `response.ok` AND an empty JSON array for reads; treat unexpected status codes as failures and print the status. Verified: high.

---

## P1 · Debt that will bite soon

### Bugs (real, on paths that are live or one caller away)

| # | Where | What | Verified |
| --- | --- | --- | --- |
| CR-05 | `apps/web/lib/map/store.ts:1250-1265` (`childrenNowInBand`) | Fixed in the worktree. The scored-range predicate now runs in SQL before `LIMIT 200`, and the capped set is ordered by creation time and id. | high |
| CR-06 | `apps/web/app/onboarding/hub-step.tsx:48-60` (`emailMeThisLink`) | Fixed in the worktree. The hub now reports success only when `/api/map/resume` returns an HTTP OK, and failed sends keep a retry state. | high |
| CR-07 | `apps/web/agent/tools/update_task.ts:35-52` | Fixed in the worktree. The tool now strips undefined optional fields and returns `{ updated: false }` when no real change is supplied. | high |
| CR-08 | `apps/web/agent/tools/record_observation.ts:88` vs `apps/web/app/api/map/score/route.ts:81` | Fixed in the worktree. Observation rescoring now gates `runReportNarrative` behind `narrativeEnabled()`, matching the other rescore paths. | high |
| CR-09 | `apps/web/app/onboarding/checklist-step.tsx:131-154` | Fixed in the worktree. Checklist completion now waits for all in-flight saves and retried pending saves, and shows a retry state if any write still fails. | high |
| CR-10 | `apps/web/app/onboarding/checklist-step.tsx:160-167` | Fixed in the worktree. The delayed answer timer is stored in a ref and cleared on exit and unmount. | high |
| CR-11 | `apps/web/lib/agent-pinned.ts:179` (`recordHoursPinned`) + `apps/web/agent/tools/log_hours.ts:83` (caller path) | Fixed in the worktree. Default `happenedOn` now uses `zonedDateString(new Date(), effectiveTimeZone(family.time_zone))` in both pinned and signed-in paths. | high |
| CR-12 | `apps/web/lib/agent-pinned.ts:232-239` (`dayLabel`) + `apps/web/agent/tools/recall.ts:45-52` (`dayOf`) | Fixed in the worktree. Pinned and signed-in recall now format hit dates in the family's configured time zone, with the standard fallback. | high |
| CR-13 | `apps/web/lib/map/store.ts:104-111,152-155` (`foldFamilyInto`) | Fixed in the worktree. Signup and phone-stub folds now merge source `families.context` into the surviving family before deleting the source row. | high |
| CR-14 | `apps/web/lib/map/curriculum-store.ts:74-78` → `apps/web/lib/map/narrative-facts.ts:200-205` | Fixed in the worktree. Curriculum report facts now select the stored plan and compute activity totals from `plan.weeks`, matching the main narrative path. | high |
| CR-15 | `apps/web/lib/tasks/store.ts:55-125` (`seedKind`) | Fixed in the worktree. Built-in task hygiene now disables rows that no longer have kids or, for morning briefs, no longer have a scored report, and only re-enables rows that meet the same predicates. | medium |

### Timezone/date correctness (shared root cause: UTC `new Date()` on `YYYY-MM` strings)

CR-11/CR-12 above plus:

| # | Where | What | Verified |
| --- | --- | --- | --- |
| CR-16 | `apps/web/lib/child-age.ts:7-13` vs `packages/core/src/map/bands.ts:61-66` | Fixed in the worktree by the full-birthday pass. `lib/child-age.ts` now delegates to `@homa/core` age math while keeping `formatChildAge` local. | high |
| CR-17 | `apps/web/agent/tools/get_children.ts:42-47` | Fixed in the worktree by the full-birthday pass. `get_children` now uses shared day-precise `ageInMonths` instead of `new Date(child.birth_month)`. | medium |
| CR-18 | `apps/web/app/app/chat-storage.ts:118-129` (`shouldStartFreshSession`) | Fixed in the worktree. Chat rotation now receives `family.time_zone` and compares family-local chat-day keys around the 4am boundary instead of using browser-local Date setters. | medium |

### Security (defense-in-depth and public-surface gaps)

| # | Where | What | Verified |
| --- | --- | --- | --- |
| CR-19 | `apps/web/app/api/waitlist/route.ts:28-98` | Fixed in the worktree. The public waitlist POST now applies the shared IP rate limiter and returns 429 before any Supabase write when the window is exceeded. | high |
| CR-20 | `apps/web/app/api/voice/curriculum/start/route.ts:29-183` | Fixed in the worktree. The signed-in "Call me" handler now applies a per-family daily cap before phone linking or Telnyx work. | high |
| CR-21 | `apps/web/app/api/chat/dictation/route.ts:28-56` | Fixed in the worktree. Dictation now applies a per-user hourly cap before multipart parsing or STT work. | high |
| CR-22 | `apps/web/lib/family-invites.ts:136-213` (`consumeFamilyInvite`) | Fixed in the worktree. Invite consumption now requires the authenticated user's email to match the invited email before token consumption or membership insert. | high |
| CR-23 | six Telnyx webhook/tool routes (`voice/context`, `voice/tools/*`, `voice/curriculum/insights`) | Fixed in the worktree. Voice webhook/tool routes now accept `Authorization: Bearer <TELNYX_WEBHOOK_SECRET>` through a shared helper, with the existing URL key kept as a compatibility fallback. | medium |
| CR-24 | `apps/web/lib/phone-claim.ts:52-62` (`startPhoneClaim`) | Fixed in the worktree. Phone claim codes are inserted before SMS send, and a failed send deletes the pending code so the parent never receives an unredeemable code. | high |
| CR-25 | `apps/web/lib/email-inbound.ts:9-15` + `apps/web/agent/channels/email.ts:70-74` | Fixed in the worktree. Inbound email now verifies the raw Resend/Svix webhook signature with `RESEND_WEBHOOK_SECRET` before parsing or trusting sender fields. | medium |
| CR-26 | `apps/web/app/auth/callback/route.ts:17-18` | Fixed in the worktree. Auth callback and proxy now share `safeSameOriginPath`, which rejects `/signin` destinations as well as external-looking paths. | medium |
| CR-27 | narrative + curriculum stores by `childId` only: `apps/web/lib/map/narrative-store.ts:39-67,151-169`, `apps/web/lib/map/curriculum-store.ts:19-40`, plus write-by-`child_id`-alone in `store.ts` (`markReportEmailed`, `markBandReady`, `saveChildContext`, etc.) | Fixed in the worktree. Narrative, curriculum, report-email, and band-ready helpers now require or derive a family id and include matching family predicates before reads or writes. | medium |

### Guards and CI (the test suite's own blind spots)

| # | Where | What | Verified |
| --- | --- | --- | --- |
| CR-28 | `scripts/isolation-check.mjs` (whole file) | Fixed in the worktree. The guard now creates two temporary authenticated families, proves own reads, blocks cross-family reads and writes for `children`, `family_memories`, and `materials`, and cleans up fixtures through the DB connection. CI now supplies `SUPABASE_DB_PASSWORD` to this step. | high |
| CR-29 | `scripts/isolation-check.mjs:65-137` | Fixed in the worktree. The named tables are covered, and the guard now parses migrations and fails if any current `public` table is missing from the isolation assertions. | high |
| CR-30 | `scripts/map-norms-report.mts:77-91` | Fixed in the worktree. The norms report now joins `public.children` on `child_id` and `pnpm report:norms` runs successfully against the configured database. | high |
| CR-31 | `scripts/materials-calibration.mts:236-282` | Fixed in the worktree. The script still writes its report, then exits 1 when any outcome failed and exits 0 only when all outcomes succeeded. | high |
| CR-32 | deny-all tables missing explicit `revoke`: `phone_leads`, `phone_link_requests`, `phone_claim_codes`, `model_usage`, `knowledge_bank` (contrast `family_invites`/`family_phones` which have both) | Fixed in the worktree. Added migration `20260711190000_revoke_deny_all_tables.sql` with explicit `revoke all` statements for the five deny-all server tables. | medium |

### Correctness in the domain core (guarded content, but type/consistency faults)

| # | Where | What | Verified |
| --- | --- | --- | --- |
| CR-33 | `packages/core/src/map/bank.ts:21-33` (`MapItem`) vs `content.ts:27-48` (`MapItemContent`) | Fixed in the worktree. `MapItem` now includes optional `standards`, and the evidence page reads `item.standards` without a cast. | high |
| CR-34 | `packages/core/src/map/schemas.ts:47-48` (cap 8) vs `:91-92` (cap 12) | Fixed in the worktree. Child creation, extras, onboarding UI, agent profile updates, and pinned updates now share `MAP_INTERESTS_CAP`, and server profile writes slice to that cap. | high |
| CR-35 | `packages/core/src/map/scoring.ts:58-59` vs `:164` | Fixed in the worktree. The `highConfidence` comment now matches the existing rule, at least two real observations in the subject, with no scoring behavior change. | high |

---

## P2 · Polish, stale, and dead surface

### Stale copy and comments

| # | Where | What |
| --- | --- | --- |
| CR-36 | `apps/web/app/app/settings/time-zone-card.tsx:33-35` | Fixed in the worktree. Reworded the settings copy to "Sets the clock for your greeting..." and removed the banned word. |
| CR-37 | `apps/web/components/marketing/faq-items.ts:13`, `apps/web/app/terms/page.tsx:42-43` | Fixed in the worktree. Removed stale invite-only wording from the FAQ, terms, and synced public `llms` summaries. |
| CR-38 | `apps/web/components/marketing/Features.tsx:18`, `Stories.tsx:47`, `thread/HowThread.tsx:63` | Fixed in the worktree. Replaced the visible marketing "stuck" framing with "ready for more practice" across the feature grid, story section, and how-it-works thread. |
| CR-39 | `apps/web/app/onboarding/r/[token]/plan/[subjectId]/page.tsx:278-285` | Fixed in the worktree. The plan footer now points families to `/app`, and the remaining pending-age hub copy no longer uses invite-list framing. |
| CR-40 | `apps/web/app/onboarding/page.tsx:6-11`, `extras-step.tsx:15-17` | Fixed in the worktree. Updated the onboarding page and extras-step comments to match the current account-first flow and dedicated HomeschoolStep. |
| CR-41 | `apps/web/next.config.ts:7-9` | Fixed in the worktree. Updated the renderer comment to `lib/materials/render-page.ts`. |
| CR-42 | `packages/core/src/map/content.ts:2` (`v2026.07.3`) vs `bank.ts:16` (`MAP_BANK_VERSION="2026.07.5"`) | Fixed in the worktree. Updated the content bank header to v2026.07.5 to match `MAP_BANK_VERSION`. |
| CR-43 | supabase migration header comments | Fixed in the worktree. Renumbered migration header comments in filename order so no `Migration #` value is duplicated. Comments only. |

### Dead exports / dead code (verified zero external importers)

| # | Where | What |
| --- | --- | --- |
| CR-44 | `apps/web/lib/waitlist-client.ts:112` (`flushWaitlistQueue`) | Fixed in the worktree. Added a root `WaitlistQueueFlusher` client component that flushes queued waitlist submissions on mount and on the browser `online` event. |
| CR-45 | `apps/web/lib/family-phone.ts:150-176` (`copyLeadPhoneToFamily`) | Fixed in the worktree. Removed the dead helper from `family-phone.ts`; the active phone-link bridge path still uses `addFamilyPhone`. |
| CR-46 | `apps/web/lib/email-inbound.ts:83-86` (`findFamilyIdByEmail`), `hours-model.ts:28-34` (`formatMinutes`), `dashboard.ts:71-73` (`planStartMs`), `family-fold.ts:17-26` (`isTrueStub`), `agent-pinned.ts:368` (re-export `scanMemoryContent`) | Fixed in the worktree. Removed unused wrappers/functions, made `planStartMs` private, and removed the `scanMemoryContent` re-export. |
| CR-47 | `packages/core/src/index.ts` (`ladderRungs`, `domainForBankItem`, `CAPTURE_MAX_MONTHS`, `AHEAD_THRESHOLD_MONTHS`); `bands.ts` (`CAPTURE_MIN_MONTHS` defined, never referenced) | Fixed in the worktree. Trimmed the dead root barrel exports and removed unused `CAPTURE_MIN_MONTHS`; internal module exports used within core remain. |
| CR-48 | most of `packages/taxonomy/src/index.ts:28-62` (`readyTopics`, `bottleneck`, `hubTopics`, `clusterSummary`, `standardsForTopic`, …) | Fixed in the worktree. Documented the broad root export as a staged server-side graph API and kept the narrow `@homa/taxonomy/domains` runtime import path for product code. |
| CR-49 | `apps/web/lib/harness/resume-session.ts` (whole file) | Fixed in the worktree. Kept the harness as the staged M1-14 HTTP resume guard, clarified in code and BUILD.md that current hook-driven chat uses `turn-recovery.ts`, and tightened stream confirmation to accept a new turn that reaches `turn.completed`, `session.waiting`, or `session.completed`. |

### Convention/law violations (mechanical)

| # | Where | What |
| --- | --- | --- |
| CR-50 | `apps/web/lib/harness/resume-session.ts` lines 2,9,14,58,92,103,166 | Fixed in the worktree. Replaced the no-em-dash violations in comments and error text. |
| CR-51 | tracked docs (70+ files: `build-log.md`, `journeys/*`, several `.agents/skills/*`) | Partially cleaned. `apps/` and `packages/` are now free of literal em dashes outside vendored taxonomy data, with CR-52 sanitizing vendored display paths. Historical docs and local skill reference files still need a deliberate batch cleanup and lint rule. |
| CR-52 | `data/state-requirements/**` and `packages/taxonomy/data/topics.json` | Fixed in the worktree. Added read-boundary sanitization for state requirement card text and assembled taxonomy names, descriptions, evidence, prompts, edge reasons, and cluster summaries, leaving vendored snapshots unchanged. |
| CR-53 | `packages/core/src/map/sentences.ts:72-120` (`switch(score.position)`), `apps/web/app/onboarding/r/[token]/report-view.tsx:387-394` (ternary), `growth-story.tsx:17-22` (`Record<string, number>` + `?? 0`) | Fixed in the worktree. Added `never` exhaustiveness checks for report sentence and badge position handling, and keyed the growth movement rank map to `SubjectScore["position"]` so future union changes fail typecheck. |
| CR-54 | `apps/web/app/app/chat-client.tsx` (4 sites), `dictation.tsx`, three mobile `chat-session.tsx` sites | Fixed in the worktree. Removed the listed hook suppressions by using explicit Eve method dependencies, stable completion callbacks, and state/ref-driven recorder recovery. Also removed the remaining app/package React hook suppressions in onboarding and mobile family loading. |

### Config / dependency hygiene

| # | Where | What |
| --- | --- | --- |
| CR-55 | root `package.json` `pnpm.patchedDependencies` | Fixed in the worktree. Moved `patchedDependencies` to `pnpm-workspace.yaml`, where pnpm 10 workspace settings are read, and removed the ignored `package.json.pnpm` block. `pnpm-lock.yaml` stayed unchanged after `pnpm install --lockfile-only --ignore-scripts`, preserving the eve patch hash. |
| CR-56 | `apps/web/package.json:38` (`stripe`) | Declared, zero imports (Phase D billing). Known-deliberate (Tracked below) but re-flagged: remove until first import, or move to a billing package. |
| CR-57 | version skew: `react` web `19.2.4` vs mobile `19.2.3`; `typescript` web `^5` vs mobile `~6.0.3`; `@types/node` web `^20` vs taxonomy `^22` | Same monorepo, different compiler/runtime pins (mobile on TS 6, web on TS 5). Align in one bump. |
| CR-58 | 7 ops scripts (`telnyx-call-transcripts`, `telnyx-calls-today`, `tasks-e2e`, `knowledge-seed`, `knowledge-revert`, `map-narrative-fixtures`, `telnyx-assistant-info`) | Fixed in the worktree. Added root aliases for all seven scripts; prod-mutating aliases still require callers to pass `-- --confirm-prod`. |
| CR-59 | prod-mutating scripts (`knowledge-revert`, `knowledge-seed`, `state-requirements-seed`, `telnyx-transcripts-sync`) | Fixed in the worktree. Added a shared hosted-Supabase write guard and wired all four scripts to require `--confirm-prod` before DB writes or transcript sync. Local Supabase URLs remain unblocked. |

### Smaller smells

| # | Where | What |
| --- | --- | --- |
| CR-60 | `apps/web/lib/map/ratelimit.ts:17-18` | Fixed in the worktree. Replaced `windows.clear()` with bounded insertion-order LRU eviction and refreshes active keys on each hit, so high-cardinality abuse no longer wipes unrelated counters. |
| CR-61 | `apps/web/lib/materials/review-artifact.ts:101-107`, `generate-image.ts:119-124`, `voice/caption-image.ts:86-92` | Fixed in the worktree. Replaced `Promise.race` timeout wrappers with `AbortController` signals passed into `generateObject`, `generateImage`, and `generateText`, so timed-out calls are cancelled and never record late usage. |
| CR-62 | `apps/web/lib/materials/library.ts:169-171`, `apps/web/lib/memories.ts:20-23` | Fixed in the worktree. Material caller reads now log raw PostgREST errors and throw a generic tool failure; memories reads return an explicit load-error state so settings can show a quiet error instead of hiding the card as empty. |
| CR-63 | `apps/web/app/api/link-phone/route.ts:11-22` (`page()`) | Already fixed in the current worktree. `page()` escapes title, body, and hidden token values before HTML interpolation. |
| CR-64 | `apps/web/app/api/map/claim/route.ts:68-74`, `signin/actions.ts:39-40`, `settings/actions.ts:214-216` | Fixed in the worktree. These paths now return stable parent-facing copy and log raw Supabase/Auth messages server-side only. |
| CR-65 | `apps/web/lib/learning/session-review.ts:29` | Fixed in the worktree. `HOMA_REVIEW_MIN_MESSAGES` now accepts only finite positive numbers, floors decimals, and falls back to 4 for blank, malformed, or less-than-one values. |
| CR-66 | `apps/web/lib/sms-onboarding.ts:121-131` | Fixed in the worktree. `signupProgress` now batches in-range child answers with one family-scoped joined query and groups them in memory; single-child SMS answer reads also require `familyId`. |
| CR-67 | `apps/web/public/next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg` | Fixed in the worktree. Full-repo grep found no references outside this tracker row, and the unused stock SVGs were deleted. |
| CR-68 | `apps/web/app/onboarding/r/[token]/chart-lightbox.tsx:32-66` | Fixed in the worktree. The chart lightbox now focuses the close button on open, traps Tab within the dialog, closes on Escape, and restores focus to the trigger on close. |

---

## Cross-cutting themes (touch many files; schedule as focused refactors, not one-offs)

### CR-69 · SRP: five modules carry far too many jobs

Each is a single file owning many unrelated responsibilities; splitting them makes each testable and stops unrelated edits from colliding. Named seams from the reviews:

- `apps/web/lib/map/store.ts` (1,276 lines) → `family-store` / `child-store` / `answer-store` / `report-store` / `plan-store`.
- `apps/web/app/app/chat-client.tsx` (723 lines) → `useChatSession`, `useStreamWatchdog`, `useMessageQueue`, `ChatTranscript`, `ChatComposerFooter`.
- `apps/web/app/onboarding/r/[token]/report-view.tsx` (865) → `buildReportSections` (pure) + `ReportSubjectRow` + standalone/app layout components.
- `apps/web/app/onboarding/map-flow.tsx` (631) → `useMapFlowRouter`, `useMapSession`, thin renderer.
- `apps/web/lib/agent-pinned.ts` (368) → `-children` / `-hours` / `-recall`; `apps/web/lib/voice/sms-attachments.ts` (469) → per-attachment-kind processors; `apps/web/agent/tools/create_printable.ts` (392) → validate/render/persist/deliver.

Verified: file sizes and tangled responsibilities confirmed by direct read. Do these when each area is next touched, not as a big-bang.

### CR-70 · DRY: web ↔ mobile chat stack is duplicated and already drifting

The single largest duplication in the repo. `chat-storage.ts` (~230 lines each), `turn-recovery.ts`, `transcript-days.ts`, `turn-clock.ts`, `message-utils`/`message-parts` (memory chips, `busyLabel`, tool labels) are near-identical across `apps/web/app/app/` and `apps/mobile/src/`, and have **already diverged**: mobile's `busyLabel` shows a blank bubble where web shows "thinking…" (web fixed 2026-07-07), mobile lacks web's past-tense tool activity lines, mobile renders assistant messages in cards where web went flat (2026-07-09). Extract the pure logic into `@homa/core` (or a new `packages/chat-client`) with thin platform adapters. Verified: high.

### CR-71 · DRY: repeated boilerplate that should be one helper each

Verified copy-paste with concrete both-sites:

- **Agent tool scoping preamble** (16 tools) and **signup-session preamble** (6 tools): the same `resolveAgentAccess`/`resolveSignupSession` try/catch block. Extract `withAgentAccess(attributes, fn)` / `withSignupSession(...)`.
- **Map-route auth+validate preamble** (~10 routes): rate limit + `requireFamily` + JSON parse + zod. Extract `parseMapRequest(request, schema)`.
- **Telnyx webhook key check** (6 routes) → fixed in the worktree with one
  `lib/voice/webhook-auth.ts` helper.
- **Resume-cookie set** (4 routes) → fixed in the worktree with one
  `lib/map/resume-cookie.ts` helper.
- **Child interest/style/help-with parsing** (`store.ts`, `narrative-store.ts` ×2, `curriculum-store.ts`) → fixed in the worktree with one `lib/map/profile-context.ts` helper.
- **`escapeHtml`** (`map/email.ts`, `materials/page-shell.ts`, `api/link-phone/route.ts`) → fixed in the worktree with one `lib/html-escape.ts`.
- **Telnyx SMS send** (`family-phone.ts` reimplements `voice/telnyx-api.ts`'s `sendHomaSms`) → fixed in the worktree by moving the link notification onto `sendHomaSms`. **Skill-library resolver** duplicated by `lib/slash-skills.ts` → fixed in the worktree by reusing `agent-skills-store.ts`. Remaining: **E.164 normalization** across Telnyx scripts; **`argValue`/`parseArgs`/`loadEnvFile` bootstrap** across ~10 scripts (→ `scripts/cli-args.mts` + `scripts/load-web-env.mts`).
- **Report/plan facts assembly** duplicated and drifting between `narrative-store.ts` (full) and `curriculum-store.ts` (thin, missing context) → one `loadReportFactsInput(familyId, childId)`. Note: this thinness is also the root of CR-14.

Verified: high on all listed sites.

### CR-72 · Mobile is behind web on shipped decisions

Status 2026-07-11 late night: Fixed in the worktree for every named gap below.
Mobile no longer exposes standalone account creation or family creation, reads
`profile_completed_at`, gates Today and Chat until family setup plus at least
one child exists, prefers the signed-in member display name, and still queues
`/api/learning/review` after successful turns.

Beyond the duplication, mobile lags web on decisions already made: it still offers standalone signup (web retired it 2026-07-08; mobile users skip onboarding + `profile_completed_at`), doesn't call `/api/learning/review` after turns, ignores per-member display names (multi-parent v0), and doesn't gate the Today flow on `profile_completed_at`. Its `AGENTS.md:13` also overstates tenant safety ("familyId never comes from client input") while `family.ts:95` and `events.ts:12` do pass client `family_id` (RLS re-checks it, so safe, but the doc should say so). Decide per item: implement, or document as an intentional mobile gap.

2026-07-11 cleanup: `apps/mobile/AGENTS.md` now states the actual boundary, agent identity never takes `familyId` from client input, while app writes may pass a selected `family_id` under caller-token RLS. The mobile chat stack now does call `/api/learning/review` after successful turns. Standalone signup/profile-completion, per-member display names, and Today/Chat gating are fixed.

---

## Tracked · re-confirmed known-deliberate, do not "fix" out of band

- **`packages/design/` empty stub** (README only): M1-17.
- **`stripe` dep + Stripe env keys unused in code**: Phase D billing; wiring comes with the paywall PR. (Still worth CR-56's "remove until used" if Phase D is far off, founder call.)
- **`apps/web/content/blog/` empty** (`.gitkeep`): fills when the marketing distributor publishes; routes render an honest empty state.
- **`patches/eve@0.19.0.patch`**: load-bearing (WebKit stream-disconnect recovery for suspended Safari tabs, documented in `chat-client.tsx:73-80`); keep until `scripts/eve-upgrade-check.mjs` passes a bump. See CR-55 for the config-location risk.
- **disabled agent tools** (`bash.ts`, `write_file.ts`, `web_fetch.ts` via `disableTool()`): intentional per architecture.
- **`waitlist` table + `/api/waitlist`**: still the offline fallback and MJ-09 bridge; every lead mirrors into it.
- **`lib/harness/resume-session.ts` dormant**: flagged CR-49 for a re-decision, but the 2026-07-06 audit already ruled it "wire when resume lands, do not delete". Keep unless the founder overturns.
- **CI runs isolation against live prod, not a branch DB** (`ci.yml:67-71`): a known property of the current setup; a new table's RLS isn't tested until prod migration lands. Document in the workflow, or add a local-Supabase CI job (larger effort).

---

## Did NOT survive verification (recorded so nobody re-flags them)

- **"save_skill / forget_skill / skill-library broken on SMS/email/dispatch pinned channels" (reported P0).** FALSE for current source. `save_skill.ts:52`, `forget_skill.ts:35`, and `skill-library.ts:37` call `resolveAgentAccess()` and branch on `access.mode === "pinned"` into `saveFamilySkillPinned` / `loadSkillLibraryPinned` / `forgetFamilySkillPinned`, all of which exist in `lib/agent-skills-store.ts` (lines 171/72/250). Those three files are modified in the working tree, i.e. the pinned-path support is already in place, uncommitted. The reviewer read an earlier shape.
- **"`check:skills-targeting` cannot run under `node`" (reported P0).** Not reproducible here: `pnpm check:skills-targeting` passes (15 checks) on Node 24, which strips the TypeScript types in the imported `.ts` graph. If a future CI Node drops that behavior it could regress, but it is green today, so not a P0.
- **"`.next/` missing from `.gitignore`" (reported).** Each Next app has its own ignore: `apps/web/.gitignore` contains `/.next/`. Root omitting it is harmless. `.output/` is also correctly ignored (verified with `git check-ignore`).
- **"`apps/web/.output/` dirty and untracked" (from the conversation-start git snapshot).** Stale snapshot; `.output/` is gitignored now.

---

## Suggested execution order

1. **PR 1 · P0 safety (CR-01…CR-04):** checklist-undo server clear, phone-claim transaction, link-phone GET→POST split, isolation-check strictness. Small, high-value, each keeps all guards green.
2. **PR 2 · timezone correctness (CR-11, CR-12, CR-16, CR-17, CR-18):** one `ageInMonths`, family-zone "today"/recall dates. Shared root cause, best fixed together.
3. **PR 3 · public-surface + guard hardening (CR-19…CR-24, CR-28…CR-32):** rate limits, invite-email check, isolation cross-tenant phase + missing tables, script exit codes, deny-all REVOKEs.
4. **PR 4 · the rest of P1 bugs (CR-05…CR-10, CR-13…CR-15, CR-33…CR-35).**
5. **PR 5 · law/convention mechanical sweep (CR-36…CR-43, CR-50…CR-54):** copy, comments, em dashes, exhaustive switches. Docs/cosmetic, low risk.
6. **Refactors, when each area is next touched (CR-69…CR-72):** SRP splits, the web/mobile chat-stack shared package, the DRY helpers. Not big-bang.

Each PR should keep `pnpm typecheck && pnpm lint && pnpm build && pnpm check:isolation && pnpm check:map && pnpm check:events && pnpm check:skills-targeting && pnpm check:taxonomy` green; PR 5 is effectively docs/cosmetic.
