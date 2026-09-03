# Art project instructions: variants

Companion to `art-project-instructions.md`. Every binding pattern there
(title and focus tag, the materials box, the numbered step circles, the
same shell regardless of medium) still binds here unless a variant below
says otherwise; this file carries the parent activity card variant.

## Parent activity card

Golden anchor: the base recipe's `anchorIds: ["art-project-instructions"]`
covers this variant on any image call it makes. No separate anchor depicts
an activity card, and an unregistered id fails generate_image and the
fleet-skills check.

A one-page guide the PARENT reads to run a hands-on activity that is
itself physical and open-ended: a sensory bin, a gross-motor game, a
building challenge, a learning-center station tied to the week's story.
The printable is not the activity. It is the setup, the words to say
while the child plays, and the one-line reason it matters, so the parent
prepares in advance instead of improvising mid-play. The ELEMENTS come
from `cur-2026-07-19-playing-preschool-y1`, whose layer-4 gaps ask for
this card as `sensory-bin-card` (title, materials, play prompts, learning
connections, vocabulary to use during play) and `activity-card` (title,
materials, setup steps, play variations, learning connections);
`cur-2026-07-19-playing-preschool-y2` reuses both,
`cur-2026-07-19-early-years-v2` adds the STEM building challenges, and
the Harcourt Trophies Grade 2 centers and reteach pages
(`ref-2026-07-18-harcourt-trophies-2nd-lesson-planner`,
`cur-2026-07-18-harcourt-trophies-2nd`,
`ref-2026-07-18-harcourt-trophies-2nd-alt-teaching-strategies`) add the
time badge, the different-subject set, and the sensory-pathway switch.
Every COUNT below is Homa's own floor or ceiling, chosen to fill a letter
page at the type floors; no source prescribes one. Take structure from
the sources, never their activities, wording, or example photos.

Great for: ages 2-8, play-based and Charlotte Mason preschool programs,
story-as-hub literacy programs that extend one book into science, social
studies, and drama stations, any curriculum that says "do this with real
objects" and hands the parent nothing to hold.

Html path by default: every field is exact text the parent scans (a
materials count, a prompt to say aloud, a time badge). Hybrid only when a
setup is hard to picture from words (a taped floor ten-frame, a ramp
arrangement): add the base recipe's inspiration thumbnail showing the
SETUP, never a finished result, and pass the base recipe's
`anchorIds: ["art-project-instructions"]` on that one call, never an
invented id.

### Choose it over the base form (decision tree)

1. Does the child make one concrete thing they keep, or follow a numbered
   sequence with their own hands (stamp, pour, stick, in order)? Base
   recipe, or its toddler stat-and-icon variant at ages 1-4. Stop.
2. Is the point observing one result with a fixed outcome (sink or
   float, what dissolves)? Experiment fact-box variant. Stop.
3. Cooking or food preparation? child-assisted-recipe-card. Stop.
4. A morning, evening, chore, or transition routine?
   visual-schedule-cards, even when the parent says "card." Stop.
5. Pencil-and-paper tasks the child does on the sheet (four apple
   mini-activities in quadrants)? activity-pack. Stop.
6. Otherwise the child plays, moves, builds, sorts, or pretends with real
   objects, the parent sets it up and talks it through, there is no child
   sequence and nothing is written on the page by the child: this variant.

### Design patterns (all binding for the parent activity card)

- **Page role.** A parent-only page: pass `pageRoles` with `parent_guide`
  for every card page to create_printable; a themed set is `parent_guide`
  on every one of its pages, never `child`.
- **Written to the parent, not the child.** The only child-facing words
  are the play prompts, in quotation marks as things the parent says. No
  "Color the..." lines, no answer blanks, no name line (the skill-wide name
  line rule is dropped here; the child never holds this page).
