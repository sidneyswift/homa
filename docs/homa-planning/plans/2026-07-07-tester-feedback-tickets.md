# Tester feedback tickets · 2026-07-07

Ticket list cut from the 2026-07-07 tester voice memos, ordered easiest to
most difficult. Source of truth for every ask:
`docs/homa-planning/journeys/evidence/raw/2026-07-07-tester-voice-memos.md`
(locators below are line ranges there). Ingestion record: build-log
2026-07-07 (late night). File references are as of that night's tree.

Read first: `AGENTS.md` (voice + tenancy laws), the evidence transcript, and
for any UI ticket `docs/homa-design/SKILL.md` (never invent tokens or
components).

## Order at a glance

| # | Ticket | Size | Gate |
|---|---|---|---|
| T1 | Reword "It ran our homeschool first." | XS | Founder wording |
| T2 | Wordmark in app headers navigates home | XS | None |
| T3 | Worksheet closing line speaks to the child; Homa watermark | S | None |
| T4 | Animated Homa mark while thinking | S | None |
| T5 | Points explainer at point of contact + "talking to Homa" primer | S | None |
| T6 | Worksheet art directions (style options) | M | M0-03/M2-05 image pipeline |
| T7 | Chat history: list, reopen, continue past chats | L | M1-02 schema decisions |
| T8 | Per-kid and per-subject chat entry points | L | T7 |
| T9 | Day log: calendar, photo capture, portfolio accretion | XL | Founder scoping session |

Not ticketed: memo 14 (the loop in her words) validates M3-11 as specced, no
new work; memo 5's squiggle praise is a keep-doing note; memos 9 to 12 are
marketing ideas, already extracted to `marketing/signals/` (see build log).

---

## T1 · Reword "It ran our homeschool first." (XS, founder-gated)

Source: memo 8, L137-139. "It makes it sound like Homa's in control instead
of Homa is assisting."

- Where: `apps/web/components/marketing/Stories.tsx` L28, one string.
- The line anchors the testimonial section on the landing page Alessa demos
  July 13, so wording is a founder call. Candidates to offer (agency verbs
  stay with the mom, per the signal
  `marketing/signals/2026-07-07-homa-assists-never-runs.md`): "It helped run
  our homeschool first." / "Our homeschool ran on it first." / "It carried
  our homeschool's paperwork first."
- Acceptance: founder-approved line shipped; no other copy touched; the
  read-aloud test passes (Homa assists, mom runs).

## T2 · Wordmark in app headers navigates home (XS)

Source: memo 2, L73-75. She keeps tapping the top-left Homa and nothing
happens.

- Where: `apps/web/app/chat/chat-client.tsx` L154 and
  `apps/web/app/home/page.tsx` L47; both render a bare `<Logo />`.
- Wrap the mark in a `Link` to `/home` (in /home it is a harmless
  self-link; consistency is the point). Keep the existing right-side Home
  button in chat; this adds the affordance she expects, it removes nothing.
- Acceptance: tapping the wordmark in /chat and /home lands on /home; focus
  ring and hit target follow existing header buttons.

## T3 · Worksheet closing line speaks to the child; Homa watermark (S)

Source: memo 13, L178-191. The sheet's footer message is written to the
parent; she wants it written to the child so she can say it out loud, and a
Homa mark so anything made by Homa is recognizable.

- Where: `apps/web/agent/tools/create_worksheet.ts` (the `encouragement`
  field, L42-45, currently described "for the parent to read aloud") and
  `apps/web/app/chat/worksheet-card.tsx` (printable footer, L65-68).
