# Journey Workstream Reconciliation — Senior PM pass (2026-07-02)

> Mixed lifecycle record. Sections 1 through 4 and section 6 preserve the
> 2026-07-02 capstone reconciliation. Section 5 is the current canonical
> founder-policy index, including later dated rulings. The registry establishes
> policy, not implementation or deployment.

> All nine workstreams delivered (~7,900 lines, docs 01–09). This pass: cross-doc
> conflicts adjudicated, new tickets renumbered into the global backlog namespace,
> process laws ratified, and the founder decision queue consolidated. Capstone
> deliverables (OKRs/roadmap + M-R PRD) follow after Sidney clears the decision queue.

## 1. Cross-document conflict register (adjudicated)

| # | Conflict | Ruling |
|---|---|---|
| C1 | **Design-kit pricing** ($9/$19/$39 in `docs/homa-design/ui_kits/landing`) vs plan pricing ($29/$49) vs **ArborSlate at exactly $29/mo** (competitive teardown correction) | Plan pricing stands pending open call #2; landing kit is a visual spec, not a pricing decision — MUST be re-copied before any public page ships. The ArborSlate collision means the $29 tier cannot be sold on price-adjacent features (records/transcripts); it must be sold on the efficacy loop. Positioning doc already frames this correctly. **[Superseded 2026-07-06, build-log: pricing v1 set by founder, Homa $19/mo or $99/yr, Homa Pro $49/mo. The sell-on-efficacy guidance stands.]** |
| C2 | **Fabricated social proof** in the landing kit ("2,000 families…") | Never ships. Working-backwards PR brackets ([X] families) stay bracketed until real. Added to M4-07 acceptance criteria. |
| C3 | **Homeschool Fox already ships an AI assistant at $12/mo** — the product brief's "nobody has a persistent agent" line is stale | Product brief corrected (see §4). Differentiation narrows to: longitudinal profile + efficacy attribution + test-for-the-mother benchmarks + brand. "First AI homeschool assistant" claims are BANNED in all copy. |
| C4 | **M1-08 (transactional email) deferred post-revenue** but the week-one drip, journal prompt, and weekly note all require it in M-R week 5–6 | M1-08 pulled INTO M-R weeks 3–4 (minimal: Resend + 4 templates). The M-R table in 03-backlog updated. |
| C5 | **BenchmarksView sketch** uses Grade-3 subject framing; v1 asset is 15 domains, ages 2–7 | Domain framing wins for v1 (it's what the data supports); design flag filed to re-skin the view. Interacts with open call #3 (age ICP). |
| C6 | **DiscoverView "hold tickets" overpromise** | v1 links out; no ticket-holding. Copy rule added. "4 HOMA families nearby" card belongs to M5-09 (post-traction), not M3-12 — removed from GA scope. |
| C7 | **Planner/Dashboard sketches are single-child** | Multi-child lanes required (P2 is the median); design flag filed, M1-17 acceptance criteria updated. |
| C8 | **"HOMA" vs "Homa" casing** — design law says wordmark-only all-caps, but the brand promise itself uses HOMA in running copy | Ruling: wordmark + UI surfaces = HOMA; long-form prose = Homa. Copy kit annotated. (Overridable by Sidney.) |
| C9 | **NT numbering collision** — workstreams 02/04/05 each minted their own NT-1..N | Renumbered into global MJ-series below. Journey docs keep local IDs; the mapping table is authoritative. |

## 2. Journey-derived tickets — global renumbering (MJ-series)

Full descriptions live in the origin docs; this table is the backlog-facing index.
[M-R] items are additions to the revenue-first track; everything else queues behind revenue.

| Global ID | Origin | Ticket | Tier | Size |
|---|---|---|---|---|
| MJ-01 ⛔ | 04·NT-01 | Print pipeline & preflight (letter+A4, shrink-safe, reprint, AirPrint help, email-to-self) — the wow dies at the printer | [M-R] | M |
| MJ-02 ⛔ | 04·NT-03 | Routing confirmation + atomic undo UI + family-scoped router few-shot store | [M-R] | M |
| MJ-03 ⛔ | 05·NT-1 | Crisis boundary playbook: companion-not-therapist rules, vetted resources, distress-data firewall (no retention use, ever) | [M-R] | M |
| MJ-04 ⛔ | 02·NT-2 | PWA shell + add-to-home-screen in the wow script | [M-R] | S |
| MJ-05 ⛔ | 02·NT-4 | Week-one drip scheduler mechanics (rows, skip/catch-up, per-persona timing) | [M-R] | M |
| MJ-06 ⛔ | 02·NT-8 | Generation status streaming + retry/escalation (45–120s wait is the #1 funnel risk) | [M-R] | M |
| MJ-07 ⛔ | 04·NT-05 | Out-of-range child handling: signup screening, honest boundary copy, feature matrix per age | [M-R] | M |
| MJ-08 ⛔ | 06·M1-18 | Typed `emitEvent()` registry + CI "no feature merges without its events" | [M-R] | S |
| MJ-09 ⛔ | 02·NT-1 | Invite/waitlist service (codes, personal share links, channel-variant landing bands incl. 02·NT-7) | [M-R] | M |
| MJ-10 ⛔ | 05·NT-10 | Support SLA definition (P0 same-day; published honestly) | [M-R] | S |
| MJ-11 ⛔ | 04·NT-02 | Feedback reason capture → structured what_works + regenerate-with-fix | [M-R] | S |
| MJ-12 ⛔ | 05·NT-2 | Claim dispute & correction flow (chat-based v1; same-day propagation; `profile_revisions` link) | [M-R] | M |
| MJ-13 ⛔ | 05·NT-5 | Sensitive-context law (health/diagnosis info: never in artifacts unasked, never deficit-framed, analytics-excluded) | [M-R] | M |
| MJ-14 ⛔ | 06·M1-19 | Founder dashboard v0 (12 tiles + 5 wake-up alerts) | [M-R] | M |
| MJ-15 | 04·NT-04 | Benchmarks check-in surface (checklist flow, standing cards, dispute path; domain framing per C5) | [GA] | L |
| MJ-16 | 04·NT-06 | Shared-activity fan-out (one capture → N children, per-route rules) | [GA] | S |
| MJ-17 | 04·NT-07 | Constraints store (chat-accreted, settings-editable; feeds planner + discover) | [GA] | M |
| MJ-18 | 04·NT-08 | Replan flow ("we did none of it" Monday, zero-guilt) | [GA] | M |
| MJ-19 | 04·NT-09 | Planner binder/print view (shares MJ-01 pipeline) | [GA] | S |
| MJ-20 | 05·NT-3 | Degraded mode + offline shell (cached plan, agent-less library, queued capture) | [GA] | L |
| MJ-21 | 05·NT-4 | Multi-adult roles (partner/helper scopes, journal private-by-default) | [GA] | L |
| MJ-22 | 05·NT-6 | Age-out graduation pack ("Homa Transcript" for registrars — word-of-mouth artifact) | [GA] | M |
| MJ-23 | 05·NT-7 | State-move flow (requirement diff, hours recompute, letter draft) | [GA] | S |
| MJ-24 | 05·NT-8 | Status page + incident comms kit (templates drafted during M-R — cheap and priceless) | [GA] | M |
| MJ-25 | 05·NT-9 | Artifact sharing license + PDF footer | [GA] | S |
| MJ-26 | 05·NT-11 | Progress-vs-self benchmark frame (per-child setting for atypical development) | [GA] | M |
| MJ-27 | 05·NT-12 | Quiet mode / life-pause (proactive on drop signals; warm re-entry) + 06·M2-16 summer mode — MERGED | [GA] | M |
| MJ-28 | 05·NT-13 | Compliance discrepancy report + rule-correction blast-radius query | [GA] | M |
| MJ-29 | 06·M3-14 | Referral instrumentation (the GA acquisition strategy currently has no ticket) | [GA] | S |
| MJ-30 | 02·NT-6 | Programmatic SEO state pages (start content M-R, ship GA) | [GA] | M |
| MJ-31 | 04·NT-10 | Discover consent + frequency governance (metro-only, caps, mutes, self-throttle) | [POST-GA] | M |
| MJ-32 | 04·NT-11 | Shareable proof card (privacy-safe before/after export) | [POST-GA] | S |
| MJ-33 | 04·NT-12 | Compliance evidence locker (immutable filed archive, provenance viewer, TTL-exempt) | [GA; manual M-R] | M |

## 3. Process laws ratified (senior PM)

1. **No feature merges without its events** (06) — CI-enforced via MJ-08, mirroring the
   no-unpriced-actions law (M1-13).
2. **Sibling-comparison ban** (04) — the agent never compares siblings' positions;
   eval-enforced (add case to `evals/`).
3. **Distress-data firewall** (05) — flagged exchanges never feed re-engagement,
   win-back, or analytics beyond a count.
4. **Anti-guilt ratio law** (06) — re-engagement response ≥20% and unsubscribes <1%/mo
   or sends stop fleet-wide.
5. **Temporal, never causal** efficacy claims (07) — copy + weekly-note templates + evals.
6. **"First/only AI homeschool assistant" claims banned** (08 correction, C3).

## 4. Corrections applied to earlier docs

- 00-product-brief: competitor paragraph corrected (Homeschool Fox AI assistant @$12/mo
  exists; ArborSlate @$29). Differentiation restated per C3.
- 03-backlog: M-R table gains M1-08 (email, minimal) in weeks 3–4 and the MJ [M-R] set;
  MJ index appended.
- M0-07 replaced by the 09 conference-kit spec (Mom-Test protocol + capture sheet).

## 5. Founder decision registry

This section is the canonical index for founder policy. The original D-series and T-series tables preserve the 2026-07-03 decision session. Later explicit rulings enter the authority chain through the dated-source register below. The register does not claim that a ruling is implemented or deployed.

References must qualify colliding labels as global D3 age range, global D8 casing, lead-magnet D3 workspace timing, or lead-magnet-D8-report-prose.

### Original consolidated decision queue

| # | Decision | Status (2026-07-03 session) | Blocks |
|---|---|---|---|
| D1 | Auto top-up default | ✅ **DECIDED: grace-buffer compromise** — never blocks, one-tap prompt, explicit opt-in silent auto top-up | M1-12 build |
| D2 | Pricing model: visible credits vs flat fair-use plans | ✅ **DECIDED: flat fair-use** — meter is internal-only; premium items (picture books) visibly priced; see T1/T2 below | Trial design, landing copy, M1-12/13 |
| D3 | Age-range ICP | ✅ **DECIDED (2026-07-03): "boil the ocean" — full age range is the ambition.** 8–12 benchmarks/questionnaire/materials built in parallel by agents (M5-06 pulled forward), marketing age-inclusive; MJ-07 honesty covers only the gap window. Physics note held: cohort starts on the proven 2–7 core; new tracks need the same citation-backed benchmark rigor before they front families | MJ-07 copy, landing, conference pitch |
| D4 | Child voice & likeness | ✅ **DECIDED (2026-07-03): day one, done "startup right."** Photo-personalized magic (child's photos → picture books/art) ships with cohort one — it's core to the felt difference (home Homa proof). Non-negotiable floor shipping WITH it: dedicated consent screen (separate from signup), executed no-training/no-retention DPAs with image providers, short TTL on raw photos, and NO face-recognition features ever. Build-the-plane applies to polish, not to these four | M0-04, M2-05, M4-04 |
| D5 | Crisis posture | ✅ **DECIDED: companion-not-therapist** — warm human response, vetted resources surfaced when severe, never a retention play, distress-data firewall; not a mandated reporter, written tripwire to revisit at 500 families | MJ-03, before first invite |
| D6 | Sensitive-data (health/diagnosis) handling | ✅ **DECIDED: keep + sensitive-flag** — improves personalization; never in shareable artifacts unasked, never deficit-framed, analytics-excluded, standard journal TTL | MJ-13, M4-12 |
| D7 | Artifact sharing | ✅ **DECIDED: share freely** — every PDF footer: "made with Homa for [child]"; sharing IS the marketing | MJ-25, ToS |
| D8 | Casing | ✅ **DECIDED: split** — HOMA in wordmark/UI surfaces, Homa in prose/conversation | Copy kit |
| D9 | Children → pricing | ✅ **DECIDED: unlimited children on every plan.** Tiers differ by monthly usage allotment (internal credits), never family size. Overflow → add credits or auto-bump to next tier for that month (no hard caps, no degraded month-two). "We never charge for your kids" is positioning ammunition | Plans, MJ-07 |
| D10 | "Hegg" curriculum naming (04 ❓ — is it Heggerty?) | ⏳ ASK ALESSA (only remaining open item in the queue) | packages/core port |

### New founder decisions from the 2026-07-03 session (T-series)

| # | Decision |
|---|---|
| T1 | **Trial = card upfront + UNCAPPED power-user experience** (overrides council's no-card trial). Rationale: Alessa only knows Homa beats Homeschool Fox ($99/yr) because she lived the uncapped best-model version; the trial must manufacture that feeling in 14–30 days. Abuse guardrails only (Gateway per-key budgets), invisible to the user. Post-conversion experience NEVER degrades below the trial feel. Trial token cost (~$25–45/family on remixed stack) is treated as CAC. |
| T2 | **Pricing is derived, not invented**: final tier prices/allotments come from the margin system's first 60 days of real cohort data. The margin/monitoring/model-swap infrastructure (M1-13 + M0-06 + Gateway BYOK/reporting) is elevated to day-one first-class priority, same tier as tenancy isolation. Every new capability (video, 3D, new models) must land in the `action_costs` registry before it ships — no exceptions as abilities expand. **[Note 2026-07-06, build-log: sticker prices v1 were set early by founder call ($19/mo, $99/yr, Pro $49/mo); allotments and any revision still derive from the 60-day data.]** |
| T3 | **Category separation from Homeschool Fox is strategy, not just copy**: Fox = chat + dashboards + scheduling at $99/yr; Homa = always-on agent. Never compete on their price axis; make the difference FELT (uncapped trial is the mechanism, since most moms won't feel it from a feature list). |

### Later founder rulings

| Registered ruling | Date | Current policy | Original dated source |
|---|---|---|---|
| `conference-phone-only` | 2026-07-04 | The conference plan has no booth and no Stripe preorder. Use the phone-based field kit. | `docs/homa-planning/build-log.md` § 2026-07-04 blindspot pass and grilling session |
| `lead-magnet-map` | 2026-07-05 | The child map and personalized report replace a bare waitlist as the primary acquisition experience. | `docs/homa-planning/build-log.md` § Lead magnet v2 shipped |
| `open-signup` | 2026-07-05 | Signup is open. MJ-09 distributes invitations but does not gate account creation. | `docs/homa-planning/build-log.md` § Open signup |
| `public-onboarding-route` | 2026-07-06 | `/onboarding` is the canonical public route. `/map` is a compatibility redirect. | `docs/homa-planning/build-log.md` § /map renamed /onboarding |
| `founding-families-retired` | 2026-07-06 | Current Homa-facing copy does not use "founding families." Historical records and external evidence may retain it with context. | `docs/homa-planning/build-log.md` § Founding families framing retired everywhere |
| `lead-magnet-D8-report-prose` | 2026-07-06 | Deterministic code owns report facts and numbers. A model may write parent-facing report prose under gates. This supersedes the lead-magnet D8 sentence-bank ruling, not global D8 casing. | `docs/homa-planning/build-log.md` § D8 overturned |
| `pricing-2026-07-06` | 2026-07-06 | Base pricing is $19 monthly or $99 yearly. The upper tier is Homa Plus at $49 monthly or $249 yearly. Annual pricing may begin at first conversion. Current Stripe state still requires direct evidence. | `docs/homa-planning/build-log.md` §§ Pricing v1 and Pro renamed Homa Plus |
| `family-skill-beta-promotion` | 2026-07-06 | During beta, founder-curated family skills may promote without a separate notice under the recorded privacy limits. Revisit consent before general availability. | `docs/homa-planning/build-log.md` § The Homa skills bank |
| `onboarding-one-world` | 2026-07-07 | Onboarding writes directly to product family data. Lead tables, bridge records, and mirrors are retired. | `docs/homa-planning/build-log.md` § ONE WORLD |
| `onboarding-full-signup` | 2026-07-08 | Onboarding step 1 performs full signup. Signup, sign-in, and family setup use one onboarding path. | `docs/homa-planning/build-log.md` §§ S1 becomes a full sign-up and One onboarding for every door |
| `copy-clarity` | 2026-07-08 | Clarity and low cognitive load beat personality. Removing meaning-bearing words is not an improvement merely because the result is shorter. | `docs/homa-planning/build-log.md` § Clarity-over-personality copy law |
| `trajectory-downward` | 2026-07-08 | Honest downward line-chart segments are allowed when surrounding language stays neutral, specific, and growth-oriented. | `docs/homa-planning/build-log.md` § Report gains the trajectory chart |
| `voice-retention` | 2026-07-09 | Store voice-call transcripts verbatim and indefinitely. The mismatched journey cross-reference in the original entry does not create a second policy. | `docs/homa-planning/build-log.md` § Persist every voice call |
| `sms-onboarding` | 2026-07-10 | Full SMS onboarding supersedes the earlier link-only recommendation. | `docs/homa-planning/sms-onboarding-plan.md` |
| `D-ht-1-through-D-ht-5` | 2026-07-10 | Use fleet research plus per-family application, retain weekday morning briefs and evening journal prompts, provide full task management under "Homa's tasks," and gate automatic merges. | `docs/homa-planning/plans/2026-07-10-homa-tasks-and-nightly-research.md` § Founder decisions |
| `morning-brief-format` | 2026-07-11 | Weekday research briefs use the approved four-block topic, finding, family application, and one executable offer format. Each content block has 1 to 2 sentences. Saved-note links wait for a dedicated route. | `docs/superpowers/specs/2026-07-11-morning-research-brief-format-design.md` |
| `subject-domain-topic-taxonomy` | 2026-07-10 | The top level is subject, followed by domain and topic. This supersedes C5's parent-facing top-level domain terminology. | `docs/homa-planning/build-log.md` § The skill graph ships |
| `report-as-dashboard` | 2026-07-10 | The progress report is the dashboard and authenticated app home. | `docs/homa-planning/build-log.md` § The progress report becomes the app's home surface |
| `agent-led-live-progress` | 2026-07-11 | The agent is the preferred authenticated app-home surface. Signed-in Progress is one live subject, domain, and topic view fed by journal evidence and resumable check-ins. This supersedes `report-as-dashboard` only for the default authenticated app-home and dashboard surface. Permanent token and share reports remain available, and existing report history remains stored. | `docs/superpowers/specs/2026-07-11-agent-led-live-progress-design.md` |
| `paywall-door-placement` | 2026-07-11 | The progress report remains free. A card prompt appears only when a family opens a paid action door, after the recorded launch prerequisites. | `docs/homa-planning/plans/2026-07-11-the-wall.md` |
| `onboarding-depth` | 2026-07-11 | A parent may choose the longer graph-first assessment path while a quick path remains available. | `docs/homa-planning/plans/2026-07-11-onboarding-depth-fork.md` |
| `multi-parent-v0` | 2026-07-11 | The approved multi-parent slice supersedes the PRD's one-login-only cohort boundary. | `docs/homa-planning/plans/2026-07-11-multi-parent-v0-and-founder-account-merge.md` |
| `full-birthday` | 2026-07-11 | Store month, day, and year product-wide. This supersedes month-and-year minimization and D-mp-4's day-01 normalization. | `docs/homa-planning/build-log.md` § Full-birthday intake ruling |
| `nav-labels-simplified` | 2026-07-12 | App nav tabs read "Ask", "Progress", "Planner", "Tasks". Supersedes the D-ht-4 tab name and the "Ask HOMA" and "Week planner" nav labels, for the nav only; page titles keep the fuller names. | `docs/homa-planning/build-log.md` § App nav labels simplified |
| `task-recipient-scoping` | 2026-07-12 | Only the account owner (the family's first member) is auto-subscribed to scheduled task texts: the morning brief, the evening check-in, and custom tasks. An invited adult is never auto-subscribed and opts in by creating their own task on the web tab, in chat, or over SMS. Supersedes the multi-parent v0 every-adult task fan-out. | `docs/homa-planning/build-log.md` § Task texts reach one adult |
| `desktop-context-switcher-top-right` | 2026-07-12 | On desktop the kid context switcher is an avatar at the app's top right (multi-kid families, on pages the selection affects); the desktop sidebar lists nav and account only. Supersedes the sidebar placement from the 2026-07-10 one-kid-list ruling. The phone bar and drawer are unchanged. | `docs/homa-planning/build-log.md` § Founder ruling: the desktop kid switcher is a top-right avatar |
| `chat-privacy-per-adult` | 2026-07-12 | Conversations are per-adult: an adult sees only their own chats with Homa on every channel, plus messages Homa addressed to them. No family member reads another adult's chat, in the transcript, in search, or through recall. All other family state stays shared (progress, memories, materials, planner, tasks); distilled shared facts may cross adults, raw chat lines may not. | `docs/homa-planning/build-log.md` § Founder ruling: chats are per-adult, everything else stays family-shared |
| `nav-chat-label` | 2026-07-12 | The first app nav tab reads "Chat" (was "Ask"). Supersedes `nav-labels-simplified` for that one label; the other tabs and the page-title rule are unchanged. | `docs/homa-planning/build-log.md` § One thread, refined: the Chats synthesis (round three) |
| `founder-full-chat-access` | 2026-07-12 | The founder reads raw conversation_messages across every channel in the founder console (/admin/chats and the family file), and the night analyst reads the same table; redaction machinery is deferred post-PMF. Supersedes the MJ-13-derived redaction default for founder-facing surfaces and the shipped MJ-14 counts-and-receipts-only constraint. `chat-privacy-per-adult` is untouched: it governs family members, not the founder gate. One hygiene default survives: family names, phones, and emails stay out of GitHub PR and issue text. | `docs/homa-planning/plans/2026-07-12-night-manager.md` D-nm-2; `docs/homa-planning/build-log.md` § Founder deep view |
| `trajectory-real-negative-months` | 2026-07-13 | The trajectory chart plots a measured below-age frontier as its real negative months, and the chart's fixed "growing" slot and armed re-check marker are retired. Scoped to the chart: `monthsAhead` stays non-negative, copy surfaces keep growth framing, and red or "behind" wording remains banned. Extends `trajectory-downward`; a subject whose only evidence is "not yet" still has no number. | `docs/homa-planning/build-log.md` § The trajectory chart becomes interactive |
| `observation-ledger` | 2026-07-13 | Parent input about a child's ability is never wasted. Journal reports the matcher cannot score are captured server-side as observations (effect on scores: none), tagged with nearest skill candidates, fed to the morning brief within a week, and retired once built on. Scores still move only through matched evidence; this adds a third durable store, it does not loosen scoring. | `docs/homa-planning/build-log.md` § Founder ruling: parent input about a child is never wasted |
| `web-fetch-firecrawl` | 2026-07-13 | The agent may fetch model-chosen URLs again through web_fetch, Firecrawl-backed: vendor-cloud scrape to markdown, https only, size-capped, budgeted per family per day (a cost brake, not a security gate). The founder explicitly accepted the prompt-injection and exfiltration risk for now ("more agentic"); M2-14 scanning remains future hardening. Supersedes the 2026-07-09 web_fetch-off ruling in 15-agentic-architecture.md §3. web_search's and the photo desk's query-only postures are unchanged. | `docs/homa-planning/build-log.md` § Founder ruling: web_fetch returns, Firecrawl-backed |
| `lesson-listen-child-audio` | 2026-07-13 | A parent may record a whole lesson that includes their child's voice, behind a dedicated family-level consent screen (D4-pattern stamp on families). Supersedes the personas "no child voice or likeness ingestion in v1" line for lesson recordings only. Raw audio auto-deletes after 30 days; transcripts and reviews stay; AI processing rides no-training terms; no voice identification anywhere; lesson transcripts are family-shared like progress (this does not settle the older open voice-call transcript visibility question). Evidence from lessons moves scores only through the server-side journal matcher; tone and images never score. | `docs/homa-planning/plans/2026-07-13-lesson-listen.md`; `docs/homa-planning/build-log.md` § Lesson listen ships dark |
| `prod-bugs-fixed-not-stored` | 2026-07-14 | A confirmed live production bug is fixed, deployed, and verified live in the session that finds it, or escalated to the founder in that session's reply as a live production failure. Recording it as a suggestion, recommendation, or backlog row without a shipped fix or a founder-accepted delay is prohibited. Findings documents carry per-bug status: FIXED plus commit, or an escalation timestamp. | `docs/homa-planning/build-log.md` § Founder ruling: prod bugs get fixed, not stored |
| `card-per-family-primary-parent` | 2026-07-14 | The handwritten thank-you card keys on families, never accounts: one per family ever (schema-unique), earned by the family's own completed web onboarding, addressed to the primary parent (the adult whose signup created the family). A later adult's account, whether joined by invite link, SMS invite, or any other membership, never mints, renames, or re-times a card. Enforced by write-once family identity fields after onboarding completes. | `docs/homa-planning/build-log.md` § Founder ruling: the thank-you card follows the family, addressed to the primary parent |
| `answers-vocabulary` | 2026-07-14 | Family-facing counts of a child's data points say "answers", one name from onboarding through long-term use: an answer is what an adult said or showed about one skill, whatever the channel (checklist tap, deeper question, correction, check-in reply, journal note or lesson the matcher scored), with the source labeled next to it. "Questions answered" is banned as a count (later answers arrive without questions); "observations" is reserved for the formal third-party artifacts (evidence pack, one-pager, method page, terms). Same reply reaffirmed `trajectory-real-negative-months`: the chart's signed numbers stay. | `docs/homa-planning/build-log.md` § Founder ruling: her data points are "answers", one word from onboarding onward |
| `filesystem-first-fleet-skills` | 2026-07-15 | Homa uses one active fleet-skill home: repo-authored packages at `apps/web/agent/skills/<name>/`. `skill_bank` and `family_skills` are not an active fleet-skill authoring or delivery system; both tables are preserved as dormant historical data, not deleted. `save_skill` and `forget_skill` are retired. This supersedes the "two homes, both correct" ruling in `docs/homa-planning/15-agentic-architecture.md` §2. Revisit only when one of the documented triggers (25-40 active skills, measured routing failures, repeated real family procedures, a genuine canary/A-B need, or deploy cadence becoming the bottleneck) fires. | `docs/homa-planning/plans/2026-07-15-filesystem-first-fleet-skills.md`; `docs/homa-planning/build-log.md` § Fleet skills move to the filesystem, family skills retired |
| `subject-card-single-lesson` | 2026-07-15 | Each eligible report subject card offers one saved next-skill lesson with one practice suggestion and an automatically generated worksheet. The separate whole-child four-week month remains unchanged. | `docs/superpowers/specs/2026-07-15-subject-lesson-with-worksheet-design.md` |

### Open founder decisions

These are unresolved policy, not implementation latitude:

| Decision | Exact unresolved choice | Source |
|---|---|---|
| D10 | Confirm whether "Hegg" means Heggerty before naming the curriculum library. | Original D-series table above |
| DM7 | Keep waitlist email use invite and launch scoped, or ask for ongoing-content consent before nurture email is sent. | `docs/homa-planning/14-marketing-demand-engine.md` §10 |
| Direct printer integration | Approve or reject the proposed reversal of the current no-direct-printer scope. | `docs/homa-planning/send-to-printer-plan.md` § Founder decision queue |
| Private minors' media | Decide whether child photos and other minors' media are private by default despite global D7's general artifact-sharing rule. | `docs/homa-planning/build-log.md` § Voice and text via Telnyx |
| Voice transcript visibility | Decide whether voice-call transcripts and their recall follow `chat-privacy-per-adult` (per-adult) or remain family-readable; `voice-retention` set storage and retention, not visibility. | `docs/homa-planning/build-log.md` § Founder ruling: chats are per-adult, everything else stays family-shared |

## 6. What remains (senior PM capstone, after decisions D1–D4)

1. **OKRs + now/next/later roadmap** (vision-to-okrs, now-next-later, p0-p1-p2) —
   synthesizing M-R track + MJ set + metric targets.
2. **The M-R PRD** — one document an engineering agent builds cohort-one from:
   scope = M-R weeks 1–6 + MJ [M-R] set, journeys 02/04 as spec, 06 as instrumentation,
   05's launch-blocking rows as acceptance criteria.
3. Evidence loop: conference findings (09 kit) feed back into D2/D3 within a week.
