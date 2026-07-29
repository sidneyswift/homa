# Council review: eight lenses, adjudicated

Run 2026-07-28, workflow of 9 agents (staff-pm, agent-architect,
materials-engineer, data-engineer, channels-voice, bug-verifier, growth-pm,
red-team, adjudicator). Each seat read the plan folder, CLAUDE.md, and its
lens's real code before writing. This document supersedes any plan claim it
corrects; 01/04/05 carry pointers at the refuted spots.


## Verdict summary

The study's evidence is excellent and its prioritization is inverted. Three seats independently showed that F1, the declared centerpiece, does not touch the dominant daily pain in its own receipts: the materials loop (166 rows, a ~60-round packet, drafts stranded on three separate days) and findability. The council rules: the bug cluster, the QC honesty fixes, and the version rail lead; F1 ships as a thin, evidence-gated slice behind them and becomes the centerpiece of the next arc. Two flagship technical premises are wrong and are corrected below: F6 leg 1 re-prescribes print-parity QC that shipped 2026-07-19 (the real false-pass mechanisms are four different ones, all now located in code), and F5's "data already exists end to end" is refuted because finalize deletes prior versions' bytes. FB-1's ~1500-char composer cap was refuted outright; the strong alternative is the 180-second dictation auto-stop. F9's four-week cap contradicts live curriculum-studio behavior and needs a founder package that presents the existing volumes design honestly. F10 must be split: the phone line is forbidden to make most of the promises the plan would auto-execute, and conversation_offer_fulfillments structurally cannot hold call commitments. FB-7 (create_printable outages with no operator alerting, the customer told to be the pager) is the most revenue-critical finding and outranks every feature here.

## Confirmed corrections to the plan

1. **F6 leg 1 already shipped.** Print-parity QC has been live since 2026-07-19: previews and the review pass are rasterized from the delivered PDF bytes (apps/web/lib/materials/render-page.ts:283, apps/web/lib/materials/rasterize-pdf.ts:10). The Amalia false passes happened with parity in place. The actual mechanisms, verified in code: REVIEW_PAGE_CAP = 4 so pages 5-12 of a packet are never reviewed (apps/web/lib/materials/review-artifact.ts:29, :96); a deliberately lenient rubric (review-artifact.ts:47, :61, :68); a null review (timeout or outage) delivering as passed (apps/web/agent/tools/create_printable.ts:747); and requestSummary capped at 600 chars, less than half her real 1502-char edit list (create_printable.ts:198). F6 must name these four, not re-litigate the solved one. (materials-engineer, red-team, concurring.)

2. **F5's premise is refuted.** planMaterialFinalization queues every superseded draft's pdf_url and preview_url for blob deletion (apps/web/lib/materials/library.ts:641, :665), and re-finalizing an old node is blocked by design (library.ts:622). For exactly the chains the binder shows, prior versions have rows and stored html but no bytes; image-mode versions lose everything. F5 needs a retention decision (stop deleting draft bytes, keep thumbnails only, or re-render from html where possible) and "make this one current" must be an append-only new revision. (data-engineer; overrides the staff-pm and red-team endorsements of "pure surfacing".)

3. **FB-1's hypothesized constant does not exist.** No ~1500-char cap exists in the composer, send policy, or write path (apps/web/app/app/slash-composer.tsx:285, apps/web/app/app/chat-send-policy.ts:82, apps/web/lib/conversation-log.ts:20); the persisted cap is 8000. Strong alternative: MAX_RECORDING_SECONDS = 180 hard-stops dictation and auto-accepts it (apps/web/app/app/dictation.tsx:48), and 1502 chars in 180 seconds is dictation pace. One prod query on the turn's voice/text modality stamp (chat-send-policy.ts:98) settles it. Do not hunt the constant. (bug-verifier, red-team.)

4. **The upside-down answer key was the skill obeying its own text.** materials-studio's math law says "Key on a separate page or upside-down at the bottom" (apps/web/agent/skills/materials-studio/SKILL.md:86-88). Delete the clause today; the F3 assembler work alone would leave the skill proposing what the code rejects, burning a round each time. (agent-architect, materials-engineer.)

