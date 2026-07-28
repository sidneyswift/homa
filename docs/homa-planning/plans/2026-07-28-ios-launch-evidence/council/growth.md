# Growth review: Homa iOS as an acquisition and monetization surface

Author lens: growth PM, consumer subscription. Date: 2026-07-28.
Evidence base: reports 00-12 in `../`, plus the live events registry at `packages/core/src/events.ts` and the mobile code map (report 01).

One framing sentence before anything else: the founder's goal ("if a user signs up, they can pay and use it") and report 10's web-subscription-only recommendation are not in conflict, they are two stages of the same roadmap. The mistake would be forcing them into one release.

---

## 1. Monetization roadmap: reconciling the founder's goal with report 10

### The reality check first

Three facts constrain everything:

1. The binary sitting in App Store Connect (build 5, `fa773afb`) was built from a branch that never merged and has never matched any OTA fingerprint. It cannot be iterated or patched. Any launch starts with a rebuild from main (report 05).
2. The app today has zero payment code, zero paywall, zero settings, zero account deletion. With the signup paywall ON (2026-07-28), a stranger who installs the app literally cannot become a usable customer without leaving to Safari, re-authenticating cold, and paying on a Stripe page the app verbally steered them to. That exact shape is the 3.1.1 rejection magnet (reports 01, 03, 10).
3. App Review enforcement in mid-2026 rejects link-only selling but blesses two shapes: quiet tier-identical companion apps, and apps that offer IAP (optionally with an external link beside it). Report 10's evidence on this is solid and recent (forum threads 799798, 825551).

So the founder's goal is correct as a destination and wrong as a v1.0 requirement. Staging it:

### Stage v1.0: companion posture (target: submit within 2-3 weeks)

**What it is.** Free app, sign-in only, tier-identical. No pricing, no purchase CTAs, no merchandised paywall anywhere in the binary. A walled or lapsed family sees an informational state: "Your Homa plan is managed on the web," with at most a plain link to the account page (legal in the US storefront, but keep the wording account-management, not checkout). The agent's in-app steering copy must be softened to match (today it verbally routes to thankshoma.com/onboarding, report 03 §6).

**What it buys.** Approval at the lowest risk, a live listing that starts accruing search rank and (eventually) ratings, the push channel for retention of existing subscribers, and zero Apple fee forever on the web rail. Per report 10, this is the documented safe harbor; budget one rejection round anyway.

**What it explicitly does not do.** Convert strangers. In v1.0 the App Store is a retention surface and a brand shelf, not a funnel. The install CTA for v1.0 lives in the post-subscribe web flow and the drip emails ("get the app"), not in paid acquisition.

**v1.0 exit checklist (blockers, not features).** Rebuild from main; account deletion in-app with SIWA token revocation (5.1.1(v)); Supabase Apple Client IDs entry; settings screen with privacy/terms/support links; the third-party AI consent moment (5.1.2(i), November 2025 rule); privacy manifests audit; seeded demo family with comped subscription in review notes; report-content affordance in chat (4.7.1 triad). All enumerated in report 10's checklist.

### Stage v1.1: StoreKit IAP with the 7-day trial (build starts now, ships on the first update after v1.0 approval)

**This is the release that delivers the founder's goal.** Sequence, not metric-gate, the decision to build it: the engineering (report 03 §7 lays out the full server design) takes weeks, and every week the app is listed without a purchase path, organic installs are wasted at the education-category median of 2.2% download-to-paid that we are choosing not to collect.

