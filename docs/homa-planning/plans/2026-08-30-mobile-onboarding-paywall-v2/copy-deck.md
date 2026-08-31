# Copy deck: every string in the walk, consolidated for D10 review

Status: **D10 CLOSED 2026-08-31: Sidney reviewed every line, both copy
gates ran, and their accepted fixes are folded in below.** This deck is
the string source of truth for implementation and supersedes the inline
strings in [walk-v2-proposal.md](walk-v2-proposal.md). Strings ship
verbatim; an implementation-forced change stops and gets flagged on
gh#1045, never improvised.

Conventions: `{kid}` = child's name; `{subject}`, `{interest}`, `{age}`,
`{n}` = real per-family values; `{today_date}`, `{reminder_date}`,
`{charge_date}` = computed calendar dates. Child pronouns follow the
parent's own words, else "they". Vocabulary law (D7): "worksheet" is the
category word on S1-S4; "her page / {kid}'s page" is the instance word
from S8 on; no screen mixes both. Strings marked EXISTING are shipped
today and unchanged.

## S1 hello

- H: Nice to meet you.
- Body: I'm Homa. I make worksheets for your kids. (DELTA change 5,
  ruled 2026-08-31: one claim, per the corpus's 8-25 word welcome norm;
  the four-job list duplicated S2's options, and the 10pm line is cut
  from the walk, available to marketing)
- Sub: Tell me a little about your family, and the first worksheet I
  make will have your kid's name on it. (APPROVED 2026-08-31; replaced
  "Not a sample. Theirs." and the doubled "questions" per Sidney)
- CTA: Let's go

## S2 intent

- H: What should we do first?
- Option 1: Make a worksheet (APPROVED 2026-08-31; "for my kid" cut per
  Sidney, parallel verb set restored)
- Option 2: Plan our week
- Option 3: Keep our hours
- Option 4: Honestly, all of it
- CTA: Continue

## S3 ages: CUT (RULED 2026-08-31)

Sidney ruled no age question before the examples; the gallery shows a
bunch of examples across all ages, and the loud age label on every card
is what lets her find her kid's speed. Cards run youngest to oldest.
The walk's guest head now collects one enum (intent) instead of two.

## S4 proof gallery (all ages, per the S3 ruling)

- H (worksheet / all-of-it branches): Here's what I make.
- Framing: Real worksheets I made, so you can see. Yours get built
  from scratch. (editor-gate fix: Homa speaks as "I" everywhere)
- Card labels (true generation briefs, ages loud): For a 5-year-old who
  loves dinosaurs · For an 8-year-old into space · For a 12-year-old,
  fractions week · (set spans every band, youngest first)
- Swipe hint: CUT (DELTA change 7, ruled 2026-08-31: no corpus gallery
  prints browse instructions; the peeking card edge is the affordance)
- Reassurance line: CUT at the reader gate (2026-08-31): "the range,
  not a menu" cost a re-read and repeated the framing line's point.
- CTA: Make one for my kid (APPROVED 2026-08-31 as shown, flag
  considered and kept: the phrase carries the examples-vs-yours
  contrast here)
- Plan branch H: Here's a week I planned earlier.
- Plan branch body: A real example: every subject placed across the
  week. Yours gets built around your family's schedule.
- Plan branch CTA: Start with my week
- Hours branch H: Here's a log I kept earlier.
- Hours branch body: A real example: every day counted, no spreadsheet
  in sight. Yours builds up as you tell me what you did.
- Hours branch CTA: Set mine up

## S5 account gate (APPROVED 2026-08-31, corrected during review)

- H: Save your progress.
- Doors: Continue with Apple · Continue with Google · Continue with
  email (the EXISTING three-door sign-in screen relocated here,
  mechanics and per-door copy unchanged, email-code flow unchanged)
- No body text; the header is the only new string.
- Provenance: Sidney cut the email-only form and the longer benefit
  copy; MCP verification found Cal AI's hard gate at ~80% of onboarding
  is literally "Save your progress" + the same three doors, and the
  mid-onboarding gate pattern is winner-validated (Cal AI 31/38,
  Lingokids 7/9, Keiki 39/39). S5 is the latest placement Homa's
  plumbing allows (kid records and the build need the account).