5. **US-17 and finding D4 are stale on the UI side.** The per-child hours surface shipped 2026-07-26 (apps/web/app/app/hours/page.tsx, PR #228, issue #174 closed), one day after the study's evidence. Cut US-17 as a build item; the residual questions are discoverability (did she find it after 07-26, a one-query check) and the still-real agent-side gap: the web agent has log_hours but no read path over hours_log, which is why FB-11's denial happened and will recur regardless of #278 (apps/web/agent/tools/log_hours.ts, no hours-reading tool exists). (staff-pm on the UI; channels-voice on the agent gap; both stand.)

6. **B1's "nowhere durable to land" is overstated.** Three landing places exist and were not invoked: save_homeschool_profile.curriculums[] (apps/web/agent/tools/save_homeschool_profile.ts:46), the curriculum atlas holding her exact stack (apps/web/lib/curriculum/atlas-catalog.json, via find_curriculum_profile), and chat_attachments, where the 07-27 book photos ARE durably stored with title-identifying captions retrievable via find_attachments (apps/web/agent/tools/find_attachments.ts:10, supabase/migrations/20260713073000_chat_attachments.sql:20). The 07-23 loss was a routing and channel-availability failure, not a missing plane. F1 should backfill from chat_attachments so her library seeds on day one, and US-2's acceptance case should first be attempted with existing tools. (red-team, data-engineer.)

7. **F10's "existing machinery" claim fails in four places.** The conversation_offer_fulfillments eligibility CTE requires morning-brief delivery rows a phone call never produces (apps/web/lib/conversation-continuity/offer-fulfillment.ts:71); the unique constraint is one fulfillment per delivery (offer-fulfillment.ts:89) while the 07-22 call promised three; the kind enum lacks email (offer-fulfillment.ts:6); analytics hard-code morning_brief (offer-fulfillment.ts:265). A new call_commitments table reuses the offer-recovery pattern (stale threshold, 24h window, 2 attempts, offer-recovery.ts:37-43), not the table. (channels-voice; overrides red-team's endorsement of reusing the machinery.)

8. **F2's "no new tool if plan-edits suffices" is already answerable: it does not suffice.** edit_plan only adds, rewords, reorders, or removes activity text; schedule_plan_activity only sets a date (apps/web/agent/skills/planner/SKILL.md:60-73). Worse, plan_activity_schedule is the wrong row for provenance: rows exist only once scheduled, are upserted so moves rewrite in place, and index shifts silently misattach (supabase/migrations/20260726140000_plan_activity_schedule.sql:20). The source link belongs on the activity itself, which lives as bare 60-char strings in child_plans.plan jsonb (supabase/migrations/20260707190000_child_reports.sql:103, packages/core/src/map/schemas.ts:96). F2's honest scope is evolving the activity shape through plans.ts/plan-edits.ts under check:map; "additive columns only" is false. F7's material_id-on-schedule-rows has the identical defect. (agent-architect, data-engineer.)

9. **FB-4's telemetry demand routes to a closed issue.** #170 (CG-06) closed 2026-07-27. The strongest usage evidence in the study (8+ "where is it?" instances) has no open tracking home; file a new issue for per-turn delivery telemetry citing #170 as provenance, keeping #256 for the mobile-silent-render slice. (staff-pm.)

10. **F4's session-state theme tracking is the wrong layer.** Theme fatigue is cross-week; defineState is session-only. No new state is needed: every material row carries theme, characters, childId, created_at, and find_materials filters on theme (apps/web/agent/tools/find_materials.ts:52). Recent-theme pressure is a deterministic derivation over existing rows. (agent-architect.)

11. **save_family_asset "write original to Blob" is impossible as specified.** eve tool results are text/json only (find_attachments.ts:17-25 records this); the model cannot pass bytes. The tool takes the attachment URL plus proposed metadata, re-verifies the URL is inside the caller's family space server-side, and references or server-copies the blob, giving every asset a provenance chain. (agent-architect.)

12. **Status hygiene.** The seats flagged FB-8 as unfixed and the README as overclaiming; the current 05-bugs.md records FB-8 FIXED in-session (17 rows verified leaf and deleted, 05-bugs.md:90-98), which resolves the complaint. The README's "council-reviewed" status becomes true with this document; 07-issues.md must still be written and must open with an explicit rank against #255 and #299 (see build order).

