# House style · voice, bans, formats

The editor gate (`marketing-copy-editor`) enforces this file. The scorer
(`marketing/evals/score_bundle.py`) asserts the mechanical parts (banlist, em
dash, casing, limits). Sources of truth this file compiles: repo `AGENTS.md`
voice laws, `docs/homa-design/` guidelines, and the binding claims rules in
`docs/homa-planning/journeys/07-positioning-messaging.md` §6.

## Voice principles

1. Warm, plain, unhurried. Write like the co-op friend who happens to know the
   answer, never like a brand.
2. Reassure before inform. She hears "you're doing fine" before any fact,
   number, or suggestion.
3. Offers, never commands. "Want to try this tomorrow?" not "Do this tomorrow."
4. Sentence case everywhere, including headings and buttons.
5. One idea per piece. The article proves one thing; the video shows one thing;
   the email asks one thing.
6. Show the reasoning. She distrusts conclusions that arrive without their work.
7. Calm is the brand. If a line manufactures urgency, fear, or guilt, it is off
   brand even if it converts.
8. Clarity beats personality (founder ruling 2026-07-08). One idea per
   sentence, plain names for things, no metaphor stacks, no meta-commentary
   about the copy itself. Fewer words is not the goal, fewer ideas per
   sentence is: a 3-word line can confuse as hard as a 20-word one, and
   cutting words that carry meaning raises the load instead of lowering it.

## Hard bans (each is also a scorer assertion or an editor check)

- The em dash character, anywhere. Use a comma, period, colon, or mid-dot.
- "HOMA" in prose. It is "Homa" in sentences and conversation; the all-caps
  form belongs to the wordmark and UI surfaces under global founder ruling D8.
- "Behind", "falling behind", "catch up", "ahead of grade level" as a promise.
  Say "growing", "on track", "that's just what's next".
- Comparing siblings, ever, in any direction.
- "Diagnose", "screening", "assessment" (clinical), "delay", "disorder". Say
  "progress report", "checklist", "what looks solid", "what's next".
- "Tutor", "teacher", "teaches your child", "replaces". The mother is the
  teacher. Say "assistant", "briefs you".
- "Curriculum" as what Homa is. Say "materials", "practice", "works with your
  curriculum".
- "State-approved", "guaranteed accepted", "COPPA-certified".
- Education-outcome guarantees ("your child will read by 5").
- Fabricated numbers, fabricated social proof, invented testimonials. Persona
  quotes tagged `[inv]` in the planning docs never appear in marketing.
- Efficacy claims that are causal or aggregate. Temporal and member-specific
  only ("reading is up 12 points since the letter-sounds set"), consented
  testimonials only, "results vary by family" disclosure attached. No "Homa
  kids improve 2x" until a journalist-grade methodology exists.
- Member children's photos, names, or voices in any marketing asset.
- Data promises not yet true ("never used to train AI" waits for the signed
  DPAs; the day they are signed, it ships everywhere).
- Marketing the moms network before it exists. Current capability claims need
  repository evidence and production evidence when they describe the live site.

## Anti-slop banlist

The scorer flags any backtick-quoted phrase below, case-insensitive, in any
bundle text file. Every slop phrase that reaches a staged bundle becomes a new
line here.

- `unlock`
- `unleash`
- `game-changer`
- `game changer`
- `revolutionize`
- `revolutionary`
- `in today's fast-paced world`
- `in today's world`
- `look no further`
- `dive in`
- `dive into`
- `delve`
- `elevate your`
- `empower your`
- `seamless`
- `effortless`
- `supercharge`
- `next-level`
- `say goodbye to`
- `say hello to`
- `the best part?`
- `but here's the thing`
- `little did I know`
- `moms everywhere are`
- `obsessed with this`
- `run don't walk`
- `you need this`
- `must-have`
- `secret weapon`
- `life hack`
- `mom hack`
- `hack your`
- `as a busy mom`
- `we're thrilled to announce`
- `valued subscriber`
- `limited spots`
- `exclusive access`
- `don't miss out`
- `act now`
- `it's not just`

Emoji rule (editor-enforced): at most one emoji per social caption, zero in
article bodies and email bodies.

## Format rules

| Format | Rules |
|---|---|
| Article | 800 to 1400 words, one idea deep. Title answers what she actually searched. Headers she can skim. Every claim traces to the bundle's signal. Ends with the waitlist CTA. |
| Video script | Hook lands inside 2 seconds, spoken or on-screen. 3 to 5 beats. 20 to 40 seconds total. One CTA. Assume sound-off viewing works via captions. |
| TikTok caption | Max 2200 chars. Hook line first, 3 to 5 hashtags, no hashtag walls. |
| Instagram caption | Max 2200 chars. Line breaks for breath. 3 to 5 hashtags. |
| YouTube | Title max 100 chars, description max 5000, first line carries the promise. |
| Facebook post | Shorter is better, under 500 chars preferred. No hashtag spam. |
| X post | Max 280 chars, link counts. One thought, no thread unless asked. |
| Pin | Title max 100 chars, description max 500, image 2:3 with legible overlay text. Description written for search (moms search Pinterest like Google). |
| Email | Subject under 50 chars and written like a person. Preview line set deliberately. Body under 200 words. Exactly one CTA. |

Every CTA points to thankshoma.com, /onboarding, or the article's canonical URL.
One CTA per format.

## The rule about this file

This file is the single source of voice truth for marketing. The editor gate
quotes it; skills reference it; nobody restates its contents elsewhere (drift
risk). When a bad phrase slips through the gates, the fix includes a new banlist
line here, so the same mistake is caught mechanically forever after.