- **Header band**: three parts, in this order and no others: (1) the
  activity title in plain words (`.api-title`); (2) a small uppercase tag
  naming what it practices (`.api-tag`), in the family's own curriculum
  vocabulary when they have one (Playing Preschool's seven spiral skills:
  predicting, recall and retell, sorting, number sense, measuring, shapes,
  alphabet; a Charlotte Mason program's nature study; a story-as-hub
  program's subject name), never an invented skill name; (3) optional,
  learning-center cards only, one theme line under the tag naming the
  week's story in plain words ("This week's story: a lost mitten that
  finds its way home"), never the book's own text.
- **Badge row**: two badges by default, time first, then mess, as
  outlined chips with no fills; a third badge for prep time only when
  prep is real (freezing, dyeing rice), never "Prep: 0 min." Three badges
  is Homa's cap. Time is the Harcourt center's time estimate
  (`ref-2026-07-18-harcourt-trophies-2nd-lesson-planner`) as a single
  number or tight range ("15 min," "20-30 min"). Mess is the base
  recipe's Callisto toddler stat, 1 to 5, in words the parent can act on
  ("Mess 4: towel down, outside if you can"). When mess is genuinely
  unknown, print the time badge alone rather than guessing a number.
- **Materials box**: the `sensory-bin-card` and `activity-card` materials
  element, in the base recipe's `.api-materials` box. Homa's range is 3-8
  items in plain household language, quantities stated when they matter
  ("a shallow bin," "2 cups of dry rice"), never brand names.
- **Setup steps**: the `activity-card` setup element. Homa's range is 2-4
  numbered steps the PARENT does before the child arrives, in the base
  recipe's `.api-step` circles under a small "SETUP" label: the base's
  PREP sub-list promoted to the main sequence, since no child sequence
  sits below it here.
- **Play prompts**: the `sensory-bin-card` "suggested play prompts"
  element. Homa's range is 4-6 short lines, each a thing to say or ask
  during play, each in quotation marks. Open invitations come first and
  fill most of the block ("What do you notice when you pour faster?"
  "Tell me what you're making."). A counting or sorting question is
  allowed only when it invites the child to DO something ("Let's count
  the red ones together"), never to produce an answer the parent checks.
  This block is why the card exists; give it the most room and type.
- **Vocabulary strip (optional)**: the `sensory-bin-card` "vocabulary
  words to use during play" element. Homa's range is 3-6 words as
  outlined `.api-vocab-chip` chips (16px, `padding: 6px 12px`), not the
  base's 11px `.api-skill-chip`; a parent reads these mid-play. Skip the
  strip when the words would be forced.
- **Learning connection**: the `sensory-bin-card` and `activity-card`
  "learning connections" element: one or two sentences in a bordered box
  naming what the child is practicing and one thing the parent might
  notice. Written as noticing, never as checking: "You may see her sort
  by color before size; both count." No rubric, tick box, or "mastered"
  language; Playing Preschool assesses by observation only, and the card
  honors that.
- **Try another way (optional)**: the `activity-card` "play variations"
  element, at most two one-line variations, each labeled `Easier`,
  `Harder`, or `Another way in`. An "Another way in" line switches the
  sensory pathway (see it, move it, hear it), the visual, kinesthetic,
  auditory switch of
  `ref-2026-07-18-harcourt-trophies-2nd-alt-teaching-strategies`, so a
  parent whose child did not take to the first setup has a concrete
  second attempt rather than the same setup louder. When Homa knows how
  this child tends to engage, she names the line to try first in the
  chat, never on the card.
- **One card per page, always.** A single activity fills a letter page,
  with the prompt block scaled up until the content reaches the bottom of
  the printable area. A themed set of 3-5 learning-center cards on one
  story prints one card per page (`create_printable`'s `pages` input),
  every card a DIFFERENT subject, never repeating one: the Harcourt
  centers spread's rule. No half-page or two-per-page form exists for
  this variant; the blocks above do not fit half of the 9.5in content
  area at the type floors below, and the floors win. Never spread a
  short card thin to fill space; scale its type and boxes instead.
- **Size is a floor, not a target.** Parent body text never drops below
  16px and play prompts never below 18px; a parent reads these across a
  room while holding a wet toddler. A later revision (a sixth prompt, a
  third badge) never shrinks rendered type to make room; drop the extra
  item or move the vocabulary strip to a second card instead.

### What not to do

- No expected-output photo or "finished" picture. The source centers
  printed one; it turns open play into a product to match.
- No numbered steps for the child; a child sequence is the base recipe.
- No answer blanks, skill checklist, rating, or any language that grades
  the child or compares siblings.
- No transcribed center, prompt list, theme, or vocabulary from a
  publisher. Original activity, original words, the family's own theme.
- No worksheet bolted under the card; something for the child to write
  on is a second material.

### Worked HTML (new blocks only; materials and setup reuse the base `.api-*` markup unchanged)

```html
<style>
  .api-badges { display: flex; gap: 8px; margin: 6px 0 14px; }
  .api-badge { border: 1.5px solid var(--homa-control-boundary); border-radius: 999px;
    padding: 4px 12px; font-size: 14px; font-weight: 600; color: var(--homa-control-boundary); }
  .api-section-label { font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: var(--homa-control-boundary); margin: 14px 0 6px; }
  .api-prompts { border: 2px solid var(--homa-ink); border-radius: 6px; padding: 16px 18px; }
  .api-prompt { font-size: 18px; line-height: 1.5; margin: 0 0 10px; color: var(--homa-ink); }
  .api-vocab-chip { border: 1.5px solid var(--homa-control-boundary); border-radius: 6px;
    padding: 6px 12px; font-size: 16px; font-weight: 600; color: var(--homa-control-boundary); }
  .api-connection { border: 1.5px solid var(--homa-control-boundary); border-radius: 6px;
    padding: 12px 16px; margin-top: 16px; font-size: 16px; line-height: 1.5; background: #f0ede8; }
  .api-variation { font-size: 16px; margin: 4px 0; }
</style>

<div class="api-badges">
  <span class="api-badge">20 min</span>
  <span class="api-badge">Mess 3: towel under the bin</span>
</div>

<div class="api-section-label">Say while she plays</div>
<div class="api-prompts">
  <p class="api-prompt">"What did you find in there?"</p>
  <p class="api-prompt">"Where do you think that one wants to go?"</p>
  <p class="api-prompt">"Can you pick one up with the tongs instead?"</p>
  <p class="api-prompt">"Let's count the red ones together."</p>
  <p class="api-prompt">"Tell me what you're making."</p>
</div>

<div class="api-skill-strip">
  <span class="api-vocab-chip">full</span>
  <span class="api-vocab-chip">empty</span>
  <span class="api-vocab-chip">bury</span>
  <span class="api-vocab-chip">same</span>
</div>

<div class="api-connection">
  <b>What she's practicing.</b> Sorting by one attribute, plus the pinch
  grip the tongs ask for. You may see her sort by feel before color;
  both count.
</div>
<p class="api-variation"><b>Harder:</b> add a third color and a third bowl.</p>
<p class="api-variation"><b>Another way in:</b> call the colors out loud
  and have her run each one to its bowl across the room.</p>
```