**Shape:**
- Auto-renewable subscription, $19.99/mo (Apple tier nearest $19; do not price higher to offset commission, users compare against the web reference price, report 09 §4).
- 7-day introductory free trial. On iOS this is structurally the same offer as the web card-upfront trial: Apple has the payment method and auto-converts, so "your 7 free days" copy stays true verbatim (reports 03, 09).
- **Add the first annual SKU here.** Education sells 59-66% of subscriptions as annual and Homa has none anywhere. This is the single biggest pricing gap in the whole business (report 09 §10.3). The $99/yr sticker is already founder-ruled; the Homeschool Fox $99 collision read (T3) must be taken before it goes live, so put it in the founder package now.
- **Regular tier only.** Do not surface Plus ($49) or Max ($199) in the iOS binary. Sell-then-build (#297) is survivable on web and a 2.1-completeness rejection plus refund magnet in an app; #293's unenforced Max differentiator makes it worse. One plan, one price, matching the Outschool/ABCmouse lesson: never let app and web pricing stories diverge or complicate (report 11).
- Paywall anatomy per report 09 §3: single screen, motivation headline, 4-6 benefit rows, "Start my 7-day free trial" CTA, $19.99/month at equal visual weight to the trial promise (3.1.2, and the top trial-related rejection), terms/privacy/restore links, no testimonials or counts ever (claims law).
- Entitlement plumbing per report 03 §7: additive `apple_*` columns on families, `/api/billing/apple/confirm` + App Store Server Notifications webhook, per-provider lapse logic in `accountAccessDecision`, provider-generic #274 reconciliation cron, appAccountToken = Supabase user id cross-checked server-side. Emit the same `billing.trial_started` event so funnels stay comparable.
- Vendor decision for the founder: bare StoreKit 2 fits the codebase grain and the deterministic-billing rulings (report 03); RevenueCat buys paywall A/B velocity and Stripe+Apple entitlement unification (report 09). My growth read: the measured A/B wins are structural (trial length, plan order, localization), not cosmetic, and Homa can run structural tests with remote flags on a homegrown paywall. Start bare StoreKit 2, adopt RevenueCat only if paywall iteration becomes the bottleneck or Android arrives.
- Configure one conservative Apple win-back offer at launch (50% off first month back, 30+ days lapsed). Costs nothing until someone churns; makes the App Store's own re-engagement surfaces work (report 09 §5).

**v1.1 also requires the native onboarding spine** (section 2), because an IAP paywall with nothing before it converts nobody: the artifact earns the ask.

### Stage v1.2+: external purchase link beside IAP (optional, condition-triggered)

Add a "Subscribe on the web" link next to the IAP option (the Patreon posture) only when both hold: (a) the App Store has become a real acquisition channel (see triggers below) so the fee delta is material, and (b) the zero-commission window still exists. Adding a link to an approved app reviews far more gently than shipping link-first (report 10). If the district court sets a commission above roughly 10% or SCOTUS restores the 27% regime, re-run the math with SBP 15% as the IAP ceiling.

### Trigger metrics between stages

| Transition | Trigger | Why this number |
|---|---|---|
| Start building v1.1 | Now (calendar-sequenced, not metric-gated) | Server design is specced (report 03); every listed week without IAP wastes installs |
| Ship v1.1 | v1.0 approved and stable for 1-2 weeks, entitlement E2E tested on a +homatest sandbox family | Never stack a payments review on a first review |
| Invest in App Store acquisition (Apple Ads, web2app quiz funnel) | iOS trial-to-paid within 10 points of web trial-to-paid, AND ≥100 organic installs/mo | Proves the surface converts before buying traffic; 100 installs/mo at the 2.2% education median is ~2 paying families/mo, the noise floor |
| Add external link (v1.2) | ≥500 organic installs/mo or projected Apple fees ≥$500/mo | Below that, the engineering plus dual-rail confusion costs more than 15% of a small number |
| Reprice/reconsider IAP | Court sets commission, or SCOTUS ruling (~June 2027) | Report 10 timeline |

### What the founder must decide (the ruling package)

1. Accept the v1.0 companion posture: the app does not convert strangers until v1.1. (This is the reconciliation itself.)
2. Approve building the StoreKit path now, and pick bare StoreKit 2 vs RevenueCat.
3. iOS price point ($19.99/mo recommended) and whether the annual SKU ($99/yr, pending the Fox collision read) ships with v1.1.
4. Confirm regular-tier-only on iOS (Plus/Max stay web-only until built).
5. The v1.0 lapsed-state wording and whether it carries the plain web-account link at all (slightly safer without).
6. Rebuild-from-main and abandon build 5 (report 05 makes this non-optional; it needs the founder to check what state 1.0.0 is in inside ASC).
7. Reconcile the PWA add-to-home-screen OKR (O1 KR3) with the native app; no ruling positions them today (report 04 §5.2).

---

## 2. The iOS activation loop

### What is first-wow on the phone

**v1.1 (the real answer): the first printable made mid-onboarding.** The artifact moment is Homa's genuine market lead: quiz funnels climax in a projected graph; Homa climaxes in a real, printable, child-specific deliverable, and no parenting comp does this (report 08 §10). The install-to-wow sequence:

1. **Install → SIWA one tap.** Auth is already built (SIWA + Google). No password creation, no email-first screen.
2. **Native intake, 3-4 screens of chips:** how many kids, ages, the subject that worries her most. Zero model latency, progress indicator, endowed-progress mechanics. These answers seed the agent so the chat opens already knowing the family shape, killing the coldest kickoff turn (measured 6.3-12.1s even after optimization, report 08 §4: every second of dead air is the most expensive second in the funnel).
3. **Chat interview takes over** for the open, emotional questions (a parent describing a struggling child is Homa's "weight question": why-we-ask before, reassurance after, per the Noom pattern). Quick-reply chips per turn.
4. **The first making:** morphing promise card while the printable generates. Generation time is theater, not dead air.
5. **Artifact reveal.** This is the wow. Target: under 5 minutes install-to-artifact (elite products deliver aha under 5 minutes and show ~40% higher D30 retention than 15+ minute flows, report 08 §4).
6. **Push priming sheet, immediately after the reveal,** child-named: "Want to know when tomorrow's plan for Maya is ready?" (section on choreography below).
7. **Paywall (StoreKit trial sheet)** while emotional investment peaks. Hard gate after the value moment: hard paywalls convert 10.7% download-to-paid vs 2.1% freemium with identical 1-year retention, and paywalls after a measured value moment see ~2.1x higher trial starts than immediate gates (report 09 §1). Education deliberators are real (only 28.5% of education conversions on Day 0, 23.5% of trials start 31+ days post-install), so the paywall stays permanently reachable from settings and locked surfaces, never onboarding-only.

**v1.0 (interim): first-wow is the chat remembering her family.** The walkthrough's strongest moment was Homa referencing "that sh/ch/th word strip I mentioned last time" (report 00). For the existing-subscriber installer, activation = first mobile chat turn + push opt-in. Two cheap product moves make v1.0 worth installing:
- **Fill the Today tab.** The backend already has plans, materials, progress, hours; the tab shows none of it (report 00 finding 4). Today's plan + tap-to-check-off + latest material is the daily-open reason.
- **Stop the agent from routing to surfaces that do not exist on the phone** (the planner dead end, report 00 findings 2). Channel-honest instructions until native surfaces exist; depends on #258's capability signal.

### D1/D7 retention mechanics under the anti-guilt bans

Banned (founder law): streaks, points, leaderboards, variable-ratio rewards, mastery decay, inactivity nudges, per-demonstration push, sibling comparison, red/"behind" framing. What replaces them is Duolingo's underlying mechanic with the guilt stripped out: **give the family something in flight, then notify only when Homa has done work for her.** Every push is a delivery receipt or a gift, never a summons.

| Slot | Mechanic | Why it is allowed | Benchmark/guardrail |
|---|---|---|---|
| D0-D1 | Finished-material push: "Maya's dinosaur math pages are ready to print" | Event-driven value delivery, not a nudge | Materials generation takes 45-120s; the push closes the loop when she backgrounds the app |
| Daily | Morning brief push (opt-in, quiet hours, account owner only) | Forward-looking offer, never a guilt read | Warm cohort engagement was 25% fatiguing to 7% (memory); cap frequency, watch the fatigue curve |
| D4 | Trial reminder (billing notice) | Trust play; Brilliant's day-5 reminder is the only thing between it and ABCmouse-grade rating damage (report 11) | Already law on web (PR #273); mirror on iOS via scheduled job (Apple does not send it for you, report 03 §7.6) |
| D7 and weekly | Friday letter push, per child, reporting adult only | The ritual anchor; a celebration is a receipt, never a verdict | WLF target ≥70% (O2) |
| Weekly | "This week is planned" receipt after a planner session | Confirmation of her work, not a demand | |
| Ongoing | Page-of-firsts moments when evidence lands | Celebration surface | Never per-demonstration push (banned); batch to the letter |

**The anti-guilt ratio law is the push program's kill switch and must be instrumented from day 1:** re-engagement response ≥20% and unsubs <1%/mo or sends stop (process law 4). That means per-notification-type response tracking is a launch requirement, not a nice-to-have (see section 3).

### Push consent choreography

- **Never at first launch.** Duolingo's two-stage ask is the model: ask when there is something to protect (report 11 pattern 1). iOS baseline opt-in is 56.4%; pre-permission priming lifts it 2-3x relative to cold prompts (report 08 §5).
- The soft-ask sheet fires seconds after the artifact reveal (v1.1) or after the first mobile chat win (v1.0), phrased as a specific child-named promise. Decline on the soft ask costs nothing; the one-shot system prompt fires only after a yes.
- One permission per session. **Do not implement ATT at all:** Homa does no cross-app tracking, so no ATT prompt, cleaner nutrition labels, one less sheet (report 10 §6).
- Review prompt (`SKStoreReviewController`) after a later, separate win: the first finished week or second printable, never the same session as the push ask, never before value. Review velocity is a 2026 ranking factor and Homa starts at zero (report 12 §2.4).
- If push is declined, the morning brief and Friday letter fall back to email/SMS (existing channels); record the decline and re-prime only after a major value event, months not days.

---

## 3. Measurement plan: install-to-paid visibility

### What exists (packages/core events registry, verified live)

The registry already covers the web funnel end-to-end: `map.started`, `map.account_created`, `map.family_setup`, `map.report_generated`, `map.report_viewed` (onboarding); `wall.viewed`, `wall.dismissed`, `wall.checkout_started`, `billing.trial_started`, `billing.trial_reminder_sent` (monetization); `materials.created`, `materials.finalized`, `materials.pdf_opened` (artifact); `planner.*`, `progress.*`, `chat.turn_completed`, `research.brief_sent`/`brief_feedback` (engagement); `lead.captured`/`converted`.

**The mobile app emits exactly one of these: `chat.turn_completed`** (report 01 §4). Everything else about an iOS user's life is invisible.

### What must be added (MJ-08 law: no feature merges without its events)

| Event | Stage | Purpose |
|---|---|---|
| `app.first_open` (with install source if resolvable) | v1.0 | Funnel top; joins to ASC download counts |
| `app.signed_in` (method: apple/google/password; new vs returning) | v1.0 | SSO mix, auth failure visibility |
| `app.screen_viewed` (screen enum) | v1.0 | Today-tab engagement, dead-end detection |
| `push.prompt_primed` / `push.permission_granted` / `push.permission_denied` | v1.0 | Opt-in rate vs 56.4% baseline |
| `push.sent` / `push.opened` (type enum: material, brief, letter, trial_reminder) | v1.0 | The anti-guilt ratio law needs per-type response ≥20% and unsubs <1%/mo, deterministically measurable |
| `onboarding.intake_step_completed` (step enum) | v1.1 | Native intake drop-off per screen |
| `paywall.viewed` (surface: ios) | v1.1 | Mobile twin of `wall.viewed` |
| `iap.purchase_started` / `iap.trial_started` / `iap.purchase_failed` / `iap.restored` | v1.1 | Server-verified via the confirm route; reuse `billing.trial_started` semantics so cross-platform funnels compare |
| `billing.apple_status_mirrored` | v1.1 | Webhook health; the #274 dark-webhook class for Apple |
| `review_prompt.shown` | v1.0 | Rating velocity attribution |
| `deep_link.opened` (route) | v1.0 | Email/drip-to-app loop measurement |

Cross-cutting fix: events need a `surface` attribute (web/ios), because mobile currently authenticates as channel "web" and is indistinguishable in every funnel. Careful: `turn-recovery.ts` queries `channel = "web"`, so relabeling the channel silently kills recovery (report 01 §9); ship the surface attribute as a new field, coordinate the channel rename with #258.

### The funnel and its benchmarks

Install → first_open → signed_in → intake complete → artifact revealed → push granted → paywall viewed → trial started → paid (D7) → retained (D35).

Plan against RevenueCat education medians (report 09 §6): download-to-trial 6.5%, trial-to-paid 31%, download-to-paid D35 2.2%; top quartile above ~6%. Concretely: at 1,000 installs/mo, median performance is ~65 trials and ~20 paying families (~$380 new MRR/mo); top quartile is ~60 paying (~$1,150). Education deliberates: only 78.5% of trials start Day 0 and 23.5% start 31+ days post-install, so measure trial starts on a 35-day window, not Day 0.

### Attribution reality, 2026

- **First-party sign-in attribution is Homa's real asset.** Every install authenticates, so install-to-paid joins in Postgres (first_open device event to family row) with no device-level ad attribution at all. Most subscription apps cannot do this; Homa can, because there is no anonymous mode.
- App Store Connect Analytics provides source type (search vs browse vs referrer vs app referrer), impressions, and conversion per custom product page. This is the ASO feedback loop; it is aggregate and un-joinable, use it for listing optimization only.
- No ATT means no IDFA, which costs nothing today (zero paid UA). If Apple Ads ever starts, its attribution (AdAttributionKit postbacks) works without ATT; keep the no-tracking posture regardless.
- Web-to-app: stamp "get the app" links in the drip and post-subscribe flow with distinct paths so `deep_link.opened` separates owned-channel installs from store-organic.

---

## 4. Listing strategy

### The lane is open, take it by name

Report 11's board read: the "homeschool" query splits between giants that merely mention homeschool (Khan, IXL, BrainPOP) and homeschool-natives that are tiny (nothing above 350 ratings; the #1 native result sits at 3.47 stars; the AI entrants have 80 and 22 ratings). Nobody owns "homeschool + AI" at scale, and **nobody's screenshots show a conversation, a generated worksheet, or a child's finished work.** That last sentence is the listing strategy.

### Title, subtitle, keywords (endorsing report 12 draft A with one sharpening)

- **Title: `Homa: AI homeschool planner`** (27 chars). "homeschool planner" is the highest-intent head term, incumbents rank on it, none pairs it with AI. Take rank over positioning purity (option B "assistant" describes the product better and searches worse; the description carries the assistant story).
- **Subtitle: `Weekly plans and printables`** (27 chars). Three fresh indexed tokens combining into "homeschool printables" and "weekly planner."
- **Keyword field (97 chars):** `curriculum,tutor,worksheets,tracker,preschool,kindergarten,portfolio,records,hours,unit,study,mom`. Records/hours/portfolio tokens matter: compliance receipts are the single most-thanked feature class in homeschool-native reviews (report 11 pattern 5). Sanity-check the field against Apple Ads popularity scores before submission (free, 30 minutes, founder-action: needs the Apple Ads login).
- **Category: Education primary, Productivity secondary.** Do not enroll in Kids (parent-facing product, and Kids triggers gates that do not apply). Education gets disproportionate editorial consideration and the homeschool shelf is winnable against this incumbent set.
- Style-tail tokens (`unschooling`, `charlotte mason`, `montessori`) go to CPP keyword assignments, not the main field (below).

### The 3-screenshot narrative (the first 3 do almost all the work)

1. **The leapfrog: sentence to printable.** A chat message ("Maya loves dinosaurs and is stuck on borrowing") morphing into a real, child-specific math page. Caption: "Ask in plain words. Print in minutes." No competitor shows this; it is simultaneously the differentiation and the product truth.
2. **The intent match: the week planned in a chat.** Plan/Today view. Caption: "Plan the whole week in one chat." This screenshot pays the "homeschool planner" title promise and feeds OCR-indexed caption keywords.
3. **The trust close: records without the spreadsheet.** Hours and progress accruing. Caption: "Hours and progress, recorded as you go." The most-thanked feature class in the niche, and Homa's substitute for the testimonial slot it legally cannot fill (zero customers, claims law). Real artifacts are the social proof.

Slots 4-6: the Friday letter/wins surface ("Every win gets noticed"), the warm assistant conversation, everything-together.

**Hard constraint the ASO draft glossed:** screenshots must show the app, not the web product (2.3.1 accurate metadata). The 3-tab v1.0 has no planner, hours, or progress surface, so this storyboard requires the Today-tab plan view and at least a materials list to exist natively, or the launch set narrows to chat + printable + Today. This couples listing quality to product scope: **the Today tab rebuild is also an ASO deliverable.** Never show the paywall or any price in screenshots (2.3.7).

### Ratings cold-start

Zero paying customers means zero ratings at launch and the claims law bans manufacturing any social proof. The plan: seed installs from the existing subscriber base first (email/drip "get the app" to every active family the week the listing goes live), wire the review prompt to the post-win moment, and let the first 20-50 ratings come from people already retained. A 4.8 from 40 real families beats the niche's entire native shelf.

---

## 5. Marketing asset checklist for launch

**Product page (App Store Connect):**
- [ ] Title, subtitle, keyword field per section 4 (founder pastes; or provision an ASC API key to automate)
- [ ] Promotional text (170 max, editable without a build): report 12's 140-char draft; refresh seasonally
- [ ] Description: report 12's draft passes 3.1.2 (price paragraph leads with $19 before the trial) and the claims laws; confirm live privacy (`/privacy`, 200 today) and terms URLs and the support address; EULA link in description or the EULA field (top subscription rejection cause)
- [ ] Privacy nutrition labels: account info, user content (chat, child names/ages, photos), identifiers; linked to identity; tracking = No. The third-party AI sharing disclosure must match the in-app consent moment (5.1.2(i))
- [ ] Age rating questionnaire: answer honestly for an open-ended AI chat surface; expect 13+ per report 10 (note: report 05 guessed 4+, side with report 10's analysis; do not chase a low band, mis-rating is a 2.3.6 violation)
- [ ] Review notes: demo family (+homatest, seeded, subscription comped), sign-in options, "companion to a web service, subscriptions managed on the web, demo account has full access"
- [ ] Support URL and marketing URL; add the App Store badge to thankshoma.com (today the site has zero App Store links, report 05)

**Screenshots:**
- [ ] 6 portrait shots at 1320x2868, 6.9-inch only (portrait-only, phone-only app keeps the matrix small)
- [ ] First 3 per the section 4 narrative; captions short, benefit-led, keyword-bearing (OCR-indexed)
- [ ] All from real app surfaces with real generated output (materials-studio artifacts); no paywall, no prices, no fabricated counts

**Preview video: no at launch.** Evidence is category-dependent and utility-shaped categories show 3-7% conversion HARM from autoplay video; Homa is a calm utility for busy parents (report 12 §5). Answer it properly post-launch with a free Product Page Optimization A/B test rather than by industry average.

**Custom product pages (post-launch, weeks 2-6, not launch blockers):**
CPPs rank in organic search since July 2025, only ~31% of apps use any, cap is 70. Ship three intent pages plus one philosophy split:
1. "homeschool planner" intent: week grid and Today leading.
2. "homeschool printables/worksheets" intent: materials output, a worksheet in a parent's hand.
3. "homeschool records/hours" intent: hours log and progress.
4. **Philosophy split (the homeschool-style vs unschool-style ask):** one structured-homeschool page (weekly plan, records, checklists forward; keywords: planner, schedule, curriculum) and one unschool/relaxed page ("progress without pressure": ambient capture, wins noticed, no-red framing forward; keywords assigned: unschooling, charlotte mason, eclectic). The product is philosophy-agnostic in principle and philosophy-charged in presentation (report 04 §2); CPPs are exactly the tool for saying both truths to both audiences without diluting the default page. Guardrail: both pages obey every claims law; the unschool page especially must never imply the structured page's records are "requirements."

**Store presence extras:**
- [ ] In-app event: "Back to homeschool week" for late August (event name and short description are search-indexed; education apps get outsized editorial consideration; the timing is 3-4 weeks out and real)
- [ ] One conservative win-back offer configured (v1.1, StoreKit 2)
- [ ] Review prompt wired post-win (v1.0)
- [ ] Cross-localization keyword fill (en-GB, es-MX) as a post-launch iteration, taking indexable footprint from 160 toward 1,440 chars

**Owned-channel launch kit (drives the ratings cold-start):**
- [ ] "Get the app" email to all active families, week 1
- [ ] Post-subscribe screen on web adds the App Store badge
- [ ] Drip sequence slot for the app (the onboarding funnel audit's drip blockers permitting)
- [ ] Day-4 trial reminder parity job for Apple-billed trials (v1.1)

---

## 6. Risks and honesty notes

- **The biggest schedule risk is not Apple, it is the binary.** Build 5 is unreproducible and un-patchable; the founder must read ASC state and the team must rebuild from main before any listing work matters (report 05).
- **The v1.0 lapsed-state wording is the single highest-rejection-risk pixel** in the companion posture. Informational, not merchandised; expect to defend it in review notes citing 3.1.3(b) and the US 3.1.1(a) carve-out.
- **Do not let the agent undermine the posture.** The in-app model today verbally steers to a payment-bearing web flow; that prose is part of the review surface. Channel-aware instructions are a compliance item, not polish.
- **Planner tools rendering as silence** (#256/#258/#263) will read as "broken" in reviews the moment planner screenshots go live. Screenshot scope and render scope must move together.
- **The kill-test caveat:** the wall/report-lock kill test scores by 2026-08-01 and calendar adoption is zero real families; screenshot and feature ordering should follow what real families actually use (chat and materials first), which conveniently is also the differentiation story.
- The web funnel is scored on visitors-to-paid; score iOS on install-to-paid with the same discipline, and never on installs.
