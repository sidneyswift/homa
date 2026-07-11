# PRD · Homa Cohort One (M-R track)

> **Status:** approved 2026-07-03 cohort-one contract, retained as the historical
> baseline. Owner: Sidney (founder/PM). Current policy is this baseline as amended by
> the founder decision registry in `journeys/10-reconciliation.md` §5. Requirements
> below describe product scope or named upcoming work unless repository and production
> evidence separately prove implementation and deployment.

## Contract reconciliation notice (2026-07-11)

Later founder rulings changed several original cohort-one boundaries. The original text remains below so the decision history is readable. This table is the controlling interpretation and does not claim that the later policy is shipped.

| Original clause | Current policy | Implementation boundary |
|---|---|---|
| §1 and §4 assume invited families and one shared login. | Signup is open, and the approved multi-parent v0 slice supersedes the one-login boundary. | Repository support and production verification are recorded separately; MJ-21 remains the long-term roles ticket. |
| §3 excludes SMS and automated notes. | Full SMS onboarding and the approved morning-brief, evening-journal, and task loops are in scope under the later SMS and D-ht rulings. | Provider flags, delivery, and production runs require direct evidence. |
| §3 defers ages 8 to 12 and all child-facing prompts. | Global D3 keeps full-range ambition. The product remains parent-facing, but a parent may choose to sit with a child during optional deep-dive prompts. | Do not claim a child account or child-facing AI chat. |
| FR-1 mirrors leads into waitlist and family worlds. | The ONE WORLD ruling writes onboarding directly to family data. `/onboarding` is canonical and `/map` redirects. | Retired lead-table language is historical only. |
| FR-2 promises four questions, a worksheet within three minutes, and checkout during onboarding. | The parent may choose a quick or deeper graph-first assessment. The progress report stays free, and a card prompt belongs at a paid action door. Full birthdays are collected product-wide. | No duration guarantee is current without timed evidence. Paywall activation remains gated by the wall plan. |
| FR-6 and FR-7 describe hours versus state targets on the dashboard. | State-requirement data is a reviewed legal-reference snapshot. It is not state academic mapping. | Hours can be recorded, but the current repository does not show an hours-versus-target home tile. Keep that behavior ticketed rather than describing it as shipped. |
| FR-7 specifies a card dashboard. | The later founder ruling makes the progress report the dashboard and intended app home. | The current repository renders chat at `/app` and the report at `/app/report`. M2-08 owns the remaining product-policy delta, and production behavior still requires direct evidence. |
| FR-8 and §3 limit notes to concierge handling. | D-ht retains the morning brief and evening journal loops and adds Homa's tasks. | Scheduled delivery and model behavior remain production-dependent claims. |
| FR-9 describes a Hermes-style digest and revision trail. | The learning loop may retain useful family context under the founder memory rules. | Current session review uses bounded verbatim, role-labeled rows rather than a generated digest. `profile_revisions` and D6 sensitive-memory handling remain implementation gaps; MJ-13 owns the sensitive-data work. |
| FR-5 and D4 describe photo-personalized materials behind the consent and retention floor. | Global D4 remains binding, while private-by-default handling for minors' media is still an open founder decision. | Current material artifacts use public random-suffix Blob URLs. Do not describe the D4 privacy floor or private media storage as shipped without implementation and production evidence. |
| §6 requires non-service-role access plus transaction-local `SET LOCAL`. | That remains the target tenancy law. | Browser sessions currently use caller JWT plus RLS; server-originated channels use authenticated family mappings and family-pinned libraries. Ticket M1-02 owns the remaining `SET LOCAL` hardening. |
| §8 names Homa Pro and an entity dependency for SMS. | The upper tier is Homa Plus. The Telnyx sole-proprietor path removed the SMS entity dependency. | Stripe products, prices, and legal account state require fresh provider evidence. |
| §7 lists launch gates as requirements before the first invite. | The gates remain historical acceptance criteria unless a later founder ruling supersedes one. | The current audit has not verified authenticated onboarding, Stripe, Telnyx delivery, material generation and persistence, successful scheduled runs, or private family data in production. |

Open policy decisions remain D10, DM7 email consent scope, direct printer integration, and private-by-default handling for minors' media. Their canonical statements are in the founder decision registry. Do not invent resolutions in implementation.

## 1. What we are building

A multi-tenant web product where an invited homeschool family gets an always-on AI
assistant ("Homa") that: onboards in minutes with an immediate personalized-material
wow; chats (text + voice notes); generates print-ready, photo-personalized materials;
captures journal/observations ambiently and routes them to the child's profile and
hours log; shows a reassurance-first dashboard; and delivers a weekly, human-reviewed
note containing an efficacy before/after. Twenty invited families, cards on file via a
trial-with-card Stripe Payment Link, uncapped power-user experience.

