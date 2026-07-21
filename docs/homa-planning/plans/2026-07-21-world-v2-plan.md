# /world v2: stage-gated rebuild plan (G0 package)

Status: RULED (founder, 2026-07-21): D1 process approved as proposed; D2
architecture A, hybrid journey-mirror; D3 literal referents adopted; D4
v1 consent patch approved to ship immediately. G1 is in flight.
Owner process: Claude PMs and executes; Sidney approves each gate. No stage
builds on an unapproved predecessor.

v1 (commit 71ab19d, live at /world, noindex) proved the pipeline: stills →
frame-locked video chains → scroll-scrubbed page, mobile-first. v2 treats
the page as a conversion instrument, not a demo. This document records the
research behind the v2 narrative, the stage gates, and the open decisions.

## 1. Research findings that bind v2 (sources: 4-agent research pass)

### What v1 got wrong (critique agent, against the live page)
- The offer is invisible for ~85% of the scroll: "report" first appears in
  scene 5 of 6, while the topbar CTA references it from second one. The
  track is 12.65 viewport-heights; all differentiated material sits in the
  last third. A scene-2 bouncer leaves thinking "an AI you can text that
  makes worksheets."
- No proof beat anywhere (the static landing has a live sample-report
  render, a methodology line, a founder story, an FAQ). No problem
  tension, no child in the story, and the mom is not clearly the
  protagonist.
- Two dangerous lines: "Homa already knows where each child is" over a
  park scene reads as location tracking; "Homa listens, keeps the
  evidence" reads as surveillance with a courtroom noun. Both need
  consent-first rewrites.
- Scenes 5 and 6 sell two different reports (one from listening to real
  days, one from five minutes of questions) with no bridge.
- Connectors carry 34% of the scroll with zero copy or offer.
- The page ships no instrumentation, so v1 vs v2 vs static cannot be
  decided from data.
- Keep: persistent CTA + Logo escape, both finale doors, honesty
  discipline (no fabricated proof), anti-guilt finale, tokens, graceful
  stills-only degradation.

### What the new onboarding journey means for the story (journey agent)
Source: docs/homa-planning/plans/2026-07-21-chat-first-onboarding.md
(branch claude/new-onboarding-flow; spec only, not yet built).
- Onboarding becomes a 15-minute conversation with the real agent: she
  talks, Homa already knows her kid by minute 4, the report reveals
  in-session as a chart drawing itself, a planner beat gives the first
  check-off, and the exit ramp promises tomorrow. Then a specced week:
  evening debrief, a morning brief that noticed her family, artifacts
  arriving as kept promises.
- Landing implications: promise a conversation, not a questionnaire; show
  the report as a moment (a chart drawing itself in front of her), not an
  emailed document; promise-then-surprise is the product's signature
  rhythm and the page may use it, but must not depict instant generation.
- Safe copy envelope until founder ruling P1 lands: "free report, no card
  needed, first stretch free." No pricing, week counts, or credit
  mechanics on the page. While HOMA_CHAT_ONBOARDING is dark the CTA lands
  on the old card flow, so the page leans on flow-agnostic beats and does
  not depict chat bubbles as the signup UI.
- Emotional throughline to mirror: seen → safe (never graded) → relieved
  → capable → proud → validated as a teacher.

### Landing-page and psychology laws (CRO agent)
- Story-led journey-mirror architecture is right for this audience:
  narrative transportation lowers counterarguing in AI-skeptical,
  high-consideration visitors, and mirroring the product journey is
  process simulation, which beats outcome fantasy for follow-through.
- Pain gets ONE beat of recognition, never agitation: guilt appeals
  boomerang (reactance), and threat without adjacent efficacy produces
  avoidance. The anti-guilt law is empirically correct, not just taste.
- The mom is the protagonist; Homa is the helper. Audit every scene.
- Congruence: "stylized rendering, literal referents." Each scene's
  visual must depict that scene's claim (week cards in the planner scene,
  a printed worksheet in the studio, the report chart in the progress
  beat). The clay style supplies novelty; the objects supply relevancy.
  Decorative-only clips are wasted or harmful.
