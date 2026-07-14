# Activity Format Registry

Machine-readable registry of every format materials-studio can produce.
The curriculum writer loads this to recommend buildable activities.

---

### foldable
- **Slug:** `[foldable]`
- **Name:** Foldable / interactive notebook insert
- **Modality:** kinesthetic
- **What it is:** A tactile learning tool the child prints, cuts, folds, and glues into a notebook. Reference material and practice live on the same physical object.
- **Best for:** Concepts with sequential steps, vocabulary sets, mnemonics, any topic where tactile manipulation aids memory.
- **Subjects:** Math (order of operations, formulas), science (classification, cycles), ELA (grammar rules, vocabulary)
- **Ages:** 5-14. Younger kids get two-flap books; older get accordion tri-folds with embedded practice.
- **Creation path:** hybrid (doodle art + HTML structure) or image-direct for art-driven foldables; html for text-heavy reference foldables.
- **Example activity:** `[foldable] Build a PEMDAS foldable with color-coded operations and practice problems`

### structured-outline
- **Slug:** `[structured-outline]`
- **Name:** Structured outline / essay scaffold
- **Modality:** reading_writing
- **What it is:** A fill-in-the-blank framework with labeled sections and a two-column instruction|work layout. Teaches process by breaking complex tasks into steps.
- **Best for:** Essay writing, research projects, book reports, any multi-step writing or planning task.
- **Subjects:** ELA (essays, reports), social studies (research), science (lab reports)
- **Ages:** 8-16. Simpler versions have fewer sub-fields and more writing space; advanced versions add evidence slots.
- **Creation path:** html (always — text precision and surgical revision are the point)
- **Example activity:** `[structured-outline] Five-paragraph essay outline with thesis, evidence, and transition fields`

### counting-mat
- **Slug:** `[counting-mat]`
- **Name:** Counting mat
- **Modality:** visual
- **What it is:** Groups of themed images the child counts, with empty boxes to write each total. One skill per page.
- **Best for:** Counting practice, one-to-one correspondence, cardinality, comparing quantities.
- **Subjects:** Math (counting, early number)
- **Ages:** 2-6. Younger kids get 2-3 giant groups; older get 4-6 groups with higher counts.
- **Creation path:** html (repeat one generated image) or image-direct for simple layouts
- **Example activity:** `[counting-mat] Count groups of dinosaurs (1-10) and write the number`

### tracing-guide
- **Slug:** `[tracing-guide]`
- **Name:** Tracing guide
- **Modality:** kinesthetic
- **What it is:** Pale letters or numbers over a three-line guide with starting dots. The child traces to build motor memory.
- **Best for:** Letter formation, number writing, name practice.
- **Subjects:** ELA (handwriting), math (number formation)
- **Ages:** 3-7. Larger letters and fewer per line for younger; smaller with more repetitions for older.
- **Creation path:** html (exact proportions and guide spacing)
- **Example activity:** `[tracing-guide] Trace uppercase and lowercase Mm with starting dots`

### flash-cards
- **Slug:** `[flash-cards]`
- **Name:** Flash cards / cut-outs
- **Modality:** visual
- **What it is:** A 2x2 or 2x3 grid of cards with dashed cut borders. Each card has a term, image, or problem on one side.
- **Best for:** Drill and recall — sight words, math facts, vocabulary, matching games.
- **Subjects:** Any subject with discrete facts to memorize
- **Ages:** 3-14. Simpler content and larger cards for younger; denser content for older.
- **Creation path:** html (precise grid and cut lines)
- **Example activity:** `[flash-cards] Sight word flash cards for Fry's first 20 words`

