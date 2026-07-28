# Web product surface map (for mobile scope selection)

Reader 02. Repo root: `/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-chat-onboarding-testing-10c9c1`. All paths below are relative to `apps/web/` unless absolute. Line numbers cite the worktree state at HEAD (branch claude/homa-ios-product-planning-470a45).

## 1. Route list (parent-facing, with file paths)

Public / marketing:

| Route | File | What it is |
|---|---|---|
| `/` | `app/page.tsx` | Marketing landing (Hero, HowThread, Features, sample-report proof, FAQ, signup popup). Pure static marketing components, JSON-LD, answer capsule "$19 a month". |
| `/blog`, `/blog/[slug]` | `app/blog/` | Marketing blog + RSS. |
| `/privacy`, `/terms` | `app/privacy/`, `app/terms/` | Legal. |
| `/world`, `/world-real`, `/world-v3`, `/world-v4` | `app/world*/` | Experimental scroll-scrubbed landing variants (not the primary funnel). |
| `/homa.vcf` | `app/homa.vcf/route.ts` | Contact card download. |
| `/signin` | `app/signin/page.tsx` | Sign-in ONLY (no create-account tab: new families go to /onboarding). Email/password server action + "Continue with Google" via `supabase.auth.signInWithOAuth` (`app/signin/signin-form.tsx:33`). `?next=` returns user after auth. |
| `/join` | `app/join/page.tsx` | Co-parent invite consumption. Signed out: shows inviter + SignInForm with `next=/join?t=...`; signed in: consumes token server-side, refuses logins that already own a family. |
| `/auth/callback` | `app/auth/callback/route.ts` | OAuth redirect target. |
| `/onboarding/method` | `app/onboarding/method/page.tsx` | "How the report is made" explainer. |
| `/onboarding/sample` | `app/onboarding/sample/page.tsx` | Public sample report (shares ReportView). |
| `/onboarding/r/[token]` | `app/onboarding/r/[token]/page.tsx` | The tokenized progress report, permanent URL, `force-dynamic`. Sub-pages: `/evidence` (print-first evidence pack, zero model calls), `/one-pager` (90-second summary), `/plan/[subjectId]`, `/lesson/[subjectId]` (subject lessons). |

Signup + onboarding:

| Route | File | What it is |
|---|---|---|
| `/onboarding` | `app/onboarding/page.tsx` | THE single signup + setup flow ("one onboarding for every door", founder 2026-07-08). Server page decides: signup-paywall disposition (`signupPaywallDisposition`, page.tsx:64), chat-first props (`loadChatProps`, page.tsx:78), then renders `OnboardingShell` -> `MapFlow`. |
| `/onboarding/trial` | `app/onboarding/trial/page.tsx` | The signup trial gate (HOMA_SIGNUP_PAYWALL_ENABLED, ON in prod since 2026-07-28). Card-upfront 7-day trial, 3 tiers via Stripe Payment Links (`components/billing/trial-gate.tsx`, `tier-options.tsx`). Server-decided every visit; /app and /onboarding both funnel walled accounts here. |

Signed-in app (all under `/app`, gated by `proxy.ts` (Next 16 middleware) requiring a Supabase session; every page ALSO calls `getAppData()` and redirects to /onboarding when setup is unfinished or the signup paywall holds the account):

