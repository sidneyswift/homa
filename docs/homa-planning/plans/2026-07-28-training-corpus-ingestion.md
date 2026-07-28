# Training-corpus ingestion: keep the data, not just the lessons

Date: 2026-07-28. Tracking: gh#328. Status: proposed, awaiting founder rulings D1-D10.

Effort: v0 is roughly 3-5 agent-days plus one founder hour (accounts, rig order). v1 is roughly 2-3 agent-weeks spread over a month alongside product work. Risk: low for v0 (append-only additions, no product-path changes); medium for v1 (new worker, new schema). Migrations: one additive `corpus` schema, one additive change to `materials_studio_runs` feedback (D5).

## 0. TLDR

The current ingestion engine makes Homa the agent smarter and throws the data away. Every drop graduates into recipes, taxonomy rows, taste signals, and knowledge-bank entries, but the durable artifact per drop is a single un-OCRed PDF on the public Vercel Blob store. The most recent ingest proves the point: `ref-2026-07-21-one-potato-two-potato` produced a superb analysis of a 165-chant anthology and preserved zero of the 165 chants' text. Analysis is cheap to regenerate; verified, well-organized data is the asset. That is precisely why Anthropic bought and scanned millions of print books: clean, curated, professionally edited data, which is what a trunkload of school books is.

This plan adds a corpus layer beside (never inside) the Cosmo product pipeline: three storage planes, four capture lanes, a model-proposes-code-verifies agent pipeline, and a dataset export layer that keeps five training options open without betting on any of them today. Two reframes drive everything:

1. "Hundreds of thousands of items" means pages, not books. 300k pages is roughly 1,000 books, 12-16 operator-days on a ~$1,650 rig. The physical scanning is a two-week sprint, not a three-month grind; the three-month clock belongs to the unattended processing queue and the web lane.
2. The highest-value training corpus is not in the trunk. It is already being manufactured in Postgres and discarded. Every materials-studio render writes the complete agent-authored HTML source (`apps/web/lib/materials/artifact-store.ts:158`, inserted at 280-294), the PDF, and rasters at `RASTER_SCALE = 2.5` (`rasterize-pdf.ts:36`), with a `revises` revision chain and founder verdicts. That is perfect, zero-OCR-error (source, page image, brief, verdict, lineage) training data for the exact model Homa would want first: one that writes worksheets. Today none of it is archived, and `20260718180000_materials_studio_feedback.sql` overwrites verdict history on purpose, deleting a DPO pair with every overwrite.

The slogan the council converged on: **the scans train a reader, the renders train the writer, and Homa sells the writer.**

## 1. How this was derived

A 12-agent workflow ran 2026-07-28: five web-research agents (frontier-lab book pipelines including the Anthropic scanning operation disclosed in Bartz v. Anthropic; the 2026 post-training landscape including Thinking Machines' Tinker and Karpathy's nanochat; scanning hardware and document AI; multimodal and image-generation training data; education metadata standards), one codebase recon agent, a five-persona expert council (pretraining data engineer, post-training researcher, multimodal researcher, digitization ops lead, pragmatic CTO), and an adjudicator. Full reports are session artifacts; the load-bearing repo claims (html column, RASTER_SCALE, feedback migration wording, 50 recipes, 59 activity-format slugs, 63 open gaps, 1,721 topics) were re-verified directly against the repo before this doc was written.

Research anchors worth keeping: FineWeb won by returning to raw WARC instead of cleaning inherited text; AI2 re-ran 7.9M PDFs when olmOCR shipped because they had kept the PDFs; FineWeb-Edu showed educational value is the single strongest quality signal for pretraining data; DALL-E 3's captioner was explicitly trained to transcribe text visible in images, so captions that omit literal worksheet text train hallucination; olmOCR's verifier is binary unit tests over extractions, not vibes. All of these say the same thing: preserve raw, version derivations, verify claims with code.

## 2. Founder decisions (react to these first)

Recommendations marked (rec). Every decision has a one-line reply that settles it.

