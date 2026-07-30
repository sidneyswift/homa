# Handoff: Mobile nav-parity rebuild ("boil the ocean")

> **Status: NOT FINISHED — see Handoff Status below**
> As of: 2026-07-30. Handed off from: Claude Code on Anthropic API (Sonnet 5). Reason: session wrap-up / handoff requested by the user mid-arc.

## 1. Goal / Spec

*(Stable. Do not rewrite on later handoffs of this same task — carry it forward verbatim unless the goal itself genuinely changed.)*

### Objective

Replace every `ComingSoonScreen` stub in the Homa mobile app's drawer nav with a real, working screen, so mobile reaches nav parity with web's app shell. The user's own framing across the arc: "continue building the mobile app," and later, when scoping the Planner screen, "We are going to merge calander and planner into one. it will be a planner tab, that has a daily, weekly, and monthly view like a calander. give it full read/write functionality." Web's nav has 7 items; mobile should match:

1. Chat (already existed before this arc)
2. Progress
3. Planner (absorbs what was a separate Calendar item — see below)
4. Hours
5. Binder
6. Tasks

Each screen should read (and, where the user specified, write) the same live Supabase-backed data web renders, not a mock or a placeholder. Where a screen's scope was ambiguous or safety-relevant, the driving session asked the user directly (via a structured choice) rather than guessing, and built to the user's explicit answer:

- **Progress**: user chose "Show everything, no lock" over any paywall/report-lock gating. This was later independently confirmed correct (not just expedient): mobile and web share one `accountAccessDecision()` entitlement function, so there is no separate mobile paywall logic to reconcile.
- **Planner**: user explicitly directed merging the separate Planner and Calendar nav items into one Planner tab with day/week/month views and full read/write, including check-off state.
- **Tasks**: user explicitly chose **"Full read/write"** over a read-only option, which is why this screen (uniquely among the five) requires new backend API routes, not just a mobile UI port — several of the underlying Postgres tables (`agent_schedules`, in particular) have no client write policies, so `agent_schedules`' writes on web itself already go through server actions calling a privileged connection, not RLS.

### Definition of done

- No `ComingSoonScreen` stub remains for Progress, Planner, Hours, Binder, or Tasks.
- Each screen renders real family data (verified live against production data via Supabase MCP or the iOS Simulator wherever practical, not just against synthetic fixtures).
- Each screen has write functionality exactly where the user specified it (Planner: full check-off + event read/write; Tasks: full read/write including create/edit/delete/pause/run-now/feedback; Progress: read-only by design).
- Every change shipped through the established per-feature workflow (see Constraints below) and merged only after the user's own explicit go-ahead in that same turn.

### Constraints / non-negotiables

- **No em dash, ever, anywhere** — code comments, UI copy, docs, commit messages. `pnpm check:em-dash` (`node scripts/em-dash-check.mjs`) is a zero-tolerance CI gate; it has already caught real violations mid-arc (see Gotchas).
- **One fresh branch per feature, off `origin/main`** (stash-and-recheckout if the worktree is dirty), never stacking unrelated features on one branch.
- **Full verification before every commit**: typecheck, lint, em-dash check, and — for anything the Simulator can exercise — a live check in the iOS Simulator, ideally against real production family data rather than synthetic fixtures.
- **PR workflow, always**: push the branch, open a PR with a Summary + Test plan body, watch CI to completion, then **stop and ask the user explicitly before merging**. Never merge autonomously unless the user says so in that same turn. (This has held for every PR in this arc, including the one just merged.)
- **Tenant isolation is non-negotiable**: `familyId` never comes from client input or a model; every tool/route/query re-scopes it from the authenticated caller (`resolveApiFamily` on the web side, RLS or a privileged `mapDb()` connection underneath). Run `pnpm check:isolation` before any schema/query change — but note new API routes that only call *existing*, already-tenant-safe functions do not need a new isolation test (no new query surface).
- **Port, don't reinvent**: this arc's method throughout has been to find web's existing view-model functions, copy constants, and Postgres query shapes, and port them into mobile as directly as possible (down to reusing exact voice-reviewed copy strings), rather than re-deriving business logic or wording from scratch.
- **Design tokens are hand-copied, not shared**: `apps/mobile/src/theme/tokens.ts` duplicates web's design tokens (per AGENTS.md, until `packages/design` lands under M1-17). Do not cross-import between not-yet-merged feature branches' own local copies of small shared modules (e.g., `kid-tone.ts`) — each branch must build independently off `origin/main`, so duplicate small shared files rather than importing across sibling branches that haven't merged yet.

