# D1 deep-dive: twenty sequences, compared

Written 2026-08-31 for the D1 decision (the walk's skeleton). Method:
twenty genuinely distinct sequences enumerated across the five axes that
actually vary, tiered with reasoning, four finalists stress-tested by a
three-judge panel (conversion economics, the mom's lived experience,
engineering risk), then one composite recommendation. Companion to
[walk-v2-proposal.md](walk-v2-proposal.md).

Beat vocabulary: hello (identity), intent (goal), ages (band gate),
proof (example gallery), kids (child capture), you (parent capture),
build (85s make + checklist), reveal, paywall, decline, doors, account
(email-code gate, today BEFORE the walk).

## The twenty

### Family A: proof timing (when does she see value?)

1. **Status quo (control).** hello → intent → kids → you → build →
   reveal → doors, wall ambushes on the tabs. No proof beat, honesty
   defect, ambush economics. Tier D. Exists only as the baseline.
2. **v2.1 (the standing proposal).** intent → ages → age-matched
   gallery → effort → reveal → paywall at the peak. Aligns with every
   validated pattern at the smallest delta. Tier A.
3. **Proof cold-open.** An unfiltered three-age worksheet strip on
   screen one, before intent (the Alta/MFP pattern). Zero questions
   before proof, but violates goal-before-features (the single
   best-validated ordering) and unfiltered proof is weaker proof.
   Tier C+. Kept as the fallback if S3 ever measures as a drop point.
4. **Proof woven into intent.** Example thumbnails ON the intent
   options; no gallery screen. One less beat, but thumbnails are
   unreadable (the whole point of the gallery is tap-to-zoom
   readability) and one screen doing two jobs does neither. Tier B-.
5. **No-proof ultra-short.** hello → name+age → build → reveal. Fastest
   possible (~4 taps to build), but guts personalization (no
   interests = a generic page, which weakens "Made for Nora. Nobody
   else.") and re-creates the all-effort-before-any-value gap. Tier C.
6. **Checklist-before-build.** The full questionnaire first, so the
   first page is deeper-calibrated. Seventeen questions before ANY
   value is the exact fatigue anti-pattern the research warns about;
   drop-off would be catastrophic. Tier D.

### Family B: paywall timing

7. **Card-upfront (web parity).** Trial gate before the walk, native
   port of web's 2026-07-28 model. Kills the walk's persuasion job
   before it starts; native App Store norms and every retrieved
   comparable favor value-first. If ruled, it is a business ruling, not
   a design conclusion. Tier C for native.
8. **Ransom reveal.** Paywall between build and reveal: pay to see her
   kid's page. Poisons the artifact, violates "a celebration is a
   receipt," invites refunds and review trouble. Tier F. The boundary
   marker.
9. **Fused reveal+paywall.** One screen: page above, offer below.
   Guarantees view rate, but the ask arriving WITH the gift reframes
   the gift as bait, retroactively. Winners keep them discrete. Tier C+.
10. **Second-create wall.** Paywall only when she asks for the second
    artifact (the never-built D4 from the 2026-08-18 plan). Deeper
    value first, but re-creates the ambush dynamic and view rate
    craters. Tier C.
11. **Ambient paywall.** Never forced; upsell chips only (the
    Duolingo/ChatGPT model). Contradicts the standing hard-wall ruling
    and Duolingo's economics do not exist at zero customers. Tier C-.
12. **Two-step soft commit.** A "try Homa free, nothing due today"
    opt-in screen after proof, card at the end (Cal AI's shape). The
    frame is theater on StoreKit (no trial actually starts at the soft
    ask), which the mom-judge called betrayal-adjacent and the
    eng-judge flagged for term drift. Tier B minus the screen; its
    "nothing due today" line is gold and gets stolen. See judges.

### Family C: account timing

13. **Deferred gate.** hello → intent → ages → proof run as a guest
    (render-static, device-local, two tiny enums of state); the
    email-code gate lands AFTER the gallery, framed as "save this for
    your kid"; kids capture onward stays post-auth and server-resumable.
    Schema-safe (child rows still post-auth). Touches the 2026-08-18
    front-door design; loses win-back emails for first-30-second
    bounces. Tier A-. See judges: all three independently converged
    here.
14. **Account-last (BabySparks/Walkify).** Child captured pre-account,
    account at the reveal. Blocked today: child rows require familyId,
    plus the child-data-before-account legal question (spec §4/§8).
    Tier B-for-later. Parked, not dead.

### Family D: artifact and investment strategy

15. **Checklist-decoupled lean walk.** No questions during the build;
    checklist later in chat. Saves the least interesting work while
    changing the most important mechanism (report scoring moves, so
    wall arming moves for decliners: a business-gate change disguised
    as UI simplification, per the eng judge). Uncovered 85s wait is the
    worst abandonment window. Tier C+. Its chat-checklist becomes the
    recovery fallback, stolen.
16. **Dedicated report-proof beat.** After reveal, a screen showing the
    progress report the checklist just built, then paywall. The proof
    is real and stacks, but a whole extra beat lands at maximum
    fatigue. Folded instead: the paywall recap becomes a visual mini
    report card. Tier B+ as a screen, A- folded.
17. **Intent-segmented tracks.** Divergent walks per intent (worksheet
    track, planner track, hours track), each with its own artifact.
    Maximal relevance, triple surface cost, and it dilutes the one
    crown-jewel moment; the planner is less emotionally loaded than a
    kid's page. Intent should tint copy and examples, not fork the
    walk. Tier C.
18. **Two-artifact sandwich.** Reveal kid one's page, start kid two's
    build, paywall while it runs ("keep them both coming"). Sunk-value
    logic is sound but it doubles time-to-paywall and risks a mid-funnel
    build failure; doors deliver the second artifact post-subscribe
    anyway. Tier B-.
19. **Schedule-close.** A "set your week" habit beat between reveal and
    paywall; the paywall sells the rhythm. Stacks a commitment ask
    before the money ask; rhythm sells better AFTER subscribing
    (doors → plan our week). Tier B-.
20. **Commitment ritual.** A Flo-style press-and-hold pledge between
    reveal and paywall. Memorable, but manipulation-adjacent for a
    skeptical parent and off-voice for quiet authority. Tier C+.

(Also considered and excluded from the twenty as a form-factor change
rather than a sequence: replacing the walk with chat-first conversation.
It contradicts the standing native-walk direction, pays chat latency per
answer instead of a tap, and chat's strength lands post-onboarding.)

## The axes, settled

- **Proof timing**: after goal, after age, before effort. Research pins
  this three ways (goal-before-features validation; age-before-content
  in all three retrieved kids-ed apps; the fake-loader verdict). Kills
  1, 3, 5, 6 as primaries.
- **Paywall timing**: after the peak, discrete, reached by everyone.
  Kills 8, 9, 10, 11; 7 is a business override, not a winner.
- **Account timing**: the genuinely live axis. The walk head can run as
  a guest cheaply (13); full account-last (14) stays parked.
- **Investment density**: the checklist during the build is the honest
  dual-use of the wait and the paywall's proof budget. Kills 15 as a
  primary, keeps its chat fallback.
- **Artifact count/type**: one kid, one page, one peak. Kills 17, 18;
  19, 20 defer to post-subscribe surfaces.

## Judge panel (three lenses, four finalists)

Finalists tested: F1 = v2.1 as proposed; F2 = lean/no-checklist;
F3 = two-step soft commit; F4 = pre-auth proof head.

- **Conversion economist**: F1 > F3 > F4 > F2. Attack on F1: "the cold
  account gate at minute zero is the single most expensive screen
  placement in the funnel; every downstream win multiplies that leak."
  Steal: F4's deferred gate (gate at peak desire, keep server
  resumability after it), F3's "nothing due today" as a caption not a
  screen, F2's chat checklist as recovery.
- **The mom**: F4 > F1 > F2 > F3. Same attack from the other side: "you
  want my email before I even know what you are? That's a spam trap."
  Called F3's soft-promise-then-card-later betrayal ("so it WASN'T free
  today"), F2's empty wait the place the reveal happens to nobody.
  Steal into the winner: F1's entire back half, wholesale.
- **Engineering**: F1 > F3 > F2 > F4. F1 is purely additive to every
  load-bearing seam. F4's landmine is the auth-time replay of
  device-local data; but the steal list notes the fix: keep the walk
  head render-static so only two tiny enums (intent, age bands) ever
  need replaying, not child rows. Also named F1's real landmine: two
  triggers for one gate (a checklist-skipper reaches the paywall with
  the wall unarmed; define precedence before writing the decline
  branch).

Convergence: three judges, three lenses, one shared conclusion. The
strongest single change available to the v2.1 skeleton is not any beat
inside the walk; it is moving the email gate from minute zero to the
moment right after proof.

## Recommendation: v2.2, the composite

```
[guest] hello → intent → ages → proof gallery
→ account gate ("Save this for your kid": email code)
→ kids → you → build + chaptered checklist → reveal
→ paywall → decline → doors
```

Deltas from v2.1, all judge-sourced:

1. **Deferred account gate.** The walk head runs as a guest; the
   email-code screen lands after the gallery, reframed from toll to
   save-your-progress. Costs: touches the 2026-08-18 front-door design
   (needs Sidney's explicit call, it is not mine), loses win-back email
   capture for first-30-second bounces, and the head's two answers
   (intent, bands) replay into the family record at auth (one
   idempotent write; child data never exists pre-auth, so the schema
   and legal parking of option 14 stays parked).
2. **Mini report card in the paywall recap** (16, folded): the recap
   renders as a small visual report fragment built from her checklist
   answers, not a sentence. Zero customers means this is the entire
   legally usable social-proof budget.
3. **"Nothing due today." caption** under the $0.00 CTA (12's honest
   kernel, on the real card screen only).
4. **Chat checklist as recovery** (15's kernel): a skipped checklist
   still finds a scoring moment later; the arming point never moves.
5. **Gate precedence rule** (eng landmine): the S9 paywall PRESENTS for
   everyone; it never arms the wall itself. Arming stays report-scored.
   The decline branch reads real journey state and says which world she
   is in (already in S10's two-branch copy; now stated as a rule).

Fallback if the front-door change is unwanted: **v2.1 exactly as
proposed** captures roughly 90 percent of the value; the gate placement
is the only structural difference, and the walk head being
render-static (delta 1's build style) keeps the hoist cheap to do later
without a rewrite.
