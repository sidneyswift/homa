# Paywall hero setting concepts (generated 2026-09-01)

Backdrop/scene assets explored for the S10 paywall hero (and potentially
other onboarding screens), generated with Higgsfield's `nano_banana_pro`.
These are **environment assets, not worksheet-content assets**: none of
them claim to be "an example of what Homa makes" the way `assets/final/`
and `assets/character-illustrations/` do, so the honesty rule at the top
of `asset-inventory.md` doesn't bind them the same way. They exist to sit
*behind* the real, code-driven `HomaCharacter` (see
`apps/mobile/src/features/voice/homa-character.tsx`), never to replace her
with a redrawn likeness. Every concept below explicitly excludes a house
or character from the scene itself for that reason, except round 1's
early attempts (marked) which predate that finding.

**Style target that emerged and held up**: "flat graphic design, deliberately
between minimal geometric shapes and detailed painterly illustration."
Two concepts in round 5 (desk flat-lay, reading nook) drifted back to a
softer painterly look and need a restyle pass before use.

**Full session context**: the four published Artifacts this work came out
of are gone once the session ends; this manifest is the durable record.
Prompts are reproduced in full below so any of these can be regenerated
or varied without reconstructing the brief from scratch.

## Round 1: first hero concepts (paywall.tsx's real headline/pricing, `#0`-`#5`)

| File | Concept | Verdict |
|---|---|---|
| `0-glow.png` | Abstract warm glow, no character | Ready |
| `1-house-on-hill.png` | House-on-hill with the mark baked in (early, superseded) | Superseded by round 3-4 |
| `2-character-papers.png` | Mark amid worksheets (early, superseded) | Rejected: model drew a mouth, violates `homa-character.tsx`'s "no mouth, ever" |
| `3-homeschool-objects.png` | Workbook + binder + pencils flat-lay | Ready |
| `4-pages-to-life.png` | Blank pages animating into color (early) | Rejected: overshot brief, invented headline text, no cream fade |
| `5-blend.png` | Mark peeking from behind objects (early, superseded) | Rejected: lost the house silhouette entirely |

## Round 2: more backdrop range + corrected character prompts (`#6`-`#14`)

| File | Concept | Verdict |
|---|---|---|
| `6-glow-coral.png` | Coral-led glow variant | Ready |
| `7-glow-sunrise.png` | Sunburst/light-ray glow | Ready, used in final mockups as Option B |
| `8-objects-achievement.png` | "My progress" stack, first attempt | Superseded by `18-progress-redo.png` |
| `9-kitchen-table.png` | Cozy window/book/mug scene, first attempt | Superseded by `17-kitchen-redo.png` |
| `10-pages-redo.png` | Pages-to-life, restrained retry | Ready but visually sparse at hero scale |
| `11-fan-pages.png` | Abstract fan of blank pages | Ready |
| `12-character-precise.png` | Mark alone, tightened prompt (explicit "no mouth, no other features") | Proved the fidelity fix; still recommend the real coded component over any redrawn mark for production |
| `13-hill-redo.png` | House-on-hill, tightened character prompt | Superseded by round 3-4 (character later dropped from the scene entirely) |
| `14-with-page.png` | Mark beside one worksheet, tightened prompt | Ready as a character study |

## Round 3: hill scene developed further, "add a chimney, a path, clouds" (`#15`-`#16`)

| File | Concept | Verdict |
|---|---|---|
| `15-hill-detailed-eyes.png` | Storybook-detailed house on a hill, mark's eyes on the house shape | Superseded: user later ruled out baking the character into the illustration at all |
| `16-hill-detailed-noeyes.png` | Same scene, no eyes, testing "we already have the logo" | Rejected: model hallucinated a fake phone nav bar onto the image |

## Round 4: kitchen table + progress stack fixed (`#17`-`#18`)

| File | Concept | Verdict |
|---|---|---|
| `17-kitchen-redo.png` | Kitchen table, corrected to fade fully to cream in the lower half | Ready, used in final mockups as Option C |
| `18-progress-redo.png` | Progress stack, corrected: no invented text, clean fade | Ready |

## Round 5: hill as pure environment (no house at all), the real mark composited on top (`#19`-`#21`)

This is the key architectural turn: the character stays the real coded
`HomaCharacter`/`Logo` component; only the *setting* is generated. Confirmed
against `apps/mobile/src/features/voice/aura.tsx` and `homa-character.tsx`,
which already separate sky / glow / character into independent layers.

| File | Concept | Verdict |
|---|---|---|
| `19-hill-environment-only.png` | First environment-only hill: sky, path, empty clearing, painterly style | Superseded by `21` (style) |
| `20-hill-graphic-design.png` | Same scene, restyled flatter/more graphic per request, but the clearing rendered as a distinct circular patch | Rejected: the circle read as an unexplained design element |
| `21-hill-no-circle.png` | Same again, continuous grass, no circle, path simply terminates near the top | **Current best**, used in final mockups as Option A |

## Round 6: eight alternative settings, no house/character in any of them (`#22`-`#29`)

Requested after the hill was judged "a little too ambiguous" as a metaphor;
these are concrete homeschool objects instead of an environment.

