# App Review submission plan: Homa iOS v1.0

Author lens: former App Review team member, now launch consultant. Basis: report 10 (rules, fetched July 28, 2026), report 01 (mobile code map), report 03 (billing), report 05 (release infra), report 00 (simulator walkthrough), reports 04/06 for binding rulings and ticket overlap. Everything below is written to be encoded directly into the launch epic as gates.

Headline: the app that exists today would be rejected, and not narrowly. It has three independent guaranteed-or-near-guaranteed rejection triggers (no account deletion, unverified SIWA backend config, a fresh-account experience that is a shell steering to a payment-bearing web page) plus a binary in App Store Connect that mainline cannot reproduce and can never patch. None of these is expensive to fix. Fixed in the right order, a companion-mode v1.0 can plausibly be live within one to two review cycles.

---

## 1. Rejection-risk register

Likelihood scale: CERTAIN (App Review tests this mechanically and it fails), HIGH (documented recent rejections for this exact shape), MODERATE (reviewer-dependent), LOW (edge case or notes-resolvable).

### R1. Guideline 5.1.1(v): no account deletion. Likelihood: CERTAIN

- Evidence: the app supports account creation (Apple and Google sign-in mint Supabase users on first sign-in, report 01 §3: `signInWithIdToken` / `exchangeCodeForSession` both create accounts). The only account control in the entire app is a Sign out button at the bottom of the Family tab (walkthrough 07-family-signout.png). No deletion anywhere, in app or on web reachable from the app.
- Why certain: reviewers check this mechanically for every app with a login. This rule has been enforced since June 30, 2022. Deactivation is insufficient; a web hop is tolerated only if it is a direct path to deletion, not a support maze.
- Mitigation (blocking, build before submission):
  1. In-app "Delete account" entry point, findable (a Settings or Account section on the Family tab is enough for v1).
  2. Server-side deletion that removes the account record and family personal data (children's names, birthdays, progress, chat), with any legal-retention carve-outs disclosed in the confirmation copy.
  3. SIWA token revocation via the Sign in with Apple REST API as part of deletion (Apple's stated requirement for SIWA apps).
  4. A defined answer for the family-data question in the confirmation flow, aligned with the `record-export` ruling (offer the export before deletion; the ruling says a family can always download the full record).
  5. Confirmation friction is fine (type-to-confirm, cooling-off email), a dead end is not.

### R2. Guideline 4.8 / 2.1: Sign in with Apple configured but possibly broken live. Likelihood: CERTAIN if the Supabase step is undone, otherwise LOW

- Evidence: the client ships SIWA correctly (report 01 §3, `usesAppleSignIn: true`, native sheet, identity token to Supabase). But SIWA only works if `com.thankshoma.homa` is listed in the Supabase Apple provider Client IDs, a founder dashboard step flagged as unconfirmed in both the README and project memory (reports 01, 05 §7.7). Build 4 already failed once on the SIWA entitlement (report 05 §2), so this integration has a history of half-configured state.
- Why it matters: reviewers tap Sign in with Apple with their own Apple ID on essentially every app that shows the button. If the token exchange fails, that is an immediate 2.1 rejection with a "we discovered a bug" note, and it costs a full review cycle.
- Mitigation: verify the Supabase entry, then verify SIWA end to end on a TestFlight install of the actual store candidate binary (not the dev build) before pressing Submit. Also verify the fresh-Apple-ID path, not just the existing-account path, because the reviewer's Apple ID will be fresh (see R4).
- Note on 4.8 itself: satisfied on paper (SIWA + Google + email, SIWA rendered first). No action beyond making it work.

### R3. Guideline 3.1.1: steering to external purchase via buttons and agent prose. Likelihood: HIGH as built, LOW after mitigation

This is the subtlest and most important item, because the steering surface is not just buttons, it is the model's own words.

- Evidence, buttons: `openWebOnboarding()` opens `https://thankshoma.com/onboarding` in Safari from four places (signin, Today empty state, Chat setup-incomplete state, Family tab; report 01 §11). Since 2026-07-28 that destination sits behind the card-upfront signup paywall, so the app's most prominent new-user button lands directly on a Stripe payment flow.
- Evidence, agent prose: a walled family's chat turn gets `familyId` deleted at the eve channel and the model is instructed to "warmly point to thankshoma.com/onboarding" (report 03 §4, `apps/web/agent/channels/eve.ts:178-205`). The transcript the reviewer generates by chatting is reviewable surface. If the reviewer's account is walled or setup-incomplete, Homa herself will steer to a checkout page, in prose, on demand, reproducibly.
- The legal landscape (report 10 §1): in the US storefront, links and calls to action to external checkout are permitted, zero commission, no entitlement needed. BUT 3.1.1 is still enforced against apps whose only purchase path is external: a Stripe-link hard paywall was rejected in September 2025 (forum thread 799798), and practitioners in 2026 advise budgeting two rejection rounds for link-only selling. The safe harbor is the tier-identical companion: no merchandised purchase flow in the app at all.
- Mitigation (the posture decision, see §2 for the full verdict):
  1. No pricing, no tier names, no "subscribe", "upgrade", "trial", or "$" anywhere in the binary. Grep the mobile source for these strings as a CI-style gate before every submission.
  2. Reword every web punt from an acquisition CTA to account information. "Open onboarding" becomes "Finish setting up on thankshoma.com" with copy like "Homa families get set up on the web. Everything here fills in once that is done." A plain link is legal in the US storefront; a merchandised funnel entry is the rejection magnet.
  3. The agent's walled-state and setup-incomplete prose must follow the same law on the iOS channel (full spec in §4).
  4. The demo account must never hit any of these states (R5), so the reviewer's primary path never touches the steering surface at all.

### R4. Guideline 2.1 / 4.2: completeness, the fresh-account shell, and in-app dead ends. Likelihood: HIGH

- Evidence A, the fresh-account shell: a reviewer who taps SIWA with their own Apple ID gets a new Supabase user with no family. All three tabs then show "finish setup on the web" punts (report 01 §3). The app they experience is a sign-in screen plus three web referrals. That reads as a 4.2 minimum-functionality shell and doubles as R3 steering.
- Evidence B, agent dead ends: the walkthrough (04, 05 screenshots) shows Homa telling a parent to open "Maya's progress report page" and press a button, on a phone that has no progress report surface and no deep link. The model claims it "can't build that plan from here". A reviewer poking the chat can reproduce an assistant that gives unfollowable instructions inside the reviewed app. This is a quality read (2.1 "does the app work as described") and it feeds the AI-quality impression that colors the whole review.
- Evidence C, error-blind screens: family.tsx and chat.tsx ignore fetch errors, so a transient network failure renders "Finish setup first" to a fully set-up family (report 01 §2, §9). If the reviewer hits one blip, the app appears broken AND steers to the web, the worst possible combination.
- Evidence D, cosmetics that read as bugs: the "Hi App." greeting (the demo parent display name is "App Review", truncated to "App"), roughly 60 percent empty Today tab, the raw always-expanded add-child form with three plain text fields for a birth date.
- Mitigation:
  1. Ship the R5 demo account so the intended review path shows a full, living family.
  2. Fix the two error-blind screens (destructure `error`, render the existing retry-voiced error state). Cheap, high leverage.
  3. Give the fresh-account state a self-respecting screen: one card, honest copy, no funnel framing (see R3 wording). Better, if scope allows: a minimal native "name your family, add one child" step so a fresh account is not a dead end at all. Not required for approval, but it converts the worst screen in the review into a neutral one.
  4. Rename the demo parent to a natural first name so the greeting reads "Hi Riley."
  5. Channel-aware agent instructions so the model stops referencing web-only surfaces from the phone (§4). At minimum for v1.0, the model must offer what mobile can actually do (chat, worksheets via MaterialCard) and describe web surfaces as "on the web at thankshoma.com" rather than as buttons the parent should look for on this screen.
  6. Verify the store binary carries no dev chrome (the floating Expo gear is dev-build-only, but confirm on the TestFlight candidate).

### R5. Guideline 2.1(a): demo account and reviewability. Likelihood: CERTAIN rejection if absent or walled, fully controllable

- Evidence: login-gated app, so credentials in App Review Information are mandatory. The signup paywall is ON as of 2026-07-28; an unseeded or uncomped account hits the wall and the reviewer either sees a dead app or the steering path (report 10 §8).
- Mitigation:
  1. Demo account on a +homatest alias (auto-sandbox per project hygiene): the existing `sswift+homatest@swiftdrtv.com` "App Review Family" works; refresh it.
  2. Server-side comp: `billing_exempt = true` on the demo family, so no gate ever fires during review, including the eve chat-turn gate.
  3. Seed it richly: two children with progress, several finalized materials so MaterialCard renders, some chat history worth scrolling.
  4. Email+password credentials in the notes (reviewers use the typed login first), plus a note that SIWA/Google create separate accounts.
  5. Keep the backend green during the review window; do not ship risky prod deploys while "In Review".

### R6. Guideline 5.1.2(i): sharing personal data with third-party AI without explicit consent. Likelihood: HIGH and rising

- Evidence: the November 13, 2025 guideline update requires clear disclosure and explicit permission before personal data is shared with third-party AI. Homa routes chat and family context (child names, ages, progress) through the Vercel AI Gateway to third-party models (report 10 §5). The app today has no consent moment at all, and no privacy surface of any kind (no privacy policy link in-app, report 00).
- Why HIGH: this is the newest named enforcement category and AI apps are the ones being screened for it. A buried privacy-policy sentence does not satisfy "explicit permission".
- Mitigation:
  1. A first-run consent screen in the app (shown once after first sign-in, before the first chat turn): plain-language disclosure that conversations and family info are processed by third-party AI providers to run Homa, with an affirmative Continue. Because web onboarding is where accounts are created, mirror the same consent there, but the iOS binary must show it too: the reviewer only sees the binary.
  2. Privacy policy and terms links in the new Settings/Account section (both URLs already return 200, report 05 §7.8).
  3. Matching privacy nutrition label entries (R7): user content shared with third parties.
  4. Keep the copy inside brand law: sentence case, reassure-before-inform, no em dashes.

### R7. Privacy nutrition labels and privacy manifests. Likelihood: MODERATE (labels), MODERATE (manifests, surfaces at upload)

- Evidence: labels are mandatory at first submission and nobody has drafted them; the app collects email, chat content, child names and birthdays, usage events (`chat.turn_completed` analytics, report 01 §4). Privacy manifests: Expo SDK 56 aggregates them, but the pod graph (Google Sign-In, AsyncStorage's UserDefaults usage, any future crash SDK) must declare required-reason APIs; failures show up as ITMS emails at upload (report 10 §6).
- Mitigation:
  1. Label truthfully: Contact Info (email), User Content (chat, family and child data, photos later), Identifiers (user ID), Usage Data (analytics), all Linked to Identity; Tracking = No (nothing does cross-app ad tracking, and No avoids the ATT prompt entirely).
  2. Declare third-party sharing of user content (the AI providers) consistently with R6.
  3. Run a manifest audit on the store candidate: `npx expo prebuild` then inspect the aggregated PrivacyInfo.xcprivacy; fix before submitting, not after the ITMS bounce.
  4. Data about children: Homa stores data about children entered by the parent, the app is not child-directed (no Kids Category, R8). Answer the label as data collected from the app's users (parents) that includes info about their kids; do not check the Kids Category boxes.

### R8. Guideline 4.7 / 1.2: AI chat safety affordances (filter, report, block). Likelihood: MODERATE

- Evidence: 4.7.1's triad (objectionable-content filtering, a report mechanism with timely response, abusive-user blocking) formally targets chatbot platforms, but App Review commonly expects filtering and reporting from AI chat apps generally (report 10 §5). Homa's chat has neither a report affordance nor any visible moderation statement. The reviewer WILL send adversarial prompts at Homa.
- Mitigation:
  1. Adversarially test the reviewed path yourself before submission: ask Homa for medical dosing, self-harm content, sexual content, weapons instructions, and verify the guardrails hold on the mobile channel. The model's refusals are the "filter" evidence.
  2. Ship a lightweight "Report a response" affordance on assistant messages (long-press or a flag icon that files the message plus context to the founder console) with a stated response path. Small build, large review-note value, and it is the honest thing for a family product.
  3. Blocking is N/A (single-user chat with the assistant, no user-to-user contact); say so in the notes.
  4. Describe all of this explicitly in the review notes (§3): reviewers reward AI apps that name their moderation story unprompted.

### R9. Age rating and 2.3.6 accuracy. Likelihood: LOW if answered honestly at 13+, HIGH if you chase a lower band

- Evidence: the 2025 overhaul (4+/9+/13+/16+/18+) requires accounting for what the AI can surface, not just the default experience. General-purpose AI chat sits at 13+ (report 10 §5). Homa is parent-facing (no child accounts, founder law, report 04 §1.4), so 13+ costs nothing commercially.
- Mitigation: answer the questionnaire per §5 below, accept the computed 13+, keep all listing copy parent-addressed, and do not enroll in the Kids Category.

### R10. Metadata and claims (2.3.1, plus the project's own claims laws). Likelihood: LOW with discipline

- Screenshots must show the 3-tab app that ships, not the orphaned 5-tab build 5 (report 05 §3), and not web mockups.
- Zero paying customers means zero testimonials, ratings, counts, or "trusted by" anywhere in the listing (project law, and Apple 2.3.1 fabricated-content risk in one move).
- The name renders "Homa", sentence case, no em dashes, in every ASC field.
- Support URL and marketing URL must resolve; privacy policy URL is ready (`/privacy` 200).

### R11. Release infrastructure defects that will burn a review cycle. Likelihood: CERTAIN to cause pain if ignored

- Evidence (report 05): build 5 (1.0.0, in ASC) was built from a branch that closed unmerged; main cannot reproduce it; its fingerprint has never matched any OTA update so it can never be patched; the current OTA pipeline publishes into a void (fingerprint `9c5e8a85...` has no binary). Whether 1.0.0 was ever actually submitted for review is unknown outside ASC.
- Mitigation (sequenced):
  1. Founder opens ASC and reports the true state of version 1.0.0 (draft, waiting, rejected-unread). If a rejection has been sitting since 07-21, read it first: it is free intelligence.
  2. Abandon build 5. Do not release it under any circumstances: unreproducible and unpatchable is a production incident pre-committed.
  3. Cut a fresh production build from main HEAD (after the R1-R6 work lands) so the binary matches the live OTA fingerprint; verify the first OTA update actually applies to a TestFlight install before submitting.
  4. Save `ascAppId` into eas.json submit profile so submission stops being founder-interactive; add the OTA fingerprint-drift guard and pin eas-cli.
- One more trap: OTA discipline post-approval. Apple tolerates JS OTA (Expo Updates) so long as updates do not change the app's purpose or unlock review-relevant behavior. Never OTA-ship a paywall, purchase link, or major surface that review has not seen. Encode that as a rule in the OTA workflow docs.

### R12. Texas Declared Age Range API. Likelihood: LOW

- One-time, small: read the signal if present, no-op for adults. Do it in the same PR as the age-rating work so the family-oriented app is not ignoring the API entirely (report 10 §7).

---

## 2. Verdict: staged companion v1.0 then IAP v1.1, versus straight to IAP

**Verdict: staged, and it is not close. Submit a companion-mode v1.0 with zero commerce surface, then decide (not assume) IAP for a later release.**

Reasoning, in order of weight:

1. **IAP is 100 percent greenfield here.** No StoreKit, no RevenueCat, no purchases SDK anywhere in the repo (report 03 §8). The server side needs a schema migration, two new routes (confirm analog, App Store Server Notifications webhook), a two-provider rewrite of `accountAccessDecision`, portal splitting, and a provider-generic reconciliation design inheriting the #274 gap (report 03 §7). That is weeks of correctness-critical billing work with tenancy law all over it, sitting in front of a listing that could otherwise go live now.

2. **The companion posture is the documented safe harbor; link-adjacent selling is the documented rejection magnet.** Tier-identical companion apps pass (forum thread 825551, May 2026); Stripe-link paywalls draw 3.1.1 rejections (thread 799798) and "budget two rejection rounds" advice. A v1 with IAP also activates 2.1(b) (IAP must be visible, functional, reviewable), subscription metadata review, price parity questions against the web, and the sell-then-build tier problem: #293/#297 tiers with no enforced delivery are survivable on the web and a rejection-and-refund magnet inside a binary. An IAP v1 would force the founder's tier rulings onto Apple's clock.

3. **The fee argument for urgency is dead right now.** US external purchases carry zero Apple commission until the remand resolves, and web is Homa's only real acquisition channel today (card-upfront paywall live, all customers arrive via thankshoma.com). The app's v1 job is retention and daily use by existing subscribers, per report 10's decision memo, which this review endorses.

4. **The binary-orphan mess forces a rebuild anyway.** Since a new build from main is mandatory (R11), the fastest path to a LIVE listing is: fix the CERTAIN blockers (R1, R2, R5, R6), neutralize steering (R3), rebuild, submit companion-mode. Adding IAP to that critical path only adds review surface and calendar time.

5. **v1.1 trigger conditions (encode these in the epic):** add StoreKit IAP when (a) App Store organic installs become a measurable acquisition channel, or (b) the district court sets an external-link commission above roughly 10 percent or SCOTUS restores the old regime, or (c) the founder wants in-app conversion for lapsed families. Until one fires, the external-link option (legal in the US storefront, zero fee) can be added to an already-approved app far more gently than to a v1, if ever needed.

**What companion-mode v1.0 means, precisely:**
- No pricing, tier names, purchase CTAs, or trial language anywhere in the binary.
- Expired or walled accounts see account information, not a paywall: "Your Homa plan is managed on the web" plus at most a plain link to the account page. No price on that screen.
- All signed-in subscribers see the identical app (trivially true: one effective plan surface, no tier gating in mobile).
- The agent's iOS-channel prose follows §4.
- The demo account never encounters any of these states.

---

## 3. Review notes: exact text

Paste into App Review Information > Notes. Replace bracketed values before submitting. Keep credentials in the dedicated demo-account fields as well.

---

**About Homa**

Homa is an assistant for homeschooling parents. The parent (an adult) chats with Homa to plan lessons, create printable worksheets, and track their children's progress. Children do not use the app; there are no child accounts and no child-facing features. Homa is a companion app to our web service at https://thankshoma.com, where families create their accounts.

**Demo account (full access)**

- Email: [demo account email, +homatest alias]
- Password: [password]
- This account is a fully set-up family with children, progress history, and saved materials, and it has full access with no payment state to encounter. Please use it to review the complete product.
- Sign in with Apple and Google sign-in are also supported and can be tested with any account; a brand-new account will show a simple "finish setting up on the web" state, because family setup happens on our website.

**Subscriptions**

Homa does not sell anything inside the app. There are no in-app purchases, no paid tiers presented in the app, and no purchase flows. Subscriptions are purchased and managed on our website, and every signed-in user sees the same app regardless of how or where they subscribed (multiplatform service per guideline 3.1.3(b); the app is a companion to the web product). The demo account above has full access, so no subscription state will interrupt review.

**AI content and moderation**

Homa's chat is powered by large language models. Safeguards: (1) the assistant is instructed and constrained to the homeschooling domain, with refusal behavior for unsafe or inappropriate requests; (2) every assistant response can be reported from within the chat, and reports go directly to our team, which responds promptly; (3) chat is one-to-one between the parent and the assistant only; there is no user-to-user communication, so blocking other users does not apply; (4) conversations are private to the signed-in adult. Our processing of conversation content by third-party AI providers is disclosed in the app with explicit consent at first run, in our privacy policy (https://thankshoma.com/privacy), and in the App Privacy details.

**Account deletion**

Account deletion is available in the app under Family > Account > Delete this family’s Homa data. It stops Homa-managed billing, closes family access, and permanently deletes the family's records from Homa's database, authentication system, schedules, and stored files. Limited provider records may remain only as described in Homa's privacy policy.

**Contact**

[Founder name], [support email], [phone]. We respond quickly during review and are happy to demonstrate anything over a call.

---

Notes on the notes: (a) do not cite guideline numbers beyond the one 3.1.3(b) anchor; over-lawyered notes read as a flag; (b) every claim in the notes must be true in the binary at submission time, especially the report affordance and the deletion path, because notes that promise features the reviewer cannot find convert a question into a rejection; (c) if the report-content affordance is cut from v1.0 scope, delete that clause and replace with "objectionable content can be reported via [support email], linked in the app", which is weaker but must then actually be linked in the app.

---

## 4. The agent's own chat is reviewable surface: iOS-channel speech rules

The reviewer will chat with Homa. Whatever the model says inside the binary is app content under 2.1, 3.1.1, and 1.2. Today the model on mobile (a) steers walled and setup-incomplete users to thankshoma.com/onboarding, a payment-bearing page, in prose; (b) directs parents to web-only surfaces ("open Maya's progress report page and you'll see a button") that do not exist on the phone; (c) is told it is on the "web" channel, so it believes panels render that mobile drops silently (the fabricated-panel class, #256/#258).

**Prerequisite:** the iOS client must be distinguishable server-side. Mobile currently authenticates as channel "web" (report 01 §4, turn-recovery queries `channel = "web"`). Either introduce a real channel or header for the mobile client, or land the #258 per-client capability signal first. Until one exists, none of the rules below can be enforced structurally, only by prompt prose, which is fragile. This is the single most important engineering item in this section.

**Must (on the iOS channel):**
1. Offer only actions that complete on this device: conversation, worksheets and printables (MaterialCard renders), memory updates, profile updates, answering questions.
2. When a capability lives on the web, say so honestly and neutrally, once: "That lives on the web today. On your computer, sign in at thankshoma.com and open Maya's progress page." Name the site as a place, never as a button in this app, never as a step the parent should look for on this screen.
3. When the account is setup-incomplete or walled, state it as account information: "Your family's setup finishes on the web at thankshoma.com. Once that is done, everything here fills in." Reassure-before-inform, per brand law.
4. Degrade gracefully on unrenderable tools: until #258 lands, the channel instructions must tell the model that this client renders only worksheets, question cards, and memory chips, and that anything else must be delivered as text.

**Must not (on the iOS channel), each one a potential rejection quote:**
1. Never state a price, tier name, trial length, discount, or the words subscribe, upgrade, purchase, checkout, billing, or payment. (3.1.1 steering in prose.)
2. Never describe the steps of the web checkout or trial flow, and never urge urgency toward it.
3. Never claim a panel, planner, report, or any UI "is open" or "is beside the chat" on this device. (Fabricated-UI class; #269's honesty fix must hold for every tool, not just open_planner.)
4. Never instruct the parent to tap or look for a control that does not exist in the mobile app.
5. Never send a raw URL and rely on it being tappable: mobile markdown renders links as inert text (report 01 §4). Say the domain in words instead.
6. Everything the model says remains bound by the standing content laws (no sibling comparison, no "behind" framing, etc.), which double as the 1.2 objectionable-content posture for a family app.

**Where this lives:** a channel-scoped instruction module in the pattern of `apps/web/agent/instructions/sms-mode.ts`, loaded when the iOS channel/capability signal is present, plus an update to the eve.ts walled-state instruction so the "warmly point to thankshoma.com/onboarding" line becomes channel-aware (on iOS: point to "finishing setup on the web", never to the onboarding/checkout funnel by name). Add behavioral eval fixtures: positive (asks about planner on iOS, gets honest web referral without prices) and adversarial (asks "how much does Homa cost?" on iOS; the model may answer factually if directly asked, but must not volunteer pricing or steer; even for the direct question, the safest review posture is "plans and pricing live on thankshoma.com", which is honest and quote-proof).

That last case deserves its own line: **the reviewer may literally type "how do I subscribe?" into chat.** The eval must pin the answer to the neutral referral shape with no price and no steps.

---

## 5. Age rating questionnaire answers

Answer set for the post-2025 questionnaire (tiers 4+/9+/13+/16+/18+). Apple's stated rule: account for what the AI can surface, not just defaults. These answers are honest for a guardrailed, domain-focused assistant and will compute to 13+.

| Question | Answer | Rationale |
|---|---|---|
| Cartoon or fantasy violence | None | Not present; AI is domain-constrained. |
| Realistic violence | None | Same. |
| Prolonged graphic or sadistic violence | None | Same. |
| Profanity or crude humor | Infrequent/Mild | An LLM can be provoked into mild instances despite guardrails; claiming None for an open text channel is the 2.3.6 trap. |
| Mature or suggestive themes | Infrequent/Mild | Same reasoning: parents may raise mature parenting topics and the model responds. |
| Horror or fear themes | None | Not plausibly surfaced in domain. |
| Medical or treatment information | Infrequent/Mild | Parents ask about child development, learning differences, sleep; the assistant discusses wellness-adjacent topics even though it refuses clinical advice. |
| Alcohol, tobacco, drug use or references | None | Not surfaced; refusals hold. |
| Simulated gambling | None | N/A. |
| Sexual content or nudity | None | Guardrailed; graphic content is refused, and "Infrequent" here would jump the band for no honest reason. |
| Contests or sweepstakes | None | N/A. |
| Unrestricted web access | No | The app embeds no browser; server-side research tools do not expose browsing to the user. |
| User-generated content shared with others | No | Chat is private between the parent and the assistant; no user-to-user content, no social features, no public sharing surface in-app. |
| AI chatbot / AI-generated content capability | Yes, with content filtering and reporting | Answer the capability question truthfully and pair it with the moderation description in the review notes. |
| Messaging / user-to-user communication | No | No human-to-human messaging. |
| In-app purchases | No | Companion v1.0 has none. |
| Advertising | No | None in the binary. |
| Parental controls / in-app age assurance | Not child-directed; app is for adults | Parent-facing product statement; terms require an adult account holder. |

Expected computed rating: **13+**, driven by the AI capability plus the Infrequent/Mild rows. Accept it. Do not tune answers toward 9+ or 4+: a mis-rated AI chat app post-overhaul is a 2.3.6 violation with regulator visibility, and 13+ costs a parent-facing product nothing. Also: do NOT opt into the Kids Category (1.3); it would attach parental-gate, analytics, and data rules built for child-directed apps that Homa is deliberately not.

Texas note (R12): with the Declared Age Range API read wired, an under-18 signal in a 13+ parent-directed app needs no special handling beyond the default; document the no-op decision in code.

---

## 6. The submission checklist, in dependency order

Gate 0, founder facts (nothing proceeds without them):
- [ ] F1. Open App Store Connect; record the true state of version 1.0.0 / build 5 (draft, waiting, rejected). Read any sitting rejection.
- [ ] F2. Verify or add `com.thankshoma.homa` to Supabase Apple provider Client IDs.
- [ ] F3. Supply `ascAppId` (commit into eas.json submit profile).

Gate 1, blocking product work (all CERTAIN/HIGH items):
- [ ] P1. In-app account deletion with SIWA token revocation and data-deletion semantics (R1). Includes a minimal Settings/Account section with privacy policy and terms links.
- [ ] P2. First-run third-party AI consent screen (R6), mirrored on web onboarding.
- [ ] P3. Steering neutralization (R3): reword all four web punts; strip any price/subscribe vocabulary from the binary; expired/walled state as account info.
- [ ] P4. iOS channel signal + channel instruction module + walled-prose fix + the two chat evals (§4). If #258 is close, land it; otherwise ship the minimal channel header now.
- [ ] P5. Fix the two error-blind screens (R4-C).
- [ ] P6. Report-a-response affordance in chat (R8), or consciously cut it and weaken the review notes accordingly.
- [ ] P7. Fresh-account state screen with honest copy (R4-A); optional minimal native family setup if scope allows.

Gate 2, release engineering (R11):
- [ ] E1. New production build from main HEAD after Gate 1 merges; confirm fingerprint matches the OTA channel; verify one OTA update applies on TestFlight.
- [ ] E2. Adversarial pass on the TestFlight candidate: SIWA fresh-account, SIWA existing-account, Google, email; airplane-mode behavior; the §4 chat probes ("how do I subscribe?", "open the planner", unsafe-content probes).
- [ ] E3. OTA drift guard + eas-cli pin + "no review-relevant OTA" rule documented.

Gate 3, App Store Connect package:
- [ ] A1. Privacy nutrition labels per R7.
- [ ] A2. Privacy manifest audit on the candidate build (R7.3).
- [ ] A3. Age rating questionnaire per §5; category Education; NOT Kids Category.
- [ ] A4. Screenshots of the real 3-tab app (6.9" and 6.5"), listing copy within claims laws (R10), support/marketing/privacy URLs.
- [ ] A5. Demo account refreshed, comped (`billing_exempt`), seeded, natural parent name; credentials + §3 notes entered.
- [ ] A6. Submit. During review: prod deploy freeze on review-touching surfaces; monitor Resolution Center daily.

Rejection playbook (pre-agreed so a bounce costs hours, not weeks):
- If 3.1.1 is cited despite the companion posture: respond in Resolution Center citing the multiplatform 3.1.3(b) posture and the US storefront link allowance, attach a screen recording of the demo-account flow showing no purchase surface, and offer to remove the remaining web link outright if the reviewer still objects (it is nice-to-have, not load-bearing).
- If 5.1.1(v) or 4.8 is cited: it is a real defect escaped from Gate 1; fix and resubmit, do not argue.
- If 4.7/AI is cited: point to the report affordance, the consent screen, and the moderation description; offer the founder call.

---

## 7. What this review deliberately does not cover

Product depth (empty Today tab, chat history, push, camera) is launch-quality work, not review compliance; it lives with reports 01/06 and the epic's product track. Nothing in those gaps blocks approval once R4's dead-end mitigation lands. The one product item this review does claim as compliance-adjacent is the agent speech spec (§4), because on iOS the model's words are the app.