- Mobile attention: ~57% of viewing time above the fold, 74% in two
  screenfuls, ~10-second stay/leave. First viewport must be a complete
  landing page. Persistent quiet CTA once scene 1 has played; the soft
  ask (ungated sample report) surfaces around the progress beat, the hard
  ask at the finale.
- Strongest legal proof for this brand: hands-on experience (the sample
  report), method/privacy transparency near the CTA, a short founder
  note. No fabricated social proof, ever.

### Scrollytelling craft laws (scrolly agent)
- Cap the story at ~5 scenes / 2-3 minutes; mobile cut gets FEWER beats,
  not a squeezed timeline. Target: total track ≤ ~8 viewport-heights.
- Never manipulate scroll speed or momentum (1:1 mapping only; v1 already
  complies). Copy stays pinned DOM text; the world moves behind it.
- The first paint is pure HTML/CSS + poster; video lazy-loads behind it.
  Stills-only is a designed experience, not a fallback. Performance gate:
  mobile Lighthouse 90+, LCP < 2.5s on mid-tier Android over 4G.
- End the story ON the conversion moment, then optionally continue into
  one conventional section (proof/FAQ) below.
- Skip affordances: labeled final dot / an explicit low-key "skip to the
  free report" once scene 2 has played; reduced-motion static variant is
  first-class.
- Precedent: miniature-world sites win top awards (Igloo Inc 2024) but as
  desktop showcases; pre-rendered video scrub is exactly how to get that
  look at phone cost. Winners (Apple, Adidas) pair heavy motion with
  extreme copy discipline: one headline + at most one line per beat.

## 2. Stage gates

- G0 (this doc): process + narrative architecture + congruence stance +
  v1 copy patch decision.
- G1 Beat sheet: scene-by-scene skeleton (intent, message, feeling, CTA
  posture per scene) + voice-of-customer pass (mine founder console
  chats, call transcripts, drip replies for the ICP's own words) +
  competitive/AI-labeling check + instrumentation spec. Approval locks
  the beats.
- G2 Look boards: 2-3 art directions, each anchored by 1-2 real generated
  stills (~8.5 credits each), including "keep v1 clay" as one board.
  Approval locks style.
- G3 Copy deck: full copy per scene with alternatives on contested lines,
  through the homa-copy-writer rulebook before review. Approval locks
  copy.
- G4 Visual storyboard: the final stills in the locked style with camera
  notes (these seed the chains). Last cheap gate. Approval locks visuals.
- G5 Motion previz: full chain on the draft video tier (~quarter cost) as
  a real scrubbable page. Approval greenlights final spend.
- G6 Final render + build + instrumented preview + phone test + ship
  decision.

Cost posture: G2+G4 ≈ 60-120 credits; G5 ≈ 150-250; G6 ≈ 800-1,200.
Single-scene iteration never restarts the chain (seam law: only the
neighbouring rendered frames matter).

## 3. Founder decisions (G0)

- D1 Process: approve the gates above (or adjust cadence/format).
- D2 Narrative architecture for G1:
  - A (recommended): Hybrid journey-mirror. Scene 1 is a complete landing
    page (category + promise + offer named + CTA). Scene 2 is one
    recognition beat (the prep pile, named calmly, resolved immediately).
    Scenes 3-4 mirror the new onboarding journey (the conversation that
    knows your kid; the day it powers: pages/planner/record folded into
    the mom's day). Scene 5 is the proof beat (the report chart drawing
    itself; sample-report soft ask). Finale: the little home, reassurance,
    hard ask.
  - B: Classic problem-agitate-solution (research says agitation
    boomerangs for this audience; not recommended).
  - C: Hero then benefits tour (weakest transportation; invites
    counterarguing; not recommended).
  - D: Keep v1's day-in-the-life order, fix copy only (keeps the late
    offer problem; not recommended).
- D3 Congruence: adopt "stylized rendering, literal referents" (product
  artifacts visibly in the world: worksheet, week cards, report chart) vs
  keep scenes atmospheric-only.
- D4 v1 copy patch now: ship the two-line consent rewrite on the live
  page today ("knows where each child is" → academic phrasing; "listens,
  keeps the evidence" → "when you choose to record a lesson...") ahead of
  v2, or leave v1 untouched as-is until v2 replaces it.

Decisions recorded once made; this section then becomes the ruling record.
