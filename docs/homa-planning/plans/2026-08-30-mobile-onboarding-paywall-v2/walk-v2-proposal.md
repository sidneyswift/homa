# Walk v2 proposal: the persuasive walk, screen by screen

Status: **v2.2, ALL decisions D1-D16 RULED by Sidney 2026-08-31 (see
the table at the bottom); execution underway on gh#1045 / PR #1046.**
Companion to [spec.md](spec.md). The D1 design-space analysis (twenty
sequences, three-judge panel) that produced this skeleton:
[sequence-options.md](sequence-options.md).

v2 rebuilt v1 after a dedicated interaction-research pass: five parallel
researchers pulled and actually viewed screens from Mobbin and Appllama
(~30 apps; every finding cites a retrieved screen). v2.2 adds the
D1-ruled composite: a guest walk head with the account gate deferred to
after the proof gallery, plus three judge-sourced fold-ins marked below.

Copy status: v1 strings passed one `homa-copy-reviewer` gate; newer
strings (S4-S5, gallery labels, chapters, paywall stack) not yet gated.
Both gates run on final copy after Sidney's tweaks.

## The shape in one paragraph

Twelve beats. The walk head (S1-S4) runs as a GUEST: render-static,
device-local, no server dependency; it collects exactly two small enums
(intent, age bands). The account gate (S5) lands after proof, at peak
desire, reframed from toll to "save this for your kid." Everything from
S6 on is authenticated and server-resumable, unchanged law. The paywall
is the walk's named climax after the reveal. Ruled rule (D1): **the
paywall PRESENTS for everyone; it never arms the wall itself.** Arming
stays report-scored (the existing choke point); the decline branch reads
real journey state.

```
[guest] S1 hello → S2 intent → S4 proof gallery (all ages)
→ S5 account gate → S6 kids → S7 you
→ S8 making (+chaptered checklist) → S9 reveal → S10 paywall
→ S11 decline path (only if she declines) → S12 doors
```

(S3, the age-band gate, was CUT by Sidney's ruling 2026-08-31 during
copy review: no age question before the examples. The gallery shows
examples across all ages, youngest first, with the age label loud on
every card as the mismatch defense, the Hers/Alta pattern instead of the
Keiki gate. S-numbers stay stable; S3 is simply absent. The guest head
now collects one enum, intent, instead of two.)

## Global interaction systems (apply everywhere)

- **Voice**: true, then clear, then memorable, then short. Sentence case.
  No em dash. Verb-first CTAs naming the real action. No fabricated
  proof, counts, urgency, or testimonials, ever.
- **Motion**: press-scale on every pressable (0.97, ~160ms, ease-out
  release); selected-state fills animate (~170ms), never instant-swap;
  WalkScene sky cross-fades (~350ms); entrances are scale-settle
  (0.96 → 1, ~240ms, ease-out), one hero element per screen. Reduce
  Motion collapses all of it to opacity-only.
- **Haptics (new; `expo-haptics`, D16)**: selection tick on every
  chip/answer/option tap; light impact on screen advance; success
  notification on exactly three moments: checklist chapter complete,
  reveal, purchase confirmed. Respects the system setting.
- **Progress**: never a time-remaining label anywhere (zero of six
  retrieved winning onboardings show one). Progress is spatial:
  segmented per-chapter bars with counters (Noom pattern).
- **Controls**: never free-typing mid-run except names and the interests
  field; numbers and ranges are tap tiles or chips; every 10+ option
  list ends with an "I'm not sure" escape chip; multi-select always
  shows checkmarks + "choose all that apply"; disabled CTAs always sit
  under a loud selected state.
- **Honesty framing**: every example asset is labeled as an example
  ("pages we made, so you can see what Homa makes"). Only S9 may say
  "yours."
- **Guest head build law (D1)**: S1-S4 ship render-static with bundled
  assets and zero server calls, so the head stays hoistable/movable and
  fast; the two guest answers replay into the family record at S5 auth
  as one idempotent write. No child data exists pre-auth, ever (keeps
  the account-last legal/schema question parked, spec §4/§8).