**One deployment serves all families** (eve on Vercel; tenancy per 01-architecture).
Sidney operates concierge loops behind the product (scoring, weekly notes, state
reports), invisible to customers, fail-closed by design.

## 2. Goals / success criteria

The Q3-C1 OKRs (12-roadmap-okrs.md) are this PRD's success criteria verbatim. Headline:
wow ≤10 min · WLF ≥70% by wk4 · every family gets an efficacy before/after by wk4 ·
trial cost ≤$45 P50 · zero cross-tenant incidents.

## 3. Non-goals (cohort one) · enforced

NO: SMS/WhatsApp · credit ledger/auto top-up machinery (M1-06/12/13 are NEXT; Payment
Link only) · visible pricing meter (D2) · discover/local engine · curriculum comparison
· moms network · benchmarks check-in UI (MJ-15; profile is fed by drip + routing) ·
automated weekly notes (concierge only) · full state-report generator ("ask Homa" →
Sidney compiles) · 8–12 materials fronting families (parallel build behind rigor bar,
D3) · child-voice capture & child-facing anything (parent is the speaker; D4 covers
photos, not voice) · face recognition (banned permanently) · ~~public signup (invite
codes only)~~ SUPERSEDED: signup is open since 2026-07-05 (founder ruling, build-log:
"as easy as possible to sign up, no hoops"; migration #8 dropped the invite trigger).
MJ-09 remains as invite distribution to the waitlist cohort, not a signup wall.

## 4. Users

P1–P5 personas (journeys/01). Family #0 = Alessa (parity gate, she moves in as soon
as Phase C is buildable; her verdict gates invites #6–20). Families #1–20 = friend +
conference waitlist, invited in batches. Secondary adults (S1/S2) are
out of scope except: one login per family, mom may share the device.

## 5. Functional requirements

Format: FR-n → journey spec → acceptance source. Gherkin acceptance criteria live in
journeys/04 (cited stories are binding); launch-blocking edge rows in journeys/05 §3
are acceptance criteria wherever they touch a flow. Instrumentation: every FR emits
its events per journeys/06 schema via the typed registry (MJ-08); **no FR merges
without its events** (ratified law).

### FR-1 Invites & signup · spec: journeys/02 §1–2 · MJ-09, M1-01
(Reframed 2026-07-05, founder ruling in build-log: open signup, no invite-code wall.)
Supabase Auth signup (email or Google/Apple) → family record, open to anyone. MJ-09
becomes the invite *distribution* path: the waitlist read path + invite emails that
bring the conference cohort in deliberately. The lead-magnet flow at /onboarding
captures visitors (every lead still mirrors into `waitlist`). Stranger-proof: no
Sidney touch required end-to-end.

### FR-2 Onboarding: the 3-minute wow · spec: journeys/02 §2 (binding copy) · M2-03
Form intake (mom, state, kids' names+DOBs: forms, not chat) → 4 questions per child →
**first personalized worksheet delivered in-chat ≤3 min** → PWA add-to-home-screen
moment → voice-permission ask with graceful denial path. Out-of-range kids (per D3 gap
window) get the honest MJ-07 screen: hours+journal+benchmarks now, materials tracked
as "growing with us." Trial starts here: Payment Link checkout w/ card, trial period
(T1), copy makes "uncapped during your trial, and it stays feeling this way" true.

### FR-3 Week-one drip · spec: journeys/02 §3 · MJ-05, M1-08min
3 questionnaire questions/day/child via email deep-link into chat; skip/catch-up
rules; completes the profile the wow started. Day-7 lands on validation (first
benchmark positions visible), never audit.

### FR-4 Chat + voice · spec: journeys/04 F2 · M1-04/05, M1-15, MJ-02
Streaming chat (eve web channel, `useEveAgent`), mobile-first. Voice notes:
MediaRecorder → Whisper → routed (journal/observation/hours/question) with
**named-effect confirmation chips + atomic undo** (MJ-02). Text+file-upload fallback
ships simultaneously. Session rotation invisible to the user (M1-15). Continuation
tokens are server-custody secrets (S6).

### FR-5 Materials generation + photo personalization · spec: journeys/04 F1 · M2-05, MJ-01/06/11, D4
Handwriting, flash cards, coloring pages; DS worksheet template; reads `what_works`
first; generation status streaming with retry/escalation (45–120 s wait is the #1
funnel risk); print preflight + email-to-self fallback (MJ-01); 👍/👎 with reason chips
→ `what_works` (MJ-11). **D4:** family reference-photo upload behind a dedicated
consent screen (separate from signup, plain-language: what's used, where it goes,
no-training, delete anytime); raw photos on TTL; provider DPAs executed before invite
#1; no face-recognition features. Footer: "made with Homa for [child]" (D7).

### FR-6 Journal + ambient capture + hours · spec: journeys/04 F2/F4 · M2-07, M3-05 subset
Evening journal prompt (email deep-link, skip-if-unanswered); replies route to
journal/compliance-hours/profile/memory with visible confirmations; ambient hour
accrual from mentions ("2 hours of co-op"); per-state hour targets shown (HomeschoolLeap-
seeded table, statute links + last-verified dates). Sensitive-context law (MJ-13/D6)
applies to all captured content.

### FR-7 Dashboard · spec: journeys/02 §3, 04 F3 (display law) · M2-08
Answers exactly three questions: on track? / what next? / where's my proof (hours)?
Per-child positions in domain framing, growth-only visual language (**no red, no
"behind", ever**), recent artifacts, hours vs target. 15-domain detail one tap deeper.

### FR-8 Weekly loop (concierge) · spec: journeys/03 §2 (3 example notes are binding tone) · M3-01 script, M3-11 manual
Saturday: Sidney triggers scoring script. Sunday: agent-drafted, **Sidney-reviewed**
weekly note per family via email, containing ONE gentle next step max and, by week 4,
a hand-written efficacy before/after ("reading is up since the letter-sounds set":
temporal, never causal). 100% human review = the fail-closed gate.

### FR-9 Learning loop · spec: 06-harness-gap-analysis §1/3, 11-hermes-implementation-notes · M2-13/14
Post-turn extraction on a cheap model (Hermes digest pattern): schema-constrained
writes, reduced toolset, delta guards, `profile_revisions`, UI-visible with undo.
Injection defense per M2-14 (structural separation + scanning; scope includes photos'
OCR text).

### FR-10 Trust & safety floor · spec: journeys/05 · MJ-03/10/12/13, M1-16
Crisis playbook live before invite #1 (companion-not-therapist per D5; distress-data
firewall). Claim-dispute path (chat-based, same-day correction propagation). Published
support SLA. Global safe mode + PITR backups + as-built runbooks.

### FR-11 Founder ops · spec: journeys/06 §5 · MJ-14, T2
Monday dashboard (12 tiles incl. quiet-families call list) + 5 wake-up alerts. Margin
telemetry from day one: Gateway `ai-reporting-user` = familyId, `ai-reporting-tags` =
action class on every model call; weekly cost-per-family and cost-per-action review;
model-remix experiment harness (evals + Gateway BYOK) ready before the first pricing
memo (T2: written once 60 days of cohort data exist).

## 6. Platform requirements (binding, from 01-architecture + council)

Tenancy: auth-context familyId only; tools re-scope all model-supplied IDs; RLS via
non-service role + `SET LOCAL` under pooling; M1-07 adversarial suite (incl. IDOR,
FTS/pgvector probes, token takeover, dispatcher principal integrity) green in CI.
Sandbox: per-job scratch, deny-all + allowlist egress, credential brokering, PDF
sanitization; artifacts → Blob before turn end. Sessions: rotation at idle only,
episode summary to Postgres; nothing load-bearing in conversation history. Harness
contract (M1-14) wraps eve everywhere, including the frontend hook.

## 7. Launch gates (invite #1 cannot go out until)

1. M1-07 green · 2. D4 consent floor executed (screen + DPAs + TTL) · 3. MJ-03 crisis
playbook + D5 resources vetted · 4. M1-16 safe mode + backups tested (restore drill) ·
5. MJ-10 SLA published · 6. Payment Link trial-with-card tested end-to-end incl.
cancel · 7. privacy policy naming all subprocessors live · 8. founder dashboard
rendering real events. **Gate for invites #6–20:** Alessa two-week parity verdict.

## 8. Open items

- D10: confirm "Hegg" = Heggerty with Alessa (blocks curriculum library naming only).
- Tier prices: v1 set by founder 2026-07-06 (build-log): Homa $19/mo or $99/yr,
  Homa Pro $49/mo, live in Stripe both environments (supersedes the $29/mo
  placeholder). Allotments and any revision still derive from real margin data at
  day 60 (T2 memo). No pricing shown on the site until the paywall decision.
- A2P 10DLC: entity filed immediately (Phase 0); registration proceeds in background
  for SMS (LATER).
- **July 13, 2026 conference:** landing page + waitlist capture are a Phase 0
  deliverable AHEAD of this PRD's product scope, see BUILD.md Deliverable 0.

## 9. Risks (top 5, from 04 + council, with owners in the plan)

R1 eve churn (harness contract + tripwire) · R5 web-chat ambience vs voice habit
(voice-first UX + PWA + Alessa gate measures it) · R6 retention (WLF weekly, efficacy
notes) · trial economics (O3 tripwire) · solo-founder capacity (concierge ceiling rule,
safe mode, runbooks-as-built).
