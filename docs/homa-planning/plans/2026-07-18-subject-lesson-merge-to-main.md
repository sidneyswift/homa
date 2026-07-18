# Subject lesson builder: merging the recovered work into current main

> Status: DRAFT, reviewed. Original draft (§0-§5 below) was validated,
> questioned, and challenged by 18 independent read-only subagents (12
> per-ticket validators, 4 cross-cutting questioners, 4 adversarial
> challengers — all strictly barred from mutating
> `.worktrees/subject-lessons`, verified untouched throughout). Their
> findings are folded in as **Review amendment** callouts under each
> ticket, plus a new §6 with the two findings that don't belong to any
> single ticket. **Founder decision recorded 2026-07-18: swap, don't
> preserve — `WelcomeChooser`'s per-subject links replace "Homa builds the
> four-week plan" with the lesson flow whenever `subjectLessonsEnabled` is
> on, full stop, not a coexistence question. See §6.2 and SLM-5.** Nothing
> else has been resolved or executed yet.
>
> **Top-line verdict from the review: the original plan understated
> difficulty in most tickets and missed real risk in three places serious
> enough to change the plan, not just its wording:**
> 1. Two entire shipped-on-main features were never in §1's inventory —
>    the morning-offer-funnel's "offer fulfillment" hardening (touches
>    `create_printable.ts` and `materials/artifact-store.ts`) and PR #29
>    "Conversation reliability foundation" (touches `persist-conversation.ts`,
>    `events.ts`, and both planning docs — landed *after* this spec was
>    written, mid-review, and directly invalidates SLM-3/6/8 as originally
>    described).
> 2. The migration adds a trigger that will **break today's live
>    "approve a worksheet" flow for every family** if applied before the
>    matching code deploys — the opposite of the "additive migrations may
>    lead" allowance this plan originally assumed applied. See §6.1.
> 3. One file that "auto-merged clean" is not semantically correct:
>    `materials/library.ts`'s pinned-read functions silently drop
>    `pageCount`/`pagePreviewUrls` for packet materials. See SLM-9.
>
> Re-run the drift check in §5 again before executing anything — `main`
> moved from 95 to 100 commits ahead of the merge-base three times just
> during this review.

## 0. How this was produced (so a reviewer can check the method, not just the conclusions)

The subject-lesson-builder feature (one saved next-skill lesson per report
subject, replacing the per-subject "Build the 4-week plan" action; founder
ruling 2026-07-15, "subject cards offer one saved lesson") was built and
locally verified in `.worktrees/subject-lessons`, but never committed. The
branch is checked out at `b268e9d`, the merge-base with `main`, which is now
100+ commits behind `origin/main` (re-check before trusting this number).

To find out whether it still merges, I:

1. Confirmed the working tree's local state passes on its own: typecheck
   clean, lint clean (one unrelated pre-existing warning), and every
   relevant test file green — 121 (`lib/subject-lessons/*.test.ts`), 19
   (`subject-lesson-button.test.tsx`), 22 (`lesson-view.test.tsx`), 42
   (`lib/materials/*.test.ts`), 128 (`check:progress-ui`), 31 (`check:map`),
   plus `check:events` and `check:fleet-skills` (the new
   `subject-lesson-builder` skill package passes hygiene).
2. Snapshotted the working tree (tracked + untracked) into a dangling commit
   with `git add -A && git stash create` — this does not touch the real
   worktree's index or files. **Review amendment:** on this repo's git
   version (2.39.5), `git stash create -u`/`--include-untracked` silently
   drops untracked files with a zero exit code — the flag is documented for
   `git stash push`, not the `create` plumbing command. Plain `git add -A`
   first, then `git stash create` with no flag, is the form that actually
   captures everything. One reviewer fell into this and caught it before it
   affected any finding; a future re-simulation should diff file counts
   against `git status` rather than trust a clean exit code.
3. Created a disposable worktree from that dangling commit at
   `/tmp/sl-merge-test` and ran `git merge origin/main --no-commit --no-ff`
   there.
4. Read every conflicted hunk by hand to tell mechanical "both sides added
   something, splice them" conflicts apart from real semantic collisions
   where two features independently built overlapping infrastructure.
5. Aborted the merge and removed the disposable worktree. The real worktree
   was never touched; `git status` there is identical to before the test.
   **Review amendment:** a linked worktree at `.git/worktrees/sl-merge-test`
   is in fact still registered against the shared `homa` `.git` (detached
   HEAD). Step 5's cleanup claim didn't fully hold — `git worktree remove`
   was run but something re-registered or the removal didn't fully take.
   This does not touch `.worktrees/subject-lessons` (re-verified unchanged
   throughout the review) and isn't something either the original pass or
   the review agents should act on unilaterally — flagging for the founder
   to prune (`git worktree prune` from the primary checkout) at their
   convenience.

**A reviewer should re-run steps 2-4 independently rather than trust this
document's transcription of the diffs** — the exact hunk boundaries matter
and are easy to mis-copy. Two independent review passes did re-run this
method from scratch and got the same 14-file, 25-hunk top-line count both
times, which is the one figure in this document I'd call solid.

## 1. What's actually shipped on `main` that this branch didn't know about

**Review amendment — this inventory was incomplete, found independently by
two separate reviewers:** it omitted the **morning-offer-funnel's "offer
fulfillment" hardening** (commits `8ea4df8` "Make offer fulfillment durable
and non-forgeable", `fe64f45` "Harden offer provenance across clarification
turns", part of the PR #20 lineage) — `reserveAcceptedOfferFulfillment` /
`completeAcceptedOfferFulfillment` / `acceptedOfferDeliveryIdFromAttributes`
in `apps/web/lib/conversation-continuity/offer-fulfillment.ts`, consumed by
`create_printable.ts` (main added a materialId reservation/completion
protocol around the whole tool body) and `materials/artifact-store.ts`
(`MaterialRowInput.sourceOfferDeliveryId`, and `id` became a **required**
field). Both files are already on this branch's modified-file list. This
single omission is why SLM-4 and SLM-9 (below) both needed real correction:
the spec had attributed one of the two real conflicts in each of those
files to the wrong cause.

Since `b268e9d`, `main` gained (still not guaranteed exhaustive — see the
lesson just above):

