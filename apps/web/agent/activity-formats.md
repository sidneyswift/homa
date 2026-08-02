# Activity Format Registry

Machine-readable registry of every format materials-studio can produce.
The curriculum writer loads this to recommend buildable activities.

---

### foldable
- **Slug:** `[foldable]`
- **Name:** Foldable / interactive notebook insert
- **What it is:** A tactile learning tool the child prints, cuts, folds, and glues into a notebook. Reference material and practice live on the same physical object.
- **Best for:** Concepts with sequential steps, vocabulary sets, mnemonics, any topic where tactile manipulation aids memory.
- **Subjects:** Math (order of operations, formulas), science (classification, cycles), ELA (grammar rules, vocabulary)
- **Ages:** 5-14. Younger kids get two-flap books; older get accordion tri-folds with embedded practice.
- **Creation path:** hybrid (doodle art + HTML structure) or image-direct for art-driven foldables; html for text-heavy reference foldables.
- **Example activity:** `[foldable] Build a PEMDAS foldable with color-coded operations and practice problems`

### structured-outline
- **Slug:** `[structured-outline]`
- **Name:** Structured outline / essay scaffold
- **What it is:** A fill-in-the-blank framework with labeled sections and a two-column instruction|work layout. Teaches process by breaking complex tasks into steps.
- **Best for:** Essay writing, research projects, book reports, any multi-step writing or planning task.
- **Subjects:** ELA (essays, reports), social studies (research), science (lab reports)
- **Ages:** 8-16. Simpler versions have fewer sub-fields and more writing space; advanced versions add evidence slots.
- **Creation path:** html (always: text precision and surgical revision are the point)
- **Example activity:** `[structured-outline] Five-paragraph essay outline with thesis, evidence, and transition fields`

### counting-mat
- **Slug:** `[counting-mat]`
- **Name:** Counting mat
- **What it is:** Groups of themed images the child counts, with empty boxes to write each total. One skill per page.
- **Best for:** Counting practice, one-to-one correspondence, cardinality, comparing quantities.
- **Subjects:** Math (counting, early number)
- **Ages:** 2-6. Younger kids get 2-3 giant groups; older get 4-6 groups with higher counts.
- **Creation path:** html (repeat one generated image) or image-direct for simple layouts
- **Example activity:** `[counting-mat] Count groups of dinosaurs (1-10) and write the number`

### tracing-guide
- **Slug:** `[tracing-guide]`
- **Name:** Tracing guide
- **What it is:** Pale letters or numbers over a three-line guide with starting dots. The child traces to build motor memory.
- **Best for:** Letter formation, number writing, name practice.
- **Subjects:** ELA (handwriting), math (number formation)
- **Ages:** 3-7. Larger letters and fewer per line for younger; smaller with more repetitions for older.
- **Creation path:** html (exact proportions and guide spacing)
- **Example activity:** `[tracing-guide] Trace uppercase and lowercase Mm with starting dots`

### flash-cards
- **Slug:** `[flash-cards]`
- **Name:** Flash cards / cut-outs
- **What it is:** Precise 2x2 cut-apart pages of 2.5in by 3.5in cards, with one exact prompt per card, optional mirrored backs or parent key, stable card ids, and explicit duplicate counts when the cards double as word-building tiles.
- **Best for:** Brief recall rounds, taught letter and grapheme sets, sight words, math facts, vocabulary, portable review, and simple matching games.
- **Subjects:** Any subject with a discrete trusted prompt set, especially ELA phonics and vocabulary or math facts.
- **Ages:** 3-14. Younger learners get fewer, larger cards; older learners may use denser facts, but every card still carries one prompt.
- **Creation path:** html (exact grid, cut lines, type, card ids, and front-to-back registration)
- **Example activity:** `[flash-cards] A six-card deck across two cut-apart sheets for one taught vowel-team set, with graphemes on the front and parent pronunciation cues on a separate key.`

### word-fluency-repeated-reading
- **Slug:** `[word-fluency-repeated-reading]`
- **Name:** Word fluency repeated reading
- **What it is:** A calm two-page packet for rereading one closed, validated, already-taught word set. The child page keeps the same exact set across rounds; the parent page records miscues, self-corrections, and a brief smoothness note without generating a score or verdict.
- **Best for:** Building automatic recognition of familiar phonics patterns, high-frequency words, morphology sets, or multisyllabic words after accurate decoding is established.
- **Subjects:** ELA (phonics, decoding, word study, reading fluency)
- **Ages:** 5-12. Evidence sets the word difficulty; age changes only item count, type size, and spacing.
- **Creation path:** html packet (validated word ids, stable repeated-reading geometry, exact page roles, and optional code-issued timing fields)
- **Example activity:** `[word-fluency-repeated-reading] Two untimed rereads of one validated vowel-team word set, with a separate parent observation page and no speed target.`

### phonics-pattern-reference-chart
- **Slug:** `[phonics-pattern-reference-chart]`
- **Name:** Phonics pattern reference chart
- **What it is:** A one-page visible reminder for one already-taught sound-spelling, syllable, or morphology pattern, with a small validated example set grouped and highlighted by exact target spans.
- **Best for:** Keeping a known vowel team, digraph, affix, syllable pattern, or related-word structure beside the child during real reading and writing.
- **Subjects:** ELA (phonics, spelling, morphology, word study)
- **Ages:** 5-12. Younger learners get one group and larger words; older learners may compare up to three validated groups.
- **Creation path:** html (exact words, groups, literal target spans, and readable chart geometry)
- **Example activity:** `[phonics-pattern-reference-chart] One taught suffix chart with eight validated examples, literal suffix highlighting, and a short use-it-while-writing prompt.`

### dictation-writing-practice
- **Slug:** `[dictation-writing-practice]`
- **Name:** Dictation writing practice
- **What it is:** A three-page practice packet with answer-free child writing lines, an exact parent script for words and one original sentence, and a separate closed answer key. An optional unscored response prompt connects a just-read text to brief original writing.
- **Best for:** Applying one taught spelling pattern, practicing sentence conventions, and moving from oral discussion into a manageable written response.
- **Subjects:** ELA (spelling, phonics, sentence writing, written response)
- **Ages:** 6-12. Evidence sets the target; age controls item count and writing-space size.
- **Creation path:** html packet (stable item ids, exact scripts and answers, literal target spans, and verified page roles)
- **Example activity:** `[dictation-writing-practice] Four validated pattern words, one original dictated sentence, and one open talk-first response prompt, with parent script and key on separate pages.`

