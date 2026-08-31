# Visual asset inventory for onboarding + paywall v2

What we need polished example visuals for, why, and the one hard rule
governing all of them.

## The hard rule

Every asset here shows **"an example of what Homa makes,"** never **"what
we already made for your kid."** The only screen allowed to claim "this is
yours" is the real `reveal` moment, after the real worksheet actually
generates. Framing this wrong repeats the exact mistake `voice-materials-bridge`
already cost Homa once (fabricated binder/worksheet claims over voice) and
violates the `making` screen's own existing law ("the interstitial never
claims work that is not happening"). Copy accompanying every asset below
needs an explicit "example" framing, not just a caption that happens to
be true if you squint.

## Why this is needed now, not later

The persuasion sequence we ruled on (spec.md §2) wants to "show value
before asking for effort", but the only genuinely real proof Homa has
today (the actual worksheet) doesn't exist until ~85 seconds into the
walk, well past the point a "show value first" screen would need it. Every
asset below exists to fill that gap honestly.

## Update: real App Store thumbnails already cover three surfaces

Sidney supplied 4 existing marketing thumbnails (moved from Desktop to
`reference-assets/homa-thumbnails/`, confirmed both **current real App
Store screenshots** and the **style bar** for anything new): a welcome/
voice-UI hero, a "Track hours and progress" tasks screen, a "Print custom
lessons" Binder screen (already showing real worksheet thumbnails,
"Story's Dino Add-One-More," "Truck Stop Count-Up," with "Keep this one"
CTAs), and a "Plan your week" populated planner grid. All four share one
visual system: warm cream background, bold black display type, an orange
gradient blob, a phone mockup at an angle.

This changes items 3-6 below from "needs building" to "already exists,
reusable directly": the only genuine gap left is item 1/2, a real
close-up example worksheet page (the thumbnails show worksheets only as
small thumbnails inside the Binder screen, never a full-page, readable
close-up). Any new asset (the worksheet close-ups) should match this exact
visual system for consistency, not invent a new one.

## Inventory, by product surface

| # | Asset | Why it's needed | Priority |
| - | --- | --- | --- |
| 1 | Example worksheets, spread across age bands (5-7 / 8-10 / 11-13) and subjects (reading/phonics, math, science, history, art/creative) | The core "this is what Homa makes" proof; needs range because the walk doesn't know the kid's age/subject yet at the point a pre-account or pre-`kids` screen would show it | **DONE**: 6 generated via the real materials-studio pipeline (`pnpm eval:sandbox`, Walker fixture family), saved at `assets/final/`: `finn-s-dinosaur-counting-express-*` (math, cartoon style), `finn-s-dinosaur-lunch-match-*` (science/classification, cartoon style), `how-big-is-that-dinosaur-*` (measurement/comparison, painterly style), `maya-s-art-studio-beginning-sounds-*` (letter sounds, watercolor style), `maya-s-paintbrush-adventure-*` (creative writing/story-starter, watercolor style), `story-s-animal-habitats-*` (science/matching, painterly landscape style). Each is a real PDF + JPEG preview, passed the real quality-review gate. A bonus 16 standalone character/object illustrations (dinosaurs, art supplies, animals, habitat scenes, a size-comparison scene, a full painterly "paintbrush comes to life" scene) generated along the way are saved at `assets/character-illustrations/`: genuinely charming on their own, worth considering as decorative elements elsewhere. |
| 2 | One "hero" example worksheet, visually striking, likely themed around a common kid interest (dinosaurs, space, animals, pulled straight from `kids.tsx`'s own chip list) | A single headline image for a desire/proof screen or the paywall itself, not a grid; needs to read as genuinely great at a glance, not just accurate | **New leading candidate**: `maya-s-paintbrush-adventure-*`: its banner illustration (a full painterly scene: an animated paintbrush painting a rainbow, a kitten watching, warm studio light) is the single best individual image across everything generated, and the "comes to life" whimsy fits a delight beat well. `story-s-animal-habitats-*`'s four landscape scenes remain a strong runner-up. Confirm choice with Sidney before locking one in. |
| 3 | Example progress report (subject scorecard, a growth chart, a "next move" card) | Progress tracking is a core value prop and one of the three `intent` options; nothing currently shows what a report looks like before a family has one | **Must-have** |
| 4 | Example populated weekly planner / calendar view | "Plan our week" is one of the three `intent` options and one of the three doors at the end of the walk (`next.tsx`); nothing shows this today | **Must-have** |
| 5 | Example binder/library view (multiple kids, multiple subjects, organized) | Where the "another worksheet" door lands; shows breadth (a family's whole collection), not just one page | Should-have |
| 6 | Example hours/teaching-log summary | The third `intent` option ("keeping our hours"); currently the least visually rich of the three core value props | Should-have |
| 7 | Example celebration artifact (a Friday letter, a certificate, a portfolio page; see `celebration-system-spec` memory) | If the sequence wants an emotional "here's what a real year with Homa looks like" beat, this is the payoff visual; higher risk of reading as a promise rather than an example, so needs the honesty framing applied most carefully here | Nice-to-have, revisit once the sequence's actual beats are chosen |
| 8 | One unified hero composite (worksheet + planner + report together) | A single strong image for the welcome screen or paywall header, if the sequence wants one image instead of several | Nice-to-have |

Not included: a state-requirements/filing sample (Plus/Elite-tier feature,
few families reach it, not core to first-time onboarding).

## Update 2026-08-31: the gallery redesign changes the item-1 spec

The walk-v2 proposal's proof gallery (S4, see
`docs/homa-planning/plans/2026-08-30-mobile-onboarding-paywall-v2/walk-v2-proposal.md`)
shows examples across ALL ages (Sidney cut the age question on
2026-08-31), ordered youngest first, with each card's true generation
brief as a loud age label. Two consequences for this inventory:

- **Band coverage is now a ship gate, harder than before.** Every band
  is always on screen for every parent. The six existing worksheets
  cluster at roughly ages 4-10; the 9-12 band is thin and 13+ is empty,
  so one 9-12 and one 13+ example are required before build (e.g. a
  fractions/decimals page and an essay-outline or primary-source
  history page).
- **One topic at three levels beats six topics at one level.** The
  Photoroom finding (hold the subject constant, vary the treatment)
  means the strongest possible set is one kid-love rendered at three
  ages, e.g. dinosaurs at 5 (counting), 8 (reading/science), and 12
  (measurement or a short research page). Two of those three already
  exist.

## Open question this raises

Items 1-4 are the must-haves and should be produced first. Confirm with
Sidney whether the "hero" (item 2) gets built before or after the
must-have spread (item 1), since it likely wants the single best output
from that spread rather than a separate production pass.
