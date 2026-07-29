# Feature specs with placement rulings

Placement follows AGENTS.md (fat skills over narrow tools; models judge, code
verifies; Postgres for durable truth; Blob/R2 for artifacts). Each feature names
its layer split explicitly. Sizes: S/M/L/XL.

> COUNCIL REVIEW (2026-07-28): read [06-council.md](06-council.md) alongside
> this file; it corrects several specs with code receipts and re-ranks the
> build order. Load-bearing corrections: F6 leg 1 (print-parity QC already
> shipped 2026-07-19; the real mechanisms are the 4-page review cap, the
> lenient rubric, null-review-delivers-as-passed, and the 600-char
> requestSummary), F5 (finalize deletes prior versions' bytes, so the rail
> needs a retention decision first), F10 (conversation_offer_fulfillments
> cannot hold call commitments; new call_commitments table, verifier-first),
> F2 (plan-edits does not suffice; source links belong on the activity shape
> in child_plans jsonb), F1 (save_family_asset is promote-by-URL from
> chat_attachments, retrieval must be semantic, eval bank required before the
> migration), F4 (no session state; derive theme pressure from material rows).
> The council also demoted F1 from arc centerpiece to a thin evidence-gated
> slice behind the bug cluster.

## F1. Family library: the third plane (XL, the arc centerpiece)

The fleet corpus (gh#328) is plane one and two (scans train a reader, renders
train the writer). F1 is the family plane: tenant-scoped, retrieval-oriented,
product-facing. It is NOT the corpus: different bucket-or-store, different
tenancy, different purpose; a family item may later be nominated into the corpus
only through the D4 de-identification gate, never by default.

- **Schema (deterministic):** `family_assets` table: id, family_id, kind
  (book | worksheet | curriculum | curriculum_unit | card_set | link | file |
  photo), title, authors, language, subjects[], age_band, entities[] (free-tag
  strings from a model, each carrying a code-verified provenance quote),
  topic_ids[] (validated against the taxonomy), taste_note, source (photo | pdf |
  link | dictation | call), blob_url (original, immutable), parent_asset_id (for
  curriculum decomposition), owned (owned | referenced), created_at. RLS on,
  familyId server-side only.
- **Tools (narrow):** `save_family_asset` (validate + write + original to Blob),
  `find_family_assets` (scoped retrieval: text + subject + entity + age filters),
  both `defineBoundedTool`. No god "ingest" tool.
- **Skill (fat):** `family-librarian`: when a drop or mention arrives, decide
  what it is, extract facts/entities/taste per the meeting's librarian spec,
  decompose curricula into child assets (whole, weeks, lessons, book lists),
  handle bulk ("here's my shelf") by batching honestly, and always confirm what
  was saved. Existing multimodal captioning already reads covers (proven 07-27).
- **Retrieval integration:** materials-studio, planner, and research-brief skills
  get a "check the family library first" step; recall covers assets.
- **UI (M, can trail):** a library surface in /app: grid, filters, item page
  with original preview + tags + "used in" links.
- **Bulk lane (later slice):** the six-years-of-files computer upload is a job
  (agent-jobs pattern) with a progress surface, not a chat conversation.

