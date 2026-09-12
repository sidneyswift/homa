## Format library (load the recipe before you build)

Each format below has a full recipe as a sibling file: layout geometry,
the binding design patterns, worked HTML, path choice, and scaffolded
versions. The router does not carry them, so they cost nothing until you
need one. Once the subject rules and the request point to a format, read
its recipe first, then build:

`read_file /workspace/skills/materials-studio/references/recipes/<name>.md`

Pick by what the page must DO, not by habit. When two formats fit, the
subject rules and the child's evidence break the tie. When nothing here
fits, design from the creation-path and design rules directly; a missing
recipe is not a reason to force the wrong format.

Pass the recipe's slug as `create_printable`'s `recipe` on every call for
that material, first draft and every revision. The tool reads the
recipe's reviewer checklist itself and shows the reviewer the format's
anchor when there is one; you never retype either. A checklist item the
reviewer answered no comes back in the issues list as
`Checklist (<id>)`: fix that item, do not argue with it. A blocking item
that misreads a page the recipe itself allows is a checklist bug: fix the
page if it is wrong, otherwise say so in one plain sentence to the founder
channel and never drop `recipe` from the call to dodge the check. Omit
`recipe` only when no recipe fit; never pass a near-miss.

**Routine and chore charts are visual schedules, even when the parent calls
one a worksheet, checklist, morning plan, or evening plan.** Use `read_file`
on `/workspace/skills/materials-studio/references/recipes/visual-schedule-cards.md`
before building any card-based routine. A whole-page
routine chart uses one composed image, or HTML alone when simple symbols are
enough, never one image per chore, card, or child. For sibling versions, reuse
the shared composition whenever the visual content is the same; a genuinely
different page may have one composed image of its own. A label, order, box,
language, spacing, or layout correction reuses the existing art. Only a
request to change what an illustration depicts earns a replacement composed
sheet, never a fan-out of replacement icons.