- **Accessibility**: Reduce Motion everywhere; VoiceOver labels on
  gallery cards ("Example worksheet for a five-year-old, dinosaur
  counting, card 1 of 3"); `testID`s per spec Outcome 7; Dynamic Type
  verified at accessibility sizes.

---

## S1: hello (guest)

- **Jobs**: identity + promise. Collects nothing.
- **Copy**:
  - H: "Nice to meet you."
  - Body: "I'm Homa. I make worksheets for your kids, plan your weeks,
    keep your hours, and take the questions you'd usually google at
    10pm."
  - Sub: "A few quick questions, then I make something real for one of
    your kids. Not a sample. Theirs."
  - CTA: "Let's go"
- **The experience**: first screen of the app for a new visitor, no
  account yet. First read is the H (0.5s), then four concrete jobs
  (3s), then the promise. One thumb-reach button, nothing to decide.
- **Motion**: greeting fades in 200ms; character idle breath.
- **Research anchors**: Duolingo and Flo both open with a mascot-voiced
  single-idea screen before any question.

## S2: intent (guest)

- **Jobs**: goal-before-features. Collects: intent (guest enum, replays
  at S5).
- **Copy**: H: "What should we do first?" Options: "Make a worksheet for
  my kid" / "Plan our week" / "Keep our hours" / "Honestly, all of it".
  CTA: "Continue".
- **The experience**: full-width option rows (Duolingo select-then-
  confirm: tap selects with animated fill, Continue enables). She
  reconsiders freely; nothing advances under her thumb.
- **Research anchors**: Duolingo full-width rows with disabled-Continue
  (Appllama onb_xcyof).

## S3: CUT (RULED 2026-08-31)

Sidney ruled during copy review: no age question before the examples.
The mismatch defense moves entirely onto the gallery's loud per-card age
labels (the Hers pattern) and an all-ages set ordered youngest first
(the Alta three-at-once insight, extended). Consequence: D6's band
coverage becomes even harder a gate, since every band is now always on
screen for everyone.

## S4: proof gallery (guest, all ages)

- **Jobs**: show real value before asking for effort, at her kids'
  actual level. Collects nothing.
- **Copy**:
  - H: "Here's what I make."
  - Framing: "Real pages we made, so you can see. Yours get built from
    scratch."
  - Card labels (true generation briefs): "For a 5-year-old who loves
    dinosaurs" / "For an 8-year-old into space" / "For a 12-year-old,
    fractions week"
  - Swipe hint: "Swipe to see more"
  - Reassurance touching the CTA: "This is the range, not a menu. Yours
    is next."
  - CTA: "Make one for my kid"
  - Plan branch: planner-week cards. Hours branch: example log card.
    Both still need assets (D6).
- **The experience, layered**: one card ~88% width, next peeking ~12%,
  dots, explicit swipe hint (Keiki prints one for exactly our
  demographic). The set spans every age band, ordered youngest to
  oldest, with the age label loud on every card so she self-selects her
  kid's speed by swiping (the S3 ruling: labels do the matching work,
  not a question). Tap a card: full-screen zoom, pinch to actually read
  the problems, X back. CTA anchored under the dots throughout;
  browsing never gates.
- **Content rule (Photoroom principle, adapted)**: hold one topic
  constant across ages where assets allow (dinosaurs at 5, 8, 12) so
  "same kid-love, different level" reads at a glance, and fill the rest
  of the set with subject variety inside each band.
- **Research anchors**: Keiki carousel (peek, dots, swipe instruction,
  CTA renaming; onb_4hpzv); Hers age-labeled proof cards (Mobbin
  713e6313); Photoroom constant-subject galleries (49af6b73); Hatch
  tap-to-preview + reassurance touching the button; Bears Gratitude
  maker-authored framing. Anti-pattern avoided: one unlabeled example
  for everyone.

## S5: account gate (NEW placement, ruled in D1)

- **Jobs**: convert peak desire into a saved family; the walk's only
  identity ask, placed where the research and all three judges agree it
  costs least. Collects: email (the existing 6-digit code flow,
  mechanics unchanged).
- **Copy (APPROVED 2026-08-31)**: H: "Save your progress." over the
  EXISTING three-door sign-in screen (Continue with Apple / Google /
  email), relocated here with mechanics and per-door copy unchanged. No
  body text. MCP-verified precedent: Cal AI's hard mid-onboarding gate
  is literally "Save your progress" + the same three doors; the
  mid-flow gate pattern is winner-validated (Cal AI 31/38, Lingokids
  7/9, Keiki 39/39), and S5 is the latest placement Homa's plumbing
  allows.
