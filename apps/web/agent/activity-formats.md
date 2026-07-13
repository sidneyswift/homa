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
- **Creation path:** html (always — text precision and surgical revision are the point)
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
- **Best for:** Drill and recall — sight words, math facts, vocabulary, matching games.
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
- **Best for:** Reference material meant to be displayed — alphabet charts, multiplication tables, science diagrams.
- **Subjects:** Any subject needing a visual reference
- **Ages:** 3-14. Simpler with fewer items for younger; denser information for older.
- **Creation path:** image-direct or hybrid
- **Example activity:** `[poster] Solar system poster with planet names and relative sizes`

### themed-worksheet
- **Slug:** `[themed-worksheet]`
- **Name:** Themed worksheet
- **What it is:** Exercises paired with themed illustrations. Precise academic content with engaging art.
- **Best for:** Any drill or practice that benefits from visual engagement and theming.
- **Subjects:** Math, ELA, science — any subject
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
- **Best for:** Transforming rote drill into a game — math facts, phonics, vocabulary, sight words.
- **Subjects:** Math, ELA, vocabulary — any fact-based drill
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
- **Example activity:** `[cut-and-paste] Short A CVC word work — write each word, then cut and paste tiles`

### notes-and-practice-bundle
- **Slug:** `[notes-and-practice-bundle]`
- **Name:** Notes-and-practice bundle
- **What it is:** Two-page format: page 1 is guided notes (Cornell-style two-column with terms and fill-in-the-blank explanations), page 2 is practice (drill problems, matching, or fill-in-the-blank). Teach then practice in one printable.
- **Best for:** Any subject where concept introduction precedes drill — new math operations, grammar rules, science vocabulary, history facts.
- **Subjects:** Math, ELA, science, social studies — any content-heavy subject
- **Ages:** 8-14. Simpler terms and fewer blanks for younger; denser notes and harder practice for older.
- **Creation path:** html (uses packet recipe for multi-page; both pages need text precision)
- **Example activity:** `[notes-and-practice-bundle] Two-step equations guided notes with practice maze`