## S6 kids

- Name step H: Who are we making this for? (EXISTING)
- Name CTA: Meet {kid} (EXISTING, dynamic, untouchable)
- Age step H: How old is {kid}? (EXISTING)
- Age step sub (DELTA change 6, ruled 2026-08-31): This sets the
  difficulty.
- Interests H: What's {kid} into right now? (EXISTING)
- Interests sub: Whatever you put here ends up on the worksheet.
  (APPROVED 2026-08-31; Sidney's direction: clarity beats clever, no
  gimmick lines)
- Interests placeholder: Bugs, volcanoes, ocean animals… (EXISTING)
- Subjects H: What's {kid} working on? (EXISTING)
- Subjects sub (DELTA change 6): This picks what the worksheet
  practices.
- Subjects escape chip: I'm not sure yet
- Roster CTAs: That's everyone · Add another kid (EXISTING)

## S7 you (APPROVED 2026-08-31)

- H: And you?
- Body: Your name, so I stop calling you "hey". Your state, because
  homeschool rules are local and I've done the reading.
- Name placeholder: e.g. Sarah (EXISTING)
- State row: Which state do you homeschool in? (EXISTING select sheet)
- CTA: Continue

## S8 making + checklist

- H: Homa is drawing {kid}'s page (EXISTING)
- ETA line: CUT (RULED 2026-08-31: no time claims, the build has no
  ceiling; and no extra wait copy at all, the heading + live progress
  notes + checklist carry the screen)
- Manifest echo: CUT (same ruling: overdone)
- Chapter cover (first chapter only): While I draw, {parent}, tell me
  about {kid}. Every answer builds {kid}'s progress report. (APPROVED
  2026-08-31, "gets smarter" clause cut; DELTA change 4 adds the
  parent's name here, the screen right after she gives it)
- Stop affordance (chapter cover): You can stop whenever you like.
  (APPROVED)
- Chapter tag: {kid} · {subject} · {i} of {total} (APPROVED)
- Chapter receipt: That's {subject} done. {n} answers so far.
  (APPROVED, "filling in" cut)
- Answer options: Easily · Getting there · Not yet · Not sure (EXISTING
  bank)
- Ready banner: {Kid}'s page is ready. CTA: See it (EXISTING; now
  routes through the one close path)
- Skip CTA: Keep exploring while it draws (EXISTING)
- Fine line (under Keep exploring): The page is saved for you either
  way. (APPROVED 2026-08-31; revised from the shipped line to drop the
  time claim and the unexplained "Binder")
- Save error: That answer didn't save. Try it again. (editor-gate
  contraction fix to the shipped string)
- Build failed H: The drawing table hiccupped (EXISTING)
- Build failed body: Nothing's lost. The page keeps trying on its own
  and is saved for you when it's ready. (revises shipped copy: reader
  gate caught the last "Binder"; editor gate matched the contraction)

## S9 reveal (APPROVED 2026-08-31)

- H: Made for {kid}. ("Nobody else." CUT per Sidney: emphasis, not
  information; this revises shipped copy)
- Sub: Built from what you told me: {interest} + {subject} practice.
  (EXISTING pattern, kept: the your-answers-did-this attribution)
- Receipt row: CUT (duplicated the sub's facts as checkmarks)
- CTA primary: Print it (EXISTING)
- CTA secondary: Keep going
- Footnote: Saved. Print it anytime. (revises shipped copy; "Binder"
  scrubbed)

RULE (Sidney, 2026-08-31): the word "Binder" never appears in walk copy;
the product introduces it later. Scrubbed from S10/S11/notifications
below.

## S10 paywall (APPROVED 2026-08-31, rebuilt spare: 41 words, 8
elements, after the simplicity research pass)