- **The experience, layered**: she arrives excited from the gallery.
  The ask is framed as protecting the thing she is about to make, not
  as a toll. The known risk (she leaves for her inbox and gets eaten by
  40 unread emails) is softened by: the code screen stays live in-app,
  autofills from the iOS mail suggestion bar, and on return the walk
  resumes exactly here (guest answers intact device-side either way).
  On auth: one idempotent write replays intent + bands into the family
  record; server resumability takes over from this beat on.
- **Failure modes defused**: (1) minute-zero gate leak, the reason this
  beat moved; (2) lost momentum in the inbox: code autofill + exact
  resume; (3) replay ghosts: two enums only, idempotent, no child data
  pre-auth.
- **Research anchors**: judge convergence recorded in
  [sequence-options.md](sequence-options.md); BabySparks' late, light
  account gate (research/greenlight-or-equivalent) as the shipped
  precedent for gate-after-child-value framing.

## S6: kids

- **Jobs**: investment after desire. Collects: per child, name, exact
  age, interests,
  subjects. Identical fields to today.
- **Copy**: as shipped: "Who are we making this for?" → dynamic "Meet
  Nora" CTA (untouchable) → "How old is Nora?" → "What's Nora into
  right now?" + "This is what turns a worksheet into her worksheet." →
  "What's Nora working on?" → "That's everyone" / "Add another kid".
  Subject list gains an "I'm not sure yet" chip.
- **Research anchors**: Duolingo ABC name-then-age interpolation; Cal
  AI chunked tiles over typed numbers; MFP "I'm not sure" chip.

## S7: you

- **Copy**: H: "And you?" Body: "Your name, so I stop calling you 'hey'.
  Your state, because homeschool rules are local and I've done the
  reading." CTA: "Continue". State stays the founder-ruled select
  sheet, optional, one tap to skip.

## S8: making + chaptered checklist

- **Jobs**: the honest loader + the investment that funds the paywall's
  proof. Collects: checklist answers (same bank, same optionality).
- **The build wait**: heading "Homa is drawing Nora's page". Honest ETA
  once, not ticking: "Takes about a minute and a half. It finishes on
  its own either way." Real progress notes stay; a manifest card echoes
  her answers back: "A history page for Nora. Dinosaurs, obviously."
- **The checklist, rechaptered (D15)**: subject chapters with counters
  ("Nora · Science · 2 of 4") and per-chapter segmented bars; the
  time-left line is deleted; "You can stop whenever you like" promoted
  to the chapter cover. Chapter cover line (first chapter only): "While
  I draw, tell me about Nora. Each answer builds her progress report,
  and the report is how every page after this gets smarter." Chapter
  receipts (deterministic templates): "That's Science: 4 answers in.
  Her report is filling in." Single-tap advance stays; every tap gets a
  haptic tick + answer-fill flash.
- **Recovery fallback (D1 fold-in)**: skipping the checklist here never
  strands the report; the same component already renders in chat, and
  Homa offers it there later. The scoring/arming point never moves.
- **Mechanism**: the ready banner's "See it" routes through the same
  close handler as the checklist's own close (one finalize path, spec
  Outcome 6). MakingShow wired into the no-questions branch (D9).
- **Research anchors**: Noom chaptered quizzes (Mobbin 0592dfbd); Cal
  AI interstitial cadence + computed-insight payoff (onb_n78zl); Flo
  per-tap benefit expansion (onb_jywav); Remini/Google Photos honest
  ETAs; Canva answer echo (2dcf4365).

## S9: reveal

- **Copy**:
  - H: "Made for Nora. Nobody else."
  - Sub: "Built from what you told me: dinosaurs + history practice."
  - Receipt row (each item true per build): "Built for age 11 ✓
    Dinosaurs ✓ History practice ✓ In your Binder ✓"
  - CTA: "Print it" (primary), "Keep going" (secondary)
- **The experience**: gold ceremony sky cross-fades in (~400ms), the
  page scale-settles (rhyming with S4, proof and payoff same gesture),
  success haptic, receipt row fades in item by item (~80ms stagger).
  The page is tappable: full screen, pinch to read every problem. Print
  opens the iOS print/share sheet.
- **Research anchors**: Remini full-bleed artifact + checkmarked
  receipt (oth_32w0c, oth_yqg6v); ChatGPT artifact-first with small
  action row (Mobbin f4748dcf).

## S10: paywall

- **Jobs**: the ask at the peak, procedural transparency in place of
  salesmanship. PRESENTS for everyone; never arms (D1 rule). Collects:
  the purchase.