| Route | File | Sidebar tab? |
|---|---|---|
| `/app` | `app/app/page.tsx` -> `chat-client.tsx` | Chat (default landing) |
| `/app/progress` | `app/app/progress/page.tsx` | Progress (redirects to focused/first child) |
| `/app/[childId]/progress` | `app/app/[childId]/progress/page.tsx` | (child progress, live hierarchy behind HOMA_LIVE_PROGRESS_ENABLED) |
| `/app/[childId]/report` | `app/app/[childId]/report/page.tsx` | (legacy in-app report; the flag-off rollback path; renders report-lock offer) |
| `/app/[childId]/firsts` | `app/app/[childId]/firsts/page.tsx` | (page of firsts, from evidence ledger) |
| `/app/planner` | `app/app/planner/page.tsx` -> `planner-view.tsx`, `day-grid.tsx` | Planner |
| `/app/calendar` | `app/app/calendar/page.tsx` -> `calendar-view.tsx` | Calendar (CG-03, live since 2026-07-27; week grid + drag; being merged with planner per one-planner spec PR #255) |
| `/app/hours` | `app/app/hours/page.tsx` -> `hours-view.tsx` | Hours (hours_log reader, CG-02) |
| `/app/binder` | `app/app/binder/page.tsx` -> `binder-view.tsx`, `material-detail-overlay.tsx` | Binder (final materials only, 300-row cap) |
| `/app/tasks` | `app/app/tasks/page.tsx` -> `tasks-view.tsx` | Tasks (Homa's scheduled tasks + agent jobs behind HOMA_AGENT_JOBS_ENABLED) |
| `/app/settings` | `app/app/settings/page.tsx` | Not a tab: via account menu. One family card: details, kids (editable profiles + photos), parents (invites, phones, own photos), homeschool section, memories card, billing portal link, sign out. |
| `/app/kids/[childId]` | `app/app/kids/[childId]/page.tsx` -> `kid-view.tsx` | Kid profile corner (recent wins, curricula). Reached from kid pills, not sidebar. |
| `/app/lessons/[lessonId]` | `app/app/lessons/[lessonId]/page.tsx` | Lesson review (lesson-listen pipeline: summary, moments, progress writes, transcript). Flag `lessonListenEnabled`. |
| `/app/[childId]/lessons/record` | `app/app/[childId]/lessons/record/page.tsx` | Lesson recording door. Wall-gated for signups after LESSON_RECORD_WALL_SINCE_MS (founder ruling 2026-07-27). |

Sidebar source of truth: `components/dashboard/sidebar-nav.tsx:27` `APP_NAV_ITEMS` = Chat, Progress, Planner, Calendar, Hours, Binder, Tasks (7 tabs). Frame: `components/dashboard/shell.tsx` (desktop floating sidebar; phone = MobileNav h-14 top bar + drawer; kid context switcher top right writes the VIEW_CONTEXT cookie that scopes Planner/Calendar/Hours/Binder and tells the agent who is in focus).

## 2. Signup flow (exact sequence)

1. `/onboarding` opens a silent anonymous session (httpOnly resume cookie), then **ParentStep** (`app/onboarding/parent-step.tsx`): email + password or "Sign up with Google". Creates the real Supabase Auth account immediately (`/api/map/claim`; Google links on return via `/api/map/state`). Benchmark logos (Common Core, NGSS, IES) render here.
2. **Signup paywall** (ON in prod since 2026-07-28): the moment the account exists, client forwards to `/onboarding/trial`; a returning walled account is server-redirected there before render (`app/onboarding/page.tsx:70`). Nothing (questionnaire, report, chat) exists for a new family before a card starts the 7-day trial. Tiers via Stripe Payment Links, annual = 20% off, no metering claims.
3. After the gate: **chat-first onboarding** (behind HOMA_CHAT_ONBOARDING; merged to prod 2026-07-24, PR #139). `loadChatProps` runs `beginOnboarding` (durable record), then renders **ChatStep** (`app/onboarding/chat-step.tsx`) which is literally `/app`'s ChatClient full-screen with an `onboarding` prop: same storage key `homa-chat-${userId}`, same transcript, so "finishing onboarding" is just the URL changing. The legacy card flow (FamilyStep, KidsStep, HubStep, ChecklistStep, DeepDiveStep, ExtrasStep, ScoringStep in `map-flow.tsx`) remains the flag-off path and the resume path for pre-flag families.
4. Onboarding agent side: `agent/instructions/onboarding-mode.ts` preloads the full onboarding skill body (generated mirror of `agent/skills/onboarding/SKILL.md`) into instructions per turn, no load_skill round trip. The skill's sitting-one arc: opening line pre-carried, setup cards (family_basics -> homeschool_profile chained by the APP with no model turn), roster of every child, one child's checklist docked in-chat (ChecklistTakeover), report by minute 12, first making (`start_first_making`) as the artifact moment.
5. Completion: `resolveOnboardingCompletion` + `appWouldAdmit` route finished families to `/app` (`app/onboarding/page.tsx:93-121`). `completeOnboarding` happy-path latch is issue #238 (30 families were stuck latched; backfilled).

## 3. Paywall / gates (three layered systems, all in `lib/billing/wall.ts`)

- **Signup paywall** `signupPaywallEnabled()` (wall.ts:58): card before any product, `/onboarding/trial`, supersedes "report free forever" for new families. `getAppData()` returns null for walled accounts so every /app page redirects (lib/app-data.ts:43-50 comment).
- **Door wall** `wallEnabled()` (wall.ts:26): for pre-paywall families, first ACTION (first chat message, plan build, curriculum call) opens `WallModal` (`components/billing/wall-modal.tsx`), dismissable by law; viewing existing content stays open. ChatClient receives `wall` prop and beacons wall_viewed/dismissed.
- **Report lock** `reportLockEnabled()` (wall.ts:38): four free subjects render, rest held behind `ReportLockOffer` inline in the report (`components/billing/report-lock-offer.tsx`). Kill test armed through 2026-08-01.
- Checkout = Stripe **Payment Links** (env-inlined per tier, wall.ts:63-102) + `/api/billing/confirm` + `/api/billing/portal` + webhook. There is no in-app purchase flow of any kind; **an iOS native port that surfaces any of these gates hits App Store guideline 3.1.1 (digital content must use IAP)**: this is the single biggest App Store launch decision hiding in this surface map.

## 4. The chat surface (the product's front door and the mobile port's core)

`app/app/chat-client.tsx` (2,288 lines, "use client") + `message-parts.tsx` (1,116 lines) + ~30 satellite modules. Key mechanics a native port must reproduce (docblock chat-client.tsx:120-190):

- `useEveAgent` (eve/react) against same-origin eve routes, Supabase access token as bearer per request (chat-client.tsx:643-649). NDJSON streaming with resumable replay from streamIndex; `patches/eve@0.19.0.patch` broadens iOS Safari "Load failed" socket deaths into reconnects.
- One continuous thread with day separators; model session rotates at first visit after 4am local (`chat-storage.ts`); localStorage is the render cache; Postgres `conversation_messages` is durable (read server-side via `fetchChatHistory`, caller-JWT RLS, `lib/chat-history.ts:17`).
- Never-stuck triad: composer never dead (Stop + queued Send), visibility-change stall abort, silent-stream watchdog; lost-turn recovery (`turn-recovery.ts`); session-fork guard folding `recovering` into the busy queue gate (`chat-send-policy.ts`); per-message sending/failed + retry (message-parts.tsx:476-485).
- Composer extras: attachments + camera (`chat-attachments.tsx`, uploads via `/api/chat/upload` + `/api/chat/attachments`), dictation (`dictation.tsx`, `/api/chat/dictation`), slash-skill menu (`slash-composer.tsx`, skills listed from repo), prompt-suggestion rail (`prompt-suggestion-*.ts`, `/api/chat/suggestions`, web-only by design), hidden directives (app-sent user messages that must not render, `lib/onboarding/directives.ts`), kickoff directive for onboarding first turn (`onboarding-chat.ts`).
- Status: `busyLabel` escalating generic labels + per-tool labels + materials build-phase narration (message-parts.tsx:898-1108); `WorkedForLine` fold-out of tool steps (worked-for.tsx).

## 5. The ~23 tool renderers in web chat (exact tool names)

Rich cards (11 tool names):

| Tool | Renderer | Where parsed |
|---|---|---|
| `create_printable` | MaterialCard | `material-message-parts.ts:36` |
| `show_material` | MaterialCard | same |
| `create_worksheet` (legacy) | MaterialCard | same |
| `manage_child_progress` | ProgressUpdateChip / ProgressQuestionCard / ProgressConflictCard / workflow pill (4 item kinds) | `progress-message-parts.ts:219` |
| `ask_for_photo` | SnapCard (add photos / type instead) | `snap-card.tsx:30` |
| `ask_user_questions` | QuestionCard (stepped multi-question choice card, web-only multi-question by ruling) | `question-card.tsx:75` |
| `open_planner` | PlannerCard + PlannerCanvasPanel (in-chat canvas; plan writes via `edit_plan`) | `planner-canvas.tsx:40` |
| `start_checklist` | ChecklistCard invite + ChecklistTakeover docked in composer slot | `onboarding-cards.tsx:101`, `checklist-takeover.tsx` |
| `score_child_report` | ReportRevealCard | `onboarding-cards.tsx:280`, `report-reveal-card.tsx` |
| `start_first_making` | FirstMakingCard (morphing promise -> material) | `onboarding-cards.tsx:361` |
| `ask_for_details` | DetailCard, kinds `family_basics` / `child` / `homeschool_profile`; SELF-SAVING: posts to `/api/onboarding/*` routes, never a model turn; one input per question (founder rule 2026-07-22) | `detail-card.tsx:49` |

Receipt chips (`memoryChipFor`, message-parts.tsx:94-197), 12 tool names: `remember`, `forget`, `update_child_profile`, `save_skill`, `forget_skill` (both dormant tools, chips harmless), `mark_material_final`, `edit_plan`, `log_hours`, `schedule_plan_activity`, `add_family_event`, `update_family_event`, `remove_family_event`.

Structural rules a port must copy or transcripts corrupt: `ENDS_THE_TURN = {ask_for_details, start_checklist}` suppresses all text after the call (message-parts.tsx:276); duplicate-text dedupe within a message; stage-direction/narrated-pause stripping (`assistant-text.ts`); hidden-directive suppression; docked-card suppression (card renders in composer slot, transcript renders null, message-parts.tsx:562-585); one-active-card rule (only the newest unanswered card is interactive). Also `workedForSteps` maps ~29 tools to plain-word steps with a generic fallback (worked-for.tsx:46-77) and `TOOL_STATUS_LABELS` maps ~31 tools to busy labels (message-parts.tsx:898-933). Total tool surface: 62 files in `agent/tools/`; everything unmapped falls back safely (generic step, no card), so mobile's minimum viable set is the 11 cards + 12 chips, with the two ENDS_THE_TURN tools being correctness-critical, not cosmetic.

## 6. Per-surface port assessment (data source, server dependence, difficulty)

Pattern: nearly every /app page is an RSC that calls `getAppData()` (React cache per request, `lib/app-data.ts`) and page-specific reads, ALL under caller-JWT RLS (`createSupabaseServerClient`), then hands plain props to a "use client" view component. That means a native app can usually read the same tables directly via Supabase RLS and reuse the view logic conceptually; the RSC layer is thin gating + assembly, not bespoke API.

| Surface | Data | Next-only deps | Native port difficulty |
|---|---|---|---|
| Chat `/app` | eve agent HTTP endpoints (bearer = Supabase JWT); scrollback from `conversation_messages` (RLS); localStorage cache | eve/react hook, NDJSON streaming, the eve@0.19.0 patch behaviors | HARD. The whole never-stuck/fork/recovery/queue stack plus 23 renderers plus docked-card composer choreography. Mobile parity plan (2026-07-20) already suspects planner tools render as silence in mobile chat. This is 70%+ of the product's use. |
| Onboarding | Same chat surface + `/api/map/*` (state, claim, answer, score...) + `/api/onboarding/*` for detail-card saves + `/onboarding/trial` Stripe links | Server-side paywall disposition + redirects | HARD, and gated by the IAP question. Checklist takeover reuses the card-flow ChecklistStep with local question planning (`@homa/core` bank). Detail cards post to bespoke routes, small stable JSON APIs. |
| Progress `/app/[childId]/progress` | ChildProgress ledger + view via server libs (RLS), flags: liveProgress, lessonListen; wall route policy | RSC-only assembly; heavy view components in `components/progress/` | MEDIUM. Reads are RLS tables; flag logic and route-policy must be mirrored. Legacy report path doubles the work until live progress is confirmed on. |
| Report (token) | `getReportByToken`, public by token, plus narrative beat (model call server-side) | Server rendering + narrative generation | LOW for viewing (it is a URL; a webview or share-sheet works); porting natively is optional early. |
| Planner + Calendar | `plans` via getAppData; `family_events`, `plan_activity_schedule`, `hours_log` (all RLS reads); writes via server actions (`app/app/calendar/actions.ts`) and chat tools | Server actions; drag-drop DOM wiring | MEDIUM. Note the one-planner consolidation (issues #256-#265) is actively merging these two; porting today means porting a moving target. Mobile fabricated-panel bug #256 is live. |
| Hours | `hours_log` RLS read (`lib/hours.ts:37`), entry overlay writes via server action | none real | EASY. |
| Binder | `family_materials` final-only via `findMaterialsCaller` (RLS), PDFs in Blob via `/api/materials/[id]/pdf` | none real | EASY-MEDIUM (PDF/print rendering). |
| Tasks | `homa_task_runs`, `agent_jobs`, `agent_job_stages` under RLS; writes via server actions; `family_phones` is DENY-ALL so the "Text me" wording needs a server endpoint (`app/app/tasks/page.tsx:28-32`) | server actions, one deny-all table | MEDIUM. |
| Settings | family/members/memories/invites via RLS + server actions; billing portal `/api/billing/portal`; avatar uploads | server actions; Stripe portal is a web URL | MEDIUM; portal link is another 3.1.1 exposure on iOS. |
| Kid profile | wins + curricula (RLS) | none | EASY. |
| Lessons record/review | `/api/lessons/*` routes (upload, status, segments, finish, audio, media) + flags + wall gate | Bespoke API surface, MediaRecorder on web | MEDIUM-HARD; already API-shaped so native audio capture may fit well. |
| Sign in / join | Supabase auth (password + Google OAuth); mobile app already ships SIWA + Google (App Store build fb45d812) | /auth/callback redirect | Mostly done on mobile; /join invite consumption needs a deep link + one server call. |

Cross-cutting facts for the PM:

- Auth gate is structural: `proxy.ts` gates only `/app*`; eve routes do their own auth (`proxy.ts:71-76` matcher excludes `eve`, `api/map`, `api/sync`).
- View-context (family vs one kid) is a cookie today (`lib/view-context.ts`); the agent reads it per turn. Native needs an equivalent channel-side signal.
- Prompt suggestions are explicitly web-only; SMS/email/mobile excluded (`apps/web/README.md` Webchat prompt suggestions section). A deliberate scope-cut precedent exists.
- The onboarding chat and app chat being ONE surface (`chat-step.tsx` renders ChatClient) means a mobile chat port automatically gets most of onboarding IF the 11 cards + kickoff/hidden-directive/docking mechanics are ported, and the trial gate question is answered.
- Flags that decide what a family actually sees in prod right now: HOMA_SIGNUP_PAYWALL_ENABLED (on), HOMA_WALL_ENABLED + report lock (on since 2026-07-18), HOMA_CHAT_ONBOARDING (on since 2026-07-24), HOMA_AGENT_JOBS_ENABLED (on), lessonListen (fleet-wide since 2026-07-21), liveProgress (verify before scoping progress port). Turbo strict-env trap applies to all of them (turbo.json must declare env).