- **D1 Destruction.** Destroy books after scanning (rec: yes, except keepers routed to lane B), or keep everything. Destructive is 5-20x cheaper per page and produces better images; the paper is gone forever.
- **D2 Budget ceiling.** The design assumes ~$1,650 capex, under $1,200 one-time model spend for the full corpus pass, and ~$80/month steady state. The main lever above that is lossless masters (~$50/month at 300k pages) vs high-quality JPEG (~$5/month). Rec: approve as stated; lossless only for destructively scanned paper.
- **D3 Operator.** A part-time operator at 60-90 books/day clears the trunkload in about two weeks. Founder-operated scanning is the version that stalls at book 40. Rec: hire the operator.
- **D4 Family renders.** Are real family-generated materials in the training archive, or only sandbox and founder-bench renders? Family renders are the richest style data and also the surface where child names and interests would enter shards. Rec: v0 archives sandbox and founder renders only; family renders enter only after the de-identification step (section 8.4) exists, and even then `use_scope` starts as `product_reference`.
- **D5 Feedback history.** Stop overwriting `materials_studio_runs` feedback and keep every verdict (additive migration, small admin change). Every founder critique becomes a preference pair. Rec: yes, this is the cheapest training data Homa will ever get.
- **D6 First training bet.** After v1: worksheet-style image LoRA (T1: cheap, visible, weeks away, ~$9-26 of compute) or the HTML-emitter SFT+DPO (T2/T3: the product bet, needs the render archive to accumulate first). Rec: T1 first purely to prove the export loop end to end, T2 as soon as ~1,000 approved render pairs exist.
- **D7 Web lane timing.** Build the scraping lane (TpT, OER Commons, Gutenberg, Internet Archive schoolbooks) this quarter, or let the trunkload plus renders carry v1? Rec: defer to v2; raw-HTML retention discipline (section 4, lane D rules) is designed now so nothing scraped ad hoc is lost.
- **D8 Corpus tool for eve.** Does eve ever get `find_corpus_exemplars` (metadata only, never bytes), or does the corpus stay admin-only? Rec: admin-only until the nomination queue (section 9) proves clean for a month.
- **D9 Publishing.** Ever publish a corpus slice (dataset card, labeled worksheet-region schema, an eval set)? Buys credibility and hiring signal; makes the acquisition posture legible. Rec: defer, revisit at v2.
- **D10 Retention promise.** A family deletion request or rights retraction must propagate through masters, sidecars, and every built shard. The tombstone mechanism (section 8.3) is real engineering that only exists if the promise is made. Rec: make the promise for family-derived data unconditionally; for scanned commercial material, tombstone on demand.

## 3. Architecture: three planes, one law each

- **L0 raw.** Immutable, content-addressed, private, never deleted, never re-encoded, never "cleaned in place". Page images from scanning, source HTML from the web lane, render sources from the product.
- **L1 derived.** Regenerable from L0: OCR text, layout geometry, structure, tags, quality scores, dedup signatures. The model name and version are part of the storage path, so a re-run with a better model is a new sibling, never an overwrite.
- **L2 builds.** Dataset artifacts (WebDataset tar shards, parquet), a pure function of (L0, L1, build config), deletable and rebuildable bit for bit. Filtering happens at build time, never by deleting upstream.

The rule that generates all three: any transformation you cannot undo must not be the only thing you keep. Homa has already lost this option for ~183 of 190 references (local originals on one unbacked-up laptop; 14 TpT links permanently lost because capture waited).

## 4. Capture standard

Hardware (~$1,650): 17-inch stack cutter (~$350), Ricoh fi-8170 duplex ADF (~$749, 70 ppm, ultrasonic double-feed detection), USB barcode gun (~$25), label printer (~$120), copy stand with gridded mat (~$60), 2x 8TB external drives (~$400, they are the backup story in section 8.2). Throughput: 60-90 books/day/operator, $1-3 marginal cost per book.

Scanner settings, non-negotiable: 400 ppi, 24-bit RGB, duplex, double-feed detection on, auto-crop off, auto-rotate off, blank-page removal off, scanner-side OCR off, no despeckle, no contrast adjustment. RGB even for black-text pages (answer-key ink color and highlighting are semantic). Blank-page removal stays off because a blank verso is information and because removing pages breaks the page-count assertion, which is the only automatic double-feed alarm.