- Hero: {kid}'s real page, big, most of the screen. No caption.
- H: Keep {kid}'s pages coming.
- Price sentence (doubles as the charge terms, sits directly above the
  CTA): 7 days free, then $119 a year ($9.92 a month). Cancel anytime
  in the App Store. (reader-gate parenthetical fix; DELTA change 1,
  ruled 2026-08-31, restores the cancel/auto-renew mechanic to the
  paywall itself, where every corpus winner carries it)
- Reminder line (replaces the toggle; the reminder is automatic):
  Free until {charge_date}. I'll remind you 2 days before. (DELTA
  change 2, ruled 2026-08-31: the literal date, per Noom and YNAB, is
  the strongest answer to forgot-to-cancel anxiety. Still
  permission-gated with email fallback: DELTA change 3, the in-walk
  permission beat, was DECLINED by Sidney 2026-08-31)
- CTA: Try it for $0.00
- Caption: Nothing due today.
- Links row: View other plans · No thanks
- Footer: Restore purchases · Terms · Privacy
- "View other plans" sheet: Annual · $119/year ($9.92/month, Best
  value · save 48%, selected) / Monthly · $19/month. Price sentence and CTA
  restate the selection when monthly is chosen: "7 days free, then $19
  a month."
- Build requirements bound to promises (reader gate): the reminder line
  renders only when the notification can actually fire (or falls back
  to email); the free-page credit must be wired before S11's "on me"
  ships; the gallery's every-age claim stays gated on D6 band coverage.
- CUT in the simplicity pass: value bullets, recap lines, the 3-row
  timeline (absorbed into the price + reminder sentences), the reminder
  toggle (now automatic behavior), the mini report card (the D5 decline
  state still shows the report peek, so that proof moves there).
- StoreKit unreachable: We can't reach the App Store right now. Check
  your connection and try again in a moment. (EXISTING) CTA: Try again
  (EXISTING)

## S11 decline (APPROVED 2026-08-31)

- Free-window branch H: Take your time.
- Free-window body: Nothing's locked yet. When that's about to change,
  I'll say so. (reader-gate fix: "free time" read as leisure time)
- Free-window CTA: Look around
- Armed branch H: No pressure.
- Armed body: {Kid}'s page is yours to keep. And when you want one
  more, the next page is on me.
- Snooze chip: Remind me later
- CTA: See {kid}'s page
- Secondary: Actually, start the free week
- (Simplicity pass cuts: "printable from your Binder anytime" and the
  "$19/month" price restatement at the goodbye moment.)

## S12 doors (APPROVED 2026-08-31)

- Speech: The more I know your kids, {parent}, the better every page
  gets. (DELTA changes 4 + 7, ruled 2026-08-31: halved to one sentence
  toward the corpus mascot norm, and the parent's name lands at a peak)
- H: What's next?
- Door 1: Make another page (sub: For a sibling, or tomorrow morning)
  (editor-gate fix: verb-first, parallel with the set)
  [D7-driven change: the shipped door says "Another worksheet / For a
  sibling, or tomorrow's page", which mixes both words on one screen]
- Door 2: Plan our week (sub: Homa builds it with you) (EXISTING)
- Door 3: Just look around (sub: Peek in, no pressure) (EXISTING)

## Confirmed bets (RULED 2026-08-31, ship as deliberate; first test
variables if paywall conversion disappoints, in this order)

1. The continuation-framed paywall headline ("Keep {kid}'s pages
   coming.") vs the corpus-universal unlock/get/start framing.
2. Homa's "I" carrying the money conversation, where corpus mascots go
   silent or switch to corporate "we" at the paywall.
3. The zero-exclamation quiet register, while both direct kid-category
   winners (Keiki, Lingokids) monetize with heat.

Full evidence: work/onboardingandpaywall8-30/research/copy-decks/DELTA.md
(50-app corpus, 2026-08-31).

## Notifications (D13) (APPROVED 2026-08-31)

- Trial reminder (2 days before the charge): Your free week ends in 2
  days. If it's not for you, cancel anytime in the App Store.
  (reader-gate fix: "Settings" was ambiguous between phone and app;
  "the App Store" is Apple's own convention, per Duolingo's retrieved
  paywall)
- Snooze return (after "Remind me later"): You asked me to check back.
  The next page is still on me.