| Format | Reach for it when the page must... | Recipe file |
| --- | --- | --- |
| Foldable / notebook insert | be a tactile fold-and-glue tool with reference and practice on one object | foldable |
| Structured outline / essay scaffold | teach a writing or planning process through a fill-in framework | structured-outline |
| Cut-and-paste word work | reinforce one word four ways (see, write, cut, paste); early phonics | cut-and-paste-word-work |
| Maze / puzzle practice | make drill self-checking: right answers advance, wrong ones dead-end | maze-puzzle-practice |
| Notes-and-practice bundle | pair a guided-notes page with a practice page (teach, then do) | notes-and-practice-bundle |
| Matching / visual discrimination | build early visual matching and sorting on one preschool page | matching-visual-discrimination |
| Number practice page | focus one numeral with trace, ten-frame, count, and color activities | number-practice-page |
| Counting and manipulative mat | be a laminate-and-reuse surface where the child places real one-inch counters on numbered spots, a five- or ten-frame, or part-part-whole zones, with nothing written; not a page that ends in a number sentence or answer box (singapore-workbook-page), not dough pressed into a numeral's shape (playdough-mat); variant rules in counting-and-manipulative-mat.variants | counting-and-manipulative-mat |
| Name tracing page | put the child's name on real three-line writing guides, dotted trace fading to empty lines | name-tracing-page |
| One-page mini book | fold one sheet into an 8-page book (needs exact panel order) | one-page-mini-book |
| Unit study packet | bundle 8 to 12 activities on one theme into a multi-page packet | unit-study-packet |
| Labeled anatomy diagram | label parts of a scientific illustration with a word bank | labeled-anatomy-diagram |
| Cut-and-assemble craft | color, cut, and build a 3D model or layered diagram | cut-and-assemble-craft |
| Nature identification poster | show a labeled species grid for nature study | nature-identification-poster |
| Classification sorting mat | sort cut-out pieces into labeled category zones (laminate, reuse) | classification-sorting-mat |
| 3-part nomenclature cards | make a Montessori self-checking card set (image, label, control) | nomenclature-cards |
| Copy-work pages | practice handwriting from a curated quote or passage | copy-work-pages |
| Guided notes | give a Cornell two-column notes page that scaffolds a new concept | guided-notes |
| Dot-marker activity | let a toddler stamp dot-marker circles to form letters, numbers, shapes | dot-marker-activity |
| Playdough mat | give a laminate-and-reuse surface to form shapes or letters in dough | playdough-mat |
| Social narrative | walk a child through a feeling or situation in first-person story form | social-narrative |
| Visual schedule cards | make a card-based morning, evening, chore, or transition routine, whether or not the parent calls it a worksheet or checklist | visual-schedule-cards |
| Cross-number puzzle | drill arithmetic inside a row and column sum-constraint grid | cross-number-puzzle |
| Checklist assessment | give parents a warm whole-child readiness checklist | checklist-assessment |
| Phonics and spelling diagnostic assessment | check one taught skill with equivalent forms, exact scoring, and warm stop rules | phonics-spelling-diagnostic-assessment |
| Flash cards | make a precise cut-apart recall deck, including grapheme cards and duplicate word-building tiles | flash-cards |
| Word fluency repeated reading | reread one validated taught word set without race or verdict framing | word-fluency-repeated-reading |
| Phonics pattern reference chart | keep one validated taught sound-spelling or morphology pattern visible during real work | phonics-pattern-reference-chart |
| Dictation writing practice | write exact heard words and one sentence, then compare through a separate parent key | dictation-writing-practice |
| Phoneme-letter building mat | move grapheme tiles into one box per sound, then blend the completed word | phoneme-letter-building-mat |
| Grapheme marking practice | mark exact grapheme boundaries in a validated taught word set | grapheme-marking-practice |
| Picture-supported syllable ordering | identify a pictured Spanish word, reorder trusted syllable chunks, then write the whole word | picture-supported-syllable-ordering |
| Phonics sound card game | match a closed deck by one taught sound-spelling relationship | phonics-sound-card-game |
| Decodable story page | apply taught phonics in original connected text whose full token inventory passed validation | decodable-story-page |
| Clip cards | make a clip-the-answer or mark-the-answer card set for repeat practice | clip-cards |
| File-folder game | build a glue-in-a-folder board game with moveable pieces | file-folder-game |
| Cloze story | have the child fill passage blanks from a word bank | cloze-story |
| Reading comprehension mini-unit | teach a comprehension skill across passages, a lesson, and vocab | reading-comprehension-mini-unit |
| Hive puzzle | drill number sense in a self-checking hexagonal constraint puzzle | hive-puzzle |
| Fraction link puzzle | practice fraction equivalence in a grid of linked cells | fraction-link-puzzle |
| Fraction maze escape | compare and order fractions by tracing a path through a grid | fraction-maze-escape |
| Decimal path puzzle | order decimals by tracing the correct path through nodes | decimal-path-puzzle |
| Daily rhythm cards | make cut-apart cards to build a visual daily schedule | daily-rhythm-cards |
| Daily calendar and weather board | let the child circle today's day, month, date, season, and weather in place on one reusable board with no questions and no right answer; not a routine or chore sequence (visual-schedule-cards owns that) and not calendar-reading questions (chart-and-graph-skill-practice owns that); variant rules in daily-calendar-weather-board.variants | daily-calendar-weather-board |
| Child-assisted recipe card | separate adult-only preparation from a child's picture-supported cooking jobs | child-assisted-recipe-card |
| Activity pack | put four different mini-activities on one theme in quadrants | activity-pack |
| Singapore math workbook page | teach number sense through the concrete-pictorial-abstract progression | singapore-workbook-page |
| Narration page | pair a blank illustration box with dictation lines for CM-style narration or journaling | narration-page |
| Curiosity-led notebook page | preserve what caught the child's attention across a shared reading theme without assigning the response | curiosity-led-notebook-page |
| Artist / composer study card | build a reusable picture-study or composer-study portfolio card | artist-composer-study-card |
| Composer listening guide | give the child one thing to listen for and ordered moments to catch while a real piece of music plays | composer-listening-guide |
| Chant and rhyme card | print a traditional chant, nursery rhyme, or fingerplay as a large-type say-aloud card with leader/everyone and clap cues | chant-and-rhyme-card |
| Nature observation journal | record the child's own outdoor discovery, not Homa-supplied reference art | nature-observation-journal |
| Letter & number formation practice | drill one letter or digit through its own strokes with a labeled model, fading trace boxes, and an independent write box | letter-number-formation-practice |
| Giant letter art page | give one page-filling thick-outline letter or digit as a craft canvas to decorate, cut out, and keep in an alphabet portfolio; not a stroke drill, not stamp circles, not a laminated dough mat, not a coloring scene (letter-number-formation-practice, dot-marker-activity, playdough-mat, coloring-page own those); variant geometry and the image-direct template in giant-letter-art-page.variants | giant-letter-art-page |
| Art project instructions | pair a materials list with numbered steps for one hands-on art or craft project, a bare technique-reference card, or a published science textbook's "Investigate" activity; or hand a parent the setup, the words to say, and the learning connection for an open-play activity she runs (a sensory bin, a gross-motor game, a learning-center station); variant rules in art-project-instructions.variants | art-project-instructions |
| Then and now comparison | compare something from the past against today in two labeled panels with a reflection question | then-and-now-comparison |
| Size attribute comparison page | compare two or three items along one physical attribute and circle, color, or draw the answer | size-attribute-comparison-page |
| Pattern extension practice | copy, continue, choose, or create a simple repeating AB pattern | pattern-extension-practice |
| Comic narrative math page | teach a concept through 2-4 comic panels of character dialogue, ending in a story-linked question | comic-narrative-math-page |
| Circle diagram two-set sort | sort items into two overlapping circles so both-attribute and neither-attribute items have a real home | circle-diagram-two-set-sort |
| Picture or text bingo board | give a family several shuffled picture or exact-text boards from one shared item pool | picture-bingo-board |
| Biography timeline page | show 5-8 chronological events in a real person's life, or an invention's progression, as connected labeled boxes | biography-timeline-page |
| Chart and graph skill practice | teach one concrete data-reading skill (calendar, timeline, bar graph, diagram) with a worked example plus practice questions | chart-and-graph-skill-practice |
| Lesson comprehension check | close a taught lesson with 2 recall questions plus 1 open think-and-share question | lesson-comprehension-check |
| Illustrated teaching page | teach one thing the child asked about: a question headline, one illustration, three or four sentences in Homa's words, one check; the page she reads first; not the closer for a lesson already taught (lesson-comprehension-check owns that) and not a diagram to label (labeled-anatomy-diagram owns that); variant rules in illustrated-teaching-page.variants | illustrated-teaching-page |
| Magic square puzzle | drill addition fluency in a self-checking grid where every row, column, and diagonal sums to the same target | magic-square-puzzle |
| Reader theater script | build oral reading fluency through a multi-character performance script with assigned roles, choral refrains, and repeated reading across sessions | reader-theater-script |