**Intake ritual, before the blade** (~30 seconds, free now, unrecoverable later): scan the ISBN; hit Open Library and Google Books for title, publisher, page count, subject headings, identifier block; photograph front and back covers on the copy stand (series, grade badge, and edition live on covers and in no free API); answer one routing question ("does this book need to exist afterward?"); print a batch slip with a Code-128 barcode of the freshly minted `item_id` and scan it as physical page 0. Items with no ISBN (photocopied worksheets, spiral-bound co-op curricula, loose card sets) get identity from the batch slip alone plus the cover photo; the librarian agent proposes bibliographic identity later with confidence capped at 0.6.

Four lanes, routed by a sticker at intake:

- **Lane A, destructive ADF** (default): cut the binding, feed the stack. Cut paper goes into a labeled quarantine bin and is not recycled until the batch passes the deterministic gates.
- **Lane B, non-destructive** (keepers, borrowed, signed copies): overhead V-cradle scanner (CZUR ET25-class), slower, only for books ruled keep at intake.
- **Lane C, gang capture** (flash cards, manipulatives, game pieces): 8-12 per shot on the gridded mat, deterministic grid segmentation into per-card images, roughly 1,000 cards/hour instead of a day of ADF jams.
- **Lane D, born-digital** (PDFs, ePubs, web pages, TpT files): never printed, never re-scanned, never OCRed when a text layer exists; the native source is stored and the text layer is free perfect ground truth. Web captures store raw HTML plus assets before any extraction.
- **Lane E, audio** (added by the completeness pass): lesson-listen recordings (live fleet-wide since PR #70) and the Telnyx phone lines already produce speech with paired transcripts and outcomes. Archive raw audio plus transcript plus outcome into the same plane structure. This is the cheapest STT and voice-quality training data Homa will ever own, and today it is not being kept for that purpose.

PDF-only capture is rejected on every lane. Every downstream use is page-shaped: VLM pairs, region crops, dedup, answer-key pairing, per-page status, per-page takedown. A PDF is a human-convenience derivative built at L2 when needed.

## 5. Storage

Private Cloudflare R2 bucket `homa-corpus`, versioning on, dedicated write-once credentials, separate from every product credential. R2 because shard rebuilds re-read the master plane repeatedly (zero egress fees) and because the S3 API is what rclone, img2dataset, and WebDataset tooling speak. Vercel Blob is rejected for the corpus: no S3 API, billed egress, and the pinned store `pkvvudjdhxk33dig` is public, which means today's `inspo/` originals are URL-addressable by anyone with the link. That is an exposure defect independent of any legal posture; v0 moves them.

```
masters/<sha256[0:2]>/<sha256>.jxl        L0 lossless JPEG XL, 400 ppi, immutable
items/<item_id>/manifest.json             page order, covers, capture provenance
raw/<item_id>/source.html + assets/       web lane, raw before extraction
renders/<material_id>/{source.html,render.json,pdf,p0000.jpg}
audio/<item_id>/{raw.wav,transcript.json,outcome.json}
work/<item_id>/p00000.jpg                 L1 300-dpi q90 deskewed, OCR input
vlm/<item_id>/p00000.jpg                  L1 1536px q88, what VLMs consume
ocr/<model>@<version>/<item_id>/p00000.json
attrs/<tagger>@<version>/<item_id>.jsonl  Dolma-style sidecar attributes
exports/corpus_pages_<date>.parquet       nightly, the DuckDB query plane
shards/v<N>/<split>-{000000..}.tar        L2 ~1GB WebDataset shards, disposable
tombstones/tombstones.jsonl               append-only exclusion list, read by every build
```

Master fidelity ruling: lossless JPEG XL masters only for destructively scanned paper, because the pixels are the only survivor of the book. Everything reproducible (born-digital, web, product renders, lane-B books we still own) stores its native source and needs no lossless raster. At 300k destructively scanned pages: ~3.3TB, about $50/month; derived planes add ~$25. FADGI requires lossless, not uncompressed; uncompressed TIFF costs 8x and buys nothing.

Corpus bytes never enter git, never enter `.cosmo/` (that tree is traced into the deployed `/admin/studio` function via `outputFileTracingIncludes`), and never enter a product image path.

## 6. Metadata schema

Operational index in a new `corpus` schema in the existing Supabase: service-role only, deny-all RLS posture, never joinable to family tables, with a CI guard (modeled on `check:fleet-skills-dormant`) asserting no `apps/web` code outside the admin bench queries `corpus.*`. Same database so it can join `public.materials` for the render lane; separate schema so the tenancy surface does not grow. Heavy geometry stays in R2 JSON, not Postgres: a million page rows is trivial, fifty million region rows is an operational burden a three-person team does not need. The nightly parquet export is what training scripts and analytics read (DuckDB over R2).

`corpus.item`: `item_id`, `source_kind` (book_scan | web | slack_drop | product_render | flash_card_set | audio), `acquisition` (where it came from, batch id), `destroyed` bool, `isbn13`, `oclc`, `lccn`, `openlibrary_key`, `identity_source` enum (isbn_api | cover_read | operator | model_guess), `title`, `authors[]`, `publisher`, `edition`, `page_count_declared`, `page_count_scanned`, LRMI fields kept verbatim (`learning_resource_type[]`, `educational_level[]`, `typical_age_range`, `educational_use`, `is_based_on`), `teaches[]` holding CASE GUID URIs beside the human-readable standard code, `homeschool_approach` (eight-family enum: charlotte_mason, classical, montessori, waldorf, unit_study, traditional, unschooling, eclectic) with `faith_posture` as a separate axis (secular | neutral | faith_based), `readability_fk` (Flesch-Kincaid only; Lexile and ATOS are licensed measures, store null rather than fake them), `homa_subjects[]`, `homa_topic_ids[]`, `taxonomy_version`, `rights` jsonb with `use_scope` (product_reference | training_only | both) set at intake by the operator routing answer plus source-kind default, `split` (train | eval | holdout, assigned at document level at intake; page-level splits leak layout and phrasing across the boundary), `minhash_sig`, `cluster_id`, `cosmo_ref_ids[]`, `enrichment_raw` jsonb (the raw API responses, kept verbatim).

`corpus.page`: `page_id`, `item_id`, `page_index`, `master_sha256`, `master_key`, `work_key`, `vlm_key`, `dpi`, `page_kind` enum (cover | title | toc | instructional | worksheet | answer_key | flashcard | story | illustration | blank | index | ad | other), deterministic gate outputs computed before any model sees the page (`ink_coverage`, `laplacian_var`, `skew_deg`, `is_blank`, `dup_of`), `ocr_key`, `ocr_model`, `ocr_version`, `layout_key`, `structural_html_key`, `verbatim_check_rate`, `dual_read_cer`, `repetition_score`, `activity_format_slug` (validated against the 59-slug registry in `apps/web/agent/activity-formats.md`), `recipe_matches[]` (against the 50 shipped recipe slugs, listed live, never from memory), `recipe_gap` (must match `^[a-z0-9]+(-[a-z0-9]+)+$` or `cosmo-funnel.ts` silently drops it), `topic_ids[]`, `edu_score`, `novelty_score`, `status`, `graduated_ref_id`.

`corpus.item_problem` (the money table for RL): `stem_text` plus `stem_verbatim_ok` (code-checked against the transcript), `item_type`, `answer_value`, `answer_source` enum (printed_key | solver | model | absent), `answer_verified` enum, and `reward_ready` as a generated column no agent can set: true only when the answer came from a printed key or a deterministic solver and verification passed. Model-only answers never reach the reward bank or any eval.

`corpus.tag`: one row per assertion; `value` is always an ID from a closed catalog (Homa topic ID checked against `topics.json` at the stamped `taxonomy_version`, `MARBLE_DOMAIN_MAP` pair, LRMI enum, ONIX List 77 grade, CASE GUID, SCED subject code), plus a verbatim quote that code re-checks against the transcript. This is the models-judge-code-verifies law applied to tagging: the model proposes, the catalog and the quote check have authority.

`corpus.batch`: intake batch ledger: operator, date, item count, page count, model spend, storage delta, gate pass rate. This is the cost ledger; a weekly digest line goes to the founder console so an $80/month system cannot quietly become a $900 month.

Region classes for layout extend DocLayNet's 11 with what a worksheet corpus exists for: `directions`, `worked_example`, `problem`, `answer_blank` (with `forProblem` and `blankKind`), `word_bank`, `illustration`, `decorative_art`, `manipulative_cutout`, `tracing_guide`, `grid_or_numberline`, `rubric`, `standards_citation`, `teacher_note`, `answer_key`, `cut_line`, `folio`. Geometry cannot be backfilled without re-running everything, so it is captured whenever a worksheet-class page is read.

## 7. Agent pipeline

A separate worker queue on a spare Mac mini or a Fly machine polling R2. Never a Vercel function (deadline tiers and OIDC token life make long batch work wrong there), never a Cosmo session (300k pages through Slack-latency sessions would destroy co-founder turnaround). Every stage is model-proposes-code-verifies; a failed check drops the claim, never softens it.

1. **intake** (no model): sha256, JXL transcode, page explode, R2 put, `corpus.item` and `corpus.page` inserts, ISBN barcode read, document-level split assignment, MinHash signature.
2. **gatekeeper** (no model, 100% of pages): page-count assertion against the operator count and the Open Library page count, duplex parity check, `laplacian_var < 100` triggers rescan, `ink_coverage < 0.005` marks blank and the page never reaches a model (the cheapest anti-hallucination gate there is), skew bounds, in-batch duplicate hash, checksum verification, two-location replication confirmed. The quarantine bin releases only here.
3. **librarian** (model, per item): fills only what catalogs could not (grade range, approach, faith posture, series membership), closed enums only, identity confidence capped at 0.6 when no ISBN resolved.
4. **page-reader** (model, per page): Gemini-Flash-class OCR-to-markdown via the existing Vercel OIDC gateway (no new credential, founder ruling 2026-07-27; batches chunked because the local token lives ~12 hours). Roughly $0.17 per 1,000 pages, ~$51 for the whole corpus. Flagged pages escalate to a stronger model tier. Self-hosted olmOCR-2 is deferred until sustained volume passes ~2M pages; below that it saves ~$45 total while adding a GPU box and an on-call surface.
5. **geometry** (worksheet-class pages only): Surya- or Docling-class layout boxes plus reading order; disagreement with the page-reader text doubles as a free dual-read check (`dual_read_cer`).
6. **verifier** (no model): olmOCR-style binary unit tests: schema validity, verbatim quote presence, n-gram loop detection, table row arity, problem/blank/answer-key count agreement, text-length-vs-ink z-score, topic IDs exist at the stamped taxonomy version, gap slugs match the funnel regex. Score below 0.85 re-extracts; twice below 0.6 holds the batch. The write path is modeled on `apps/web/lib/knowledge/gate.ts`: zod, sanitization, content-hash dedupe, advisory locks, flagged-row audit trail.
7. **item-extractor + answer-binder** (model + code): per-problem extraction with character-exact verbatim stem re-check; arithmetic answers verified by a deterministic solver; non-arithmetic answers need printed-key match or 2-of-3 model agreement, and even then `answer_source` records the provenance honestly.
8. **scorer** (model): 0-5 educational-value and worksheet-style scores stored as sidecar attributes, never used as a deletion gate. The FineWeb-Edu distilled-classifier trick is deferred until ~500k pages; at $0.17 per 1,000 pages the frontier pass is not the cost that trick was invented to dodge.
9. **dedup** (no model): MinHash 128 permutations, 13-gram shingles, Jaccard 0.8, plus pHash64 hamming <= 6 for images, per acquisition batch, never global (global dedup deleted FineWeb's best data, and Homa will scan five editions of the same workbook on purpose). Signatures and cluster IDs stored; nothing removed. When a cluster straddles the train/eval boundary, eval wins and the train rows drop from builds.
10. **curator** (human, ~5 min/day): 1-2% stratified sample scored against a frozen 200-page golden QC set with published CER/WER. The golden set is founder-approved, frozen in R2 with a sha manifest; edits create a new version and reported numbers pin the version they were measured against.

One-time model spend for the full corpus: under $1,200. Steady state: under $80/month.

## 8. The parts the council missed (folded in, not appended)

1. **Audio lane** (section 4, lane E): lesson-listen and Telnyx already manufacture paired speech, transcript, and outcome. Archive them.
2. **Backup, 3-2-1**: R2 versioning is not a backup story. The two 8TB drives are: nightly rclone of the master plane to drive 1 (on site), drive 2 rotated off site weekly. Quarterly restore drill: pull 100 random masters, verify sha256. For destructively scanned paper an unverified backup is not a backup. The scanning machine's disk is encrypted; it holds the only copy of destroyed books for hours.
3. **Tombstones**: `tombstones.jsonl` in R2, append-only: (`item_id` or `page_id`, reason, timestamp). Every L2 build reads it and excludes matches; the build script fails closed if the file is unreadable. Masters are flagged, not deleted, unless the reason requires deletion. This is the mechanism behind D10.
4. **De-identification for family renders** (gated by D4): before a family render enters the archive, a scrub pass replaces child names and stated interests using the family context the render already carries (deterministic string replacement; a model proposes spans, code performs and verifies the substitution). Until that pass exists, family renders are excluded, full stop.
5. **`use_scope` enforcement**: the build script refuses `product_reference`-only items in any training build, with a test proving it. Who sets it: the intake operator's routing answer sets it for scans; source-kind defaults set it for renders (sandbox: `both`; family: `product_reference` until D4 rules otherwise).
6. **Queue observability**: a batch status page on the admin bench (later), plus a dead-simple heartbeat: if the worker processes zero pages for 6 hours while a batch is open, a founder-console alert fires. Every stage is idempotent per `page_id` so a worker death mid-batch resumes by re-running.
7. **Operator logistics**: the quarantine bin, paper recycling cadence, keeper-shelf for lane B, and the operator's pay live in the batch ledger doc, not in anyone's head.

## 9. Coexistence with the Cosmo product pipeline

Cosmo's Slack loop is correct for what it is: human-latency taste drops from the co-founders, deep per-item analysis, product graduation. It does not change: same skills, same `verify-ingestion.py`, same `:ship:` gate, same graduation surfaces, same founder-gated anchors.

Four additive seams, nothing else touches it:

1. `corpus-put.sh`, a sibling of `blob-upload.sh` that pins the R2 bucket the same way blob-upload pins the Blob store, so Cosmo drops also land a copy in the corpus (masters plane) from day one.
2. An optional `corpus: {itemId, pages, r2Prefix, status}` block on ref/cur JSONs. Both the verifier and `cosmo-funnel.ts` ignore unknown keys, so this is safe before the verifier learns to check it.
3. One new verify-ingestion check (warn-only at first): a ref whose original was captured should carry a corpus block.
4. One more `--regen-index` projection so the corpus index can list which refs are corpus-backed.

The one real coupling is the **nomination queue**: a corpus page reaches Cosmo for product graduation when `edu_score >= 4` and it matches an open gap slug (63 today) or a zero-exemplar topic, and it is not a near-dup of an already-graduated page. Expected yield is 1-3%, so a 5,000-page day produces tens of candidates, not a firehose. The corpus never gates `:ship:`, never blocks a graduation PR, never shares a queue, lock, or credential with product ingestion. If the corpus worker is down for a week, product ingestion does not notice. Books and scraped items never enter the one-JSON-per-item git path; that path stays for founder taste drops.

## 10. Dataset export layer and the training menu

Builds are named and semver'd: a `build.yaml` (attribute filters, resolution, caption strategy, split, git SHA) goes in; `shards/v<N>/` plus per-shard parquet sidecars and a dataset card (counts, sources, dedup thresholds, known gaps) come out. Filtering is mix-time configuration, never upstream deletion.

Captions for image-side training are structured page cards, not prose: `one_line`, `layout_skeleton`, `grade_band`, `skills[]`, `problem_count`, `response_kinds[]`, `visual_register`, `ink_density`, `illustration_style`, and `verbatim_text` copied from the transcript and code-verified as a whitespace-normalized subset of the OCR text. A worksheet caption that omits the literal text trains hallucination. A 5% human-written caption slice stays as a regularizer.

Four frozen evals exist before any training run: `worksheet-ocr-200`, `answer-key-500` (the grader's own test set), `tagging-300`, `style-100`.

The training menu, honestly ranked by (cost, time-to-signal, product relevance):

- **T1** Worksheet-style image LoRA on approved-final rasters (FLUX/SDXL-class open image model, or a service). 12-30 curated images, $9-26 of compute, weeks away. Proves the export loop; gives Homa a house visual style beyond the anchor library.
- **T2** SFT an open-weight ~8B model (Qwen3-8B-class, via Tinker-style LoRA service or rented GPU) as an HTML emitter on ~1,000 (brief, approved html) render pairs. Roughly $20 of compute. This is the product bet: format fidelity, layout discipline, instant cheap drafts that materials-studio then reviews.
- **T3** DPO free from the `revises` chain: rejected draft vs approved final, 600-2,000 pairs, once D5 preserves verdict history.
- **T4** RLVR on a deterministic reward basket, never one scalar: renderability, DOM-measured overflow and blank write-in area, answer-key solvability via the solver, spec conformance, OCR round-trip legibility, small-weight style score, plus a KL regularizer. (A lone OCR-legibility reward gets hacked by making text dominate the page; the basket is the defense.) `corpus.item_problem.reward_ready` rows are the reward bank.
- **T5** A reader VLM fine-tune on the scan corpus (page image, verified transcript, region geometry) if and when Homa wants first-party document understanding instead of paying per-page API OCR forever.

Explicitly out of scope: continued pretraining and from-scratch pretraining. 300k pages is ~75-250M highly repetitive tokens against a 500M+ practical floor, on a domain frontier models already know. No storage, OCR, or staffing decision in this plan may be justified by CPT. If the corpus someday reaches tens of millions of pages, revisit with a new plan.

## 11. Phasing

**v0, this week** (mostly no hardware):
1. Render-pair archiver on the `create_printable` path: persist source HTML, render config (Chromium version, viewport, `RASTER_SCALE`, JPEG quality), PDF, page rasters, brief, review verdict, `status`, `revises` link. Append-only, sandbox and founder renders only (D4).
2. D5 migration: stop overwriting `materials_studio_runs` feedback; keep history, store critique text on every `revises` edge.
3. Rescue the ~183 stranded originals off the Cosmo laptop into durable storage. One machine, no backup, 14 links already permanently lost. One hour of work; treat it as having a deadline.
4. Create the private R2 bucket, ship `corpus-put.sh`, move the `inspo/` originals off the public Blob store.
5. Order the rig (D2/D3).

**v1, this month**: intake CLI plus gatekeeper; `corpus` schema plus CI guard; page-reader and verifier; tagger against real catalogs; nightly parquet export; nomination queue into Cosmo; golden 200-page QC set; first 200-500 books through the lanes; T1 style LoRA to prove the loop.

**v2, later**: item/answer extraction at scale, the reward basket and RLVR harness, the web lane with raw-HTML retention (D7), the distilled quality classifier past ~500k pages, T2/T3 on the render pairs, T5 reader VLM (D6 sequencing).

## 12. What could kill this (named risks)

- The warehouse-of-scans failure: capture without the verifier and golden-set QC produces terabytes nobody trusts. The gates ship with v1 intake, not after.
- The single-laptop window: until v0 item 3 ships, one disk failure erases the only copies of ~183 originals.
- Split leakage: eval contamination from page-level splits or cross-batch dup clusters would silently inflate every number; document-level splits at intake and eval-wins dedup are the defenses.
- Founder-bottleneck scanning (D3): the rig without the operator is furniture.
- Scope creep into CPT: the moment someone sizes storage "for pretraining", the budget triples for an option this corpus cannot deliver. The out-of-scope declaration in section 10 is binding.
