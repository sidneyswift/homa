# Report 04: PRD, founder rulings, pricing, ICP, and design law for the iOS launch

Reader scope: docs/homa-planning/13-mr-prd.md, 02-user-journeys.md, 12-roadmap-okrs.md,
journeys/10-reconciliation.md §5, plans/2026-07-20-mobile-parity-and-beyond.md,
plans/2026-07-27-planner-calendar-ecosystem.md (mobile sections), 14-marketing-demand-engine.md,
docs/homa-design/readme.md, DESIGN.md, journeys/01-personas-jtbd.md, build-log 2026-07-28 entries,
and GitHub issues #263, #293, #295, #297. All paths relative to repo root
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-chat-onboarding-testing-10c9c1`.

Authority chain (CLAUDE.md "When unsure"): explicit founder rulings > PRD > journey docs > judgment.
The canonical ruling index is `docs/homa-planning/journeys/10-reconciliation.md` §5. The PRD
(13-mr-prd.md) is the approved 2026-07-03 baseline as amended by that registry; 02-user-journeys.md
and 12-roadmap-okrs.md are explicitly historical and do not establish current flow or pricing.

## 1. Ruling and constraint register (binding on a mobile iOS launch)

### 1.1 Brand, copy, and voice (App Store listing, screenshots, in-app copy)

| Constraint | Detail | Source |
|---|---|---|
| Brand casing | The name is always typed "Homa", never "HOMA", anywhere (UI, headings, buttons, emails, App Store copy). The logo is the logo: render the real `Logo` component (mobile copy: `apps/mobile/src/components/brand/logo.tsx`), never hand-typed imitation. Retires global D8's old split. | `brand-casing-homa` 2026-07-28, 10-reconciliation.md:128 and D8 row :106; DESIGN.md:107 |
| No em dash, ever | Hard rule in all copy, code, docs, commits. Use comma, period, colon, or mid-dot. | CLAUDE.md; docs/homa-design/readme.md:51; DESIGN.md:109 |
| Clarity over personality | Clarity and low cognitive load beat personality; cutting meaning-bearing words is not an improvement. Rulebook: `.agents/skills/homa-copy-writer/SKILL.md`; gate important copy with homa-copy-reviewer then homa-copy-editor. | `copy-clarity` 2026-07-08, 10-reconciliation.md:133 |
| Anti-guilt display law | No red, no "behind", ever, on any child surface. Growth-only visual language. Never compare siblings (eval-enforced process law). Danger color is warm coral-red for real errors only. | 13-mr-prd.md:123-126 (FR-7); 10-reconciliation.md:74-75 (process laws 2, 3); readme.md:35; DESIGN.md:110 |
| Temporal, never causal | Efficacy claims may show a dated change ("reading is up since the letter-sounds set") but never claim Homa caused it. Applies to copy, notes, and marketing. | Process law 5, 10-reconciliation.md:78; 13-mr-prd.md:128-132 |
| Banned claims | "First/only AI homeschool assistant" claims are BANNED in all copy (C3). Fabricated social proof never ships; bracketed placeholders stay bracketed until real (C2). Memory extension: no paying-customer testimonials/ratings/counts ever until real (homa-paywall-claims-laws). | 10-reconciliation.md:18-19 (C1-C3); DESIGN.md:111 |
| Parent-facing vocabulary | Data-point counts say "answers" (never "questions answered"); "observations" reserved for formal artifacts. Paywall/report surfaces say "report" or "progress", never "map". Parent-facing noun is "ability"; "skill" reserved for agent skills. | `answers-vocabulary` :158; `paywall-naming-and-price` :165; `abilities-map-v1` :173 |
| Nav labels | App nav tabs read "Chat", "Progress", "Planner", "Tasks" (nav only; page titles keep fuller names). | `nav-labels-simplified` :146 + `nav-chat-label` :150 |
| Voice/promise | The promise, said everywhere: "You've got this. Homa's got the rest." Tagline: "Homeschooling, made calm." Sentence case; reassure-before-inform; offers never commands; emoji rare, max one per message. | docs/homa-design/readme.md:25-29, 43-52 |
| Stale doc caution | 14-marketing-demand-engine.md §15.4 (line 392) still says "HOMA in the wordmark and on UI surfaces": superseded by `brand-casing-homa`. Do not copy that line into new work. | 14-marketing-demand-engine.md:392 vs 10-reconciliation.md:128 |

### 1.2 Onboarding

| Constraint | Detail | Source |
|---|---|---|
| Open signup | Signup is open, no invite codes, "as easy as possible to sign up, no hoops". | `open-signup` 2026-07-05, 10-reconciliation.md:124; 13-mr-prd.md:59-62 |
| One onboarding for every door | Onboarding step 1 performs full signup; signup, sign-in, and family setup use one onboarding path. `/onboarding` is the canonical public route (`/map` redirects). The mobile parity plan lists the onboarding funnel as never ported: mobile deep-links to web for onboarding (founder call 2026-07-08). | `onboarding-full-signup` :132; `public-onboarding-route` :125; mobile plan §4 (2026-07-20-mobile-parity-and-beyond.md:113-118) |
| ONE WORLD | Onboarding writes directly to family product data; no lead tables/mirrors. | `onboarding-one-world` :131 |
| Depth fork | Parent may choose quick path or longer graph-first assessment. No "3-minute" duration guarantee without timed evidence. | `onboarding-depth` :143; 13-mr-prd.md:19 |
| Full birthdays | Store month, day, and year product-wide. | `full-birthday` :145 |
| Chat-first onboarding is live | Merged to prod 2026-07-24 (PR #139); 7 onboarding tools bounded. First-making artifact moment shipped 07-23 (start_first_making, morphing promise card). | memory: chat-first-onboarding, onboarding-artifact-moment |
| Sign-in methods | Email or Google/Apple (FR-1). Mobile release build fb45d812 already carries SIWA + Google (memory: mobile-app-store-release). | 13-mr-prd.md:79-85 |

### 1.3 Paywall, pricing, billing

| Constraint | Detail | Source |
|---|---|---|
| Prices (sticker v1) | Homa $19/mo or $99/yr. Upper tier is Homa Plus (renamed from Homa Pro) $49/mo or $249/yr. Annual pricing may begin at first conversion. Allotments and revisions derive from 60 days of measured margin data (T2). | `pricing-2026-07-06`, 10-reconciliation.md:129; 13-mr-prd.md:172-176; T2 :115 |
| Third tier | Homa Max, $199/mo (`plan_tier` value `elite`), live and purchasable on /onboarding/trial as of 2026-07-28. $19 = planning, $49 = state filing, $199 = "the most Homa can do". | gh#293, gh#295, gh#297 |
| Trial shape | T1: card upfront + UNCAPPED power-user experience; abuse guardrails invisible; post-conversion never degrades below trial feel; trial token cost treated as CAC. Signup paywall (card-upfront 7-day gate) flipped ON 2026-07-28 with `HOMA_SIGNUP_PAYWALL_SINCE` grandfathering (new signups only). Day-4 trial reminder ships with it (PR #273). | T1, 10-reconciliation.md:114; build-log.md:36-96 (2026-07-28 entry) |
| Unlimited children | Every plan includes unlimited children; tiers differ by usage allotment, never family size. "We never charge for your kids" is positioning ammunition. | D9, 10-reconciliation.md:107 |
| Flat fair-use, meter internal | No visible pricing meter/credits (D2); premium items may be visibly priced. | D2, 10-reconciliation.md:100 |
| Report lock | Walled families see 4 subjects free (math, literacy, science, social-emotional), remainder behind the $19 membership offer; public sample and founder mirror never lock. Supersedes "the report remains free" for walled families while the flag is up. Kill test armed through 2026-08-01. | `report-lock-four-open` :164; memory: wall-report-lock-live |
| $19-monthly-only flip | The flip starts $19 monthly only; annual Payment Link env stays unset until the $99 sticker's Homeschool Fox collision (T3) gets a founder read; a missing annual link is a narrower offer, never fail-open. | `paywall-naming-and-price` :165 |
| gh#293 (P1, founder-decision, OPEN) | Homa Max has no enforced differentiator: `plan_tier` written at checkout, read nowhere that meters output. 10-persona panel: 10/10 did not know what a "making" was; 8/10 read "no waiting" as proof $19 is throttled. Interim copy: "The most Homa can do for one family." Guard test `wall-copy.test.ts` blocks metering claims nothing enforces. Founder must: ship the allowance, reword as forward-looking, or pull Max from the signup gate. | gh#293 |
| gh#295 (P2, founder-decision, OPEN) | The three tiers are non-alignable (three different bundles, not points on one axis); no copy edit fixes it. Acceptance: one axis in the same slot/unit on every tier, or a decision they are deliberately different products. Depends on #293. | gh#295 |
| gh#297 (P1, production, OPEN) | Founder ruling 2026-07-28: sell-then-build. Both paid tiers stay on the page; each gets built when someone buys (Plus = build that family's state filing on a paid clock; Max = curriculum-studio exists but no unprompted trigger). Needs a named owner, checkout alert on `plus`/`elite`, and a purchase-time timing expectation. Largest cohort is Texas (5 families, no filing required); realistic first Plus buyers: FL, VA, DC, NC. | gh#297 |
| Claims near the button | ROSCA + California ARL put charge terms in visual proximity to the pay button; trial reminder is a billing notice (no unsubscribe headers, fails closed). | build-log.md 2026-07-28 entry; memory: homa-paywall-claims-laws |
| iOS payment gap (PM flag, not a ruling) | Every pricing doc assumes Stripe web checkout (Payment Link / /onboarding/trial). No planning doc addresses Apple IAP or the reader-app/external-purchase question for the iOS build. This is an unowned decision for an App Store launch. | absence across 13-mr-prd.md, 10-reconciliation.md §5, gh#293/295/297 |

### 1.4 Mobile-specific rulings and facts

| Constraint | Detail | Source |
|---|---|---|
| Mobile parity plan D1-D6 (proposal 2026-07-20, brief) | D1: adopt renderable-descriptor contract (render by `kind`, not tool name) and pick its home; the load-bearing decision. D2: which surfaces earn native screens v1 (proposal: tasks + progress only). D3: camera capture as first native investment (capture-to-chat vs also binder). D4: approve push as a channel (policy: which nudges, quiet hours, SMS fallback). D5: whether `packages/design` (M1-17) must land before new screens or hand-copied tokens stay acceptable. D6: whether Android stays explicitly deferred (updates publish iOS-only today). Founder decisions still open per memory (mobile-parity-plan). | plans/2026-07-20-mobile-parity-and-beyond.md:135-156 |
| Ground truth (07-20, worsened since) | Mobile has 3 screens (home, chat, family) vs 12 web routes; renders 3 tool outputs; everything else falls through to silence. By 07-27 the count is 3 of 61 tool names. JS ships OTA via EAS Update; camera/push/share-sheet need store builds. | mobile plan §1; gh#263 |
| Live mobile bug | Mobile authenticates as channel "web", so `open_planner` tells the model "the planner is open beside the chat" while mobile renders nothing: fabricated-UI class, live (gh#256/#196). | 2026-07-27-planner-calendar-ecosystem.md:169-175 |
| Q-F ruling (2026-07-27) | Full native planner parity pulled into the one-planner arc at P1 (gh#263). Preconditions: per-toggle check-off op (gh#259) before native writes; #196 D1 render contract ruled at arc B; stable-ID trigger review before native writes (store-lagged clients hold days-old snapshots). | `one-planner-arc` Q-F, 10-reconciliation.md:183; planner plan :612-617 |
| gh#263 (P1) acceptance | Versioned board JSON route (caller JWT + RLS, unknown kinds degrade to generic card); native Today/board screen; check-off writes only via the arc-C op; `/app/planner` stays out of associated-domains claims until the native screen routes it; stated refresh contract. | gh#263 |
| Phone-native capabilities beyond parity | Camera capture of finished work (photo tools already live server-side), push notifications (channel doctrine: token table keyed to authenticated family mapping + consent UX), native share/print for printables, share-sheet ingest. Web = sit-down surface, mobile = in-the-moment surface. | mobile plan §3:86-111 |
| Never ported | /admin, /blog, marketing pages, onboarding funnel, /join. Web by deep link. | mobile plan §4:113-118 |
| PWA is a product commitment on web | MJ-04 PWA shell + add-to-home-screen in the wow script; OKR O1 KR3: add-to-home-screen ≥60% of families. An App Store app changes this calculus; no ruling yet reconciles PWA-install vs app-install. | 10-reconciliation.md:37; 12-roadmap-okrs.md:87 |
| Choice cards | `ask_user_questions` (up to 4 tappable options) exists on web surfaces only, gated structurally by channel via defineDynamic; SMS stays one question at a time. Mobile rides the "web" channel today. | `choice-card-web-only` :170 |
| Chat privacy | Chats are per-adult on every channel; all other family state shared. Any native chat surface must respect this. | `chat-privacy-per-adult` :149 |
| Push/notification policy inputs | Only the account owner is auto-subscribed to scheduled task texts; invited adults opt in themselves (`task-recipient-scoping` :147). Friday letter defaults to the reporting adult only (`letter-recipient` :179). Anti-guilt ratio law: re-engagement response ≥20% and unsubs <1%/mo or sends stop (process law 4, :77). Banned mechanics: streaks, leaderboards, cross-family or sibling comparison, variable-ratio rewards, points economies, mastery decay, inactivity nudges, per-demonstration push (`abilities-map-v1` :173). These constrain any iOS push/gamification design. | as cited |
| No child-facing anything | Product is parent-facing; no child accounts, no child-facing AI chat, no child-facing view of the abilities map (deliberately off the roadmap). One exception: parent-printed certificates (`certificate-wording` :176). Directly relevant to App Store age rating and Kids Category decisions. | 13-mr-prd.md:17, :57-59; `abilities-map-v1` :173 |
| Face recognition | Banned permanently. D4 photo-personalization requires dedicated consent screen, no-training DPAs, TTL on raw photos. Lesson audio: 30-day TTL, no voice identification (`lesson-listen-child-audio` :155; `keep-their-voice` :174). These are App Store privacy-label and review-note facts. | 13-mr-prd.md:58-59, :107-114; 10-reconciliation.md:102 |
| Record export | A family can download the full record free, indefinitely, including after cancellation; nothing sealed. | `record-export` :178 |

### 1.5 Platform/process laws that bind the mobile build

- Tenant isolation: `familyId` never from model or client; every model-supplied ID re-scoped; browser/mobile sessions use caller JWT with RLS (13-mr-prd.md:152-160; CLAUDE.md).
- No feature merges without its events (typed registry, MJ-08) (10-reconciliation.md:70-72).
- Prod bugs fixed, not stored: a live bug found during launch work gets fixed and verified in-session or plainly escalated (`prod-bugs-fixed-not-stored` :156).
- GitHub Issues is the single live tracker (founder directive 2026-07-25; CLAUDE.md).
- Design tokens are hand-copied into `apps/mobile/src/theme/tokens.ts` and `apps/mobile/src/components/brand/logo.tsx` until `packages/design` (M1-17) lands; token changes must update those copies and DESIGN.md front matter (CLAUDE.md § Design system; mobile plan §1.6).
- The July 13, 2026 conference deadline is past; per `one-planner-arc` (:183, closing note) no deadline-based scope argument stands until a current runway is named.

## 2. ICP definition

Canonical brand statement (docs/homa-design/readme.md:19-29): the homeschooling mom,
"teacher, planner, principal, and parent at once. She isn't short on tools. She's short on
bandwidth and reassurance." Constant quiet fear: "Am I doing enough? Are my kids behind? Am I
enough?" Often isolated, measuring herself against picture-perfect homeschool Instagram.
The emotional job: move her from overwhelmed and unsure to calm and confident. Promise:
"You've got this. Homa's got the rest." Tagline: "Homeschooling, made calm."

Persona structure (journeys/01-personas-jtbd.md, historical hypothesis set, one real interview):
- P1 Alessa (origin archetype): one preschooler, urban tech-adjacent, enrichment-driven, wants ahead-of-standards validation, voice-notes habit, scrutinizes subscriptions.
- P1-P5 cast cited by the PRD (13-mr-prd.md:64-69); median family 2-3 kids ages 5-12 [COUNCIL].
- Age ICP: global D3 "boil the ocean", full age range is the ambition; proven core is ages 2-7; 8-12 track must pass the same citation rigor before fronting families (10-reconciliation.md:101; 12-roadmap-okrs.md:114-115).
- Philosophy spectrum drives presentation (01-personas-jtbd.md §1 table): Classical, Charlotte Mason, Unschooling, Eclectic (the plurality), Religious (deepest AI skepticism), School-at-home (newcomer default). Homa's mechanic is philosophy-agnostic in principle, philosophy-charged in presentation.
- Marketing personas for gating copy (14-marketing-demand-engine.md:246-254): blog-reader (the searching mom, typed a worry into Google at 10pm), shortform-viewer (the scrolling mom, 2 seconds to earn the next 2), pinner (the planner, saving for next semester), waitlist-subscriber.

Positioning/differentiation (usable in App Store copy within the claims laws):
longitudinal per-child profile + efficacy attribution (temporal framing) + test-for-the-mother
benchmarks + brand (C3, 10-reconciliation.md:19). Category separation from Homeschool Fox is
strategy, not just copy: Fox = chat + dashboards + scheduling at $99/yr; Homa = always-on agent;
never compete on their price axis; make the difference felt (T3, :116). Sell the $29-adjacent
tier on the efficacy loop, never records/transcripts (C1, :17).

## 3. Pricing facts (consolidated)

- Homa (base): $19/mo or $99/yr (`pricing-2026-07-06`; supersedes $29 placeholder). Live flip is $19 monthly only; annual withheld pending the Fox $99/yr collision read (`paywall-naming-and-price`).
- Homa Plus: $49/mo or $249/yr (renamed from Homa Pro). Positioned as state filing. Not built; sell-then-build per gh#297.
- Homa Max: $199/mo, `plan_tier` `elite`. No enforced differentiator (gh#293); capability (curriculum-studio 36-week builds) exists on request only (gh#297).
- Trial: card upfront, uncapped (T1); 7-day signup paywall gate live since 2026-07-28, new signups only (SINCE grandfathering); Day-4 reminder; no time-based expiry (reconciliation design in #274).
- Unlimited children on every plan (D9). Flat fair-use, internal meter (D2). Allotments derived from 60-day margin data (T2). Report lock: 4 subjects free, rest behind $19 (report-lock-four-open), kill test scored by 2026-08-01.
- Score the funnel on visitors-to-paid, not signups (memory: signup-paywall).

## 4. Core value loops, priority order

Derived from the vision sentence (12-roadmap-okrs.md:14-19: knows each child → makes materials →
proves the work moved the numbers → does the state paperwork → connects lessons to her world),
the FR ordering (13-mr-prd.md), and the OKRs:

1. **Onboarding wow** (FR-2, O1): chat-first onboarding to a first personalized artifact; KR: ≤10 min for ≥80% of new families. The make-or-break journey (02-user-journeys.md J1). Mobile currently deep-links out for this entirely.
2. **Chat + materials, the visible daily value** (FR-4, FR-5; J2, J3): streaming mobile-first chat, voice notes routed with confirmation chips + undo; personalized print-ready materials reading `what_works`; generation-status streaming (45-120s wait named the #1 funnel risk, 13-mr-prd.md:110); print/share is where the wow dies (MJ-01).
3. **Ambient capture → progress proof** (FR-6, FR-9; J2): journal, hours, observations feed the signal ladder (progress-signal-capture-v2); the system visibly gets smarter, "that's the moment she renews" (02-user-journeys.md:47-48). Surfaced as agent-led live Progress (`agent-led-live-progress` :141) and the abilities map (celebration surface for the parent, `abilities-map-v1`).
4. **Compliance/hours, the conference-mom ask** (FR-6; J4): ambient hour accrual, never a timesheet; per-state targets; portfolio-proactive reminders allowed (`portfolio-proactive` :177); state filing is the Homa Plus promise (gh#297).
5. **Weekly efficacy/celebration loop, the moat** (FR-8; J5): Friday letter per child to the reporting adult, named-worry rail once a month, WLF ≥70% and an efficacy before/after by week 4 (O2).
6. **Planner** (one-planner arc): Today/this-week checkable register default, week grid one toggle away; reshuffle skill; mobile native board is gh#263 at P1. Adoption baseline is zero real families (memory: calendar-planner-shipped), so this is a bet, not a proven loop.
7. **Morning brief** (D-ht rulings, `morning-research-brief-v2`): retention beat; investigation found it is two products (warm 25% fatiguing, cold 2.6% dormant).

Phone-native leverage on loops 2-4 (mobile plan §3): camera capture feeds loop 3 evidence, push
carries loops 5-7, share/print serves loop 2, share-sheet ingest feeds curriculum/reference intake.

## 5. Gaps a PM should carry into the App Store plan

1. No planning doc reconciles Stripe-web billing with Apple IAP policy for a native iOS app; #293/#295/#297 all assume web checkout.
2. PWA add-to-home-screen is still an OKR (O1 KR3) and MJ-04 commitment; no ruling positions the native app against it.
3. Mobile parity D1-D6 remain unruled (proposal status), while Q-F of `one-planner-arc` already pulled native planner parity to P1: the render-contract ruling (D1/#196) is the critical path both plans share.
4. The live fabricated-panel bug (mobile as channel "web") is a `prod-bugs-fixed-not-stored` class exposure for any launch-adjacent session that reproduces it on device (gh#256).
5. MJ-20 (degraded mode/offline shell) is GA-tier backlog, relevant to App Store review resilience expectations, unscheduled.
6. Age rating / privacy labels have strong doc support: parent-facing only, no child accounts, face recognition banned, photo consent + TTL (D4), lesson audio 30-day TTL, per-adult chat privacy, record export free forever.