## Bug verifier results

| Bug | Verdict | Root cause | File refs |
|---|---|---|---|
| FB-1 | Refuted (as hypothesized) | No ~1500 constant anywhere in the write path; strong alternative is dictation auto-stop at 180s auto-accepting a mid-word transcript, hidden by the single-line input | apps/web/app/app/dictation.tsx:48, apps/web/app/app/slash-composer.tsx:285, apps/web/lib/conversation-log.ts:20, apps/web/app/app/chat-send-policy.ts:98 |
| FB-2 | Confirmed | Family-wide FOR UPDATE on all materials rows at finalize, plus mark_material_final at the 45s quick tier with repeatable: false, plus the deadline error forbidding retry; the tool is actually idempotent so non-repeatable is over-conservative | supabase/migrations/20260718150000_subject_lessons.sql:87, apps/web/lib/materials/library.ts:683, apps/web/agent/tools/mark_material_final.ts:37, apps/web/lib/agent-tool-deadline.ts:80 |
| FB-3 | Confirmed | Structural absence: zero agent tools read lesson_recordings, no reattribution write exists anywhere, child selection is upstream of the recorder via URL param | apps/web/lib/lessons/store.ts:152, apps/web/app/app/[childId]/lessons/record/page.tsx:41 |
| FB-4 | Confirmed | Confirm-by-shape card parsing returns null silently on any mismatch; no client render ack exists; only pdf_opened fires, on open not render | apps/web/app/app/material-message-parts.ts:33, apps/web/components/.../material-card.tsx:53 |
| FB-5 | Confirmed | Captions capped at 240 chars with no OCR path anywhere; video is scene description; tool results are text-only so the agent can never re-see pixels | apps/web/lib/voice/caption-image.ts:28, apps/web/app/api/video/describe/route.ts:37, apps/web/agent/tools/find_attachments.ts:21 |
| FB-6 | Confirmed (machinery claim corrected) | Real promise class with no ledger; the plan's proposed substrate cannot hold it (see correction 7); transcripts store tool_calls, so "promised email, zero send_email calls" is deterministically verifiable | apps/web/lib/voice/transcript-sync.ts:33, apps/web/lib/conversation-continuity/offer-fulfillment.ts:71 |
| FB-7 | Needs prod data | Candidates mapped: 210s render deadline with do-not-retry messaging, or chromium launch failure in the generic catch; the #336-#339 packaging fight postdates the 07-26/27 windows and touched a different lambda. No-alerting confirmed: AlertSource has no tool-failure source | apps/web/agent/tools/create_printable.ts:305, :563, apps/web/lib/agent-tool-deadline.ts:80, apps/web/lib/admin/alert-acks.ts:18 |
| FB-8 | Resolved in-session | Debug rows in a real tenancy; 17 leaf rows deleted 2026-07-28 per 05-bugs.md; residual orphan blobs optional sweep; the rule duplicates existing +homatest hygiene and should cite it | docs/homa-planning/plans/2026-07-28-carolyng-field-study/05-bugs.md:90 |
| FB-9 | Plausible | No server output cap exists; two client mechanisms end turns mid-sentence by design: the 20s visibility-stall abort on tab return and the 180s watchdog, both leaving partial text with no marker; needs the 07-24 session's turn telemetry to pick which | apps/web/app/app/chat-client.tsx:206, :216, :1043 |
| FB-10 | Confirmed | STT vocative mishears; fix spans BOTH call instruction files (the curriculum line loads a separate file) plus the extraction prompt treating vocatives as unreliable; never rewrite the stored transcript, and roster validation alone cannot catch it because Alma is a real child | scripts/telnyx-provision.mts:510, scripts/telnyx-curriculum-provision.mts:58, apps/web/lib/learning/extract-memories.ts |
| FB-11 | Confirmed, partially misattributed | The 07-25 rows existed at denial time (voice log_hours writes immediately); the web agent asserts absence over a table it cannot read; #278 helps the call-recency half only. Data check owed: was the 07-23 call in call_transcripts at 12:49 (the 12:00 cron stores on first sight) | apps/web/app/api/voice/tools/log-hours/route.ts, apps/web/lib/voice/transcript-sync.ts:224 |
| FB-12 | Confirmed | Code authors the overclaim: " Quality check passed." is emitted by create_printable when review.pass is true, scoped to a brief that does not carry the revision's reason for existing; a models-judge-code-verifies inversion in miniature | apps/web/agent/tools/create_printable.ts:821, :581, apps/web/lib/materials/review-artifact.ts:55 |

