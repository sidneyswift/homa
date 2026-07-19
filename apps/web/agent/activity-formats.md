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
- **What it is:** A 2x2 or 2x3 grid of cards with dashed cut borders. Each card has a term, image, or problem on one side.
- **Best for:** Drill and recall: sight words, math facts, vocabulary, matching games.
- **Subjects:** Any subject with discrete facts to memorize
- **Ages:** 3-14. Simpler content and larger cards for younger; denser content for older.
- **Creation path:** html (precise grid and cut lines)
- **Example activity:** `[flash-cards] Sight word flash cards for Fry's first 20 words`

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