### coloring-page
- **Slug:** `[coloring-page]`
- **Name:** Coloring page
- **What it is:** Black and white line art with thick clean outlines, no shading. The child colors it in.
- **Best for:** Fine motor practice, creative expression, reward activities, themed reinforcement.
- **Subjects:** Art, any subject as a reward or warm-up
- **Ages:** 2-10. Simpler shapes and fewer details for younger; intricate designs for older.
- **Creation path:** image-direct (line art is the image model's strength)
- **Example activity:** `[coloring-page] Brave dalmatian puppy pilot in a rescue ring`

### poster
- **Slug:** `[poster]`
- **Name:** Poster / reference chart
- **What it is:** A single-page visual reference the child can hang up. Bold title, key information, illustrations.
- **Best for:** Reference material meant to be displayed: alphabet charts, multiplication tables, science diagrams.
- **Subjects:** Any subject needing a visual reference
- **Ages:** 3-14. Simpler with fewer items for younger; denser information for older.
- **Creation path:** image-direct or hybrid
- **Example activity:** `[poster] Solar system poster with planet names and relative sizes`

### themed-worksheet
- **Slug:** `[themed-worksheet]`
- **Name:** Themed worksheet
- **What it is:** Exercises paired with themed illustrations. Precise academic content with engaging art.
- **Best for:** Any drill or practice that benefits from visual engagement and theming.
- **Subjects:** Math, ELA, science, any subject
- **Ages:** 3-10. Fewer items and larger art for younger; more problems and smaller art for older.
- **Creation path:** hybrid (generate_image for art, HTML for exercises)
- **Example activity:** `[themed-worksheet] Space-themed addition problems (sums to 20) with rocket illustrations`

### handwriting-practice
- **Slug:** `[handwriting-practice]`
- **Name:** Handwriting practice
- **What it is:** Rows of practice lines (three-line guide or letter boxes) with model letters. Curriculum-aware: supports both three-line guides and box-style (Handwriting Without Tears).
- **Best for:** Letter formation drill, name writing, sentence copying.
- **Subjects:** ELA (handwriting)
- **Ages:** 3-8. Larger boxes/lines and fewer rows for younger; smaller with more rows for older.
- **Creation path:** html (exact proportions are critical)
- **Example activity:** `[handwriting-practice] Practice writing first name with three-line guides and starting dots`

### maze-practice
- **Slug:** `[maze-practice]`
- **Name:** Maze / puzzle practice
- **What it is:** A navigation challenge where correct answers advance through the maze and wrong answers dead-end. Self-checking without an answer key.
- **Best for:** Transforming rote drill into a game: math facts, phonics, vocabulary, sight words.
- **Subjects:** Math, ELA, vocabulary, any fact-based drill
- **Ages:** 5-12. Simpler paths with fewer decision points for younger; complex branching for older.
- **Creation path:** hybrid (generate_image for maze paths, HTML for answer labels) or image-direct for simpler mazes
- **Example activity:** `[maze-practice] Follow the correct multiplication facts (x7) through the maze`

### cut-and-paste
- **Slug:** `[cut-and-paste]`
- **Name:** Cut-and-paste word work
- **What it is:** Grid layout with one word per cell: printed model word, writing line for practice, and cut-out tiles at bottom with dotted cut lines. Multi-sensory: see, write, cut, paste.
- **Best for:** Phonics (CVC words, word families), sight words, vocabulary, sorting activities. Multi-sensory approach aids kinesthetic learners.
- **Subjects:** ELA (phonics, spelling, sight words), vocabulary in any subject
- **Ages:** 4-8. 6-8 words per page for K-2; can increase density for older. Simpler words for younger.
- **Creation path:** html (precise grid, dotted cut lines, writing lines need surgical precision)
- **Example activity:** `[cut-and-paste] Short A CVC word work: write each word, then cut and paste tiles`

### notes-and-practice-bundle
- **Slug:** `[notes-and-practice-bundle]`
- **Name:** Notes-and-practice bundle
- **What it is:** Two-page format: page 1 is guided notes (Cornell-style two-column with terms and fill-in-the-blank explanations), page 2 is practice (drill problems, matching, or fill-in-the-blank). Teach then practice in one printable.
- **Best for:** Any subject where concept introduction precedes drill: new math operations, grammar rules, science vocabulary, history facts.
- **Subjects:** Math, ELA, science, social studies, any content-heavy subject
- **Ages:** 8-14. Simpler terms and fewer blanks for younger; denser notes and harder practice for older.
- **Creation path:** html (uses packet recipe for multi-page; both pages need text precision)
- **Example activity:** `[notes-and-practice-bundle] Two-step equations guided notes with practice maze`

### matching-worksheet
- **Slug:** `[matching-worksheet]`
- **Name:** Matching / visual discrimination worksheet
- **What it is:** Two columns of images; child draws lines to match pairs, or rows of similar images where the child marks which one is different. Core visual discrimination skill for preschool.
- **Best for:** Visual discrimination, matching, same/different, categorization, uppercase-lowercase pairing.
- **Subjects:** Math (matching quantities), ELA (letter matching, rhyming pairs), science (animal matching), any pairing/sorting concept
- **Ages:** 3-6. Fewer items (4 pairs) and larger images for younger; more pairs (6-8) and subtler differences for older.
- **Creation path:** image-direct (matching requires distinct, recognizable illustrations) or hybrid (HTML columns + generated images)
- **Example activity:** `[matching-worksheet] Match the ocean animals: draw lines from each creature on the left to its pair on the right`

### monthly-calendar
- **Slug:** `[monthly-calendar]`
- **Name:** Monthly planning calendar
- **What it is:** Blank calendar grid (7 columns × 5-6 rows) with themed header illustrations. Used for weather charting, daily planning, tracking what was covered, practicing days of the week.
- **Best for:** Calendar skills, weather tracking, daily routine charting, schedule awareness.
- **Subjects:** Math (calendar, days, dates), science (weather tracking), social-emotional (daily routine)
- **Ages:** 3-7. Larger cells with picture stickers for younger; writing-size cells for older.
- **Creation path:** html (precise grid layout; header illustration can be image-direct)
- **Example activity:** `[monthly-calendar] October calendar with pumpkin header: track daily weather with stickers`

### sorting-worksheet
- **Slug:** `[sorting-worksheet]`
- **Name:** Sorting / classification worksheet
- **What it is:** Labeled zones (2-3 categories) with cut-out images at the bottom. Child cuts images and pastes them into the correct category zone.
- **Best for:** Classification, categorization, properties of objects (hot/cold, living/nonliving, big/small).
- **Subjects:** Science (classification), math (sorting by attribute), ELA (word sorting), social studies (community helpers)
- **Ages:** 3-7. Two categories for younger; three categories for older. Fewer items for younger.
- **Creation path:** hybrid (HTML zones + generated images for cut-outs) or image-direct for simpler versions
- **Example activity:** `[sorting-worksheet] Sort items into Hot and Cold: cut and paste into the correct zone`

### number-practice-page
- **Slug:** `[number-practice-page]`
- **Name:** Single-number focus page
- **What it is:** Single-number focus page with 4-5 activities (tracing, ten frame, number word, counting objects). Repeatable template for numbers 1-20.
- **Best for:** Deep practice on one number at a time: tracing formation, quantity recognition, number word association.
- **Subjects:** Math (counting, number formation)
- **Ages:** 3-6. Larger tracing guides and fewer activities for younger; more complex counting and number bonds for older.
- **Creation path:** html
- **Example activity:** `[number-practice-page] Number 7 practice page with tracing, ten frame, and counting stars`

### one-page-mini-book
- **Slug:** `[one-page-mini-book]`
- **Name:** One-page fold-and-cut mini book
- **What it is:** Single letter-size page with 8-panel grid that folds into an 8-page mini book. Sentence frame stories where each page changes one variable.
- **Best for:** Emergent readers practicing sentence frames, vocabulary reinforcement, any subject where repetition with variation builds fluency.
- **Subjects:** ELA (reading, vocabulary), any subject for review
- **Ages:** 3-8. Simpler sentence frames and larger text for younger; more complex sentences for older.
- **Creation path:** html
- **Example activity:** `[one-page-mini-book] Colors mini book: "I see a ___ ball" with coloring illustrations`

### unit-study-packet
- **Slug:** `[unit-study-packet]`
- **Name:** Multi-page unit study packet
- **What it is:** Multi-page themed bundle (8-12 activity types on one topic). Cover + teacher guide + reference posters + vocabulary + diagrams + coloring + craft + word search. Uses packet recipe.
- **Best for:** Deep dives into a single topic across multiple activity types, ideal for week-long unit studies.
- **Subjects:** Science, social studies, any thematic study
- **Ages:** 4-10. Fewer pages and simpler activities for younger; denser content and more reading for older.
- **Creation path:** html + hybrid (packet recipe)
- **Example activity:** `[unit-study-packet] Butterflies unit study with life cycle diagram, anatomy poster, vocabulary cards, and coloring page`

### labeled-anatomy-diagram
- **Slug:** `[labeled-anatomy-diagram]`
- **Name:** Labeled anatomy / parts diagram
- **What it is:** Scientific illustration with numbered leader lines pointing to parts, word bank at bottom. Three scaffolding levels: fully labeled, numbered with word bank, blank for testing.
- **Best for:** Learning parts of systems: body organs, plant anatomy, animal features, geographic features.
- **Subjects:** Science, social studies (geography)
- **Ages:** 5-12. Fewer parts and larger labels for younger; more detailed structures for older.
- **Creation path:** hybrid
- **Example activity:** `[labeled-anatomy-diagram] Human heart anatomy with 8 labeled parts and word bank`

### cut-and-assemble-craft
- **Slug:** `[cut-and-assemble-craft]`
- **Name:** Cut-and-assemble paper craft
- **What it is:** Page of labeled cutout pieces that child colors, cuts, and assembles into a 3D model or layered diagram. Includes fold lines, glue tabs, assembly instructions.
- **Best for:** Hands-on model building, reinforces spatial reasoning and content knowledge simultaneously.
- **Subjects:** Science (models), art, social studies
- **Ages:** 4-10. Fewer pieces and simpler assembly for younger; more pieces and complex folding for older.
- **Creation path:** hybrid
- **Example activity:** `[cut-and-assemble-craft] 3D volcano model with labeled layers to cut, fold, and glue`

### nature-identification-poster
- **Slug:** `[nature-identification-poster]`
- **Name:** Nature identification poster
- **What it is:** Watercolor grid of 12+ species with labels. Field-guide aesthetic for nature study.
- **Best for:** Nature study, species recognition, building observational vocabulary for outdoor learning.
- **Subjects:** Science (biology, ecology, nature study)
- **Ages:** 4-12. Fewer species and larger images for younger; more species and finer detail for older.
- **Creation path:** hybrid or image-direct
- **Example activity:** `[nature-identification-poster] Backyard birds poster with 16 species illustrations and common names`

### classification-sorting-mat
- **Slug:** `[classification-sorting-mat]`
- **Name:** Classification sorting mat
- **What it is:** T-chart or multi-column sorting mat with labeled category zones plus cut-out pieces at bottom. Designed for lamination and reuse.
- **Best for:** Hands-on sorting and classification, reusable when laminated with velcro dots or magnets.
- **Subjects:** Science (classification), math (sorting by attribute), ELA (word sorting)
- **Ages:** 3-7. Two categories and fewer items for younger; three+ categories for older.
- **Creation path:** html
- **Example activity:** `[classification-sorting-mat] Living vs Non-Living sorting mat with 12 cut-out pictures`

### 3-part-nomenclature-cards
- **Slug:** `[3-part-nomenclature-cards]`
- **Name:** Montessori 3-part nomenclature cards
- **What it is:** Montessori nomenclature card set: labeled image cards (control), unlabeled image cards, name-only labels. Optional 4th set: definition cards. Self-correcting. Realistic imagery preferred.
- **Best for:** Vocabulary acquisition through self-correcting matching, a core Montessori material adaptable to any subject.
- **Subjects:** Science, ELA (vocabulary), social studies, any subject
- **Ages:** 3-8. Fewer cards and simpler vocabulary for younger; more cards and technical terms for older.
- **Creation path:** hybrid
- **Example activity:** `[3-part-nomenclature-cards] Ocean animals nomenclature cards with realistic photographs`

### copy-work-pages
- **Slug:** `[copy-work-pages]`
- **Name:** Copywork handwriting pages
- **What it is:** Handwriting practice using curated quotes, poems, or literature passages. Model text at top, practice lines below. Print and cursive versions available.
- **Best for:** Handwriting fluency, exposure to quality literature, spelling reinforcement through transcription.
- **Subjects:** ELA (handwriting, literature appreciation)
- **Ages:** 5-12. Shorter passages and print for younger; longer passages and cursive for older.
- **Creation path:** html
- **Example activity:** `[copy-work-pages] Robert Louis Stevenson poem copywork with cursive practice lines`

### guided-notes
- **Slug:** `[guided-notes]`
- **Name:** Guided notes page
- **What it is:** Two-column Cornell-style notes: terms/questions on left, notes/examples on right with fill-in blanks. Summary section at bottom. Standalone (not paired with practice page).
- **Best for:** Structured note-taking for new concepts, guides attention to key terms while requiring active processing.
- **Subjects:** Math, science, ELA, social studies
- **Ages:** 8-14. Simpler terms and fewer blanks for younger; denser notes for older.
- **Creation path:** html
- **Example activity:** `[guided-notes] Photosynthesis guided notes with vocabulary column and fill-in-the-blank explanations`

### dot-marker-activity
- **Slug:** `[dot-marker-activity]`
- **Name:** Dot marker activity page
- **What it is:** Large circles (1"+ diameter) arranged to form letters, numbers, or shapes. Child stamps with dot markers/bingo daubers. Extremely low-skill entry point.
- **Best for:** Letter and number recognition for toddlers, combines fine motor with recognition through a satisfying stamping action.
- **Subjects:** Math (number recognition), ELA (letter recognition)
- **Ages:** 2-4. Fewer, larger circles for younger; more circles and complex shapes for older.
- **Creation path:** html or image-direct
- **Example activity:** `[dot-marker-activity] Letter B dot marker page with 15 large circles forming the letter shape`

### playdough-mat
- **Slug:** `[playdough-mat]`
- **Name:** Playdough mat
- **What it is:** Large outline shapes/letters designed as surfaces for playdough building. Thick bold outlines, generous sizing, designed for lamination.
- **Best for:** Tactile letter and number formation, builds fine motor strength while reinforcing recognition.
- **Subjects:** Math (shapes, numbers), ELA (letters)
- **Ages:** 2-5. Simpler shapes for younger; letters and numbers for older.
- **Creation path:** html or image-direct
- **Example activity:** `[playdough-mat] Numbers 1-4 playdough mat with large outlines and counting dots`

### social-narrative
- **Slug:** `[social-narrative]`
- **Name:** Social narrative / social story
- **What it is:** First-person emotional literacy story: normalize the emotion, describe body signals, state the goal, list coping strategies, end with positive affirmation. Illustration + text per page.
- **Best for:** Emotional regulation, social skills development, preparing for challenging situations.
- **Subjects:** Personal & Social Development (emotional regulation, social skills)
- **Ages:** 3-8. Simpler language and fewer pages for younger; more nuanced strategies for older.
- **Creation path:** hybrid (packet recipe for multi-page)
- **Example activity:** `[social-narrative] "When I Feel Frustrated" social story with coping strategies`

### visual-schedule-cards
- **Slug:** `[visual-schedule-cards]`
- **Name:** Visual schedule cards
- **What it is:** Daily routine cards with activity illustrations and labels. Designed for cutting apart, lamination, and sequencing on a board.
- **Best for:** Building daily routine awareness, executive function, independence in transitions.
- **Subjects:** Personal & Social Development (daily routine, executive function)
- **Ages:** 2-7. Fewer cards and simpler routines for younger; more detailed schedules for older.
- **Creation path:** hybrid
- **Example activity:** `[visual-schedule-cards] Morning routine cards: wake up, get dressed, eat breakfast, brush teeth`

### cross-number-puzzle
- **Slug:** `[cross-number-puzzle]`
- **Name:** Cross-number puzzle
- **What it is:** Grid-based number puzzle with row + column sum/product constraints (Beast Academy style). Pre-filled cells and blanks. Pure mathematical puzzle, no decoration.
- **Best for:** Mathematical reasoning and logic, combines operations practice with puzzle-solving satisfaction.
- **Subjects:** Math (operations, number sense, logic)
- **Ages:** 7-12. Addition-only and smaller grids for younger; multiplication and larger grids for older.
- **Creation path:** html
- **Example activity:** `[cross-number-puzzle] 4x4 addition grid where rows and columns must sum to target numbers`

### checklist-assessment
- **Slug:** `[checklist-assessment]`
- **Name:** Parent readiness checklist
- **What it is:** Parent-facing readiness checklist with section headers by skill domain and three assessment columns (Not Yet / Sometimes / Consistently). Tracks 10-15 observable behaviors. Parent tool, not child-facing.
- **Best for:** Milestone tracking, readiness assessment, identifying skill gaps before transitions (e.g., kindergarten readiness).
- **Subjects:** All subjects (academic + social-emotional + motor + executive function)
- **Ages:** 3-7. Developmental milestones vary by target grade/transition.
- **Creation path:** html
- **Example activity:** `[checklist-assessment] Kindergarten readiness checklist covering letters, numbers, motor skills, and social development`

### phonics-spelling-diagnostic-assessment
- **Slug:** `[phonics-spelling-diagnostic-assessment]`
- **Name:** Phonics and spelling home skill check
- **What it is:** An exact-answer home observation packet. Its default mode checks one already-taught skill with two equivalent child forms, a parent guide, and a recording key. A code-issued policy may instead supply a one-form mastery observation or bounded instructional-starting-point screen, but generated prose never owns the score, stop branch, or route.
- **Best for:** Choosing the next small practice step, checking a recently taught pattern, repeating the same skill without repeating items, and rendering a trusted progression screen without assigning a grade or reading level.
- **Subjects:** ELA (letter knowledge, phonics, decoding, spelling, word study)
- **Ages:** 4-12. Evidence sets the skill; age changes only type size and item count.
- **Creation path:** html packet with exact page roles and a validated structured blueprint. Mastery and starting-point modes require an external versioned policy.
- **Example activity:** `[phonics-spelling-diagnostic-assessment] Two equivalent six-item short-a reading forms for Maya, with a parent stop rule and exact item-by-item record page.`

### phoneme-letter-building-mat
- **Slug:** `[phoneme-letter-building-mat]`
- **Name:** Phoneme-letter building mat
- **What it is:** A reusable mat with one large box per spoken sound, plus cut-apart grapheme tiles and a separate parent key. The child says each sound, moves the validated tile or tile group into position, then sweeps and blends.
- **Best for:** Segmenting and blending a taught word pattern, comparing phoneme count with letter count, and hands-on word building before writing.
- **Subjects:** ELA (phonemic awareness, phonics, decoding, spelling)
- **Ages:** 4-8. Use three large sound positions first, then four when the trusted target records require them.
- **Creation path:** html packet (exact sound boxes, tile multiset, cut lines, and parent answer map)
- **Example activity:** `[phoneme-letter-building-mat] A three-sound mat and exact grapheme-tile set for six validated words in one taught pattern.`

### grapheme-marking-practice
- **Slug:** `[grapheme-marking-practice]`
- **Name:** Grapheme marking practice
- **What it is:** A clean word-marking page where each item has code-validated grapheme spans. The child reads the word and underlines each sound spelling using one plain convention; a separate parent key shows the exact spans.
- **Best for:** Noticing digraphs and trigraphs, comparing known spellings of one sound, and preparing a taught word set for sorting or spelling practice.
- **Subjects:** ELA (phonics, decoding, spelling, word study)
- **Ages:** 5-9. Younger learners get six large rows; older learners may use up to ten while keeping generous pencil space.
- **Creation path:** html packet (exact character spans, baselines, modeled item, and answer key)
- **Example activity:** `[grapheme-marking-practice] Eight validated words from one taught digraph set, with an original worked example and a separate span-marked key.`

### picture-supported-syllable-ordering
- **Slug:** `[picture-supported-syllable-ordering]`
- **Name:** Picture-supported syllable ordering
- **What it is:** A two-page Spanish word-building packet. Each child card shows one concrete picture, a trusted word's syllable chunks in a verified scrambled order, and one bounded area for writing the reconstructed whole word. The separate key preserves exact ordered chunks and answers.
- **Best for:** Practicing already-taught Spanish syllable patterns and concrete vocabulary without adding cutting, pasting, or a visible model word.
- **Subjects:** Spanish (foundational literacy, syllable structures, word formation)
- **Ages:** 6-9. Begin with four large two-syllable cards, then use up to eight two- or three-syllable targets when trusted records support them.
- **Creation path:** hybrid packet (one reviewed composed picture sheet plus exact HTML chunks, permutations, response cells, item ids, and key)
- **Example activity:** `[picture-supported-syllable-ordering] Six trusted Spanish picture words with validated two-syllable chunks, a non-answer permutation for each, and a separate exact key.`

### phonics-sound-card-game
- **Slug:** `[phonics-sound-card-game]`
- **Name:** Phonics sound card game
- **What it is:** A cut-apart reading and matching deck whose hidden family ids form exact pairs or small sets by one taught sound-spelling rule. A shared duplex-safe back and parent answer map keep the child cards cue-free.
- **Best for:** Repeated decoding through play, matching words with one grapheme, grouping allowed spellings of one known sound, and short family rounds.
- **Subjects:** ELA (phonics, decoding, spelling patterns)
- **Ages:** 5-9. Begin with 6 to 8 closed pairs and expand only after the rule is familiar.
- **Creation path:** html packet (card fronts, shared back, closed answer map, and exact card ids)
- **Example activity:** `[phonics-sound-card-game] A twelve-card original Sound match deck with six code-validated pairs for one taught sound-spelling relationship.`

### decodable-story-page
- **Slug:** `[decodable-story-page]`
- **Name:** Decodable story page
- **What it is:** A short original connected-text page whose every printed token and grapheme span has passed deterministic validation against a closed taught inventory, followed by a parent guide naming the practiced patterns and explicit heart words.
- **Best for:** Applying taught phonics beyond isolated words, building short connected-text stamina, and making a personalized story from a validated decoding inventory.
- **Subjects:** ELA (phonics, decoding, reading fluency)
- **Ages:** 4-9. Sentence count, line length, and type size follow reading evidence, never a printed grade label.
- **Creation path:** html packet (exact validated text, line breaks, page roles, and parent inventory note)
- **Example activity:** `[decodable-story-page] An original eight-sentence story built only from one child's validated taught word inventory and named heart words.`

### clip-cards
- **Slug:** `[clip-cards]`
- **Name:** Clip cards
- **What it is:** Cards with a target item on top and 3 answer choices along the bottom edge. The child clips a clothespin on the correct answer. Self-checking when printed double-sided with a dot behind the right choice.
- **Best for:** Fine-motor practice fused with recognition drill; independent quiet-time work when laminated.
- **Subjects:** Math (counting, numerals), ELA (letter sounds, rhymes), science (sorting), languages (vocabulary)
- **Ages:** 3-7. Bigger targets and 2 choices for the youngest; 3 choices standard.
- **Creation path:** html for the card grid; hybrid when target images need illustration.
- **Example activity:** `[clip-cards] Count the ladybugs and clip the numeral, 8 cards with self-check dots`

### file-folder-game
- **Slug:** `[file-folder-game]`
- **Name:** File-folder game
- **What it is:** Two pages glued inside a manila file folder: a themed board with labeled zones plus moveable cut-out pieces the child places on the board. A reusable learning station that closes and stores on a shelf.
- **Best for:** Matching and sorting skills the family wants to revisit; reusable across siblings.
- **Subjects:** Math (numeral to quantity, money), science (habitats, classification), ELA (letter matching), social studies (presidents, maps)
- **Ages:** 3-8. Piece sets can be swapped harder onto the same board as the child grows.
- **Creation path:** html for board zones and labels; hybrid for illustrated pieces; packet recipe for assembly.
- **Example activity:** `[file-folder-game] Animal habitats board with 12 animal pieces to sort into forest, ocean, and desert zones`

### cloze-story
- **Slug:** `[cloze-story]`
- **Name:** Cloze story
- **What it is:** A short story with key words blanked out and a word bank to choose from. The picture-label variant puts an illustrated scene on top with sentence frames below describing it.
- **Best for:** Vocabulary in context, grammar in context, reading-writing integration without blank-page intimidation.
- **Subjects:** ELA (vocabulary, sight words, grammar, comprehension), languages
- **Ages:** 5-10. Word bank at base level; remove the bank or add distractors to level up.
- **Creation path:** html
- **Example activity:** `[cloze-story] A story about the child's own dog with 8 blanks and a word bank of action verbs`

### reading-comprehension-mini-unit
- **Slug:** `[reading-comprehension-mini-unit]`
- **Name:** Reading comprehension mini-unit
- **What it is:** A magazine-style multi-page unit: illustrated passage with vocabulary sidebar, explicit skill lesson with graphic organizer, a second transfer passage applying the skill to new text, and vocabulary work.
- **Best for:** Proving skill transfer, nonfiction reading stamina, "reads fine but does not remember" situations.
- **Subjects:** ELA (comprehension skills), science and social studies (nonfiction topics as passage content)
- **Ages:** 6-12. Passage length and question depth scale with reading level evidence.
- **Creation path:** hybrid for passage pages (real photos for nonfiction), html for skill and vocabulary pages, packet recipe for assembly.
- **Example activity:** `[reading-comprehension-mini-unit] Sequence skill unit: butterfly life cycle passage, then apply to a ladybug passage`

### hive-puzzle
- **Slug:** `[hive-puzzle]`
- **Name:** Hive puzzle
- **What it is:** Hexagonal grid logic puzzle. Students fill empty hexagons following a constraint rule (e.g., smallest number not in any adjacent cell). Based on Beast Academy Hive Puzzles.
- **Best for:** Logical reasoning, spatial thinking, number sense, constraint satisfaction.
- **Subjects:** Math (logic, number sense)
- **Ages:** 7-12. Fewer hexagons and simpler rules for younger; larger clusters and harder rules for older.
- **Creation path:** image-direct
- **Example activity:** `[hive-puzzle] 7-hexagon clusters: fill each cell with 1-7 so no touching hexagons share a number`

### fraction-link-puzzle
- **Slug:** `[fraction-link-puzzle]`
- **Name:** Fraction link puzzle
- **What it is:** Grid puzzle with fractions and whole numbers. Students find relationships between adjacent cells (equivalence, simplification) to complete the grid.
- **Best for:** Fraction equivalence, simplification, fraction-whole number relationships.
- **Subjects:** Math (fractions)
- **Ages:** 8-12. Simple fractions (halves, thirds) for younger; complex fractions and mixed numbers for older.
- **Creation path:** image-direct
- **Example activity:** `[fraction-link-puzzle] 4x5 grid with fraction equivalence: fill blanks so adjacent cells simplify to the same value`

### fraction-maze-escape
- **Slug:** `[fraction-maze-escape]`
- **Name:** Fraction maze escape
- **What it is:** Grid of fractions where students trace a path from start to exit following a mathematical rule (e.g., decreasing value, only proper fractions).
- **Best for:** Fraction comparison, ordering, number sense in a puzzle context.
- **Subjects:** Math (fractions, ordering)
- **Ages:** 8-12. Simple fractions for younger; mixed numbers and improper fractions for older.
- **Creation path:** image-direct
- **Example activity:** `[fraction-maze-escape] 5x5 fraction grid: trace a path from top-left to bottom-right using only decreasing fractions`

### decimal-path-puzzle
- **Slug:** `[decimal-path-puzzle]`
- **Name:** Decimal path puzzle
- **What it is:** Network of connected nodes with decimal numbers. Students trace the correct path following a rule (increasing order, sums to target).
- **Best for:** Decimal comparison, ordering, place value understanding.
- **Subjects:** Math (decimals, place value)
- **Ages:** 9-12. Tenths for younger; hundredths and thousandths for older.
- **Creation path:** image-direct
- **Example activity:** `[decimal-path-puzzle] Trace a path from Start to End visiting nodes in increasing decimal order`

### daily-rhythm-cards
- **Slug:** `[daily-rhythm-cards]`
- **Name:** Daily rhythm cards
- **What it is:** Printable cards for building a visual daily schedule. Each card has an icon, activity name, and optional time slot. Cut apart and arrange on a schedule board.
- **Best for:** Routine building, time management, transitions, executive function.
- **Subjects:** Personal & Social Development (routine, executive function)
- **Ages:** 3-8. Fewer cards and picture-only for younger; more cards with time slots for older.
- **Creation path:** html
- **Example activity:** `[daily-rhythm-cards] 12 cards: Morning Circle, Read Aloud, Math Time, Snack, Art, Science, Free Play, Writing, Music, Nature Walk, Clean Up, Story Time`

### activity-pack
- **Slug:** `[activity-pack]`
- **Name:** Activity pack (multi-activity page)
- **What it is:** Single page with 4 mini-activities in quadrants around one theme. Covers different skill types (counting, labeling, creative, knowledge). Can be cut apart.
- **Best for:** Multi-skill reinforcement, unit study companions, choice boards.
- **Subjects:** Any, themed (animals, seasons, topics). Each quadrant targets a different skill.
- **Ages:** 3-7. Simpler activities for younger; more complex prompts for older.
- **Creation path:** hybrid
- **Example activity:** `[activity-pack] Ocean Animals: count sea creatures, label parts of a fish, draw your favorite ocean animal, true/false ocean facts`

### singapore-workbook-page
- **Slug:** `[singapore-workbook-page]`
- **Name:** Singapore math workbook page
- **What it is:** Visual-manipulative math page using ten-frames, bar models, and CPA progression (concrete → pictorial → abstract). Modeled after Dimensions Math / Singapore Math approach.
- **Best for:** Building number sense through visual representations, making ten, number bonds.
- **Subjects:** Math (operations, number bonds, place value)
- **Ages:** 4-9. Ten-frames and simple addition for younger; bar models and multi-step for older.
- **Creation path:** hybrid
- **Example activity:** `[singapore-workbook-page] Addition to 20: ten-frame dot manipulation showing 8 + 5 by making 10 first`

### narration-page
- **Slug:** `[narration-page]`
- **Name:** Narration page
- **What it is:** A title/prompt header, a large blank box for the child's own illustration, and wide-ruled lines below for a parent to transcribe the child's spoken words. No answer key.
- **Best for:** Charlotte Mason narration and journaling, personal reflection prompts, family-history memory pages, science and nature discovery logs.
- **Subjects:** ELA (narration), Personal & Social Development (journaling), science and nature study (discovery logs)
- **Ages:** 4-8. A calendar-tracking header row suits science logs; a shaped illustration frame (heart, book) suits milestone pages.
- **Creation path:** html
- **Example activity:** `[narration-page] "What happened in the story today?": illustration box on top, six dictation lines below`

### artist-composer-study-card
- **Slug:** `[artist-composer-study-card]`
- **Name:** Artist / composer study card
- **What it is:** A reusable portfolio card for Charlotte Mason picture study or composer study: name banner, artwork frame or listening icon, a "where they were from" map circle, and a reflection box.
- **Best for:** Art appreciation, music appreciation, building a running artist/composer portfolio across a school year.
- **Subjects:** Art (picture study), music (composer study), science (inventor and scientist study)
- **Ages:** 4-10. One card per artist, composer, or inventor, same template reused week to week.
- **Creation path:** html
- **Example activity:** `[artist-composer-study-card] Composer study card for Scott Joplin: name banner, "where they were from" circle, and a reflection box`

### composer-listening-guide
- **Slug:** `[composer-listening-guide]`
- **Name:** Composer listening guide
- **What it is:** A one-page active-listening companion for a single piece of music: a listen-for callout naming one concrete hook, 3-5 ordered moment boxes the child checks or sketches as the music reaches them, and a feeling-response line.
- **Best for:** Composer study rotations, Charlotte Mason music appreciation, first classical-music listening sessions, program music with a built-in story.
- **Subjects:** Music (composer study, music appreciation)
- **Ages:** 5-10. One piece per page; no music notation anywhere.
- **Creation path:** html
- **Example activity:** `[composer-listening-guide] Listening guide for Beethoven's Pastoral Symphony: listen for the bird calls, then catch the brook, the storm, and the shepherd's thankful song`

### nature-observation-journal
- **Slug:** `[nature-observation-journal]`
- **Name:** Nature observation journal
- **What it is:** A weekly nature-notebook page the child fills in with their own drawing and words after time outside: a choice profile, five-senses log, side-by-side comparison, or open discovery layout.
- **Best for:** Charlotte Mason nature study, outdoor observation journals, seasonal nature walks, wildlife and specimen logging.
- **Subjects:** Science (nature study, animals, plants)
- **Ages:** 4-10. Mostly blank for the child's own drawing, never Homa-supplied reference art.
- **Creation path:** html
- **Example activity:** `[nature-observation-journal] Five-senses tree log: "I see / I hear / I smell / I feel" prompts beside a drawing box, with a circle to attach a leaf`

### letter-number-formation-practice
- **Slug:** `[letter-number-formation-practice]`
- **Name:** Letter & number formation practice
- **What it is:** One letter or digit per page: a bold model with a plain-language stroke cue underneath, a formation box (a single box for capitals and digits, a three-band ceiling/chair-rail/floor box for lowercase), a row of trace repetitions that fade from full model to blank, and a starting dot at the stroke's exact starting point.
- **Best for:** Developmental or multisensory handwriting curricula that teach letters and numbers stroke by stroke in a shared-shape teaching order (not alphabet or count order), pre-writing stroke practice before real letters begin.
- **Subjects:** ELA (handwriting), math (number formation)
- **Ages:** 3-6. Larger boxes and fewer repetitions for younger; smaller boxes and more repetitions for older.
- **Creation path:** html (exact box geometry and baseline placement are critical)
- **Example activity:** `[letter-number-formation-practice] Capital letter T: "Big line down, little line across the top," four trace boxes fading to one blank box`

### art-project-instructions
- **Slug:** `[art-project-instructions]`
- **Name:** Art project instructions
- **What it is:** A materials list followed by 3-6 numbered steps for making one concrete art or craft piece, with an optional small inspiration thumbnail and an optional closing reflection question. A bare technique-reference variant drops the thumbnail and reflection box for a plain how-to card. An optional skill-tip callout box names and defines one inquiry skill for a hands-on science investigation instead of the reflection question.
- **Best for:** Formal skills-based art curricula built around the Elements of Art and Principles of Design, a published science textbook's recurring hands-on "Investigate" activity, or any curriculum with a recurring "make something" or "try this" activity that rotates through different media or materials using the same page shell each time.
- **Subjects:** Art (making, technique, elements and principles), Science (hands-on investigations and experiments)
- **Ages:** 5-10. Fewer, larger steps for younger; more steps and a reflection prompt (or skill-tip callout, for science) tied to the family's own comprehension-skill or process-skills vocabulary for older.
- **Creation path:** hybrid (generate_image for the inspiration thumbnail, HTML for the materials list and steps) or html-only for the bare technique-reference variant
- **Example activity:** `[art-project-instructions] Paper-plate weaving: materials list, five numbered steps, and a reflection question about the pattern the child made`

### then-and-now-comparison
- **Slug:** `[then-and-now-comparison]`
- **Name:** Then and now comparison
- **What it is:** A two-panel page comparing something from the past against today ("Then"/"Now", "Long Ago"/"Today", "First"/"Now"), each panel with a small illustration and a one- or two-sentence caption, plus a reflection question asking the child to name what changed.
- **Best for:** Elementary social studies units on communities, chores, toys, transportation, or national symbols across time; science units comparing an early tool or invention to its modern form; any curriculum with a recurring "then and now" or "long ago and today" feature box.
- **Subjects:** Social studies (communities and change over time), Science (tools and inventions over time)
- **Ages:** 5-9. A single clear comparison for younger; a comparison plus a written reflection sentence for older.
- **Creation path:** hybrid (one generate_image call for the complete split illustration, HTML for the panel frames, labels, and reflection box), or html-only for a text-and-caption-only comparison
- **Example activity:** `[then-and-now-comparison] How toys have changed: a wooden top labeled "Then" beside a remote-control car labeled "Now," with a reflection question about what stayed the same`

### size-attribute-comparison-page
- **Slug:** `[size-attribute-comparison-page]`
- **Name:** Size attribute comparison page
- **What it is:** A page comparing two or three illustrated items along one physical attribute (length, height, weight, or overall size), where the child circles or colors the correct item ("the longer one," "the heavier one") or draws a new item bigger or smaller than a model. A balance-scale variant compares weight on a seesaw or balance.
- **Best for:** Pre-number measurement readiness before any unit of measurement is introduced; Singapore-style Pre-K/K comparison lessons (big/small, long/short, tall/short, heavy/light); any early-math curriculum teaching comparative adjectives through paired objects.
- **Subjects:** Math (measurement readiness, pre-number comparison)
- **Ages:** 3-6. Two items and one clear attribute for younger; a three-item "circle the biggest" row once the two-item version is solid.
- **Creation path:** hybrid (one generate_image call containing all compared items, HTML for the instruction line and circle/color prompts), or html-only for a simple two-shape version.
- **Example activity:** `[size-attribute-comparison-page] Three ribbons of different lengths lined up on a shared baseline; "Circle the longest ribbon."`

### pattern-extension-practice
- **Slug:** `[pattern-extension-practice]`
- **Name:** Pattern extension practice
- **What it is:** A page built around one repeating sequence (an AB pattern like red-blue-red-blue) using colors, shapes, or icons, where the child copies a shown pattern, identifies what comes next, matches the continuation, or creates an original pattern in a blank row.
- **Best for:** Pre-number pattern and sequence readiness; any early-math curriculum with a dedicated patterns unit (Singapore-style movement/sound/visual pattern lessons, Montessori pattern work, general Pre-K/K "what comes next" pages).
- **Subjects:** Math (pre-number pattern recognition and sequencing)
- **Ages:** 3-6. AB (two-element) patterns first; AAB/ABB/ABC variants only once AB is solid.
- **Creation path:** html (uniform, evenly-spaced shapes or colors) or hybrid when the pattern units are themed illustrations.
- **Example activity:** `[pattern-extension-practice] A row of red-blue-red-blue-red beads with two blank cells at the end; "Color the beads to finish the pattern."`

### comic-narrative-math-page
- **Slug:** `[comic-narrative-math-page]`
- **Name:** Comic narrative math page
- **What it is:** A short comic strip (2-4 panels) where one or two original illustrated characters trade speech-bubble dialogue that teaches a concept conversationally, ending in a visually separated "stop and try it" box with a question tied to the same scenario. The dialogue IS the lesson, not a caption under one.
- **Best for:** Any curriculum or family request that wants a concept taught through character and story rather than direct instruction; re-engaging a child who skims past a bare instruction line; making an abstract idea concrete through a relatable everyday scene.
- **Subjects:** Math and any other subject; the panel-plus-dialogue-plus-question shape is not math-specific.
- **Ages:** 4-8.
- **Creation path:** hybrid (one generate_image call for the complete panel sequence, HTML for panel frames, speech bubbles, and the closing question box).
- **Example activity:** `[comic-narrative-math-page] Two kids comparing two curly noodles on a lunch tray, one straight and one curved, arguing about which is longer, ending in a "Which path is shorter: the straight one or the wiggly one?" box.`

### circle-diagram-two-set-sort
- **Slug:** `[circle-diagram-two-set-sort]`
- **Name:** Circle diagram two-set sort
- **What it is:** Two large overlapping circles, each labeled with one category, where the child places items, numbers, or words into one circle only, the other circle only, the overlapping middle (both attributes), or outside both circles (neither attribute). The overlap is the point: some items genuinely belong to both categories at once, unlike a mutually-exclusive column sort.
- **Best for:** Classifying numbers by two properties at once (odd vs. even, perfect square vs. prime), sorting words or letters by two rules, science classification by two traits (flies vs. swims), and any two-rule sort where an item can qualify for both.
- **Subjects:** Math (number properties), science (classification), ELA (vocabulary categories)
- **Ages:** 6-9.
- **Creation path:** html for plain number/word/letter sorts, hybrid when items are illustrated attribute cards.
- **Example activity:** `[circle-diagram-two-set-sort] Numbers 1-9 to place in a diagram labeled "perfect squares" and "odd numbers," where 1 and 9 belong in the overlap and 2, 4, 6, 8 belong outside both.`

### picture-bingo-board
- **Slug:** `[picture-bingo-board]`
- **Name:** Picture or text bingo board
- **What it is:** A set of bingo-style boards built from one shared item pool. Each grid carries a different shuffle plus one free space. Picture mode uses one composed visual board with exact HTML overlays; text mode uses exact HTML words or graphemes and no image cue.
- **Best for:** Vocabulary recall, listening practice, lower-pressure drill, group or co-op play, and text-only decoding rounds from one validated taught phonics pool.
- **Subjects:** Any subject or language with a discrete item pool, especially vocabulary, sight words, phonics, and math facts.
- **Ages:** 3-8. A 3x3 grid (8 items plus free space) for ages 3-6 or 8-9 item pools; a 4x4 grid for ages 7+ or larger pools.
- **Creation path:** hybrid for picture boards (one composed board image per page plus exact HTML overlay); html only for text boards.
- **Example activity:** `[picture-bingo-board] Four shuffled 3x3 text-only boards from one validated taught phonics pool, with a caller list and no picture cues.`

### chant-and-rhyme-card
- **Slug:** `[chant-and-rhyme-card]`
- **Name:** Chant and rhyme card
- **What it is:** A one-page say-aloud card for a traditional chant, nursery rhyme, or fingerplay: the full text in large read-aloud type, one spoken line per printed line, with optional leader/everyone chips for call-and-response, italic clap or action hints, and a small parent footer on how to teach it. Nothing to trace, cut, or fill in; the page is for saying together, not writing.
- **Best for:** Circle-time and morning-basket routines, rhyme and rhythm play that builds phonological awareness before formal phonics, oral language for toddlers and preschoolers, memory work, call-and-response games, and clapping or jump-rope chants for older siblings.
- **Subjects:** ELA (phonological awareness, oral language), music (steady beat), Spanish and other languages (traditional rhymes in the target language)
- **Ages:** 2-6 for saying along; 5-8 for jump-rope and clapping-game chants
- **Creation path:** html (precise typography for cues and line breaks; optional hybrid for one small spot illustration). Traditional public-domain or family-created chants only, never a published compiler's arrangement.
- **Example activity:** `[chant-and-rhyme-card] "One potato, two potato" counting-out chant with "(tap fists on each potato)" action hints and a parent footer on letting the child join in over several days.`

### biography-timeline-page
- **Slug:** `[biography-timeline-page]`
- **Name:** Biography timeline page
- **What it is:** A chronological strip of 5-8 labeled event boxes, each pairing a year or age with a one-line event and a small illustration, connected by a single line so the sequence reads as forward time. A life-events mode follows a real person's own biographical milestones; an invention-progression mode follows an invention or technology's own timeline instead of a person's life.
- **Best for:** Biography study of an artist, composer, inventor, or scientist; any curriculum wanting the progression of a technology or invention shown rather than told. Recurred independently across three Getting to Know biography drops (artists, composers, inventors and scientists) this session.
- **Subjects:** Art, music, science, history (biography and invention history)
- **Ages:** 6-10.
- **Creation path:** hybrid (one generate_image call for the complete event strip, HTML for the boxes, connecting line, and labels), or html-only for a text-and-caption-only timeline.
- **Example activity:** `[biography-timeline-page] Alexander Graham Bell's life: born 1847, taught deaf students and invented visible speech in the 1870s, patented the telephone in 1876, founded a school for the deaf, died 1922.`

### chart-and-graph-skill-practice
- **Slug:** `[chart-and-graph-skill-practice]`
- **Name:** Chart and graph skill practice
- **What it is:** A page teaching one concrete data-reading skill (read a calendar, read a timeline, read a labeled diagram, or read a bar graph): a small worked example models the reading move, then the child answers 2-4 practice questions about a second, independent version of the same display.
- **Best for:** Cross-subject data literacy: math data & statistics, science process diagrams, social studies chart-reading lessons. An evergreen skill that recurs across every subject, confirmed recurring 5 times in one social studies textbook alone.
- **Subjects:** Math (data & statistics), science (process diagrams), social studies (chart and calendar reading)
- **Ages:** 6-10.
- **Creation path:** html (grid, axis, and tick-mark precision are the point).
- **Example activity:** `[chart-and-graph-skill-practice] Reading a bar graph: a worked example showing 4 books read on Tuesday, then a practice bar graph of a different week with 3 questions about specific days.`

### lesson-comprehension-check
- **Slug:** `[lesson-comprehension-check]`
- **Name:** Lesson comprehension check
- **What it is:** A fixed "What Did You Learn?" box that closes a taught lesson with exactly 2 literal recall questions plus 1 open "Think and Share" or "Write and Share" question tied to the lesson's actual target skill.
- **Best for:** Any subject that ends a taught lesson or a read passage with a quick recall-plus-application close. A fixed, recurring feature box in published elementary textbooks (28 occurrences in one social studies book alone), but the shape is subject-agnostic.
- **Subjects:** Any subject with a taught lesson or read passage (social studies, science, ELA, history)
- **Ages:** 6-11.
- **Creation path:** html (a short, precise box; no illustration budget needed).
- **Example activity:** `[lesson-comprehension-check] Closes a lesson on river crossings: "What did the pioneers use to cross the river?", "Why did the town build a bridge there?", and "How would your family cross a river if there were no bridge nearby?"`

### magic-square-puzzle
- **Slug:** `[magic-square-puzzle]`
- **Name:** Magic square puzzle
- **What it is:** An n-by-n grid (commonly 3x3 or 4x4) where the child fills in missing numbers so every row, every column, AND both diagonals sum to the same stated target. Some cells are given, some blank. Self-checking by constraint satisfaction, and distinct from cross-number-puzzle's edge-labeled row/column sums.
- **Best for:** Addition fluency, logical reasoning; a well-known, evergreen enrichment-math format used far beyond any one curriculum.
- **Subjects:** Math (addition fluency, logical reasoning)
- **Ages:** 7-11. A 3x3 with more given cells for younger; a 3x3 with fewer givens or a 4x4 for older.
- **Creation path:** html (precise grid layout and borders, matching cross-number-puzzle's cell geometry).
- **Example activity:** `[magic-square-puzzle] A 3x3 grid where every row, column, and diagonal must sum to 15, with 5 of the 9 cells already filled in.`

### reader-theater-script
- **Slug:** `[reader-theater-script]`
- **Name:** Reader theater script
- **What it is:** A multi-character performance script where children read assigned roles aloud, building oral reading fluency through dramatic rehearsal and repeated reading. Not a worksheet: nothing to fill in, cut, or paste. The child reads, re-reads across multiple sessions, and performs. Includes character-name labels before each line, choral/group lines marked distinctly, stage directions in brackets, and a parent note on how to use it.
- **Best for:** Oral reading fluency, reading with expression, high-frequency word practice, comprehension through performance, collaborative family learning, reluctant readers who respond to drama, emergent readers who can join choral refrains.
- **Subjects:** ELA (reading fluency, comprehension, vocabulary), cross-curricular when the script content covers science, social studies, or life skills.
- **Ages:** 5-10. K-1 scripts use choral reading and pictograms for non-readers; grades 2-4 scripts add individual narrator roles and longer lines.
- **Creation path:** html (precise typographic control for character labels, stage directions, and choral vs. individual line styling).
- **Example activity:** `[reader-theater-script] "The Garden Helpers": a 4-character script about children planting a garden, with choral refrains about what plants need (sun, water, soil), grounding science vocabulary in a daily-life activity. 12 lines for K-1.`

### child-assisted-recipe-card
- **Slug:** `[child-assisted-recipe-card]`
- **Name:** Child-assisted recipe card
- **What it is:** A one-page family cooking guide with exact ingredients and tools, a separate ADULT FIRST safety strip, and 3-6 large picture-supported CHILD step cards. It closes with one serving job and one cleanup job.
- **Best for:** Practical-life cooking, preschool theme weeks, simple measuring and counting practice, and turning a parent-approved recipe into real work a child can follow beside an adult.
- **Subjects:** Life skills (kitchen and cooking), math (counting and measuring), science (sensory observation)
- **Ages:** 3-8. Ages 3-4 get at most four large steps with ingredients prepared or premeasured by the adult. Older children may measure and read short labels when family evidence supports it. Heat, blades, raw animal proteins, and powered appliances remain adult jobs.
- **Creation path:** html (ingredient amounts, actor labels, step order, and safety ownership must remain exact; small one-color inline icons are redundant cues)
- **Example activity:** `[child-assisted-recipe-card] An original six-cup berry yogurt recipe with adult-prepared fruit, four child jobs, a counting prompt, serving, and table cleanup.`