| File | Concept | Verdict |
|---|---|---|
| `22-desk-flatlay.png` | Open journal (kid-style marks) + pencil tin + gold star, top-down | Best content of the eight ("the journal thing"), but painterly not flat-graphic; needs a restyle pass |
| `23-pinboard.png` | Cork board with pinned worksheets, a drawing, a calendar | Ready |
| `24-bookshelf.png` | Row of colorful book/binder spines | Usable but generic, doesn't read as homeschool-specific |
| `25-backpack.png` | Open backpack with notebook, book, pencils | Clean execution, wrong metaphor (backpack signals "going to school," the opposite of homeschool) |
| `26-achievement-fan.png` | Finished worksheets fanned like a hand of cards, checkmarks and stars | Ready |
| `27-reading-nook.png` | Armchair by a window, books, a blanket | Best mood of the eight, painterly not flat-graphic, needs a restyle pass |
| `28-whiteboard.png` | Weekly schedule grid + a pinned drawing | Rejected: no weekday labels, reads as abstract dots rather than a plan; also under-fills the frame |
| `29-globe-book.png` | Globe + open book under a desk lamp | Ready, strongest mood; the coral wall could fade to cream a touch sooner |

## Round 7: the journal, restyled (`#30`)

`22-desk-flatlay.png` restyled to match the flat graphic language (round 6
flagged it as the best content of the eight but off-style).

| File | Concept | Verdict |
|---|---|---|
| `30-journal-flat.png` | Open journal with abstract doodles, pencil tin, a separate checkmark+star page, flat style | Ready, used in final mockups as Option D. **Wired into `hello.tsx` 2026-09-01** as the S1 backdrop (a pre-cropped copy at `apps/mobile/assets/onboarding/hello-backdrop.png`, journal+pencils+checklist band only, the empty desk margin and cream fade trimmed off since a fixed-height card needs a tighter crop than a full-bleed hero does). Deliberately NOT `31b-hello-path.png`, that exact asset was the one the founder called "weird... unnecessary" earlier the same session; do not reconsider it for this screen without a new ask. |

## Round 8: beyond the paywall, four more onboarding screens (`#31`-`#36`)

Requested after auditing all nine onboarding screens
(`apps/mobile/src/app/(onboarding)/`). Key finding that shaped this round:
`WalkStage` ([`walk-scene.tsx:40`](../../../../apps/mobile/src/features/onboarding/walk-scene.tsx))
already keeps the real `HomaCharacter` persistently visible in a small strip
at the top of every single onboarding screen, sky color only (`gold100` or
`clay50` flat fill, no illustration). Paywall and reveal each additionally
have their own separate, bigger in-content hero; that's the layer these
assets target. Screens that are pure fast-entry forms (`kids.tsx`, `you.tsx`)
were deliberately excluded, a decorative hero there would compete with the
keyboard for space. `making.tsx` already has a bespoke answer
(`making-show.tsx`, an animated easel scene) and needed nothing new.
`reveal.tsx` is correctly off-limits, it's the one screen honesty rules
require real content only.

Recurring failure mode this round: asked for a "banner," the model twice
free-associated real UI chrome into the image (a fake "Continue" button
with page dots, a fake rectangular border/frame). Both times a corrected
prompt with an explicit "no buttons, no UI, no frame" clause fixed it
cleanly. Worth stating that constraint up front next time rather than
discovering it after the fact.

| File | Screen | Concept | Verdict |
|---|---|---|---|
| `31-hello-path.png` | `hello.tsx` | Sunrise, a stone path starting at the very first step | Rejected: hallucinated a fake "Continue" button and page dots baked into the image |
| `31b-hello-path.png` | `hello.tsx` | Same concept, corrected | **Ready.** The strongest candidate in this round, first impression, no competing content |
| `32-decline-glow.png` | `decline.tsx` | Very soft, low, calm gold glow | **Ready** on the first pass. Matches "no pressure, take your time" better than anything busier would |
| `33-intent-crossroads.png` | `intent.tsx` | Path splitting three ways | Rejected: drifted into a bold thick-outlined sticker style with scattered decorative confetti marks, off-family |
| `33b-intent-crossroads.png` | `intent.tsx` | Same concept, restyled to match the family | **Ready**, light-touch banner only, not a full hero (the screen's 4 options need the room) |
| `34-next-doors.png` | `next.tsx` | Three small doors in a meadow | Rejected: bright saturated blue sky and heavy outlines, off-family |
| `34b-next-doors.png` | `next.tsx` | Same concept, restyled | **Ready**, light-touch banner only (the screen's 3 doors need the room). Literal: the screen's own code calls its choices "doors" |
| `35-walkstage-gold.png` | `WalkStage` (every screen, gold mood) | Soft pale gold sky wash, simple clouds | Rejected: hallucinated a rectangular border/frame near the edges |
| `35b-walkstage-gold.png` | `WalkStage` (every screen, gold mood) | Same concept, corrected | **Ready.** Needs cropping/tiling into the stage's actual ~160-190px strip height, this is a full illustration, not pre-cropped to that band |
| `36-walkstage-clay.png` | `WalkStage` (every screen, clay/default mood) | Soft pale dusty clay-pink sky wash | **Ready** on the first pass, same tiling caveat as above |

## Reusable prompt scaffold

Every "ready" asset above shares this frame (fill in the `{scene}` and
`{palette}` specifics):

> A clean flat graphic-design illustration for a mobile app hero banner,
> portrait orientation, deliberately in between minimal geometric shapes
> and detailed painterly illustration: {scene}. Minimal shading, clean
> confident edges, warm coral, gold, and cream accent colors, no readable
> text. The scene fills the upper two-thirds of the frame and dissolves
> into plain warm cream white (#F7F4EE) by the bottom third for interface
> elements. Not photorealistic, no 3D render, no house, no building, no
> character, no eyes, no face, no people anywhere in the image.

Homa's real tokens used throughout: mark coral `#E7602F`, aura gold
`#FFD43B`, canvas/paper `#F7F4EE`, eye whites `#FFFEFC`, pupils `#20242B`
(source: `apps/mobile/src/theme/native-projection.ts`, `apps/mobile/assets/brand/icon.svg`).