Explicitly out: any training use of family assets (that is gh#328 D4 territory).

## F2. Curriculum to planner (L)

- **Schema:** curriculum_unit assets (from F1) + `plan_activity_schedule`
  (exists, #255 substrate) gain a source link: planner cells carry
  (family_asset_id, week_index, topic). Additive columns only.
- **Skill:** extend `planner` (or a `curriculum-scheduler` reference within it):
  read the decomposed curriculum, propose week-by-week placement, require
  approval, write through plan-edits (never direct row writes; check-off
  corruption scar).
- **Tool:** none new if plan-edits suffices; smallest possible
  `attach_schedule_source` otherwise.
- **Dependency:** F1 decomposition; #258/#259 unified surface for display.

## F3. The material ladder and answer keys (M)

- **Skill (materials-studio):** encode the ladder: worksheet (1 page,
  supplement), lesson (hook + explainer + worksheets + key), unit study
  (multi-day packet + parent guide), four-week curriculum (cap, F9). Clarify
  which rung the parent asked for when ambiguous (one question max). Answer keys
  default-on for gradeable content, always a separate page (07-28 upside-down
  key incident). Flashcard/laminate format: cut-line cards sized for lamination
  when the parent's intent is cards (Yoto habit, D5 demand signal).
- **Schema:** none; `materials.kind` already covers rungs (packet = unit study).
- **Code:** the PDF assembler enforces key-on-own-page so a model lapse cannot
  print answers on the student page (code verifies).

## F4. Interest theming with a dial (M)

- **Skill:** theming levels (none | decorative | immersive) with defaults by age
  and material type; canon-fidelity rule by age (9-year-olds get accurate
  characters or none; the 07-28 "Ps5 astrobot" correction is the fixture);
  no-theme zones (real literature, assessments); saturation governance: rotate
  interests, and on blanket generations create unthemed + one offer (US-19).
- **State:** interests already live in `family_memories`/child profile; add
  last-used-theme tracking to session state or child context, not a new table.
- **Eval:** behavioral eval with the Walker fixture children at 3 ages.

## F5. Version history rail (M)

- **UI:** binder card + material page expose the `revises` chain: thumbnails,
  timestamps, "make this one current". Data already exists end to end.
- **Tool:** `find_materials` already walks lineage for revisions (#241 fix
  pending); chat "go back to the previous version" = new revision pointing at an
  older node (append-only, never mutate history).
- This single feature deletes the "I have to start screenshotting" behavior.

## F6. Print-parity layout QC and the layout program (L, program not patch)

The failure class B2 has three legs; each gets its own fix:

1. **Measure the artifact she holds:** QC runs on rasterized PDF pages at print
   scale (the materials-review false-pass scar: screen render vs print render).
   Deterministic checks (code): page fill ratio bounds, overflow/cut-off
   detection, min element sizes by age band (trace-line height, cut-piece area,
   coloring-region area), answer-key separation. Model review stays for taste;
   code owns geometry (models judge, code verifies).
2. **Fix-loop honesty:** a revision may only claim success against the specific
   complaints it addressed; the checker replays the parent's last N layout
   complaints as assertions. "It passed" while page 3 is still half empty is a
   tool-honesty violation, not a quality gap.
3. **Layout substrate bet (the transcript's "more image generation" instinct):**
   evaluate template-first HTML (a bank of parameterized, pre-QC'd page layouts
   the model fills, instead of freeform HTML every time) vs image-mode-first
   with HTML reserved for text-heavy pages. The handwriting-sheet failure
   (letters must fill the line: geometry, not prose) is exactly what a template
   with slots guarantees and freeform HTML cannot. Prototype both on the
   admin bench (materials_studio_runs) against the 07-23/28 fixtures before
   choosing. Reference layouts from F1 (US-12) feed the template bank.

## F7. Approved-by-morning delivery (L, mostly composition)

The moonshot moment: tomorrow's cell has its material tonight, approved, printed
in one tap. Composition of: planner cells with topics (F2), materials attached to
cells (schema: material_id on schedule rows or a join table), an evening
generate + approve nudge (schedules exist; agent_schedules), and the morning
brief linking the printable. No new primitives. Depends on F2, F3, #259.

## F8. Lesson recording management (M)

- **Tool:** `list_lesson_recordings` (child, date, duration, status) +
  `reassign_lesson_recording` (atomic move of recording + review + evidence,
  tenant-scoped, idempotent). The 07-27 failure is the fixture.
- **UI:** child selector on the recorder screen shows which child is armed
  (mis-selection was the root cause; the transcript flags it will recur with
  multiples), and recordings list allows reassign.
- **Skill note:** journaling/lesson-listen guidance mentions the tool so chat
  can fix attribution conversationally.

## F9. The four-week cap (S, policy)

One sentence in materials/curriculum skills plus refusal copy. Requires a founder
ruling first (it is a product-shaping constraint from a co-founder conversation,
not yet ratified; the reconciliation index is the home). Recommended: ratify.
Marketing corollary: the cap is a feature ("we go where your kid actually is"),
usable on the paywall and in ASO copy.

## F10. In-call promise fulfillment (M)

Post-call pipeline (call-ended webhook, #278's sync moment): extract commitments
from the transcript (model proposes: what, for whom, channel, deadline; code
verifies each against a verbatim quote), write to the existing
`conversation_offer_fulfillments` machinery (#198's detector generalized beyond
morning-brief offers), execute via the existing agent-jobs path, and report
delivery or honest failure to the parent on their preferred channel. The 07-22
partial-fulfillment (wrong content for 2 of 3 kids) also argues the fulfillment
row must carry the promised content spec, not just "send worksheets".

## F11. Multimodal input robustness (M)

- Long-input truncation fix (FB-1) is the bug half.
- The feature half: when a parent sends a screenshot or screen recording OF TEXT,
  transcribe it (OCR / frame OCR) rather than summarizing it; when an image is a
  reference layout, persist it (F1) and keep it addressable for the session
  (US-12; the 07-28 "it isn't loading on my end" failure).