- **The stack, top to bottom** (trial variant, D2):
  1. Her real page, angled thumbnail, her kid's name visible.
  2. H: "Keep Nora's pages coming."
  3. Recap as a **visual mini report card** (D1 fold-in): a small
     rendered fragment of her actual progress report (subject chips +
     answer count) beside the page thumbnail. Conditional: checklist
     skipped = page only, never a zero count. At zero customers this is
     the entire legally usable social-proof budget.
  4. "How the free week works:" vertical 3-step timeline, REAL computed
     dates, icon nodes on a rail:
     "Today, Sep 1: everything unlocks. Pages, plans, hours, the 10pm
     questions." /
     "Sep 6: I remind you, 2 days before it ends." /
     "Sep 8: $19/month starts, unless you've canceled. Printed pages
     are yours either way."
  5. Reminder toggle (D13): "Remind me before the trial ends", ON by
     default; flipping triggers the iOS notification-permission ask.
     Build requirement: the mobile reminder must verifiably exist.
  6. Plan cards (D3, ruled): two cards, annual selected by default.
     Annual card: "Annual · $119/year" left, "$9.92/mo" right, attached
     badge tab "Best value · save 48%" (mathematically true, the only
     badge claims law permits). Monthly card: "Monthly · $19/month".
     The 7-day trial attaches to BOTH plans, so trial framing never
     steers the plan choice. Selection animates like every other chip.
  7. Terms, one line, state-reactive to the selected card (the Flo
     rule: what the button buys is always restated): annual: "Free for
     7 days, then $119/year until you cancel in Settings." monthly:
     "Free for 7 days, then $19/month until you cancel in Settings."
     The timeline's day-7 row is state-reactive the same way.
  8. CTA: "Try it for $0.00" (D14, ruled).
  9. Caption under the CTA (D1 fold-in): "Nothing due today."
  10. Centered, plain: "No thanks"
  11. Footer: "Restore purchases · Terms · Privacy" (required on every
      paywall surface).
- **States**: StoreKit loading = skeleton plan line cross-fading into
  the loaded price; unreachable = existing "Try again" screen; success
  = success haptic, straight to S12.
- **Research anchors**: Blinkist single-SKU timeline stack (pay_8qbjf);
  Cal AI literal charge date (pay_8ixcs); Facetune "Try for $0.00";
  PictureThis reminder toggle (pay_kx3d4); Duolingo centered "NO
  THANKS" (Mobbin 9bbb4867); Copilot quiet footer row. Anti-patterns
  avoided: bare "Continue", popularity badges, review quotes, urgency,
  dense legal paragraphs, missing Restore.

## S11: decline path (D5 RULED 2026-08-31: the four-piece kept state)

Only if she taps "No thanks." Branches on real journey state (readable
per spec Outcome 6). Design principle: nothing new generates for free,
nothing she earned is ever taken away, and Homa keeps a scheduled reason
to return.

- **Free window still open** (no report yet): H: "Take your time."
  Body: "You've still got free run of me for now. Look around, and when
  the free part is about to end I'll say so plainly." CTA: "Look
  around".