### coloring-page
- **Slug:** `[coloring-page]`
- **Name:** Coloring page
- **Modality:** kinesthetic
- **What it is:** Black and white line art with thick clean outlines, no shading. The child colors it in.
- **Best for:** Fine motor practice, creative expression, reward activities, themed reinforcement.
- **Subjects:** Art, any subject as a reward or warm-up
- **Ages:** 2-10. Simpler shapes and fewer details for younger; intricate designs for older.
- **Creation path:** image-direct (line art is the image model's strength)
- **Example activity:** `[coloring-page] Brave dalmatian puppy pilot in a rescue ring`

### poster
- **Slug:** `[poster]`
- **Name:** Poster / reference chart
- **Modality:** visual
- **What it is:** A single-page visual reference the child can hang up. Bold title, key information, illustrations.
- **Best for:** Reference material meant to be displayed — alphabet charts, multiplication tables, science diagrams.
- **Subjects:** Any subject needing a visual reference
- **Ages:** 3-14. Simpler with fewer items for younger; denser information for older.
- **Creation path:** image-direct or hybrid
- **Example activity:** `[poster] Solar system poster with planet names and relative sizes`

### themed-worksheet
- **Slug:** `[themed-worksheet]`
- **Name:** Themed worksheet
- **Modality:** visual
- **What it is:** Exercises paired with themed illustrations. Precise academic content with engaging art.
- **Best for:** Any drill or practice that benefits from visual engagement and theming.
- **Subjects:** Math, ELA, science — any subject
- **Ages:** 3-10. Fewer items and larger art for younger; more problems and smaller art for older.
- **Creation path:** hybrid (generate_image for art, HTML for exercises)
- **Example activity:** `[themed-worksheet] Space-themed addition problems (sums to 20) with rocket illustrations`

### handwriting-practice
- **Slug:** `[handwriting-practice]`
- **Name:** Handwriting practice
- **Modality:** kinesthetic
- **What it is:** Rows of practice lines (three-line guide or letter boxes) with model letters. Curriculum-aware: supports both three-line guides and box-style (Handwriting Without Tears).
- **Best for:** Letter formation drill, name writing, sentence copying.
- **Subjects:** ELA (handwriting)
- **Ages:** 3-8. Larger boxes/lines and fewer rows for younger; smaller with more rows for older.
- **Creation path:** html (exact proportions are critical)
- **Example activity:** `[handwriting-practice] Practice writing first name with three-line guides and starting dots`

### maze-practice
- **Slug:** `[maze-practice]`
- **Name:** Maze / puzzle practice
- **Modality:** visual
- **What it is:** A navigation challenge where correct answers advance through the maze and wrong answers dead-end. Self-checking without an answer key.
- **Best for:** Transforming rote drill into a game — math facts, phonics, vocabulary, sight words.
- **Subjects:** Math, ELA, vocabulary — any fact-based drill
- **Ages:** 5-12. Simpler paths with fewer decision points for younger; complex branching for older.
- **Creation path:** hybrid (generate_image for maze paths, HTML for answer labels) or image-direct for simpler mazes
- **Example activity:** `[maze-practice] Follow the correct multiplication facts (x7) through the maze`

### cut-and-paste
- **Slug:** `[cut-and-paste]`
- **Name:** Cut-and-paste word work
- **Modality:** kinesthetic
- **What it is:** Grid layout with one word per cell: printed model word, writing line for practice, and cut-out tiles at bottom with dotted cut lines. Multi-sensory: see, write, cut, paste.
- **Best for:** Phonics (CVC words, word families), sight words, vocabulary, sorting activities. Multi-sensory approach aids kinesthetic learners.
- **Subjects:** ELA (phonics, spelling, sight words), vocabulary in any subject
- **Ages:** 4-8. 6-8 words per page for K-2; can increase density for older. Simpler words for younger.
- **Creation path:** html (precise grid, dotted cut lines, writing lines need surgical precision)
- **Example activity:** `[cut-and-paste] Short A CVC word work — write each word, then cut and paste tiles`

### unit-study-packet
- **Slug:** `[unit-study-packet]`
- **Name:** Unit study packet (cross-curricular)
- **Modality:** mixed
- **What it is:** A complete thematic learning bundle spanning 5+ subjects (science, math, social studies, language arts, art) with teacher guide, reading/video lists, supply list, and 20-30+ activity pages. One topic explored through every subject lens.
- **Best for:** Deep thematic exploration, cross-curricular integration, multi-week learning units, Charlotte Mason / eclectic homeschool families.
- **Subjects:** Multidisciplinary (science, math, ELA, social studies, art woven together by theme)
- **Ages:** 4-12. Activity pages within the packet span difficulty levels; teacher guide helps parent select appropriate pages.
- **Creation path:** packet (multi-page via `pages` input). Individual pages within follow normal path-choice rules.
- **Example activity:** `[unit-study-packet] Forest Animals unit study with naturalist poster, copy work, art appreciation cards, nature journal, and counting activities`

### naturalist-identification-poster
- **Slug:** `[naturalist-identification-poster]`
- **Name:** Naturalist identification poster
- **Modality:** visual
- **What it is:** A watercolor-style poster showing 10-20 specimens (animals, plants, shells) with numbered labels and a word bank. Montessori-aligned realistic illustration style.
- **Best for:** Nature study, species identification, vocabulary building, science observation.
- **Subjects:** Science (biology, ecology, nature study)
- **Ages:** 4-10. Younger kids match pictures to word bank; older kids label from memory.
- **Creation path:** image-direct (the whole page is illustration with embedded text)
- **Example activity:** `[naturalist-identification-poster] Seashore animals identification poster with 15 species`

### 3-part-nomenclature-cards
- **Slug:** `[3-part-nomenclature-cards]`
- **Name:** 3-part nomenclature cards (Montessori)
- **Modality:** visual
- **What it is:** Montessori-style matching cards printed 3-up per item: control card (image + label), picture card (image only), label card (label only). The child matches after studying the complete card.
- **Best for:** Vocabulary building, classification, any subject with discrete items to identify and name.
- **Subjects:** Science (specimens), ELA (vocabulary), social studies (landmarks, flags), any subject
- **Ages:** 3-8. Fewer items and larger cards for younger; more items for older.
- **Creation path:** hybrid (generate_image for illustrations, html for grid and labels) or html with kept photos
- **Example activity:** `[3-part-nomenclature-cards] Seashore animals nomenclature cards — seahorse, crab, jellyfish, starfish, lobster, clam`

### art-appreciation-cards
- **Slug:** `[art-appreciation-cards]`
- **Name:** Art appreciation cards
- **Modality:** visual
- **What it is:** Classic artwork reproductions with artist bio panel: painting image, artist name, dates, art movement/style label, and 1-2 sentence bio. For art history integration.
- **Best for:** Art history, cultural literacy, unit study art integration, picture study (Charlotte Mason).
- **Subjects:** Art (art history, appreciation)
- **Ages:** 5-14. Younger kids do picture study (observe and narrate); older kids compare styles and periods.
- **Creation path:** html with search_photos for artwork images
- **Example activity:** `[art-appreciation-cards] Beach-themed art cards — Van Gogh, Cassatt, Hokusai, Munch`

### copy-work-pages
- **Slug:** `[copy-work-pages]`
- **Name:** Copy-work pages
- **Modality:** reading_writing
- **What it is:** Handwriting practice using curated quotes, poems, or passages. Model text printed at top with blank writing lines below (three-line guide or letter boxes per family curriculum).
- **Best for:** Handwriting practice combined with literature exposure, poetry memorization, Charlotte Mason copy work.
- **Subjects:** ELA (handwriting, literature, poetry)
- **Ages:** 5-12. Shorter passages and larger lines for younger; longer passages and smaller lines for older. Print and cursive variants.
- **Creation path:** html (writing lines need precision). Hybrid if adding a themed illustration.
- **Example activity:** `[copy-work-pages] Copy "At the Sea-Side" by Robert Louis Stevenson with three-line guides`

### nature-journal-prompts
- **Slug:** `[nature-journal-prompts]`
- **Name:** Nature journal prompts
- **Modality:** visual
- **What it is:** Guided observation and recording templates for outdoor field work. Large drawing box, observation prompts, labeling section. Combines science observation with art and writing.
- **Best for:** Nature study, outdoor learning, science observation, Charlotte Mason nature notebooks.
- **Subjects:** Science (nature study, observation), art (nature drawing)
- **Ages:** 4-12. Simpler prompts and larger drawing box for younger; more detailed observation questions for older.
- **Creation path:** html (precise layout, blank lines, drawing box borders)
- **Example activity:** `[nature-journal-prompts] Tide pool observation journal page with drawing box and guided questions`

### visual-schedule-cards
- **Slug:** `[visual-schedule-cards]`
- **Name:** Visual schedule cards
- **Modality:** visual
- **What it is:** A grid of printable cards (3×4, 12 per page) with watercolor illustrations and activity labels. The child uses them to build a visual daily schedule — on a ring, Velcro board, or clothesline. Learning infrastructure, not learning materials.
- **Best for:** Daily routine building, homeschool day scheduling, independence skills, executive function, transition support (especially neurodivergent children), time concepts, weather/calendar routines.
- **Subjects:** Life skills (daily routines, self-care, chores), all academic subjects (as schedulable cards), social-emotional learning
- **Ages:** 3-8. Pre-readers rely on illustrations alone; early readers use both image and label.
- **Creation path:** image-direct (full 3×4 grid generated as one image) or hybrid (individual card illustrations embedded in HTML grid). Multi-page sets use the packet recipe.
- **Example activity:** `[visual-schedule-cards] Personalized daily rhythm cards covering morning routine, academic subjects (Charlotte Mason vocabulary), chores, and afternoon activities`

### lifecycle-diagram
- **Slug:** `[lifecycle-diagram]`
- **Name:** Lifecycle diagram + cut-and-paste
- **Modality:** visual, kinesthetic
- **What it is:** A circular lifecycle illustration with labeled stages and arrows showing progression, paired with a blank template + cutout images for the child to arrange in correct order.
- **Best for:** Teaching biological lifecycles, sequential processes, cause-and-effect chains.
- **Subjects:** Science (biology, life science)
- **Ages:** 5-10. Simpler diagrams with fewer stages for younger; more detailed with additional info for older.
- **Creation path:** hybrid (generate_image for circular diagram, html for cut-and-paste template)
- **Example activity:** `[lifecycle-diagram] Lifecycle of an earthworm — poster + cut-and-paste ordering activity`

### reading-comprehension-story
- **Slug:** `[reading-comprehension-story]`
- **Name:** Reading comprehension with themed story
- **Modality:** reading_writing
- **What it is:** A short fiction story (8-12 sentences) themed to the unit topic, followed by a drawing challenge and comprehension questions.
- **Best for:** Reading practice combined with unit study reinforcement, creative response, comprehension assessment.
- **Subjects:** ELA (reading comprehension), integrated with any unit study topic
- **Ages:** 5-10. Shorter stories with simpler questions for younger; longer with inference questions for older.
- **Creation path:** html (text precision) or hybrid (add themed illustration header)
- **Example activity:** `[reading-comprehension-story] "Wiggly the Worm" short story with drawing challenge and 5 comprehension questions`

### taxonomy-card
- **Slug:** `[taxonomy-card]`
- **Name:** Taxonomy classification card
- **Modality:** reading_writing
- **What it is:** A labeled taxonomy hierarchy (Kingdom → Phylum → Class → Order → Family → Genus → Species) for a specific organism, with a fill-in-blank version.
- **Best for:** Teaching scientific classification, vocabulary building, introducing formal science categories.
- **Subjects:** Science (biology, classification)
- **Ages:** 7-12. Fewer levels with simpler vocabulary for younger; full 7-level hierarchy for older.
- **Creation path:** html (text precision for fill-in fields)
- **Example activity:** `[taxonomy-card] Taxonomic classification of an earthworm — completed poster + fill-in-the-blank`

### outdoor-observation
- **Slug:** `[outdoor-observation]`
- **Name:** Outdoor observation report
- **Modality:** kinesthetic
- **What it is:** A guided field study template with date, location, drawing box, measurement fields, observation prompts, and comparison section.
- **Best for:** Nature study, hands-on science, field work, measurement practice.
- **Subjects:** Science (nature study, scientific inquiry), math (measurement)
- **Ages:** 5-12. Simpler prompts and larger drawing box for younger; more detailed observation questions for older.
- **Creation path:** html (structured fields and writing lines)
- **Example activity:** `[outdoor-observation] Worm observation report — find, measure, draw, and compare earthworms`

### morning-basket
- **Slug:** `[morning-basket]`
- **Name:** Morning basket bundle (Pre-K unit study inclusion)
- **Modality:** mixed
- **What it is:** A collection of 8-18 Pre-K/K activities themed to a unit study topic, allowing youngest learners to participate alongside older siblings.
- **Best for:** Multi-age homeschool families doing unit studies, Pre-K inclusion, fine motor practice, early literacy/numeracy.
- **Subjects:** Cross-curricular (letter tracing, counting, sorting, mazes, puzzles — all themed)
- **Ages:** 3-6. Simple, chunky, high contrast for small hands.
- **Creation path:** packet (multi-page). Individual pages: letter tracing = html, mazes = image-direct, sorting = hybrid.
- **Example activity:** `[morning-basket] Worm-themed Pre-K morning basket: letter W tracing, garden sorting, counting clip cards, maze`

### counting-clip-cards
- **Slug:** `[counting-clip-cards]`
- **Name:** Counting clip cards
- **Modality:** kinesthetic
- **What it is:** Cards showing N themed objects with number options along one edge; child clips a clothespin to the correct number. Laminate-and-reuse.
- **Best for:** Counting practice, number recognition, one-to-one correspondence, kinesthetic math.
- **Subjects:** Math (counting, early number)
- **Ages:** 3-6. Numbers 1-5 for youngest; 1-20 for older Pre-K/K.
- **Creation path:** hybrid (generate_image for themed objects, html for number options) or image-direct
- **Example activity:** `[counting-clip-cards] How many worms? Clip cards for numbers 1-10`

### notes-and-practice-bundle
- **Slug:** `[notes-and-practice-bundle]`
- **Name:** Notes-and-practice bundle
- **Modality:** reading_writing
- **What it is:** Two-page format: page 1 is guided notes (Cornell-style two-column with terms and fill-in-the-blank explanations), page 2 is practice (drill problems, matching, or fill-in-the-blank). Teach then practice in one printable.
- **Best for:** Any subject where concept introduction precedes drill — new math operations, grammar rules, science vocabulary, history facts.
- **Subjects:** Math, ELA, science, social studies — any content-heavy subject
- **Ages:** 8-14. Simpler terms and fewer blanks for younger; denser notes and harder practice for older.
- **Creation path:** html (uses packet recipe for multi-page; both pages need text precision)
- **Example activity:** `[notes-and-practice-bundle] Two-step equations guided notes with practice maze`

### weekly-lesson-planner
- **Slug:** `[weekly-lesson-planner]`
- **Name:** Weekly lesson planner (week-at-a-glance)
- **Modality:** reading_writing
- **What it is:** A landscape printable showing the entire week's instruction in one view: 5 color-coded day columns × skill strand rows. Each cell has an activity name and brief description. Header shows the unit topic/anchor text and focus skills. Footer has a consolidated materials list for the whole week.
- **Best for:** Weekly planning, daily orchestration, eliminating "what do I do today?" friction. The parent tapes this to the fridge or clips it into a planner binder.
- **Subjects:** Multidisciplinary — maps all subjects the child is working on across the week
- **Ages:** All ages. Content adapts to the child's working subjects; layout stays the same.
- **Creation path:** html (landscape, precise grid, color-coded columns, dense text needs surgical precision)
- **Example activity:** `[weekly-lesson-planner] Week-at-a-glance for "The Mixed-Up Chameleon" — phonics, spelling, reading, writing, grammar, cross-curricular centers across 5 days`

### center-activity-card
- **Slug:** `[center-activity-card]`
- **Name:** Cross-curricular center activity card
- **Modality:** mixed
- **What it is:** Individual activity cards for learning centers, themed around the week's anchor topic. Each card has a colored subject header, activity title, instruction paragraph, time estimate, and a materials list in a sidebar box. Story/topic connection line ties it back to the anchor.
- **Best for:** Cross-curricular extension of a reading selection or unit study theme. Science, social studies, drama, art, literacy — all powered by one topic.
- **Subjects:** Multidisciplinary — each card targets a different subject but shares the same theme
- **Ages:** 4-12. Simpler activities and fewer steps for younger; more complex with research or writing components for older.
- **Creation path:** hybrid (generate_image for themed illustration, html for structured text + materials list)
- **Example activity:** `[center-activity-card] Science center: Build a chameleon habitat diorama (shoe box, real leaves, construction paper) — camouflage + adaptation`

### daily-instruction-guide
- **Slug:** `[daily-instruction-guide]`
- **Name:** Daily instruction guide (parent-facing)
- **Modality:** reading_writing
- **What it is:** One page per day with ordered skill blocks, 2-3 teaching steps per block in parent-friendly language, differentiation notes (easier/harder), materials callout, and time estimates. Written for homeschool parents, not classroom teachers.
- **Best for:** Parents who want step-by-step daily guidance beyond just knowing WHAT to teach — they want to know HOW and in what order.
- **Subjects:** Multidisciplinary — covers all subjects scheduled for that day
- **Ages:** All ages. Content adapts; format stays the same.
- **Creation path:** html (text precision, structured skill blocks, differentiation sidebar)
- **Example activity:** `[daily-instruction-guide] Day 1 instruction guide: read-aloud "The Mixed-Up Chameleon" + introduce phonograms -id/-ide + spelling pretest + Writer's Craft intro`

### story-assessment
- **Slug:** `[story-assessment]`
- **Name:** End-of-selection assessment (three-part)
- **Modality:** reading_writing
- **What it is:** A standardized three-section test per story/unit: Section 1 vocabulary (6 multiple-choice, word in new sentence context), Section 2 comprehension (12 multiple-choice, story-based questions), Section 3 written response (2 open prompts with lined space). Same format every time so the child knows the structure.
- **Best for:** End-of-unit or end-of-week assessment. Measures whether the child absorbed meaning from reading, not from flash-card memorization.
- **Subjects:** ELA (reading comprehension, vocabulary, writing)
- **Ages:** 6-12. Fewer questions and simpler vocabulary for younger; more questions and inference-level for older.
- **Creation path:** html (precise MC formatting, answer bubbles, lined response areas)
- **Example activity:** `[story-assessment] End-of-selection test for "The Mixed-Up Chameleon" — 6 vocab + 12 comprehension + 2 writing prompts`

### school-home-connection
- **Slug:** `[school-home-connection]`
- **Name:** School-home connection callout
- **Modality:** mixed
- **What it is:** A small boxed section (can be embedded on any worksheet) with a house icon, activity title, and 2-3 sentences describing a playful at-home activity that extends the page's skill. Uses only things already in the home. Not homework — a bonding suggestion.
- **Best for:** Embedding on practice worksheets to give parents a concrete way to extend learning into daily life.
- **Subjects:** Any subject — the connection activity is always real-world / play-based
- **Ages:** All ages. Adapts activity complexity to the child's level.
- **Creation path:** html (embeddable component — added to other worksheets, not standalone)
- **Example activity:** `[school-home-connection] "Word Hunt": Find 5 things in the kitchen that start with the same sound as this week's spelling words`

### grammar-reference-practice
- **Slug:** `[grammar-reference-practice]`
- **Name:** Grammar reference chart + varied exercises
- **Modality:** reading_writing, visual
- **What it is:** A self-contained grammar lesson page. Top section: a bordered reference chart (accent color) showing the grammar FORM (labeled example sentences: NOUN + IS + NOUN) with a MEANING sidebar (rules, exceptions, notes). Bottom section: 2-3 varied exercises practicing the same point — transformation, word-bank completion, contextual completion, or oral production prompts. Model answer on first item of each exercise. One grammar point per page.
- **Best for:** Explicit grammar instruction where the student needs both the reference AND the practice in one place. The chart is self-service — the student can look back at it when stuck, without needing parent re-teaching.
- **Subjects:** ELA (grammar, sentence structure, parts of speech, verb tenses, articles)
- **Ages:** 8-14. Simpler sentence patterns and fewer exercises for younger; more complex structures and communicative exercises for older.
- **Creation path:** html (precise text layout, bordered reference chart, exercise numbering, model-answer italics, word-bank boxes)
- **Example activity:** `[grammar-reference-practice] Singular and Plural Nouns with BE — reference chart (NOUN + IS/ARE + NOUN) + transformation exercise + word-bank exercise + oral prompts`

### reading-comprehension-unit
- **Slug:** `[reading-comprehension-unit]`
- **Name:** Reading comprehension unit (spiral)
- **Modality:** reading_writing, visual
- **What it is:** A multi-page reading comprehension unit with 4 sections: (1) "Let's Read" — an engaging reading passage with photographs/illustrations, vocabulary sidebars, and embedded "Do This" prompts; (2) "Focus on Reading Skills" — explicit skill instruction (sequence, facts/details, main idea, cause/effect) with graphic organizers; (3) "Apply Your Skills" — a second passage on a related topic where the student applies the same skill independently; (4) "Build Your Vocabulary" — vocabulary review from both passages with context exercises and graphic organizers.
- **Best for:** Reading comprehension skill building where the goal is both content engagement AND named reading strategy instruction. The spiral structure means skills compound across units.
- **Subjects:** ELA (reading comprehension), but the passages should be cross-curricular content (science, history, nature, technology)
- **Ages:** 6-12. Simpler passages and fewer questions for younger; more complex texts and inference-level questions for older.
- **Creation path:** hybrid (generate_image for passage illustrations, html for exercises, graphic organizers, vocabulary sidebars)
- **Example activity:** `[reading-comprehension-unit] Life Cycles unit — butterfly passage (sequence skill) + rabbit transfer passage + vocabulary consolidation (monarch, larva, chrysalis, molting, burrow, protect)`