- **Report lock** (PR #25): `reportLock`/`ReportLockOffer` props on
  `ReportView`, partitioning subjects into free/held rows. **Also brings a
  `WelcomeChooser` component (main commit `e771f7c`) that re-links every
  mapped subject to `/onboarding/r/[token]/plan/[subjectId]` with "Homa
  builds the four-week plan" copy — see §6.2, a real product conflict this
  spec didn't catch the first time.**
- **Multi-page packets** (`materials: multi-page packets end to end`):
  `create_printable.ts`'s input schema gained a `pages` array,
  `MAX_PACKET_PAGES`, and per-page source aggregation. **Review amendment:**
  §1 originally said main "renamed" the schema
  (`createPrintableInputSchema` → `printableInput`) — this is backwards.
  Both the merge-base and `origin/main` already call it `printableInput`
  (unexported); it's the **subject-lessons branch** that renamed it away to
  an exported `createPrintableInputSchema`. Two other files in this branch
  (`apps/web/evals/subject-lesson-builder/workflow-harness.ts` and
  `apps/web/lib/subject-lessons/dispatch-input.test.ts`) import that exact
  exported name and will fail to compile if it's dropped — see SLM-4.
- **Agent jobs / curriculum-studio** (PR #28, ships dark behind
  `HOMA_AGENT_JOBS_ENABLED`): its own "pinned internal channel" concept
  (`agent-job`) in `agent-db.ts`, and its own conversation-persistence skip
  condition (`isParentedEveSession`) in `persist-conversation.ts`. **Also
  independently rewrote `resolveAgentAccess` itself** as part of a
  *separate*, already-shipped production bug fix (commit `44904db`, "agent
  access: expired web tokens degrade to family-pinned, ending mid-turn JWT
  failures") — sync on this branch, `async` with token-expiry and live
  membership re-verification on main. See SLM-1: this is a much bigger
  collision than "two channel lists to union."
- **Slim morning-brief dynamic context**: `family-context.ts`'s dynamic
  instructions resolver was extracted into a pure, dependency-injected
  `resolveFamilyContextInstructionMarkdown()` so morning-brief dispatch
  sessions can skip family/progress hydration.
- **Cross-family isolation probes for `child_plans`** (PR #30): new probes
  in `scripts/isolation-check.mjs`, plus (missed in the original inventory)
  **two schema-existence helpers and a signature change to a shared helper**
  from the morning-brief-v2/offer-funnel work — see SLM-7.
- **PR #29, "Conversation reliability foundation: six continuity fixes"**
  — landed on `main` *during this review*, after the spec's original §1 was
  written. Touches `persist-conversation.ts` (SLM-3's exact file, adding a
  third guard and a richer `message.received` flow the ticket didn't
  describe), `events.ts`/`events.test.ts` (SLM-6's exact file), and both
  planning docs (SLM-8's exact files). **SLM-3, SLM-6, and SLM-8 need to be
  re-derived against current `main`, not just re-worded** — see each
  ticket and §6.

Independent features grew overlapping infrastructure (pinned channels,
family-context resolution, printable generation input, the wall's door
registry, isolation probes, and now conversation-persistence guards) at the
same time. That overlap, not textual bit-rot, is the entire reason this
doesn't merge cleanly.

## 2. Tickets

Ticket prefix: **SLM** (Subject Lesson Merge). Each ticket names the file(s),
the nature of the conflict, and what "done" means. Sequencing in §3.

### SLM-1 — Unify the pinned-internal-channel helper (`agent-db.ts`, `model-usage.ts`)

Both branches independently invented "a way to authenticate a trusted
internal channel with a family_id already pinned to it": ours as a typed
`PinnedAgentChannel` union (`sms | email | dispatch | subject_lesson`) with
exported `isPinnedAgentChannel` / `resolvePinnedFamilyId` helpers; main's as
an inline, untyped `new Set(["sms", "email", "dispatch", "agent-job"])`.

**Review amendment (validated, severity high) — this ticket significantly
understated its own scope.** The channel-list union is the smaller half of
the work. The real collision: both branches export a function named
`resolveAgentAccess` with **incompatible signatures**. Ours is fully sync.
Main's is `async`, added by an *already-shipped, unrelated production bug
fix* (`44904db`): JWT-expiry grace window plus a live
`public.family_members` re-check, justified by a real incident ("`find_materials`
failures in production, the Llanes session, 2026-07-17 02:28 UTC"). A
function can't be conditionally async — unifying on main's richer (and
security-relevant) version requires adding `await` at every "ours" call
site. Confirmed via an actual merge simulation that **all ~21 real tool-file
callers already carry main's `await` in the auto-merged result with zero
manual intervention needed** (the conflict-marker region is genuinely
narrow, ~20 lines) — the risk is not "will this compile," it's "will
whoever resolves the ~20-line conflict marker accidentally hand-rewrite the
whole function from this ticket's simplified description and drop the
security fix in the process."

**Done when (revised):**
- The typed `PinnedAgentChannel`/`isPinnedAgentChannel`/`resolvePinnedFamilyId`
  helpers survive, extended to include `"agent-job"`.
- `resolveAgentAccess` keeps main's `async` signature, `memberUserId`,
  `TOKEN_EXPIRY_GRACE_SECONDS`, `decodeTokenExpirySeconds`,
  `callerTokenIsExpired`, and `verifyFamilyMembershipPinned` **intact** —
  resolve only the ~20-line conflict-marker region, do not rewrite the file.
- `model-usage.ts`'s parallel `usageSurfaceFromAttributes` conflict is
  resolved the same way (combine both branches' logic), but **do not** add
  `"agent-job"` to `UsageChannel` there — main never uses that value in this
  file (confirmed: agent-job sessions calling any usage-recording tool fall
  through to `"web"` today on `main` itself; that's a pre-existing main-side
  gap, not something this merge needs to fix).
- Note for whoever executes this: `"agent-job"` also appears as a hardcoded
  literal (not an import) in `lib/jobs/guard.ts` and the agent-jobs
  channel/schedule files — this ticket unifies the pinned-access helper in
  agent-db.ts, it does not make that string canonical fleet-wide.
- **New, moved here from where it was mis-assigned:** fix
  `family-context-security.test.ts`'s `describe("subject lesson pinned
  family context")` block (currently calls `resolveAgentAccess` and asserts
  on it *synchronously* — `assert.deepEqual(resolveAgentAccess(...), {...})`
  and `assert.throws(() => resolveAgentAccess(...), ...)`). Once the
  function is async, both assertions **compile but fail at runtime**
  (a Promise is never deepEqual to a plain object; an async function never
  throws synchronously, so `assert.throws` reports "Missing expected
  exception"). This is agent-db.ts's own test coverage — it belongs to this
  ticket, not SLM-2, and "typecheck/build compiles" will not catch it.

### SLM-2 — Rebuild family-context pinning on top of `resolveFamilyContextInstructionMarkdown`

`main` refactored the entire dynamic-instructions body into a pure function
with injected dependencies (`loadCallerFamilyContext`,
`loadPinnedFamilyContext`, `renderFamilyContext`, `loadProgressContext`,
`loadContinuityContext`, `recordContextSnapshot`) specifically so the slim
morning-brief path could test itself without a database. Our pinned-channel
branch (`pinnedFamilyId` via `resolvePinnedFamilyId`, from SLM-1) needs to
become another branch inside that same injected-dependency function, not a
second parallel implementation.

**Review amendment (validated, severity high) — the ticket's own acceptance
test doesn't test the thing it claims to.** `family-context-security.test.ts`'s
`describe("subject lesson pinned family context")` block calls only
`resolvePinnedFamilyId`/`resolveAgentAccess`/`renderFamilyContext` — it never
calls `resolveFamilyContextInstructionMarkdown` at all. Satisfying this
ticket's originally-stated acceptance criterion proves nothing about whether
`subject_lesson` sessions actually route through the new shared function. A
new test needs to be **authored** (main's own `describe("slim morning brief
dynamic context")` block, with fully injected mock dependencies, is the
pattern to follow), not assumed to already exist.

**Also found, real design decision needed, not a bug:** main's
`resolveFamilyContextInstructionMarkdown` doesn't call SLM-1's shared helper
at all — its pinned branch is a third, already-diverging inline check
(`channel === "sms" || "email" || "dispatch"`), which **deliberately
excludes `"agent-job"`** even though agent-db.ts's own `PINNED_CHANNELS`
includes it. Whoever executes this ticket must choose, and record the
choice: (a) append `|| channel === "subject_lesson"` to the existing narrow
inline list (preserves main's apparent deliberate exclusion of `agent-job`
from full family-context hydration), or (b) switch to SLM-1's unified
`resolvePinnedFamilyId`, which would also start granting `agent-job`
sessions full hydration in this hook — a scope change nobody has decided,
and potentially in tension with curriculum-studio's `isParentedEveSession`
isolation. **Recommend (a)** unless someone with context on agent-jobs says
otherwise.

**One more concrete bug to fix, not just test:**
`resolveFamilyContextInstructionMarkdown` reads `attributes.viewChildId` for
`focusChildId`; subject-lesson sessions set `attributes.childId`, not
`viewChildId`. As written, even a correct implementation of this ticket
would render family context not focused on the lesson's actual child. Add
`childId` as a fallback source for `focusChildId`.

**Done when (revised):** subject_lesson-channel sessions resolve family
context through the shared function (decision (a) above, recorded, unless
overridden), a new test actually exercises that path with injected
dependencies, `focusChildId` falls back to `attributes.childId`, and the
slim-morning-brief tests still pass unmodified.

### SLM-3 — Reconcile the persistence-skip conditions (`persist-conversation.ts`)

**Review amendment (validated, severity high) — this ticket's description
of "main's" code was factually wrong on both handlers, and `main` gained a
third guard mid-review (PR #29). Rewritten below rather than patched.**

`message.received` on current `main` does **not** call `isParentedEveSession`
at all. It has its own delegated-session-lineage flow with a real side
effect: `if (ctx.session.parent && familyId) { const lineage =
delegatedSessionLineage(...); await emitMapEvent("conversation.session_delegated",
{family_id, child_session_hash, parent_session_hash, root_session_hash});
return; } if (ctx.session.parent) return;`. A plain OR with
`shouldSkipConversationPersistence` in this handler would silently drop that
analytics event for any parented+familyId session.

`message.completed` on current `main` calls `isParentedEveSession(...)`
**and separately** `preparedResearchBriefOwnsCanonicalPersistence(ctx.session.auth.current?.attributes)`
— a guard from a brand-new file (`apps/web/lib/tasks/research-brief-delivery.ts`,
not present anywhere in the subject-lessons branch), protecting a real
persistence race for research-brief-v2 dispatch that main's own comment
describes explicitly. Dropping this guard during a naive merge reintroduces
that exact race.

Neither `apps/web/lib/conversation-continuity/session-lineage.ts` (holds
`isParentedEveSession`/`delegatedSessionLineage`) nor
`apps/web/lib/tasks/research-brief-delivery.ts` exists in the subject-lessons
branch at all — both are new required imports.

**On the interaction this ticket originally asked a challenger to worry
about** (a subject-lesson session running as a child of the agent-jobs
runner): traced how sessions actually get parented in both branches —
subject-lesson sessions start via a plain authenticated fetch
(`session-starter.ts` → `POST /eve/v1/subject-lesson/start`), never through
eve's subagent-delegation primitive that populates `SessionParent`.
Agent-job sessions start fresh from a schedule tick with no parent field.
`channel === "subject_lesson"` and "has a parent" look like disjoint sets
today, so a same-session double-trigger between the two guards doesn't
appear reachable. The real risk was the two findings above, not this one.

**Done when (revised):**
- `message.received`: add an unconditional early return for
  `shouldSkipConversationPersistence(attributes)`, leaving main's
  parent+familyId `delegatedSessionLineage`/`emitMapEvent` branch and the
  bare `if (ctx.session.parent) return;` fully intact below it.
- `message.completed`: keep all three guards —
  `shouldSkipConversationPersistence`, `isParentedEveSession`, and
  `preparedResearchBriefOwnsCanonicalPersistence` — combined, none dropped.
- Import `session-lineage.ts` and `research-brief-delivery.ts` as new
  dependencies.
- Add or promote a real regression test: neither branch has a dedicated
  unit test for this file today; main's only test exercising the
  delegation-event path
  (`scripts/parented-session-continuity-e2e.mts`) isn't wired into any
  `package.json` script or CI job. Wire it in, or add a targeted unit test
  — otherwise a silent regression here passes CI unnoticed.
- **Re-derive this whole ticket against current `main` before executing** —
  PR #29 landed after the above was written from an earlier snapshot of
  main; re-read the file fresh rather than trust this ticket's quotes.

### SLM-4 — Rebuild the subject-lesson printable restriction against the new packet schema (`create_printable.ts`)

Ours (`subjectLessonPrintableRestriction`, `buildPrintableGenerationInput`,
`CreatePrintableInput`) was written against the single-page-only schema.
Main added a `pages` path (packets) plus, independently, the
offer-fulfillment reservation/completion protocol from §1's corrected
inventory (`reserveAcceptedOfferFulfillment`/`completeAcceptedOfferFulfillment`,
neither mentioned in this ticket originally).

**Review amendment (validated, severity high) — three things that would
break a naive merge on the first pass, none in the original "Done when":**

1. **Guaranteed duplicate-declaration compile break.** One of the five
   conflict hunks is: our side deleted a `const attributes = ...`
   declaration from one spot and moved it earlier (right after
   `const { familyId } = access;`); main's side kept its own
   `const attributes = ...` at the original spot (widened for its own
   fields). Naively keeping both sides produces two `const attributes` in
   one scope — a hard compile error. **Resolve by deleting main's late
   redeclaration and keeping the early one** (widen its type to add
   `acceptedOfferDeliveryId?: string` for accuracy). The early position is
   load-bearing: it's what lets `subjectLessonPrintableRestriction` run
   *before* main's now-much-heavier packet-resolution loop (which does DB
   reads via `getMaterialPinned`/`getMaterialCaller` for any
   `fromMaterialId` page).
2. **A real external consumer breaks if the exported schema name is
   dropped.** `apps/web/evals/subject-lesson-builder/workflow-harness.ts`
   and `apps/web/lib/subject-lessons/dispatch-input.test.ts` both import
   `createPrintableInputSchema` by that exact exported name today (three
   `.parse()` call sites in the test file alone). If the merged file keeps
   only main's private `printableInput` const, both files fail to compile
   — which would break the eval harness and a chunk of the "121
   (`lib/subject-lessons/*.test.ts`)" tests §0 claims are currently green.
   **Either keep an exported `createPrintableInputSchema` alias
   (`export const createPrintableInputSchema = printableInput;`) or update
   both consumer files** — pick one and do it, don't leave it implicit.
3. **The offer-fulfillment reservation/completion protocol must survive**
   through this restructuring (`reserveAcceptedOfferFulfillment`/
   `completeAcceptedOfferFulfillment`, interleaved with the review/delivery
   logic this ticket already restructures for the `pages`/restriction work).
   No test on either branch exercises this through `create_printable.ts`
   directly — a merge that drops or mis-wires it would compile, typecheck,
   and pass every suite in SLM-11 while silently breaking offer redemption.
   Add a test that exercises this path.

**Also, smaller but real:** `PrintableGenerationInput.path` needs widening
from `"html" | "pageImageUrl"` to a 3-way union including `"pages"`;
`pageCount`/`pagePreviewUrls` belong on the outer `generation` object
literal at the call site (siblings of `input`), not folded into
`buildPrintableGenerationInput`'s return shape; and this file has an
unstated dependency on `render-page.ts`'s `renderPrintableHtml` keeping its
2-argument (`html, policy?`) signature through whatever SLM-9 does with
that file — main rewrote it to single-argument for multi-page support, so
confirm the `policy` parameter survives before assuming SLM-4 is done.

**Done when (revised):** all of the above, plus the original three bullets
(explicit `pages`-rejection in the restriction, `CreatePrintableInput`
re-derived from `printableInput`, generation-input reconciliation).

### SLM-5 — Merge `ReportView`'s props (`report-view.tsx`)

Three hunks, all in the import/destructure/type-block area: combine
`subjectLessonsEnabled`, `subjectLessons`, `viewerActions.lesson` with
`reportLock`. The row-rendering body (`renderSubjectRow` /
`renderHeldRow`, the `openMapped` / `lockedScores` / `openNotMapped`
partition) auto-merged with **no conflict markers**, and this was
independently re-verified by reading the actual merged render logic (not
assumed from the absence of markers): a locked subject genuinely never
reaches `renderSubjectRow`, so it never reaches the lesson button either.

**Review amendment (validated, severity medium/high), decided 2026-07-18 —
one real gap found, confirmed by two independent reviewers.**
`WelcomeChooser` (a component `main`'s report-lock brought in, shown to a
family right after they pay) links each subject to
`/onboarding/r/[token]/plan/[subjectId]` with "Homa builds the four-week
plan" copy — the exact per-subject flow this feature exists to replace. It's
a separate file, gated on nothing subject-lesson-related, never routed
through `ReportView`, and this ticket's only prior mention of it was "keep
this JSX wrapper structurally intact," not "this needs to be reconciled."

**Decision: swap, not coexist.** When `subjectLessonsEnabled` is on, every
`WelcomeChooser` row replaces its "Homa builds the four-week plan" link with
the same lesson build/open action the report body uses (`SubjectLessonButton`
or its equivalent, not a second bespoke implementation) — never both, never
a choice between the two. When the flag is off, `WelcomeChooser` keeps its
current plan-link behavior unchanged. This is a full replacement of the
per-subject action, matching exactly how the report body itself already
does it (`subjectLessonsEnabled ? <SubjectLessonButton/> : <DoorLink>Build
the 4-week plan</DoorLink>`) — `WelcomeChooser` should follow the identical
rule, not invent its own.

**Also found and worth a founder confirmation, not a blocker:** the subject-
lesson content page (`lesson/[subjectId]/page.tsx`) has zero report-lock
awareness — it never checks whether a subject is currently "held." This
appears to be **intentional by existing precedent** (`wall.ts`'s own rule:
"the report stays free forever ... viewing content that already exists
stays open; only new action is gated," which the sibling `/plan/[subjectId]`
route already follows the same way for old plans) rather than a gap, but no
one has said so for lessons specifically, and report-lock's own plan doc
predates subject-lessons and never mentions it. Worth one explicit sentence
from whoever owns the report-lock ruling.

**Done when (revised):**
- Combined signature compiles; locked subjects show no lesson-build action
  (already true, confirmed).
- **New, decided:** `WelcomeChooser` swaps its per-subject link for the
  lesson build/open action whenever `subjectLessonsEnabled` is on — full
  replacement, same rule the report body already follows, never both
  actions shown for one subject. Reconcile `welcomeSubjects`' eligibility
  filter (computed independently in `page.tsx`) with `viewerActions.lesson`'s
  eligibility logic — the two lists aren't guaranteed to agree today, and
  must for the swap to be consistent.
- **New:** get an explicit answer (one sentence is enough) on whether the
  lesson content page should inherit report-lock enforcement, and record it.
- The two named call-site conflicts (`app/app/[childId]/report/page.tsx`,
  `app/onboarding/r/[token]/page.tsx`) resolve as originally described; the
  tokenized page's surrounding `reportLock`/checkout computation (which
  auto-merges without conflict) is meaningfully more involved than the
  app-page's and deserves an actual read-through, not just a 3-line
  resolution.
- Two more `ReportView` call sites exist (`admin/families/[familyId]/report/[childId]/page.tsx`,
  the founder mirror; `onboarding/sample/page.tsx`) — both confirmed to
  merge clean and correctly pass neither `reportLock` nor `viewerActions`,
  consistent with `ReportLock`'s own doc comment ("never passed by the
  sample or the founder mirror"). No action needed, just don't let SLM-9's
  file list stand in as "everything's been checked" — these two weren't on
  it either.

### SLM-6 — Merge the wall's door registry (`packages/core/src/events.ts`)

`WALL_DOORS` diverged: ours added `"lesson"`, main added `"report"` (for
the report-lock offer). Combine into one tuple with both.

**Review amendment (validated, severity high) — a second, undocumented
conflict in the same file, plus a wrong verification method.** Right after
`PROGRESS_EVENT_DIMENSION_ID_SCHEMA`, both branches independently insert new
consts at the identical anchor point: ours adds
`SUBJECT_LESSON_EVENT_FIELDS`/`SUBJECT_LESSON_ATTEMPT_SCHEMA`/
`SUBJECT_LESSON_ERROR_CODE_SCHEMA`/`MATERIAL_EVENT_CHANNEL_SCHEMA`/
`MATERIAL_CREATION_EVENT_CHANNEL_SCHEMA`; main independently adds
`SESSION_HASH_SCHEMA`/`PROMPT_SUGGESTION_EVENT_FIELDS` (from PR #29). This is
mechanical (plain concatenation, the two groups don't reference each other)
but is not mentioned anywhere in this ticket, so a resolver who stops after
fixing `WALL_DOORS` will miss it.

`check:events` **cannot validate the `WALL_DOORS` merge at all** — it's a
name-level emitter/registry parity check with no visibility into a schema's
enum values; `wall.*`/`report.action_tapped` emitters exist on both branches
regardless of merge outcome, so it passes trivially even if `WALL_DOORS`
were merged wrong. The actual safety net is `pnpm typecheck`, via the sole
exhaustive `switch (door)` in `apps/web/components/billing/wall-copy.ts`'s
`wallIncludedLine` (`const exhaustive: never = door`) — that's the real
verification step. Two stale doc comments near the declaration ("the wall's
five doors" / "one of the five doors") also need updating to six; nothing
catches this class of drift automatically.

**Done when (revised):** both `WALL_DOORS` values combined; the second
new-const collision resolved by concatenation; both stale doc comments
updated; verified via `pnpm typecheck` (not `check:events`).

### SLM-7 — Merge the new isolation probes (`scripts/isolation-check.mjs`)

Five hunks. Ours: `subject_lessons` + `materials.subject_lesson_id`
provenance checks. Main's: `child_plans` cross-family probes (PR #30) +
material offer-provenance forgery checks. One hunk is a pure addition (both
sides added a new, independent helper function — order-independent, safe).

**Review amendment (validated, severity high) — two of the five hunks are
harder than "splice both sides," and one hunk's content was missed
entirely.**

1. The materials-provenance conflict isn't two independent hunks — it's
   **one logical collision split across two conflict markers around a
   shared call prefix**. Both branches call
   `expectAuthenticatedUpdateDenied(familyBUser.accessToken, "materials",
   "id", materialBId, ...)` with *different* trailing arguments (ours:
   `{status:"final",...}` / "auth member cannot directly update material
   status"; main's: `{source_offer_delivery_id:...}` / "auth member cannot
   forge material offer provenance on update"). A resolver treating each
   marker as an independent "pick a side" choice — the pattern that
   correctly handles the pure-addition helper-function conflict — risks
   producing one merged call with only one of the two probes, silently
   losing the other. **Both must survive as two complete, separate calls.**
2. Main's `const childPlanBId = await insertFixtureRow(...)` declaration
   sits interleaved inside that same split region, read later (elsewhere,
   auto-merged clean) at four call sites. Dropping it during a careless
   resolution produces a runtime `ReferenceError` — this file has no static
   typechecking, so nothing catches this except an actual live
   `check:isolation` run, which this ticket already (correctly) mandates.
   Name this specific mechanism explicitly so whoever resolves it doesn't
   have to rediscover it.
3. **A hunk's real content was missed on the first pass:** at another
   location, main adds two schema-existence helpers
   (`morningResearchBriefV2SchemaExists()`, `morningOfferFunnelSchemaExists()`)
   and widens a shared helper's signature
   (`expectPrivilegedSqlRejected(label, operation)` →
   `expectPrivilegedSqlRejected(label, operation, expectedCode = null)`).
   Neither appears anywhere in this ticket's original text. Dropping either
   function or leaving a stale 2-arg call would break the
   morning-research-brief-v2 and morning-offer-funnel isolation probes with
   nothing in the "done when" list catching it.

Confirmed: no fixture-variable name collisions between the two branches'
new identifiers.

**Done when (revised):** all five hunks resolved per the above (the two
`expectAuthenticatedUpdateDenied(..., "materials", "id", materialBId, ...)`
calls survive as two separate complete invocations; `childPlanBId`'s
declaration retained; `morningResearchBriefV2SchemaExists`/
`morningOfferFunnelSchemaExists`/the 3-arg `expectPrivilegedSqlRejected`
preserved and all call sites updated), and `check:isolation` passes against
a **live** database — see §6.3 on what "live" actually means in this
environment before treating this as achievable pre-push.

### SLM-8 — Merge planning docs (`build-log.md`, `journeys/10-reconciliation.md`)

**Review amendment (validated, severity high) — this was described as
"small, mechanical, no conflict"; it is not. Both files have real conflict
markers, confirmed via two independent from-scratch merge simulations.**

`build-log.md`: both branches insert a new `## 2026-07-15 · ...` section at
the identical splice point (right after the "2026-07-16 · Production Eve
stream 300s timeout fixed" entry). Ours: "Founder ruling: subject cards
offer one saved lesson." Main's (via PR #29, added 2026-07-18 despite the
07-15 label): "Material generation is durable from the start." Real
conflict, not an append.

`10-reconciliation.md` §5 (the founder-ruling index): same collision shape
— both insert new rows immediately after the same existing row
(`filesystem-first-fleet-skills`, 2026-07-15). Ours adds
`subject-card-single-lesson`; main adds five contiguous new rows. This
registration is already **done on the "ours" side** (the row already
exists in the working tree) — the remaining work is reconciling it against
main's five new rows at the same point, not building it from scratch.

Both new entries share the literal date `2026-07-15` with no time-of-day
qualifier (unlike other same-day entries elsewhere in the file, which use
"(evening)"/"(night)" tags) — ordering between them is an **editorial
judgment call, not a fact to look up**. Recommend placing the subject-lesson
entry using its actual founder-ruling session context, since main's
competing entry was demonstrably backfilled three days after the fact.

**Re-derive both files against current `main` before executing — PR #29
also touches both, landing after this ticket was originally written.**

**Done when (revised):** both real conflicts resolved (not assumed clean),
ordering decision made and noted, re-checked against current `main`.

### SLM-9 — Spot-check the files that auto-merged without conflict markers

`.env.example`, `README.md`, `find_materials.ts`, `generate_image.ts`,
`keep_photo.ts`, `mark_material_final.ts`, `search_photos.ts`,
`material-card.tsx`, `wall-copy.ts`, `materials/library.ts`,
`materials/render-page.ts`, `materials/artifact-store.ts`, `binder.test.ts`,
`family-phone.ts`, `settings/page.tsx`, `settings/parents-section.tsx`,
`evals.config.ts`, `tasks/guard.ts`.

**Review amendment (validated, severity high) — found a real, ship-blocking
bug hiding behind a clean auto-merge, exactly what this ticket exists to
catch. Also: about a third of this file list needs no review at all.**

**The bug:** `materials/library.ts`'s three `*Protected` pinned-read
functions (`getMaterialPinnedProtected`, `getMaterialCardPinnedProtected`,
`findMaterialsPinnedProtected` — the new functions this branch added, gated
by `materialSubjectLessonProvenanceExists()`) were written against the
pre-packet schema and **never select `page_count`/`page_preview_urls` at
all**, unlike their sibling `*Legacy` functions (which correctly kept main's
new columns) and unlike the caller-mode read path. This is textually clean
(non-overlapping edits, no conflict markers) but semantically broken:
**once the migration lands — even with the subject-lessons flag off** —
every pinned-channel (SMS/email/dispatch) read of a multi-page packet
material returns `pageCount=1`/`pagePreviewUrls=null` regardless of the
real page count, breaking `material-card.tsx`'s pagination UI and any other
consumer (`show_material.ts`, `find_materials.ts`) for materials delivered
through a pinned session. No test in either branch would catch this — this
is the exact class of defect this ticket exists to find, and it wasn't
called out. **Fix:** add `generation->'pageCount' as page_count` and
`generation->'pagePreviewUrls' as page_preview_urls` (plus mapping) to all
three `*Protected` functions, matching the `*Legacy` functions; add a test
that exercises a Protected-path read against a packet-shaped row.

**Scope correction:** six of the ~17 listed files
(`family-phone.ts`, `settings/page.tsx`, `settings/parents-section.tsx`,
`evals.config.ts`, `tasks/guard.ts`, root `README.md`) have **zero changes
on main's side** — main never touched them since the branch diverged, so
there's nothing to reconcile; a typecheck/build pass is the whole review.
The remaining ~11 genuinely had concurrent edits on both sides, and — aside
from `materials/library.ts` above — were independently confirmed to compose
correctly by reading the actual merged content (not just the absence of
conflict markers): `find_materials.ts`/`generate_image.ts`/`keep_photo.ts`/
`mark_material_final.ts`/`search_photos.ts` all correctly combine main's
`await resolveAgentAccess` with our subject-lesson channel restrictions;
`render-page.ts` correctly combines main's per-page capture with our
policy parameter (contingent on SLM-4's dependency on this, noted there);
`material-card.tsx` and `wall-copy.ts` correctly combine both sides' UI/copy
additions (`wall-copy.ts`'s exhaustive switch is contingent on SLM-6 landing
both `WallDoor` values — self-enforcing via typecheck, but worth knowing
why a type error there might have nothing to do with `wall-copy.ts` itself).

**Review amendment — the "SLM-1's output landing correctly" note about
`artifact-store.ts` in the original §3 sequencing text is factually wrong,
found independently by two reviewers.** That file's real second conflict
(`sourceOfferDeliveryId` vs. the four `subjectLesson*` fields, plus `id`
becoming a required field, plus the reservation protocol) comes from the
**offer-fulfillment feature identified in §1's corrected inventory**, not
from anything SLM-1 touches. This needs its own explicit resolution, stated
here since no other ticket owns it: reconcile `MaterialRowInput`/
`insertMaterialRowPinned` to carry both feature's fields, decide and record
whether `sourceOfferDeliveryId` and the `subjectLesson*` fields can ever be
simultaneously non-null on one row (recommend: no — a subject-lesson
worksheet is never offer-sourced), and make sure the branch's new
transaction-based insert (`sql.begin(...)`) supplies a valid `id`, since
main made that field required.

**Done when (revised):** the `materials/library.ts` bug fixed and tested;
review budget spent on the ~11 genuinely-concurrent files, not all ~17;
`artifact-store.ts`'s real conflict (offer-fulfillment vs. subject-lesson
fields) resolved and decided, not deferred to a ticket that doesn't cover it.

### SLM-10 — Execute the merge and replay as real commits

Once SLM-1 through SLM-9 are resolved in the disposable test worktree (not
the primary one, until this ticket), replay the resolved result as a
reviewable commit sequence on a fresh branch cut from current `origin/main`.

**Review amendment:** do not execute this against the existing merge
simulation — re-run §0's method fresh first. `main` advanced from 95 to 100
commits ahead of the merge-base during this review alone (three different
counts observed: 95, 97, 100), and one of the commits in that window (PR
#29) directly changes three of this plan's target files. Re-derive SLM-3,
SLM-6, and SLM-8 against whatever `main` looks like at execution time, not
against this document's transcriptions.

### SLM-11 — Full re-verification after merge

**Review amendment (validated, severity high/medium) — one bullet in the
original list is unachievable in this environment as worded, and several
required guards were missing.**

`check:isolation against a live disposable Postgres` **mischaracterizes
what this check actually is.** `scripts/isolation-check.mjs` connects to a
live, persistent, network-reachable Supabase project via
`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`/
`SUPABASE_DB_PASSWORD` from `apps/web/.env.local` — it is not a disposable
local Postgres (that's the separate, unrelated `child-progress:e2e`
harness). This environment's isolated worktrees lack `.env.local` and all
three vars (confirmed by direct probe, matching the recovered branch's own
recovery notes verbatim). **The actual place this check runs live is CI's
"Tenancy isolation smoke check" job, which runs unconditionally on every
push with real secrets.** Reword this bullet to "confirm CI's isolation job
is green on the opened PR" — a post-push observation, not a pre-push
blocking local action nobody in this environment can perform. This also
means SLM-7's own "done when" (which demands a live run before SLM-10/11
even start) can't literally be satisfied before SLM-12 pushes — sequence it
as: resolve the merge conflicts carefully (SLM-7's harder-than-expected
hunks, above), then treat SLM-12's push + CI as the actual verification,
not a redundant local re-run of something CI already does for free.

**Missing from the original checklist, confirmed via `.github/workflows/ci.yml`:**
`check:continuity` (this branch adds a genuine new `defineChannel` adapter,
`apps/web/agent/channels/subject-lesson.ts` — exactly AGENTS.md's stated
trigger condition, though note: its test-file glob doesn't actually include
any of the touched files, so this may be lower-value than it sounds — check
before assuming it's required), `check:child-progress` (its script directly
runs `packages/core/src/events.test.ts`, which SLM-6 modifies),
`check:taxonomy`, `check:skills-targeting`, and `check:fleet-skills-dormant`
(all "Required guards" per AGENTS.md, all run unconditionally in CI
regardless of this checklist, relevant given the new skill package lands
inside the fleet-skills dormant window, open 2026-07-15 through at least
2026-07-22).

**The stated reason for re-running `check:fleet-skills` was wrong:** the
ticket said to re-run it "because `slash-skills.ts` is on the tracked-diff
list" — that file has **zero changes** on either side. The real reason to
run it is package hygiene for the new `subject-lesson-builder` skill
directory itself. Separately: that skill is triggered by a cron/channel
route, never typed by a parent, matching the same "dispatch-only,
deliberately absent" pattern `slash-skills.ts`'s own doc comment describes
for `research-brief` — it likely should **not** be added to
`BUILT_IN_SKILLS`, and the wrong original justification could send a future
executor hunting for a diff that doesn't exist or, worse, adding it to the
slash menu when it shouldn't be there.

**Done when (revised):** superset of §0.1's local suites, plus every
suite on current `main` for every touched file, plus `check:continuity`
(verify relevance first), `check:child-progress`, `check:taxonomy`,
`check:skills-targeting`, `check:fleet-skills-dormant`,
`VERCEL=1 pnpm --filter web exec eve build`,
`VERCEL=1 pnpm check:eve-stream-duration`, `pnpm typecheck`, `pnpm lint`,
full `pnpm build` — **plus the new same-tenant regression smoke test from
§6.1, which nothing in the original checklist covered** — and CI's
isolation job confirmed green on the opened PR, not a local re-run.

### SLM-12 — Ship

**Review amendment (validated, severity high) — this ticket doesn't
actually reach "shipped," and its core safety assumption about the
migration is wrong. See §6.1 for the full writeup; summary here.**

The migration is not safe to lead the code deploy the way AGENTS.md's
generic "additive migrations may lead" rule would normally allow — it adds
a trigger that rejects the *currently live* code's write pattern for
material approval, for every family, regardless of the subject-lessons
flag. This must be **code-deploy-READY, then migration**, not the reverse,
and that ordering needs to be stated explicitly rather than inherited from
the generic rule.

The migration's timestamp (`20260715210000`) is now **older than 8 already-
applied migrations on main** (newest: `20260718140000_agent_jobs.sql`).
Rename it to a fresh, later timestamp before replay/application, or expect
Supabase's tooling to flag it as out-of-order.

The original "Done when" (apply to preview/staging, confirm flag off,
commit, push, open PR) stops short of AGENTS.md's own deploy law: it never
merges the PR, watches the production Vercel deployment reach READY,
applies the migration to production only after that, probes the live site,
or confirms the PR's actual GitHub Actions result. All of these are
required by AGENTS.md for a change touching schema and the deploy pipeline
(which this is) and none were in the checklist.

**Done when (revised):**
1. Run the new same-tenant regression smoke test from §6.1 against a real
   database (proves an ordinary family's ordinary worksheet approval still
   works with the flag off) — do this **before** touching any real
   database, staging or production.
2. Rename the migration to a current timestamp.
3. Confirm `HOMA_SUBJECT_LESSONS_ENABLED` defaults off.
4. Commit, push, open the PR, and **confirm the PR's actual CI run is
   green** (not just local commands) — including the isolation job (SLM-11).
5. Merge, then watch the production Vercel deployment reach READY.
6. Only then apply the migration to production.
7. Probe the live site (report pages, `/eve/v1/subject-lesson/health` or
   equivalent).

## 3. Sequencing

SLM-6 and SLM-8 have no dependencies and can happen anytime, but re-derive
both against current `main` first (§0, §5) — they are no longer the
"anytime, mechanical" tickets they were originally scoped as. SLM-1 must
land before SLM-2 (family-context's pinning branch needs the unified
channel helper, and SLM-1 now includes the `resolveAgentAccess` async
unification, which several other tickets' test fixes depend on). SLM-5 and
SLM-7 can happen in parallel with SLM-1/2/3/4 — different files, no shared
symbols, though SLM-9's `wall-copy.ts` spot-check is contingent on SLM-6.
SLM-4 depends on nothing else, but its `render-page.ts` dependency should be
checked against whatever SLM-9 does there. **SLM-9's `artifact-store.ts`
work is no longer "runs last, checking SLM-1's output" — it needs its own
resolution as described in SLM-9 directly, independent of SLM-1's timing.**
SLM-10 gates on all of SLM-1 through SLM-9, **and requires re-running §0's
merge simulation fresh immediately before starting** — do not execute
against this document's transcriptions of what conflicts look like. SLM-11
gates on SLM-10, with its isolation-check bullet actually satisfied by
SLM-12's push + CI, not a pre-push local run. SLM-12 gates on SLM-11 and
carries its own new pre-database smoke test (§6.1) before touching any real
database.

## 4. Explicitly out of scope for this merge

Per the founder's 2026-07-16 retention-bridge ruling already recorded in
`.superpowers/sdd/recovery-progress.md`: weekly-planner integration, a
"Complete" action, and the deep-dive redirect were deliberately not
rebuilt and are **not** part of this merge either.

**Review amendment (validated, severity high) — this section's own request
to "confirm nothing shipped on main has quietly made one of these newly
load-bearing" was answered by the review, and the answer is yes, in one
concrete case: see §6.2.** `WelcomeChooser` (report-lock's post-payment
subject chooser) is not literally "the planner," "Complete," or "the
deep-dive redirect" — but it reintroduces the exact per-subject "Homa
builds the four-week plan" flow those rulings retired, through a code path
this spec's original tickets treated as a JSX wrapper to preserve rather
than content to reconcile. Curriculum-studio/agent-jobs was also checked
and does **not** need a similar fix — its plan/job-completion vocabulary is
fully contained in its own contract system and never touches `child_plans`,
`MONTH_PLAN_SUBJECT`, or the report's per-subject action; SLM-1 and SLM-3
already cover its only real overlaps with subject lessons.

## 5. Open risk this document does not resolve

- Confirm the exact PR/plan filename for report lock before citing it
  elsewhere (written from memory in earlier drafts).
- **Re-run the drift check before every execution step, not just once**:
  `git log --oneline $(git merge-base feat/subject-lessons origin/main)..origin/main | wc -l`
  moved from 95 to 97 to 100 during this single review cycle. The specific
  file/hunk list for SLM-1 through SLM-9 was re-checked against each new
  commit as it landed and, aside from PR #29 (already folded in above),
  nothing else in the drift touched a tracked file — but that has to be
  re-verified again at execution time, not assumed to still hold.

## 6. Findings that don't belong to a single ticket

### 6.1 The migration will break today's production material-approval flow if it leads the code deploy

`supabase/migrations/20260715210000_subject_lessons.sql` does far more than
add a dormant table. It drops and recreates the "members read/add/update
their materials" RLS policies on `public.materials` — used by **every**
family today, not just subject-lesson users — and adds a `BEFORE UPDATE`
trigger, `enforce_material_status_write_boundary`, that raises `42501`
whenever an `authenticated`-role update of `status`/`approved_at`/
`subject_lesson_id` didn't go through a new RPC, `finalize_family_material`
(also new in this migration, ~250 lines of PL/pgSQL, unlike anything else
in the repo's migration history). This trigger is **unconditional** — it
fires for every family's material row, not just lesson materials, and
Postgres has no concept of `HOMA_SUBJECT_LESSONS_ENABLED`; that flag only
gates application code, not what the migration does to the schema.

Today's `main`, unmodified: `finalizeMaterialCaller` in
`apps/web/lib/materials/library.ts` — the code path every browser/web-channel
parent approval already runs through — does a **plain, direct**
`.update({status:"final", approved_at:...})` with the user's own JWT. No RPC
involved. The subject-lessons branch's version of this same function
replaces that with `db.rpc("finalize_family_material", ...)`, with a
graceful legacy fallback for the *reverse* ordering gap (code-before-
migration) — proving the original authors were aware ordering matters, but
only in one direction.

**Net effect: if this migration is applied to production before the
RPC-aware code is live and READY, every family's "approve a worksheet"
action breaks fleet-wide with a Postgres error**, the moment the migration
lands, independent of the feature flag. This is a production incident of
the same shape AGENTS.md cites for the 2026-07-10 outage — and unlike that
one, it wouldn't even crash loudly: `finalizeMaterialCaller`'s existing
error handling returns a soft failure note echoing the raw Postgres error,
not a 5xx, so it might not trigger alerting immediately.

None of the isolation probes (SLM-7) test this — they check cross-tenant
leakage, not whether an *ordinary* family's *ordinary* (non-lesson)
functionality still works after the schema change. That's a different,
narrower, and completely unaddressed question.

**Required before SLM-12 touches any real database:** a live-Postgres smoke
test proving an ordinary, non-subject-lesson family can still create,
finalize, and supersede a material end-to-end through
`finalize_family_material`, with `HOMA_SUBJECT_LESSONS_ENABLED` off — not a
mocked RPC response. And the production deploy order must be
**code-READY, then migration** for this specific migration, stated
explicitly rather than inherited from AGENTS.md's generic "additive
migrations may lead" allowance, which does not hold here.

### 6.2 Report-lock's `WelcomeChooser` reintroduces the exact flow this feature retired — decided: swap

**Founder decision, 2026-07-18: swap the "Build the 4-week plan" option for
the "Build lesson" option, full stop.** Not a coexistence question, not
gated behind a separate opinion — when subject lessons are on, this is the
per-subject action, everywhere, including `WelcomeChooser`.

`apps/web/app/app/[childId]/report/welcome-chooser.tsx` (main, commit
`e771f7c`, 2026-07-18) renders whenever a freshly-unlocked family lands on
their report with `?welcome=1`. It builds one row per mapped/scored subject
and links each to `/onboarding/r/[token]/plan/[subjectId]` with copy "Homa
builds the four-week plan." This is precisely the per-subject planner
action the 2026-07-15 founder ruling replaced with the lesson button, and
that the 2026-07-16 retention-bridge ruling reaffirmed as out of scope
("Do not restore planner").

Confirmed the report body itself does the right thing —
`subjectLessonsEnabled ? <SubjectLessonButton/> : <DoorLink>Build the
4-week plan</DoorLink>` — but `WelcomeChooser` is a separate component,
gated on nothing subject-lesson-related, never routed through `ReportView`
at all. Once both features are flagged on, a family that just paid would
see a modal whose only buttons say "build the four-week plan" per subject,
immediately above a report body offering "build lesson" for the same
subjects — two contradictory default next-actions for the same subject,
from two features that don't know about each other, with the more
prominent one (shown right after payment) pointing at the flow this
feature was built to retire.

**Decided and specified in SLM-5**: gate `WelcomeChooser`'s links on
`subjectLessonsEnabled` and swap them to the lesson build/open flow
(the same `SubjectLessonButton`-driven action the report body uses, not a
second implementation) when the flag is on; reconcile its subject-
eligibility filter with `viewerActions.lesson`'s (computed independently
today, not guaranteed to agree — this has to converge for the swap to be
consistent).

### 6.3 What "live" verification actually means in this environment

`scripts/isolation-check.mjs` requires a real, persistent, network-reachable
Supabase project and real secrets (`apps/web/.env.local`) — it is not a
disposable local Postgres, and this environment's isolated worktrees
structurally cannot run it (confirmed by direct probe; matches the original
recovered branch's own notes). The check that actually runs it, with real
secrets, unconditionally, on every push, is CI's "Tenancy isolation smoke
check" job. SLM-7's and SLM-11's "done when" bullets have been reworded
throughout this document to point at that job rather than demand an
impossible local pre-push run — treat a green CI isolation job on the
opened PR as the actual gate, not a local rerun of the same script.
