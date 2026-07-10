# Materials studio v2 · from worksheet pipeline to creation intelligence

> Status: SHIPPED 2026-07-10 midday (founder "implement and then test
> e2e"; build-log entry same date). All eight tickets landed in one
> pass; live E2E (22 checks) and the first calibration run
> (docs/homa-planning/materials/calibration/2026-07-10/) both passed.
> Founder decisions taken as recommended: renames yes (D-ms-1), cheap
> vision reviewer (D-ms-2, gpt-5.4-mini default), draft bytes deleted on
> finalize (D-ms-3), eve gateway-tags ask logged not filed (D-ms-4).
> Original plan text below, kept for the record.

> Status when written: PLAN (founder direction 2026-07-10 morning). v1
> (built overnight, build-log 2026-07-10 small hours + morning) proved
> the pipeline: agent HTML, Chromium render, Blob artifacts, MMS
> delivery, GPT Image 2 through the AI Gateway. The founder's review
> found the right next problem: v1 is a worksheet pipeline, not a
> creation capability. This plan generalizes it. Tickets are MS-1
> through MS-8, sequenced at the bottom.

## Founder direction, distilled (2026-07-10, two messages)

1. Stop naming things "illustration" and "worksheet". The user may want an
   image, an infographic, a full page the image model draws end to end.
   Design the capability, not the artifact.
2. Homa chooses the path per request: image model alone, HTML alone, or
   both. Never a hardcoded "illustration + HTML = worksheet" recipe. She
   should know today's model failure modes (dense small text) and that
   they will change month to month.
3. Image models do best with references. Approved finals become reference
   inputs for the next request of that kind ("make that kind of worksheet
   for Amalia, but K-pop Demon Hunters instead of Paw Patrol").
4. Homa critiques her own output (look at the render, regenerate if it
   misses) before assuming it is good.
5. Every artifact carries metadata: subject, curriculum style, skill,
   format, characters/theme, child. That is what makes reuse and
   cross-child adaptation possible.
6. Working versions vs the final: the critique loop produces drafts; only
   the final should stay. Homa must know the difference.
7. (Earlier message, same morning) Track consumption per family across
   every modality through the Gateway: tokens, images, everything. This
   is the substrate for the future credit system (08-billing-credits
   design). Gateway is on auto-refill; visibility is the requirement, not
   caps.

## What exists today (verified in code, 2026-07-10)

- `agent/tools/create_worksheet.ts`: agent-composed HTML in, letter PDF +
  JPEG preview out (`lib/print/render-page.ts`), Blob + `worksheets` row,
  MMS delivery on SMS. Tool contract is HTML-only; every creation is
  forced through the HTML path.
- `agent/tools/generate_image.ts` + `lib/illustrations.ts`: prompt-only
  text-to-image via Gateway (`openai/gpt-image-2` default, env-swappable
  `HOMA_IMAGE_MODEL`), bytes uploaded to Blob, URL returned. No reference
  images, "illustration" framing baked into names and refusal copy.
- `worksheets` table (migration #42, one day old): title, skill, urls,
  html, channel. No status, no lineage, no format/theme/curriculum
  metadata, no way to tell a draft from a final. Every revision is a new
  row that looks identical to a keeper.
- `agent/skills/worksheet-studio/SKILL.md`: good craft, but HTML-recipe
  shaped; no path-selection judgment, no reference discipline.
- Usage capture today: only `map.narrative_generated` events carry
  tokens; chat turns, images, embeddings, curriculum, and memory
  extraction report nothing per family.
- Mechanics verified for this plan: eve hooks can subscribe to
  `step.completed` (carries `usage.{inputTokens,outputTokens,
  cacheReadTokens,cacheWriteTokens}` per model call, familyId available
  from session auth, same pattern as `agent/hooks/persist-conversation`);
  AI SDK `generateImage` accepts `prompt: { images: [...], text }` for
  reference-driven generation and returns `result.usage`; `generateText/
  Object` and `embed` return usage; Gateway requests accept
  `providerOptions.gateway.{user, tags}` and `GET /v1/report` groups
  spend by them (Pro plan, we are Pro). eve's per-agent `providerOptions`
  is static at compile time, so per-family attribution for chat turns
  cannot ride the Gateway today; it lands in our own table via the hook.

## Architecture: four pillars

### 1. One artifact pipeline, three creation paths

The deliverable is always the same: a printable/viewable file the parent
can hold (PDF + preview image, Blob-stored, recorded, delivered where she
is). What varies is how the pixels get made:

- **image-direct**: the image model renders the whole page (strong for
  art-heavy pages: coloring, posters, simple count-the-objects; weak for
  dense small text, precise tracing guides).
- **html**: Chromium renders agent-composed HTML (strong for text
  precision, writing guides, layouts, tables; weak for organic art).
- **hybrid**: HTML layout embedding generated images (v1's only mode).

The create tool accepts `html` OR `pageImageUrl` per page, so the agent
expresses any of the three without new plumbing. Path choice is the
agent's judgment (pillar 3), never code.

### 2. The family materials library: metadata, lineage, finals

Every artifact row carries structured metadata (kind/format, subject,
curriculum style, skill practiced, characters/theme, child, path used)
plus lineage (`revises` chain) and status (`draft` → `final` /
`superseded`). Finalization is an explicit, cheap agent action when the
parent approves; it supersedes the chain and deletes draft artifact bytes
(rows and html stay for the record). Finals are retrievable by metadata
(`find_materials`) and their preview PNGs become reference images for the
next same-kind request, including the swap-the-character case across
siblings. Family-scoped only in v2; a cross-family materials bank is a
future `skill_bank`-shaped idea, deliberately not now.

### 3. The judgment layer: skill + calibration + self-review

- The `materials-studio` skill (replacing worksheet-studio) carries the
  path-selection guide ("what the image model can and cannot do today"),
  reference discipline, metadata discipline, and finalize discipline.
  Knowledge lives in markdown so it evolves without deploys as models
  improve.
- A calibration harness generates a fixed brief set through all three
  paths and produces a dated findings report with the actual outputs; its
  conclusions update the skill's decision table. Re-run monthly and on
  any `HOMA_IMAGE_MODEL` change. This is how "what models can do this
  month" stays true instead of vibes.
- A vision self-review pass inside the create tool: a cheap multimodal
  Gateway model looks at the rendered preview against the brief and
  returns a verdict + issue list to the agent before anything is
  delivered. On SMS, delivery is gated on the verdict, so a broken render
  never lands on a phone. The parent's critique remains the outer loop;
  self-review just catches what Homa can see herself.

### 4. The usage ledger: every Gateway call, attributed

- New `model_usage` table (append-only, deny-all RLS, server-only
  writes): family_id (nullable for system work), surface, channel, model,
  modality (text/image/embedding), token counts, image count + size,
  duration, session/turn ids. Raw quantities only, never dollar amounts
  (prices drift; the 08-billing margin review joins quantities to a price
  table later). This is the substrate `action_costs` and the credit
  ledger (M1-12/M1-13) will price against, built now, priced post-revenue
  per the standing sequencing decision.
- Capture points: an eve hook on `step.completed` (chat turns +
  compaction, all channels), plus instrumentation in every direct AI SDK
  call site (images, report/plan narratives, curriculum, memory
  extraction, embeddings, and the new vision review).
- Gateway-side attribution: every direct AI SDK call also sends
  `providerOptions.gateway.{user: familyId, tags: [surface]}` so the
  Gateway dashboard and `/v1/report` slice by family/feature and can
  cross-check our table. eve's own chat calls cannot carry per-family
  metadata yet (static providerOptions only); our hook covers them, and
  an upstream eve ask is noted.

## Tickets

### MS-1 · Generalize image generation (kill the "illustration" framing)

- Rename `lib/illustrations.ts` → `lib/materials/generate-image.ts`
  (start the `lib/materials/` module; `lib/print/*` moves there in MS-3).
  Function `generateStudioImage` (name says what, not worksheet-what).
- Add reference-image support: optional `referenceImageUrls: string[]`
  (max 4) flowing to AI SDK `prompt: { images, text }`. Security: accept
  ONLY URLs on our Blob host under `families/{callerFamilyId}/` (tenancy
  law + no model-directed server fetches of arbitrary URLs). Fetch bytes
  server-side, pass as data.
- Neutralize copy: refusal notes and tool description say "image", never
  "illustration"; description covers headers, coloring art, infographics,
  full pages, and reference-driven style matching.
- `generate_image` tool input: `prompt`, `shape`, `referenceImageUrls?`.
- Acceptance: reference-driven generation verified live (generate once,
  regenerate with the first output as reference, visible style
  continuity); tenancy rejection test (foreign URL refused with a
  model-readable note); typecheck/lint/build green.

### MS-2 · Image-direct printable path

- `create_printable` (rename lands in MS-8; until then create_worksheet)
  accepts exactly one of `html` or `pageImageUrl`. For `pageImageUrl`
  (same our-Blob-only rule as MS-1) the shell wraps the image full-bleed
  on the letter page, D7 footer intact, then the normal render/store/
  deliver pipeline runs. The stored row records `source: "image"`.
- Acceptance: an image-direct page round-trips to PDF + preview + row +
  (SMS) MMS with no HTML composed by the agent; gate still blocks
  scripts/brand-law violations in title/skill fields.

### MS-3 · Materials schema v2: metadata, lineage, finals

- Migration (table is one day old; verify zero rows via MCP, then rename
  `worksheets` → `materials`, else add-columns only and keep the name):
  `kind` (worksheet/coloring/flashcards/reader/poster/infographic/other),
  `subject`, `curriculum` (free text, e.g. "handwriting without tears"),
  `skill` (kept), `theme` + `characters text[]`, `tags text[]`, `source`
  (html/image/hybrid), `status` (draft/final/superseded, default draft),
  `revises uuid` self-FK, `approved_at`. Same RLS posture; isolation
  checks extended.
- Tool inputs gain the metadata fields (agent supplies from context;
  cheap to fill, load-bearing for retrieval). `revisesId` links versions.
- New `mark_material_final` tool: parent approval ("great, print 2
  copies") → agent finalizes → row goes `final`, chain ancestors go
  `superseded`, superseded draft BLOB BYTES are deleted (rows + html kept
  for the record and future reuse). Emits new `materials.finalized`
  event (registry + emitter, `pnpm check:events` green).
- Move `lib/print/*` into `lib/materials/` while touching everything.
- Acceptance: create → revise → finalize flow verified against homa-prod
  (drafts superseded, draft blobs 404, final intact); `pnpm
  check:isolation` green.

### MS-4 · Retrieval: `find_materials` tool + reuse flow

- Family-scoped read tool: filter by child, kind, subject, curriculum,
  theme/character, status (default final), returns compact rows (id,
  title, metadata, previewUrl, source, created_at). Caller-RLS on web,
  pinned path on SMS, same dual-mode as every other tool.
- The reuse loop this unlocks (taught in MS-8's skill): find the final,
  pass its `previewUrl` to `generate_image` as a reference (image path)
  or reuse its stored `html` with theme swapped (html path). Story's
  handwriting page becomes Amalia's in one step.
- Acceptance: live flow "make Amalia one like Story's letter-O page but
  with [her character]" produces a new draft that visibly inherits the
  format; retrieval never returns another family's rows (isolation
  probe).

### MS-5 · Vision self-review before delivery

- `lib/materials/review-artifact.ts`: one multimodal Gateway call
  (`HOMA_REVIEW_MODEL`, default a cheap vision model, e.g.
  `google/gemini-3-flash` tier; founder may tune) receives the rendered
  preview image + the brief (title, kind, skill, theme, the parent-ask
  summary the agent passes) and returns `{ pass, issues[] }`.
- Wire into the create tool: review runs after render, before delivery.
  Verdict and issues return to the agent in the tool result. On SMS a
  failing review blocks the MMS (agent revises instead of texting a
  broken page); on web the card still renders (iteration is visible and
  cheap) with the verdict attached. One review per create call, no
  auto-regenerate loops in code: the agent owns iteration.
- `materials.created` event gains `reviewed` + `review_passed` props.
- Skip switch: `HOMA_MATERIALS_REVIEW=off` for cost control.
- Acceptance: a deliberately-bad render (e.g. prompt-injected wrong
  character) fails review with actionable issues; a good render passes;
  usage of the review call itself lands in `model_usage` (MS-6).

### MS-6 · Per-family model usage ledger (can ship first, independent)

- Migration: `model_usage` append-only, deny-all RLS (learning_reviews
  posture): id, family_id nullable, surface (chat/compaction/
  materials_image/materials_review/report_narrative/plan_narrative/
  curriculum/memory_extraction/embedding), channel, model, modality,
  input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
  images_count, image_size, duration_ms, session_id, turn_id,
  provider_metadata jsonb, created_at. Isolation checks extended.
- `lib/model-usage.ts`: `recordModelUsage(...)`, fire-and-forget
  (analytics never break the feature, emitMapEvent posture).
- `agent/hooks/record-usage.ts`: `step.completed` (+ compaction event)
  → one row per model call with familyId/channel from session auth.
  Covers web chat, SMS, email, dispatch automatically.
- Instrument direct call sites: `lib/materials/generate-image.ts`,
  `lib/map/narrative-generate.ts`, `lib/map/curriculum-generate.ts`,
  `lib/learning/extract-memories.ts`, `lib/learning/embeddings.ts`,
  MS-5's review. Each also attaches
  `providerOptions.gateway { user: familyId, tags: [surface] }` (typed
  via `GatewayProviderOptions`).
- `scripts/usage-report.mts`: founder query CLI (per-family totals by
  surface/model over a date range from our table) plus a reconcile mode
  hitting Gateway `GET /v1/report` grouped by user to cross-check.
- Explicitly NOT in scope: credits, prices, caps, billing (08-billing
  sequencing stands: ledger prices land post-revenue). Telnyx Whisper
  transcription is not Gateway traffic; noted for a later row type.
- Acceptance: one chat turn, one worksheet with image + review, one
  report generation each produce correctly-attributed rows in homa-prod;
  reconcile script returns Gateway-side numbers for the same window;
  all four guards green.

### MS-7 · Calibration harness: teach the skill what models can do today

- `scripts/materials-calibration.mts`: a fixed brief set spanning the
  hard cases (dense-text handwriting page, tracing guides, coloring
  page, counting page with exact object counts, flash cards, themed
  header, reference-driven style match) × the three paths, rendered to
  `/tmp` + a dated markdown report with embedded outputs and notes
  under `docs/homa-planning/materials/calibration-YYYY-MM-DD.md`.
  Optional `--auto-score` uses the MS-5 reviewer for a first-pass
  verdict per output.
- Findings update the skill's path-selection table (each row dated).
  Documented cadence: re-run on any `HOMA_IMAGE_MODEL` change and
  monthly; add the check to the eve-version-bump-style runbook list.
- Acceptance: first calibration report exists with real outputs; the
  skill's decision table cites it.

### MS-8 · Rename + rewrite the judgment layer

- Tool rename `create_worksheet` → `create_printable`; UI touch points
  updated (web `message-parts.tsx` + card, mobile `message-utils.ts` +
  `message-view.tsx` + card; card label derives from `kind`: "Coloring
  page ready", "Worksheet ready", ...). Legacy localStorage transcripts
  keep degrading gracefully (previewUrl guard already handles it).
- Skill `worksheet-studio` → `materials-studio`: path-selection guide
  (from MS-7), reference discipline (find the final first, reuse before
  re-imagining), metadata discipline (always tag kind/subject/
  curriculum/theme), finalize discipline (approval → mark_material_final,
  never nag), self-review interpretation (how to act on issues[]).
- `agent/instructions.md` materials section + tool table rewritten
  around choose-the-path; `sms-mode.ts` wording updated.
- Acceptance: live loop on web chat end to end (request → path choice
  visible in behavior → draft → critique → revision → finalize);
  copy passes the no-em-dash/banned-words scan; homa-copy gates for the
  parent-visible card labels.

## Sequencing

1. **MS-6** first: independent, founder's explicit ask, and every later
   ticket's calls get born instrumented.
2. **MS-1 → MS-2 → MS-3** (the capability spine; MS-3's migration lands
   while the table is empty).
3. **MS-5**, then **MS-4** (review before retrieval so found references
   are trustworthy finals).
4. **MS-8** (rename + skill, provisional decision table).
5. **MS-7** (calibration; refines MS-8's table with evidence).

Rough shape: MS-1/2/5 are each half-day-ish; MS-3/6 carry migrations and
verification; MS-7/8 are the judgment work where quality lives.

## Open founder decisions

- **D-ms-1**: approve the renames (tool `create_printable`, table
  `materials`, lib `lib/materials/`). Recommendation: yes while row count
  is zero; this is the last cheap moment.
- **D-ms-2**: default review model for MS-5 (cheap vision tier vs same
  Sonnet as chat). Recommendation: cheap tier, env-swappable.
- **D-ms-3**: draft hygiene: delete superseded draft blob bytes on
  finalize (recommended) vs keep last N drafts.
- **D-ms-4**: upstream eve ask: per-session gateway `user`/`tags` on the
  agent's own model calls, so chat spend attributes at the Gateway too
  (our table covers it either way).