## 2. Handoff Status

*(Point-in-time snapshot. Rewrite fresh at every handoff — this is the part that goes stale.)*

### Done — in scope, complete

- **Tasks screen, backend read/create groundwork** — [PR #472](https://github.com/sidneyswift/homa/pull/472), **MERGED to `main`** at commit `c2a21fb1` (2026-07-30, squash merge). Adds `GET /api/tasks` (returns the same view models `/app/tasks/page.tsx` builds: scheduled tasks, run history, `textingLinked`, `timeZone`, `briefFlagOn`) and `POST /api/tasks` (create a custom task), both bearer-authed via `resolveApiFamily`. Also extracts the run-now dispatch call out of the web server action into `apps/web/lib/tasks/run-now.ts` so a future mobile run-now route can reuse it instead of duplicating it. Verified: `pnpm --filter web typecheck`, `pnpm --filter web lint`, `node scripts/em-dash-check.mjs`, and a full `pnpm --filter web build` all clean; CI (`build-and-check`, `mobile-checks`, Vercel deploy) all green before merge.

### Remaining — required, in scope

1. **Merge decision needed from the user on four already-built, already-verified PRs.** These were built and CI-verified earlier in this arc but never explicitly approved for merge (the workflow requires the user's own go-ahead per PR, in the same turn):
   - [PR #441](https://github.com/sidneyswift/homa/pull/441) — Progress screen. Branch `claude/mobile-progress-screen`. OPEN, mergeable, CI green.
   - [PR #458](https://github.com/sidneyswift/homa/pull/458) — Planner+Calendar merged screen (day/week/month, full read/write, atomic check-off RPC). Branch `claude/mobile-planner-surface`. OPEN, mergeable. CI: `build-and-check` and `mobile-checks` green; the `evals` job is **failing**, but this was confirmed to be pre-existing, repo-wide flakiness unrelated to this PR (verified by checking that plain pushes to `main` and unrelated PRs were failing the same job around the same time) — not something to fix or bypass from within this PR; the merge-despite-red-evals decision is the user's to make.
   - [PR #464](https://github.com/sidneyswift/homa/pull/464) — Hours screen. Branch `claude/mobile-hours-screen`. OPEN, CI fully green.
   - [PR #467](https://github.com/sidneyswift/homa/pull/467) — Binder screen. Branch `claude/mobile-binder-screen`. OPEN, CI fully green.

   **Do not re-verify these from scratch unless something looks stale** — re-check `gh pr checks <n>` for current CI state (a lot of time may have passed) before presenting them to the user for a merge decision, but the underlying work has already been through the full verification workflow once.

2. **Finish the Tasks screen itself.** Only the read/create backend groundwork (PR #472) is done. Still needed, in order:
   - **Backend write routes** (thin wrappers around already-tenant-safe functions in `apps/web/lib/tasks/custom.ts` and `apps/web/lib/tasks/research-brief-feedback-server.ts` — do not reimplement their logic):
     - `apps/web/app/api/tasks/[taskId]/route.ts` — `PATCH` (full custom-task edit via `updateCustomTask`) and `DELETE` (via `deleteCustomTask`).
     - `apps/web/app/api/tasks/[taskId]/schedule/route.ts` — `POST` (schedule-only edit valid for any kind, via `updateTaskSchedule`).
     - `apps/web/app/api/tasks/[taskId]/pause/route.ts` — `POST` with body `{paused: boolean}`, via `setTaskPaused`.
     - `apps/web/app/api/tasks/[taskId]/run-now/route.ts` — `POST`, calls the already-merged `runTaskNow(taskId, familyId)` from `apps/web/lib/tasks/run-now.ts`.
     - `apps/web/app/api/tasks/feedback/route.ts` — `POST` with body `{taskRunId, signal}`, validated with `z.uuid()` and `isResearchBriefFeedbackSignal` (`apps/web/lib/tasks/research-brief-feedback.ts`), then `recordResearchBriefFeedback`.
     - Follow the exact conventions of the already-merged `apps/web/app/api/tasks/route.ts`: `resolveApiFamily(request)` for auth, `{ok:true, ...}` / `{ok:false, reason}` JSON shape, dynamic params as `{ params }: { params: Promise<{ taskId: string }> }` (see `apps/web/app/api/lessons/[lessonId]/route.ts` for the exact async-params pattern this Next version uses).
   - **Mobile data layer**: `apps/mobile/src/lib/tasks.ts`, mirroring `apps/mobile/src/lib/billing.ts`'s exact bearer-token fetch pattern (`supabase.auth.getSession()` for the token, `EVE_CHANNEL_HEADER`, "null on any failure" for reads, `{ok, reason?}` for writes).
   - **Mobile UI**: a new `apps/mobile/src/features/tasks/` directory (task cards, an edit sheet distinguishing built-in vs. custom tasks, a day-grouped run-history feed with Helpful/Not-for-us feedback controls, a data hook) and a rewrite of `apps/mobile/src/app/(tabs)/tasks.tsx` replacing its current `ComingSoonScreen` stub. Detailed per-file guidance (which web file each mobile file should port from, function by function) is preserved in this session's own final message before this handoff — if that message isn't available to you, re-derive it by reading `apps/web/app/app/tasks/{tasks-view.tsx,task-history.tsx,task-edit-overlay.tsx,task-form.tsx,task-copy.ts}` and `apps/web/lib/tasks/research-brief-feedback-contract.ts`, and by looking at how `apps/mobile/src/features/binder/` or `apps/mobile/src/features/hours/` are structured as the closest existing precedent (data hook + model file + card components + a screen file).

### Remaining — nice to have, not required

- Agent-job "in progress" build cards on the Tasks screen (the curriculum-build steering UI: approve/pause/resume/cancel). Deliberately out of scope: web's own approve-UI for this isn't live yet either, so there is nothing stable to port. If it ever becomes required, it is gated behind `agentJobsEnabled()` and lives in `apps/web/app/app/tasks/{agent-job-card.tsx,agent-job-overlay.tsx,agent-job-view.ts}`.
- Filing an actual GitHub issue for the Tasks-screen remaining work. Per `AGENTS.md`'s "GitHub Issues live tracker" convention, all open work should be tracked on `sidneyswift/homa` Issues, but this whole mobile arc has so far been tracked only via in-session task lists, not filed issues. Worth doing, not required to finish the code.

### In production now (live)

- `GET`/`POST /api/tasks` (web routes from PR #472) are live in the production Vercel deployment as of the merge (2026-07-30) — merging to `main` auto-deploys web. However, **no mobile client code calls these routes yet** (the mobile data layer doesn't exist), so this has zero live user-facing effect so far; it's dormant, tested infrastructure.
- Nothing else from this arc is live for real families yet. Note the distinction that matters for mobile specifically: merging a *web* PR to `main` deploys immediately via Vercel, but merging a *mobile* PR does not put it in front of any real user — the mobile app additionally needs a new build (EAS build + App Store review, or an OTA update if the change qualifies) on its own separate cadence. As of the last mobile App Store release noted elsewhere (build 6, 2026-07-28), none of the five screens in this arc existed yet.

### Merged — not yet deployed/live

- (None beyond the above — for this repo, merged web code deploys automatically.)

### Still in the works (unmerged / in progress / local only)

- PRs #441, #458, #464, #467 (see "Remaining — required" above) — fully built, CI-checked at least once, awaiting the user's merge decision.
- Tasks screen write routes + mobile data layer + mobile UI — not started; no branch created for this yet. When starting, branch fresh off `origin/main` as e.g. `claude/mobile-tasks-writes` (do not reuse `claude/mobile-tasks-screen` — its one PR is merged and its remote branch already deleted; the local worktree still has it checked out but that's just a leftover local ref, not a place to keep committing).

### Known gotchas / landmines

- **iOS Simulator touch dead-zone**: the *last* item in certain vertical/horizontal tap-target lists (segmented controls, chip rows, drawer nav rows) reproducibly fails to receive simulated taps in the Simulator, regardless of coordinate precision or whether the list is `.map()`-generated or static JSX. This was diagnosed exhaustively more than once this arc and is a pre-existing Simulator/tooling limitation, not an app bug. Work around it for verification using `mcp__Claude_Code_iOS_Simulator__control`'s `open_url` action with a `homa://<route>` deep link to navigate directly, instead of re-diagnosing it.
- **`react-hooks/set-state-in-effect` lint rule**: never call `setState` synchronously inside a `useEffect` body. Fix by wrapping in `setTimeout(() => {...}, 0)` (for data-loading effects) or by computing the derived value directly at render time instead of storing it via effect+state.
- **"Cannot call impure function during render"** for bare `Date.now()`/`new Date()` in a render body: use `const [nowMs] = useState(() => Date.now())` (a lazy initializer) — **not** `useMemo`, whose callback still runs during render and still gets flagged. An unmemoized `const now = new Date()` is also acceptable (only produces a non-blocking "unnecessary dependency" warning).
- **`react/no-children-prop`**: never name a prop `children` (e.g., a list of child records) — it collides with React's reserved prop. Use something like `kids` instead.
- **`gh pr merge --squash --delete-branch` can fail locally** with `fatal: 'main' is already used by worktree at '<other-worktree-path>'` when another local worktree has `main` checked out. This is a **local branch-delete cleanup failure only** — the merge itself succeeds server-side. Always confirm via `gh pr view <n> --json state,mergedAt` before assuming the merge failed, then clean up manually with `git push origin --delete <branch>` if needed. Do not try to force-checkout `main` in a worktree that isn't allowed to hold it.
- **`agent_schedules` and `homa_task_runs` both have "members read their..." SELECT-only RLS policies** — reads can go straight through `resolveApiFamily`'s RLS-scoped Supabase client (already done in the merged GET route); only writes need `lib/tasks/custom.ts`'s privileged `mapDb()` connection, because these tables have no client write policies on purpose.
- **`family_phones` is deny-all RLS everywhere** — only a server-side `mapDb()` connection (`getFamilyPhones`) can read it. The merged GET route already surfaces this as a plain `textingLinked` boolean, so the mobile client never needs its own access to that table.
- **Cross-branch import trap**: importing a small shared module from a sibling feature branch that hasn't merged yet (e.g., Hours importing Planner's `kid-tone.ts`) breaks typecheck on whichever branch doesn't yet have the other's code, because each branch is built fresh off `origin/main`. When two independent, not-yet-merged branches need the same small helper, duplicate it rather than cross-import; converge later once one side has merged.
- **A green `pnpm build` is not a green deploy** for this app: Vercel also runs `eve build` separately (compiles agent tool modules outside Next's bundler). This specifically matters for changes under `apps/web/agent/` — none of the Tasks-screen work touches that directory, so it wasn't triggered here, but it will matter again if a future change does.

## 3. Pointers

- Repo: `sidneyswift/homa` (this worktree: `/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-chat-onboarding-testing-10c9c1`)
- Branches:
  - `claude/mobile-progress-screen` (PR #441, open)
  - `claude/mobile-planner-surface` (PR #458, open)
  - `claude/mobile-hours-screen` (PR #464, open)
  - `claude/mobile-binder-screen` (PR #467, open)
  - `claude/mobile-tasks-screen` (PR #472, merged into `main` at `c2a21fb1`; local ref is now stale/redundant, safe to delete)
- Relevant PRs: [#441](https://github.com/sidneyswift/homa/pull/441), [#458](https://github.com/sidneyswift/homa/pull/458), [#464](https://github.com/sidneyswift/homa/pull/464), [#467](https://github.com/sidneyswift/homa/pull/467), [#472](https://github.com/sidneyswift/homa/pull/472) (merged)
- Relevant issues: none filed yet for this arc (see "nice to have" above)
- Key files touched so far, by screen:
  - Progress (#441): `apps/mobile/src/app/(tabs)/progress.tsx`, `apps/mobile/src/features/progress/*`, `apps/mobile/src/lib/child-progress.ts`
  - Planner (#458): `apps/mobile/src/app/(tabs)/planner.tsx`, `apps/mobile/src/features/planner/*`, `apps/mobile/src/features/nav/nav-items.tsx`, `apps/mobile/src/lib/{family-events,plan-schedule,child-plans}.ts`, `supabase/migrations/20260729160000_toggle_plan_activity_check.sql`, `scripts/isolation-check.mjs`
  - Hours (#464): `apps/mobile/src/app/(tabs)/hours.tsx`, `apps/mobile/src/features/hours/*`, `apps/mobile/src/lib/hours.ts`
  - Binder (#467): `apps/mobile/src/app/(tabs)/binder.tsx`, `apps/mobile/src/features/binder/*`, `apps/mobile/src/lib/materials.ts`
  - Tasks (#472, merged): `apps/web/app/api/tasks/route.ts`, `apps/web/lib/tasks/run-now.ts`, `apps/web/app/app/tasks/actions.ts` (refactored, not rewritten)
  - Tasks, still to build: `apps/web/app/api/tasks/[taskId]/*`, `apps/web/app/api/tasks/feedback/route.ts`, `apps/mobile/src/lib/tasks.ts`, `apps/mobile/src/features/tasks/*`, `apps/mobile/src/app/(tabs)/tasks.tsx`