- **Wall armed**:
  - H: "No pressure."
  - Body: "Nora's page is yours to keep, printable from your Binder
    anytime. And when you want one more, the next page is on me. After
    that it's $19/month."
  - Chip: "Remind me Friday" (schedules a return notification; same
    machinery as D13's trial reminder, permission-gated)
  - CTA: "Take me to the Binder". Secondary: "Actually, start the free
    week".
- **The kept state (what declining actually opens)**, all four ruled:
  1. **Read-only Binder**: her real pages viewable and printable
     forever; nothing new can be made from there; everything else stays
     walled with the paywall one tap away. Scoped `BillingGate`
     exception.
  2. **Started-report peek**: her checklist-built report fragment
     visible under the existing report-lock semantics (open subjects
     shown, the rest locked). Her own data as the honest pull; reuses
     web's lock mechanics, computes nothing new.
  3. **One free page (the win-back, value not discount)**: a single
     server-side credit on the family, offered once at decline,
     redeemable anytime from the Binder or this screen. Redemption runs
     the normal pipeline and ends in a full reveal → paywall
     re-present, a guaranteed second peak at doubled sunk value. Never
     stacks, no expiry messaging, no urgency.
  4. **"Remind me Friday" snooze**: her chosen return moment, delivered
     as a notification that deep-links back to the paywall with her
     Binder state intact.
- No discount, no countdown, no guilt, and the email lifecycle (S5's
  address) keeps working the relationship ambiently.

## S12: doors

- **Copy**: Speech: "Nora's going to grab that one the second it
  prints. And the more I know your kids, the better every page gets."
  H: "What's next?" Doors: "Another worksheet" / "Plan our week" /
  "Just look around".
- **Motion**: staggered door entrance (~60ms apart, fade-up).

---

## What is deliberately NOT in this walk

No population stats, no fake loaders, no pain-frequency batteries, no
pricing invention, no testimonial-style proof, and no child data before
the account exists (the full account-last variant stays parked on the
schema + legal question, spec §8).

## Decisions (D1 ruled; the rest taken one at a time)

| # | Decision | Status / recommendation |
|---|---|---|
| D1 | The skeleton | **RULED 2026-08-31: v2.2 composite** (guest head, deferred gate; see sequence-options.md) |
| D2 | 7-day free trial (StoreKit intro offer) | **RULED 2026-08-31: yes, 7 days.** The S10 trial stack is the shipping variant; the no-trial variant text stays only as provenance. Founder action: configure the intro offer in App Store Connect |
| D3 | Annual SKU | **RULED 2026-08-31: ship annual now at $119/year** ($9.92/mo, save 48%), default-selected, trial on both plans. Founder action: create the annual product in App Store Connect |
| D4 | Price | **RULED 2026-08-31: $19/month confirmed.** All S10 strings keep the literal price |
| D5 | Decline state | **RULED 2026-08-31: all four pieces.** Read-only Binder + started-report peek + one free-page credit + "Remind me Friday" snooze (see S11) |
| D6 | Gallery assets | **RULED 2026-08-31: full set approved.** Produce one 9-12 + one 13+ page (completing dinosaurs at three levels), planner-week card, hours-log card, all via the real pipeline; hero = Maya's paintbrush adventure pending final-gallery eye. Band coverage stays a ship gate |
| D7 | Vocabulary | **RULED 2026-08-31: the split.** "Worksheet" at first contact (S1-S4), "her page" once one exists (S8 on), never both on one screen |
| D8 | Wall mechanism | **RULED 2026-08-31: approved.** Trigger unchanged, S10 presents and never arms, "See it" bypass collapsed, decline reads journey state |
| D9 | MakingShow | **RULED 2026-08-31: wire it** into the no-questions branch, with the ease-out exit fix and the narrowed accessibility wrapper |
| D10 | Copy, line by line | **RULED 2026-08-31: complete.** Sidney reviewed every screen one at a time; both copy gates ran on the result and their accepted fixes are folded in. [copy-deck.md](copy-deck.md) is the string source of truth and supersedes inline strings elsewhere in this doc |
| D11 | Web/native split | **RULED 2026-08-31: confirmed.** Same price and trial on both; only the card-ask placement differs (web at signup, native at the peak) |
| D12 | Motion bar | **RULED 2026-08-31: four references, one per surface.** Things 3 governs the tactile layer (chips, answers, checklist taps); Apple system apps (Journal, Weather) govern transitions and shared elements (screen advances, gallery zoom, page entrances); Headspace/Calm govern the waits (the build, sky cross-fades); Duolingo's lesson-complete beats govern celebrations (chapter receipts, reveal, purchase success). The device-recorded walkthrough (spec §3) is judged surface by surface against its own reference |
| D13 | Reminder machinery | **RULED 2026-08-31: build it.** One local-notification module powers the paywall's trial-end toggle (ON by default) and the D5 snooze; native code, needs a binary release |
| D14 | Paywall CTA | **RULED 2026-08-31: "Try it for $0.00"**, with "Nothing due today." beneath; copy gates still stress-test the register |
| D15 | Checklist rechaptering | **RULED 2026-08-31: yes.** Subject chapters + counters + receipt beats, time-left deleted; applies to the shared component in both walk and chat |
| D16 | Haptics system | **RULED 2026-08-31: yes, the spare system** (ticks + advance impacts + three success moments; `expo-haptics`, same binary release as D13) |

## Verification hooks

Funnel events per beat (spec §3). Decisive rates: S4 swipe + zoom rate,
S5 gate conversion (the metric the D1 ruling bets on; compare against
the old minute-zero gate's rate), S10 view rate (~100% of completions
by construction), S10 → subscribe, decline-branch distribution.