Additional cap collision the study missed: a per-page revision of page 5+ ships completely unreviewed (the reviewer always sees pages 1-4 in document order, so the revised page is precisely the one it cannot see), and PREVIEW_PAGE_CAP = 6 means pages 7-12 of a packet have no preview JPEG anywhere (apps/web/agent/tools/create_printable.ts:88, :592, apps/web/lib/materials/render-page.ts:51, review-artifact.ts:96).

## Challenges that must be answered before building

1. **Which clock does this arc serve?** The July 13 deadline is past; the live clocks are the paywall kill test (scored through 08-01), tiers sold before gates exist (#298), and the iOS submit path (#310). The arc lands on four open arcs (#255 one-planner, #287 voice, #299 iOS, gh#328 corpus), depends on two of them (F2/F7 on #258/#259; F10 on #278/#281), and names nothing it displaces. 07-issues.md must open with a displacement statement. (staff-pm, red-team.)

2. **n=1 generalization.** Every library-shaped demand signal traces to one price-insensitive, product-fluent co-founder, and the nearest analog (the calendar planner, shipped for her class of demand) has zero real-family adoption (#253). Before F1's XL commitment: count non-sandbox families with chat_attachments rows, families naming atlas curricula, families asking "what do we have about X". Before F9 and F4 become fleet law: fleet materials cadence, revision-round distribution, and theming-request numbers. If near-zero outside family 304f0003, F1 is a deliberate co-founder bet with an adoption gate, stated as such. (red-team, staff-pm.)

3. **F1 has no eval, violating the measurement clause of models-judge-code-verifies.** The librarian is squarely a language-to-structured-data capability; the spec has schema, tools, skill, UI, and a bulk lane, and zero eval line. Before the migration lands: a tagging eval bank built from the 410 real messages plus other families' asset mentions, an accuracy target, and a ratchet. US-2's single-transcript AC is not a bank. (red-team.)

4. **Retrieval must be semantic, verification must be per-source.** find_family_assets as substring filters over free tags reintroduces the journal-matcher failure ("insects" misses "bugs"; "libros de conejos" never matches "bunnies" in this bilingual family); family_memories already embeds via embedText (apps/web/agent/tools/remember.ts:125), and assets need the same. Provenance quotes cannot verify photo-sourced assets (the model would verify its own caption); call/dictation assets quote-check against transcripts, photo/PDF assets need an OCR text layer first, which makes F11 a hard dependency of F1's tagging quality. (agent-architect.)

5. **F6 leg 2's complaint replay is itself a judgment capability and needs the split specified.** Someone must turn "the strawberries are too small for her scissors" into an executable check: model proposes a structured object (check type from a closed catalog of geometry checks, page index, threshold, verbatim quote code re-checks), stored durably on the revision (the generation JSON already stores input/review/pageCount per version, create_printable.ts:637), replayed mechanically, with reviewArtifact gaining an assertions array answered item by item (review-artifact.ts:44). Without the ledger, replay is a prompt hope and FB-12 returns within a month. requestSummary at 600 chars cannot carry it. (agent-architect, materials-engineer, converging independently.)

6. **F6 leg 3 reverses a recorded founder ruling and collides with gh#328.** "No template on purpose" is written into create_printable's header (create_printable.ts:70-73, founder rulings 2026-07-09/10); a parameterized template bank needs a re-ruling recorded in the reconciliation index before any prototype is treated as direction. The bench must also coordinate with gh#328's writer plane so two layout programs do not run uncoordinated, and must score on parent-visible rounds to approval and cost per converged material, not first-render quality: image-first collides with the 30/day image budget that already bit this family (apps/web/lib/materials/image-budget.ts:18) and destroys the 2-3s free surgical html revision. Note the substrate is not greenfield: 50 recipe files and the anchor registry are a template bank in prose already. (materials-engineer, staff-pm.)

7. **Routing: "here's my curriculum" must not load curriculum-studio.** The builder's description ("learn everything about this curriculum and build one", apps/web/agent/skills/curriculum-studio/SKILL.md:2) is one adjective from the librarian's core intent; mis-routing starts a background authoring job instead of saving her property. Both skills need adversarial-negative fixtures in both directions and negative-scope descriptions; the council rules the librarian owns decomposition and curriculum-studio consumes decomposed assets. The library-check integration must also merge into materials-studio's existing conditional "check the library" step (SKILL.md:107-122), not add a second unconditional retrieval gate (the onboarding-latency failure class). (agent-architect.)

8. **F1's storage and tenancy decisions cannot default their way through.** Which store holds originals: the public Vercel Blob default is the exposure defect gh#328 already named, at family scale, with possible rights problems for paid curriculum PDFs; but private storage breaks the isFamilyArtifactUrl reference-image path until a signed-URL or proxy exists (apps/web/lib/materials/artifact-store.ts:87, find_attachments.ts:17). The self-referential RLS insert policy for parent_asset_id is structurally the alias-capture scar that silently dropped materials lineage (supabase/migrations/20260719170000_fix_materials_revises_rls.sql:1); the isolation guard is hand-enumerated, so family_assets fixtures, including a positive in-family parent-link case, ship in the same PR (scripts/isolation-check.mjs:2434, :522). Zero corpus columns on family_assets; nomination is a corpus-side ledger row, and the deletion path must extend to asset blobs. (data-engineer.)

9. **F10's negative space.** The general line is forbidden to promise post-call sends (apps/web/agent/general-call-instructions.md:53), so most extractable promises are rule violations by the line's weak model; auto-executing them rewards fabrication. v0 is a verifier only (promise-shaped language cross-checked against persisted tool_calls, transcript-sync.ts:33; it only ever admits failures, zero fabrication risk), riding #278's webhook moment with its own claim stamp, never the two-pass cron cadence (transcript-sync.ts:63, call-memory.ts:35). Execution waits for #281/D7 and covers only legitimate call capabilities, with content specs from verbatim quotes, offer-recovery bounds, and a channel fallback (the SMS gate at telnyx.ts:474 means "preferred channel" does not exist in any ledger). (channels-voice.)

10. **Missing acceptance criteria.** US-9 needs a ratcheted outcome number (median rounds-to-final <= 2 for packet-class, measured on the revises chain, the 07-23 Amalia packet as regression fixture); the baseline is computable today from materials.generation before any F6 leg ships, excluding the FB-8 debug rows from the 166 headline. US-1 needs deletion-cascade, consent posture (migration 20260728190000), and post-cancellation policy ACs. US-14 needs side-effect bounds per the offers-never-auto-place law. (staff-pm, materials-engineer.)

## Ideas and suggestions adopted

**F1 (family library)**
- New family_assets table confirmed over every alternative substrate; knowledge_bank is fleet-gated, family_memories is sentence-budgeted, chat_attachments is a server-write-only transport receipt; copy the materials RLS posture (adopted; agent-architect and data-engineer independently audited).
- save_family_asset becomes promote-by-URL from chat_attachments with server-side re-verification and a source_attachment_id provenance column (adopted).
- Backfill lane over existing chat_attachments rows so her book covers seed the library on day one (adopted).
- Embed asset rows at write; retrieval is semantic plus filters, librarian judges relevance from a generous candidate set (adopted).
- family_asset_tags as one row per assertion (kind enum, value, verbatim quote, source) instead of entities text[]; stamp taxonomy_version beside topic_ids (adopted).
- subjects[] and age_band reuse the existing canons (canonical subjectIds; RESEARCH_STAGES bands in save_knowledge.ts:66); free tags only for entities (adopted).
- parent_asset_id plus ordinal smallint and unit_label instead of a curriculum_units table, so "week 8 science" is answerable (adopted).
- Nullable atlas_id linking family curricula to find_curriculum_profile's 155 profiles, a clean family/fleet reconciliation point (adopted).
- Interim honesty mitigation ships now: Homa stops promising storage that does not exist, saves what memories can hold, states plainly what will not persist (adopted; one-day fix).
- Eval bank before migration (adopted, see challenge 3).

**F2 (curriculum to planner)**
- Land as spec and evidence on #262/#267, not a new feature here; the genuinely new dependency this plan owns is F1's decomposition (adopted).
- Source links live on the activity shape in child_plans jsonb, evolved through plan-edits under check:map; decide edit_plan schema growth vs attach_schedule_source now (adopted).

**F3 (material ladder and answer keys)**
- Delete SKILL.md:87's "or upside-down at the bottom" clause today (adopted).
- Role enum on packetPageInput (student | answer_key | cover | parent_guide); code enforces declared keys on own pages, review brief gains the assertion; the assembler cannot detect keys in anonymous html (adopted).
- Downsize to the deterministic core plus answer-key default-on; the full ladder prose follows (adopted).
- F9's four-week rung stays out of materials-studio's ladder; curriculum-studio owns that routing intent (adopted).

**F4 (theming dial)**
- themeLevel (none | decorative | immersive) as a create_printable metadata enum chosen on every call, copying the anchorIds lesson (generate_image.ts:89); no-theme zones become a deterministic validator; saturation becomes queryable (adopted).
- Derive recent-theme pressure from existing material rows; no session-state tracking, no new table (adopted).
- Downsize M to S: defaults, no-theme zones, one-offer-per-batch as skill edits plus one eval; rotation tracking waits for fleet evidence (adopted).

**F5 (version rail)**
- Still the highest leverage-per-effort feature and first feature merged, conditional on the byte-retention decision (adopted with data-engineer's correction).
- Scope the finalize lock to the revision chain and add the missing materials(revises) index, which the rail's query wants and which shrinks FB-2's lock window (adopted).

**F6 (layout program)**
- Reframe leg 1 as the four real mechanisms: review coverage (changed-pages-first reordering is near-free; chunked review is the founder cost question), rubric strictness, null-review honesty, and the complaint channel (adopted).
- Deterministic overflow check via scrollHeight on .homa-sheet-body inside the existing render pass, and fill-ratio in pixel space via the already-loaded canvas; geometry findings appended beside the model review (adopted).
- Durable complaint ledger in the generation JSON plus an assertions array in reviewArtifact (adopted).
- data-homa-role semantic annotation contract as a third bench arm between freeform html and templates: gets trace-line and per-age geometry checks without reversing the no-template ruling (adopted).
- Compute the convergence baseline from existing data before building; it also gives FB-7 its query surface (adopted).

**F7 (approved-by-morning)**
- Cut from this arc; pure composition blocked on F2, #259, #262 (adopted).
- When revived: first slice scoped to trial families, measured against the visitors-to-paid kill-test metric, and only after Carolyng's own morning-brief engagement number is pulled (the fleet data says the brief fatigues; do not build the daily front door on an unread channel) (adopted).

**F8 (lesson recordings)**
- Tool pair confirmed correctly scoped; reattribution is a deterministic authenticated action moving recording, review, and evidence atomically, never a model-freeform update; add the "Recording for Amalia, age 3" confirmation on the recorder start (adopted).

**F9 (four-week cap)**
- Founder package must present curriculum-studio's live volumes design (SKILL.md:104-125 gates volume one then runs unattended) and ask the precise question: does the cap kill auto-continuing volumes or only Homa-authored fresh starts; recommended ruling text: author detail in four-week volumes, adapt between volumes, year skeletons allowed (adopted; resize S to M).
- No paywall or ASO use until ruled and the skill copy matches (adopted).

**F10 (in-call promises)**
- Split v0 verifier / v1 executor per challenge 9; new call_commitments table reusing the recovery pattern (adopted).
- v0's mismatch alert doubles as a founder-console pager, partially answering FB-7's theme (adopted).
- The 07-23 transcript joins the call-line eval set now, independent of F10; if the Qwen line cannot hold promise-honesty, that is a concrete number for the #287 rebuild bet (adopted).
- FB-10's fix lands in both call instruction files plus the extraction prompt, via #276's shared block (adopted).

**F11 (multimodal robustness)**
- FB-1 fix becomes: dictation auto-stop surfaces "Homa stopped listening at 3:00" with append-a-second-take, plus a composer that shows long drafts end to end (adopted).
- describe_attachment tool: server-side vision over the stored blob with a caller-supplied question, returning text; solves the re-view gap without eve changes and is F11's OCR intent and F1's persistence in one deterministic leaf (adopted).
- FB-9's fix is client-side: an explicit "Homa got cut off, continue" affordance replacing the silent mid-sentence end, replaying remaining stream events into the same message (adopted).

**Growth (cross-cutting)**
- The tagline ships only in first-party maker voice, never testimonial dress; same rule kills D1's "her words are the App Store copy" as quoted praise (adopted).
- "Homa works from the curriculum you already own" is the answer to the paywall panel's unbeatable price blocker; F1's issue carries it as an explicit payoff, post-ship only (adopted).
- F1 v1 includes the export path and one-sentence ownership promise; fold gh#294 so hours and library get one cancellation policy (adopted).
- Pull Carolyng's real model plus image cost for 07-14..28 and restate the margin table for her class; two-round convergence is a COGS lever, stated in F6's issue (adopted).
- The NYC concierge story stays out of acquisition; lifecycle and Max-tier narrative only, and not before FB-9 is fixed (adopted).

## Ideas considered and rejected

- **Extend chat_attachments instead of minting family_assets** (red-team). Rejected on structure: the table is a transport receipt with insert/update/delete revoked from authenticated (20260713073000:55), while agent writes on the web path run under the caller's JWT; retrofitting library semantics widens a locked-down surface and complicates the isolation guard. Two seats independently audited every substrate and converged on the new table. What survives from the take: the demand-verification gate, the backfill lane, and the thin-slice scoping, all adopted above.
- **Reuse conversation_offer_fulfillments for call commitments** (the plan, endorsed by red-team). Rejected; four structural failures in the eligibility CTE, unique constraint, kind enum, and analytics (correction 7).
- **F5 as pure surfacing with no data work** (the plan, staff-pm, red-team). Rejected; finalize deletes bytes (correction 2). The feature survives, the sizing does not.
- **"Locate the ~1500 constant, raise or chunk"** (05-bugs.md FB-1 fix sketch). Rejected; the constant does not exist and the instruction would burn a session (correction 3).
- **US-8 as a hard refusal** (03-user-stories.md). Rejected as written; it converts live, well-designed volume delivery into a refusal aimed at compliance-minded parents needing year skeletons for state filing. The founder package carries the volumes-plus-adaptation framing instead.
- **Last-used-theme in session state** (F4). Rejected; wrong layer, and the durable signal already exists in materials rows.
- **A tool-per-workflow reading of F7** and any build of F7 in this arc. Rejected; nothing to build until F2, #259, and #262 exist.
- **Lexically rewriting stored transcripts to fix FB-10.** Rejected; the transcript is the verbatim record, and Alma is a real child so roster validation cannot disambiguate. Instruction plus extraction-layer treatment only.
- **Unconditional "check the family library first" steps in three skills.** Rejected; merge into materials-studio's existing conditional trigger to avoid the onboarding-latency failure class.

## Open questions for the founder

1. **F9 ruling** (needs founder-decision issue): adopt "author detail in four-week volumes, adapt between volumes, year skeletons allowed"? Does any cap apply to auto-continuing volumes after volume-one approval? The package must include the existing curriculum-studio behavior and fleet cadence numbers, per the n=1 challenge.
2. **F1 tier placement**: is the family library the Plus gate that makes "your own curriculum" (wall-copy.ts:291) true and closes gh#298's falsehood window, or does capture ship base-tier with only decomposition and the week-aware planner gated at Plus? Decide before the schema lands; gating retrofits are how gh#298 happened.
3. **Family originals store**: public Blob (works with today's reference-image path) or private R2 (gh#328's own exposure ruling, at family scale, plus curriculum-PDF rights), accepting the signed-URL work? 
4. **Review cost posture**: chunked full-packet review (~3x review cost for the heaviest families) or changed-pages-first only? And when deterministic geometry checks land, is a provable cut-off a delivery gate or a verdict the parent may override ("good enough to print")?
5. **F6 leg 3**: authorize the bench prototype knowing template-first reverses the 2026-07-09/10 no-template rulings, with the data-homa-role contract as the third arm, and with the bench decision declared an input to gh#328's D-decisions?
6. **Data ownership policy**: one ruling covering export, cancellation, and retention for hours (gh#294) and the family library together.
7. **Displacement**: this arc's build order (below) pauses F2/F7 in favor of the bug cluster and defers F1's UI and bulk lane; confirm against #255, #287, #299, and the paywall clock, and confirm FB-7's investigation outranks feature work.

## The council's recommended build order

Ranked. Sizes are honest; each item names what it depends on. Items 1-4 are the week that makes Carolyng herself say it got better; F1 enters at 8 as a thin slice.

1. **FB-7 investigation plus tool-failure alerting** (S; no dependencies). Read the 07-26/27 Vercel logs for the create_printable error strings; add a tool_failure AlertSource over agent_tool_calls (N failures per family per tool per hour). The customer is currently the pager for the product the paywall sells. Displaces nothing; it is the prod-bugs ruling doing its job.
2. **Materials quick-fix bundle** (S; no dependencies). Delete the upside-down-key clause (SKILL.md:87); change the "Quality check passed" string to name what was checked; a null review never reports passed; mark_material_final goes repeatable: true with the chain-scoped lock and the materials(revises) index; changed-pages-first ordering into reviewArtifact on revisesId calls. Every item is hours-sized and hits her daily loop.
3. **Draft-stranding cluster #197/#241/#175** (M; after 2). Finalize retry and truthful timeout reporting, drafts visible in the binder, her 07-28 stranded rows as fixtures. File the new per-turn delivery telemetry issue (FB-4) alongside, citing closed #170.
4. **Convergence baseline** (S; parallel with 2-3). Rounds-to-final, QC-fail-then-pass, per-path stats from the revises chain and generation JSON for 07-14..28, debug rows excluded; sets the US-9 ratchet target and prices the F6 program. Also pull Carolyng's compute cost and her brief-engagement number while in the data.
5. **F6 legs 1-2, corrected** (M-L; after 4). Complaint ledger plus assertions replay; deterministic overflow and fill-ratio checks in the render pass; review-coverage per the founder's answer to question 4. The template-bench (leg 3) waits on founder question 5 and runs on the admin bench when authorized.
6. **F5 version rail** (M; after the retention decision, with 3). Byte-retention ruling, then the rail UI and append-only "make current".
7. **F11 bug half plus FB-9** (S-M; parallel). Dictation auto-stop surfacing and composer visibility; the client "continue" affordance; the describe_attachment tool (also unblocks F1's photo verification path).
8. **Thin F1** (M-L; after the demand query, eval bank, and founder questions 2-3). family_assets plus family_asset_tags migration with isolation fixtures, save/find tools (promote-by-URL, embeddings, canon subjects, ordinal decomposition), family-librarian skill with routing fixtures against curriculum-studio, chat_attachments backfill. UI trails; bulk lane deferred. The interim honesty line ships day one, before any of this.
9. **F8 lesson-recording tools** (M; independent). List and reassign, recorder confirmation.
10. **F10 v0 promise verifier plus FB-10 instruction fixes** (S-M; verifier after #278 steps 1-3, instructions now). The 07-23 transcript joins the call-line evals immediately.
11. **F3 remainder** (S-M; after 2). packetPageInput role enum, answer-key default-on.
12. **F4 downsized** (S; after 2). themeLevel enum, defaults, no-theme validator, one eval.
13. **F2 and F7 as spec contributions** (docs only). Attach the curriculum-feed and morning-composition requirements to #262/#267; no build in this arc.
14. **F9 founder package** (M prep). With the volumes evidence, fleet numbers, and marketing corollary explicitly sequenced after ratification and skill alignment.

What this displaces: F1 loses centerpiece status this arc (it was going to consume the XL budget the bug cluster needs); F2 and F7 are not built here (their substrate issues #259/#262 stay with the one-planner arc); F4 sheds its state half; F6 leg 3 waits on two founder decisions instead of starting. The one-planner, voice, and iOS arcs keep their own priorities; this plan adds evidence to them and takes none of their scope.