- Redescribe `encouragement` as one warm closing line written TO the child,
  second person ("Every trident you earned today is proof you're getting
  back on track"). The parent-facing read-aloud guidance already belongs to
  the chat message (the tool's returned `note` instructs exactly that);
  sharpen the note so the agent gives the parent her line in chat.
- Keep "made with Homa for [name]" verbatim (she loves it). Add the Homa
  mark, small and grayscale-safe, beside it in the printed footer (use the
  existing `Logo` art, never new art). This is the D7 footer-attribution
  ruling landing in v0.
- Acceptance: printed sheet shows child-directed closing + mark + made-with
  line; chat message contains the parent-facing line; no schema key renames
  that break older transcripts (description-only change or additive field).

## T4 · Animated Homa mark while thinking (S)

Source: memo 1, L62-69. Blank space while Homa thinks reads as broken; she
suggests the mark bouncing while thinking, static once sent.

- Where: `apps/web/app/chat/message-parts.tsx` (the busy bubble and
  `busyLabel`, L122-147) and `apps/web/app/chat/chat-client.tsx` L202-208.
- Most of MJ-06 already ships: "thinking…" plus per-tool labels render in a
  status bubble. Her session predates or missed it; verify coverage first
  (submitted state through first streamed token must never be blank).
- Add the mark to the busy bubble with a gentle bounce or breathe animation
  while `busy`, static otherwise. Respect `prefers-reduced-motion`; use
  design-system motion only.
- Acceptance: from send to first token something visibly alive is on
  screen; animation stops when the reply lands; reduced-motion users get
  the static mark and label.

## T5 · Points explainer at point of contact + "talking to Homa" primer (S)

Source: memo 5, L99-103. "Can we explain the point system somewhere? ...
You might also want a short tutorial about how to talk to Homa to get the
best results."

- The explainer exists: `/onboarding/method` is the credibility page, and
  the report already links it. The gap is discoverability at the moment a
  number is on screen. Add a quiet inline "how these numbers are made" link
  wherever months-ahead or points render without one (audit
  `report-view.tsx`, `report-preview.tsx`, `growth-story.tsx`).
- Primer: extend the chat empty state (`chat-client.tsx` SUGGESTIONS,
  L46-50) with a short dismissible "getting the best from Homa" card, three
  lines max, voice laws apply (offers, never commands; reassure first).
- Acceptance: every scored number is one tap from the method page; new-chat
  empty state teaches by offering, and the card never returns once
  dismissed.

## T6 · Worksheet art directions (M, gated on M0-03/M2-05)

Source: memo 4, L91-95. Four art directions for worksheet templates:
public-domain artwork, clip art, black and white, real photos.

- Today's worksheets are text-only printables by design (v0 of M2-05); the
  image pipeline (fal.ai + reportlab, M0-03 spike) is not in yet. This
  ticket shapes that pipeline's option surface rather than building art
  now.
- Deliverable: a `style` concept in the worksheet contract (enum seeded
  with her four directions), the design-system printable template
  (`docs/homa-design/templates/worksheet/`) as the layout law, and
  licensing/provenance rules per direction (public-domain verified, stock
  licensed, D4 consent rules untouched).
- Black and white is also a printer-reality feature (toner, coloring-in);
  note it as the likely default.
- Acceptance: written option spec attached to M2-05, one style wired
  end-to-end behind the M0-03 spike, no invented art in the DS.

## T7 · Chat history: list, reopen, continue (L)

Source: memo 3, L79-87. "I also can't see any of my previous chats ... go
back into that chat and be like, can you make me this exact same thing
again, but just with this tweak."

- Today the transcript lives in localStorage under one key per user
  (`chat-client.tsx` L36-44); one device, one thread, New chat erases it.
  The planned fix is M1-02's Postgres conversations table; this ticket is
  its UI half plus the schema landing.
- Scope: persist sessions server-side keyed to family + user (RLS, family
  scoped, isolation checks extended); a history list (title or first line,
  date); open one read-only scrolled transcript; continue = resume that eve
  session or start a new session seeded with its context, whichever the
  eve resumable-session contract supports cleanly (see
  `lib/harness/resume-session.ts` and the M1-14 forward-progress guard
  before choosing).
- Acceptance: `pnpm check:isolation` green with the new table; she can find
  last Tuesday's worksheet chat and rerun it with a tweak; localStorage
  becomes cache only.

## T8 · Per-kid and per-subject chat entry points (L, after T7)

Source: memo 3 (L79-82, click a kid, chat scoped to them) and memo 6
(L107-115, kid card lists subjects already discussed; kid + subject opens a
pre-scoped chat).

- Kid-scoped entry is cheap once T7 exists: each kid card on /home
  (`app/home/page.tsx` L79-101) gets a "talk about [name]" action that
  opens chat with the kid pinned into the turn context
  (`agent/instructions/family-context.ts` already injects family; add an
  explicit focus-child hint).
- Subject chips are the harder half: "subjects you talked about already"
  requires tagging conversations or turns by subject (derive from T7's
  stored sessions; the map's domain vocabulary in `lib/map/` is the
  taxonomy to reuse, never a new one).
- The payoff she named: Homa "could already be looking through everything
  that we've done about math", which is retrieval over past sessions
  scoped kid + subject.
- Acceptance: from /home, kid tap opens a chat that already knows who; a
  subject chip narrows it further; zero cross-family leakage (isolation
  tests cover the new query paths).

## T9 · Day log: calendar, photo capture, portfolio accretion (XL, founder scoping first)

Source: memo 7, L119-133. A calendar she fills with done and planned work,
Homa inserts the worksheets it made, she checks things off, photos of the
child's work catalog into the day, edits land retroactively, and the
portfolio "will just be building it as the days go on."

- This is the biggest new surface in the list and it braids three planned
  tracks: M2-04 observation capture, the J2 daily loop and J4
  compliance/portfolio journeys, and M3-11's efficacy loop (her memo 14 is
  the same loop narrated back). It should not be built from this ticket
  alone; it needs a founder scoping pass to pick the v1 slice.
- Suggested v1 slice to bring to that session: a per-day log fed from chat
  (worksheets Homa made auto-attach; "we did X" utterances become checked
  entries), photo upload into the day (consent + TTL rules from D4 apply to
  family photos), and a month view. Retroactive edit = tap a past day, add.
  Portfolio export stays a later slice (J4 owns the state-report shape).
- Acceptance for the scoping session, not the build: a one-page v1 slice
  agreed, tickets cut into the backlog under M2-04/M3-11 with sizes, and an
  explicit decision on where photos live (storage, TTL, who can see them).

---

## Laws that bind every ticket here

No em dashes anywhere. Sentence case, offers never commands, reassure before
inform, no "behind" framing. HOMA only as wordmark, Homa in prose. familyId
from auth context only; every new query path lands with isolation checks
green. UI from `docs/homa-design/` tokens and components only. Copy changes
on the landing page before July 13 get the founder read-aloud test.
