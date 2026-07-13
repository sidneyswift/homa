# Build log — decisions agents made alone

Per BUILD.md: anything an agent was forced to decide without a founder ruling is
logged here so decisions stay auditable. Newest entries first.

## 2026-07-13 · The agent now sees every chart figure the parent sees (founder ask)

Founder ask (afternoon chat, screenshot): a parent asked "is Story really
-9 months below in self-care?" and the agent answered that it did not have
that figure. "Homa should know this. Fix the root cause and never let it
happen again." Root cause: the morning's founder ruling put the REAL signed
frontier distance on the trajectory chart ("Self-care -9 mo" via
frontierDeltaMonths), but the agent's per-turn map snapshot
(lib/family-context renderMapSnapshot) still rendered a below-age subject
as the bare word "growing", so the product showed the parent a number its
own agent could not see. Same class as the 2026-07-10 counting-page lesson:
two projections of one scorer, one updated without the other.

Fix, three layers. (1) The chart's value law moved into a shared helper
(chartMonthsForScore in lib/map/trajectory-format) that both the trajectory
story and the map snapshot call, so the two surfaces cannot drift again.
(2) Every scored subject line in the snapshot now carries "chart reads
X mo" through the chart's own formatter, and the snapshot's reading
guidance moved ahead of the per-child sections so the 4,000-character bound
can truncate data but never the rules for reading it; instructions.md
teaches the agent to confirm an on-screen number and explain it through the
working edge, never to disclaim the family's own progress data. (3) A new
CI-run parity guard (pnpm check:agent-context,
family-context-map-snapshot.test.ts) recomputes from the scorer what the
chart would plot and requires each figure verbatim in the rendered context.
Decisions made alone: the signed number enters the agent's context (data,
not parent copy; the instructions keep growth framing for what she reads),
and the previously orphaned family-context-security.test.ts, which no
script ran, now runs under the same new CI step.

## 2026-07-13 · Founder ruling: parent input about a child is never wasted (the observation ledger)

Founder ruling (2026-07-13 morning chat, "IMPLEMENT and ship"): ALL
parent input about a child's abilities is saved as something and/or
linked to progress, classified by its effect on scoring (none, raises,
lowers), and fed forward so Homa uses it for the family within the
week. Homa must not be blocked by our own system.

Trigger: the 2026-07-12 11pm Noser exchange. Sara reported Emma (3)
recognizing "chapter 11" in print; the journal matcher correctly
returned no_match (no bank item, and the clause attributed "read" to
the parent), but the only durable write was the operations audit row.
Homa replied "I'll hold that as a sweet moment" while holding nothing:
the family's Brain had zero memories. "Can't score it" was accidentally
doing double duty as "don't keep it."

What shipped (plan `plans/2026-07-13-observation-ledger.md`, tickets
OBS-1..5, all in this pass):

- **Migration `20260713134500_child_observations.sql`** (additive,
  applied to homa-prod ahead of the deploy per the additive-only law):
  quote, provenance, matcher classification, nearest-candidate items
  with scores, subject hints, and a new/used lifecycle. RLS members
  read, server-only writes; isolation guard extended and green.
- **Server-side capture, never model-optional:**
  `recordJournalProgressEvidence` writes the observation inside the
  same transaction as the operation receipt for every no_match,
  activity_only, and ambiguous outcome. The matcher now returns its
  top below-threshold candidates on no_match instead of discarding
  them. Replays cannot double-write (the idempotency claim
  short-circuits first). Scores are untouched: matched evidence
  remains the only way a score moves.
- **Same-turn contract:** the three non-scoring tool notes now say the
  report was saved as an observation and instruct the model to say so
  and offer one concrete way to build on it this week (at night, for
  the coming days). instructions.md and the SMS guidance carry the
  same behavior.
- **Reinforcement loop:** the morning-brief context block now carries
  the week's status-new observations (7-day window, 3 per child) next
  to each child's frontier, the research-brief skill makes a fresh
  parent observation the number-one angle, and a new
  manage_child_progress action `mark_observation_used` (valid on
  dispatch sessions; run id from trusted attributes) retires an
  observation so it is never suggested twice.
- **Founder visibility:** the family file's Brain tab gains an
  "Observation ledger" section (new/used, classification, nearest
  subjects).
- **Events:** `progress.observation_saved` and
  `progress.observation_used` join the MJ-08 registry with PII-free
  props.

Agent-decided defaults under the ruling (Q1-Q4 of the plan, founder
said ship): no web chat card for observation saves yet, admin-only
visibility for launch week, 7-day freshness with 3 per child in the
brief, and activity_only reports are captured too. Deferred
explicitly: back-crediting observations when a bank item later ships,
fleet-wide gap clustering, any parent-facing observations surface.

## 2026-07-13 · Morning-brief texts died on the carrier segment cap (emoji + UCS-2)

Founder ask (screenshot of three "Failed sms send · SMS send rejected"
alerts on /admin): investigate deeply and fix the root cause. All three
2026-07-13 morning briefs (Riley, Nouvelle, Swift) failed as texts and
fell back to email, which delivered.

Root cause, confirmed by replaying the send against the live Telnyx
API: the brief format's required 🔬 headline switches the entire SMS
from GSM-7 (153 chars per segment) to UCS-2 (67 chars per segment), and
Telnyx hard-rejects anything over 10 segments (HTTP 400, error 40302,
"The SMS message would be divided into N parts. The maximum is 10.").
The format spec approved 2026-07-11 carried a 1,600-character budget,
which is the GSM-7 view of the world; with the emoji the real ceiling
is about 670 characters. Today's briefs ran 755 to 830 characters (12
to 13 segments). The one emoji text that DID send today was 665 chars,
exactly 10 segments. Perfect correlation, no other cause in play.
The transport also logged only "HTTP 400" without Telnyx's error body,
which is why the alert could not explain itself.

Fix, three layers:

- `apps/web/lib/sms-segments.ts` (new, tested): GSM 03.38 segment math
  (`smsSegmentCount`, `fitsInOneSms`, `MAX_SMS_SEGMENTS`), verified
  against Telnyx's own "parts" numbers from the incident replay.
- `apps/web/lib/voice/telnyx-api.ts`: `submitHomaSms` now preflights
  text-only sends over the cap (precise rejection reason, no doomed API
  call), and reads Telnyx's error body on failures so the log line
  carries the provider's own code and title. Rejected submissions now
  carry an optional `reason`, and task delivery
  (`lib/conversation-continuity/task-delivery.ts`) writes it to the
  delivery ledger, so the /admin alert names the real cause instead of
  the generic "SMS send rejected".
- Producer contract: `research-brief/SKILL.md` now instructs a
  600-character budget and explains why, and
  `lib/tasks/research-brief-format.ts` enforces the true constraint
  (must fit one deliverable SMS via the shared segment math) instead of
  the flat 1,600 cap. Spec doc amended in place with a dated
  correction. The 665-char passing brief proves the format works at
  this size; the founder-approved four-block shape is unchanged.

Decision made alone: the emoji stays (founder-approved format); the
budget moved to fit it, rather than dropping the emoji to keep the
1,600-character budget. Email fallback behavior is untouched.

Verified: segment math matches live Telnyx verdicts (400/40302 red
replay, 200 green replay at 10 segments, both to the founder's own
number); `check:research-brief` includes a regression fixture at the
incident length; `check:continuity` green; lint, typecheck, eve build
green.

## 2026-07-13 · /admin alerts get a "Mark handled" check-off

Founder ask (screenshot of two long-since-fixed "custom run failed"
alerts still sitting on /admin): "these errors have been addressed.
please add a way I can check them to hide them from the ui." Built as
migration #81 `admin_alert_acknowledgments` (deny-all RLS + revokes,
the email_sends posture; applied to prod via MCP, additive so it may
lead the deploy) plus a founder-gated server action pair
(`apps/web/app/admin/actions.ts`), `lib/admin/alert-acks.ts`, and a
Mark handled chip on every row-backed alert (strip and trouble list).
Decisions made alone, conservative on each fork:

- **Hide, never delete.** An ack row hides the alert; the run counts,
  delivery counts, and pulse feed keep the failure. The page says
  "N handled alerts hidden" with a Show them link, and every handled
  row has a Bring back undo, so a mis-click is recoverable in place.
- **Re-failure resurfaces.** Task runs are terminal, so their ack is
  forever. Deliveries and email sends can fail again on the same row
  (retries, webhooks), so those acks only hide while newer than the
  row's updated_at.
- **No foreign keys** on source_id (three possible source tables); a
  cascade-deleted source leaves an orphan ack nothing joins back to.
- **Attribution**: acknowledged_by stores the founder email from the
  session, and the action gate is getFounderSession() (a nullable twin
  of requireFounder(), since server actions should fail with a result,
  not a thrown 404).
- The "call list" and stale-cron strips stay un-checkable on purpose:
  they clear themselves when the underlying state clears.

Verified: typecheck, lint, check:isolation (new table covered as
deny-all + insert probe), admin:smoke, and a Playwright pass on a dev
server with a fixture founder (ack → hidden note → Show them →
Bring back → re-ack), fixture family and acks deleted after.

## 2026-07-13 · Model prices go self-updating: the Gateway catalog overlays the pinned book

Founder ask, same session as the price book: "make it so we always have
the model costs up to date." Built as a live overlay, not a rewrite: the
Gateway's model catalog (310 priced models, per-token USD, including
Anthropic cache read/write rates) becomes the price source at read time,
and the hand-pinned table demotes to a fallback for outages.

- New `apps/web/lib/model-pricing-live.ts`: `gateway.getAvailableModels()`
  (already in the `ai` dependency, same credentials the app's inference
  uses, no new packages or keys) mapped to the price book shape, cached
  in memory 15 minutes, refreshed at most once per interval. Callers
  wait at most 5 seconds on a cold fetch, then get the last good book or
  the pinned table; a late fetch still lands for the next reader. Every
  book names its source ("gateway" or "pinned") and fetch time.
- Pricing functions take `{ at, rates }` options; all four admin data
  layers price with the live book. The overview tile appends "gateway
  prices" or "pinned prices"; the session Bill section says which prices
  did the math and when they were checked.
- New guard `pnpm check:model-pricing`: FAILS when any model with
  recorded `model_usage` rows is unpriced by both live catalog and
  pinned table; WARNS with a paste-ready row when the pinned fallback
  drifts from the gateway (drift never fails, live already overrides).
  Runs coverage against pinned alone when the gateway is unreachable.
- Decisions made alone: a new model on the gateway prices automatically
  with no code change (the "up to date" ask); pinned dated windows (the
  Sonnet 5 2026-09-01 rise) only matter during outages since the gateway
  reflects changes itself; per-MTok conversion rounds at 8 decimals so
  float artifacts (0.0000002 x 1e6) never hit display or drift checks.
- Verified live: catalog fetch matches the pinned table exactly today
  (drift check clean), usage report prints "gateway prices, fetched
  <time>" with a $32.64/7d fleet total, simulated network failure
  engages the pinned fallback with a console warning, and the catalog
  endpoint even tolerates a missing/expired token (auth gates inference,
  not the price list), so the fallback covers true network failure only.
  check:admin 31 tests, typecheck, lint, full next build all green.

## 2026-07-13 · Console dollars: the model price book joins the usage ledger at read time

Founder ask: convert all token usage across the app into USD, model-aware
(input vs output rates, several models per session). Built as the read-time
price join the ledger was designed for (model-usage.ts / migration #43 both
say quantities only, prices join later), NOT as M1-13: the action_costs
registry and margin view stay a separate billing-grade ticket. These are
monitoring estimates; the Gateway invoice is the source of truth.

- New `apps/web/lib/model-pricing.ts`: provider list prices in USD per
  million tokens for every model in the live ledger (checked 2026-07-13):
  claude-sonnet-5 (with the 2026-09-01 price rise as a second dated window,
  cache read + 5 minute cache write rates), gpt-5.4-mini, gpt-image-2,
  text-embedding-3-small. `estimateUsageCostUsd()` prices one model's
  quantities; `summarizeUsageCost()` sums across models; `formatUsd()` for
  the console. Unknown models return null and surface as "no price on
  file", never $0 (the 08-billing "no unpriced actions" rule applied to
  monitoring).
- Cache math decision, verified against live rows: the ledger's
  input_tokens INCLUDES cache_read + cache_write tokens, so the estimator
  prices uncached input = input - cache read - cache write, each bucket at
  its own rate. Without the split, chat cost overstates roughly 10x at our
  ~95% cache-hit traffic.
- Admin data layers now aggregate usage grouped by model (so each model
  prices at its own rates) and carry estimates: sessions list + session
  detail (per-line and total), fleet overview tile (was "pricing joins at
  M1-13"; now shows the estimated dollars and flags unpriced models),
  roster snapshots + family detail (cost28dUsd). `pnpm usage:report`
  prints per-line and total estimates.
- Decisions made alone: aggregated ranges price at the rate in effect at
  read time (a window spanning the Sonnet 5 price change drifts slightly);
  gpt-image-2 input prices at the text-input rate since reference-image
  input tokens are not separable in the ledger (reference-driven calls
  estimate slightly low); per-family roster cost adds $0 for unpriced
  models, the overview tile carries that alarm instead.

Verified: new model-pricing tests wired into check:admin (27 pass),
check:isolation, typecheck, lint, admin:smoke against live data, and a
live `pnpm usage:report --days 30` ($32.32 fleet total, hand-checked
against the sonnet math).

## 2026-07-13 · The trajectory chart becomes interactive; real negative months (founder rulings)

From the trajectory-chart comparison lab
(plans/2026-07-13-trajectory-chart-directions.html, built on Story's
real history re-scored under one ruler) and three explicit founder
rulings in that session:

- **Founder ruling, negative months**: "remove that rule. put the real
  data. if a child is below age put the - number." The chart now plots
  a below-age frontier at its real negative value (self-care reads -10,
  not a fixed "growing" slot); the y-axis extends below at-age with
  plain negative labels. Scoped to the chart: `monthsAhead` stays
  non-negative everywhere, and the new additive scorer fields
  `frontierDeltaMonths` (raw signed frontier minus age, uncapped) and
  `strongestObservedMonths` (the strongest item's anchor) carry the
  honest numbers. A subject whose only evidence is "not yet" still has
  no number: the ruling covers measured below-age frontiers, not
  unmeasured ones. BUILD.md law 4 amended; register row
  `trajectory-real-negative-months`.
- **Founder ruling, re-check marker removed**: the armed re-check line
  is gone from the chart; ReportSnapshot no longer takes plans.
- **Founder ask, interaction**: report-trajectory.tsx (server SVG) and
  chart-lightbox.tsx retired, replaced by trajectory-chart.tsx, a
  client component: at rest only this week's movers plus the strongest
  subject carry end labels and full color; a ranked legend card below
  the chart (the founder's "should have a card") lists every subject
  with its value and a "+N this week" badge and is the hover/tap focus
  control; a pinned subject opens a meaning box translating the number
  into the skill and the age it is typical ("typical around age 4½ ·
  Story is 3"), with the beyondScale "checklist stops here" chip.
  Capped values display as "15+". Dotted cross-basis stretches and
  their caption are unchanged.
- New pure module lib/map/trajectory-story.ts derives movers (net
  increases only, per the anti-guilt law: drops plot but are never
  headlined), below-age standings, and the caption the card now writes
  from data ("Math and language climbed this week..."), deterministic
  from the eras (the week window anchors to the newest scoring, not
  render time). lib/map/trajectory-format.ts keeps the client bundle
  free of @homa/core.

Decisions made alone, smallest-safe versions: the meaning box opens on
pin only (hover moves line emphasis, never layout); the week-one at-age
origin convention stays, so a below-age subject's first segment draws
down (trajectory-downward ruling covers it); stored era JSON that
predates the new scorer fields gets them filled by ledger rescoring
where possible, null otherwise, never invented. Subject report cards,
narrative, and email keep growth framing: the negative-months ruling was
made on the chart and this pass does not extend it further.

Verified: typecheck, lint, check:map (new below-age fixtures),
check:isolation, check:events, check:skills-targeting, check:taxonomy,
check:child-progress, check:progress-ui, next build, and browser
screenshots of the sample report and Story's live report at phone and
desktop sizes.

## 2026-07-13 · Chat redesign + attachments ship (approved refined design)

The founder approved the refined chat design (design round:
plans/2026-07-13-chat-directions.html; approved single design:
plans/2026-07-13-chat-refined.html, "Refined chat design: approved,
build it", with tape corners, handwritten photo captions, the compact
one-line day header, and the seconds count all kept). Built in this
pass:

- Attachments end to end (founder scope call: "everything SMS takes",
  saved with the child's records): migration #80 `chat_attachments`
  (additive, applied to prod via MCP before code ships, allowed to
  lead), family-scoped Blob upload token route `/api/chat/upload`,
  prepare/undo route `/api/chat/attachments`, a chat-side normalizer
  reusing the SMS lanes (captions, STT, Twelve Labs, mammoth, SheetJS),
  and marker lines (`lib/attachments/markers.ts`) that carry caption +
  blob URL through `conversation_messages` so scrollback re-renders
  media. New `chat.attachment_processed` event in the registry.
- Composer: + menu (photo or video, file), camera button, staged
  thumbnail chips with an x, browser downscale for photos (EXIF
  dropped, child-photo posture), the About-kid filing tag with a
  one-time plain-words hint, docked suggestion chips.
- Transcript: calmer soft-coral user bubbles, polaroid-style photos
  with Caveat captions, sage save receipts with Undo (delete removes
  the row and the blob), compact day labels ("Tuesday · July 14"), a
  top-edge fade, and the worked-for line ("Worked for N seconds")
  opening into plain-words steps mapped from tool calls.
- Spent progress cards read past tense ("You said: Easily"); stale
  options render as text, never as live-looking buttons (three reader
  gates flagged this).
- The snap card: new `ask_for_photo` tool renders a camera card; the
  full-dim rule lands exactly as ruled (history dims ONLY while a snap
  card is the live ask). Snapping stages the photo; nothing auto-sends.
- Copy went through the homa-copy-editor gate; 7 must-fixes landed.

Agent-alone calls, logged with rationale in
docs/notes/chat-redesign-attachments-implementation.md: the send queue
stays text-only (staged files hold Send during a running turn), save
receipts and worked-for seconds are live-session state (scrollback
shows media without them), chain findings ship sparse until tool
outputs carry summaries, and the snap card stages instead of
auto-sending (nothing sends until she sends). Guards at ship time:
isolation (with new chat_attachments probes), map, events, taxonomy,
skills-targeting, continuity, child-progress, progress-ui, lint, Next
build, and eve build all green. Known-unrelated: the concurrent
trajectory-chart session's SubjectScore change has three of its own
files failing repo typecheck; this build's files typecheck clean.

Founder instruction: "let me upload a pfp of each kid, and let's use
that as reference for picturebooks and other materials that are
personalized." This is the D4 capability (photo-personalized magic,
decided 2026-07-03 to ship day one "startup right"), so the D4 floor's
code half ships WITH it in this build. What landed:

1. Migration #75 (timestamp 20260713053000_child_photos, additive,
   applied to homa-prod via MCP ahead of the deploy): children.avatar_url
   plus families.child_photo_consent_at/_by, the dedicated consent
   screen's stamp.
2. The dedicated consent screen (D4's first floor plank): first photo
   attempt on /app/settings opens a consent card inside the kid editor,
   separate from signup as ruled. Copy went through both gates
   (homa-copy-reviewer, then homa-copy-editor; the art tool is named
   plainly, "never learns from the photo" replaced the ML word
   "trains"). Agreeing stamps who and when on the family; every photo
   write re-checks the stamp server-side.
3. Storage posture (agent call, logged for audit): kid photos live in
   Vercel Blob under families/{familyId}/children/{childId}/ with
   random-suffix URLs, the EXACT posture of every materials artifact,
   NOT the public avatars bucket (migration #29 deliberately scoped
   that to adults' own self-photos). This prefix is what makes the
   photo a valid generate_image reference through the existing
   isFamilyArtifactUrl wall with no new trust path.
4. Raw-photo TTL (agent read of D4's "short TTL on raws", logged for
   founder veto): raws are never stored at all. The browser downscales
   to a ~1024px JPEG before upload (lib/child-photo-prepare.ts), which
   also drops EXIF GPS metadata; the stored object is the parent-chosen
   reference itself, kept until replaced or removed. Replace and remove
   both delete the old bytes (the consent copy promises "removing
   deletes it, not just hides it", and the code keeps that promise).
5. Reference wiring: photoUrl rides the family context per child (both
   auth paths), get_children, and the pinned reader; generate_image's
   description and the materials-studio skill teach the move (child as
   an ILLUSTRATED character, never photorealistic, drawing reference
   only, never identification, offer-never-demand per I22, a sibling's
   photo never rides another kid's material uninvited). No face
   recognition anywhere, per the D4 floor.
6. The pfp also displays: settings kid rows, context switcher (all
   three hosts), kid page header and sibling switcher, progress
   switcher, planner chips, slash-composer menu, via one shared
   KidAvatar component (photo, else the toned initial).
7. Events: family.child_photo_consented and family.child_photo_updated
   (set/removed), ids only, registry + emitters, check:events green.

NOT code, flagged for the founder (D4's remaining planks are
paperwork): the executed no-training/no-retention DPA with the image
provider (OpenAI gpt-image-2 through the Vercel AI Gateway; API terms
already exclude training by default, the formal signed artifact is
still to do) and the standing unresolved ruling on private-by-default
minors' media (not invented here: the photo is never shared by the
product, it sits at an unguessable URL exactly like every existing
family artifact; if the founder wants kid photos behind auth-checked
serving, that is a follow-up ticket). Onboarding deliberately does NOT
offer photo upload (D4: consent separate from signup); settings is the
one door. Mobile app not touched.

Verified live against homa-prod with a disposable fixture family (auth
user + family + child created, then fully deleted including blobs):
consent card renders → agree stamps → photo picks, downscales, saves →
children.avatar_url points into families/{id}/children/ → passes
isFamilyArtifactUrl → generateStudioImage with the photo as reference
returns a real image (foreign-URL and foreign-family references both
refused with the model-readable note) → remove clears the row AND the
blob 404s. Both events landed. typecheck, lint, check:events, eve
build, full pnpm build all green; binder, progress-view, and kid-view
tests pass. One drive-by: family-context.ts read ctx.session.turn.id,
which the dynamic-resolver context type does not carry; now read
defensively with a null fallback (the concurrent deep-view session's
recorder accepts null).

## 2026-07-13 · Child photos ship behind the D4 consent screen (migration #75)

Committed by the deep-view session on behalf of the settings session
that built and verified it (its working tree passed typecheck, lint,
the full progress-UI and child-progress suites, check:events, and the
isolation guard together with the other 2026-07-13 streams; migration
#75 was already applied to homa-prod).

Children gain a parent-added profile photo: children.avatar_url plus
families.child_photo_consent_at (the dedicated consent screen's agree
moment), events family.child_photo_consented and family.child_photo_set
(ids only, MJ-08). Settings' kids card gets the photo field and consent
flow; one KidAvatar component replaces the initial-circle markup in the
sidebar, context switcher, kid pages, planner, slash composer, and
progress kid switcher (photo when added, tone initial otherwise). The
agent side: get_children and the pinned family context expose photoUrl
as a generate_image drawing reference with the instructions and skill
carrying the craft rule (illustrated, never photorealistic; reference,
never identification). Memories card copy: "you told her" becomes "you
told Homa" (2026-07-13 UX read).

## 2026-07-13 · Founder deep view: capture layer, family file, chat reader, session inspector, her screen

Founder instruction ("build 1 2 3, boil the ocean") over the deep-view
directions lab (plans/2026-07-13-founder-deep-view-directions.html). The
lab's five build-changing questions resolve to their recommended
answers by that instruction: full capture now, her-screen renders the
real parent components read-only, one chat reader mounted behind two
doors, keep captured data through beta, and this build lands ahead of
the night manager (whose /admin/chats it now provides).

1. Capture layer (migration #79, additive, applied to homa-prod ahead
   of the deploy; isolation guard green before and after). What Homa
   did not write down she could not show: agent_tool_calls (one row per
   model tool call, name + sanitized args + result, written by the new
   agent/hooks/record-tool-calls.ts on eve's actions.requested and
   action.result events), session_context_snapshots (the dynamic
   family/progress/continuity blocks each turn carries, deduped per
   session by content hash, written fire-and-forget from
   family-context.ts), family_memories.session_id (remember tool, both
   auth paths, and the background review loop now stamp provenance),
   and materials.generation (create_printable stores its input
   metadata, session, and review verdict beside the output). All writes
   follow the recordModelUsage law: telemetry never breaks the feature
   emitting it. Voice-call extraction stays unstamped (no session).
2. The family file: /admin/families/[familyId] grows tabs. Tasks (each
   schedule's actual prompt text, recipient, and run record), Chats
   (below), Brain (memories with provenance links, the newest injected-
   context snapshot, extraction audits), Materials (real previews plus
   the generation record), Progress (the family's own ReportSnapshot
   chart over re-normalized eras, live subject states, newest evidence
   quotes).
3. The chat reader (ruling D-nm-2, now registered in the §5 register as
   founder-full-chat-access): one thread component behind /admin/chats
   (family picker) and the family file's Chats tab; every channel, day-
   grouped in founder time, internal dispatch prompts labeled, x-ray
   chips linking any bubble to its session trace. This supersedes the
   shipped MJ-14 constraint that message content stays out of the
   console.
4. The session inspector: /admin/sessions unions message-grouped
   sessions with homa_task_runs so a run that died before eve started
   (the 2026-07-12 HookConflictError pair) still gets a row; the detail
   page interleaves context snapshots, messages, and tool calls in
   model order with the per-surface token bill, run outcome, and
   delivery receipts. Pre-capture sessions honestly show messages and
   outcomes only.
5. Her screen: /admin/families/[familyId]/screen renders the parent app
   for one family, founder-gated, read-only by construction (no actions
   wired, no impersonated JWT, founder-scoped reads through adminDb and
   the same pure loaders the app uses). Progress mounts the REAL
   ProgressView/ReportSnapshot over admin-fetched props (conflict
   actions hidden), Binder mounts the real BinderView, Tasks reuses
   TaskHistory with read-only schedule cards, Planner renders the week
   board read-only, Chat shows the family-visible thread. X-ray pins
   tables, session links, and provenance onto each tab.

Implementation notes for the record: adminDb (fetch_types off) cannot
serialize sql.array() or json parameters, so id lists travel as one
comma-joined text parameter split by string_to_array server-side, and
jsonb columns are read through ::text casts. agent_schedules.weekdays
reads via to_json(...)::text for the same reason. The isolation guard
gained deny-all read and insert probes for both capture tables (its
coverage check caught them before the migration applied, as designed).

Verified: typecheck, lint, eve build (agent modules changed), 94
continuity tests, check:admin (new sanitizer tests), production
isolation guard green after the migration, and admin:smoke extended to
every new data module running green against production (counts only).
Ships together with the trajectory-chart entry below in one push; the
deep-view session verified both trees.

## 2026-07-13 · Trajectory chart mixed-scales fixes ship (investigation 2026-07-12)

Implements all three fixes from plans/2026-07-12-trajectory-chart-mixed-
scales-investigation.md: the chart was drawing scores from different
measurement regimes (bank, scorer rules, recorded birthday) as one line.

- Fix 1, basis stamps: migration #78 (20260713050000_report_measurement_
  basis.sql, additive, nullable) adds scorer_version, scored_birth_date,
  scored_age_months to child_reports. createReport writes them and
  archives them into each history snapshot; the flag-on compatibility
  update in saveDerivedProgress stamps them too. MAP_SCORER_VERSION now
  lives in packages/core/src/map/scoring.ts ("map-score-v1", matching
  what check-in snapshots already stored) and the check-in service
  imports it, one constant for every stamp. Applied to homa-prod ahead
  of the deploy per the additive-may-lead law; columns verified present.
- Fix 3, re-normalize at render: new pure module apps/web/lib/map/
  trajectory-eras.ts reconstructs each archived era's answer set from
  child_progress_evidence as of that era's timestamp (latest active row
  per item; supersession-aware, so corrections and retractions replay
  honestly) and rescores it under the CURRENT bank + scorer + birthday.
  getReportByToken and the live Progress page both serve the chart these
  eras; the sample page pins its own single-basis eras. Replayed against
  Story's production archive + ledger (read-only): all three scoring
  events re-normalize to one basis, the music +24 to +15 cliff and the
  birthday shift disappear from the line, and hasScaleChange reads false.
- Fix 2, honest boundaries: where adjacent eras still carry different
  basis fingerprints (pre-ledger archives), the connecting stretch draws
  dotted (report-trajectory segments) and one caption under the chart
  explains it. Caption passed both copy gates 2026-07-13; the editor
  gate moved it below the chart to keep the card body inside its
  two-sentence budget.

Decisions made alone, smallest-safe versions:
- The live era is never rescored: its stored scores are canonical, and
  a stale ledger (flag-off writers do not append evidence) must never
  move the headline numbers. Only archived eras re-normalize.
- An era whose reconstruction comes back empty keeps its stored numbers
  and stored basis (the investigation's "eras older than the ledger"
  rule); an unstamped archive fingerprints as unknown, which never
  equals the current basis, so unprovable continuity draws as a
  boundary rather than as one line.
- Movement chips and the evidence page still read stored history
  (provenance surfaces, not trajectory); fix 4's data hygiene (the two
  empty duplicate Story rows, preserving superseded rows under bulk
  mirrors) stays open.
- The ReportSnapshot boundary test lives in components/progress/ (added
  to check:progress-ui): Node's test runner reads the report route's
  [token] directory as a glob class and cannot address files inside it.
- The trajectory-eras unit tests joined check:map's command.

Verified: typecheck, lint, check:map, check:child-progress,
check:progress-ui, check:events, check:skills-targeting, check:taxonomy,
and the disposable PostgreSQL E2E (its harness schema gained the three
columns) all green. check:isolation passes every check that existed
before this session; its coverage assertion currently fails on
agent_tool_calls + session_context_snapshots from the parallel
founder-deep-view migration in this working tree, which this change does
not touch.

## 2026-07-13 · Run now on every scheduled task (founder ask)

Founder ask: "Add a button and the ability to run the task now on any
scheduled task." Shipped in the task editor dialog: a Run now row for
every saved task, built-in or custom, that starts one immediate run and
leaves the schedule alone.

How it runs: eve's send() only exists inside the runtime, so the tasks
page reaches it over HTTP, the same posture as lib/harness/
resume-session.ts. A new POST /eve/v1/dispatch/run-now route on the
dispatch channel starts the session; the runTaskNowAction server action
calls it on the deployment's own origin. The message builders and the
session's auth identity moved from the schedule file into
lib/tasks/dispatch-input.ts so both doors wake the agent identically;
manual runs tell the model the parent just asked (never "it is this
family's ... moment") and ride homa_task_runs with scheduled_for null,
which the partial outbox index ignores, so a manual run never collides
with or blocks the day's scheduled run. advanceTaskSchedule is never
called: next_run_at, the paused switch, and the outbox all keep their
meaning. No schema change.

Decisions made alone, smallest-safe versions:
- Auth: the route is gated by CRON_SECRET (already set in prod and dev),
  the same internal-trigger trust boundary as the Vercel cron, so the
  feature ships dark nowhere. The posted familyId is trusted only
  because the caller holds the secret; the server action derives it from
  the caller's OWN membership and every query re-scopes taskId by it.
- A paused task may Run now (the click is the parent's explicit ask; the
  switch governs the schedule). An enabled=false row refuses with a calm
  note (an ineligible brief has nothing real to say), and a dark kind
  flag refuses too.
- Throttle: one 'running' run per schedule at a time
  (hasRunningTaskRun); no daily cap beyond that. Revisit if manual runs
  show up in model-usage costs.
- The journal's origin-claim line and the brief's "this morning's" become
  honest on manual runs ("about today" / "today's brief").

Copy passed both gates 2026-07-13 (reader, then editor): the helper line
names History as where the result lands, refusal notes share the "This
task can't run yet." opener and each carries a next step. Verified: new
dispatch-input unit tests plus overlay contract tests (check:tasks-ui,
wired into that script), typecheck, lint, eve build, check:events,
check:continuity, check:isolation, and a live smoke against the real dev
agent + homa-prod (synthetic family, save-only delivery, cascade
cleanup): run accepted, second click refused, run finished done with
composed text, scheduled_for null, next_run_at untouched. Housekeeping:
the expired VERCEL_OIDC_TOKEN in apps/web/.env.local was replaced via
vercel link + env pull (same fix as 2026-07-10) so the dev agent could
compose.

## 2026-07-13 · Settings de-clunk pass from two interface reads

Founder reaction to the shipped consolidation ("idk if the settings ui
is clean and simple enough, it seems complex and clunky"), routed
through homa-uxui-reviewer twice on the settings direction lab's
fixture screens (phone, one pass each: the one-roster structure and the
denser one-sheet). Verdict kept the structure: both merged layouts
passed the persona's three-second test, so no rooms, no sub-navigation.
The clunk was five specifics, all fixed in place: (1) one row grammar,
family details now rests as label-and-value lines with one Edit and its
five always-open inputs moved behind it (closing on save, the section
pattern), and the homeschool summary's Edit moved trailing-right like
every people row; (2) the "Main account" tag and its explainer sentence
render only for multi-adult families (or with an invite pending);
(3) multi-adult families get one quiet rule line, "Each parent edits
their own info.", so a co-parent row without Edit stops being a silent
dead end; (4) the Text Homa pill carries whitespace-nowrap so the
number can never split across lines; (5) the memories source label
"you told her" became "you told Homa" ("her" pointed the reader at the
child one row up). New micro-copy (the rule line, "None yet." on an
empty address) written to the rulebook; gates not rerun for two short
lines. Verified: web typecheck, lint, and the Next build. The reviewer
findings that need product work beyond settings (correcting a memory
instead of deleting it) stay follow-ups, routed to chat.
## 2026-07-12 (late evening) · Settings consolidates to one family card (founder direction)

Founder reaction to the settings-directions lab
(plans/2026-07-12-settings-directions.html): merge the cards, phones
belong to parents, no Text-with-Homa card, time zone derives from the
address, surface the onboarding homeschool answers and kid preferences,
tag the main account. Shipped as one "Your family" card with sections,
plus the memories card:

- Kids: each row now shows interests; the editor adds the profile the
  agent reads (interests via the shared TagInput, focus, notes), the
  same children.profile keys onboarding's extras beat and chat's
  update_child_profile write. Full-replace merge preserves unknown keys.
- Parents: each adult row carries photo, email, and their own cell;
  the signed-in adult's editor saves name, photo, AND number together
  (updateMyProfileAction + syncMyPhone: add-then-retire so each adult
  keeps one number; taken numbers hand back the verified claim). The
  family's first adult wears a "Main account" tag surfacing migration
  #72's ruling (task texts go to the account owner), with the plain
  sentence above the list. Homa's number is one Text-Homa line here;
  the texting card is gone. Pre-attribution numbers render as "Linked
  number" rows with the two-tap Remove.
- How you homeschool (new): families.context styles / strictness /
  curriculums / values, read via getMyFamilyHomeschool and written via
  the same saveFamilyContext onboarding uses; labels extracted to
  lib/homeschool-styles.ts so both surfaces share one vocabulary.
- Family details: name + address; the time zone is now a quiet
  read-only line with a rare-path Change (save-on-pick). It fills from
  the device (TimeZoneSync, unchanged) and now from the address:
  timeZoneFromState covers whole-zone states only (split states
  deliberately absent), fills when empty, and follows a move into a
  single-zone state (updateFamilyDetailsAction). Founder ruling, same
  night: the "occasional real piece of mail from Homa" sentence in the
  address helper reads as creepy, removed; the state-rules reason
  stands alone (supersedes the 2026-07-12 reader-gate note that asked
  the copy to cover the street-address ask).
- What Homa remembers: lede now names the differentiation (Homa's own
  notebook from chats and calls) vs the parent-stated profile and
  homeschool answers above it.

Decisions made alone: kids stay FIRST inside the card (the founder
example read "family, parents, kids" but the 2026-07-12 UX gate's
headline finding was the kid errand, one-line to flip); removing
another adult's attributed number left the UI (each adult manages
their own; legacy rows keep Remove); "Main account" as the tag wording;
split-state families keep device-captured zones rather than guessing.
Copy gates were NOT re-run this round: most strings reuse already-gated
onboarding copy verbatim, and the few new lines follow the rulebook;
run reader + editor before the next deploy if wanted.

Verified: web typecheck, lint, next build, eve build, check:isolation
all green after the change.

## 2026-07-12 (evening) · Settings redesigned: kids visible and editable, per-member photos (migration #74)

Founder ask: review /app/settings with finding-unknowns plus the UX and
copy gates, clean it up, add what a parent would miss. Both gates read a
fake-data replica (the Parker family) before and after; the headline
finding from round one was that a parent arriving to fix a birthday
could not even SEE her kids, the page only had an add form.

What shipped:

- Kids card leads the page: each child with a tone avatar, age, and
  birthday, editable in place (name + full birthday, validated by
  isValidBirthDate); the add-a-child form moved behind a "+ Add a
  child" disclosure. New updateChildAction writes through RLS (tenancy
  v0 update policy) with the family_id belt on top.
- Per-member avatars: migration #74 adds family_members.avatar_url
  (additive, applied to homa-prod before this code deploys; backfill
  matched the one existing family photo to its uploader via the
  owner-scoped bucket path). Each adult now edits their OWN name and
  photo on the parents card; the sidebar account row shows the
  signed-in adult's photo, never the uploader's
  (memberAvatarUrl in getAppData). Onboarding's saveFamilySetup now
  stamps the member row too. families/family_members stay deny-all for
  writes: new lib/family-profile.ts runs on the server-only connection,
  familyId always from the caller's own membership.
- Parents card shows each adult's sign-in email (server-only
  getFamilyMemberEmails join to auth.users; co-parents joined by
  emailed invite, addresses are not secrets inside the family). Round
  two of the UX gate: a bare "Ben" row beside an invite form read as
  "is Ben set up?".
- Texting card: rows are now "Sidney's phone" over the digits
  (member_user_id join), Homa's number is a tappable "Text Homa ·
  (number)" sms: line, and Remove is two-tap (ConfirmRemoveButton,
  "Remove" then "Remove?"), also used by the memories card.
- Family details card (new): family name, address (the reason names
  both uses: state rules AND real mail, reader-gate finding), city /
  state / ZIP, one Save. Time zone is its own card and saves on pick
  with a visible Saved status (round-one finding: picker + separate
  save button was a silent trap). One saving rule per card (round two).
- What Homa remembers: real card heading, one label logic ("from your
  chats" / "you told Homa" / "you told Homa at signup" / "from a phone
  call"), a named correction path (remove, then tell Homa in chat),
  and every fetched memory renders (the reader gate refused "6 of 14,
  ask in chat for the rest").
- Page is one column (max 720px), sorted kids, parents, texting,
  family, time zone, memories; footer shows "Signed in as {email}" +
  Sign out. Old add-child-form.tsx and time-zone-card.tsx deleted.

Decisions made alone: per-member avatar as an additive column with a
path-match backfill (1 of 1 family photos matched); member emails
readable inside the family; two-tap Remove instead of a dialog; no
child delete in the UI (no DELETE policy exists; deliberate, a rare
support-path action); billing/subscription stays off the page while
the wall ships dark (plans/2026-07-11-the-wall.md owns it).

Both copy gates ran in order on the final strings (reader, then the
homa-copy-editor craft gate): the editor pass retired the "does it" /
"didn't take" idiom tics page-wide (including the onboarding copy of
the phone error), split the invite disclosure into one idea per
sentence, fixed the ambiguous photo-error pronoun, renamed the
memory-source chips to one non-overlapping vocabulary ("you told her"
/ "Homa noticed" / "from signup" / "from a call"), and unified cell
number wording, progress labels ("Adding…"), and short-month dates.

Verified: check:isolation (before and after schema change), web
typecheck, lint, next build, eve build all green; migration #74
applied to homa-prod and backfill counts checked (1 member photo, 7
member rows). Deploy order note: the migration ALREADY leads the code,
so the next push is safe on its own.

Founder call after the one-thread exploration: "we are overcomplicating
the chat", then approval of the minimal cut, implement and ship. The
chat is just a chat: one synced thread, everything flowing in with
source tags, scroll, and a centered back-to-now arrow. No Chats
sidebar, no timeline rail, no pickup chip tonight (all shelved in
plans/2026-07-12-one-thread-refined.html if long threads ever need
them).

What shipped:

- lib/chat-history-model.ts + lib/chat-history.ts: the per-adult
  scrollback read, under the CALLER'S OWN JWT. Three slices:
  my member-attributed rows, Homa's replies in my sessions (assistant
  rows carry no member attribution by design, sessions tie them back),
  and messages delivered to me (conversation_deliveries: briefs, task
  results). Single-adult families also claim legacy pre-attribution
  rows; in multi-adult families those stay hidden, the privacy-safe
  direction under chat-privacy-per-adult. Merged, deduped, capped at
  240; any error returns null.
- app/app/page.tsx passes the history to the client;
  app/app/chat-client.tsx renders it as the archive instead of the
  localStorage cache (which stays as the fallback AND the live-session
  resume mechanism; the live session's own rows are excluded from the
  server slice to prevent double render). Kill switch:
  HOMA_CHAT_HISTORY_DISABLED=1 restores the previous behavior whole.
- Source tags (transcript-days.ts sourceLabelFor + chat-client chip):
  "Texted", "By email" under the parent's own bubbles, "From Homa's
  tasks" under scheduled output, shown where the surface CHANGES, one
  tag per run. Persona-review rule kept: never a device tag under
  Homa's plain replies.
- Back to now: one centered round arrow floating over the transcript's
  bottom edge, visible past 600px of scrollback.
- recall.ts chats arm: excludes other adults' member-attributed user
  rows (their own words never surface in this adult's recall).

Decisions made alone: the 240-message render cap (recall covers the
deep past); "From Homa's tasks" as the dispatch tag wording (matches
the Tasks tab, the product home of scheduled work); legacy null-member
rows resolve to the adult only in single-adult families.

Follow-ups, owned by the M1-02 policy slice: tighten the family-wide
SELECT policy to per-adult (expand-contract, isolation guard both
sides); per-adult filtering for the semantic recall RPC and the pinned
(SMS) recall path; assistant-row attribution for multi-adult legacy
sessions; the mobile app twin still renders from its local cache;
no realtime cross-device updates mid-page (reload picks them up).

Verified before push: new model tests (10) and transcript label tests,
check:progress-ui (115), check:isolation, web typecheck, lint, next
build, eve build. Founder-account data sanity: 2 family members, 15
attributed rows, 54 legacy user rows (hidden until attribution effort,
multi-adult family), 141 family-visible messages.

## 2026-07-12 · One thread, refined: the Chats synthesis (round three)

Founder feedback on the one-thread navigation lab: the moments panel
wins but is named "Chats" (moments is ambiguous); combine it with the
timeline rail, the Homa-navigates pills, and the source tags on
bubbles. Per the exploring-ui-directions converge step, one refined
direction now lives at
plans/2026-07-12-one-thread-refined.html, superseding the two
comparison labs from earlier today (2026-07-12-chat-history-directions
.html and 2026-07-12-one-thread-navigation-directions.html, kept as
history).

The synthesized shape, all navigating ONE continuous per-adult thread:

- Chats panel: side panel on desktop, slide-up sheet on phone;
  auto-titled conversations OF the one thread; whole card goes there,
  Pick up arms the composer; search lives at the top of the panel.
- Timeline rail: one labeled dot per day on the thread's edge, day name
  on touch before commit, sticky after landing; calendar for the deep
  past.
- Pick up feedback: one green Continuing chip above the composer,
  dismissible, surviving time jumps; the composer hint re-aims to the
  picked-up conversation.
- Source tags: chips only when the surface changes and only under the
  parent's messages (Homa's bubbles carry tags only for briefs and task
  results).

Founder trim (same evening, on screenshots of the build): the pills row
(Finish / Pick up / Catch me up) and the "What does Homa see?" peek were
CUT, and Back to now became a small centered round arrow floating over
the thread's bottom edge. Pick up now lives only in the Chats panel,
indicated by the one Continuing chip. Noted for later: the persona
reviewer had called the plain-speech peek the most trust-building
element of the round; its content is a candidate to resurface behind a
tap on the Continuing chip if trust questions come back in testing.

Same evening, two more founder calls on the build: (1) the desktop
Chats panel is a docked full-height sidebar on the chat column's right
edge (not a floating card) and the Chats button is a borderless ghost;
(2) the first nav tab reads "Chat", not "Ask" (registered as
nav-chat-label, superseding nav-labels-simplified for that one label).
The label change was applied to PRODUCT code, not just the lab:
apps/web/components/dashboard/sidebar-nav.tsx APP_NAV_ITEMS, which the
marketing Nav's signed-in phone menu reuses. The /app page metadata
title was already "Chat". No route change; /app stays the chat's home.

Ruling watch: the Chats panel navigates the one thread (cards scroll
it, Pick up aims the composer); it creates no separate transcripts, so
the 2026-07-10 fresh-mornings-one-thread ruling STANDS unamended, and
chat-privacy-per-adult (same day) governs whose rows render.

Persona gate on the refined build (before the trim): verdict yes ("if
this shipped as my chat tomorrow I'd be happy"); her five fixes were
applied in the lab (single persistent Continuing indicator, landing
offset so the target sentence is never clipped, the two taps on a chat
row explained in one line, panel titles wrap instead of truncating,
device tags removed from under Homa's bubbles). After the trim, 29
automated browser checks pass, zero console errors.

Open toward implementation, awaiting the founder's lab reply: the five
build questions (pickup context shape, tasks-in-thread rendering,
arrival position, cross-adult memory use, search scope). Build order
after that: M1-02 render source with the per-adult filter and policy
tightening, episode auto-titles (schema), then the panel, pills, and
rail as client work over those reads.

## 2026-07-12 · Founder ruling: chats are per-adult, everything else stays family-shared

Founder ruling, verbatim intent (answering the one-thread navigation
lab's question 4, plans/2026-07-12-one-thread-navigation-directions.html):
"we def need per adult filtering. chats should not be visible by family.
only by user. it should be shared family everything else. but not chats."

Policy as registered (`chat-privacy-per-adult` in journeys/10 §5): an
adult sees only their own conversations with Homa, on every channel:
their web thread, their texts, their email replies, and the messages
Homa addressed to them (briefs, check-ins). No family member reads
another adult's chat, in the transcript, in search, or through recall.
Everything else stays family-shared: progress, memories, materials,
planner, tasks. The coherent consequence for Homa's memory: distilled
shared state (family memories, ChildProgress) crosses adults; raw chat
lines do not.

Where reality stands today, honestly:

- The shipped UI is per-adult by construction already: transcripts
  render from localStorage keyed by user id, so no surface shows
  another adult's chat today.
- The data layer is NOT: migration
  20260711150308_conversation_continuity_hardening.sql gave
  conversation_messages a family-wide SELECT policy (visibility =
  'family' and is_family_member), and the recall tool searches
  conversation_messages under the caller's token, so Homa could quote
  adult A's chat to adult B in a recall answer. That gap is now policy
  debt, owned by the M1-02 slice.
- The filter is buildable: conversation_messages carries
  member_user_id, and the delivery ledger is already per-recipient.
  Legacy rows with null member_user_id need an attribution decision
  (account owner vs hidden from everyone).

Follow-ups this ruling creates (M1-02 scope grows):

- The merged-thread render source filters to the caller: own
  member_user_id plus deliveries addressed to them.
- The conversation SELECT policy tightens from family-wide to
  per-adult: a breaking policy change, expand-contract order, isolation
  guard before and after.
- recall.ts: the conversation arm filters to the caller;
  family_memories and other shared state stay family-wide.
- Continuity already keys episodes and open loops by member; verify no
  cross-member episode bleed in context injection.
- OPEN (added to journeys/10 §5 open decisions): whether voice-call
  transcripts follow chat privacy (per-adult) or stay family-readable.
  voice-retention (2026-07-09) set storage and retention, not
  visibility.

Lab updated in the same sitting: question 4 became settled policy and
its successor question asks whether Homa may use one adult's chat when
talking to the other (recommended: shared facts only, matching this
ruling).

## 2026-07-12 · Founder console ships whole: /admin, ledgers, webhooks, heartbeat (MJ-14)

Founder instruction on the founder-dashboard direction lab
(plans/2026-07-12-founder-dashboard-directions.html): "DO IT ALL BOIL THE
OCEAN." So instead of one winning direction, all four shipped as tabs of
one env-allowlisted console, and every blind spot the lab named got its
instrumentation closed the same sitting.

What landed:

- /admin (apps/web/app/admin/): Overview (alert strip + live tiles +
  trouble + call list, 7d/28d), Families (derived-stage roster + filters
  + per-family page), Pulse (day-grouped operations diary), Funnels
  (event funnel, delivery pipeline, weekly cohorts). Own segment, never
  in APP_NAV_ITEMS; requireFounder() (HOMA_ADMIN_EMAILS allowlist,
  fail-closed notFound) gates the layout AND every page.
- Lifecycle stages are DERIVED (lib/admin/stage.ts, tested): new,
  onboarding, activated, steady, quiet 14d+ from profile_completed_at,
  children, child_reports, and last user message; families.status stays
  untrusted per the lab's blind spot 3.
- Migration #73 (additive, applied via MCP before push): email_sends
  (map-flow email ledger, deny-all), cron_runs (hourly heartbeat,
  deny-all), families subscription mirror columns. Isolation guard
  extended to cover both new tables; full guard green.
- lib/map/email.ts submit() now writes one email_sends row per map-flow
  send (report, resume, reminder, retest, band-ready, invite, digest);
  task emails stay out (conversation_deliveries owns them, no double
  counting).
- Webhooks, both DARK until secrets exist: /api/email/webhook (Resend,
  svix HMAC verified in lib/email-webhook.ts with tests) upgrades
  email_sends and escalates bounced task deliveries to failed;
  /api/billing/webhook (Stripe) is the closed-tab-checkout safety net
  (idempotent startFamilyTrial) and mirrors subscription status onto
  families.
- /api/map/cron writes a cron_runs heartbeat every tick and sends the
  once-per-UTC-day founder digest (HOMA_ADMIN_DIGEST_EMAIL, hour
  HOMA_ADMIN_DIGEST_HOUR_UTC default 11) with the email_sends ledger as
  its dedupe guard.
- pnpm check:admin (stage + webhook-signature tests) and pnpm
  admin:smoke (counts-only live query smoke) added; README repo map and
  .env.example updated.

Decisions made alone, biggest first: lib/admin/db.ts exists because the
Supabase transaction pooler deadlocked postgres.js under concurrency
(verified by probe: max 2 with three parallel one-row selects hangs
forever; pipelined batches on one connection hang too; an array_agg
type-OID fetch mid-pipeline was one trigger). The console therefore uses
ONE connection, strictly sequential awaits, ::text/::int casts, and
json_agg over array_agg; the rule is documented in the module header.
Product code keeps mapDb(), but any existing Promise.all over mapDb
deserves an audit with the same probe. Other calls: gate by email
allowlist (lab question 2 REC), live queries with no rollups (question
5 REC), digest email as alert v0 (question 3 REC), roster scoped to
families with a family_members row (one-world funnel visitors belong to
Funnels, not the roster), and message content stays out of the console
(counts and receipts only).

Verified: typecheck, lint, check:events, check:isolation (with the two
new tables covered), check:admin 14/14, admin:smoke green over live
data, next build green, and a Playwright walk over a real signed-in
session: all five surfaces render live production data, signed-out
/admin and subroutes 404, phone viewport has no horizontal overflow,
zero page errors. Deploy order note: migration #73 is already applied
(additive may lead); the code can push whenever.

## 2026-07-12 · Binder gets subjects, an honest this-week cover, and a first-day empty state (FS-1/2/4)

Founder: "ship everything else you would ship" from the portfolio-review
plan's Wave 0. Three tickets landed together:

- FS-1: a Subject chip row (case-insensitive grouping over the free-text
  subject metadata, first spelling wins, alphabetical, capped at 10) next
  to a now-labeled Type row; the cover shows the trailing week's keepers
  under "This week" and falls back to "Newest" when nothing is that
  fresh, so the label never lies. New pure helpers (subjectOptions,
  binderCover, noResultsMessage) in lib/materials/binder.ts, 20 tests.
- FS-4: the empty state names the keep gesture ("when you tell Homa that
  something she made is a keeper"), previews the kind vocabulary as
  faint pills, and ends in an Ask HOMA button to /app.
- FS-2: materials-studio SKILL.md gains a manipulatives section (offer a
  printable ten-frame or household stand-ins for early math, offer never
  lecture) and a letter-box recipe for box-based handwriting curricula;
  the calibration harness gains ten-frame and letter-box briefs.

Both copy gates ran on the new surface strings. Reader gate: five asks;
four implemented (one keep/kept/keeper vocabulary everywhere, a
first-day-true subtitle, a real chat door in the empty state, no-results
copy that names only the narrowing actually applied) plus the cover
label/heading agreement. The fifth (narrow by kid on the page) was
declined: the app-wide view-context switcher already owns per-kid
narrowing, the dispatch scenario simply had not shown it. Editor gate:
six must-fixes implemented (garden path cured with "that", cover
fallback pair agrees as "Newest", per-state no-results strings, Ask
HOMA casing per the test-pinned Progress precedent, one "things" noun
for counts, metaphor budget back to one) and all three suggestions
(fewer "Everything" openers, singular kind vocabulary in the preview
pills, "for the whole family" over "shared with").

Decisions made alone: the cover switched from a fixed newest-3 to
this-week-else-newest (the session's framing, kept honest); subject
chips read the existing free-text metadata rather than waiting on FD-6
vocabulary alignment; the editor's cross-surface finding that the
planner's "Ask Homa to adjust the week" button sits on the lowercase
side of D8 is parked as a follow-up rather than touched tonight; the
homa-uxui-reviewer screenshot pass was deliberately skipped for this
slice (the new rows duplicate the shipped chip pattern exactly) and can
run against production after the conference. FS-3 (curriculum context
injection) stays held past the conference on purpose: it changes what
the model sees every turn, the night before a live demo.

Verified: 20 binder tests, web typecheck, web lint, full next build (65
routes), and eve build, all green on this tree. A parallel session's
uncommitted work (desktop kid switcher, founder console) shares the
working tree; this commit stages only the binder/studio files and this
log's own entries.

## 2026-07-12 · Founder ruling: the desktop kid switcher is a top-right avatar; the rail keeps nav and account only

Founder, looking at the desktop rail's kid section: "the my kids tab is weird
on desktop... there should just be a pfp at the top right of the app just like
the mobile version to select kids on the pages that would benefit from it."
Shipped: `DesktopContextSwitcher` (context-switcher.tsx), the same avatar
button and menu the phone bar carries, floating at the viewport's top right as
a small white card, rendered by the shell so it persists across navigations.
Multi-kid families only (the phone bar's existing rule), and only on pages the
selection affects: the new `pageShowsContextSwitcher` (view-context.ts, tested
in view-context.test.ts) hides it on Tasks and Settings, the two /app surfaces
that ignore the view context. The rail's kid rows (`ViewingRows`) left the
desktop sidebar; the phone drawer keeps them via SidebarContent's explicit
`withViewingRows` switch (the drawer is the whole sidebar, founder call
2026-07-09, and the complaint named desktop). This supersedes the rail
placement from the 2026-07-10 "one kid list in the sidebar" ruling; the merged
one-control principle survives, the control moved corners. The shared menu id
became a useId value because both hosts stay mounted (CSS swaps them at lg),
so the old hardcoded id would have collided.

Calls made alone: single-kid families now see no kid control in the desktop
chrome at all, matching the phone bar (the old single-kid "My kids" link to
the kid page now lives only in the phone drawer; kid pages stay reachable by
deep link and by switch-on-page, and the Progress tab carries the day-to-day).
Chat's focus hint names one place now ("Change who you're viewing from the top
right.", the already-gated phone sentence; the desktop "from the sidebar"
variant retired) and renders only for multi-kid families, closing a
pre-existing dangling hint: a focused single-kid chat used to point phones at
a switcher that does not exist for them. Verified: progress UI tests, web
typecheck, web lint.

## 2026-07-12 · Task cards open an editor dialog; built-in schedules became editable

Founder ask (chat, with reference shots of a modal task editor): clicking a
task card on /app/tasks should let the parent update it. Implemented as one
dialog (`task-edit-overlay.tsx`, house focus-trap pattern from the Binder's
MaterialDetailOverlay) opened by every real task card and by "Add a task";
custom tasks get the full form plus "Delete this task", and the old card
footer links retired. Decisions made alone, sized to that ask: built-in kinds
(morning brief, evening check-in) became schedule-editable (days, hour,
text/email delivery) because the founder's visible cards ARE built-ins and the
dispatcher already honors per-row local_hour/weekdays/delivery_pref; their
label and prompt stay Homa's (vocabulary law, gated copy). Save-only ("none")
delivery stays custom-only: a built-in that only writes to the page would be a
check-in question nobody hears. The new `updateTaskSchedule` in
lib/tasks/custom.ts carries the rule for web and chat; `update_task` routes
schedule-only patches through it, so "move my brief to 7am" works in chat too,
and list_tasks' note now says movable, never renamed or deleted.

Both copy gates ran on the dialog strings. Reader gate accepted: the "Text me"
option now states the caller's own situation instead of a conditional rule
(the page reads family_phones on the server connection and swaps wording, plus
a "Set up texting in Settings" link when unlinked); the built-in dialog intro
names the fixed part, the changeable part, and where the off switch lives; the
card descriptions dropped their cadence words ("Every weekday morning",
"in the evening") because the schedule is now editable and the schedule line
under each card is the one place that says when; the custom-task example
became a research ask (reminders were teaching parents that reminders are all
Homa does); both dialogs ask the same plain "How should it reach you?".
Editor gate must-fix applied: the create flow keeps one name ("Add a task"
button and heading, "Add this task" commit, "Create task" retired); its
cadence-in-example suggestion applied ("Find one new phonics game and explain
how to play it."); the save-verb collision suggestion declined, "saved to this
page" is this surface's fixed vocabulary. Verified: web typecheck, lint,
isolation guard, eve build, and the Next build, all green. No rendered-UI
review ran; the dialog reuses house patterns and tokens only.

Same session, founder "test": the surface got its first UI tests
(`apps/web/app/app/tasks/tasks-view.test.tsx`, 8 tests in the progress-UI
style: static render, HTML contract). They pin the card-opens-dialog wiring
(aria-haspopup, editor closed on first paint, Edit/Delete gone from cards,
switch stays on the card), the per-kind dialog contract (custom: full form
plus "Delete this task"; built-in: schedule only, no rename or reword or
delete or save-only), the one-name create flow, the per-caller texting
wording swap, and the schedule label helpers. New root script
`check:tasks-ui`, wired into CI beside the research-brief check.

Founder ruling, same evening, on the live dialog: the built-in intro
("Homa decides what it says. You decide the days...") is out; the dialog
says one thing, what the task does, so it now reuses the card's own
one-line description from task-copy.ts. This overrides the reader-gate
line that named the fixed part, the changeable part, and the off switch.
Tests updated to pin the description and the explainer's absence.

Second founder ruling, same evening ("add web"): built-in tasks offer
all three delivery doors, text, email, or just the tasks page, which
supersedes this entry's earlier save-only-is-custom-only call. The
schedule schema, the web dialog, update_task, and list_tasks all take
"none" for every kind now; the dispatcher's journal and brief messages
tell the model its reply is saved to the page (never promising a text)
when that is the choice, and the card's schedule line names the
delivery for every kind. The delivery vocabulary stays "Just save it to
this page." / "saved to this page". Verified: tasks UI tests, web
typecheck, lint, eve build.

Third founder ruling, same evening: the evening check-in goes LIVE
(JOURNAL_PROMPT_ENABLED flips true) but ships switched off per family,
the parent opts in from the card ("keep it toggled off for users...
I might auto turn it on later"). Built-ins are the premade task set the
main account holder receives (recipients already owner-scoped by the
task-recipient ruling), and each kind now carries its own on/off
default: TASK_KIND_CONFIG gains seedPaused (journal true, brief false),
seeding stamps paused_at at insert only, and the parent's switch owns
it from then on (unpausing already recomputes next_run_at, so a
months-later opt-in never fires off the stale seed timestamp). The
journal placeholder note now reads "Almost ready. It stays off until
you turn it on." (both old notes promised it starts on its own, no
longer true; small copy, written to the rulebook, gates not rerun).
Order of operations for the flip: deploy this code READY first, then
set the env var and bake it with a redeploy, because the old code would
seed journal rows UNPAUSED on the next hourly tick. Verified before the
flip: prod has zero journal_prompt rows (nothing stale can fire), 9
tasks UI tests (a new one pins the per-kind defaults), typecheck, lint,
eve build. Flip verified after the 9pm tick: 4 journal rows seeded, all
4 paused, brief rows untouched.

Design pass, same evening (founder: "what would make this page 10x
better, then implement"). Scheduled cards now wear their state: the
icon sits in a disc (brand-soft when on, clay-100 when off, matching
the switch's own off color), the description mutes when off, and the
buried "next: ..." micro-text tail became a chip row: "Next · Mon,
Jul 13, 9:00 AM" in brand-soft when on, a quiet "Off" chip when not,
plus a subtle chevron and the app's standard press scale so tap-to-edit
is discoverable. History groups runs under one day label (Today,
Yesterday, then "Fri, Jul 10"), computed in the family's own time zone
(the 11:11 PM incident runs correctly group under their local day, not
their UTC day); each card keeps only its time, and summaries cap at
65ch for reading measure. The load-bearing footer ("Sent by text. Reply
there and Homa answers.") stays. New words are chips and day labels
only (Next, Off, Today, Yesterday), written to the rulebook, gates not
rerun; no new colors, type, or motion beyond existing tokens. 11 tasks
UI tests green (state chips and day grouping pinned), typecheck, lint.

Implements the founder-chosen refined direction in production code. The
Progress page (`apps/web/components/progress/progress-view.tsx`) is now a bare
header (freshness line, title, "Open the full report", and an in-page sibling
switcher reusing the kid page's pattern, the founder's "include the kid
switcher"), the report's own snapshot chart (`ReportSnapshot`, fed by the
child_reports history already on `getAppData`), and a subject tile map. Tiles
(`progress-map.tsx`) carry core's reviewed `subjectLine` badge vocabulary with
kidPill tones, the dashboard's positive-only movement rule, a freshness line
(quiet after 30 days, a call this log owns), and the existing "Please confirm"
chip. Tapping a tile opens `progress-detail-panel.tsx`: a bottom sheet on
phones, a right side panel on desktop, house dialog patterns (chart-lightbox
focus trap, mobile-nav scrim and transform-only entrance), containing the
unchanged domain and topic hierarchy plus two chat doors ("Sort it out with
HOMA" on conflicted subjects, "Something look wrong? Tell HOMA about {child}"
always). The stacked subject cards, the intro sentence, and the "Latest
information" badge retired; `progress-subject.tsx` deleted.

Inline conflict resolution shipped with the same change (founder ask): the
panel's two saved answers are now tappable, posting to the new authenticated
`POST /api/progress/conflict` route, which derives the family only from the
session (auth-context law), requires an attributed member, and calls the same
`resolveProgressConflict` service the agent uses (family-scoped lookup, member
lock, idempotency claim, answer validated against the conflict's own evidence
rows). Success refreshes the server view into the open panel; a closed-elsewhere
conflict (409/404) also refreshes so the view carries the truth; a failure shows
the copy-kit retry line and changes nothing. The panel's "Confirm with HOMA"
chat door retired because the tap IS the confirm; the hint line reuses the
report's "tap to..." pattern. The isolation guard passed live, including the
cross-family child-progress conflict mutation probes.
Verified: 112 progress UI tests (new `map-model.test.ts`,
`progress-detail-panel.test.tsx`, and `resolve-conflict-request.test.ts` joined
`check:progress-ui`), 270 ChildProgress tests, the live isolation guard, event
parity, web typecheck, web lint, and the Next build.

Both copy gates ran on the new strings. Reader gate accepted: "Shared earlier"
replaces the ambiguous "Older" chip, "HOMA asks later" plus a new body line
replaces "Ask me later" (whose turn), the conflict body no longer implies
deletion ("Both answers stay saved; confirming picks which one fits today"),
the confirm task carries one name ending in the "Confirm with HOMA" button,
and the ask-later chip dropped gold so gold only ever means "waiting on you".
Declined from that read: chart-internal labels (report-owned, gated earlier).
Editor gate must-fixes applied: one freshness verb everywhere (the quiet tier
keeps its gold dot but reads "Updated {date}", never "Last touched"), one chip
verb pair ("Shared today" / "Shared earlier"), and the panel footer link now
names its action standalone ("Tell HOMA something looks wrong"). Also applied:
"Updated today" without the redundant date. Declined with reasons: renaming
"Open the full report" (founder-named this morning), "Switch kid" (matches the
kid page's existing shared pattern), and deduplicating "Both answers are
saved." from the subject summary (reassurance stays adjacent to the first
mention of the disagreement; anti-guilt ordering outranks craft repetition).

## 2026-07-12 · Progress tab direction chosen: living report with a map (founder instruction)

The founder compared four Progress-tab structures in the disposable lab
(`docs/homa-planning/plans/2026-07-12-progress-tab-directions.html`) and chose
the living report, refined as follows: no subtitle under the "{Child}'s
progress" header, no note-from-Homa letter card, and subject tiles (the map
direction's grid) instead of stacked subject cards. Tapping a tile opens that
subject's domain and topic detail in a right-side panel on desktop and a
bottom sheet on phone. The refined single-direction prototype is
`docs/homa-planning/plans/2026-07-12-progress-tab-refined.html` (21 browser
checks passed, zero console errors; conflict confirm and the "Something look
wrong?" door live inside the panel, answering both reader-gate reviews).
Prototype only: no production code changed yet. Copy inside the prototype is
placeholder and must pass homa-copy-reviewer then homa-copy-editor when the
production build lands.

## 2026-07-12 · Founder ruling: no daily materials cap (create_printable)

Founder instruction in session, reviewing the portfolio-review plan's
FD-3 (series generation vs the materials rate limit): "no 20 a day
cap." Removed the 20-materials-per-family-per-day limit from
`apps/web/agent/tools/create_printable.ts` (the limit, its refusal
copy, and the now-unused rateLimited import). Scope read narrowly on
purpose: the ruling named the 20-a-day materials cap, so the
30-images-per-family-per-day limit in `generate_image.ts` and the
other per-family limits (email, voice hours, curriculum calls) stand
untouched. This overrides an agent-made limit from the 2026-07-10
materials build ("Limits without billing: 20 sheets + 30 images"), not
a founder ruling, so the reconciliation register is unchanged. Cost
visibility continues through the MS-6 model_usage ledger. The
portfolio-review plan doc was updated in place (context, I6, FS-6,
FD-3 marked RULED). Verified: web typecheck, web lint, and eve build
green.

## 2026-07-12 · Portfolio review session distilled into a ticketed plan

Founder supplied the 2026-07-11 family session transcript (Sidney,
Alessa, Carolyn: binder review, materials organization, curriculum
strategy, planner and logging, socials) and asked for insights,
tickets, and a simplest-to-most-complex attack plan. Wrote
`docs/homa-planning/plans/2026-07-12-portfolio-review-session-tickets.md`:
26 insights reconciled against current code and the ticket registry,
19 plan-local FS tickets across four waves plus a marketing lane, and
six open founder decisions (subject chips vs tabs, folder UX, series
cap policy, activity-log shape, curriculum copyright posture, subject
vocabulary alignment). Decisions made alone: ticket IDs stay
plan-local (FS-n, the T-n/RT-n convention) rather than minting M/MJ
rows, big asks are mapped onto their existing registry homes (T9,
M3-05/06, M2-10, M2-12, MJ-19, MJ-33) instead of duplicated, and the
order defers schema-bearing work until after the July 13 conference.
No product code changed. The new plan file will appear as a fresh
candidate in the documentation reconciliation audit, which is
expected.

## 2026-07-12 · Binder ships as a merged Direction 1 + Direction 2, first-release scope only

Founder asked to implement "a mixture of view 1 and view 2" from
`docs/homa-planning/plans/2026-07-11-binder-design-directions.html` as the
real `/app/binder` tab. That doc pre-answered five build-changing questions
with recommendations (name "Binder", one Binder that follows the existing
family/child view context rather than a second switcher, "this week" as the
default landing, a sidebar tab, and saved child media staying explicit-only);
none were overridden in this session, so the shipped surface follows those
recommendations rather than asking again. Direction 1 (Living Binder)
supplies the calm default landing (a "ready now" cover of the newest kept
items) and the plain human framing; Direction 2 (Open Shelf) supplies the
search box, kind filter chips, and large real preview images in place of the
prototype's icon placeholders.

Scoped to the doc's own release ladder, not the full four-section fantasy:
v1 shows only finalized materials (`status = 'final'`, i.e. parent-approved
worksheets/readers/games/etc. from `public.materials`), because Plans,
Books & resources, Keepsakes, and Records either already live elsewhere
(Progress, Planner) or need a content model and the minors' media privacy
decision that don't exist yet. Building fake sections for those would have
misrepresented what the product actually does. "Sections" became kind
filter chips (the one real controlled vocabulary already on `materials`)
instead of the prototype's invented categories.

Discovered mid-build: `lib/materials/artifact-store.ts` bundled `@vercel/blob`
and the Postgres-backed `lib/map/db.ts` at its top level, so anything that
only needed the `MaterialKind` enum (like a client component's filter chips)
dragged Postgres into the browser bundle and broke `next build` with
`Module not found: net/tls/perf_hooks`. Fixed by extracting the enum into a
new leaf module, `lib/materials/kinds.ts`, with zero other imports;
`artifact-store.ts` now re-exports from it so `find_materials.ts`,
`create_printable.ts`, and `mark_material_final.ts` need no changes.

Implemented in `apps/web/lib/materials/kinds.ts` (new),
`apps/web/lib/materials/binder.ts` + `.test.ts` (new, pure scope/search/cover
logic), `apps/web/app/app/binder/page.tsx` + `binder-view.tsx` +
`binder-card.tsx` + `material-detail-overlay.tsx` (new route; the overlay's
focus trap mirrors the onboarding report's `ChartLightbox`, the house
pattern for "look closer" panels), and one row added to `APP_NAV_ITEMS` in
`apps/web/components/dashboard/sidebar-nav.tsx`. Verified: the new binder
tests (15 cases), `pnpm check:progress-ui` and `pnpm check:isolation` still
green, web typecheck and lint clean, and both `next build` and
`eve build` succeed (the latter specifically to catch the artifact-store
bundling issue above).

## 2026-07-12 · Live Progress keeps a door to the full report (founder instruction)

Founder instruction in session: the live Progress view shows an "Open the
full report" link to the child's permanent token report. This is consistent
with `agent-led-live-progress`, which keeps token and share reports
available, so no ruling is superseded and the register is unchanged. The
founder also flagged the live Progress view itself for a larger redesign
later; this link is the interim path back to the report's chart and cards.
Implemented in `apps/web/components/progress/progress-view.tsx` (the link
renders only when the child has a report token) and
`apps/web/app/app/[childId]/progress/page.tsx` (passes the token href).
Verified by `pnpm check:progress-ui` (98 tests), the web typecheck, and the
web lint before commit.

## 2026-07-12 · Task texts reach one adult: the recipient ruling ships

Founder question: does an invited co-parent automatically get the daily
texts? Answer, confirmed in code: yes, the dispatch channel fanned every
task delivery out to every family adult (listFamilyDeliveryRecipients),
so an invited dad started receiving the morning brief, the evening
check-in, and every custom task text the moment his membership row
landed. Founder ruling, same session: only the main parent, the account
owner, is auto-subscribed to daily task texts. An invited adult is never
auto-subscribed; they opt in by creating their own task on the web tab,
in chat, or over SMS. Registered in the reconciliation later-ruling
register as task-recipient-scoping.

Built:

1. Migration #72 (additive, applied to homa-prod ahead of the deploy):
   agent_schedules.recipient_member_user_id names the one adult a task
   delivers to; backfill stamps every existing row with the family's
   first member (the account owner); single-adult families' unattributed
   legacy phone rows attach to their only member so member-scoped
   delivery still reaches them by text.
2. Seeding stamps the account owner; createCustomTask stamps the
   creating adult (web action passes the signed-in user, the chat/SMS
   create_task tool passes the session's authenticated memberUserId).
3. The dispatch channel narrows delivery through a pure selector
   (lib/conversation-continuity/task-recipients.ts): the named
   recipient, or the first member on legacy null rows; a single-adult
   family keeps its unattributed phones; member-less families keep the
   legacy fan-out. Seven tests written red-first drive the contract.

Consequences stated plainly: in the founder's own household Alessa is
the first member, so the built-in morning brief now texts her alone;
Sidney opts in by asking Homa for his own brief task. Known v0 limit: an
SMS-bridged adult with no account who asks Homa for a task gets it
stamped null, so its texts fall back to the account owner; scoping to a
bare phone number is future work if it matters.

Verification: 94 continuity tests (7 new recipient tests red then
green), web typecheck, web lint, eve build, and the production isolation
guard before and after the schema change all pass.

## 2026-07-12 · Dispatch session tokens become per-run (HookConflictError incident)

Incident, found while investigating the founder's "no morning text today"
report (the answer to that report itself: the morning brief is Mon-Fri by
design and today is Sunday; Saturday was the one-time seeded exception).
The Gomes family paused the built-in brief on 2026-07-11 and had Homa
create three custom per-kid 6am briefs (Alma, Ara, Amalia). All three
fired in the same dispatcher tick this morning; only Alma's delivered.
The dispatch channel's continuation token was kind:familyId:day, so the
three custom tasks collided on one eve hook token and eve rejected the
second and third sessions with HookConflictError (Vercel logs 10:00:34
UTC, conflicting run wrun_01KXAWAYM0ED17DMD62WNC14JE). Both runs sat
"running" until the reaper failed them at 13:00 UTC. Daily tasks plus a
date-only token means the collision repeats every morning.

Fix: the token now appends the homa_task_runs run id
(lib/conversation-continuity/dispatch-session-token.ts), which is unique
per schedule per family-local day, so sibling custom tasks get their own
sessions while a true redelivery of one run still resumes its own. The
day-scoped fallback remains for callers without a run row. Regression
test dispatch-session-token.test.ts reproduces the collision (watched red
on the old shape, green on the fix). Verified: check:continuity 87 tests,
web typecheck, web lint, and eve build all pass. No data repair needed:
the failed runs are honestly recorded and every schedule already advanced
to 2026-07-13.

Founder instruction in session: the app sidebar tabs are now "Ask",
"Progress", "Planner", and "Tasks". This supersedes the D-ht-4 tab name
("Homa's tasks") and the earlier "Ask HOMA" and "Week planner" labels, for
the nav only. Page titles and in-page headings keep their fuller names
("Week planner", "Homa's tasks") because the nav needs to scan fast while
pages can afford the extra words. Changed in `APP_NAV_ITEMS`
(`apps/web/components/dashboard/sidebar-nav.tsx`), which also feeds the
marketing Nav's signed-in phone menu. Registered in the reconciliation
later-ruling register as `nav-labels-simplified`.

## 2026-07-12 · Agent-led live progress reaches production

Production now runs commit `635e16f92112011b8f8f4790c80ed96ab2cc6644`
with `HOMA_LIVE_PROGRESS_ENABLED` enabled. Deployment
`dpl_CVSe24nqdAHa5PdKhJJTUF97XSoS` reached READY and owns the
`thankshoma.com` aliases.

The rollout followed the guarded sequence: flag-off code first, public route
probes, additive migration, dry-run reconciliation, committed reconciliation,
production flag activation, and a fresh production build. The migration
backfilled 231 evidence rows from 231 evidence-bearing compatibility answers.
Both final reconciliation passes reported zero additional inserts and zero
supersessions.

The production isolation guard passed every anonymous, authenticated,
cross-family, RLS, and ChildProgress constraint probe. Public landing and
onboarding returned HTTP 200, a private token-report probe returned HTTP 200,
and Vercel reported no recent runtime error clusters. A sanitized live read
returned 16 subjects and 44 observations. A temporary synthetic check-in
started, created one baseline snapshot, stopped, and was deleted.

The first preview exposed one production-only Eve rule: `disableTool()` may
override framework tools only, not a retired custom tool. The obsolete
`record_observation.ts` file was removed in `635e16f`, after which the preview
and production builds passed.

A temporary authenticated Supabase session loaded the signed-in Progress
surface with HTTP 200, then its family, child, membership, and Auth user were
deleted. No real linked-family SMS was sent. Provider delivery remains an
explicit follow-up probe rather than implied production evidence.

## 2026-07-12 · Task 10 final quality closure

Task 10 returned to in-progress status while six final gaps were closed, then
returned to verified repository-complete at
`2026-07-12T10:04:05-04:00` only after the fresh matrix passed.

Progress events now use one bank-first, assessment-taxonomy-second dimension
locator. Taxonomy evidence, conflicts, and resolutions carry their trusted
subject and domain, and projection events never report zero touched subjects.
The private membership-removal trigger inserts one PII-free
`progress.checkin_paused` row in the same transaction as each real transition.
Rollback leaves neither pause nor event. Runtime emitters exclude that reason
because the database owns it.

The disposable PostgreSQL harness now rejects every failed settled race. This
exposed an older same-item deadlock that the prior unchecked branch had hidden.
Legacy writers now lock the scoped child before `child_answers`, preserving the
pre-migration-safe child-first order. The harness also requires every binary,
bounds process and database waits, and proves PostgreSQL stopped plus the
temporary directory disappeared before printing cleanup PASS. CI gives the E2E
step a ten-minute outer limit.

The focused guards now include reconciliation under `check:child-progress` and
the narrow taxonomy metadata test under `check:taxonomy`. TSX message-part and
card tests remain under `check:progress-ui`.

Fresh evidence: 261 ChildProgress tests, 36 taxonomy graph checks plus 2
progress metadata tests, event parity, 10 disposable-Postgres PASS markers, 97
Progress UI tests, all 4 workspace typechecks, both linted applications, the
63-route Next build, and the Eve build passed.

This remains repository evidence only. No remote database, migration
application, isolation probe, deployment, feature flag, provider, commit, or
production state changed.

## 2026-07-12 · Agent-led live progress closes in the repository only

The founder-approved `agent-led-live-progress` ruling makes the agent the
preferred authenticated app-home surface and makes signed-in Progress one live
subject, domain, and topic view. It supersedes the earlier
`report-as-dashboard` ruling only for the default app-home and dashboard
surface. Permanent token and share reports remain, and existing report history
stays stored.

Task 10 registered all nine strict, PII-free `progress.*` event schemas and
wired emission only after committed, nonduplicate, nonrefused operations.
Analytics failures remain best effort and cannot change the product result.
The root now exposes `check:child-progress`, `check:progress-ui`, and
`child-progress:e2e`. CI runs all three and pins Ubuntu 24.04 plus PostgreSQL 16
for the secret-free disposable database proof.

The existing PostgreSQL harness was retained and extended rather than
rewritten. Its static PASS markers cover pre-migration flag-off writers,
cross-family denial, two-adult takeover, conflict replay and resolution,
journal and partial check-in behavior, family folds and child deletion, walk
prompts, corrections and reconciliation, report token and history preservation,
and temporary-cluster cleanup.

Fresh local verification passed 254 ChildProgress tests, 96 Progress UI tests,
the disposable PostgreSQL E2E, map and walk checks, event parity,
skills-targeting, taxonomy, 83 continuity tests, workspace typecheck, root
lint, the Next build, the Eve build, and the isolation script syntax check. A
safe flag-off route and card smoke passed 21 tests without a server or database.

The repository-wide `check:docs -- --allow-open` command still exits 1 on
concurrent audit debt outside this feature. Its final Task 10 run found 13
unrelated or concurrent candidates absent from the immutable baseline and
manifest, plus pre-existing missing Higgsfield files awaiting terminal
lifecycle dispositions. Task 10's plans, specification, notes, two tracked
prototypes, and local migration claim are covered. The claim ledger itself is
structurally valid.

This is repository evidence only. No commit, push, deployment, remote
migration, remote isolation run, feature-flag activation, provider change, or
production probe occurred. Rollout still requires a flag-off code deployment,
Vercel READY and legacy probes, additive migration application, dry-run and
real reconciliation, flag activation, authenticated Progress and correction
checks, permanent token-report verification, linked-SMS verification, and a
fresh production evidence update.

## 2026-07-12 · ChildProgress legacy-writer lock order

Task 9 moved checklist, deep-dive, taxonomy walk, SMS signup, delete, and
report-correction writes behind one flag-aware ChildProgress adapter. The old
model-facing item ID tool is disabled; `manage_child_progress` is the only
model mutation boundary.

The requested `child_answers` trigger only bumps the canonical source revision.
It does not take the global advisory lock itself because PostgreSQL acquires
the table lock before a row trigger runs, which would invert reconciliation's
advisory-then-table order. Every application writer instead takes the shared
advisory lock before its `child_answers` statement. The committed PostgreSQL
harness covers the trigger, lock ordering, exact evidence linkage, correction
append and supersession, deletion, conflict refusal, and same-answer new-date
invalidation.

Family folding exposed a second lock-and-identity seam. All 22 composite
ChildProgress foreign keys now defer and cascade family updates, and account
attachment shares the same family-data fold transaction as SMS stub
reconciliation. This avoids choosing one of several inconsistent update paths:
conversation provenance and child ownership can move in one transaction, then
all constraints verify the destination family at commit.

The final walk hardening removed a nested progress transaction. Prompt state,
progress state, and next-card state now commit or roll back together. Prompt
receipts carry expected sitting and item-observation state, while family folds
re-check membership only after deterministic family row locks.

Walk `not_sure` and `skip` stay compatibility coverage rather than fabricated
evidence. Browser save and undo keys now follow one intent across retry, while
Telnyx provider and receipt identity is stamped before family linkage. These
are repository behaviors only; no provider configuration or production state
was changed.

Rollout remains code-first with the live flag false, then additive migration,
explicit final reconciliation, and only then flag enablement. Rollback sets
the flag false and leaves the additive ledger in place. No reverse bridge was
added and no remote state changed.

## 2026-07-11 (late afternoon) · Slow SMS turns now speak before they work

Founder problem: a reasoning-heavy SMS request left the phone silent long
enough that Homa looked broken. Founder approved an immediate SMS improvement
and a separate RCS phase after Telnyx supplies a registered beta agent.

The existing `send_heads_up` material-build tool now covers substantial
reasoning, current research, several dependent tools, and material builds. It
is the agent's first action on those slow SMS turns. Greetings, quick answers,
clarifying questions, signup, consent and invitation flows, account linking,
and one-step record updates stay quiet. The progress line is not the reply;
Homa still sends one completed reply when the work finishes.

The shared helper moved from `lib/materials/sms-ack.ts` to
`lib/sms-progress.ts`. It still shares one three-minute, per-instance dedupe
window across the agent-first tool and automatic material fallbacks. The key
includes both family and authenticated phone, so one parent's request cannot
suppress another parent's progress line. The helper now awaits Telnyx and
reports success only when submission is accepted. A failed progress send
cannot stop the work or the completed reply. The progress-only Telnyx request
aborts after five seconds, while ordinary SMS and MMS callers keep their
existing behavior. The destination still comes only from authenticated channel
attributes.

The reader gate found the parent-facing lines calm and clear. The editor gate
then removed inconsistent names, a nested action sentence, and a run-on from
the generated-copy producer. A code review found older material instructions
that still promised "a minute or two"; all three producer layers now use the
same duration-free rule. No exact wait estimate was added because there is no
evidence for one universal duration.

Verification: the initial focused suite passed 5 tests after first failing on
the missing service. Timeout and transport coverage brought the focused SMS
tests to 10; the strengthened continuity guard passed all 65 tests. Edited-file
lint,
IDE diagnostics, web typecheck, Next production build, and Eve build all
passed. The final focused code review found no remaining critical or important
issue. No live phone test or deployment was performed. RCS code remains
deferred until the founder completes the Telnyx beta-agent action in
`HUMAN-TODO.md`.

## 2026-07-11 (afternoon) · Morning research brief has one binding format

Founder approved the Mac Mini-style morning brief as four exact blocks:
`🔬 Last night I researched`, `What I learned`, `Why it's interesting`, and
one `Want me to` offer. Each content section is 1 to 2 sentences. The offer
must name one action Homa can complete now, such as making a quick activity
or printable. Calendar writes are not available, so Homa may collect timing
details for a reminder or task but may not promise a calendar change. The
saved-note URL is deferred until a dedicated research-note route exists.

The generated-copy producer at
`apps/web/agent/skills/research-brief/SKILL.md` now owns the exact shape,
plain-language rules, honest overnight versus top-up tense, and CTA
capability limits. Dispatch repeats the format at the final generation seam.
A pure validator requires the exact seven-line layout, complete content
sentences, one supported capability, and the expected overnight or top-up
tense. It rejects extra questions, links and bare domains, saved-note claims,
calendar references, markdown, extra emoji, internal vocabulary, em dash
characters, and messages over 1,600 characters. The paid model eval reads the
real skill and uses Homa's shared gateway model; CI runs only the deterministic
contract. The ruling is also indexed in the canonical founder registry.

The reader gate found that teaching abbreviations, abstract sound categories,
and a vague game offer raised first-read effort. The producer now requires a
concrete example and a clear deliverable. The editor gate then found unclear
actors, multi-idea sentences, vague references, and nested CTA clauses. Those
fixes also landed at the producer layer, never in the generated fixture.

Verification: all 8 deterministic format tests passed; the live model eval
generated a valid four-block Story phonics brief; all 65 conversation
continuity tests passed; monorepo typecheck, scoped web lint, event, map, and
skill-targeting guards, production build, and Eve channel build all passed.
No commit was created. A final focused code review ended GO after every
reported format and CTA bypass became a regression fixture.

## 2026-07-11 (morning) · Conversation continuity: one household conversation above every Eve session

Founder rejected the local "inject the latest dispatch message" patch after
the first live morning brief asked a question and Sidney's SMS reply "Yes"
resumed a different Eve session: "think one level of abstraction above."
Production trace: one household, two parent members, two phones, 96 persisted
messages across 12 Eve sessions (7 web, 2 SMS, 3 dispatch) plus 6 voice
transcripts. The permanent row shape could not name the adult, recipient,
episode, reply target, task run, or per-recipient delivery. Root ruling:
transport threads are adapters, never product conversation identity. Eve owns
durable execution; an application-owned Conversation Continuity module owns
causality.

Built test-first:

1. `conversation_episodes`, `conversation_thread_bindings`,
   `conversation_deliveries`, and `conversation_open_loops`; messages gain
   episode, actor member, family/internal visibility, task-run origin, reply
   edge, provider id, and delivery edge. Existing dispatch input prompts were
   backfilled internal and are hidden from authenticated reads.
2. The deep module under `lib/conversation-continuity/`: deterministic
   provider-id-first reply resolution, no "latest message" guessing, one open
   loop per recipient, explicit ambiguity, expiry, role-labeled hydration,
   Postgres adapter, per-adult SMS with own-email fallback, partial delivery
   status, stable hashed transport bindings.
3. SMS and email authenticate the adult, resolve the canonical episode before
   starting Eve, and stamp episode/reply/delivery metadata. Web persistence
   resolves the same module; fresh devices and rotated sessions rehydrate the
   episode. Voice context receives the latest member continuity block.
4. Dispatch creates one canonical family message, records one delivery per
   intended adult, opens independent reply loops only when the generated text
   actually asks a question, records its Eve session on `homa_task_runs`, and
   reports partial instead of hiding one adult's failed delivery.
5. Family folding moves every continuity table and deduplicates transport
   bindings. Email parsing now preserves Message-ID and In-Reply-To for exact
   provider causation when available. The task history names partial delivery
   plainly.
6. Provider hardening: SMS/email webhook IDs are claimed before Eve so retries
   cannot repeat tools; parent content is canonical before the turn starts;
   terminal model output completes the inbound receipt independently from its
   outbound send. Resend's current metadata-only webhook retrieves content
   through the Receiving API. Proactive/reaction emails use HMAC-signed
   per-delivery reply aliases; legacy addresses require DMARC. Telnyx and
   Resend submission states preserve submitted/rejected/unknown, suppress
   unsafe fallback/replay, and distinguish partial uncertainty in task history.
   Existing 296 messages were backfilled into 23 canonical episodes (zero
   missing); all six historical family task runs recovered their Eve session.

Verification: 55 continuity/channel tests green (new behavior observed red
first), production-shaped two-parent DB E2E green before the local database
secret disappeared (7 original checks; the committed CI version now also
covers receipt replay, sent replay, monotonic visibility, and family fold),
live Claude model eval green (bare "Yes" produced the promised stop-and-go
game), monorepo typecheck, source lint, production build, Eve channel build,
event/map/skills/taxonomy guards green. Two fresh code-review rounds ended
GO after every critical/high finding was fixed. Supabase advisors found no
new security warning; all continuity foreign keys are indexed. Anon isolation
checks are green under the new explicit-deny posture. The authenticated
cross-family fixture could not rerun after another work stream removed
`SUPABASE_DB_PASSWORD` from local env; CI now supplies it explicitly and runs
both isolation and the database continuity E2E.

Schema migrations were applied to homa-prod and are additive/backward
compatible. Product code is complete on the current reconciliation branch but
not deployed from this mixed working tree; no commit was created without a
founder request.

## 2026-07-11 (pre-dawn) · The wall: built DARK behind HOMA_WALL_ENABLED

Founder instruction after the monetization review: "make the wall. make it
removable. Not at the conference." Built the paywall between the free report
and the acting product, dark by default: flag off means zero behavior change
and zero added queries, so the July 13 conference deploy is untouched and the
07-04 no-Stripe-at-conference ruling stands. Full decision record:
plans/2026-07-11-the-wall.md.

Placement (from the review, supersedes PRD FR-2's card-at-onboarding wording
that predates open signup): the report stays free forever; the card comes out
at the first tap on one of four doors (build a plan, open the month,
curriculum call, first chat message). The wall gates NEW action only; plans
and months that already exist keep rendering. Unlock is Payment Link checkout
verified by /api/billing/confirm (client_reference_id must match the
signed-in family), which stamps families.trial_started_at once.
families.billing_exempt is the founder comp switch. Agent calls made alone,
all conservative and logged in the plan doc: chat gate is client-side in v0
(channel enforcement is Phase D hardening), no webhooks yet (trial_started_at
is one-way; founder ops cover cohort scale), SMS stays unwalled per the
standing pricing-over-text ban, wall access reads fail OPEN so a billing
hiccup can never take a family's product down.

Instrumentation is live NOW with the flag off: report.action_tapped fires on
every door tap (walled=false era) so the paywall decision gets baseline
tap-through data starting this weekend; wall.viewed / wall.dismissed /
wall.checkout_started / billing.trial_started complete the funnel later.
Verified: web + core typecheck, web lint, check:events (registry parity),
check:isolation (no new tables; three additive families columns, migration
20260711200000 NOT yet applied to prod, it ships with this code per the
additive-may-lead law).

File additions: apps/web/lib/billing/{wall.ts,wall-types.ts},
apps/web/components/billing/{wall-copy.ts,wall-offer.tsx,wall-modal.tsx,
door-link.tsx,wall-beacon.ts}, apps/web/app/api/billing/{beacon,confirm}/
route.ts, supabase/migrations/20260711200000_family_billing.sql,
plans/2026-07-11-the-wall.md; wall threading in report-view, month-button,
call-homa-ps, plan page, plan consent + curriculum start routes, chat page +
chat-client; WALL_DOORS + five events in packages/core/src/events.ts.

## 2026-07-11 (late night) · Child profile parsing has one map helper

Bug found during the full-repo review follow-up: child interests, focus,
help-with text, and homeschool style were parsed separately in map state,
plan generation, report narratives, and curriculum-call facts. One plan path
also cast JSON arrays directly to `string[]`, so non-string values could leak
into planner context.

Added `apps/web/lib/map/profile-context.ts` for string-list extraction,
deduping, profile interest cleanup, help/focus cleanup, and the family style
fallback. Moved the repeated map, narrative, and curriculum parsing onto it.
The shared read path also applies the existing non-answer guard so old
`"idk"`-style focus rows do not re-enter prompts. Verified with web TypeScript,
web lint, and a grep for the old unsafe casts and local filter patterns.

## 2026-07-11 (late night) · App SMS sends go through one Telnyx helper

Bug found during the full-repo review follow-up: the family phone linker
reimplemented the raw Telnyx `/v2/messages` POST for its confirmation text,
while the rest of app code used `sendHomaSms`. That split could drift on SMS
enablement, from-number handling, MMS support, or failure behavior.

Moved the link notification onto `apps/web/lib/voice/telnyx-api.ts`'s
`sendHomaSms` helper. Verified with a grep showing the app-side raw Telnyx
messages endpoint now only appears in that helper, plus web TypeScript and web
lint.

## 2026-07-11 (late night) · Map resume cookie writes have one helper

Bug found during the full-repo review follow-up: four map routes repeated the
same httpOnly resume cookie options. That made token lifetime and cookie
security settings easy to drift between anonymous start, password claim, Google
linking, and emailed resume links.

Added `apps/web/lib/map/resume-cookie.ts` with `setMapResumeCookie`, then moved
all four routes onto it. Verified with a grep showing the raw cookie setter now
lives in one map helper, plus web TypeScript and web lint.

## 2026-07-11 (late night) · HTML escaping has one helper

Bug found during the full-repo review follow-up: `escapeHtml` existed in three
places after the link-phone confirmation page was hardened. That kind of helper
drift is exactly how one HTML surface keeps escaping less than another.

Added `apps/web/lib/html-escape.ts` and moved map email, printable page shells,
and the link-phone confirmation page onto it. The shared helper escapes text
nodes and quoted attribute values, including apostrophes. Verified with web
TypeScript, web lint, and a grep showing only the shared helper defines
`escapeHtml`.

## 2026-07-11 (late night) · Mobile no longer bypasses web onboarding

Bug found during the full-repo review follow-up: mobile still had its own
email/password account creation and family creation path after web retired that
flow. A mobile-created account could skip the web onboarding step that stamps
`profile_completed_at`, then reach Today or Chat in a half-setup state.

Removed the mobile create-account mode and the dead mobile family-creation RPC
wrapper. The mobile sign-in screen now only signs in existing accounts and opens
web onboarding for new families. Mobile family reads now include
`profile_completed_at` and the signed-in adult's own `family_members.display_name`.
Today and Chat require the same readiness shape as web app data: family basics
complete and at least one child. Family and Chat greetings now prefer the
member-specific display name before the family-level fallback. Verified with the
mobile TypeScript check, mobile lint, and a grep proving mobile no longer
contains `signUp`, `createMyFamily`, or `create_my_family` paths.

## 2026-07-11 (late night) · App source is clear of literal em dash characters

Bug found during the full-repo review follow-up: one app-level instruction file
still carried a literal em dash, even after the earlier code cleanup. The broader
CR-51 docs sweep remains open because it touches historical planning records and
local skill reference material.

Replaced the remaining non-vendored app/package hit in `apps/web/AGENTS.md`.
Verified `apps/` and `packages/` have no literal em dash outside vendored
taxonomy data. Vendored data remains handled by the CR-52 read-boundary
sanitizer.

## 2026-07-11 (late night) · Mobile tenant-boundary docs corrected

Bug found during the full-repo review follow-up: `apps/mobile/AGENTS.md`
overstated the mobile tenant boundary by saying `familyId` never comes from
client input. The code is safer than that phrasing: some app writes send a
selected `family_id`, and Supabase RLS re-checks it under the caller's token.

Updated the mobile instructions to reserve the stronger rule for agent
identity, and to describe app writes as caller-token RLS-scoped. This is a
partial CR-72 cleanup only; the broader mobile signup/profile-completion gaps
remain tracked.

## 2026-07-11 (late night) · Hook suppressions removed from app code

Bug found during the full-repo review follow-up: chat recovery, stream
watchdog, dictation auto-stop, and onboarding transition code suppressed React
hook lint rules. That hid dependency drift in the recovery paths that keep the
composer from getting stuck.

Refactored the web and mobile chat recovery effects to use explicit Eve method
dependencies, stable completion callbacks, and a time helper instead of purity
suppression. The dictation auto-stop now stops the recorder directly from the
state-driven cap effect. The preparing step now keys staged-line state by child,
so switching children starts at the first line without an effect reset. The
mobile family loader no longer needs its set-state-in-effect suppression. Also
fixed the lint fallout in the chart lightbox focus restore, memories-card copy,
and a stale import. Verified with web lint, web TypeScript, mobile TypeScript,
and a repo grep for React hook suppression comments under `apps/` and
`packages/`.

## 2026-07-11 (small hours) · Graph walk machinery built dark (depth-fork plan steps 1-2)

Built the instrumented core of plans/2026-07-11-onboarding-depth-fork.md on the
founder's "continue": the three registry events (map.depth_fork_decided,
map.walk_answered, map.walk_ended), the pure walk engine in
packages/taxonomy/src/walk.ts (fold answers into confirmed/emerging/blocked
knowledge with hard-closure implication, explicit-beats-implied contradiction
handling, climb-on-easily prune-on-miss card selection, sitting budget 8
mirroring DEEP_DIVE_CAP, per-domain frontier summaries), the authored-card
layer (cards.ts, empty until curation batch 1, so the walk serves nothing and
ships dark), the /api/map/walk + /api/map/walk-fork routes, and
lib/map/walk-store.ts (topics validated against the taxonomy server-side,
child_answers rows under source 'onboarding_walk', tenancy re-scoped per the
law). Thirteen walk-engine laws joined pnpm check:taxonomy, asserted against
the real corpus.

Decisions made alone: apps/web became the first full-package @homa/taxonomy
importer under Next, which surfaced that Turbopack resolves the package's
.js-suffixed relative TS imports literally (nine module-not-found errors).
Added @homa/taxonomy to transpilePackages and dropped the .js suffixes from
the package's internal imports, matching @homa/core's extensionless
convention; eve build, tsx guards, typecheck, lint, and the full Next build
all verified green after the change. Walk answers fold in every stored
taxonomy-topic answer for the child regardless of writer (record_observation
included), while bank-item answers stay out of the graph fold: the ladder and
the graph stay separate models per the skill-graph plan.

## 2026-07-11 (small hours) · Onboarding depth: mom-decides fork, instrumented (founder rulings)

Chat session on the Marble-derived skill graph and onboarding length ended in
four founder rulings, captured with the full design in
plans/2026-07-11-onboarding-depth-fork.md: (1) err toward a longer, smarter
first assessment and shorten from evidence, never preemptive fear; (2) depth
is the mom's choice, offered per subject after its core questions ("dive
deeper into [subject A], or move on to [subject B]"), biased toward her
helpWith subjects; (3) fork take-rate and mid-walk drop-off per subject are
instrumented from day one through the events registry, so "shorten it" is a
data decision in two weeks instead of a complaint-driven one; (4) graph-walk
answers land unanchored (they feed the frontier, plans, and the agent
immediately) and graduate into the scored set per topic when an anchor is
authored with a citation, so the scorer's honesty rules stay untouched. No
product code shipped in this session; the plan is the artifact.

## 2026-07-11 (late night) · Vendored reference text is sanitized at read time

Bug found during the full-repo review follow-up: upstream state-requirement
snapshots and Marble taxonomy data contain em dash characters. Editing those
vendored snapshots would create noisy upstream drift, but showing them verbatim
would violate the repo's copy law.

Added a read-boundary sanitizer for state requirement card text and the
taxonomy assembly layer. The vendored files stay exact; product-facing state
pathway text and assembled taxonomy names, descriptions, evidence, prompts,
edge reasons, and cluster summaries normalize the character before display or
API use. Verified with `check:taxonomy`, the web TypeScript check, and a grep
that the changed source files contain no literal em dash.

## 2026-07-11 (late night) · Ops scripts have root aliases

Bug found during the full-repo review follow-up: seven ops scripts were runnable
only through `pnpm exec tsx`, while nearby scripts had root aliases.

Added aliases for knowledge seed/revert, map narrative fixtures, tasks E2E,
Telnyx assistant info, Telnyx call transcripts, and Telnyx calls today. The
prod-mutating aliases do not bake in confirmation; callers still pass
`-- --confirm-prod`, so CR-59's guard remains active. Verified with `pnpm run`.

## 2026-07-11 (late night) · SMS signup progress batches answers

Bug found during the full-repo review follow-up: `signupProgress` loaded child
answers one child at a time. Families with several children paid an avoidable
query per child on every SMS progress check.

Added a batched answer loader that joins through `children` and scopes by
`family_id`, then groups answers by child in memory. The single-child SMS answer
helper now also requires `familyId`, so every answer read in this path carries a
family predicate. Verified with the web TypeScript check.

## 2026-07-11 (late night) · Model timeouts now abort the request

Bug found during the full-repo review follow-up: materials review, materials
image generation, and SMS image captioning used `Promise.race` for timeouts.
The user-facing path returned a failure, but the underlying AI SDK call could
keep running and bill late.

Replaced those races with `AbortController` timers passed to the AI SDK via
`abortSignal`. Timed-out calls now cancel the request, skip usage recording, and
keep the same fail-soft user posture. Verified with the web TypeScript check and
a grep that the flagged `Promise.race` wrappers are gone.

## 2026-07-11 (late night) · Read failures no longer look empty

Bug found during the full-repo review follow-up: saved-materials and memories
reads returned `[]` on PostgREST errors. A policy or schema failure looked the
same as "nothing saved yet."

Material caller reads now log the raw PostgREST message and throw a generic tool
failure instead of telling the agent nothing matched. The settings memories read
now returns `{ memories, loadError }`; the card renders a quiet load-error state
when the query fails and stays hidden only for a true empty list. Verified with
the web TypeScript check.

## 2026-07-11 (late night) · Auth and settings errors use reviewed copy

Bug found during the full-repo review follow-up: three user-facing paths returned
raw Supabase or Auth error messages: onboarding account claim, sign-in, and the
settings child-add action.

Those paths now return stable Homa copy to the client and log the raw message on
the server. The claim route still preserves the `exists` reason so the client can
offer sign-in for returning accounts. Verified with the web TypeScript check.

## 2026-07-11 (late night) · Chart lightbox traps focus

Bug found during the full-repo review follow-up: the report chart lightbox used
`role="dialog"` and `aria-modal` but did not move focus into the dialog, trap
Tab, handle Escape, or restore focus after close.

Added trigger, dialog, and close-button refs. Opening the lightbox focuses the
close button; Tab cycles inside the dialog; Escape closes it; closing restores
focus to the trigger. Verified with the web TypeScript check.

## 2026-07-11 (late night) · Removed unused starter SVGs

Bug found during the full-repo review follow-up: the web public folder still
carried five stock Create Next App SVGs with no references in app code.

Confirmed with a full-repo grep, then deleted `file.svg`, `globe.svg`,
`next.svg`, `vercel.svg`, and `window.svg` from `apps/web/public`.

## 2026-07-11 (late night) · Review threshold env fails closed

Bug found during the full-repo review follow-up: `HOMA_REVIEW_MIN_MESSAGES` was
parsed with bare `Number(...)`. A malformed value became `NaN`, and
`messages.length < NaN` is always false, so the post-turn review gate could run
on every turn.

Added a small parser that accepts only finite positive numbers, floors decimals,
and falls back to the default of 4 for blank, malformed, or less-than-one values.
Verified with the web TypeScript check.

## 2026-07-11 (late night) · Rate limiter evicts one key at a time

Bug found during the full-repo review follow-up: the shared in-memory rate
limiter called `windows.clear()` when it crossed 10,000 keys. One
high-cardinality abuse pattern could briefly erase unrelated counters for the
same serverless instance.

Replaced the full clear with bounded insertion-order LRU eviction. Active keys
are refreshed on each hit, and only the oldest keys are removed when the map is
over capacity. Verified with the web TypeScript check and a focused smoke that
keeps a recently used limited key alive across overflow.

## 2026-07-11 (late night) · Prod-mutating scripts require confirmation

Bug found during the full-repo review follow-up: four ops scripts wrote through
server DB credentials with no explicit production confirmation flag:
`knowledge-seed`, `knowledge-revert`, `state-requirements-seed`, and
`telnyx-transcripts-sync`.

Added `scripts/prod-write-guard.mts`, which allows local Supabase URLs but exits
2 for hosted Supabase URLs unless `--confirm-prod` is present. Wired the guard
into all four scripts before their write paths and updated usage comments. Smoke
checked all four without the flag; each stopped before writing.

## 2026-07-11 (late night) · eve patch config moved to workspace settings

Bug found during the full-repo review follow-up: the load-bearing eve
stream-disconnect patch was declared under `package.json.pnpm`, a legacy
location current pnpm warns can be ignored. The lockfile still had the patch
hash, but a clean install should not depend on stale config shape.

Moved `patchedDependencies` into `pnpm-workspace.yaml` and removed the ignored
`package.json.pnpm` block. `pnpm install --lockfile-only --ignore-scripts` ran
under `corepack pnpm` 10.12.1 and left `pnpm-lock.yaml` unchanged, preserving
the `eve@0.19.0` patch hash.

## 2026-07-11 (late night) · Report position handling is exhaustive

Bug found during the full-repo review follow-up: report sentence and badge code
handled the current `SubjectScore["position"]` union but had no compile-time
exhaustiveness guard. A future position could fall into a default style or
missing return path.

Added `never` checks to the shared report sentence switch and the web report
badge style mapping. The growth movement rank map now uses
`Record<SubjectScore["position"], number>` instead of `Record<string, number>`,
so new positions break typecheck until the movement rule is explicit. Verified
with `pnpm check:map` and the web TypeScript check.

## 2026-07-11 (late night) · Resume guard stays staged until HTTP resume lands

Bug found during the full-repo review follow-up: `apps/web/lib/harness/
resume-session.ts` had zero importers while BUILD.md described it as a standing
mitigation every resume must use. The missing context was the 2026-07-06 audit:
no app-owned HTTP resume path exists yet. Current chat sends through eve's
`useEveAgent` hook and repairs dead streams through `turn-recovery.ts`.

Kept the harness, updated its header and BUILD.md to make the staged status
explicit, and fixed its confirmation predicate. It now treats a resumed session
as confirmed when a new turn reaches `turn.completed`, `session.waiting`, or
`session.completed`, while still failing on a mismatched session, `session.failed`,
or `turn.failed` for that new turn. Also removed the no-em-dash violations from
the harness comments and error text.

## 2026-07-11 (small hours, follow-up) · Short clips get the extra second instead of losing their picture

Founder, on the video gateway's 4-second floor: "for clips below 4 sec, just
add the extra second." Implemented as a conform-and-retry inside the vendor
module, invisible to callers:

- Error-driven, not probe-driven: every clip goes straight to /analyze; only
  a rejection whose code names an input floor triggers the fix. Codes
  captured live with real under-floor clips (never guessed):
  `video_duration_too_short` and `video_resolution_too_low`, both HTTP 400
  with a JSON `code` field. Normal clips pay zero overhead.
- `lib/video/pad.ts`: ffprobe the bytes, then one ffmpeg pass. Under 4s gets
  a freeze-frame tail (tpad clone + apad silence) out to 5s, comfortably past
  the floor so container rounding can never re-trip it; under 360x360
  upscales to the floor (aspect preserved) in the same pass, closing the
  second rejection for free. Content is never invented: the clip shows what
  it showed, a beat longer. Temp files under mkdtemp, always removed.
- Both public functions retry once through the pad: the bytes lane (SMS)
  reuses bytes in hand; the URL lane (describe route) downloads the family's
  own already-vetted blob once, then retries via base64.
- E2E green locally, real API: a 1.6s "first steps" clip with speech now
  describes fully (visuals + quoted parent line) instead of falling back to
  audio-only; a 2.4s 200x200 silent clip passes both floors in one pass. The
  blank-clip test also exposed Pegasus inventing a scene for a featureless
  video; HOMA_VIDEO_PROMPT now instructs "describe only what is visible or
  audible, say so instead of guessing", re-verified: the blank clip now
  honestly reports "entirely blank".
- The honest prod gap, decided alone but NOT shipped alone: padding runs
  ffmpeg/ffprobe as subprocesses (FFMPEG_PATH / FFPROBE_PATH overrides, PATH
  fallback). Dev machines have ffmpeg; Vercel's runtime does not, so in prod
  today the retry declines and short clips keep the STT fallback, exactly
  yesterday's behavior, fail-soft. Shipping ffmpeg to prod means adding
  ffmpeg-static (~75MB linux binary) and verifying nitro/eve-build asset
  tracing on a real deploy, which tonight's tree (many uncommitted changes
  from parallel sessions) cannot safely do. Logged as the open follow-up:
  add ffmpeg-static behind the same FFMPEG_PATH seam and watch one preview
  deploy; no code here changes when that lands.

## 2026-07-11 (small hours) · Video gateway: parents' videos become text through Twelve Labs

Founder instruction with an API key: accept video from parents, run it through
the model, pass text to Homa. Built and live-verified against the real API
(9-second test clip, both lanes, ~8s per watch):

- `apps/web/lib/video/twelvelabs.ts`: the vendor wrapper, one file, the same
  isolation posture as `lib/voice/transcribe.ts` (which predicted this exact
  swap in its header). POST `/v1.3/analyze` sync with Pegasus 1.5, which takes
  a public direct-file URL or base64 bytes (30MB encoded cap) with no index,
  task, or polling. Raw fetch, no SDK, eve-build safe. Fail-soft: null on any
  failure, never throws. `HOMA_VIDEO_PROMPT` asks for who/what/speech/learning
  content in plain prose and forbids guessing names or ages.
- Upload shape (decision): video bytes never pass through our API (Vercel's
  ~4.5MB body cap vs 20-200MB phone videos). `POST /api/video/upload` issues a
  Blob client-upload token locked to the session family's own
  `families/{id}/videos/` prefix (video/*, 200MB cap, random suffix);
  `POST /api/video/describe` (maxDuration 300, 6/min per family rate limit)
  accepts only URLs passing `isFamilyArtifactUrl` for THIS family, so the
  gateway never fetches arbitrary URLs and never spends minutes on another
  tenant's say-so. Both routes take cookie or bearer sessions via the new
  shared `lib/api-auth.ts` (the learning/review walk, extracted).
- SMS lane upgraded (first real consumer, live for parents today): the video
  case in `lib/voice/sms-attachments.ts` now downloads once, has Pegasus watch
  the clip (90s budget), and falls back to the original audio-track STT on any
  miss, so a video never gets LESS understanding than before. New
  `sms.attachment_processed` outcome `described` in the events registry;
  sms-mode instructions now tell the agent it saw the video.
- Env: `TWELVELABS_API_KEY` in `.env.local`, `.env.example`, and all three
  Vercel environments (Sensitive in production + preview). Smoke script:
  `pnpm --filter web exec tsx scripts/twelvelabs-smoke.mts --file clip.mp4`
  (or `--url`). Free-plan budget note: 600 total video minutes shared across
  everything; usage-visible via the vendor dashboard.
- Input floors from the API reference, enforced by the vendor not us: clips
  must be 4s to 1h and at least 360x360; misses fall back (SMS) or return
  `{ description: null }` (route).
- Drive-by fix while typechecking: `app/api/map/cron/route.ts` called
  `markBandReady(childId)` but the family-predicates hardening pass (earlier
  tonight) changed the signature to `(familyId, childId)`; call site updated,
  pre-existing red typecheck now green.

## 2026-07-11 (late night) · Isolation guard now tests authenticated tenants

Bug found during the full-repo review follow-up: the isolation smoke check only
tested the anonymous public role. A policy bug that let one signed-in family
read another family's rows could still pass CI.

Extended `scripts/isolation-check.mjs` with a two-user fixture phase. It creates
two temporary authenticated families, proves own reads, proves cross-family
reads and writes fail for children, family memories, and materials, then deletes
the fixture families and auth users through the database connection. CI now
passes `SUPABASE_DB_PASSWORD` to the isolation step so cleanup is reliable.

## 2026-07-11 (late night) · Isolation guard fails on uncovered tables

Bug found during the full-repo review follow-up: the isolation script could miss
new `public` tables unless someone remembered to add a hand-written assertion.

Added a migration parser to `scripts/isolation-check.mjs`. Each read or write
expectation records the table it covers, and the script now fails if any current
`public` table from `supabase/migrations` is not exercised by the guard.

## 2026-07-11 (late night) · Norms report uses product children

Bug found during the full-repo review follow-up: `scripts/map-norms-report.mts`
still joined `child_answers` to the dropped `public.lead_children` table, so the
founder ops report errored.

Updated the aggregate query to join `public.children` on `child_id` and keep the
age bucket calculation based on `children.birth_month`. Verified with
`pnpm report:norms` against the configured database.

## 2026-07-11 (late night) · Calibration failures set a failing exit code

Bug found during the full-repo review follow-up: `scripts/materials-calibration.mts`
logged failed outcomes in the report but always exited 0, so automation could
mistake a failed calibration for success.

Changed the script to write the report as before, then exit 1 when any outcome
failed. I did not run the full calibration harness because it can call paid image
models and create artifacts; verified the exit-code branch statically.

## 2026-07-11 (late night) · Deny-all server tables get explicit revokes

Bug found during the full-repo review follow-up: several deny-all server tables
had RLS enabled with no policies, but did not have explicit table-level revokes
for anon and authenticated roles.

Added migration `20260711190000_revoke_deny_all_tables.sql` to revoke all access
on `phone_leads`, `phone_link_requests`, `phone_claim_codes`, `model_usage`, and
`knowledge_bank` from anon and authenticated roles. The migration is additive
security hardening; the existing isolation guard still passes.

## 2026-07-11 (late night) · Map items expose standards metadata

Bug found during the full-repo review follow-up: the content bank included
standards codes, but the exported `MapItem` type omitted them, forcing the
evidence page to cast around the type system.

Added optional `standards` to `MapItem` and removed the evidence page cast.
Verified with `pnpm check:map` and the web TypeScript check.

## 2026-07-11 (late night) · Child interests share one cap

Bug found during the full-repo review follow-up: child creation capped interests
at 8, while extras and agent profile updates allowed 12, and profile merge paths
did not enforce the combined cap.

Aligned child creation, extras, onboarding UI, signed-in agent updates, and
pinned profile updates on `MAP_INTERESTS_CAP`. Server profile writes now slice
interest lists to the same cap before storing. Verified with `pnpm check:map`
and the web TypeScript check.

## 2026-07-11 (late night) · High-confidence comment matches scorer behavior

Bug found during the full-repo review follow-up: `SubjectScore.highConfidence`
was documented as base plus ladder signal, but the scorer has long used at
least two real observations in the subject.

Updated the comment to match the existing runtime rule rather than changing
report behavior. Verified with `pnpm check:map`.

## 2026-07-11 (late night) · Time-zone copy removes banned wording

Bug found during the full-repo review follow-up: the settings time-zone card
used "behind" in parent-facing copy, which Homa copy law bans.

Changed the line to "Sets the clock for your greeting and the week planner's
dates." Checked the file for the banned word after the edit.

## 2026-07-11 (late night) · Public copy drops retired invite-only framing

Bug found during the full-repo review follow-up: the landing FAQ and terms still
said Homa was invite-only, which contradicted the open onboarding funnel.

Updated the FAQ and terms copy to say the product is free while the first
families shape it, without implying an invite gate. Synced the public `llms`
summary files that repeated the old FAQ answer.

## 2026-07-11 (late night) · Marketing copy uses growth framing

Bug found during the full-repo review follow-up: three marketing strings used
"stuck" as a child-status label, while product surfaces use growth framing.

Replaced the visible marketing instances with "ready for more practice" in the
feature grid, story section, and how-it-works thread. A remaining "stuck" match
is an internal state-machine comment, not parent-facing copy.

## 2026-07-11 (late night) · Plan footer points to the app

Bug found during the full-repo review follow-up: the four-week plan footer told
families they were on the invite list, even though onboarding is open and signed
in families should continue in the app.

Changed the footer to link to `/app` and removed the remaining invite-list line
from the pending-age hub state. The pending-age copy now says Homa will email
when the questionnaire is ready for that age.

## 2026-07-11 (late night) · Onboarding comments match the current flow

Bug found during the full-repo review follow-up: file-header comments still
described an older onboarding order where account setup came last and the
homeschool block lived on the report page.

Updated the comments in `app/onboarding/page.tsx` and `extras-step.tsx` to match
the current account-first flow, family setup, HomeschoolStep, kids, checklist,
child extras, scoring, and report.

## 2026-07-11 (late night) · Next config renderer comment uses the current path

Bug found during the full-repo review follow-up: `apps/web/next.config.ts`
still pointed at the old `lib/print/render-page.ts` renderer path.

Updated the comment to name `lib/materials/render-page.ts`, matching the current
materials studio renderer.

## 2026-07-11 (late night) · Content bank header matches bank version

Bug found during the full-repo review follow-up: `content.ts` still labeled the
map bank as v2026.07.3 while `MAP_BANK_VERSION` is 2026.07.5.

Updated the file header to v2026.07.5. Historical references to earlier
correction passes remain unchanged.

## 2026-07-11 (late night) · Migration header comments are unique

Bug found during the full-repo review follow-up: several migration header
comments reused old migration numbers, including duplicate #49 and #50 labels.

Renumbered migration header comments in filename order through the current tail.
This was comments only; no SQL behavior changed.

## 2026-07-11 (late night) · Waitlist queue flushes from the root

Bug found during the full-repo review follow-up: waitlist submissions could be
queued in localStorage on bad network, but the exported queue flusher had no
importers, so parked submissions might never retry.

Added a root `WaitlistQueueFlusher` client component. It calls
`flushWaitlistQueue` on mount and again when the browser fires `online`. Verified
with the web TypeScript check.

## 2026-07-11 (late night) · Removed retired phone bridge helper

Bug found during the full-repo review follow-up: `copyLeadPhoneToFamily` was
left over from the retired family bridge flow and had no importers.

Removed the dead helper from `family-phone.ts`. The active phone-link path still
uses `addFamilyPhone` with the existing `bridge` source. Verified with the web
TypeScript check.

## 2026-07-11 (late night) · Removed dead exported helpers

Bug found during the full-repo review follow-up: several helpers were exported
without external importers, and a few were not used at all.

Removed the unused `findFamilyIdByEmail`, `formatMinutes`, and `isTrueStub`
wrappers, made `planStartMs` private to `dashboard.ts`, and removed the
`scanMemoryContent` re-export from `agent-pinned.ts`. Verified with the web
TypeScript check.

## 2026-07-11 (late night) · Trimmed dead core barrel exports

Bug found during the full-repo review follow-up: the `@homa/core` package root
exported several map internals nobody imported, and `CAPTURE_MIN_MONTHS` was
defined but unused.

Removed the dead root barrel exports for `ladderRungs`, `domainForBankItem`,
`CAPTURE_MAX_MONTHS`, and `AHEAD_THRESHOLD_MONTHS`, and removed
`CAPTURE_MIN_MONTHS`. Internal module exports used inside core remain. Verified
with `pnpm check:map` and the web TypeScript check.

## 2026-07-11 (late night) · Taxonomy root exports are documented as staged

Bug found during the full-repo review follow-up: `@homa/taxonomy` exported a
broad graph API, while product code only imports the narrow domains path.

Kept the root API because taxonomy checks and future server-side graph work need
it, and documented that it is staged, server-only, and not for client component
imports. Verified with `pnpm check:taxonomy`.

## 2026-07-11 (late night) · Child-scoped helpers require family predicates

Bug found during the full-repo review follow-up: several narrative,
curriculum, report-email, and band-ready helpers trusted pre-scoped callers but
did not enforce the family boundary in their own queries.

Updated those helpers to require or derive the expected family id and to include
matching family predicates before reads and writes. Token-scoped narrative
status now carries through the family id proven by the report token, and the
curriculum webhook correlates child and family before completion or curriculum
upsert.

## 2026-07-11 (late night) · Auth callback uses the shared safe redirect

Bug found during the full-repo review follow-up: the auth callback rejected
external redirects but still allowed `next=/signin`, which could bounce a
freshly authenticated user back to sign-in.

Moved `safeSameOriginPath` into `lib/safe-redirect.ts` and reused it from both
`proxy.ts` and `/auth/callback`. The shared helper rejects external paths,
backslashes, and sign-in destinations.

## 2026-07-11 (late night) · Inbound email verifies Resend signatures

Bug found during the full-repo review follow-up: inbound email authenticated
only with the route's URL secret, then trusted `from` from the JSON body. A URL
secret leak could impersonate any registered sender address.

Fixed the email channel to read the raw request body, verify the Resend/Svix
signature headers against `RESEND_WEBHOOK_SECRET`, and only then parse JSON.
The existing `RESEND_INBOUND_SECRET` URL key remains as an additional gate.
`apps/web/.env.example` now documents both inbound secrets.

## 2026-07-11 (late night) · Voice webhooks accept bearer auth

Bug found during the full-repo review follow-up: six Telnyx voice webhook and
tool routes authenticated only with `?key=...` in the URL. Query strings can end
up in access logs and referrers.

Added a shared `hasVoiceWebhookSecret` helper. Voice context, curriculum
insights, remember, log-hours, send-email, and send-signup-link now accept
`Authorization: Bearer <TELNYX_WEBHOOK_SECRET>` and keep the URL key as a
compatibility fallback while Telnyx tool URLs are migrated.

## 2026-07-11 (late night) · Family invites require the invited email

Bug found during the full-repo review follow-up: invite tokens were checked for
hash, expiry, and single use, but the signed-in account email was not compared
to `family_invites.email`. A forwarded or leaked invite link could add a
different account that had no family yet.

Fixed invite consumption to require the authenticated user's email to match the
invited email before token consumption or membership insert. The join page now
passes `user.email` and shows a specific mismatch outcome.

## 2026-07-11 (late night) · Chat dictation is rate-limited

Bug found during the full-repo review follow-up: `/api/chat/dictation` required
auth but did not throttle uploads, even though each request can spend Telnyx STT
credits.

Fixed the route to apply a per-user hourly cap after auth and before multipart
body parsing or transcription work. Excess requests return 429 with a null
transcript, matching the route's fail-soft response shape.

## 2026-07-11 (late night) · Curriculum calls have a daily family cap

Bug found during the full-repo review follow-up: the signed-in curriculum
"Call me" endpoint placed real outbound Telnyx calls without a per-family rate
limit. A signed-in parent could repeatedly trigger paid calls.

Fixed `/api/voice/curriculum/start` to apply a per-family 24-hour cap before
phone linking, report-fact building, or any Telnyx request. Excess requests
return 429 with `rate-limited`.

## 2026-07-11 (late night) · Waitlist joins are rate-limited

Bug found during the full-repo review follow-up: the public waitlist endpoint
had a honeypot but no IP rate limit. A bot could still generate repeated
Supabase insert attempts and event writes.

Fixed `/api/waitlist` to use the same per-instance `rateLimited` and `clientIp`
helper as the public map routes. Excess requests return 429 before validation
or any Supabase write.

## 2026-07-11 (late night) · Chat day rollover uses family time zone

Bug found during the full-repo review follow-up: web chat's fresh-session
rollover used browser-local `Date` setters for the 4am boundary. A traveling
parent or a device set to a different zone could rotate the model session on
the wrong family day.

Fixed the app page to pass `family.time_zone` into `ChatClient`, and
`prepareChat` now compares family-local chat-day keys. Before 4am belongs to
the previous chat day; at or after 4am belongs to the current one.

## 2026-07-11 (late night) · Built-in task hygiene rechecks eligibility

Bug found during the full-repo review follow-up: seeding a `morning_brief`
required a scored report, but the later enable and disable hygiene updates did
not re-check that report predicate. A family whose reports disappeared could
keep an enabled empty brief.

Fixed the hygiene updates to use the same eligibility shape as seeding: email,
time zone, at least one child, journal opt-out for journal prompts, and a scored
child report for morning briefs.

## 2026-07-11 (late night) · Curriculum report facts count plan activities

Bug found during the full-repo review follow-up: the curriculum-call report
facts path counted completed plan activities but hardcoded each plan's total to
zero. That could produce facts like "checked off 5 of 0 activities" for the
narrative writer.

Fixed `buildReportFactsForChild` to select the stored plan and compute totals
from `plan.weeks`, matching the main narrative-store path. Subject labels now
also use the map subject display name or "the month plan" for the month row.

## 2026-07-11 (late night) · Family folds preserve context bags

Bug found during the full-repo review follow-up: signup folding moved children
into the surviving family and deleted the source family, but it dropped
`families.context`. Homeschool styles, curriculums, and values collected before
signup could disappear during the fold.

Added a shared family-context merge helper. Signup folds now merge the source
context into the surviving family before deletion, recursively merging nested
objects and unioning arrays. The same helper is also used by phone-stub folds so
family-level context does not disappear there either.

## 2026-07-11 (late night) · Recall dates use the family time zone

Bug found during the full-repo review follow-up: recall snippets formatted
call, chat, and memory dates in `America/New_York` for every family. Pacific
and mountain families could see a different date than the one Homa uses in the
family context block.

Fixed both recall paths. Pinned recall resolves the family time zone on the
server connection, and signed-in recall reads it through the caller's RLS
client. Date labels now format with that zone and fall back through the
existing `effectiveTimeZone` helper.

## 2026-07-11 (late night) · Hours logging defaults to family-local today

Bug found during the full-repo review follow-up: `log_hours` defaulted
`happenedOn` with `new Date().toISOString().slice(0, 10)`. A parent logging
after evening in many US zones could get tomorrow's UTC date.

Added a shared `zonedDateString` helper and used the family's configured time
zone, with the existing fallback, for both pinned channel writes and signed-in
chat writes. Explicit dates supplied by the model still pass through unchanged.

## 2026-07-11 (late night) · Observation rescoring respects narrative flag

Bug found during the full-repo review follow-up: the `record_observation` agent
tool always kicked off report narrative regeneration after a rescore, even when
`REPORT_NARRATIVE_ENABLED` was off. Other rescore paths already honored that
flag, so this path could spend generation work and write narrative rows the UI
treated as disabled.

Fixed the tool to gate `runReportNarrative` behind `narrativeEnabled()`, matching
score, correction, SMS, and narrative-status paths.

## 2026-07-11 (late night) · Task updates refuse empty changes

Bug found during the full-repo review follow-up: the `update_task` agent tool
returned `{ updated: true }` when the model supplied only a `taskId` and no
actual task change. That violated the tool-honesty rule and could make the
agent tell a parent a task changed when nothing happened.

Fixed the tool to strip undefined optional fields, detect no-op inputs, and
return `{ updated: false }` with a short clarification note. Real pause or
custom-task edits still use the same store-level validation.

## 2026-07-11 (late night) · Resume-link email failures stay retryable

Bug found during the full-repo review follow-up: the onboarding hub's "email me
this link" action set its success state in both the success and failure paths.
A failed fetch could still show "Link sent. It works on any device."

Fixed the hub to track idle, sending, sent, and failed states. The success copy
now appears only after `/api/map/resume` returns an HTTP OK, and failures keep a
retry affordance visible.

## 2026-07-11 (late night) · Band-ready emails filter age before capping

Bug found during the full-repo review follow-up: `childrenNowInBand()` selected
up to 200 pending-band children without ordering, then filtered the scored age
range in JavaScript. Eligible children outside that arbitrary first batch could
miss the email telling their family the checklist was ready.

Fixed the query to apply the scored age window in SQL before `limit 200`, using
the same day-precise UTC date boundary as `ageInMonths`. The capped set is now
ordered by child creation time and id so repeated cron runs advance
deterministically.

## 2026-07-11 (late night) · Onboarding undo clears saved map answers

Bug found during the full-repo review follow-up: checklist and deep-dive undo
removed answers from local React state only. The original chip tap had already
upserted `child_answers`, and scoring reads the database, so a mis-tap could
still shape the generated report after the parent undid it.

Fixed `/api/map/answer` with a scoped DELETE path and a `deleteAnswer` store
helper. Checklist and deep-dive undo now wait for any in-flight save for that
item, clear the server row, and only then remove the answer locally. Completion
now waits for all in-flight and retried saves before building the report, with
a retry state if conference wifi drops the final write. The checklist's delayed
tap timer is also cleared on exit and unmount so it cannot commit after the
parent leaves the step.

## 2026-07-11 (late night) · Phone-link emails require a POST confirm

Bug found during the full-repo review follow-up: `/api/link-phone?t=...`
consumed its single-use token on GET. Email security scanners and mail-client
prefetchers can visit links before the parent clicks them, which could fold a
text signup stub and link the phone without human intent.

Fixed GET to render a side-effect-free confirmation page. The token is consumed
only by the form's POST. The small HTML renderer now escapes title, body, and
token values before interpolation.

## 2026-07-11 (late night) · Verified phone claims cannot orphan numbers

Bug found during the full-repo review follow-up: verified phone claim moved a
number by deleting the old `family_phones` row and then inserting the new one
outside a transaction. If the insert failed, the number could belong to nobody.
The same file also texted the verification code before inserting the
`phone_claim_codes` row, so a failed insert could leave the parent holding a
code that did not exist in the database.

Fixed the claim path so possession proof, true-stub fold or real-family number
move, new phone link, and code consumption happen in one transaction. A relink
failure rolls back and returns `link-failed`. Verification codes are inserted
before SMS send; if the SMS fails, that unsent code row is deleted.

## 2026-07-11 (late night) · Isolation read checks fail closed

Bug found during the full-repo review follow-up: `scripts/isolation-check.mjs`
counted any non-2xx anonymous read as a pass. That meant a renamed table, a
PostgREST error, or a broken RLS setup could turn the tenant-isolation guard
green while it was not proving the intended condition.

Fixed anonymous reads to require the expected result explicitly. Most
family-scoped tables must return `200` with an empty JSON array. The two tables
with intentional explicit revoke posture, `family_phones` and `family_invites`,
must return 401 or 403. Any other read status now fails the guard.

## 2026-07-11 (late night) · Mobile chat now triggers learning reviews

Bug found during the chat persistence audit: web chat queued the post-turn
learning review after each successful turn, but mobile chat only persisted the
conversation and emitted turn analytics. Mobile conversations were searchable by
recall, but they did not feed the ambient memory-extraction loop unless a later
web path happened to trigger review.

Fixed the review route to accept either the web cookie session or the mobile
Supabase bearer token, still deriving `familyId` from the authenticated user's
own `family_members` row under RLS. Mobile now calls the same review route after
successful turns.

## 2026-07-11 (late night) · Full birthdays, product-wide (founder ruling)

Founder ruling, on reading the tenancy migration's "a full DOB is data we
chose not to hold" comment: "what? we should get the full data so we know how
old the kid is." This restores the 2026-07-06 "get the actual birthday" ruling
product-wide and retires the month-only convention that the 2026-07-08
onboarding-card unification had reintroduced (that reversal was flagged for
review in its own entry; this is the review). Two agent sessions converged on
the same change tonight; this entry consolidates both.

State before: `children.birth_month` was always a full `date`, and the
lead-magnet path has saved real days since 2026-07-06 (the Gomes kids all have
real birthdays), but every product intake appended `-01`, and the two
month-only age calculators could read a child up to almost one month older
than they are. Changes:

1. **Intake collects month, day, and year everywhere**: /onboarding KidsStep
   (Day select, clamped to the picked month's real day count), /app/settings
   AddChildForm + addChildAction, SMS signup (`signup_add_child` now takes
   `birthDate` YYYY-MM-DD; sms-mode instructions ask for the birthday and
   still never guess), and the mobile add-child form. All server paths
   validate with `isValidBirthDate` (the map's own guard, rejects Feb 30).
2. **Age math is day-precise everywhere**: `apps/web/lib/child-age.ts` now
   delegates to `@homa/core`'s `ageInMonths` (day-precise since 2026-07-06)
   instead of its own month-only math, and `get_children`'s inline duplicate
   of that math is gone.
3. **Migration `20260711180000_children_full_birthday`** (comment-only,
   applied to homa-prod): documents the policy on the column itself,
   overriding migration #2's "day is always 01" comment, which stays
   untouched as applied history. No rename: `birth_month` keeps its name,
   a rename is a breaking migration with no behavior payoff.
4. **Docs**: journeys/02's "no full DOB" spec lines got dated correction
   notes; sms-onboarding-plan's tool signature updated. Older static
   artifacts (lead-magnet HTML mocks) keep the stale wording, noted here
   rather than edited.

Not done, deliberately: no backfill (day-01 rows cannot know their real day;
they read exactly as before) and no edit-birthday UI (no child field has an
edit surface yet). The privacy page already said "their birthday", so its copy
is already true.

## 2026-07-11 (late night) · Phone stub folds preserve all family-scoped work

Bug found during the phone reconciliation audit: `foldStubFamilyInto` only moved
`conversation_messages`, `family_memories`, `hours_log`, and children before
deleting a true phone-created stub family. That matched the earliest text-signup
shape, but the product now lets pinned SMS, email, dispatch, and voice sessions
create materials, call transcripts, saved family skills, model usage rows, task
runs, curriculum-call rows, and events before an email-link or verified-phone
claim folds the stub into a real family.

Fixed the helper to fold those family-scoped rows in one transaction before
retiring the stub. Conflict posture stays conservative: the destination family's
saved skill wins on duplicate skill names, and the destination built-in schedule
wins on duplicate journal or morning-brief schedules. Custom schedules move.

## 2026-07-11 (late night) · Server events now stamp family_id rows

Bug found during the pinned-channel hours audit: `chat.hours_logged` deliberately
keeps `family_id` out of props because the signed-in web emitter writes it to the
`events.family_id` column under RLS. The pinned SMS, email, and dispatch hours
path used the server emitter instead, and that helper only wrote `name` and
`props`. Result: the hours row was correct, but the corresponding analytics event
had no family attribution.

Fixed `emitMapEvent` to write `events.family_id` when validated props contain a
`family_id`, and to accept an explicit row family id for events like
`chat.hours_logged` whose schema keeps family id out of props. Wired
`recordHoursPinned` through that explicit option.

## 2026-07-11 (late night) · Handwrytten live mode now requires an explicit false

Bug found during the thank-you-card pipeline audit: the docs and build-log said
test mode was the default posture, but `lib/cards/handwrytten.ts` used
`HANDWRYTTEN_TEST_MODE === "true"`. If the founder enabled
`THANK_YOU_CARDS_ENABLED` and set the Handwrytten key/card/font env vars but
forgot the test-mode env, the first cron pass would send live paid orders.

Fixed the wrapper to fail closed: `HANDWRYTTEN_TEST_MODE="false"` is now the
only live-send value. Unset, `"true"`, and any other value all call Handwrytten
with testMode enabled. Updated the thank-you-card plan to match that switch
order.

## 2026-07-11 (late night) · Voice tool URL UUID guard

Bug found during the voice boundary audit: live Telnyx tool routes read
`family_id` and `child_id` from query strings templated by Telnyx dynamic
variables. Those values are not model-supplied, but malformed template output
like `undefined` could still reach UUID-typed SQL predicates or typed event
validation during a live call. That should be a normal tool result the assistant
can recover from, not a 500.

Added `lib/voice/tool-context.ts` with one shared UUID predicate. The
send-email, log-hours, and remember voice tools now reject missing or malformed
`family_id` before any DB work; malformed `child_id` becomes family-wide so the
tools can still use the model-supplied child name fallback. The signup-link
tool now treats only a valid UUID `family_id` as linked, and the curriculum
insights webhook validates both echoed ids before looking up a pending call.

## 2026-07-11 (late night) · Agent skill library now works on pinned channels

Bug found during the cross-channel agent audit: the dynamic skill resolver,
`save_skill`, and `forget_skill` still required a Supabase caller JWT. Web
chat had one, but SMS, inbound email, and dispatch sessions are pinned by
server-authenticated `familyId` instead. Result: linked text/email families
could load family context, remember facts, log hours, and make materials, but
could not load their saved family skills or the published `skill_bank`; explicit
"save this as a skill" over text also refused with the generic setup message.

Fixed by moving the skill-library read/write paths into `lib/agent-skills.ts`
with the same access split as memory and materials:

- caller path: Supabase client with the parent's JWT, plus explicit
  `family_id` predicates.
- pinned path: direct server SQL through `mapDb()`, with `family_id` predicates
  on every family table and `published = true` on the shared bank.

No new model-supplied tenant input was added. The pinned trust basis is still
`resolveAgentAccess`: phone mapping, family email, or dispatcher schedule row.
The resolver keeps its failure posture, so a skill DB miss removes skills for a
turn instead of failing the conversation.

## 2026-07-11 (late night) · Note-from-Homa letter: design review fixes, both copy gates run

Founder asked for a senior-designer critique of the letter card at the
top of the report, then approved the fixes. Changes, at their owning
layers:

- **The call line lost "BTW, click"** (call-homa-ps.tsx): the tappable
  text is now the action itself, "have me call you now". A link labeled
  "click" reads as nothing to a screen reader (WCAG 2.4.4) and nothing
  on a phone; "now" warns the tap dials immediately (reader-gate catch).
  The founder ask behind the old line (2026-07-09) was the fold-into-
  the-letter behavior, which is unchanged; only the wording moved.
- **notePlanSentence reworded** (core sentences.ts, check:map green):
  "turned it into {child}'s month: a 4-week plan for {month}". Kills
  the "July 4" garden path in "{month} 4-week plan" and teaches the
  same name the button and the plan page's h1 already use.
- **Month button busy state says "Opening", not "Building"**
  (month-button.tsx): the letter says the month is made; the reader
  gate caught the contradiction. The lazy first-tap build + consent
  semantics are unchanged. The arrow glyph is now aria-hidden.
- **Eyebrow color unified at sage-700** (report-view, kid-view x2,
  plan page x2): text-sage (sage-500) on the sage-50 card is about
  3.2:1, under the 4.5:1 AA bar at 10px; report-preview.tsx already
  used sage-700 (about 6.5:1). Letter bookends (greeting and sign-off)
  now share text-lg.
- **Failure states rebuilt to the copy-kit shape** (editor-gate
  must-fixes): both no-session states (call and month button) now share
  one identical wording, "The call didn't start / The month didn't
  open. I don't recognize this device yet. Open your email link on this
  device once, then try again.", which retires the "signed-in device"
  vs "questionnaire device" split and the "first" vs "once" split.
  "One tap away" and "usually does it" replaced with concrete steps.
  The dialing state now replaces the whole line ("Calling you now…"),
  not just the link word, and carries role="status".

Both copy gates ran in order (reader, then editor). Decisions made
alone:

- **Editor must-fix DECLINED: "ahead for their age"**. The editor
  called it age-norm ranking. Declined because "ahead" is the fixed
  position vocabulary (Ahead / On track / Growing badges, founder
  reviewed, check:map enforced), the banned pole is "behind", and
  age benchmarking is the product's stated promise. Banning "ahead"
  would be a founder-level product ruling, not a copy edit; flagged
  to the founder in the session summary.
- **Reader-gate finding left as-is: "their" in the note sentence.**
  Pronoun hard law says parent's own words or "they"; the template
  layer has no pronoun data (the narrative path already computes
  childPronouns properly). Plumbing pronouns into templates is a
  schema change, noted as a possible follow-up, not smuggled in here.
- **Reader-gate finding left as-is: bare subject counts in the note.**
  The one-sentence note is a founder ruling (2026-07-08); the named
  subjects sit directly below on the same page.

## 2026-07-11 (5:26pm) · Card note revision 4, minutes after the first batch

Founder rulings right after "send it" completed: no colons on this
surface, and the address-explanation clause comes out ("they obv know
they gave thier address"), a conscious override of the reader gate's
privacy-flinch finding, recorded in the template comment so the
history stays auditable. "We see it: we homeschool our own kids"
became "We see it. We homeschool our own kids." (the triple "We"
opener is deliberate testimony rhythm) and the number line reads
"text Homa at (346) 758-8011". Body drops to 339 of 500 characters.
Shipped as one-file commit 5de29dc, deployment READY, site probed;
inert until the conference cohort enqueues (~July 15). The three
ordered cards carry revision 3.

## 2026-07-11 (5pm) · SENT: the first three thank-you cards are at the robots, and the first live sweep taught two lessons

Founder said "send it", then paused at the read-aloud and ruled the
note becomes the co-founders' version signed "Warmly, / Alessa &
Carolyng / thankshoma.com" (no title; the domain line is a conscious
override of the reader gate's misparse note). Editor gate passed the
final text with zero must-fixes and one accepted craft fix ("ours" to
"our own"). The message change had to reach the deployed sweep, so it
shipped as a one-file commit built on origin/main via a detached
worktree (155416b), leaving every other in-flight tree change
uncommitted. THANK_YOU_CARDS_ENABLED went into prod env; the deploy
went READY at 4:57pm; the 5:00pm scheduled cron ran the first live
sweep with the new text.

The first live minute found two real bugs, both fixed and deployed
within the hour (ce3a5a3, 60c6a44):

- **The optimistic lock never matched.** Send recording guarded on
  processing_started_at equality, but the timestamp round-tripped
  through text and the update matched zero rows: Alessa's PAID order
  (28387032) went unrecorded while her row stayed claimable, one
  retry from a double-send. The lock is now status='sending' AND
  attempts=claimed value (an int round-trips exactly). Her row was
  reconciled by hand to sent + order id, and the missed
  card.thank_you_sent event inserted.
- **The payment processor's duplicate window declined batch
  neighbors.** Three same-amount charges seconds apart: cards 1 and 3
  failed with "Can't get transaction id with card payment" around
  card 2's success. SEND_BATCH_LIMIT dropped from 10 to 1 per hourly
  run (a backlog drains in a day and every charge sits outside the
  window). The two declined rows were requeued after the fix
  deployed and sent clean on manual cron fires spaced past the
  window.
- Bonus finding, third commit: live basket/send responses carry no
  order id at all, so rows landed 'sent' with null vendor_order_id
  (backfilled by hand from orders/list). The wrapper now falls back
  to the account's newest order when minted within five minutes,
  safe at one order per run.

Final ledger, verified against both the database and the vendor:
three rows 'sent', order ids 28387032 (Alessa, 5:00pm), 28387370
(Carolyng, 5:19pm), 28387377 (CeCe, 5:23pm), all status "paid" on
the account, roughly $14 total. The concurrency design also got a
free production test: a manual cron fire overlapped the scheduled
5pm run and claimed nothing (skip-locked + status filter held). Cards
reach mailboxes in 4 to 7 days, two of them the co-founders' own.

## 2026-07-11 (late afternoon, second pass) · The front learns to sing: script v4 ships

Founder ruling on v3, minutes after it shipped: "i hate this. it
looks cheap. dont put homa logo on the front. and make the thak you
look amazing. the back you can put the full logo and wordmark". v4
(card id 349914) replaces v3 in production; v3 and its images are
deleted, account holds only v4's two covers.

Final art: front is the ruled notebook page with a large flowing
"Thank you" in clay script, two gold sparkle doodles off the final
swash, no logo anywhere on it. Back is the full lockup (house +
bounced Fredoka wordmark), centered, nothing else, per the ruling.

Decisions made alone:

- **Dancing Script 700 as a stationery-craft exception.** The system
  has no lush script: Fredoka is wordmark-only, Caveat is Homa's
  margin hand (sage, product notes), Schibsted read as "default
  font" on cardstock (the founder's "cheap"), and EB Garamond italic
  reads editorial-cold for this audience. A flowing script is what
  card craft uses for a front hero. Scoped to this physical artifact
  only, not admitted to the UI type system; an EB Garamond italic
  alternate was built and preserved beside the sources for a taste
  check (front-alt-garamond.html).
- **Clay script + gold sparkles as the two devices.** The hero
  carries the brand through color instead of a mark; the sparkles
  come from the sanctioned doodle vocabulary (hand-placed, rotated),
  sized and positioned off the "u" swash after a composition pass
  (330px overflowed the trim-safe zone; final 280px with ~125px edge
  clearance at 300dpi).
- **No uxui re-gate this round**: the founder is art-directing live
  and is the reviewer that matters; the prior mailbox read's
  standing fixes (soft margin rule, no domain) are preserved.

Verified: vendor quality checks clean at 600dpi, production
HANDWRYTTEN_CARD_ID=349914, .env.local matches, sources updated in
docs/homa-design/explorations/thank-you-card/, vendor account holds
exactly one custom card (v4) and its two images.

## 2026-07-11 (late afternoon) · The card quiets down: genuine stationery, not promotion (v3 ships)

Founder ruling on the branded card, same afternoon it shipped: "i
dont like 'homeschooling made calm'. i also don't think the card
should be toooooo branded because then it defeats the purpose. it
should feel like a genuine thankyou card. not a promotional
matereal". This confirms what the first reader gate found from the
other direction: the card buys trust by not behaving like marketing.

v3 (card id 349913, "Homa thank you (quiet v3)") replaces v2 in
production; v2 and its cover images are deleted from the vendor
account. Reductions, all within the founder's direction, exact
choices made alone:

- Front headline drops the two-tone brand-poster treatment: single
  warm ink (text-strong), weight 600 not 700, 150px not 220px. The
  notebook paper, the softened margin rule, and the small house
  standing on a baseline stay: paper and a sticker read as
  stationery, a logo lockup reads as a campaign.
- Back is now a stationer's colophon only: the small house mark, low
  center, nothing else. No wordmark, no tagline, no domain. A card
  maker's quiet stamp is how genuine cards sign their backs.
- The house mark stays the card's single clay moment on each side
  (the uxui mailbox read called it the standout delight; the founder
  objected to promotion, not to the character).

Verified: vendor quality checks clean at 600dpi on both covers,
production HANDWRYTTEN_CARD_ID=349913 (env listed), .env.local
matches, design sources updated in
docs/homa-design/explorations/thank-you-card/ (the exploration HTML
is now the canonical art; /tmp render scratch is disposable).

## 2026-07-11 (afternoon) · Thank-you cards wear the brand: custom Homa stationery live

Founder asked "can we customize the card with homa branding?". Done
end to end: card id 349912, "Homa thank you (brand v2)", now the
production HANDWRYTTEN_CARD_ID (was catalog card 186, Kraft). Built
from design-system tokens, never image-model output: the front is a
workbook page (ruled cream paper + the clay margin rule, "Thank you"
in Schibsted 700 with the clay accent word on "you", the little-home
mark standing on a baseline rule beneath it), the back is the lockup
with the bounced Fredoka wordmark and the official tagline in EB
Garamond italic. Two playful devices per surface, inside the restraint
law. Sources preserved at docs/homa-design/explorations/thank-you-card/
(HTML panels render at exact print geometry via headless Chromium);
apps/web/scripts/handwrytten-brand-card.mts is the repeatable pipeline
(Vercel Blob hosting, cover registration, vendor quality check, card
assembly, custom-card detail readback).

Decisions made alone:

- **Rendered, not generated**: image models mangle wordmarks, so the
  panels are HTML/CSS built on the exact tokens (stone-50, brand clay,
  paper-rule cobalt at 7%) and the Logo.tsx house path, screenshotted
  at print size. 1650x1275 (300dpi) tripped the vendor's blur warning;
  final panels render at 3300x2550 (600dpi) and pass clean.
- **The uxui reader gate ran on the physical card** (mailbox context,
  front then back). Its findings shipped: the clay margin rule dropped
  from 55% to 35% opacity (a strong orange vertical line drifted
  toward red-pen territory for this reader), and the back's
  "thankshoma.com" was replaced with the tagline, because the domain
  misparses on paper and gave no reason to exist; the interior's
  printed texting number stays the card's one action path.
- **Interior stays pure handwriting**: no header logo on the writing
  side; branding lives on the front and back only, so the note itself
  keeps the pen-and-ink spell.
- **API quirk recorded**: customCards.create requires backType:
  "cover" alongside backCoverId, and custom cards are read back via
  customCards.get, not the public catalog. Draft card 349910 and its
  four orphaned images were deleted from the account.

Verified: vendor quality check clean on both covers at 600dpi; card
detail confirms A2 landscape, full bleed, 500-character interior,
$3.75 price unchanged; production env now points at 349912 (test-mode
and enablement posture unchanged, the sweep stays dark).

## 2026-07-11 (1am) · Thank-you cards armed: key live, stationery chosen, both test-mode footguns guarded

Founder pasted the Handwrytten API key ("do it"). Agent work on top of
the built-dark pipeline (entry below): key verified against the live
API (446-card catalog, 38 fonts), stationery chosen (card 186 "Kraft
Thank You", font hwDavid "Casual David"; swapping is an env change),
five env vars set in Vercel production with the key encrypted, and a
smoke script added (apps/web/scripts/handwrytten-smoke.mts) that lists
the catalog and can place ONLY test-mode orders. The order-placement
blocker "we need your physical address on file" was cleared through
the address-book API (sender saved programmatically, no dashboard).
THANK_YOU_CARDS_ENABLED stays unset: going live remains one explicit
switch + redeploy, after the conference deploy.

Decisions made alone:

- **The sweep now refuses test mode instead of tolerating it.** A
  test-mode order is accepted by the vendor but never fulfilled, and
  the sweep would still mark the family's once-ever row sent: the
  family silently loses its only card. sweepThankYouCards() now
  requires HANDWRYTTEN_TEST_MODE to be exactly "false" (the parallel
  session had already made any other value mean test), and prod got
  "false" so the one ENABLED switch is truly the last gate.
- **Account-level test mode is guarded too.** Handwrytten has a
  second, account-wide test switch on its dashboard Integrations page
  that env vars cannot see; per-order test flags error when the
  account is live ("test mode error", observed), and an account left
  in test mode would silently unfulfill real sweeps. The sweep now
  reads the live account record (auth/getUser exposes test_mode) and
  refuses to spend while it is on.
- **Full test-mode order validation left optional.** It requires the
  founder to flip that dashboard switch, so it is a HUMAN-TODO option
  rather than a blocker: the first live batch is 3 known-good
  addresses (one is the founder's own), failures park after 3
  attempts, and the smoke probe already validated key, catalog,
  basket, and the clear-basket-on-failure path (basket confirmed
  empty after the forced failure).
- **Billing flagged, not assumed**: the account record shows a billing
  address but zero saved cards; the billing check is first in
  HUMAN-TODO because live orders fail (safely) without one.

Verified: web tsc + eslint green on lib/cards and the smoke script;
`vercel env ls production` shows all five vars; sweep still dark
(ENABLED unset), zero rows in thank_you_cards.

## 2026-07-11 (late night) · Thank-you cards: one robot-handwritten card per family, built dark

Founder asked for deep research on mailing a physical thank-you card
to every mom who signs up, then said "do it". Research verdict
(canvas + plans/2026-07-11-thank-you-cards.md): Handwrytten, real
pen, pay-as-you-go ($3.75/card + $0.82 postage), because web
onboarding's create-your-family step already collects and requires a
full mailing address, so the main signup path was mailable with zero
product changes. Built in one pass, entirely dark behind
THANK_YOU_CARDS_ENABLED + the HANDWRYTTEN_* env set: outbox table
(migration #53, thank_you_cards, deny-all RLS, unique family_id =
one card per family ever, applied to prod via MCP, additive may
lead), a three-pass sweep in the hourly /api/map/cron (enqueue 48h
after family setup, send with for-update-skip-locked claims + a
10/run batch + monthly cap default 150 + three-strikes parking,
confirm to mailed by polling), the official handwrytten npm SDK, and
card.thank_you_sent in the events registry (family_id only).

Decisions made alone:

- **Basket flow, not orders.send()**: only basket/send forwards
  test_mode, and the account-global basket is cleared on failure so
  a stranded item can never double-send on the next sweep.
- **Attempts stamped before spending**: the claim update increments
  attempts and flips rows to 'sending' in the same statement, so a
  mid-order crash can never produce an unbounded paid-API retry
  loop; stale 'sending' rows are reclaimed after 30 minutes.
- **Recipient snapshot on the queue row**: a later address edit
  never redirects a card already being written, and the exact
  message text is kept for the audit trail.
- **Test mode is the default posture**: HANDWRYTTEN_TEST_MODE=true
  validates orders end to end without printing or billing; the
  founder flips it off only after a read-aloud + one green test
  order (HUMAN-TODO).
- **Copy through both gates tonight**: reader gate (ICP read of the
  physical card, including the envelope moment) then editor gate.
  Material findings: name who Sidney is, answer the "how do they
  have my address" flinch on the card itself, say "Homa is one text
  away" instead of "we" so the card never implies a human answers
  the texts, gratitude sized to "trying Homa". Final text lives in
  lib/cards/message.ts; founder read-aloud remains the last word.
- **No address appends, ever**: if the address is missing (SMS-only
  signups), the family waits for a phase-2 opt-in ask; data-broker
  lookups are ruled out in the plan doc.

Verified: check:events, check:isolation (new table covered by read +
insert probes), typecheck, lint, and the web production build all
green. Live send untestable until the founder creates the
Handwrytten account (no key exists), which is exactly what test mode
is for.

## 2026-07-11 (late night) · SMS heads-up before slow builds is now Homa's own first move (send_heads_up)

Founder ask: on the text client, when Homa is about to do a long run
(a worksheet build), she should respond first and say it might take a
minute. The automatic tool-start ack (lib/materials/sms-ack.ts, built
earlier today) only fires when the first slow TOOL starts, and on the
html path the model composes the whole page BEFORE that tool call, so
the longest stretch of dead air was still uncovered, and the ack was
canned rather than in her voice.

Now: new send_heads_up tool, the agent's instructed FIRST move on a
material request over SMS, one short model-written line ("on it,
making Story's counting page now, give me a minute or two") sent
through the tool lane before designing. Taught in sms-mode.ts, the
instructions.md tool table + materials section, and the
materials-studio skill.

Decisions made alone:

- **A tool, not an earlier code hook**: the chat-sdk bridge cannot post
  agent text before tools finish, and code cannot know intent at
  inbound time without a classifier; a tool keeps the judgment with
  the model and the send on the same lane as MMS delivery.
- **Shared dedupe window**: the tool and the automatic acks in
  generate_image/create_printable share one per-family key
  (sms-ack.ts's sendWaitTextOnce, was sendMaterialsAckOnce), so
  whichever fires first wins and the canned ack remains the safety
  net when the agent skips the heads-up. Unlinked sessions key on the
  phone number.
- **One-reply law clarified, not changed**: sms-mode.ts now states
  tool sends (heads-up, deliveries) are not replies; the composed
  message after the work remains the only agent reply.
- **SMS-gated in code**: on web the tool refuses with a note (progress
  is already visible in chat); message capped at 160 chars, no
  content scan (the agent's own replies are not code-scanned either).

## 2026-07-11 (small hours) · Planner copy fixes from the two gates

Founder ran the reader gate on the planner calendar (UI + copy scope),
then said "Fix". Implemented the reader findings that were safe without
a founder ruling, then ran homa-copy-editor per the order law and
implemented its verdicts. Reader-gate fixes: the footer now leads with
"any day counts", names "the progress report" and "the month's
re-check" plainly (the old "the report reads this at re-check time" was
the page's one unparseable, watched-feeling line), sits right under the
grid, renders only with the grid, and the "moving activities around is
coming" self-talk is cut; the focus strip line gets a "The goal:" /
"This month:" prefix (the bare bank statement read as a beheaded
sentence); checked cards keep the sage check + fade but lose the
strikethrough (a line through a two-sentence activity was unreadable).

Editor-gate fixes: "full plan" link renamed "full month" (one name per
concept; the empty state defines "month"); literacy template reordered
to "The quiet goal is {skill}" (skill statements carry comma clauses,
so trailing "is the quiet goal" garden-pathed); "count double" replaced
with the concrete fact (scoring metaphor on a page of literal
check-offs); footer de-metaphored so "quiet goal" is the surface's one
image; week-1 activity title joins with a period not a colon
(descriptions carry their own colons); month focus joins subjects with
commas not plus signs; empty-state body gains a checklist definition
sentence, rendered only when a checklist button shows; "Open day"
becomes "Free day" (verb-first button convention made it parse as an
instruction). Template changes affect newly built plans; stored months
keep their words until re-check, per the fix-the-producer law.

Declined for now (parked with the founder): next-week navigation (a
feature) and splitting tips out of checkable activities (a plan-shape
change in core). check:map green, typechecks green, re-verified at 1440
through the dev-planner-preview harness, deleted after capture.

## 2026-07-11 (late night) · The in-app report's snapshot goes full width

Founder ask (screenshot of the snapshot card: "make the snapshot both
rows"): in the /app report grid the trajectory chart shared its row
with the note card, squeezing thirteen end labels into half a column.
The snapshot now spans both columns (lg:col-span-2). Decision made
alone: the note card spans too, because grid auto-placement would
otherwise leave a permanent empty cell beside it (a span-2 item cannot
backfill), and no other card can pair with the note reliably (the state
card is conditional). The standalone letter page is untouched.
Verified at 1440 through a temporary dev-snapshot-preview harness on
sample fixtures (dev-note-card pattern), deleted after capture.

## 2026-07-11 (late night) · The week board becomes a Monday-to-Friday calendar

Founder ask (screenshot of /app/planner: "this your week section should
look like a calendar"). The per-kid stacked cards became one shared
Mon-Fri grid (day-grid.tsx), matching the design kit's PlannerView
sketch. Decisions made alone while building:

- Day placement is presentation only. Plans have no day concept, so a
  deterministic spread (spread-week.ts) lays each kid's current week
  over the five days: 1 activity lands Monday, 3 land Mon/Wed/Fri, more
  than five round-robin. Checks stay keyed "week.activityIndex", so the
  plan pages and the phone stay in sync and nothing new is persisted.
  Real day-by-day scheduling remains M2-10.
- Each plan keeps a focus-strip row above the grid (focus line, week n
  of 4, re-check chip, full-plan link), so no WeekBlock information was
  lost; week-block.tsx is deleted as superseded. Kid chips distinguish
  activities on the family board; the context switcher still narrows to
  one kid.
- Block tones now cycle across the whole board instead of per kid, so
  two kids' first plans no longer both land on clay.
- Footer copy updated to match the new shape: "The days are a starting
  point: any day counts, and moving activities around is coming."

Verified: web typecheck + scoped lint green; rendered at 1440 and 390
through a temporary dev-planner-preview harness on sample fixtures
(dev-note-card pattern), deleted after capture.

## 2026-07-11 (later) · The founder merge ran; co-parent invites shipped (multi-parent Phases 2 + 3)

Phase 2, the merge itself: one atomic transaction with count assertions,
run after the Phase 1 deploy (997bda9) went READY and migration #50
dropped the one-phone-per-family constraint. The Swift family now holds
both founders (display names Sidney and Alessa, both role parent), both
phones with member attribution, and one Story (Alessa's row canonical,
answers merged latest-wins to 54, Sidney's literacy plan moved over,
birth month 2022-11-01). All 86 messages, 8 memories, 13 materials, 6
transcripts, 27 events, and 188 usage rows verified on the winner;
Sidney's emptied family row and the alessa@thankshoma.com test account
(family and auth user) deleted per rulings. Pre-merge snapshot of all
three families sits in the locked merge_backup_20260711 schema; drop it
once the merged account has lived a week.

Phase 3, the join path signup never had: family_invites (migration #51,
deny-all token table, 7-day hashed single-use links, phone_link posture),
a "Parents on this account" card on /app/settings (list, invite, cancel),
the /join page (signed-out framing + sign-in doors; signed-in consume),
and the attachAuthUser hook: a brand-new signup whose email holds a
pending invite joins THAT family instead of founding a new one, kids
folding in, which closes the exact hole the founders fell into. Events:
family.invite_sent / family.invite_accepted (MJ-08 registry).

Decisions made alone while building Phase 3:

- Token possession is the join proof (inbox possession, same trust basis
  as phone_link_requests); the invite's email is not re-matched against
  the signer's address, so "invite my husband at his work email, he
  joins with his Gmail" works.
- A signed-in caller who already has their OWN family is refused, never
  auto-merged, and the invite deliberately stays open for retry after
  sign-out; combining two real families remains the by-hand process the
  founder merge documented.
- Both copy gates ran (reader, then editor). Reader findings implemented:
  the no-account case is spelled out on every surface, the /join page
  suppresses the sign-in card's onboarding footer (it routed the invitee
  out of their invite), the invite email got custom footers (the shared
  ones claim "you signed up / you asked", false for a stranger), the
  settings card states plainly that a second parent sees everything, and
  "co-parent" became "another parent". Editor findings implemented:
  one-idea sentences, "account" no longer flips referent mid-email,
  no causal "because" in the footer, naming drift settled.
- A parallel founder session worked the same tree during this build
  (atomic invite claim, escapeHtml in the email sender, thank-you-cards
  feature); its versions were kept, one stomped hunk (the attachAuthUser
  hook) was restored.

## 2026-07-11 (late night) · Multi-parent v0 pulled forward + founder account merge (rulings D-mp-1..7)

Founder ask: merge sidney@recoupable.com and alessallanes@gmail.com
(one family, one child, Story; signup's no-join-path design gave them
two complete families), and use the merge to seed multi-parent family
accounts. Seven founder rulings on a question card, recorded in
plans/2026-07-11-multi-parent-v0-and-founder-account-merge.md: Phase 1
multi-parent slice first, then the data merge, then the full
invite-flow product; Alessa's family row survives renamed "The Swift
family"; her Story row is canonical with latest-answer-wins on the 8
conflicting checklist answers; birth month November 2022; account email
stays alessallanes@gmail.com; the alessa@thankshoma.com test account is
deleted; both members are role 'parent'.

Scope note: PRD 13's "one login per family" M-R boundary is superseded
for this slice by founder ruling (the founders themselves are the
two-parent family). NT-4's invite flow, roles, and per-adult audit stay
a later phase.

What shipped in the slice (migrations #49/#50): per-member
display_name, per-number member attribution, roster read policy,
family_phones one-per-family constraint dropped (number itself stays
globally unique), settings card lists numbers with add/remove, journal
and brief texts fan out to every linked number, inbound email matches
any member's sign-in address, and SMS/voice/web all greet the adult the
channel authenticated.

Decisions made alone while building:

- attachAuthUser's family_phones insert used "on conflict (family_id)",
  which would ERROR (not conflict) once migration #50 drops that
  constraint; switched to a bare "on conflict do nothing", which also
  absorbs the transitional window before #50 applies.
- The verified phone claim's real-family branch used to clear ALL of the
  holder's numbers (clearFamilyPhone deleted by family_id); it now
  removes only the claimed number, which is the correct multi-number
  behavior and a quiet bug fix.
- Both chat clients (web + mobile twins) tripped the react-hooks/purity
  rule on the turn-recovery lastSendRef stamp inside sendMessage;
  suppressed with a comment (event handler, never render), matching the
  file's existing onFinish suppression.

## 2026-07-11 (small hours) · Lost-turn recovery: a dead stream no longer costs her the reply

Founder instruction ("fix the gap"), closing the known gap from the
incident entry below: when the chat stream dies past every reconnect,
the durable run usually finishes anyway, and the reply used to sit
unseen in Postgres behind an error banner. Now the client recovers it.
Both chat surfaces (web + mobile twins, turn-recovery.ts in each).

How it works: on a terminal turn error the client shows "Reconnecting"
instead of the banner and runs recovery in the background. The eve
client wipes its session cursor on a mid-turn death, so the session id
is re-learned from conversation_messages (the persist hook writes the
user message within seconds; members read only their own rows through
RLS; the row must match the sent text exactly and postdate the send).
The durable event stream then replays from index 0 (eve's resumable
streams), reading until a boundary the live client never received
settles the session; a still-running turn simply keeps streaming until
it ends. The full session folds into the transcript archive (the "New
chat" move done for her), the store resets, and the reply is on screen.

Decisions made alone:

- **Replay the durable stream rather than rebuild from Postgres rows**:
  conversation_messages stores plain text only, so folding real events
  through eve's own reducer keeps tool chips, material cards, and
  message identity exactly as a live turn renders them.
- **The interrupted turn's boundary is found by durable index**, a
  client-side cursor (session streamIndex at mount + one per received
  event): session.waiting closes EVERY turn, so a replay of a
  multi-turn session must skip boundaries the client already saw.
- **turn.failed and session.failed at or past that cursor abort the
  recovery**: a genuinely failed turn keeps the honest error banner
  (step.failed does not, the runtime retries model calls).
- **Recovery stands down the moment she acts**: a manual send or "New
  chat" aborts it (a late reply must never land mid-new-conversation),
  and a 4-minute deadline keeps a hung server turn from pinning the
  "Reconnecting" state forever.
- **No new events in the registry**: the failed turn still emits its
  error chat.turn_completed (stream reliability stays measurable);
  recovery is a repair, not a second turn.

## 2026-07-11 (small hours) · Deploys were red: pnpm 9 wrote the eve patch hash, CI and Vercel run pnpm 10

Every deploy and CI run since 4624db6 (the eve ndjson patch) failed at
`pnpm install --frozen-lockfile` with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
Cause: the lockfile's patchedDependencies hash was written by local pnpm
9.15 (short hash format), while CI and Vercel obey the packageManager pin
(pnpm 10.12.1), which computes sha256 hashes and refuses the mismatch.
Fix decided alone: regenerate pnpm-lock.yaml with corepack pnpm@10.12.1
(the pinned version, the one production actually runs), verified on a
fresh clone that the frozen install now passes. The regeneration also
reshuffled a few peer resolutions (styled-jsx gained its optional
@babel/core edge, eslint-plugin-import's resolver key simplified): pnpm
10's resolution, correct for the environment that installs it. Lesson
for humans and agents both: run repo installs through corepack so the
pin wins, or a patch commit from a pnpm-9 shell bricks the pipeline.

## 2026-07-10 (late night) · Homa's contact card: a vCard as the first text

Founder ask: a new number's first text from Homa should carry her contact
card (name, photo, email, site, socials) so a parent saves who's texting
in one tap. Built as a vCard 3.0 served at /homa.vcf and attached as MMS
media; founder picked BOTH trigger moments (a brand-new number's first
inbound text, and the link-notification text when a number connects to a
family on the web). Calls made alone, worth auditing:

- **A route handler over a public/ file**: Telnyx's MMS file allowlist
  names text/vcard; static .vcf serving can fall back to the older
  text/x-vcard, so app/homa.vcf/route.ts sets the content type
  explicitly. The card doubles as a plain download link on the site.
- **The photo is embedded base64, not a URL**: iOS does not reliably
  fetch remote PHOTO URIs inside vCards. public/brand/homa-mark-512.png
  rides inside the card (~21KB total, far under the ~1MB MMS ceiling) as
  a committed generated constant (lib/contact-card-photo.ts, regen
  command in its header) so the route does no filesystem or network I/O.
- **Folding done by hand, verified by script**: vCard 3.0 wants CRLF and
  75-octet folding; get it wrong and phones silently drop the photo. All
  values are ASCII so chars = octets; a tsx check (structure, CRLF, line
  lengths, embedded bytes equal the brand PNG byte-for-byte) passed.
- **The socials are Apple-extension rows**: X-SOCIALPROFILE renders
  TikTok/Instagram on iPhones; Android contact apps ignore those two
  lines and keep name, photo, number, email, site. Accepted degradation.
- **recordLeadContact now returns { firstContact }**: it already
  computed insert-vs-update (xmax = 0); returning it lets the Telnyx
  channel greet only first-ever numbers. The channel's fire-and-forget
  posture holds: the card send chains behind the lead write and can
  never break the agent turn. Known ordering honesty: the card is a
  separate MMS racing the agent's SMS reply, carriers don't guarantee
  which bubble lands first.
- **The link-notification text became the card carrier**: the
  family-phone typo-safety-net text (lib/family-phone.ts) now sends
  through sendHomaContactCard with the same copy plus a card line,
  keeping its STOP escape hatch and dark-channel skip.
- **One new event, sms.contact_card_sent** (trigger: first_text |
  linked, sent boolean), MJ-08 posture, registered and guard-green.
- **Left two pre-existing typecheck errors alone**: agent/schedules/
  dispatch.ts references readTaskRun/finishTaskRun from a concurrent
  in-flight tasks session (untracked lib/tasks/ work); this session's
  files typecheck clean in isolation and ship without touching that.

## 2026-07-10 (late night) · Make her operate smarter: map snapshot in context + calibration laws

Founder arc: the founder texted Homa, watched her guess a counting-to-3
worksheet for a child whose own checklist said counts-to-10 easily, and
ruled "implement all" on the six-point failure review, with multi-kid
behavior considered throughout. Root cause was plumbing, not model:
child_answers never reached the prompt. Shipped:

1. Per-child map snapshot in the family context block
   (lib/family-context.ts): every in-range child gets one line per
   mapped subject (reading, does-easily floor, working edge), scored at
   render time with the same scoreMap the report uses; both load paths
   (pinned + caller RLS) now fetch child_answers. A child with no
   answers renders an ask-first line instead. Calls made alone: the
   "does easily" statement is recomputed from easily answers only,
   because the scorer's strongestObservedStatement also counts
   getting_there items and would mislabel them as easy (verified against
   Story's real rows); snapshot text carries the sibling law (each
   child's section stands alone, never compare).
2. Calibration law in the materials-studio skill + instructions.md:
   difficulty comes from evidence (conversation, snapshot, memories),
   never age alone; no evidence means ONE calibrating question before
   generating; a parent's "she can already do X" is a floor, ask how far
   past before regenerating; the age table is layout density, not level.
   Also the honesty rule (a guess is never dressed up as knowledge),
   placed in Have opinions so the phone persona inherits it.
3. Memory contradiction guardrail (agent-memory.ts + both save paths):
   a save that lands semantically close to an active memory still saves
   but the tool note names the older entry and points at forget.
   Threshold 0.5 cosine distance, calibrated on the real pair (the
   stale counts-to-3 row sat at 0.42 from the counts-to-50 row;
   unrelated same-family pairs measured 0.58+). Scope rule for multiple
   kids: a child-scoped fact compares against that child plus
   family-wide rows only, so one sibling's fact can never flag
   another's. Pinned path computes distance in Postgres; the RLS path
   fetches scoped embeddings and computes in JS (no vector operators
   without an RPC, migration deliberately avoided).
4. Profile non-answer guard (lib/profile-quality.ts): "idk"/"not sure"
   class values are dropped at every write door (addChild,
   saveChildContext, update_child_profile) and skipped at render, so
   "working on idk" can never re-enter a prompt.
5. SMS wait softener (lib/materials/sms-ack.ts): slow material builds
   text one automatic "on it" heads-up, sent from the tool lane
   (generate_image / create_printable) with a 3-minute per-family
   dedupe. Positioned as a tool send like the MMS delivery itself, so
   the one-reply-per-inbound-text law on the model is untouched (the
   chat-sdk bridge drops agent text when a message finishes on
   tool-calls, so the model cannot ack on its own).
6. sms-mode voice fix: follow-ups speak to the parent ("sent you a page
   for Story"), never "sent it to his phone".

Prod data cleaned with the founder watching: Story's "counts to 3
easily" memory superseded, profile focus "idk" removed. Verified:
typecheck, lint, eve build, full build, all five guards green; snapshot
render exercised with a three-kid fixture (mapped kid, unmapped kid,
under-2 kid) and conflict scoping exercised child vs family-wide vs
sibling.

## 2026-07-11 (night) · Incident: live chat turn errored on the phone while the reply finished server-side

Founder report with screenshot (Alessa live-testing on her iPhone,
thankshoma.com): she dictated her day, watched the observation chips
land, then got "that last message didn't go through". Investigation
(Supabase events + conversation log + Vercel runtime logs), the same
failure hit her twice:

- 02:08:46Z turn starts (8 tool calls incl. a 60s worksheet image);
  at 02:10:21Z, 94.6s in, her client errored. The turn finished fine
  server-side at 02:11:28Z; the reply sat unseen in Postgres. Her
  retry in a fresh session died the same way at 113.5s, with ITS
  reply completing 5 seconds after she gave up.
- Root cause: iOS suspends Safari (lock/app switch) and kills the
  socket; WebKit surfaces that as TypeError "Load failed". eve's
  stream client classifies disconnects by message regex
  (abort|cancel|disconnect|premature close|socket|terminated), so
  "Load failed" bypassed the built-in reconnect-and-replay and became
  a terminal turn error, and the client then wiped its session cursor
  (advanceSession resets without a boundary event), which is why her
  next message started a brand-new session.
- Ruled out: server-side failure (both turns completed and persisted),
  a function timeout (the two deaths were 95s and 113s, and the eve
  service stream outlived 90s), and the dictation feature itself
  (transcription returned 200, modality "voice" flowed end to end).

Fixes, decisions made alone:

- **patches/eve@0.19.0.patch** (pnpm patchedDependencies, version
  stays pinned): one line in dist/src/client/ndjson.js broadening
  isStreamDisconnectError with `load failed|failed to fetch|network`,
  the WebKit, Chromium, and Firefox/RN mid-stream death phrasings.
  Stream deaths now resume from streamIndex instead of erroring the
  turn. Patch over fork per the M0-01 tripwire posture (never eject,
  vendor the pinned version); flag this patch on the next eve bump
  (eve-upgrade-check will fail loudly if it stops applying) and drop
  it if upstream fixes the classifier.
- **maxReconnectAttempts 8** (default 3) on both chat surfaces: a
  phone sleeping repeatedly through a 2-minute worksheet turn burns
  one reconnect per wake; replays are cheap (resume, not recompute).
- **Wake grace beat**: the visible-tab stall check (20s) aborted the
  stream the instant a woken tab looked stale, which would have
  killed the newly working reconnect mid-flight. It now waits 5s for
  the reconnect to show life before stopping.
- **Metrics honesty**: onFinish fires for failed turns too, so both
  chat clients emitted chat.turn_completed "ok" AND "error" for every
  failure (visible as 1ms-apart pairs across families all week). The
  "ok" now only fires when the snapshot carries no error.
- **Known gap, logged not built tonight**: a reply that completes
  server-side after the client gave up is still not pulled back into
  the transcript (it lives in conversation_messages and reaches the
  model through recall). The durable-recovery UX (replay the missed
  turn into the archive on next visit) is the remaining M1-04 piece.

## 2026-07-11 (2:30am) · Both switches flipped; first fleet run green; brief goes out Saturday

Founder: "do both", then "actually. have the brief go out tomorrow."
Actions: copy-gate fixes committed (6116cb4) and deployed (READY
2:32am), FLEET_RESEARCH_ENABLED + MORNING_BRIEF_ENABLED added to
production before the build, fleet cron verified registered
(47 6 * * * beside the hourly dispatcher). The first production fleet
run fired on schedule at 2:47am and merged 3 active cited rows
(executive_function ×7 citations, art ×6, fine_motor ×6), demand-picked
from real family reports. Per the founder's tomorrow ruling, the
morning_brief rows were seeded directly at Saturday 9am local (a
one-time exception to the Mon-Fri mask; the advance puts them back on
weekdays after the send). Eligible: Swift + Gomes (texts; lines
linked). Llanes was initially skipped by the report-required rule, then
the multi-parent fold (other work stream, same night) merged the
household into ONE family carrying Story's report, both parents as
members, and both phones; the surviving brief row rebound to it, so
Saturday's send reaches Sidney and Alessa. Founder Q&A logged: the
"score" is Story's progress report (the scored questionnaire from Jul
8); it sat on Sidney's account because he ran that onboarding under his
login while Alessa's text signup had spawned a parallel family.
JOURNAL_PROMPT_ENABLED remains dark, unchanged.

## 2026-07-10 (later, boil the ocean) · Homa's tasks + nightly research: built and proven E2E

Founder: "Implement the plan. BOIL THE OCEAN. then test e2e." All seven
tickets from plans/2026-07-10-homa-tasks-and-nightly-research.md landed
in one pass:

1. **The task framework** (HT-1): migrations #49/#50 (agent_schedules
   gains kinds morning_brief/custom, per-row local_hour + weekdays +
   delivery_pref + paused_at, member SELECT policies; homa_task_runs is
   feed + outbox + health record; knowledge_bank per the education
   plan's Layer 2 + run_id/content_hash/flagged_reason), the kind
   registry (lib/tasks/kinds.ts), and the generalized store
   (lib/tasks/store.ts replaces schedule-store.ts; per-kind seeding,
   weekday masks, delivery windows, atomic leases, outbox on
   (schedule_id, family-local date)).
2. **Fleet research** (HT-2/HT-3): the gate (lib/knowledge/gate.ts:
   citation-must-resolve, invisible-char + HTML stripping, caps, hash;
   failures land flagged, never active), demand queue from real family
   styles/curriculums/subjects with no child data in topic keys, the
   research channel + save_knowledge tool (research/dispatch sessions
   only), nightly fleet-research schedule (dark:
   FLEET_RESEARCH_ENABLED), knowledge-revert.mts (one-action fleet
   revert restoring superseded predecessors), and the glossary seed
   (12 method/format rows merged through the gate into homa-prod).
3. **The morning brief** (HT-4): research-brief SKILL (one angle,
   two-beat frame, capped top-up, guardrails), brief context bundle
   (positions + styles + fresh bank rows), 9am-to-noon send window,
   sendResearchBriefEmail shell, research.brief_sent event. Dark:
   MORNING_BRIEF_ENABLED.
4. **Homa's tasks tab** (HT-5/HT-6): /app/tasks + nav entry, built-in
   cards with pause switches, run-history feed, custom task create/
   edit/delete (form + server actions), chat parity tools create_task/
   list_tasks/update_task/delete_task with the M3-08 no-runaway law
   (dispatch/research sessions refused via lib/tasks/guard.ts).
5. **Events + guards** (HT-7): tasks.run_completed, research.brief_sent,
   knowledge.row_merged registered + emitted; isolation probes for the
   three tables; typecheck/lint/build + all four guards green. Both copy
   gates ran on the tab + brief email shell (reader, then editor); all
   five reader changes and all five editor must-fixes implemented (one
   name per concept: "brief"/"task", sentence-case status lines, the
   skipped-line euphemism replaced with the plain fact + next step,
   "scheduled run" jargon removed, delivery options as plain sentences).
6. **Live E2E green** (scripts/tasks-e2e.mts, dev agent + homa-prod,
   synthetic family cascade-cleaned): seeding, a REAL composed brief
   (Montessori row + the child's phonics frontier + dino interest)
   delivered by email, no em dash and no banned framing in the brief,
   outbox no-op on forced redelivery, custom save-only task run, pause
   switch honored, fleet research merged an active row with resolving
   citations for the demand queue's top topic.

Two findings and one incident, logged for the record:

- **eve receive() resolves at session START, not completion.** The
  dispatcher therefore never judges outcomes; the dispatch/research
  channels finish their own run rows from message.completed, and a
  reaper in the dispatcher fails anything still running after 2 hours.
- **Leftover dev rows caused real sends.** The first E2E fire claimed
  three journal rows seeded into prod by the 2026-07-09 gateway dev
  session (past-due next_run_at); three real families received warm,
  correct journal emails at 11:11pm ET. Contained same session: rows
  corrected to done (they DID deliver), the stray schedule rows purged,
  a 3-hour delivery window added to the journal kind (late claims now
  skip, never send), and the E2E now refuses to run over a non-empty
  agent_schedules table. The class (stale due rows firing after
  downtime) is closed by the windows.
- The prod switches stay with the founder: FLEET_RESEARCH_ENABLED, then
  MORNING_BRIEF_ENABLED after reading a real brief (HUMAN-TODO; the
  fleet cron registers on the next deploy).

## 2026-07-10 (late night) · Homa's tasks + nightly research brief: plan and five rulings

Founder arc: the macmini's nightly research Slack post ("it reminds me
she's working for me even when I'm not using her") becomes a cloud
feature, a 9am Mon-Fri text (email fallback), plus a webapp tab for
Homa's tasks, designed one abstraction level above the single cron. The
founder explicitly challenged the education-knowledge-architecture
plan's "one research agent per family" line ("don't follow blindly");
the finding-unknowns pass ran first (macmini research cron read in full,
founder-authorized exception, code and formats only; two codebase
mapping passes; unknowns split into code-resolved vs founder calls).

Rulings taken on a question card (recorded as D-ht-1..5 in
plans/2026-07-10-homa-tasks-and-nightly-research.md): two-tier research
(fleet corpus + per-family application; per-family web research
rejected on cost O(families) vs O(topics), privacy of child data in
search queries, and council S1 blast radius, with the macmini's own
generic benchmark files as evidence), both proactive loops (9am brief +
8pm journal), the tab ships full management (M3-08 pulled forward,
including its no-runaway-loops law), tab name "Homa's tasks", and
knowledge_bank auto-merge behind an automated gate (M3-04 reconciled
into the fleet tier, the reconciliation the education plan required).
Backlog rows M3-04/M3-08 annotated. Also noted in the plan: PRD §3's
"automated weekly notes (concierge only)" non-goal is superseded for
the daily brief by this direction. No product code this session.

## 2026-07-10 (night) · Voice input in the web chat composer (dictation)

Founder instruction: add a microphone to the chat so moms can talk their
prompts. Shipped as dictation into the composer, the first slice of
FR-4's voice leg (M0-04's exact pipeline: record in the browser, upload,
Whisper, text lands in the chat): a mic button beside send starts a
listening row (pulse dot, elapsed time, X to drop the take, check to
keep it), the transcript lands IN the draft where she reviews and edits,
and only her send sends. Calls made alone, worth auditing:

- **MediaRecorder + server Whisper over the Web Speech API**: the PRD
  already picked MediaRecorder -> Whisper, and the Web Speech API would
  have been the worse call anyway (unreliable on iOS Safari, absent in
  Firefox, browser-dependent quality). Recording uploads to the new
  `POST /api/chat/dictation` (signed-in gate, 4MB cap under Vercel's
  body limit) and transcribes through the same Telnyx STT core the SMS
  voice-note lane trusts: `lib/voice/transcribe.ts` grew a shared
  `transcribeAudio(bytes, contentType)`, and `transcribeSmsMedia` now
  delegates to it. Chrome's webm/opus and iOS Safari's mp4 both already
  map in its extension table.
- **Dictation, not voice notes (scope line)**: no audio is stored, no
  routing, no auto-send; the parent always sees the words before Homa
  does. M1-05 proper (voice notes as turns, routing chips + undo, the
  audio-upload fallback) builds on this route + helper later. The text
  box itself is the denial fallback: a blocked mic or an unclear take
  becomes a quiet hint under the composer, typing never leaves.
- **Copy ran both gates** (reader, then editor). The reader gate's
  biggest catch: at the check-mark moment she could not tell whether
  the check SENDS her raw words, so a hint line now sits under the
  composer while the mic is live ("Tap the check when you're done.
  Nothing sends until you send it."). Failure lines lead with the path
  that always works and name concrete fixes ("Homa couldn't use your
  microphone. Typing works just as well. To talk instead, allow the
  microphone in your phone or browser settings." / "Homa couldn't make
  that out. Try somewhere quieter, or speak closer to the microphone.
  Typing works too."). The editor gate then unified the naming splits
  (microphone never "mic" in copy; both round buttons speak about
  "what you said") and broke the semicolon fusions into sentences.
- **`chat.turn_completed.modality` finally earns its "voice" arm**
  (registry already had it): a turn whose draft took any dictation
  emits modality "voice", so the funnel can see whether moms actually
  talk. No registry change, `check:events` untouched.
- **Recorder discipline**: one state machine in `app/app/dictation.tsx`
  (hook + row + button, split from chat-client.tsx); hardware released
  on cancel/unmount so the browser's recording indicator never outlives
  the take; synchronous double-tap guard so two getUserMedia calls
  cannot leak a live mic; 3-minute auto-accept cap (dictated prompts
  run seconds; the cap keeps every codec under the upload limit at the
  32kbps hint). Listening pulse is opacity/scale only and goes still
  under reduced motion, per the motion rules.
- **Mobile app deferred deliberately**: the Expo chat needs expo-audio
  + mic permission plumbing and can reuse this exact route; web (the
  PWA surface moms actually get first) ships now.

## 2026-07-10 (evening) · Fresh mornings, one thread; photo captions into the archive; the microwave conduct rules

Founder direction (chat-threads investigation, two rulings): (1) returning
to the web chat days later drops her mid-old-conversation and is
disorienting, but the fix is NOT a ChatGPT-style thread list (one family
chat stays the product shape); (2) the Mac mini "microwave" failure (Homa
confidently denied a photo-anchored conversation existed) must be
impossible in the cloud version. "Implement all of this."

Shipped, chat surfaces (web + mobile twins kept aligned):

- **Day separators** in the transcript (`app/app/transcript-days.ts`,
  mobile `src/lib/transcript-days.ts`): Slack-style quiet date rules
  ("Today", "Yesterday", "Friday, July 3"); pre-feature messages group
  under one "Earlier". Times are client-observed (eve events carry
  sequence numbers, not clock times), stamped at turn finish; live
  messages without a stamp read as now.
- **Fresh-morning session rotation** (`app/app/chat-storage.ts`, mobile
  `src/lib/chat-storage.ts`): first visit after 4am local starts a fresh
  eve session (the Hermes/OpenClaw daily-reset shape; idle-only per
  M1-15/TE-04, never mid-conversation). The old session's messages fold
  into an `archived` render cache, so the transcript stays ONE
  continuous scrollable history while the model starts clean; the
  family-context block + memories + recall make the seam invisible.
  Decision made alone: 4am-boundary rule over an idle-hours timer (one
  clear rule, matches both reference systems; overnight always rotates,
  a same-day marathon never does).
- **"New chat" no longer erases**: it archives the visible conversation
  and rotates the session; every word stays on screen above the seam.
  Suggestion chips return whenever the live session has no words yet.
  Why archived messages instead of one merged event log: eve message ids
  derive from per-session turn sequences (`turn_1:user` exists in every
  session), so two sessions replayed through one reducer collide.
- **Bounded storage**: archive capped at 200 messages, current-session
  events at 2000 (trimmed at a turn boundary); Postgres
  `conversation_messages` remains the real record, localStorage stays a
  render cache until M1-02.

Shipped, the microwave class of failure:

- **Photo captions into the archive** (`lib/voice/caption-image.ts`,
  wired in `lib/voice/sms-attachments.ts`): linked-family MMS photos get
  one cheap vision sentence ("[Photo attached: An over-range microwave
  with a loose door handle.]") joined into the turn text, which is what
  the persist hook writes, which is what recall searches: photo-only
  conversations are no longer invisible to memory. Unlinked senders get
  a bare "[Photo attached]" marker (their sessions never persist, a
  caption buys nothing); PDFs get "[PDF attached]" (caption lane for
  PDFs is a noted follow-up). Fail-soft + 20s cap: a slow or failed
  caption degrades to the marker, never stalls the reply. Verified live
  through the gateway (10.6s, default `openai/gpt-5.4-mini`, swappable
  via HOMA_CAPTION_MODEL, off switch HOMA_MEDIA_CAPTIONS=off). Usage
  lands in model_usage as new surface `media_caption` (no migration
  needed, surface is free text by design).
- **Memory-miss conduct** (`agent/instructions.md`): new "When you
  cannot find something" section (a recall miss never proves the
  conversation did not happen; say you could not find it, ask for one
  detail, search again; never explain a miss with a theory about her;
  partial evidence gets stated, never bridged with a story), a Boundaries
  clause (never deny a past conversation because a search came up
  empty), and an out-of-domain line in Have opinions (help with the
  microwave like a capable friend; never "wrong place"). The recall
  tool's empty-result note now says a miss proves nothing.
- **The microwave eval** (`scripts/recall-eval.mts`, `pnpm eval:recall`):
  seeds a synthetic family with the failure's exact shape (a photo-only
  message persisted as its caption, the typed follow-up), asserts
  recall's FTS + semantic arms find it ("microwave", "loose handle",
  and the parent's own sentence), plus a cross-family isolation probe;
  cleans up after itself. Run live against homa-prod: 5/5 PASS.
  Deliberately NOT added to CI (it costs an embedding call and touches
  the live DB; founder-run, like the calibration harness).

Shipped same night, the stuck composer (founder phone-testing report,
"it kept not letting me respond after certain points", screenshots):

- **Root cause**: a phone that locks or backgrounds mid-turn kills the
  NDJSON stream, and a half-open connection can hang without ever
  erroring; the eve store then stays `streaming`, the send button stays
  disabled forever, and no busy label shows once the last text part
  looks complete. The web UI had no stop affordance and no stall
  detection; only a page refresh recovered.
- **Fix, web + mobile twins**: (1) the Claude-composer shape (founder
  ruling, screenshots): while a turn runs an EMPTY composer shows Stop;
  a typed one shows Stop AND Send; Send mid-turn QUEUES the message
  (dimmed bubble by the composer, "Sends when Homa finishes", an X to
  pull one back, a "Send now" link that interrupts the running turn and
  delivers the queue immediately), and the queue flushes as one
  follow-up turn the moment the line is free, including right after
  Stop. A failed turn holds the queue; her next manual send carries it,
  in order.
  `agent.stop()` flips the store back to ready; the turn is durable
  server-side and missed events replay from the session's streamIndex
  on the next send. (2) returning to a visible tab/app aborts a stream
  silent for 20s+ (the backgrounded-phone case, `visibilitychange` on
  web, AppState on mobile); (3) a foreground watchdog aborts at 180s of
  silence (radio handoffs), sized past the longest normal tool run
  since image-heavy printables stream nothing for 60-90s while
  rendering. Decisions made alone: on a stale return the client aborts
  rather than waiting for a possibly-reconnected quiet stream (worst
  case the reply arrives on the next send instead of streaming live,
  and stuck-forever is the failure that burns trust, TE-04 spirit);
  queued messages flush as ONE joined turn, not one turn each (she gets
  one considered reply to her batch, the way texts read); the mobile
  composer stays typeable while Homa works (it used to disable), since
  queueing made "wait to type" pointless. React Compiler note: eve hook
  callbacks must not capture `agent` inside its own initializer (the
  mobile purity rule rejects the whole closure); the store's send rides
  a ref instead, both platforms.

Verified: typecheck, lint, build, all four guards green; eval and caption
smoke run live. Coordinated with the concurrent slash-composer work: the
rewritten chat client wires `SlashComposer` in rather than the bare input.

## 2026-07-10 (evening) · The composer's "/" menu: mention a kid or a skill, token rendered like a link

Founder ask (with Cursor/Cowork screenshots): typing "/" in chat should
open a menu of the kids and the available skills, and a picked item
should sit in the composer highlighted like a link.

Shipped, web chat:

- **`SlashComposer`** (`app/app/slash-composer.tsx`) replaces the bare
  composer input. Typing "/" (at start or after a space) opens a menu
  above the composer: a "Kids" group (avatars from the family palette)
  and a "Homa's skills" group (name + one-line description). Typing
  filters both label and raw token; arrows + Enter/Tab pick, Escape
  dismisses, outside behavior matches the house menus. Picking inserts
  the token ("/Story ", "/materials-studio ") at the caret.
- **Inline link-colored tokens** via the mirror technique: the input's
  own text paints transparent (caret kept) over an aria-hidden mirror
  that renders known tokens in `--brand`. Color is the only difference
  on purpose; a weight change would drift the caret metrics.
- **A kid mention IS a context pick**: picking a kid also writes the
  view-context cookie (same action as the switcher), so the About chip,
  the sidebar rows, and the mention always agree. Single-kid families
  skip the context write (their switcher is hidden, a chip would have no
  way back off).
- **Skills source** (`lib/slash-skills.ts`): the same advertised set the
  agent resolves each turn (family_skills + published, child-targeted
  skill_bank rows, family precedence), name + description only (the
  markdown never enters the page payload), plus a hand-listed built-in
  for the agent's folder skills (materials-studio today). Failure
  posture matches the resolver: menu degrades, chat never breaks.
- **The agent learns the convention** in `agent/instructions.md`: "/" +
  kid name means the message is about that kid; "/" + skill name means
  load_skill that skill and follow it; the token reads as part of the
  sentence.

Copy ran both gates. Reader gate (in character) caught: "SKILLS" directly
under the kids' names misread as the KIDS' skills (a report-card flinch),
so the header is "Homa's skills"; raw skill names read as leaked code, so
rows show a sentence-case label ("Materials studio") while the inserted
token keeps the real name load_skill matches; the About-chip hint pointed
at a control ("change who you're viewing from...") instead of stating the
effect, now "Homa will assume you mean Story."; and the placeholder's
"type / to mention" never finished its thought, now "type / to pick a kid
or a skill". Editor gate then fixed the "/ mentions" garden path and the
chip/hint scope mismatch. Declined: renaming materials-studio itself
(schema-constrained token, founder-sized rename).

Verified: typecheck, lint, build, all four guards green; 8-check
Playwright e2e against the dev server incl. one LIVE turn ("/Story how
old is she?" answered "5", proving cookie + mention + instructions land
together); tonight's synthetic families cleaned from homa-prod (4 rows +
auth users). Known limits, logged not built: no "/" menu on SMS/email
(no composer) or the Expo app yet; skill display names are derived, not
authored (a future skill_bank display_name column would do it properly).

## 2026-07-10 (late afternoon) · Founder ruling: one kid list in the sidebar, the rows ARE the switcher

Founder question on the shipped switcher: why a "Viewing" dropdown AND a
"My kids" list in the same rail? Agent assessment: mostly redundant, and
worse than redundant, they could disagree (tap a kid under My kids, land
on her kid page, the Viewing control still says whole family). The design
kit always intended one control here (`ui_kits/web-app/README.md` calls
that slot the "kid switcher"). Founder ruled: **merge them**.

Shipped: the sidebar's kid list is now `ViewingRows`
(context-switcher.tsx): a "Whole family" row, then the kid rows with age
labels, active row highlighted (brand-soft + check). Tapping a row sets
the app-wide selection and stays on the current surface (kid-scoped pages
swap to the sibling via the shared `kidSwitchTargetPath`); the desktop
dropdown retired. The phone top-right avatar switcher is unchanged, and
the drawer (which renders the sidebar) closes on a row pick via
data-drawer-close delegation. Calls made alone: single-kid families keep
a plain "My kids" link to the kid page (a switcher with nothing to switch
is noise); the kid page's own sibling pills and the report's sibling card
stay for now (in-content affordances, not chrome; founder can rule them
away later); direct kid-PAGE navigation for multi-kid families now lives
one tap deeper (switch to the kid, then their page from planner/report
links), accepted per the ruling. Verified: typecheck, lint, build green;
e2e re-run 24/24 including new checks (drawer row pick narrows the
planner and closes the drawer; desktop shows exactly one kid list, no
dropdown, no "My kids"; live agent turn still answers "Story"); the day's
synthetic families cleaned from homa-prod again (3 more rows + auth
users, zero orphans).

## 2026-07-10 (afternoon) · The context switcher: family or one kid, one selection every surface reads

Founder direction (voice note, midday): the app needs one way to say "who
am I looking at". On the phone, a kid avatar on the top right of the bar
that opens a select (whole family or one kid); the progress report tab
follows it, and chat can focus on one kid without ever refusing to talk
about the others. Founder approved the design and said "implement and
test e2e".

Shipped, web app only (the Expo app has no report or planner surfaces
yet; it gets the same pattern when those land):

1. **One selection, one cookie.** `homa-view-context` (httpOnly, 1 year)
   holds `family` or a child id. `lib/view-context.ts` is the pure
   parser; every reader validates the value against the caller's OWN
   RLS-loaded children, so a stale or forged id degrades to family and
   never reaches a query (tenancy law). The write is a server action
   (`app/app/view-context-actions.ts`) that re-checks the id against
   `getMyChildren` before setting, then revalidates the /app layout.
2. **One control, two hosts** (`components/dashboard/context-switcher.tsx`).
   Phone: avatar button top-right in the bar (the old wordmark-centering
   spacer's spot), menu drops from it, no drawer needed. Desktop: a
   "Viewing" row at the top of the sidebar. Families with one kid never
   see it. Menu pattern matches AccountMenu (Escape, outside tap,
   ease-out entrance); outside tap uses a document listener because the
   phone bar's backdrop-blur would clip a fixed scrim.
3. **Surfaces.** Report tab (`/app/report`) resolves to the selected kid
   first, then first-kid-with-report. On a kid-scoped page (report, kid
   page), picking a sibling navigates to their same page; picking whole
   family stays put. Planner narrows to the kid's column and the heading
   becomes "Story's week"; avatar tones keep the full-family index so
   colors never shift. Chat shows an "About Story" pill over the
   composer with a plain pointer to the switcher.
4. **The agent hears it.** The cookie rides every same-origin eve request;
   the channel's auth walk stamps `attributes.viewChildId` (a UI hint,
   never an auth fact), and `renderFamilyContext` validates the id
   against the family's children before adding one line: assume unnamed
   questions are about the selected kid, a named kid always wins. SMS,
   email, and voice are untouched (no cookie, no line).

Copy ran both gates (reader, then editor). The reader gate's biggest
catch was pre-existing planner empty-state copy ("Every report has a
one-tap month...") that my kid-name variant made worse; reworded to
"A month is four weeks of small activities. One tap in the progress
report builds it, and this page fills in." The editor gate then aligned
the chat hint to the one-name law ("Change who you're viewing from the
top right", matching the screen-reader label) and killed "this board".

Verified: typecheck, lint, build, all four guards green. E2E: 23-check
Playwright pass against a dev server on homa-prod (synthetic 2-kid
family seeded through the real /api/map routes: start, children, claim,
family, 16 base answers per kid, score x2). Covers the founder scenario
exactly (report tab opens the selected kid; the top-right switcher swaps
the report to the sibling), planner narrowing and restore, the chip
appearing without a reload, a forged-cookie probe (degrades to family,
leaks nothing), a foreign-child-id report URL (renders not-found, leaks
nothing), and one LIVE agent turn: with Story selected, "which kid am I
focused on?" answered "Story".

Calls made alone, worth auditing:

- Selection is a browser cookie, not a DB column: per-device on purpose
  (her phone can sit on Amalia while the laptop shows the family), zero
  schema, and the agent reads it per turn with no new plumbing. If
  cross-device memory of the selection ever matters, this becomes a
  `families`/member preference column.
- Chat focus is a soft default, never a filter: the focus line only
  settles ambiguity, so "what about Amalia?" mid-focused-chat just works.
  No per-kid transcript separation yet (tester memo 3 wants it; that is
  M1-02 conversation-persistence territory).
- Report tab with a selected kid who has NO report follows the standing
  law (their report page routes to /onboarding, where the questions
  live) instead of silently showing a sibling.
- Housekeeping: the 6 synthetic e2e families (and their auth users) were
  cascade-deleted from homa-prod after the run, verified zero orphans;
  report emails to the @example.com addresses bounced by design. The
  expired `VERCEL_OIDC_TOKEN` in `apps/web/.env.local` (73 hours past
  expiry, local chat was dead) was replaced with a fresh `vercel env
  pull` token, and the dev server on :3000 was restarted clean.

## 2026-07-10 (night) · Incident: /app 500 for ~15 minutes after the skill-graph push; fixed, CI hardened

What the founder saw: thankshoma.com/app returning 500 (Server Components
render error) at ~9:00pm. Root cause was two stacked failures:

1. **The skill-graph deploy failed on Vercel's eve build step**, which
   compiles agent tool modules outside Next's bundler. record_observation
   imported next/server (after) and, through @homa/taxonomy's index, the
   createRequire JSON corpus loader; neither resolves in that context.
   next build passed locally and on Vercel, so every local check was
   green while the deploy itself died.
2. **The database had already been migrated** (subject rename, applied
   ~8:40pm) while production kept serving the previous build, whose code
   still read child_plans.domain_id and scores.domains. Old code against
   new schema is what 500'd. The sequencing mistake, applying a breaking
   rename migration hours before the matching code shipped, is the agent's
   and is logged here so it isn't repeated: for breaking renames, migrate
   and deploy inside the same window, migration last or expand-contract.

Fixes, verified live (deploy READY 21:08, / 200, /app 307 → signin 200):

- record_observation drops after() for a fire-and-forget narrative kick
  and imports the domain registry via a new JSON-free
  @homa/taxonomy/domains subpath; the hub-topic try-at-home probe left
  the tool payload until the corpus has a tool-safe loading shape
  (8a72df2).
- CI now runs `pnpm --filter web exec eve build` after the Next build,
  so this deploy-only failure mode fails the checks first (1930200).

## 2026-07-10 (evening) · The skill graph ships: subject → domain → topic live, the rename executed, the agent writes the map

Founder instruction: "OK IMPLEMENT. BOIL THE OCEAN." Executed the
skill-graph plan's sequencing steps 2-4 plus the record_observation loop
pulled forward from step 8 (per the risk pass earlier today: the loops,
not the corpus, are the critical path). Everything verified green:
typecheck, lint, build, check:map, check:events, check:taxonomy (new),
check:isolation, check:skills-targeting.

- **@homa/taxonomy rebuilt as the runtime graph.** Assembly derives Homa
  topics from the vendored Marble data + a frozen append-only slug map
  (1,590 topics as `<subject>.<slug>` ids, founder id ruling honored: no
  marble_id anywhere; lineage as `marble:` refs beside standards refs).
  3,221 edges, 183 clusters, standards registry, centrality recomputed
  over the Homa graph. 102-domain registry: 55 Marble-derived + 47
  authored (gross_motor, fine_motor, self_care, music, art, spanish get
  full domain scaffolding from the Mac Mini's strand vocabulary; five
  interest-led science domains + three history eras land as kind
  "content", materials hooks, never assessment). Life Skills parked as
  its own subject per the plan. Cluster-only pairs (Earth & Human
  Activity, Heredity & Evolution) mapped so upstream topic drops land.
- **The rename window (users ≈ 0, now or never).** domain → subject in
  packages/core (MapSubject, MAP_SUBJECTS, SubjectScore.subjectId,
  scores.subjects, totalSubjects, MONTH_PLAN_SUBJECT, subjectLine...),
  events registry + every emitter (props domain → subject,
  mapped_domains → mapped_subjects; stored analytics rows untouched,
  append-only), apps/web (route folder plan/[subjectId], next.config
  agent pin, ?subject= query key), guards and fixtures. Migration
  20260711003000_subject_rename applied to prod: child_plans.domain_id →
  subject_id; scores, history, and plan jsonb rewritten in place (7
  reports + 7 plans, zero stale keys verified by query). Isolation suite
  green after.
- **check:taxonomy** joins the CI guard set: upstream checksums +
  referential integrity, then the Homa laws (every Marble pair mapped,
  ids unique and bank-collision-free, DAG acyclic, every bank item
  assigned to an assessment domain of its own subject, every ref
  resolves). The 224 bank items each got a hand-curated level-2 domain
  (packages/core/src/map/item-domains.ts).
- **record_observation shipped** (the Mac Mini comparison's gap #2): the
  agent can land "she read a whole Bob Book by herself" as a chip answer
  with provenance 'conversation', deterministic rescore, off-turn
  narrative regeneration (same after() pattern as the correction route),
  and a reply payload with receipts: skill line, fresh position, next
  ladder rung, and a personalized try-at-home probe from the graph's
  hub topics. Instructions table row added.
- **Live side effect, disclosed:** the write path was verified against
  the real Llanes Story (math.counts-past-20 = easily, source
  conversation), which moved his math read from on_track +5 to ahead +11.
  That matches the Mac Mini's verified ground truth (counts to 30,
  2026-06-19), so it was kept as a correction, not reverted; his report
  narrative regenerates on next view via the status route.
- **Deferred, tracked in the plan:** plan-jsonb prerequisite enrichment
  and report domain receipts (gated surfaces), 2-4 band topic authoring
  inside the authored domains, freshness decay policy, snapshot cadence.
  Mobile lint carries a pre-existing error in the founder's uncommitted
  chat-session WIP (untouched); web chat-client gained the two props its
  page already passed (kids, slashSkills) so typecheck runs clean.

## 2026-07-10 (afternoon) · Founder ruling: build the taxonomy on Marble's open dataset; vendored at docs/homa-benchmarks/marble

Context: a deep comparison of the Mac Mini Homa's benchmarking (15 domains,
78 scored subdomains, continuous observation loops) against the cloud map
(16 domains, one number each, one checklist sitting) concluded the cloud is
missing a strand layer between domain and item. Marble's open skill taxonomy
(github.com/withmarbleapp/os-taxonomy, v1: 1,590 micro-topics, 3,221
prerequisite edges, 8 subjects / 54 domains, ages 4-14) independently
validates that three-level shape and adds a prerequisite DAG.

Founder rulings this session, logged for the audit trail:

- **Adopt Marble as source material, maximally.** Pull the graph, the
  topics, the evidence/probe shapes, the clusters. "We're at the beginning
  stages of building out the architecture, so we might as well use the best
  architecture possible."
- **Do not gate on licensing now.** Upstream is ODbL 1.0 + CC BY-SA 4.0;
  obligations bite on public use/redistribution of a derivative database,
  not private internal use. Founder: "If it ever gets to a place where we
  need to credit Marble, we will." License files vendored alongside the
  data; attribution line staged in README-HOMA.md so honoring that promise
  is one paste away.
- **Vendored** `data/`, `schema/`, and `validate.mjs` at upstream commit
  96a7933 into `docs/homa-benchmarks/marble/` (4.0MB, media skipped);
  validate.mjs passes (checksums + referential integrity). Provenance and
  usage notes in `docs/homa-benchmarks/marble/README-HOMA.md`.
- **Naming direction (founder asked, agent recommended):** converge on
  Marble's vocabulary where the data will flow 1:1 (subject → domain →
  topic, prerequisites hard/soft with reasons, evidence + assessmentPrompt,
  clusters, centrality, topic types); keep Homa's own where Homa is ahead
  (typical-by month anchors, the deterministic months-ahead scorer with
  honesty caps, chip answers, provenance enum, exposure-based subjects,
  no-deficit copy laws, RLS). Rename today's code/DB "domain" to "subject"
  as part of the strand migration, while user count is ~zero.
- **Ids are Homa's own (founder ruling, same day):** no `marble_id` field
  anywhere. Every topic, imported or authored, gets a Homa id in the
  existing bank convention `<subject>.<slug>` (existing 225 item ids stay
  valid, so child_answers rows never migrate). Upstream lineage lives in a
  namespaced `refs` array (`marble:mt__h7hvT4tEb`, `ccss-math:K.CC.6`),
  making Marble one cited corpus among several, not a schema-level parent.
  Full architecture: `docs/homa-planning/plans/2026-07-10-skill-graph-taxonomy.md`.

## 2026-07-10 (afternoon, follow-up) · The whole-picture dot chart retires from the report

Founder ask: delete "The whole picture" card from the report on every
surface (in-app desktop and phone, and the emailed token page; the
sample shares the renderer so it goes there too). The snapshot's
trajectory chart and the subject rows already carry the same
information. One call made alone: report-chart.tsx stays, the
one-pager rendition still renders it. Verified on the live sample
page; the in-app grid loses the one full-width section.

## 2026-07-10 (afternoon) · The in-app report lays out as a dashboard, not one long letter

Founder ask: on desktop the in-app report should read as a dashboard,
sections as cards across the screen, not one long scroll; the note from
Homa is its own card, the hero heading its own element. Built inside
ReportView: the report's pieces (hero band, note letter, snapshot,
whole picture, subject by subject, state, methodology, sibling and
next-kid offers, footer actions) are now built once as JSX pieces and
arranged twice: the token/sample page keeps the exact one-card letter,
and context="app" lays the same pieces on a PageColumn-width grid (one
column on phones, two from lg, wide sections spanning both). Calls made
alone, worth auditing:

- **Pieces, not two renderers**: one set of JSX consts arranged by two
  return paths, so the letter and the dashboard cannot drift in
  content. Spacing moved from baked-in mt-9 margins to the layout
  (ReportSnapshot and StateCard grew a className prop for it).
- **Grid shape**: hero full width; note and snapshot side by side; the
  whole picture and subject-by-subject each full-width cards (their
  charts and rows need the room); state beside methodology; footer
  actions as a full-width bar. Order on phones matches the letter's
  reading order exactly.
- **Verified live**: a fresh onboarding run rendered the grid (note and
  snapshot geometrically side by side at 1380px), the phone stack, and
  an unchanged standalone sample. Build and all four guards green;
  throwaway rows deleted after.

## 2026-07-10 (midday) · The progress report becomes the app's home surface; the card dashboard retires

Founder ask: the report is not "onboarding results", it IS the
dashboard. Once the questions are done, onboarding is over: land the
parent inside the app, on the report, with the sidebar around it, and
keep emailing the report link. Built: `/app/[childId]/report` renders
the same ReportView as the token URL inside the /app frame; scoring's
final hop goes there instead of `/onboarding/r/[token]`; the card
dashboard (`/app/dashboard`) is deleted. Calls made alone, worth
auditing:

- **Two routes, one per-kid and one stable**: reports are per kid, but
  the nav tab renders with no kid in hand, so `/app/report` resolves to
  the first kid with a report and the tab (`Progress report`, FileText
  icon) lights for any `/app/*/report` path. `/home`, `/app/home`, and
  `/app/dashboard` all redirect to the resolver.
- **One renderer, a context prop**: ReportView gained
  `context="standalone" | "app"` instead of a second component. In-app
  it drops the token page's own nav, the dark CTA band, and the footer
  dashboard link (the frame carries those jobs), renders a div column
  (the frame already owns `<main>`), and links sibling reports directly
  (`/app/[id]/report`, session-scoped) where the shareable token page
  deliberately never embeds sibling tokens.
- **The token URL keeps its job**: it is the emailed/shared door
  (sendReportEmail was already sending it at scoring; nothing new to
  build for "email them the report"). Its dashboard CTAs became "Open
  this report in Homa" (the in-app report) and the ReportNav pill
  became "Open Homa" (/app).
- **Dashboard cards**: greeting, family note, and the hours card
  deleted (with lib/hours.ts, dashboard-only). The memories card MOVED
  to /app/settings rather than deleted: it is FR-9's visible-undo
  surface, and deleting it would have orphaned the memory.forgotten
  event (events-check parity). KidCard deleted; its kidPill standing
  chip survives as kid-pill.tsx for the per-kid page. TimeZoneSync
  moved from the dashboard page into the /app layout so the device
  zone still gets captured on a family's first app visit (the evening
  check-in's timing reads it).
- **Verified end to end**: a real onboarding run (account, family card,
  kid, 96 answers, scoring) landed on `/app/{childId}/report?fresh=1`
  with the tab active, the phone hamburger bar present, the token page
  still standalone, and the sample report untouched. Build plus all
  four guards green; throwaway rows deleted after.

## 2026-07-10 (late morning) · Word and Excel lanes added; HEIC and Live Photos confirmed as non-issues

Asked to extend the never-deny-input normalizer to every file type a mom might
actually send (Excel, Word, HEIC, Live Photos, PDF, video), researched each
claim rather than assuming, and built only what the research showed was real
and missing. Calls made alone, worth auditing:

- **HEIC and Live Photos needed no code**: Homa's Telnyx number is not
  iMessage-registered, so every iPhone text to it is a green-bubble SMS/MMS
  fallback. Verified (multiple independent sources, including Apple Support
  Communities threads): iOS unconditionally transcodes HEIC to JPEG and
  flattens a Live Photo to a plain still JPEG before that fallback ever
  leaves the phone, motion and the HEIC container never survive the trip.
  Both already ride the existing JPEG image lane; nothing to build, and
  saying so plainly beat inventing a HEIC decoder for input that never
  actually arrives in that format.
- **Word (.docx) and Excel (.xlsx/.xls) lanes added and verified live**:
  generated real fixtures with LibreOffice (docx, doc) and SheetJS's own
  writer (xlsx, then converted to legacy xls with LibreOffice), ran them
  through the actual `normalizeSmsAttachments` function end to end. `mammoth`
  extracts .docx text verbatim; `xlsx` (SheetJS) extracts both modern .xlsx
  and legacy binary .xls to CSV. Legacy binary .doc (pre-2007 Word) is
  explicitly NOT supported: mammoth only parses OOXML, verified live it
  throws a clean "not a zip file" error on a real .doc rather than hanging,
  so it lands in the acknowledgement lane exactly as designed.
- **The one honest unknown, stated plainly rather than hidden**: whether
  Telnyx's inbound MMS webhook forwards docx/xlsx content types AT ALL is
  not verified, only the extraction logic is. Telnyx's own documented
  "Files" allowlist lists only pdf/vcard/calendar; separately, Aerialink's
  docs state an iPhone cannot attach ANY document format to a green-bubble
  MMS outside iMessage, and Android support is carrier- and app-dependent.
  Built the lane anyway since it was cheap (two well-established libraries,
  no new infrastructure) and correct if it ever fires, rather than waiting
  on unverifiable-until-real-traffic carrier behavior; `sms.attachment_processed`
  (kind: document, media_type: docx/xlsx/xls) will show the true trigger
  rate once texting goes live after 10DLC provisioning finishes.
- **`sms.attachment_processed` gained a fifth outcome, `extracted`**,
  distinct from `inlined` (raw text files) and `model_native` (PDF passthrough),
  so analytics can tell a dumb byte-decode apart from an actual document-
  format parse without needing to look at `media_type` for every row.
- **Left one file's typecheck failure alone**: `pnpm typecheck` fails on
  `app/onboarding/r/[token]/report-view.tsx` (a JSX tag mismatch), a file
  this session never touched and git shows modified by other concurrent
  work. Verified this session's own file typechecks clean in isolation and
  left the unrelated in-flight file for its own session to finish.

## 2026-07-10 (mid-morning) · The BMP gap closed instead of deferred; a stale STAGED_EVENTS cleanup

Asked directly why the two attachment gaps flagged right after the normalizer
landed (BMP images, non-PDF/text files) needed production telemetry to
resolve, rather than being findable right now. They didn't: Telnyx's own
documented MMS allowlist (already researched earlier the same morning) is
public information, cross-referencing it against the code's lanes settled
both immediately, no waiting required. Calls made alone, worth auditing:

- **The "other" file bucket is dead code, not a gap**: Telnyx's carrier-level
  MMS file allowlist is only `application/pdf`, `text/vcard`, `text/calendar`
  (per their receive-message and send/receive-MMS docs); all three already
  have working lanes. A generic file (docx, zip, apk) cannot reach this
  channel over MMS in the first place, so the "other" branch is a safety net
  for a case the carrier itself won't deliver, not a real product gap.
- **BMP was real, and got fixed rather than left open**: Telnyx's allowlist
  does include `image/bmp` (legacy Android/WAP-era support), and Claude's
  vision API only accepts jpeg/png/gif/webp (verified against Anthropic's
  docs). `sharp` (already a dependency, used by Next's image optimizer)
  cannot decode BMP either, verified live with a real ffmpeg-generated BMP.
  Added `@huh-david/bmp-js` (zero dependencies, actively maintained, ships a
  purpose-built sharp adapter: `sharpFromBmp(bytes, sharp).png().toBuffer()`)
  and wired it into `sms-attachments.ts`'s image lane as a `converted`
  outcome. Verified live end to end: a real BMP converted to PNG, and the
  resulting image part read correctly ("Red") through the actual gateway
  model call, not just a unit-level pixel check.
- **Modern phones essentially never send BMP** (confirmed: it's a legacy
  Windows/WAP-era format some old Android MMS stacks still list, not
  something a camera or Photos app produces), so this was a real but rare
  gap, closed anyway since the fix was cheap (one small, well-scoped,
  zero-dependency package) rather than deferred on frequency alone.
- **Found and fixed unrelated damage while running the guard**: `pnpm
  check:events` failed on three STAGED_EVENTS entries (`materials.created`,
  `materials.image_generated`, `sms.attachment_processed`) that all already
  had real emitters, left behind by a separate in-flight worksheet-materials
  session. Removed all three per the script's own stated convention (remove
  a staged entry once its emitter lands); this is registry hygiene, not a
  behavior change, and touches no worksheet-studio code.

## 2026-07-10 (morning) · Every SMS attachment gets a lane: the never-deny-input normalizer

Founder ruling: the channel boundary should recognize anything the model
cannot use and convert it, whatever arrives; input is never denied.
Yesterday's voice-note transcription generalized into an attachment
normalizer (`lib/voice/sms-attachments.ts`) the Telnyx channel runs on
every inbound attachment: photos pass through as image parts, voice
notes AND video clips become speech transcripts (same Telnyx STT, which
extracts a video's audio track server-side), PDFs pass to the model as
native document parts, contact cards and other text-format files inline
as text, and anything unreadable becomes a bracketed note the agent
acknowledges in its one reply. Calls made alone, worth auditing:

- **Video understanding = its audio track, for now**: the founder named
  Whisper as the video lane and Twelve Labs as a future add; the
  normalizer's video lane is one function, so a visual-understanding
  swap stays one file. Verified live: a synthesized mp4 with a speech
  track transcribed verbatim through `/v2/ai/audio/transcriptions`.
- **PDFs ride as downloaded base64 bytes, not URLs**: base64 survives
  every JSON serialization through eve's session storage, and the
  model leg is proven (a generated PDF pushed through the live gateway
  as a file part; Claude read its one sentence back). A 4MB guard
  bounds the download; carriers cap MMS near 1MB anyway.
- **Unsupported image subtypes fail soft instead of passing through**:
  Claude accepts jpeg/png/gif/webp; a bmp/tiff image part would error
  the whole turn at the provider, so those take the acknowledgement
  lane. Phones effectively never send them (HEIC transcodes to JPEG in
  the MMS pipeline).
- **`sms.voice_note_received` (one day old) replaced, not kept**: the
  general `sms.attachment_processed` event (kind, media_type, outcome,
  linked_family) covers every lane including the old one; keeping both
  would double-count voice notes. Same MJ-08 posture: no content, no
  numbers, media_type + outcome is the whole telemetry story.
- **The fail-soft direct reply generalized**: any all-failed,
  no-typed-text inbound gets "I couldn't quite make out what you sent.
  Mind trying again, or typing it?" instead of the voice-note-specific
  copy; a failed attachment riding with other content stays a bracketed
  note inside the single agent reply (one-reply law holds).

## 2026-07-10 (evening) · "Finish it": the gateway proven in production

Founder: "OK FINISH IT." Finishing meant proving the live wiring, not
writing more of it:

1. **Email loop, production, end to end**: a real inbound payload to
   the deployed webhook became a real agent turn on the production
   runtime: both conversation rows (channel 'email'), 40 reading
   minutes (source='email'), a saved memory, the reply email
   dispatched, and "stop" flipping journal_opt_out_at without a turn.
   Synthetic family cascade-cleaned, events swept.
2. **Dispatcher cron confirmed mounted in prod** (vercel crons ls: the
   eve schedule runs hourly beside /api/map/cron). The journal loop is
   one env var from live.
3. **Ledger cleanup**: HUMAN-TODO's dead items closed (Telnyx sole-prop
   registration superseded by the account upgrade; the hello@ alias
   superseded by reply-to-the-agent), gateway-plan GW-8 marked to
   reflect reality, and the two genuinely-founder items called out
   plainly: the JOURNAL_PROMPT_ENABLED read-aloud switch, and the
   Alessa duplicate-family deletion decision.

State of the doctrine after five days: every conversational door (web,
SMS, email) is an adapter on the ONE agent; voice stays federated by
documented exception; strangers become leads, get signed up entirely
in-channel, and reconcile to one family per mom with proof at every
seam; the only proactive loop still dark waits on one founder
read-aloud.

## 2026-07-10 (afternoon, later) · The verified phone claim closes U2/U7

Founder: "just do the fix, the verified phone claim." Built on the
existing SMS rail, no new services: phone_claim_codes (migration #47,
deny-all; 6-digit codes hashed at rest, 10 minutes, 5 attempts, 3
sends/day), lib/phone-claim.ts (start/confirm; familyId always from the
caller's own session), two thin routes, and one PhoneClaim component
mounted at both former dead ends: the settings texting card and the
onboarding family step (which now saves the profile and OFFERS the
claim when the number is taken, instead of the old silent stand-down).

The entitlement rule, stated once: a verified code proves possession of
the NUMBER, so the number routes to the claimant's family. A true stub
holding it folds in (shared conservative fold, lib/family-fold.ts,
extracted from phone-link); a real family holding it keeps all its
records and loses only the routing. Data merges between two REAL
families stay a human decision; no code path does that.

16 lab checks green against prod (lifecycle, all holder cases, limits),
full guard suite + build green. The moved-from family gets no courtesy
notice yet; noted as a nicety for later.

## 2026-07-10 (afternoon) · Unknowns pass on text signup: one mom, one account

Founder caught the seam within the hour: "she signs up by text, then
signs in with Google on the web: separate account." Ran the
finding-unknowns blindspot pass over every text-web seam; seven
unknowns surfaced (U1-U10 in sms-onboarding-plan.md §Unknowns pass),
five fixed and verified same session (12 lab checks against prod),
two documented with their future design (verified phone claim).

The load-bearing changes: email moves to the FRONT of the text flow
(it is the reconciliation key; fold-together attaches her later web
login to the text-born family), and the reverse case gets a real
mechanism: a taken email now triggers a one-time connect-this-phone
email to that account (migration #46, inbox possession as proof,
conservative stub-fold that moves children and records before retiring
the empty shell). Also fixed en passant: attachAuthUser normalizes
mixed-case IdP emails (latent constraint violation), state seeds a
coarse time zone so the journal dispatcher can reach text-born
families, finishChildReport gains web-parity (report_generated event,
report email, detached narrative kick), and duplicate kids by text
return the existing child.

## 2026-07-10 (midday) · Homa performs signup over text, end to end

Founder overruled the morning's Phase B ruling in plain terms: "the tap
is not the goal... she should just perform the onboarding there." Plan:
docs/homa-planning/sms-onboarding-plan.md, all boxes closed same day.

Shipped:

1. **lib/sms-onboarding.ts**: the one server path for text signup,
   reusing the web flow's exact store functions (startAnonymousFamily,
   saveFamilySetup, addChild, saveAnswer, createReport), so a family
   built by text is indistinguishable from one built on the web.
   signupProgress() answers "what is still needed" at every step; the
   adaptive queue (planQuestions + the easily-ladder) is shared with
   the web checklist via the same buildQueue module.
2. **Six tools** (SMS sessions only, family resolved from the session's
   own phone, never model input): begin_text_signup (opens or resumes,
   reports what is missing), signup_set_family, signup_add_child,
   signup_record_answer (the model translates the parent's natural
   phrasing to the answer enum; every result carries the NEXT
   question), signup_set_email (refuses addresses owned by another
   family; no folding without a real sign-in), signup_finish (scores,
   returns the permanent report link for Homa's own reply).
3. **No auth user over text, by design**: scoring needs only
   families.email; the report link is possession-auth; the phone link
   makes every later text a full-context linked session; and the web
   claim path's fold-together attaches her auth user to this same
   family whenever she first signs in. No service-role key exists or
   is needed.
4. **Groundwork**: migration #45 ('sms' joins families.source and
   waitlist.source; the claim-time waitlist mirror carries it),
   signup.sms_completed event, sms-mode signup instructions (one
   question per text, honor skip/not-sure, answer real questions
   mid-flow, resume any time).
5. **Verification** (against homa-prod, cascade-cleaned): lib lifecycle
   18/18 and tool-layer 11/11, including refusal walls (non-SMS
   sessions, tools before begin, finish before email, taken email) and
   a full adaptive checklist run (23-27 answers to completion for a
   4-year-old).

Ruling recorded: the "Subscription Account Tables" half of the ask
stays gated on the entity + pricing decisions (lead-funnel-plan Phase
C): when billing exists, Homa's close is a texted Stripe Checkout link
plus webhook-driven state, never card numbers on-channel.

## 2026-07-10 (morning) · Strangers become leads; Homa gets concierge mode

Founder ask: unknown texters and callers should (1) leave their number,
(2) get pushed toward signup, (3) be signable-up by Homa herself,
"pleasant sales lady mode", including cards and subscriptions. Plan
file: docs/homa-planning/lead-funnel-plan.md (Phase A built; B and C
are rulings, below).

Shipped (Phase A, all 14 verification checks green, voice assistant
re-provisioned live):

1. **phone_leads** (migration #41, deny-all RLS): every unknown text
   (telnyx.ts) and unknown call (/api/voice/context) upserts a lead row:
   number, first channel, contact count, status
   new/engaged/invited/converted. Linking a phone (settings card or the
   onboarding bridge) flips the lead converted automatically.
2. **capture_lead tool** (unlinked SMS sessions only): saves the name,
   email, and situation a stranger volunteers, keyed by the SESSION's
   own number, refuses linked sessions. Marks 'invited' when the reply
   carries the signup link.
3. **Concierge mode**: sms-mode's unlinked branch and the voice
   assistant's unknown-caller block rewritten: answer the real question
   first (the help IS the pitch), then ONE offer of the free progress
   report at thankshoma.com/onboarding ("about five minutes, no card",
   same-number auto-link explained), drop it if declined, never a
   second pitch, never payment talk on the channel.
4. **send_signup_link voice tool**: texts the onboarding link to the
   caller's own number ({{telnyx_end_user_target}} templated, model
   never picks the destination), refuses linked callers, 2/day cap per
   number, failed sends fall back to saying the link aloud and never
   mark invited. Events: lead.captured / lead.invited / lead.converted
   (channel only, MJ-08 clean).

Rulings made alone (Phase B/C, logged for founder review):

- **No text-native account creation in v1.** The web onboarding IS
  signup (five minutes, no card, ends in the report: the converting
  moment). Homa's job on the channel is getting the tap. Text-native
  accounts would mint empty workspaces and skip the magic. Revisit only
  if lead conversion data says the tap is the cliff.
- **Homa never takes card numbers over SMS or voice, ever.** Card data
  would land in Telnyx logs, transcripts, conversation_messages, and
  model context (instant PCI scope), and carriers filter card-number
  texts on 10DLC campaigns. When billing goes live (LLC-backed Stripe
  activation), the conversational equivalent is a send_checkout_link
  tool texting a Stripe Checkout URL (Apple Pay one tap) plus the
  webhook flipping subscription state. Same warmth, zero compliance
  surface. Blocked on entity + pricing rulings, ticketed in the plan.

Note: this session's build ran against the tree while the parallel
session's SMS voice-note work was mid-flight; final green CI rides with
that session's commit.

## 2026-07-10 (midday) · Materials studio v2 + the per-family usage ledger, shipped and E2E-verified

Founder direction (2026-07-10 morning, two asks): (1) generalize the
worksheet pipeline into a creation capability (choose image-model vs
HTML vs hybrid per request, references, self-critique, metadata,
draft-vs-final), and (2) track AI consumption per family across every
modality through the Gateway. Plan:
plans/2026-07-10-materials-studio-v2.md (all eight tickets, one pass);
founder said "implement and then test e2e", so the four open decisions
went as recommended there (renames yes, cheap vision reviewer, draft
bytes deleted on finalize, eve gateway-tags ask logged below).

What shipped, by ticket:

- **MS-6, the ledger first.** `model_usage` (migration #43, deny-all
  RLS): one append-only row per model call, raw quantities only (the
  future action_costs registry prices them; credits stay post-revenue
  per 08-billing). Chat turns land via a new `step.completed` hook
  (`agent/hooks/record-usage.ts`, familyId/channel from session auth,
  all channels); every direct AI SDK call site records itself AND tags
  the Gateway request with `providerOptions.gateway.{user: familyId,
  tags: [surface]}` so `/v1/report?group_by=user` shows the same spend
  provider-side (verified against current Gateway docs): images,
  artifact review, report/plan narratives (familyId threaded through
  narrative-runner), curriculum (threaded through the insights route),
  memory extraction, embeddings (optional attribution param, all six
  call sites). `pnpm usage:report` reads per-family totals; --reconcile
  queries the Gateway. Known gaps, logged: eve's own chat calls cannot
  carry per-family gateway tags yet (static providerOptions only,
  upstream ask), compaction summary calls are unrecorded
  (compaction.completed carries no usage), and step.completed carries
  no model id so chat rows pin HOMA_MODEL.
- **MS-1/2, the paths.** `lib/illustrations.ts` became
  `lib/materials/generate-image.ts` (with `lib/print/*` moving to
  `lib/materials/`): image generation is no longer illustration-shaped,
  takes up to 4 reference images (fetched server-side, ONLY from this
  family's own blob prefix, model-supplied foreign URLs refused), and
  `create_printable` (replacing `create_worksheet`) accepts exactly one
  of `html` or `pageImageUrl`, so the image model can draw entire pages
  (wrapImagePage fits them to letter, D7 footer intact).
- **MS-3/4, the library.** Migration #44 renamed `worksheets` to
  `materials` (zero rows, verified before renaming) and added kind /
  subject / curriculum / theme / characters / tags / source / status /
  revises / approved_at. New tools: `mark_material_final` (approval
  supersedes the revision chain and deletes DRAFT bytes only; anything
  once-final keeps bytes) and `find_materials` (finals by default,
  by-id fetch returns stored html for reuse). RLS update policy added
  for the finalize flow; isolation checks extended (materials +
  model_usage).
- **MS-5, the eyes.** `lib/materials/review-artifact.ts`: a cheap
  multimodal model (HOMA_REVIEW_MODEL, default openai/gpt-5.4-mini;
  HOMA_MATERIALS_REVIEW=off kills it) reads the RENDERED pixels against
  the brief inside create_printable and returns {pass, issues[]} to the
  agent. On SMS a failing page is deliberately not texted; web still
  shows the card (iteration is visible). Null review never blocks.
- **MS-8, the judgment.** worksheet-studio skill retired;
  materials-studio skill carries the path-selection table, reference
  discipline, metadata discipline, and the finalize loop.
  instructions.md and sms-mode.ts rewritten around choose-the-path;
  web+mobile cards renamed MaterialCard with kind-based headlines
  (legacy create_worksheet transcript payloads still render).
- **MS-7, the evidence.** `pnpm materials:calibrate` ran the 7-brief
  set through the paths against live gpt-image-2
  (docs/homa-planning/materials/calibration/2026-07-10/): image-direct
  is far stronger than assumed (correct tracing page, EXACT 3/5/7
  counts, six correctly spelled flash cards, exact poster wording), the
  reference-restyle held style while swapping the character, and the
  one hybrid failure (repeating a full-page image as a unit) was caught
  by the auto-reviewer. The skill's decision table was rewritten FROM
  these findings, dated, with the stale "never trust image models with
  counts" rule retired.

E2E (live, against homa-prod + Gateway + Blob, synthetic family,
cascade-deleted after): 22/22 checks passed, covering both image tools,
foreign-reference refusal, hybrid + image-direct creation, review
pass AND a true-positive fail (wrong-letter page flagged), revision
lineage, finalize semantics (draft superseded + bytes 404, final bytes
200, unrelated draft untouched), finals-only retrieval, and usage rows
for every surface. Typecheck, lint, build, and all four guards green.
One deprecation fixed along the way: AI SDK image content parts are now
`{type:"file", mediaType}` (the "image" part type is deprecated in ai@7).

## 2026-07-10 (morning) · Worksheet illustrations moved off fal.ai onto the Vercel AI Gateway

Founder call: use `openai/gpt-image-2` through the Vercel AI Gateway instead
of fal.ai's `nano-banana-pro` for the worksheet studio's `generate_image`
tool (built a few hours earlier, previous entry below). Net effect: one
fewer vendor, one fewer credential, and the same gateway that already bills
every chat turn now bills illustrations too.

- **`lib/fal-images.ts` deleted, `lib/illustrations.ts` added.** Calls the
  AI SDK's `generateImage` with a bare gateway-routed model string
  (`HOMA_IMAGE_MODEL`, default `openai/gpt-image-2`), same auth pattern as
  the report writer's `generateObject` calls (Vercel project auth deployed,
  `AI_GATEWAY_API_KEY`/OIDC locally, no new env needed since
  `VERCEL_OIDC_TOKEN` was already in `.env.local`). `@fal-ai/client`
  removed from `apps/web/package.json`; `FAL_API_KEY` deleted from
  `.env.local` (dead, was never in Vercel prod anyway).
- **Image models return bytes, not a hosted URL** (fal's queue API was the
  one exception): `generateIllustration` now decodes the base64 result and
  uploads it to Blob itself (`uploadIllustrationBytes` in
  `lib/print/artifact-store.ts`, same store as worksheet PDFs, under
  `families/{id}/illustrations/`), handing the model only the resulting
  `https://` URL. Deliberate: a base64 data URI that size (~1MB PNGs seen
  in testing) would flood the model's own context every time it re-reads
  its page HTML for a revision.
- **`aspectRatio` enum replaced with `shape`**, matching GPT Image 2's five
  actual output sizes exactly (square/portrait/landscape/tall/wide ->
  1024x1024 / 1024x1536 / 1536x1024 / 1024x1792 / 1792x1024) instead of a
  generic ratio string that may not map cleanly onto every provider.
- **Live-verified twice**: one generation alone (54s, 1.1MB PNG, clean
  black-and-white coloring-book line art of the requested character),
  then the full render pipeline with that image embedded (3.8s render,
  859KB PDF). Both sets of smoke blobs deleted after. Typecheck, lint,
  and production build all green.

Open end: no `providerOptions` tuning yet (quality/style), so GPT Image 2
runs at its provider default; revisit if per-image cost needs a lever.

## 2026-07-10 (small hours) · The worksheet studio: agent-designed printables, delivered over SMS

Founder ask (2026-07-09 late night): replicate the Mac mini worksheet loop
in cloud, better, and over SMS. Alessa asks for a page, Homa designs it,
sends it back, she critiques ("the O looks boxy"), Homa remakes it. And it
must be modular: other families want other styles, characters, subjects,
ages, so a template cannot be the mechanism. Shipped as FR-5's first real
slice (supersedes the v0 text-exercise `create_worksheet`):

- **The model composes the whole page as HTML/CSS** and the new
  `create_worksheet` renders it with headless Chromium
  (`lib/print/render-page.ts`, puppeteer-core + @sparticuz/chromium in
  the Vercel function; local dev drives the developer's own Chrome) to a
  letter PDF plus a JPEG preview. Craft lives in a repo skill
  (`agent/skills/worksheet-studio/SKILL.md`): page contract, tracing/
  coloring/flash-card CSS recipes, illustration prompt patterns, the
  critique-and-revise loop. Personalization comes from what the agent
  already knows (focus, age, interests, what_works, family skills).
- **`generate_image`**: fal.ai illustrations (default
  `fal-ai/nano-banana-pro`, env-swappable via `HOMA_IMAGE_MODEL`),
  server-side key, 30/day per family, `materials.image_generated` event.
- **Artifacts**: bytes to Vercel Blob (`homa-artifacts` store, created
  this session, public access + random-suffix URLs, so MMS carriers and
  browsers can fetch but nobody can enumerate); record to the new
  `worksheets` table (migration #42, `is_family_member` RLS, the html
  column kept so future sessions revise instead of re-imagining).
  Law #2 satisfied: Postgres truth, Blob artifacts, both before turn end.
- **SMS delivery**: on the SMS channel the tool itself MMSes the preview
  JPEG + the PDF to the parent's number (from channel auth, never model
  input), then the agent follows with one short text. `sms-mode.ts` now
  teaches this; the old "worksheets are not available over text" line is
  gone. Web chat renders the preview card with the PDF one tap away
  (replaces the `window.print()` popup).

Decisions made alone, worth auditing:

- **Chromium-in-function over the planned sandbox reportlab pipeline**
  (M0-03's original shape). HTML/CSS is the one layout language the model
  is natively fluent in, which is what "no template, any style" requires;
  reportlab would have meant a schema again. The render seam is frozen
  (`renderPrintableHtml(html) -> {pdf, previewJpeg}`) so the sandbox
  pipeline can still replace internals later. Sandbox stays deny-all;
  bash/write_file sentinels stay in place.
- **D7 enforced in code**: the shell (`lib/print/page-shell.ts`) wraps
  every page with the letter @page box and the "made with Homa for
  [child]" footer, so no composition can forget it. Same file gates
  scripts/iframes and runs the brand-law scan (EM_DASH + BANNED_WORDS on
  visible text) before anything renders.
- **Worksheet MMS counts as delivery, not as the one reply**: the
  sms-mode "one reply per text" law stands; the tool's MMS is the
  artifact, the agent's single follow-up text is the reply.
- **Limits without billing**: 20 sheets + 30 images per family per day
  (in-memory damper, same posture as the email tool). `action_costs`
  still does not exist (Phase D); when billing lands these become real
  metering.
- **Live smoke-verified end to end** (fal generation 20s, render 4.4s,
  PDF 413KB + JPEG 161KB, blob HEAD 200s, then deleted): a Skye-themed
  letter-O tracing sheet with guide lines, start dots, and a line-art
  dalmatian-in-rescue-ring illustration. Typecheck, lint, build, and all
  four guards green; migration #42 applied to homa-prod via MCP and the
  isolation suite re-run against it.

Open ends, deliberately not built tonight: no blob TTL/cleanup, no
`list_worksheets` recall tool (the html column makes it cheap later), no
email-channel delivery (email-mode still points to the web), printer
delivery is the separate send-to-printer plan, and `FAL_API_KEY` in
Vercel prod needs the founder pass (HUMAN-TODO). The MMS leg itself
(preview + PDF as `media_urls`) could not be live-tested from this
machine: texting is dark locally by design and still waits on the 10DLC
human steps; first live text should include a worksheet ask.

## 2026-07-09 (late night, voice notes) · SMS voice notes transcribe into the agent turn

Founder instruction: Homa should receive voice notes via text. Before this,
an MMS audio attachment was silently dropped (the channel handler kept
images only, and a voice note with no caption returned before any reply).
Now audio attachments transcribe to text in `lib/voice/transcribe.ts` and
join the turn as a marked block; `sms-mode.ts` teaches the model the
convention. Calls made alone, worth auditing:

- **Telnyx STT over the AI Gateway's**: the gateway's speech-to-text is
  beta with gradual access rollout ("models may not appear in the catalog
  for your team yet"), while Telnyx's `/v2/ai/audio/transcriptions`
  (Whisper large v3 turbo) is GA and runs on the `TELNYX_API_KEY` the SMS
  channel already gates on. Wherever SMS works, transcription works: no
  new env, no new vendor, media never leaves the platform that delivered
  it. The backend is isolated in one helper so a swap is one file.
- **The AMR question, settled by live probes**: phones commonly send MMS
  voice notes as `audio/amr` or `audio/3gpp`, and the STT extension
  allowlist includes neither. Probed the live API (2026-07-09): the
  allowlist checks only the filename, and ffmpeg content-probes the
  actual bytes, exactly as Telnyx's audio-formats doc states ("container
  format doesn't matter as long as ffmpeg can decode it, the validated
  extension list is the actual restriction"). AMR-NB bytes uploaded as
  `.mp3` and a 3gp container as `.mp4` both transcribed verbatim; the
  same AMR bytes as `.amr` got HTTP 400. So the helper maps AMR-family
  types onto allowlisted extensions, and every attempt still emits
  `sms.voice_note_received` (new registry entry) with the delivered
  `media_type` and outcome, so a Telnyx behavior change surfaces in the
  funnel the day it happens.
- **An unreadable voice note with nothing else never wakes the agent**:
  the handler replies directly via `sendHomaSms` ("I couldn't quite hear
  that voice note. Mind trying again, or typing it?"), because silence
  reads as Homa ignoring her and an agent turn would have no content to
  answer. When a failed note rides alongside typed text or photos, a
  bracketed note joins the turn instead, so the agent can acknowledge it
  inside its single reply (the one-reply-per-text law holds).
- **Transcripts enter the turn as `[Voice note, transcribed]: ...`**, a
  plain-text convention over any structured part, because SMS turns are
  already plain text and the sms-mode instruction block (which only
  loads on this channel) explains it in one bullet.

Founder instruction: every signed-in page (onboarding excepted) gets the
same mobile nav, and that nav is a hamburger on the top left that opens
the sidebar. Built as `MobileNav` in the /app shell, so all five signed-in
surfaces (chat, home, planner, kids, settings) get it from one render.
Calls made alone, worth auditing:

- **The phone bar slimmed to hamburger + wordmark.** The old gear /
  Ask Homa pill / Sign out cluster retired (ask-homa-link.tsx deleted):
  the drawer IS the sidebar, so settings and sign out ride in its
  account menu, and Ask Homa is its first tab. The bar's h-14 is
  unchanged on purpose; chat's phone height subtracts exactly that bar.
- **The drawer renders the real sidebar, not a copy**: sidebar.tsx now
  exports `SidebarContent` (nav, up next, kids, account) and both the
  desktop rail and the drawer wrap it, so the two can't drift.
- **Drawer manners match the house menus** (marketing Nav, AccountMenu):
  closes on Escape, a scrim tap, any link tap inside (delegated), or the
  viewport growing past lg; React unmounts it instantly on close. Slide
  entrance is transform-only from the left edge, brand ease-out, with
  the page scroll locked behind it.
- **Marketing pages left alone**: their signed-in phone menu already
  lists the same tabs (Nav.tsx, founder report 2026-07-09). Aligning that
  surface to the left-hamburger drawer would churn the conference landing
  nav days before D0, so it stays a dropdown card until the founder asks.
- **Gotcha for future fixed overlays**: the bar's backdrop-blur makes it
  the containing block for fixed descendants, so the drawer renders as
  the bar's sibling, never its child, or it clips to the bar's box.

## 2026-07-09 (later still) · Chat becomes the /app default; the dashboard moves to /app/home

Founder instruction: make chat the default page at /app instead of the
dashboard. The dashboard's page.tsx (and its route-specific onboarding
gate for "no results yet while an in-range kid waits") moved to a new
`app/app/home/page.tsx`; the old `app/app/chat/page.tsx` and its colocated
files (chat-client, message-parts, markdown-text, worksheet-card,
turn-clock) moved up to become `app/app/page.tsx` directly. Calls made
alone, worth auditing:

- **Sidebar nav reordered**: "Ask Homa" (now `/app`) moved ahead of "Home"
  (now `/app/home`) since chat is the true front door; the exact-vs-prefix
  active-match logic in `sidebar-nav.tsx` already keyed off the href value
  being `/app`, not the label, so it needed no logic change, just the swap.
- **Every "Ask Homa" / "Talk to Homa" CTA across the app** (greeting,
  kid-view, planner-view, the sidebar's up-next fallback, the phone
  top bar's pill) now points at `/app` instead of `/app/chat`.
- **Every explicit "go to your family dashboard" link** (report-nav,
  both report-view CTAs) now points at `/app/home`, not `/app`: those
  links promise a dashboard by name, and would otherwise land on chat.
- **Added a redirect `/app/chat` → `/app`** in next.config.ts: `/app/chat`
  only existed for a few hours today, but the journal email's deep link
  (`/app/chat?draft=journal`) may already be in an inbox. Updated the
  `/home` → `/app/home` and `/chat` → `/app` legacy redirects (top-level
  paths from before the `/app` rename) to match the new arrangement.
- **`revalidatePath("/app")` in the memories-undo action** became
  `revalidatePath("/app/home")`: the memories card only renders on the
  dashboard now, not on every /app page.

## 2026-07-09 (night, round 2) · Progress report simplification round 2: the letter note, one flow from snapshot to subjects

Founder round 2 on the report page (docs/homa-planning/report-simplify-plan.md
tickets RS-12 through RS-17): the header subtitle is gone, the note from Homa
now reads as an actual letter (greeting, note, month plan, call-me line,
sign-off), "Stories so far" and the memory-box keepsake are gone, "Things to
try" is gone, and the whole picture flows straight into subject by subject
with nothing between (the model's cross-subject synthesis piece included,
confirmed with the founder). Calls made alone, worth auditing:

- **Removed `synthesis` and `keepsake` from the model's contract entirely**
  (`ReportNarrative` type, the gate, the generation schema, `map-check.mts`,
  `report-writer.md`), not just from rendering: a report that pays to
  generate two pieces nobody sees violates this repo's own "every piece
  earns its place" law. `lastLetter`/`priorLetter` memory now carries just
  the prior `note`, not the prior synthesis; the model's "one warm callback"
  instruction stands unchanged.
- **The note prompt now forbids opening with the parent's name**: the page
  puts a "Hey {name}," greeting above the note text, so the model repeating
  the name read as the same beat twice. Regenerated both committed
  fixtures (`pnpm tsx scripts/map-narrative-fixtures.mts`, real model call,
  gate clean on both) at REPORT_PROMPT_VERSION 2026.07.18.
- **Greeting falls back to "Hey there,"** when a family has no parent
  first name on file (should not happen post-onboarding, but the type is
  nullable and the report must never crash on it).
- **The call-me P.S. became one inline sentence inside the letter**
  ("BTW, click if you'd rather I give you a call"), replacing its own
  boxed card; same tap-to-call behavior and states, just re-worded to fit
  the letter's voice.
- **The month-plan sentence names the current calendar month** ("Maya's
  July 4-week plan"), read at render time rather than stored, so a
  re-opened report always names the month the plan actually starts.
- **`GrowthEra` and `movementBetween` stay exported** from
  `growth-story.tsx` even though the `GrowthStory` component they used to
  back is gone: the snapshot's trajectory chart and the separate
  `/evidence` archive page both still depend on them.
- Typecheck, lint, `check:map` (all fixture + gate checks), and build all
  green; sample and forced-editable renders screenshotted for the letter
  layout before committing to it.

## 2026-07-09 (night) · The signed-in app moved under one /app prefix (founder: "rename now, boil the ocean")

/home is now /app, and everything signed-in nests under it: /app/chat,
/app/planner, /app/kids/[childId], /app/settings. The (app) route group
became a real `app/app/` segment (the dashboard is `app/app/page.tsx`,
its actions beside it); the frame layout is unchanged, just no longer
hidden behind a group. Calls made alone, worth auditing:

- **The dashboard is /app itself**, not /app/dashboard or /app/home:
  the shortest path is the landing surface; one name from here on.
- **proxy.ts gate is structural now**: `path === "/app" ||
  startsWith("/app/")`, so new signed-in pages can never be forgotten
  off the auth list. The exact-or-slash form exists because bare
  startsWith("/app") would have caught /apple-icon (verified 200).
- **Legacy redirects in next.config.ts**, one per old surface
  (/home, /chat, /planner, /kids/:path*, /settings), 307 on purpose,
  not 308: these pages are noindex (no SEO equity to move) and the
  freed top-level names may become marketing pages later, which
  browser-cached permanent redirects would fight. Query strings carry
  over (verified: /chat?draft=journal → /app/chat?draft=journal, the
  journal email's deep link).
- **Every speakable URL updated**, not just hrefs: agent instructions
  (instructions.md, family-context.ts, sms-mode.ts, agent-db.ts error
  copy) now say /app and /app/settings so Homa never texts or says a
  dead path; the journal email now links /app/chat directly; report
  page nav, marketing nav, signin next= defaults, OAuth callback, and
  the onboarding Google button's redirect all moved.
- **revalidatePath simplification the prefix enables**: actions that
  listed home+planner+settings now call revalidatePath("/app",
  "layout") once, which also catches /app/kids pages the old lists
  missed.
- **Left alone**: applied Supabase migrations (their comments are
  history), old build-log entries, and the mobile app's expo-router
  push("/chat") (a native route, not a web URL). Mobile's file-path
  comments were repointed at apps/web/app/app/*.
- Typecheck, lint, build, all four guards, and a 10-route smoke pass
  green (old → new redirects, signed-out /app → /signin, /apple-icon
  untouched).

## 2026-07-09 (late evening) · The gateway: every door is an adapter, every loop wakes the agent

Founder directive, verbatim intent: "boil the ocean... every channel is
an adapter into the agent, and every cron wakes the agent." Plan file
with checkbox tickets: docs/homa-planning/gateway-plan.md (GW-1..GW-8,
all built and E2E-verified except the three GW-8 human steps). Doctrine
ratified into 15-agentic-architecture.md §0.

Shipped:

1. **Email is an adapter now.** agent/channels/email.ts (custom eve
   channel): a parent's reply to any Homa email becomes a normal agent
   turn with {channel:'email', familyId} stamped from the family's own
   registered address; the agent's reply goes back as a threaded email
   through the shared shell. "stop"/"start" replies flip
   families.journal_opt_out_at without a turn. Keyed URL
   (RESEND_INBOUND_SECRET), dark until the founder wires Resend inbound
   (HUMAN-TODO). email-mode instructions mirror sms-mode.
2. **The dispatcher.** agent/schedules/dispatch.ts (hourly eve schedule)
   + lib/schedule-store.ts (agent_schedules rows, atomic lease,
   self-healing seeding, per-family next-8pm-local advance) +
   agent/channels/dispatch.ts (proactive delivery: SMS when a line is
   linked, else the approved email shell). The evening journal prompt is
   now COMPOSED BY THE AGENT from the family's real context; the
   template pass left the map cron (receipts and pipelines stay there by
   ruling; lib/journal.ts deleted, shell copy lives on as
   sendJournalAgentEmail).
3. **Groundwork.** Migrations #39 (journal_opt_out_at, channel check
   widened to email/dispatch, agent_schedules deny-all) and #40 (found
   live in E2E: message.received and message.completed carry INDEPENDENT
   sequence counters, so the (session_id, sequence) idempotency key was
   silently swallowing assistant rows on adapter channels; identity is
   now (session_id, turn_id, role, sequence). Also hours_log.source
   gains email/dispatch). resolveAgentAccess accepts pinned channels
   sms|email|dispatch; family-context and conversation labels follow;
   hours and events carry the true channel.
4. **Local dev sandbox ruling.** microsandbox's first VM boot proved
   unusable on the dev machine (minutes of CPU, turns never progressed),
   so agent/sandbox.ts pins just-bash locally; deployed runtime still
   resolves Vercel Sandbox with deny-all egress. eve dev auto-added
   just-bash to apps/web devDependencies.
5. **E2E, real dev agent against homa-prod** (synthetic family, cascade
   cleaned): inbound email -> turn -> memory saved + 45 reading minutes
   logged with source='email' + both conversation rows persisted;
   dispatcher seeded -> claimed -> composed a personalized prompt off
   the saved memory -> delivered (journal.prompt_sent channel=email) ->
   advanced to next local 8pm -> same-day re-dispatch was a no-op;
   "stop" opted out turn-free and the row disabled next tick; wrong
   webhook key got 401. Full guard suite green.

Deviation noted: eve's cross-channel receive() matches channels by
reference with a route-fingerprint fallback; bundle boundaries broke
reference identity in dev and a zero-route channel has no fingerprint,
so the dispatch channel carries a GET health route on purpose.

## 2026-07-09 (evening) · Texting becomes a full capture channel; the journal prompt texts first

Founder arc (this session): the read-aloud pass on the journal email
("she's speaking poetically") led to "can she just reply?" which exposed
that replies to every Homa email BOUNCED (the send domain has no MX;
fixed with reply_to hello@thankshoma.com + a HUMAN-TODO alias check),
which led to "can Homa text instead?" and a YES on building it. Also
verified: today's provisioning run cleared 10DLC (brand VERIFIED,
campaign ACTIVE), so the 40010 carrier block is history.

Shipped:

1. **SMS sessions get the write tools.** resolveAgentAccess in
   lib/agent-db.ts returns caller (web JWT, RLS wall) or pinned (SMS,
   familyId from the parent-written phone mapping, the SAME trust basis
   the voice webhook tools already write on). remember, forget,
   log_hours, update_child_profile, get_children, and recall now work
   over text through lib/agent-pinned.ts, which funnels every write
   through the shared guards (scan, budget, dedupe, in-family child
   resolution). IMPORTANT posture note recorded in that file: the pinned
   recall path queries with an explicit family_id predicate because the
   server connection has no RLS, and it deliberately does NOT use the
   recall_semantic RPC for the same reason. Worksheets and emails stay
   web-only; sms-mode.ts now tells the model exactly which is which and
   that an evening "here's how today went" text IS the journal.
2. **The journal prompt is channel-aware.** A family with a linked
   texting line gets a TEXT at 8pm local (the reply side is already the
   real agent, and Telnyx handles STOP at the platform level); a failed
   text falls back to the email in the same pass. journalPromptText is
   the same approved copy, shortened for SMS. Still dark behind
   JOURNAL_PROMPT_ENABLED.
3. **The voice log-hours route now shares the pinned hours writer**
   (recordHoursPinned), so call, SMS, and future channels have one
   guarded implementation instead of drifting copies.

M1-02 remains the proper fix (a real database principal for SMS
sessions); resolveAgentAccess is the single seam to swap when it lands.

## 2026-07-09 (afternoon) · "Do all of this": lab findings become code

Founder direction (this session): ship everything from the morning's
review. Shipped, migrations #36-#38 applied to homa-prod and committed:

1. **hours_log + log_hours (M3-05 slice, migration #37).** Capture-time
   school hours: a chat tool (caller RLS, double-log guard, week total in
   the result) and a voice webhook tool on BOTH Telnyx assistants (same
   templated-URL posture as send_email/remember), an "Hours are records"
   instructions section (ask "about how long?" when vague; movies never
   count), a "School time this week" card on /home, and events
   chat.hours_logged / voice.hours_logged.
2. **Memory supersession (migration #36).** The agent's forget tool now
   stamps superseded_at instead of deleting: superseded rows leave the
   pinned context, /home card, budget, and dedupe, but stay searchable by
   recall labeled "older note that was later corrected". The parent's
   Remove button stays a hard delete on purpose (privacy vs history).
3. **Semantic recall (migration #38).** pgvector columns on
   family_memories, conversation_messages, call_transcripts; best-effort
   write-time embeddings everywhere (embedText: null = FTS-only, a write
   never fails on the embedding model), and a SECURITY INVOKER
   recall_semantic RPC (caller RLS is the wall, no family parameter to
   get wrong) that the recall tool uses as a fallback when lexical search
   comes up short. Model: openai/text-embedding-3-small via the gateway,
   HOMA_EMBEDDING_MODEL override. Pre-existing rows stay FTS-only (no
   backfill on purpose); ANN index deferred until archives earn it.
4. **Review threshold 8 to 4** (HOMA_REVIEW_MIN_MESSAGES override), per
   the live sim where 12 daily sessions never reached 8 rows.
5. **Ops run by agent on founder direction:** both Telnyx assistants
   re-provisioned (twice: remember, then log_hours); Vercel prod env
   verified (TELNYX_API_KEY, TELNYX_CURRICULUM_ASSISTANT_ID present);
   migrations #34/#35 made idempotent before commit (the MCP-then-GitHub
   replay path, same posture as #27). Journal prompt copy went through
   the homa-copy-reviewer and homa-copy-editor gates; the flag stays dark
   pending the founder read-aloud (that gate is not delegable).

Calls made alone, worth auditing: hours subjects are a 10-value broad
list (reading through life skills + other), not the map's 16 domains
(compliance reporting wants broad buckets; the map measures skills);
embeddings compute inline in the persist hook (~200-400ms per message,
after the user already has their streamed reply) rather than a queue;
recall_semantic caps at 12 rows; voice hours rate-limit 30/family/day.

## 2026-07-09 (afternoon) · Settings left the dashboard for /settings (founder ask)

Founder ask (screenshot of /home): the add-a-child, texting, and time-zone
cards belong in a settings view, not on the main dashboard. They now live at
/settings inside the (app) frame: page + cards + their three server actions
moved to `apps/web/app/(app)/settings/` (setup-forms.tsx renamed
add-child-form.tsx on the way); /home keeps only the device time-zone capture
and the memories undo in its actions.ts. Calls the agent decided alone:
(1) the sidebar gear and the report nav now link /settings instead of
/home#settings; (2) the phone top bar gained a gear, because the sidebar is
desktop-only and phones would otherwise have had no path to settings at all
(before, they scrolled the dashboard); (3) /settings joined proxy.ts's
signed-in gate so a signed-out visit reaches /signin like every sibling
surface, not /onboarding; (4) /settings gates only on unfinished setup
(planner's precedent), not on /home's results-pending redirect, so a parent
can always fix her phone or time zone; (5) the settings actions revalidate
every page whose render they change (/settings, /home, /planner), and the
family_phones source value stays "home" (renaming it is a migration for zero
behavior). Agent-facing texts that said settings live on /home
(agent/instructions.md, sms-mode.ts) now say /settings.

Founder-directed research to settle the architecture question empirically
(chat session; canvas artifact "files-vs-tables-lab"). Four rounds: twin
50k-memory substrates (markdown tree vs SQLite+FTS), the "files and bash"
research corpus, a 90-day synthetic mom corpus with hidden ground truth,
and a LIVE 12-day simulation through the real dev agent against homa-prod
(real auth, RLS, tools, persist hook; test family cascade-deleted after,
verified 0 rows left).

Live-sim results: 7/7 continuity probes correct across daily session
rotation (couch trick, co-op day, obsession staleness, correction
supersession via an unprompted forget+remember, axolotl-themed worksheet
after the interest change); the day-4 distress vent saved nothing (law
held); post-undo the agent did NOT re-assert a parent-deleted memory; the
hours question got an honest refusal, no invented numbers. Per-step input
tokens stayed flat (~11.5k) from day 1 to day 12 while memories grew 1 to
6: the bounded-pinned + searchable-archive design holds its cost curve.

Findings that should become tickets (not built, awaiting founder
priority): (1) log_hours capture-time tool, the compliance experiment
recovered only 45% of true hours from prose at query time and the live
agent could only refuse the records question (M3-05 hours engine, now
evidence-backed); (2) post-turn review never fired in 12 days, the
8-message per-session threshold never met by short daily sessions: lower
it or trigger on session idle; (3) pgvector for recall, FTS AND-semantics
missed an archived paraphrase the pinned layer no longer carried; (4)
consider supersession flags instead of delete on memory corrections so
point-in-time questions survive (round-3 finding: a perfectly curated
current-state view answered a February question with April's truth).

## 2026-07-09 (morning) · instructions.md restructured as the soul file

Founder ask: does instructions.md do what the Mac mini's AGENTS.md/SOUL.md
did (character, rules, navigation), and rewrite it per current AGENTS.md
best practices. Researched the agents.md standard (Linux Foundation / AAIF,
the 150-line guidance, "only what the agent cannot infer", explicit
boundaries, imperative rules) and the OpenClaw workspace convention the
original Homa ran on (SOUL = character, AGENTS = operating rules + memory
rules + file-access patterns, USER = injected context, MEMORY = learned,
never restated rules).

Verdict logged in the file's header comment: instructions.md was strong on
character and voice but had NO world map (where knowledge lives: pinned
context vs curated memories vs the recall archive), no tool router
(send_followup_email had zero guidance), and no boundaries section. Rewrote
it in the SOUL → USER-pointer → TOOLS/world-map → AGENTS-rules order:
new "Where everything lives", "When to reach for each tool" (a moment →
tool table + a binding tool-honesty rule: never claim saved/sent without a
success result this turn), and "Boundaries" sections; Voice (binding) kept
verbatim (report-writer.md mirror untouched).

Load-bearing detail: scripts/telnyx-provision.mts slices the phone persona
at the first occurrence of the what-you-know heading. Verified after the
rewrite that the slice still yields exactly persona + Voice + Have opinions
(2,281 chars, no web-tool leakage), and the header comment now warns
against repeating that heading's text above the real one. Guards: eve info
0 diagnostics, no em dashes, the only "behind" left is the rule quoting it.

## 2026-07-09 · The agentic ladder: one brain, whole record, first loops

Founder direction (this session, after the architecture review): build the
ten-item agentic ladder in order, with four decisions locked: memory stays
pinned + searchable archive; built-in eve tools get verified then decided;
learning-loop writes auto-apply with a visible chip + undo (FR-9 posture);
voice stays on Telnyx with post-call learning. The ruling doc for all of it
is NEW `docs/homa-planning/15-agentic-architecture.md` (what lives in
Postgres vs skills vs tools vs sandbox, the verified built-in-tool surface,
what Hermes/OpenClaw local can do that eve cloud cannot, the ladder).

Shipped this session (items 1 through 9; migrations #32-#35 applied to
homa-prod via MCP and committed as files):

1. **Built-ins verified live, then governed.** A dev probe of
   /eve/v1/info showed 18 tools: our 8 plus all 10 eve framework
   built-ins; a live session refused "run bash" twice (persona held) but
   happily ran web_search on a natural compliance question. Ruling
   applied: `bash`, `write_file`, `web_fetch` disabled via sentinel files
   (agent/tools/{bash,write_file,web_fetch}.ts); `web_search` kept with a
   governing instruction section; re-verified: 16 tools, the three gone.
2. **Transcript capture automated** (lib/voice/transcript-sync.ts +
   telnyx-api.ts, wired into the hourly /api/map/cron): idempotent upsert
   by conversation_id, flattened `transcript_text` for FTS, skips
   unchanged calls, clean skip without TELNYX_API_KEY. The ops script
   stays for backfill and now writes transcript_text too.
3. **Post-call memory turn** (lib/learning/call-memory.ts): once a
   linked call settles, one background model pass reads the verbatim
   transcript and saves durable facts. Claim-by-update prevents double
   extraction; outcome lands in call_transcripts.memory_extraction.
4. **recall tool** (agent/tools/recall.ts, M2-15 v1): Postgres FTS over
   call_transcripts + conversation_messages + family_memories, under the
   caller's OWN token (RLS wall) plus explicit family_id filters.
   Instructions tell Homa to recall before ever saying "I don't remember".
5. **Durable chat record** (agent/hooks/persist-conversation.ts +
   conversation_messages, M1-02 slice): every user/assistant message on
   BOTH channels (web + SMS) persists server-side via an eve hook, keyed
   (session_id, sequence) so replays never duplicate. localStorage stays
   the render cache; cross-device transcript RENDERING is still M1-02.
6. **Voice line hands** (route /api/voice/tools/remember +
   rememberToolConfig in telnyx-shared): "remember this" now works ON a
   call, same templated-URL posture as send_email, every write through
   the ONE guarded path (lib/learning/save-memory.ts: scan, budget,
   dedupe, in-family child resolution). Both provisioning scripts carry
   the tool + updated call instructions; RE-PROVISIONING IS A HUMAN STEP
   (HUMAN-TODO) because it mutates live Telnyx assistants.
7. **First proactive loop** (lib/journal.ts in the hourly cron): the 8pm
   journal prompt email in each family's own time zone, once per LOCAL
   day (families.journal_prompt_last_sent_at), deep-linking to
   /chat?draft=journal which pre-fills the composer. DARK by default
   behind JOURNAL_PROMPT_ENABLED until the founder read-aloud.
8. **Post-turn review loop** (M2-13 v1): chat client fires
   /api/learning/review after each turn; the route reviews once >= 8
   unreviewed messages accumulate, claims the window via
   learning_reviews' unique key, extracts through the same engine
   (source 'review'), runs in after(). SMS turns persist but do not
   trigger reviews yet (no client); logged as the known gap.
9. **Sandbox egress locked** (agent/sandbox.ts): deny-all on every
   network-capable backend before anything uses the sandbox. The
   worksheet factory (M0-03/M2-05) extends this file later.

Item 10 (durable per-family workspace) is deliberately NOT built: it
needs a Vercel Blob store + token that do not exist yet, and the ruling
doc scopes it to "only if items 3/4/8 prove insufficient".

The undo surface: /home gains a "What Homa remembers" card (memories with
source labels + one-tap Remove under the parent's own RLS), rendered only
once something is saved. New events: voice.transcript_synced,
voice.memory_saved, memory.call_extracted, memory.review_extracted,
memory.forgotten, journal.prompt_sent, chat.recall_used (all in the typed
registry; check:events green).

Calls made alone, worth auditing: web_search stays enabled (provider-run,
no arbitrary-URL exfil path, probe showed real value) while bash/write/
fetch went dark; extraction defaults to the main model with a
HOMA_EXTRACTION_MODEL env override instead of hardcoding a cheap model id
sight-unseen; background loops never evict memories (budget-full skips,
consolidation stays a foreground move); review cadence is 8 unreviewed
messages; call extraction caps at 5 memories per call and 3 calls per
cron pass; the journal email skips families younger than 20 hours. All
guards green: typecheck, lint, build, check:map, check:events,
check:isolation (with new probes for conversation_messages and
learning_reviews), check:skills-targeting, eve info clean (0 diagnostics).

## 2026-07-09 · One persistent app frame; /chat moved inside it (founder ask)

Founder ask: after sign-in + onboarding, everything lives inside the app;
the sidebar and top bar hold still while the page inside changes. Done with
a Next route group: /home, /chat, /planner, /kids moved into
`apps/web/app/(app)/` (URLs unchanged) under one `layout.tsx` that renders
DashboardShell once and stays mounted across navigations. Shared reads
(family, children, reports, plans, pending curricula) consolidated into
`lib/app-data.ts` `getAppData()`, memoized per request with React cache()
so layout + page share one set of queries; sidebar nav highlight is now
client-side from the pathname (`sidebar-nav.tsx`). Calls made alone:

- **/chat now requires finished setup**: the (app) layout redirects to
  /onboarding when there is no family, an unfinished family card, or no
  kids (previously /chat tolerated a family-less session). Consistent with
  "one onboarding for every door" (founder call 2026-07-08).
- **Chat lost its own header** (wordmark + Home button): the frame carries
  both. "New chat" stays as a slim bar atop the transcript. Chat fills the
  viewport minus the phone top bar (h-14, now fixed-height on purpose);
  the transcript scrolls inside while the frame and composer hold still.
- **Shell's main is bare now**; dashboard pages wrap themselves in the new
  `PageColumn` (same padding + 1040px column as before) so chat can go
  edge to edge.
- **Sidebar settings gear** links `/home#settings` (was a bare `#settings`
  that only worked on /home); the phone bar's Ask Homa pill hides itself
  on /chat.
- **In-frame loading state added** (`app/(app)/loading.tsx`, the bobbing
  mark): page streams in while the frame holds.
- Typecheck, lint, build, and all four guards green.

Founder ask 2026-07-08 late: the post-questionnaire report was redundant and
heavy. Plan and tickets in `docs/homa-planning/report-simplify-plan.md` (all
eleven executed). The shape now: one-sentence note from Homa with the month
button and a call-me P.S. inside it, snapshot = one chart + one sentence +
tap-to-enlarge, strengths section gone, whole-picture chart redrawn
phone-first, subject cards bare until opened (open = what the subject is,
plain question-answer rows, one "Why this is interesting" paragraph,
benchmark links, the two buttons), state card and methodology closed by
default, and a nav bar (Dashboard / Settings) on the live report.

Calls made alone, worth auditing:

- **Features removed from the drawer without an explicit founder line-item**:
  the founder enumerated the drawer's exact contents, so everything else went:
  the inline sharpen probe (SharpenInline) and next-up rung, the
  whats-working form, the per-subject growing-activity callout, and the
  observations-count kicker. Going deeper stays reachable through "Answer a
  few deeper questions". NOTE: the whats-working form was the only WRITE
  path for `context.whatsWorking`; the data keeps rendering into facts and
  plans where it exists, but nothing collects it now (the curriculum call
  can). Revisit if that context bag matters for plan quality.
- **Receipts keep the change-an-answer flow** (living-record law) but lose
  the per-row benchmark age strip (the founder's "no more charts in
  drawers"); each row is now literally "question … answer".
- **The note card also dropped** the movement paragraph, the re-checked
  line, and the practice check-off line (growth story and the plan page
  carry those); template `homaNote()` rewritten to ONE sentence (also feeds
  the kid dashboard card).
- **Month button consent intact**: the tap that builds the month is still
  the explicit ask that arms the 28-day re-check email, and the note
  sentence names the re-check plainly.
- **Call-me P.S. uses the onboarding number only** (no phone input on the
  report); a missing number routes to Settings by copy.
- **Two prompt bumps in one pass**: report-writer.md note spec (one
  sentence), drawers re-specced as the why-interesting continuation with a
  one-reassurance budget and an explicit 320-char budget (the gate's 360
  cap rejected a first regeneration). REPORT_PROMPT_VERSION 2026.07.14 →
  2026.07.17, fixtures regenerated clean twice; **founder re-read of the
  new fixtures (STOP 1) still owed**. Bank content gained per-subject
  `whatItIs` explainers; MAP_BANK_VERSION → 2026.07.5, linted by check:map.
- **Gates run**: homa-copy-reviewer (ICP read), homa-copy-editor, and
  homa-uxui-reviewer on phone screenshots. Implemented: lightbox no longer
  fills the screen with a dead panel (content-sized, centered), trajectory
  chart type bumped to readable sizes (and left margin widened so
  "growing" fits), "rescores" and "age norm" jargon replaced, state card's
  meta-opener and hedging chain trimmed. Declined as founder-fixed
  structure: reordering sections, cutting the per-drawer button pair.
- **E2E**: 30-check Playwright pass against the dev server (public sample
  + a temporary dev-only live-variant preview route, deleted after the
  run): drawers, lightbox, methodology and sources expanders, state card,
  nav links, month-button and call-me no-session paths, phone + desktop
  screenshots. Typecheck, lint, build, and all four guards green.

## 2026-07-09 · Persist every voice call (call_transcripts) + email-gap fix

Founder ruling (this session), from a live investigation of a real user's
calls (the Gomes family): (1) save all raw call transcripts into our DB
ALWAYS, both the general companion line and the curriculum line; (2) fix
the email gap; (3) start turning call content into durable memory. Founder
answers to the three decisions I surfaced: scope = both lines + backfill
what is already on Telnyx; retention = store verbatim, keep indefinitely,
revisit later; memory = auto-extract durable facts into family_memories.

What the investigation proved (all from homa-prod): the general line's
Telnyx insight group had no webhook, so nothing was ever stored; the
curriculum line has a webhook but 0 of 3 calls completed, 0 curricula
generated, 0 transcript_facts written, so the ONLY persistence path in the
code had a 0% success rate in production. Net: no call content, either
line, was in our DB; Telnyx was the only copy. The general assistant DOES
have the send_email tool attached, so the email gap is model behavior: it
read book lists aloud and never called the tool (Carolyn asked ~6 times
across 3 calls, 0 emails sent; the one voice.email_sent belonged to a
curriculum call).

What shipped this session:

- **`call_transcripts` table (migration #25)**: verbatim raw messages per
  Telnyx conversation, family-scoped by `is_family_member`, server-only
  writes, `family_id`/`child_id` nullable so unknown callers are stored but
  Data-API-invisible. Reverses the earlier "general line keeps nothing"
  privacy-by-default posture, at founder direction; this IS the ruling on
  journeys Q3 retention (verbatim + indefinite for now). Isolation guard
  extended to cover it; backfilled 10 conversations (141 messages).

Calls made alone, worth auditing:

- **Capture is a self-contained idempotent sync job**
  (`scripts/telnyx-transcripts-sync.mts`), keyed on Telnyx
  `conversation_id`, not the insight webhook. Rationale: the webhook path
  is proven flaky here (0% curriculum completion), a pull-based job that
  can run on a cron is the reliable way to honor "ALWAYS". A real-time
  webhook is a later enhancement, not the guarantee.
- **Ownership re-derived from the caller's phone** via `family_phones`
  (trying both call targets), never trusted from Telnyx metadata; a
  metadata `child_id` is used only after it is re-scoped to that family.
  When child cannot be resolved (general line is ambiguous with multiple
  kids; curriculum `child_id` rides dynamic variables that are not in
  conversation metadata), `child_id` is left null. Curriculum child
  attribution via the `call_control_id` link is a noted refinement.
- **Email-gap fix is prompt hardening** in the general-line voice
  instructions (`loadVoiceInstructions`): never read lists aloud, must call
  send_email in the same turn, never claim a send without a successful tool
  result. Goes live only after `pnpm telnyx:provision` re-syncs the
  assistant. A model swap for stronger tool-calling is left as a follow-up.
- **Deferred, by sequencing**: LLM memory write-back from transcripts into
  `family_memories` (founder-approved auto-extract). It writes into curated
  memory the agent reads every turn and needs the server's AI gateway plus
  the copy/quality gates, so it gets its own reviewed pass rather than
  being rushed into this one.
- Left three read-only investigation scripts behind
  (`telnyx-calls-today`, `telnyx-call-transcripts`, `telnyx-assistant-info`)
  alongside the sync job; keep or prune per founder preference.

## 2026-07-08 (late) · homa-uxui-reviewer skill (the interface reader gate)

Founder ask: a copy-reviewer twin for UX/UI. New skill
`.agents/skills/homa-uxui-reviewer`: a read-only subagent role-plays the
ICP (80% phone, 20% desktop) going through screenshots or recordings once,
thinking aloud in real time, then a holistic critique. Every reaction is
tagged with the three core signals (cognitive load up or down, friction or
delight, confused or clear). Works at any granularity: button, card,
chart, section, page, flow, motion. Copy is read only as it changes what
the user understands or does; copy style stays with homa-copy-reviewer,
motion-code craft stays with review-animations.

Calls made alone, worth auditing: evidence defaults (phone viewport
390x844 as the 80% case, desktop 1440x900 as the 20% case; granular
elements always reviewed as a crop PLUS the full screen they live on;
one flow per dispatch; motion prefers a recording, and a described-only
motion is flagged as such with softer conclusions); capture source is the
dev server with sample/fixture data only, never real family data.

## 2026-07-08 (late night) · Founder wording call: the coding question drops the game name

Founder (this session): "there is a robot question that you can remove the
word robot and it still gets the point across." Applied to
`computer_science.robot-game` (bank v2026.07.3 to v2026.07.4): the
statement is now "Gives exact step-by-step instructions during play and
follows yours", no game name. Naming "robot" narrowed the question: a kid
who never played a game by that name still gives exact instructions in
play, and that is the skill (CSTA 1A-AP-08). The item id keeps the old
slug on purpose, stored answers key off it. The "Robot parent" growing
ACTIVITY keeps its name: an activity suggests a game to play, a question
measures a skill, and only the question was narrowing. Both narrative
fixtures regenerated (same prompt v2026.07.14, facts changed with the
statement), gate clean; the owed founder re-read covers them.

## 2026-07-08 (late night, second pass) · The two tails: gifted kids get found, struggling kids get a starting line

Founder questions (this session): does the accuracy pass hide a truly
gifted kid? Does it leave a truly struggling kid unknown? And "I would
rather give way more questions if it gives way more accurate results."
Honest audit answers: yes and yes, partially. The ladder stopped serving
questions at the display window (a gifted 4yo doing 7yo work stopped
getting asked), the capped number rendered like a measurement when it was
a floor, and a struggling kid produced sixteen growing badges from sixteen
single answers with no path to the honest starting line except a buried
link.

What shipped:

- **Core ladders now climb until the run ends**: math, literacy, phonics,
  writing, language serve up to SIX rungs above the base (seven questions
  worst case per subject), past the display window, because rungs only
  appear on an "easily" streak. Typical kids still see about 30 taps for
  the whole questionnaire (audit); the ~66-tap worst case belongs only to
  easily-on-everything profiles, exactly the parents who want the depth.
  Non-core subjects stay light (2 rungs, windowed).
- **`beyondScale` on DomainScore**: true when the months-ahead number is a
  FLOOR (confirmed frontier ran past the display cap, or the child
  confirmed the hardest item the bank has). The reviewed sentence bank
  says it plainly ("The skills you've confirmed go past what this number
  can show"), the strengths card marks it ("and past what this number can
  show"), and the receipts hold the proof (a gifted 4yo's math card now
  carries "uses derived facts", a 7 to 8yo skill, as confirmed evidence).
- **The report keeps asking, one consented tap at a time**: the inline
  probe (SharpenInline) now chains: it re-renders with the next question
  after each answer, and fires in three cases instead of one: thin look
  (as before), growing with NOTHING confirmed (walks DOWN toward the
  honest starting line, so the 4-week plan gets a first win to build
  from), and beyondScale (keeps climbing until the run actually ends).
  Kicker copy per case ("Finding {name}'s starting line, one question at
  a time" / "Past every question so far, see how far it goes").
- **Pediatrician offer added to the report's methodology box** (the same
  sentence the method page carries, per edge-case law AQ-14): always
  present, never conditioned on scores, so no child is ever flagged.
- **New guards**: gifted 4yo fixture (6 rungs served, top rung 2y+ above
  age, number capped AND floor-marked, evidence names a skill past the
  cap), a bracketed kid whose in-window frontier must NOT read as a floor,
  struggling-kid fixtures (never a floor flag; the walk-down probes below
  the base and a win becomes the confirmed starting line), and the
  question-count bound now computed from the ladder constants.

Decisions made alone: CORE_LADDER_RUNGS = 6 (bank depth above a young
base is about 6 to 10 items; six rungs finds nearly every real frontier
without an unbounded marathon); beyondScale fires only on "ahead" (an
on-track plateau at the top of the bank is not a floor claim); the
walk-down chains only while NOTHING is confirmed in a growing subject
(one win found, probing rests: anti-guilt); the main questionnaire still
never drills downward (founder sequencing law kept; the walk-down lives
on the report, consent-framed, where the deep dive already lived).

Shipped same night once the founder added gateway credits: the
report-writer prompt rule telling the narrative to name a numberIsFloor
subject plainly (prompt v2026.07.13 to v2026.07.14), both fixtures
regenerated through the real pipeline, gate clean. Verified against a
one-off gifted-4yo generation (not committed): all five core subjects
carried the floor flag and the model wrote lines like "The checklist runs
out of questions before Avery does, so there's more happening than this
number alone can show", gate clean. FOUNDER RE-READ of the regenerated
fixtures still owed (STOP 1 gate); it covers this change and the two
prompt bumps before it.

Also restored in this entry's commit: the two build-log entries below
(the scoring accuracy pass, and the clarity-over-personality copy law)
were lost when commit 38da009 overwrote this file during concurrent
sessions; both are reinstated verbatim so the audit trail stays whole.

## 2026-07-08 (late night) · Scoring accuracy pass: window credit, age-scaled cap, deeper core ladders

Trigger (founder, this session): pilot parents got reports with claims like
"+19 months above typical in speaking" for a toddler and stopped believing
the number. Reproduced exactly: a 2y3m child whose parent taps "easily" on
all three served language questions scored +19 (base 26mo, rungs 38 and
46mo, frontier 46, minus age 27). An audit sweep showed 2-year-olds could
reach +20 to +24 in most domains from 2 or 3 taps, which is 85 to 100
percent of the child's whole age.

Three causes, all previously documented in the benchmark corpus but not yet
applied to scoring:

1. Anchors are "typical BY" ages, the late edge of wide normal windows
   (00-synthesis correction 6). Crediting the anchor to a young child
   manufactures phantom months: the median child is understood by
   strangers at 34mo, not the 46mo anchor (Hustad, lane 11 §8b).
2. No cap scaling: +24 was reachable at any age, and at age 2 that claim
   is the child's entire life over again.
3. Two ladder rungs max, spaced 8 to 16 months apart in the young core
   bank, so one generous "easily" on one fuzzy statement swung the number
   by a year.

What shipped (bank v2026.07.2 to v2026.07.3):

- **Scorer, window credit**: an "easily" now earns the EARLY edge of the
  item's documented `typicalRangeMonths` window when one exists, else the
  anchor as before (scoring.ts `creditMonths`). Evidence lines still name
  the strongest raw-anchor item the parent confirmed.
- **Scorer, age-scaled cap**: displayed months-ahead is now capped at
  `min(24, round(age/3))` (`aheadCapForAge` in bands.ts). The 27mo case
  reads +9, never +19. From age 6 up the absolute 24 governs, unchanged.
- **Bank windows added** from lane 11's verified tables:
  `language.short-sentences` [34, 46] and `language.clear-sounds` [62, 87]
  (both Hustad 2021); `stranger-clear`, `counts-to-100`, and `rides-bike`
  already carried theirs.
- **Four new core items**, all from the corpus porting notes, filling the
  biggest documented gaps under ~8y: `math.small-groups` (36mo, Clements
  and Sarama Small Collection Namer, window [34, 39]),
  `literacy.pretend-reads` (40mo, ASHA 3-to-4 band, window [36, 48]),
  `literacy.print-meaning` (48mo, ELOF P-LIT 2 progression, window
  [36, 48]), `language.true-story` (72mo, Applebee narrative stages, new
  `applebee` source key).
- **Deeper core ladders**: math, literacy, phonics, writing, and language
  (`CORE_DOMAIN_IDS`) got a third rung (superseded the same night by the
  two-tails pass above, which raised cores to six rungs).
- **Sample answers pinned**: the public sample (Maya) now renders from a
  pinned item-id answer list (`sample/sample-answers.ts`) shared with the
  fixture generator, so bank growth can never silently change the numbers
  the founder-reviewed narrative talks about. Narrative fixtures
  regenerated through the real pipeline at prompt v2026.07.13, gate clean;
  the founder re-read of fixtures (STOP 1) is still owed and covers these.
- **Method page** (/onboarding/method): the method list now states the
  window credit, the ladder-corroboration rule ("never from one lucky
  answer"), the cap with a worked example ("for a 2-year-old, that's 8
  months at most"), and what the report says when a skill hasn't arrived.
  Both copy gates ran in order (homa-copy-reviewer, then homa-copy-editor
  on the rewrite): the reader gate's five changes were all implemented;
  editor must-fixes implemented except one, deliberately kept: the
  safety-rules parenthetical still quotes "behind" and "diagnosis" in
  order to deny them. That disclosure device predates this pass and reads
  as the page's strongest credibility moment; founder can overrule.
- **New guards** in check:map: the 27mo trust regression (all-easily
  language must read exactly +9), and a full sweep asserting no age and
  no answer pattern can beat `min(24, age/3)` in any subject.

Decisions made alone (auditable): the cap formula (a third of age,
grounded in the corpus's spread-widens-with-age findings and the old
ratio-IQ plausibility ceiling, not a published constant); crediting the
window's early edge rather than its median (conservative direction, per
lane 11 §9's Denver II precedent); which five domains count as core;
anchor placements within documented bands for the two new literacy items
(40 and 48, both inside their sources' 36-to-48 bands); `applebee` added
as a source key. Deliberately NOT changed: growing/on-track semantics,
the no-downward-drilling law in the main flow (deep dive already walks
down post-report), and the movement law (dips stay quiet, so rescored
reports whose numbers drop under the new math never show a minus).

Consequence to know: existing reports keep their stored numbers until
their next rescore; a rescore will lower inflated "ahead" values, the
movement UI hides downward deltas by law, and history archives the old
scores. Follow-ups queued: windows for the upper bank (8y+, NWEA/Lexile
inversion path from lane 11).

## 2026-07-08 (night) · Clarity-over-personality copy law + the copy gate skills

Founder ruling (this session): Homa's copy was optimizing personality over
clarity, producing reports and plans with too much cognitive load. New law:
clarity and low cognitive load beat personality, and fewer words is NOT the
goal (cutting words that carry meaning raises load; the fix is fewer ideas
per sentence, never fewer words per idea).

What changed:

- **Three new skills** in `.agents/skills/`: `homa-copy-writer` (the general
  copy rulebook: load patterns, per-surface guidelines, and the routing
  table that says whether a fix belongs in the generator prompt, a template,
  a component string, or the page itself), `homa-copy-reviewer` (ICP
  read-along gate: a subagent role-plays a busy non-technical homeschool mom
  reading the copy once, thinking aloud sentence by sentence, then giving a
  critique), and `homa-copy-editor` (senior-editor craft gate, structured
  notes only). Order law: reader first, editor second.
- **Law added to the rule files** it was missing from: AGENTS.md (CLAUDE.md
  is a symlink), BUILD.md, `docs/homa-design/readme.md` + `SKILL.md`,
  `marketing/voice/house-style.md` (voice principle 8).
- **Report writer prompt** (`agent/report-writer.md`, mirrored into
  `instructions.md` and `curriculum-writer.md`): "shorter always wins a
  tie" replaced with "a clear sentence beats a short one"; new rules: one
  idea per sentence, no comma-splice run-ons, no meta-commentary, metaphor
  budget of one, subject stays next to its verb (no appositive lists mid
  sentence), on-track subject lines may be one sentence, keepsake sign-off
  is just Homa's name, keepsake may not invent an audience. Version bumped
  2026.07.11 to 2026.07.13; both fixtures regenerated through the real
  pipeline, gate clean. FOUNDER RE-READ of the new fixtures still owed
  (STOP 1 gate).
- **Template + component copy** fixed at the source per the loop's
  feedback: "the honest picture" and "the part worth circling" meta-frames
  removed (sentences.ts, report-view, both family-note components,
  kid-view); consent card run-on split and button shortened; call-Homa card
  now speaks as "I" (was third-person "she") and says plainly that Homa
  itself calls; growth story no longer re-quotes the live note or promises
  "never compared to another child" while the page shows "+N mo vs typical"
  (trajectory caption now says what the chart actually is); "rescores
  around it" is now "the report updates"; closing band no longer calls the
  child a "before" picture and "a plan for every blue subject" is now "a
  plan for whatever is growing"; a stray prose "behind" in the
  subject-by-subject intro replaced ("the benchmarks used"); casing fixes
  (subtitle, expander links, footer, SOURCES label now a styled uppercase
  treatment).
- The test run of the loop used the committed Maya sample fixture (the
  public sample page's exact content), reviewer gate first, fixes applied
  to the GENERATORS not the artifact, then the editor gate on the
  regenerated copy.

Flagged for founder, deliberately not changed: "Growing right now" label
semantics read scarier than the data when the next skill is due within a
couple of months of the child's age (literacy at 4y 2m vs typical 4y 4m);
"well observed" renders at 2 answers; the plan artifacts carry three names
across the page (the month, the 4-week plan, the call-built curriculum);
"subjects mapped" vocabulary vs the "no map" word rule. All four are
product-naming or scorer-semantics calls, not copy edits.

## 2026-07-08 (evening) · Inbound voice line stops monologuing

Founder feedback from a live call: Homa spoke for about a minute before the
caller could say anything. Root cause: the inbound assistant's greeting is
model-generated from its instructions, and the phone-rules block bounded
per-turn length but said nothing about the opening, so the model front-loaded
an introduction plus a rundown of the family context.

Fix, in `scripts/telnyx-provision.mts` (`loadVoiceInstructions`), synced live
via `pnpm telnyx:provision`:

- Phone rules are now explicitly binding over the prepended web-voice
  sections, keep every turn to one or two short sentences, one thought per
  turn, and end with letting the caller talk.
- The opening is bounded: greet in one short sentence, by first name when
  known ("Hey Sarah, it's Homa!"), then wait. Never introduce at length,
  never list capabilities, never explain the call.
- Family context is framed as background knowledge, not a script: draw on it
  when the conversation goes there, never volunteer a rundown.

The outbound curriculum assistant already had one-sentence-per-turn rules and
is untouched. Note for future call QA: the Telnyx trial tier still prepends
its own "automated call" disclaimer before Homa speaks; that part is not the
model and goes away with the account upgrade (HUMAN-TODO).

Founder follow-up ruling, same evening, after a test call confirmed the short
greeting: do not just greet and wait. A call is a tennis match; every Homa
turn ends by passing the ball back. Second sync, same file and same command:

- Greeting now serves a first ball: name plus one directional sentence
  ("Hey Sarah, it's Homa! How's your week with the kids going?"), and one
  saved family detail is explicitly fair game for that opening question.
- Every turn ends with an easy question or an opening the caller can pick up.
- Wrap-up shape is explicit: when the caller sounds done, close in one turn
  with a one-sentence recap, the one concrete thing Homa will do from the
  call (send_email when it belongs in writing, never a promise she cannot
  keep from a call), then a natural "Ok, talk soon! Bye!" and hang up. Long
  silence wraps up the same way.

## 2026-07-08 · One onboarding for every door (signup, signin, setup unified)

Founder instruction: "we make all sign in, sign up, and onboarding use the
same stuff", with the expected flow spelled out: popup signup (Google or
email+password) creates the account, then a create-your-family card
(family name, her name, address, phone, optional profile photo), then the
SIGNIN flow's add-a-child card (not the onboarding one), then the
questionnaire, results, and the /home dashboard.

What changed:

- **FamilyStep** (`apps/web/app/onboarding/family-step.tsx`): new step
  between the account moment and kids. Gated by
  `families.profile_completed_at` (migration #26), shows exactly once.
  Saves via new `POST /api/map/family` (cookie/session-scoped, tenancy
  law intact) with `mapFamilySetupSchema` + the `map.family_setup` event.
- **KidsStep rebuilt** as the /home "Add a child" card (first name,
  birth month + year selects, interests, help-with), multi-kid via "Add
  child" then one primary start button. Reuses `POST /api/map/children`
  unchanged (it already accepted interests/helpWith).
- **/home redirects** unfinished setups into /onboarding (no family,
  family card not done, no kids, or no results while an in-range kid
  waits); its CreateFamilyForm + createFamilyAction are deleted (the
  `create_my_family` RPC stays in the DB for the mobile app).
- **/signin is sign-in only** (create-account tab and signUpAction
  removed); "New to Homa?" links to /onboarding.
- **Report page** (non-sample): the closing band's stale invite-list copy
  and the footer link now point at /home ("Go to your family dashboard").
- **Migration #26** (`20260708124500_family_profile_setup.sql`, applied
  to homa-prod): families gains address_line/address_city/address_zip,
  parent_avatar_url, profile_completed_at; public `avatars` storage
  bucket with owner-scoped write policies.

Decisions made alone, flagged for review:

1. **Month + year only for kids' birthdays** (day saves as 01, the /home
   convention). This follows today's explicit "use the signin add-kid
   card" instruction and screenshot over 2026-07-06's "get the actual
   birthday" ruling. Age-band math needs month precision only.
2. **The extras step never asks twice**: with interests/help-with now
   collected on the kid card, extras shows only for a kid who left both
   empty there.
3. **Address granularity**: one street line + city + state + ZIP as real
   columns (state feeds the existing us_state compliance path). Address
   and phone are required by the card's own validation but tolerated as
   optional by the server schema, so a degraded save can never strand
   anyone.
4. **Phone soft-link**: the number always saves to families.phone_e164
   (contact info); the family_phones texting link (unique per number)
   stands down quietly when another family already claimed it, instead
   of blocking setup. The /home texting card remains the place to sort
   that out.
5. **Avatar bucket is public-read** (standard avatar posture; owner-only
   writes). The D4 consent floor gates photos of KIDS in materials; this
   is the parent's own photo, uploaded by them, of themselves. The
   /api/map/family route only stores URLs that point into our bucket.
6. **Deep links (?dd=, ?start=) bypass the family-setup gate**: they
   serve engaged families mid-task; the card catches them on their next
   plain visit.
7. **Existing families were NOT backfilled** as setup-complete, so every
   current family (the founder's own included) sees the family card once
   on their next /onboarding visit; there is no launched cohort to
   protect yet.
8. **Signed-in users with no family self-heal**: /onboarding's bootstrap
   now re-reads state after opening the anonymous session, so an auth
   session with no membership row links server-side instead of being
   asked to sign up again.

Verification: typecheck, lint, check:events, check:isolation, check:map,
and the web build all green. Full browser walkthrough against the dev
server (signup, family card, add kid with interests, 47-question
checklist, report, "Go to your family dashboard" landing on /home with
no redirect bounce): every step passed, the extras step correctly
skipped for a kid with interests, and a cookieless /signin shows
sign-in only with the /onboarding link.

## 2026-07-08 · Report gains the snapshot TLDR + by-subject trajectory chart

Founder instruction (with screenshots of the mac mini's daily Slack post and
dashboard hero chart): "the report / dashboard should have this chart and
tldr." Ported from `homa-macmini` (`post_dashboard_slack.py`,
`generate_dashboard.py`) into the web report as two new server components,
`report-snapshot.tsx` (the TLDR card, after the note from Homa) and
`report-trajectory.tsx` (months-ahead-by-subject line chart over check-in
dates, SVG, no client JS), shared by the live report and the public sample.

Two translations the anti-guilt display law forced, decided alone:

1. **"⚠️ Lowest standing" does not port.** The internal post ranks the
   bottom three domains under a warning glyph; the product law bans deficit
   framing. The TLDR's second column is "Growing right now" (sky, worded,
   never numbered), falling back to "Closest to age" with honest at-age
   labels when nothing is growing. Same information, sanctioned frame.
2. **The target reference lines do not port.** "Academic target (24mo)" and
   "Socioemotional target (12mo)" are Story-family philosophy, not product
   policy; drawing every family against them would be manufactured guilt.
   The chart keeps plain gridlines (+6 to +24, the display cap) and the
   at-age baseline. Growing subjects plot on a quiet slot just below the
   baseline, worded "growing", matching the whole-picture dot chart.

The trajectory chart renders only once a second check-in exists (one date
is a dot, not a trajectory); first reports get the TLDR alone. "Next
re-check" row appears only when a plan's four-week clock is armed. Colors
are design-system tokens only, one per subject. No schema, scoring, or
event changes (pure display over already-stored history).

Verification: typecheck + lint green; sample report (2 eras) renders the
card and chart correctly via Playwright screenshot against the dev server.

**Follow-up (same morning), founder design review ("yours vs mine"):** the
first cut read as flat lines with no timeline and no room. Rebuilt to the
mac mini chart's comprehension model, two conventions founder-ruled
explicitly:

1. **Every subject starts at the at-age line** one week before the first
   check-in ("start" tick, no fabricated date printed), so the first week
   renders as a burst of measured progress; this also un-gates the chart
   for FIRST reports (one check-in + the origin is a drawable story).
   Growing subjects start on their own quiet slot instead: starting them
   at zero would draw a dip that never happened (anti-guilt).
2. **The axis always extends four weeks past today** (open future,
   founder: "chart breathing room"). Chose empty space over dashed
   expected-results projections (the other sanctioned option) since no
   expectations model exists yet; the armed plan re-check date renders as
   a named sage marker in that future window when present.

Also: calendar gridlines with evenly spaced date ticks, ringed markers at
every check-in (latest point solid), per-series hairline lanes (2px,
upward only, never below the at-age line) so identical whole-month values
stay countable, two color collisions fixed (executive function to
stone-700, gross motor to gold-400), and the section retitled to the
founder's phrasing: "How ahead is {child}, by subject (months)".

**Second follow-up (same morning), senior-design pass on the card:**

1. **The y-axis now fits the child**: max reading plus headroom snapped
   to 6-month bands (floor +12, cap +24). The old fixed +26 axis parked
   a +10 kid in the bottom half of an empty frame, quiet deficit
   framing by composition.
2. **Emphasis hierarchy**: lines that moved (or sit clearly ahead) render
   featured (2.5px, full opacity, drawn on top); flat lines recede
   (1.5px, 45%). Six at-age subjects are one message, not six shouts.
3. **Direct end-labels replace the legend**: every line is named at its
   endpoint in the open future space (colored anchor dot, muted mono
   text, collision dodging, hairline leaders, width-budget truncation).
   No more matching thirteen hues against a legend.
4. **Figure-ground**: the plot sits on its own white bg-card inside the
   sunken snapshot card, same treatment as the whole-picture chart.
5. **TLDR rows are now jumps** (reusing SubjectJump) to their subject
   drawers, the TLDR doubling as the report's table of contents; growing
   rows' redundant "growing" value became the offer "next step ↓".

**Third follow-up, founder RULE (2026-07-08): "downward on the line chart
is ok. make that a rule."** Codified in BUILD.md law #4 as a scoped
exception: trajectory line charts may draw honest downward segments
(copy still never says "behind"; a drop never gets red or warning
treatment). In code: growing-first subjects now start at zero like every
other subject, so their week-one segment dips to the growing slot as it
actually happened, and the hairline lanes center on the true value
instead of nudging upward-only. Scope note: movement chips, sparklines,
and prose remain positive-only; the ruling covers line-chart geometry.

## 2026-07-08 (afternoon) · S1 becomes a full sign-up, overturning "password last"

Instruction "add a create password input... basically a sign up / create
account page, with google as an option or email/password" ran straight into
2026-07-06's explicit, twice-revised ruling that password is the LAST
question, right before the report, specifically to keep the highest-friction
ask off the entry screen. Flagged the conflict; instructed to override it.
Two decisions made in the same sitting, both confirmed with the founder
before touching code:

1. **Password moves to S1.** `ParentStep` now creates the real Supabase
   Auth account directly (`/api/map/claim`, signUp + signInWithPassword +
   attachAuthUser), the same moment a Google sign-up would. `mapClaimSchema`
   gained `firstName`/`lastName`/`password`; the old email-only shape and
   the `map.claimed` event (superseded by `map.account_created`) are gone.
2. **Name moves to S1 too, `SignupStep` is retired.** Since the flow's
   routing only ever showed `SignupStep` while `!hasAccount`, and hasAccount
   is now always true the moment kids exist (matching how Google sign-ups
   already worked), that step could never fire again. Rather than leave it
   dead, folded its one required field (name) into `ParentStep` alongside
   password, and deleted `SignupStep` + `/api/map/signup` outright.
   `decidePostKidsRoute`/`needsPreHubSignup` simplified accordingly: no
   route past S1 needs to ask "does she have an account yet."

**Follow-up (same day):** `SignupStep`'s optional cell number field
(2026-07-07, "so you can text Homa") had no other home to fold into and was
dropped rather than force it into S1 uninvited. Rather than lose that
capture point, moved it to `/home` under a new "Settings" section: the
existing `TextingCard` (previously gated behind `TELNYX_SMS_ENABLED`, so
it never rendered at all in deployments without a live texting line) now
always renders, since saving a number never actually depended on Telnyx,
only the confirmation text and the "text her directly" framing did. Copy
adapts: "Text with Homa" once a live line exists, "Your phone number" as
plain contact settings otherwise.

Verification: typecheck, lint, `check:events` green (registry parity holds:
`map.account_created` still has three emitters, one more than before).
`check:map`/`check:isolation` not re-run (no bank or query-path changes).

## 2026-07-08 (morning) · Tester feedback T1-T4 shipped

Founder instruction "implement t1-t4" against
`plans/2026-07-07-tester-feedback-tickets.md` (cut from the 2026-07-07
tester voice memos):

- **T1, copy:** the Stories band heading is now "It helped run our
  homeschool first." Wording decided alone (the plan had it
  founder-gated, the instruction implied delegation): "helped" is the
  minimal change that moves the control framing back to the mom while
  keeping the dogfooding story. Owes the founder read-aloud before
  July 13.
- **T2, nav:** the wordmark in the `/home` and `/chat` headers is now a
  link to `/home` (aria-label "Home"); the right-side Home button in
  chat stays.
- **T3, worksheet voice:** `create_worksheet`'s `encouragement` is
  redescribed as written TO the child (description-only change, the
  payload shape is untouched so older saved transcripts render as
  before); the tool's note now tells the model to give the parent her
  own warm line in chat; the printed footer carries the line-treatment
  Homa mark beside "made with Homa for [name]" (D7 footer attribution),
  stroke in the footer's ink color so grayscale printers render it
  clean. `HOUSE_PATH` is exported from `Logo.tsx` so the raw-HTML print
  window shares the one source of brand art.
- **T4, thinking state:** `busyLabel` now judges the LAST message part
  instead of scanning backwards, closing a real blank-screen gap (busy,
  tool finished, next token not yet streaming, previously returned null,
  the exact "is it working?" panic in memo 1); the busy bubble now
  carries the Homa mark bobbing gently (`chat-think-bob`, transform
  only, brand easing, still under reduced motion).

Verification: typecheck, lint, `check:map`, `check:events` green.
`check:isolation` not re-run (no schema or query-path changes).

## 2026-07-08 (past midnight) · "Send an email" tool, web chat/SMS + both voice lines

Founder decision (chat, "what tools can she trigger, can she send an
email" → "both"): give Homa a real, live email-sending capability on
every surface: web chat, SMS, the general inbound voice line, and the
curriculum outbound line.

Shipped (deployed, verified live against real Telnyx assistants):

1. **`lib/map/email.ts` gained two exports**: `sendAgentComposedEmail`
   (model composes subject + a few body lines; the visual shell, footer,
   and unsubscribe framing stay code-controlled exactly like every other
   Homa email, so the model never emits raw HTML) and `getFamilyEmail`
   (server-only lookup of the family's own registered address).
2. **Web chat + SMS**: new eve tool `send_followup_email` (family email
   resolved under the caller's own RLS via `createCallerDbClient`,
   exactly like every other tool in this codebase; never an
   address the model supplies).
3. **Voice, both assistants**: a new webhook tool (`type: "webhook"`,
   Telnyx's live mid-call tool-calling mechanism, confirmed via their
   Async Tools docs before building) at
   `POST /api/voice/tools/send-email`. `family_id`/`child_id` are
   templated straight into the tool's URL from each call's own dynamic
   variables (`{{family_id}}`/`{{child_id}}`), never something the model
   fills in; only `subject`/`body` are model-supplied parameters. The
   general line's `/api/voice/context` webhook now also resolves and
   returns `family_id` (and `child_id` when the family has exactly one
   child, blank/ambiguous otherwise), so the SAME tool config works
   unmodified on both assistants.
4. **Guardrails, both surfaces**: recipient is ALWAYS the family's own
   `families.email`, never model input (BUILD.md law #1: a
   model-controlled recipient would turn the transactional domain into
   a spam relay); the same brand-law gate (no em dash, no banned words)
   runs on subject+body before anything sends, and on a voice-tool
   rejection the error is phrased as an instruction so the model can
   rephrase and retry live in the conversation; a per-family rate limit
   (5/day, the existing in-memory coarse damper already used by the
   public map routes, same honest "not a hard global guarantee" posture).
5. **Both Telnyx provisioning scripts now sync `tools` AND
   `instructions` on every run** (previously only the curriculum script
   synced instructions; the general script was create-once-only).
   Verified live via a direct GET on both assistants after running:
   identical tool config present on each.
6. New events `voice.email_sent` {family_id, child_id?} and
   `chat.email_sent` {family_id, channel: "web"|"sms"}, no content ever
   in props.

Decisions made alone (auditable):

- **A shared tool definition** (`sendEmailToolConfig` in
  telnyx-shared.mts) used verbatim by both assistants rather than two
  near-duplicate configs, so a future change to the tool (rate limit,
  URL, schema) can never drift between the two lines.
- **Synchronous, not async, webhook tool**: Resend calls resolve in
  under a second, so there is no "keep talking while it processes" need
  that would justify the added complexity of Telnyx's async-webhook +
  Add Messages API pattern (built for slow lookups, not fast sends).
- **Rejection reasons are written AS instructions to the model**
  ("Rephrase without an em dash... and call this tool again") rather
  than terse error codes, specifically so a live voice conversation can
  self-correct instead of the call just going quiet on a gate failure.
- Fixed a pre-existing gap while touching `telnyx-provision.mts`: the
  10DLC campaign step's "still processing" error (10036, the ongoing
  registry wait from earlier tonight) was crashing the whole script
  before it ever reached the voice-assistant sync step; now handled the
  same gracefully-logged way as the account-level block.

Follow-ups: no live send was fired to a real user as a test (verified
the auth and brand-law rejection paths instead, both correct, and the
send path itself reuses `send()`, already proven by every other
transactional email in this app); worth watching whether 5/day per
family is the right ceiling once real usage exists.

## 2026-07-07 (night) · "Call Homa" curriculum feature: report → voice call → LLM curriculum

Founder decisions (chat): a "Call me" button on the generated report
triggers an outbound voice call where Homa reviews the report and digs
deeper; the resulting curriculum is LLM-authored and richer than the
existing four-week plan (real lesson ideas, materials, weekly themes),
whatever length Homa judges the family needs (not a fixed 4 weeks); it
shows up in a lightweight new section on `/home` (the real M2-08
dashboard stays backlog); the number dialed reuses the family_phones
system built earlier tonight (prefill if linked, prompt inline if not).

Shipped (deployed to production, all guards green):

1. **Data layer** (migration `child_curriculum_calls` + `child_curricula`,
   applied to homa-prod): product-side only, no lead-side twin needed,
   by the time a report is viewable the parent has already signed up
   (password is the last onboarding question) and the score route has
   already bridged a family workspace, so every report viewer already
   has a real family_id/child_id. Same `is_child_family_member` RLS
   posture as `child_plans`/`child_reports` (migration #23). Members can
   start a call (their own insert policy) but never forge its completion
   or a curriculum directly: only the server-only connection (the
   insights webhook) transitions status or writes a curriculum.
2. **Curriculum content** (`packages/core/src/map/curriculum.ts` +
   `curriculum-gate.ts`): a new, freer schema than the four-week plan
   (title, Homa's own duration call, overview, per-subject weeks with
   activities/materials, a consolidated materials list, a parent note).
   The gate reuses the brand-law checks (no em dash, no banned words)
   but NOT the report gate's numeric-citation enforcement, since a
   curriculum inherently proposes new activities, it does not restate
   computed facts.
3. **Generation** (`agent/curriculum-writer.md` + `lib/map/
   curriculum-generate.ts`): same `generateObject`/gateway posture as
   the report narrative writer, fed the report's existing `ReportFacts`
   plus the call-extracted facts. Two-strike safety net: a gate failure
   retries once, a second failure falls back to wrapping the EXISTING
   deterministic `buildFourWeekPlan` output in the curriculum shape, so
   a family never gets nothing.
4. **Mechanism** (researched live against Telnyx docs before building):
   a SECOND, outbound-only assistant ("Homa curriculum call",
   `assistant-f96c8f74…`, provisioned via new idempotent script
   `scripts/telnyx-curriculum-provision.mts`), separate from the general
   inbound voice line, paired with a Telnyx **Structured Insight**
   ("Curriculum call extraction") whose instructions extract subjects/
   concerns/interests/goals AND echo back `family_id`/`child_id` as
   dynamic variables verbatim, wrapped in an **Insight Group** with a
   webhook pointed at `/api/voice/curriculum/insights?key=...` (same
   keyed-URL auth posture as `/api/voice/context`). This is the
   documented, purpose-built Telnyx mechanism for exactly this ("extract
   structured data from a finished conversation, deliver it by
   webhook"), found after the first attempt (`post_conversation_settings`
   tool-calling) turned out to be the wrong tool for this job.
5. **Two new routes**: `POST /api/voice/curriculum/start` (signed-in
   only; verifies child ownership under RLS FIRST, links/reuses the
   family's phone via the existing `family-phone.ts`, builds report
   facts, places the outbound call with family_id/child_id/report
   summary as dynamic variables, records the attempt) and
   `POST /api/voice/curriculum/insights` (the webhook; correlates the
   insight's echoed ids against a real `initiated` call row before
   trusting anything, generates, gates, upserts, emits the event).
6. **UI**: `CallHomaCard` on the report page (beside `ConsentCard`,
   phone prefilled from `family_phones` when linked); a lightweight
   curriculum card per child on `/home` (title + overview once ready, a
   quiet "Homa is building it" state while a call is in flight).
7. **Events**: `voice.call_started`, `voice.call_failed`,
   `voice.curriculum_generated` (registry + parity check green).
8. **Isolation**: `expectEmptyRead`/`expectInsertDenied` probes added
   for both new tables, verified against homa-prod.

Decisions made alone (auditable):

- **No lead-side mirror tables**: unlike the SMS phone link (which had
  to support pre-signup leads), a report is provably post-signup, so
  building this product-side-only is simpler and was verified against
  the actual signup-then-bridge flow, not assumed.
- **Correlation via echoed dynamic variables, re-verified against a real
  call row**: the Structured Insight echoes `family_id`/`child_id` back
  in its own structured result (documented Telnyx capability: insight
  instructions can reference dynamic variables). The webhook never
  trusts those alone, it requires a matching `initiated`
  `child_curriculum_calls` row for that exact child within a 2-hour
  window, so forging a write needs both the webhook secret AND control
  of the Telnyx account, at which point the account is already
  compromised. Simpler and more robust than fetching conversation
  metadata by a separately-tracked `call_control_id`.
- **A second assistant, not variable-branched instructions on the
  first**: the general inbound line and this outbound review call have
  materially different jobs (warm companion vs. structured
  info-gathering) and different post-call behavior (one needs the
  Insight Group, one does not); a dedicated assistant kept both
  instruction sets clean instead of one prompt branching on a
  `call_purpose` variable.
- **The curriculum gate skips numeric-citation enforcement** (unlike the
  report gate): a curriculum is inherently generative (new activities,
  new materials), so there is no fixed "every number must come from
  facts" contract to check it against; only the universal brand laws
  (em dash, banned words) apply.

Follow-ups this creates: real dashboard (M2-08) still supersedes the
/home lightweight section whenever it's built; multiple curricula per
child over time (currently one row, latest call wins) if a family calls
back later and wants history kept; the model choice for this second
assistant inherits tonight's "no Haiku" veto (Qwen3-235B, same as the
general line) but was not separately re-confirmed by the founder.

**Addendum (later, first real call, founder repro "that didn't go
through"):** a real call to alessallanes@gmail.com's report surfaced two
bugs, both fixed and deployed, found by replaying the exact outbound
request against the live Telnyx API rather than guessing:

1. **Root cause of the failure**: the outbound-call POST never included
   `AIAssistantId` in the body (only the TeXML app id in the URL path,
   which Telnyx's docs example shows alongside, not instead of, the
   body field). Telnyx rejected every attempt before a call row was
   ever created, hence zero rows in `child_curriculum_calls` and the
   generic client-side error.
2. **Latent bug caught while verifying the fix**: the response is a flat
   `{call_sid, from, to, status}`, not `{data: {call_control_id}}` as
   assumed; the tracking id would have silently stored as null.
3. Separately, `.env.local`'s `TELNYX_CURRICULUM_TEXML_APP_ID` had
   somehow picked up extra trailing digits (corrupted to
   `299919608238833845220024` instead of `2999196082388338452`);
   corrected. Vercel production's copy was set from a clean string
   earlier and was not affected.

Also mid-session: a separate, larger concurrent change (migration #25,
`20260708021500_drop_lead_world.sql`) retired the entire `lead_*` table
family (one-world unification: `families`/`children` are now created
directly from the first tap, no separate staging schema). The
curriculum feature was unaffected because it was deliberately built
product-side-only from the start (see the original entry above); this
turned out to be exactly forward-compatible with that consolidation.

**Addendum (founder call-quality notes, first live call heard):** Homa
was too talkative, wandered into questions that did not resolve a real
gap, and never mentioned that the parent can check back in tomorrow.
Fixed by feeding the call TARGETED information instead of a flat
subject list:

- New `buildCallFocusSummary()` (`lib/map/curriculum-store.ts`): ranks
  subjects worst-first, keeps only those actually needing help
  (`not_mapped`/`growing`), and for each states what is CONFIRMED versus
  what is an UNCONFIRMED GUESS to check. Deliberately does NOT pad to a
  fixed count: a child with one real gap gets one focus area, not a
  manufactured second question. Caught live against Story's real report
  data: the naive "always top 2" version was pairing the one genuine gap
  (self-care) with an already on_track subject where the confirmed skill
  and the "gap to check" were the identical sentence, exactly the
  wasted-question pattern being fixed.
- `agent/curriculum-call-instructions.md` rewritten: one sentence per
  turn, never explore for its own sake, spend the whole call on the new
  `{{focus_subjects}}` block, one simple concrete offer per resolved
  gap, explicit closing line inviting a call or text tomorrow for a
  quick day-review, hang up once the focus list is resolved rather than
  filling time.
- The provisioning script now syncs instructions to the live Telnyx
  assistant on EVERY run (previously create-once-only), so a prompt
  edit takes effect the moment the script re-runs instead of silently
  drifting from what is actually deployed; verified live via a direct
  GET against the assistant after running it.

## 2026-07-07 (late night) · Tester voice memos transcribed and ingested

Fourteen voice memos (~11 minutes, recorded this afternoon by a pilot tester
walking the product) arrived in `~/Downloads/homa-notes-july-7/`; founder
instruction was "transcribe and ingest".

- **Transcription:** fal.ai Whisper (`fal-ai/whisper`) with the existing
  `FAL_API_KEY`; audio re-encoded m4a to mp3 first (fal rejects mp4 data
  URLs). The audio itself stays out of the repo.
- **Canonical transcript:**
  `docs/homa-planning/journeys/evidence/raw/2026-07-07-tester-voice-memos.md`,
  verbatim per memo, with an index mapping each product ask to its surface
  and ticket (MJ-06 thinking state, M1-02 chat history, M2-05 worksheet art,
  M2-03 tutorial, M3-11 efficacy loop, create_worksheet closing-line swap
  plus watermark per D7 attribution).
- **Marketing extraction:** 7 new signals in `marketing/signals/`
  (reader-story series, testimonial anatomy, chapters, trial release
  program, socials cross-post loop, "assists never runs" voice insight, the
  efficacy loop in her words), all `status: new`, sourced to the transcript
  with line locators. No duplicates against the existing reservoir.
- **Copy flag surfaced, not changed:** "It ran our homeschool first."
  (`apps/web/components/marketing/Stories.tsx` L28) reads to her as Homa in
  control "instead of Homa is assisting". Founder call on any rewording.

Decided alone (auditable): the evidence folder (journeys/09 §5.1) did not
exist yet since M0-07 is pending, so only `raw/` plus this one file were
created, not the full scaffold. Kids' names were redacted to roles in the
transcript per the family-data law; "Alyssa" kept as transcribed with a note
that it is most likely Alessa. Formal §5.2 assumption coding deferred to
M0-07.

## 2026-07-07 (night) · Family workspace, Phase A: report data moves to product tables (founder rulings, this session)

Two founder decisions this session, both about turning the single long
tokenized report into a managed family workspace:

1. "Migrate reports/scores into product tables so the workspace owns them
   natively." Report data had lived only in the lead tables (deny-all,
   reached by a token). It now also lives in family-scoped product tables
   the signed-in parent reads under RLS.
2. "No more invite-only." This extends the 2026-07-07 homepage InviteBand
   removal to the whole product (report CTA, FAQ, terms, privacy, hub
   pending states, emails). Only the schema/data groundwork ships in this
   entry; the invite-only copy sweep is Phase C, still pending.

Shipped in Phase A (migration + write path), applied live to homa-prod:

- **Migration #23 `20260707190000_child_reports.sql`:** `child_reports`,
  `child_answers`, `child_plans`, mirroring the lead_* shapes minus the
  funnel/sharing columns (token, viewed_at, emailed_at, revoked_at). RLS
  on all three, four policies each, scoped through a new
  `is_child_family_member(cid)` security-definer helper (child to family
  membership without RLS recursion, same shape as `is_family_member`). A
  one-time backfill copied every already-linked kid across via
  `lead_children.child_id` (4 reports, 145 answers, 1 plan on prod).
- **Advisor hygiene:** the new helper was anon-executable via the default
  PUBLIC EXECUTE grant; patched to mirror migration #3 (revoke PUBLIC +
  anon, grant authenticated). Security advisors then clean except the
  pre-existing accepted set.
- **`report-mirror.ts` + score-route hook:** every score now mirrors the
  report into the product tables under the parent's session (no service
  role), once in the foreground (scores + answers immediately) and once
  after the background narrative pass (the words reach parity). Reads via
  the server-only mapDb, writes via the caller's RLS client.
- **`scripts/isolation-check.mjs`** extended: anon can neither read nor
  forge the three new tables. `pnpm check:isolation` and `check:events`
  green; typecheck green. (`check:map` has 3 pre-existing failures from
  in-flight narrative-fixture work, unrelated to this change.)

Decided alone (auditable): mirror shape mirrors lead_* verbatim so the
scorer/renderer are reused; member-write RLS policies (a parent can write
their own child's rows, consistent with children/family_memories) accept
that a parent could in principle rewrite their own scores, this is not a
cross-tenant issue and matches the existing pattern. NOT yet done: the
authed read module + the workspace UI (Phase B, built together against
the real render needs), and the invite-only copy sweep (Phase C).

## 2026-07-07 (night) · Ribbon ticker bug: words vanishing mid-loop, fixed (founder screenshot: "this squiggle is missing words")

Root cause: the ticker's `<textPath>` (added earlier tonight) rode the
ribbon's own visible curve, only ~1570 user-units long. Animating
`startOffset` toward negative pushed early characters below arc-length 0
(invalid, no such point on the path); animating toward positive ate into
the path's remaining length faster than the repeating phrase needed,
running out of valid arc-length before the visible band's right edge.
Both are silent SVG behavior, no console error, so it only ever showed up
as characters/words missing from the rendered band, worse at certain
points in each ~11-13s loop.

Fix in `dividers.tsx`: the colored visible band keeps the original short
curve unchanged (pixel-identical); a second, invisible path with the same
curve extended by 3000 user-units of straight line at each end is now the
`textPath` target, so every offset the loop ever reaches stays inside
`[0, pathLength]`. Base `startOffset` moved from 0 to 3000 (the extension
length) so the un-animated/reduced-motion rest state still lands text at
the exact original visual position. Verified live: extended path length
now ~7569 per ribbon, all three ribbons' animated ranges fall inside it,
and screenshots across full loop cycles (0s, 5s, 10s, 12s+) show complete
text at every sample, all three ribbons. `pnpm --filter web
typecheck/lint/build` green.

Founder: "We're no longer doing this invite-only thing... we just remove
this part," pointing at InviteBand (`We're letting families in a few at a
time`), and asked for a scroll-triggered popup pointing at the
questionnaire instead. Scope taken literally: this homepage section only,
not the site-wide "invite-only" / "invite list" copy in the FAQ, terms,
privacy, hub pending states, or report views (those still say invite-only
and are UNCHANGED, pending a separate founder call like the 2026-07-06
"founding families" sweep).

Shipped:

1. `InviteBand.tsx` deleted, `app/page.tsx` no longer renders it. Footer's
   "Joining Homa" link (`/#pricing`, InviteBand's old anchor id) repointed
   to `/onboarding` so it doesn't now scroll to nowhere.
2. New `ScrollCta.tsx`: a small dismissible card (bottom-right on desktop,
   full-width bottom bar under 640px) that appears once a reader has
   scrolled past the Features section and hides again whenever CtaBand's
   closing CTA is on screen (reactive both ways, via a `data-final-cta`
   attribute the two components share with no prop link), routing to
   `/onboarding` like every other CTA on the page. Dismissal persists
   30 days via localStorage (read through `useSyncExternalStore`, the
   plan-weeks.tsx pattern, hydration-safe and avoids the
   `react-hooks/set-state-in-effect` cascade lint). Respects
   `prefers-reduced-motion` (no slide animation) and Escape-to-dismiss.
3. Trigger is a rAF-throttled scroll-position check, not
   IntersectionObserver: a threshold-crossing observer never fires for a
   scroll that jumps clean over the "past the sentinel" frame (fast
   flick, Page Down, back/forward-cache restore), which was caught live
   in Playwright verification (instant `scrollTo` never flipped
   `visible`) before it could ship as a silent dead feature.
4. `pnpm --filter web typecheck/lint/build` all green; homepage (`/`)
   still statically prerendered.

## 2026-07-07 (midday) · Phone-to-family link: SMS sessions get family context

Founder rulings (chat): one phone number per family for cohort one;
capture it as an optional signup field AND on /home; trust the
signed-in parent's typed number WITHOUT text-back code verification
(explicit founder choice over the agent's verify-first recommendation).

Shipped (deployed to production):

1. **Migration #22 `family_phones`** (applied to homa-prod): one row per
   family (unique family_id, droppable later for multi-number), number
   unique across ALL families (+1E164 check), deny-all RLS + revoked
   privileges, lead_families gains nullable phone_e164. Isolation check
   gains both probes (anon read empty, anon insert denied), green.
2. **Capture**: optional cell field on the onboarding SignupStep (schema
   `phone`, server normalizes via new @homa/core normalizeUsPhoneE164
   and silently skips unparseable values so the optional field can never
   block signup); lead bridge copies the number into family_phones at
   workspace creation (never overwriting a /home-set number); /home
   gains a "Text with Homa" card (set/change/clear) that renders only
   when the deployment's texting line is on.
3. **Routing**: the Telnyx channel resolves the sender through
   family_phones and stamps familyId into the session auth attributes;
   family-context now has a second load path for SMS sessions (server
   reads pinned to the channel-authenticated familyId, since no Supabase
   token exists on SMS); sms-mode instruction speaks linked vs unlinked;
   sms.message_received.linked_family is now real; new registry event
   sms.family_linked {family_id, source, replaced}.
4. **Typo safety net** for the skipped verification: whoever owns a
   freshly linked number gets one "it's Homa, reply STOP if this wasn't
   you" text (best-effort, Telnyx enforces STOP platform-wide).

Decisions made alone (auditable):

- **Verification skipped is bounded, not ignored**: the founder accepted
  the wrong-number risk; the agent bounded it with the notification SMS
  + STOP, the cross-family uniqueness constraint (a number can never
  route to two families), and fail-closed lookup errors (an inbound text
  becomes an unlinked session rather than being dropped or mis-routed).
- **SMS context reads are family-pinned server queries** (same server
  connection as the lead tables), NOT a service-role client and NOT
  RLS-bypassing convenience anywhere else: the familyId is stamped by
  the channel from the parent-written mapping (auth context, law #1's
  letter on "from auth context only" holds; its RLS-role clause is
  satisfied at M1-02, and until then this is the same posture bridge.ts
  already established). Token-backed tools still refuse over SMS.
- **Tools over SMS stay off** until M1-02 SET LOCAL lands; the sms-mode
  instruction turns worksheet asks into web-visit offers.
- The 10DLC campaign attach is now a self-removing cron job (chat-session
  watchers kept getting reaped); it attaches the number the moment the
  registry finishes provisioning and texts the founder the go-live
  confirmation.

Follow-ups: M1-02 SET LOCAL role (unlocks SMS tools properly); an
in-chat "want to text me?" offer (deferred, needs a tool or UI hook);
multi-number-per-family (drop the unique(family_id) constraint when a
second parent's phone matters); phone field on the standalone /signin
signup form (map flow covers the real funnel today).

**Evening addendum (founder: "voice agent is dumb and sounds like a
robot, give her the family's account"):** the hosted voice assistant was
upgraded in place (assistant-0f2cfd3a):

- Model moonshotai/Kimi-K2.6 → anthropic/claude-haiku-4-5 (Telnyx-native,
  no external key).
- Voice default → Telnyx Ultra "Callie, Encourager" (natural US English)
  + Krisp noise suppression. Greeting switched to the model-generated
  special value so known callers are greeted by name.
- **Family context on calls**: new deny-all-posture webhook
  POST /api/voice/context (auth: long random key in the URL query,
  TELNYX_WEBHOOK_SECRET in .env.local + Vercel prod; the keyed URL lives
  only in the Telnyx assistant config). At call start Telnyx sends the
  caller number; the route resolves it through family_phones (same
  lookup as SMS) and returns {caller_known, parent_name, family_context}
  as dynamic variables templated into the instructions. Unknown callers
  and any error fail open to the general-companion experience.
- Context loading/rendering extracted to lib/family-context.ts, now
  shared by the agent's family-context instruction (web + SMS paths) and
  the voice webhook, so all three surfaces render one identical block.
- scripts/telnyx-provision.mts creation payload updated to match, so a
  from-scratch re-run reproduces the live assistant.
- Verified live: webhook 401s without the key, returns empty vars for
  unknown numbers; instructions/voice/model confirmed on the assistant
  via GET. Note: trial-tier disclaimer and 10-min cap should be gone now
  that the account is Verified (founder completed KYC 2026-07-07
  morning); confirm audibly on the next call.

## 2026-07-07 (night) · ONE WORLD: the lead world, bridge, and mirror retire (founder: "architect the db and onboarding as scalable and simple as possible BEFORE we launch")

Founder ruling, overriding the agent's own wait-until-after-conference
recommendation with the stronger argument: we have zero real users today
(one friend family), so pre-launch is the cheapest this migration will
ever be, and every day after launch adds compatibility constraints.
Executed the same night.

The shape: a `families` row is the account container from the FIRST tap.
Migration #24 folds the funnel columns into families (email, names,
phone, source, utm, status, resume/link token hashes, reminder stamp,
context, updated_at), the checklist columns into children (context,
pending_band, band_ready stamp), and the share token + email/view/revoke
stamps into child_reports. Onboarding writes children / child_answers /
child_reports / child_plans directly; signup is an identity upgrade (one
family_members insert inside attachAuthUser, which also folds
same-email/same-user families together and seeds what_works memories).
DELETED OUTRIGHT: lib/map/bridge.ts, lib/map/report-mirror.ts, the
map.family_bridged/skipped events, and every lead_* read and write in
the app. requireLead became requireFamily with a second door: a signed-in
Supabase session resolves the family via membership when the cookie is
absent. All map.* event props renamed lead_id to family_id.

Deliberate postures, unchanged: pre-signup families are RLS-invisible
(memberless) and reachable only through the server module by cookie-token
hash, so the deny-all posture survives the unification; report tokens
stay unhashed shareable artifacts (D7) and now live where the report
lives; anonymous sign-ins stay DISABLED in Supabase auth (probed 422):
the cookie IS the pre-signup identity, no auth.users row until signup,
which keeps bounce abuse away from auth entirely.

Verified: typecheck, lint, build, check:map, check:events,
check:isolation (probes rewritten: lead_* probes retired, child_* read +
insert-forge probes in), plus a full scripted e2e against homa-prod
through the running app: start, add kid, 5 real answers, extras with
whats-working + curriculums, claim, password signup, score (token
returned), state (hasAccount true, token matches), report correction,
consent tap (plan built + retest armed), progress sync, report page
serving the writing beat, plan page serving its beat. Test family
deleted scoped by ids, residue zero.

Migration-window note, proving the founder's timing argument: Alessa
re-onboarded on the OLD prod code while this was being built; her new
lead rows were backfilled into her family (funnel columns + report
token) by re-running the #24 backfill before the deploy. The lead_*
tables drop in a follow-up migration only after the new code is READY in
prod and a final backfill sweep of the gap window comes back empty.

## 2026-07-07 (morning) · The 100x report build: living record, memory, months, proof (founder: "Do all this. BOIL THE OCEAN.")

Executed the six directions of docs/ideation/2026-07-07-report-100x-value-ideation.html
in one pass, on the founder instruction to think one level of abstraction
above and reason hard about how data is generated, saved, stored, and used
so it stays easy to use and never rots. The architecture that came out of
that instruction, now written into the code:

- **Four data classes, four freshness rules.** (1) Versioned static
  content (bank, prompt, templates): stale only by deploy, guarded by
  version stamps and CI locks. (2) Slowly-changing reference data
  (state_requirements): joined at RENDER time, never copied into a report
  row, so a statute change can never strand a stale claim on a permanent
  URL. (3) Source-of-truth family data (answers with new provenance,
  birth dates, interests, whatsWorking, curriculums, plan check-offs now
  server-side): the only data a parent edits, and every new surface
  writes here and only here. (4) Derived artifacts (scores, narrative,
  plans): never edited, only re-derived through the one existing pipe
  (createReport archives words next to numbers, resets, regenerates).
- **Staleness is derived, never stored.** packages/core/src/map/staleness.ts
  is a pure function of birth date + generation time + the bank; the
  report page computes it on every visit. No cron, no stored flag that
  could itself rot.

Shipped (all typecheck/lint/build/check:map/check:events/check:isolation
green; narrative pieces ride the existing REPORT_NARRATIVE_ENABLED flag):

1. **The living record.** Migration #22 (lead_answers.source provenance,
   lead_plans.progress). Tap-to-correct receipts (receipts-list.tsx, one
   batched save = one rescore + one rewrite via POST /api/map/report/correct),
   the sharpness meter (per-subject "well observed" vs "one clear look",
   with the deep-dive probe question inline, one tap), and the
   self-renewing report (staleness banner offering the ?start= re-check).
   All writes session-gated like whats-working; shared links stay
   read-only. New events: map.answers_corrected.
2. **Homa the correspondent.** The writer now receives lastLetter (the
   archived note + synthesis out of history) and writes chapter N, plus a
   new gated `keepsake` piece: a dated letter addressed to the child, no
   numbers, rendered as a memory-box card. Prompt v2026.07.3; both
   fixtures regenerated through the live pipeline, gate clean.
3. **The month, default-on with consent.** The fold-it-into-the-plans
   promise is now kept: PlanFacts carries whatsWorking (all subjects, for
   strength-to-struggle transfer), curriculums, and helpWith. Check-offs
   sync server-side (debounced, localStorage kept as the offline copy;
   server ∪ local, true wins), render as a positive-only "your month"
   line on the report, and feed the writer as code-computed practice
   lines. The consent card offers the clearest growing subject's month in
   one tap: the tap IS the explicit ask, so the retest email arms without
   touching the email doctrine. New events: map.plan_consented,
   map.plan_progress.
4. **The growth story.** The 12-snapshot archive is finally read: a
   chapters timeline (oldest first, era note excerpts as period voice,
   pairwise positive-only movement) plus rising-only sparklines (a curve
   may never draw a dip; drops stay in the quiet re-check lane, per the
   anti-guilt law).
5. **The proof stack.** The state card renders the seeded
   state_requirements summary at render time (reassure-first copy, the
   last-verified date, the this-satisfies-nothing boundary, never legal
   advice), replacing the one-line teaser. Two deterministic audience
   editions shipped as print-first token routes: /evidence (composite
   framing, dated growth lines, full receipts with standards codes and
   citations) and /one-pager (strengths, chart, counts; D6 respected: no
   helpWith, no whats-working, no private letter on either). Linked from
   the report's action row.
6. **Bands and paths.** MapItem.typicalRangeMonths ships the band
   mechanism with the three corpus-documented ranges (counts-to-100 per
   CCSS vs trajectories, stranger-clear per Hustad, rides-bike per AAP);
   receipts render a window band where a range exists, the dot elsewhere,
   with a new check:map consistency rule (range must contain its anchor).
   Each drawer draws the ladder as a lit path (confirmed, emerging, one
   "next up" rung, never a locked state) via core ladderRungs().

Decisions made alone (auditable):

- Corrections are BATCHED (up to 24 changes per save) because every save
  triggers a full rescore + uncapped rewrite behind the writing beat;
  per-tap regeneration would hold the page hostage repeatedly.
- The keepsake rejects alone, never fails the whole generation (it has no
  template equivalent; the report stands without it).
- Sparklines render only monotonically rising series with net growth.
  Honest display of a dip would violate the positive-only movement law,
  so dips simply do not get a curve.
- Bands shipped with exactly three items because only three ranges are
  airtight in 00-synthesis today; the mechanism is general and more
  ranges port with the corpus open (never invented ranges).
- The evidence pack and one-pager are deterministic v1 (no model call):
  for a third-party evidence document, determinism is a feature, and the
  existing report narrative is addressed to the parent so reusing it
  would misfire. Model-written audience cover letters can layer on the
  proven generate-gate-store pattern later.
- The re-check CTA reuses the existing ?start= resume flow (which serves
  the current-age frontier questions) instead of building a bespoke diff
  UI; the answered questions stay answered, so it IS the diff.
- whats-working placeholder copy fixed in passing ("what's driving",
  banned-word law; "behind" had shipped in a placeholder).

Deferred, with reasons (not silently):

- Photo receipts / work-sample uploads: minors' media behind unhashed
  share tokens needs its own access-control design first (D4 consent
  floor gates photo upload until DPAs exist; the ideation doc flags the
  same). Needs a founder decision on private-by-default artifacts vs D7.
- The observation inbox (reply-to-email ingestion): inbound email parsing
  is provider infrastructure that does not exist yet; the footer's
  "reply and a real person answers" stays a human promise.
- The overnight "second read" letter and any annual growth edition email:
  both collide with "no sequences exist by design" and need an explicit
  founder overturn, per the ideation doc's own flag.

STOP for the founder (same gate as the narrative layer): fixtures were
regenerated at prompt v2026.07.3 and include the new keepsake pieces; read
both aloud (scripts/map-narrative-fixtures.mts already printed them; the
red-team keepsake for Riley is the wince test) before flipping
REPORT_NARRATIVE_ENABLED. Everything deterministic in this build (bands,
paths, state card, editions, corrections, check-off sync, staleness
banner, growth story) goes live on deploy with no flag.

## 2026-07-07 (small hours) · Voice + text via Telnyx: M5-01 groundwork pulled forward

Founder rulings (chat, 2026-07-07): set up voice and text on Telnyx now;
SMS/MMS routes into the eve agent behind a flag; voice is a hosted Telnyx
AI assistant on the same number as a call-Homa experiment; carrier
registration goes the Sole Proprietor 10DLC path (personal identity + SMS
OTP, no LLC), superseding M5-01's "Entity/EIN first" assumption and the
HUMAN-TODO Twilio line. The PRD's cohort-one non-goal (NO SMS) stands:
everything ships dark behind TELNYX_SMS_ENABLED.

Shipped:

1. **SMS channel** (`apps/web/agent/channels/telnyx.ts`): eve
   `chatSdkChannel` + the vendor-official `@telnyx/chat-sdk-adapter`
   (Ed25519 webhook verification built in), mounted at
   `/eve/v1/chat/telnyx` (proxy matcher already skips `/eve`). One
   durable eve session per phone-number pair. Inbound MMS images ride
   along as image parts. Dark unless TELNYX_SMS_ENABLED="true" AND
   api key + from-number + public key are all present; the public-key
   requirement means unverifiable webhooks are never processed.
2. **SMS-mode instruction** (`agent/instructions/sms-mode.ts`): dynamic,
   Telnyx-channel sessions only; short replies, no markdown, point
   family-workspace asks to the web app.
3. **Event** `sms.message_received` (registry + server-side insert via
   the existing map-events path; no phone numbers or content in props).
4. **Provisioning** (`pnpm telnyx:provision`, scripts/telnyx-provision.mts
   + telnyx-shared.mts): idempotent walk (balance gate → number →
   messaging profile + webhook → sole-prop brand → OTP → campaign →
   number assignment → voice assistant), stops cleanly at the two human
   gates (funding, OTP PIN). Executed tonight up to the account-level
   wall:    messaging profile 40019f3a… created and bound to +13467588011;
   voice assistant assistant-0f2cfd3a… created (instructions ported from
   agent/instructions.md voice section + phone-call rules) and the
   number's calls route to it. 10DLC blocked at trial account level
   (HTTP 403 code 10038) pending funding, script says so instead of
   crashing. **Correction (morning, founder repro "busy beep"):** the
   voice line is wired correctly (number → TeXML app → assistant, all
   active, verified via API) but Telnyx TRIAL accounts only connect
   inbound/outbound calls with the account's ONE verified number, and
   zero numbers were verified, so every caller got busy. Per
   docs/account-setup/levels-and-capabilities/trial: trial = 1 verified
   number, 10-min call cap, disclaimer prepended to TTS, outbound SMS
   only to the verified number, and 10DLC needs the "Verified" level
   (KYC), which plain "Paid" does not include. HUMAN-TODO updated: the
   2-minute unblock is verifying the founder's cell in the portal; the
   real fix is the account-level upgrade.
5. **Env plumbing**: TELNYX_* in .env.example + .env.local;
   TELNYX_FROM_NUMBER / TELNYX_MESSAGING_PROFILE_ID / TELNYX_PUBLIC_KEY
   mirrored to Vercel production. TELNYX_SMS_ENABLED deliberately NOT
   set in prod (dark until founder flips it post-10DLC). HUMAN-TODO
   gained the funding/OTP/flip checklist.

Decisions made alone (auditable):

- **SMS senders are unlinked principals** (`authenticator: "telnyx-sms"`,
  principal = phone number, NO familyId, NO supabaseAccessToken). Law #1
  says familyId comes from auth context only, and SMS has no Supabase
  auth context; any phone-to-family mapping shortcut would bypass the
  RLS story. Family tools already refuse gracefully without context, so
  texting works as a general companion. Linking a phone to a family is
  its own future design (needs the M1-02 SET LOCAL pattern or a signed
  link flow), not tonight's hack.
- **chat-sdk channel over eve's twilio channel**: Telnyx is not Twilio;
  the Chat SDK adapter is Telnyx-official and eve ships the bridge.
  npm `chat` (4.32.0) is installed alongside eve's vendored copy; the
  vendored orchestrator has no instanceof checks against it, and
  typecheck passes. chat's `ai@^6` peer warning against our ai@7 is
  accepted (we never use its ai-message conversion path).
- **Memory state adapter** for the Chat SDK (dedupe/locks only); eve owns
  the durable session keyed by thread id, so serverless cold starts
  cannot lose conversation state.
- **Messaging profile whitelists US only**; cohort one is US, an
  international outbound text is a bug by definition.
- **Voice assistant gets telephony only** (no messaging feature): the eve
  channel owns SMS, the assistant owns calls; same number, no overlap.
  Known tradeoff, accepted for the experiment: the voice line is a
  second brain (Telnyx-hosted, no family data, no tools); its
  instructions carry the same voice rules and it says so when asked
  about family specifics.
- **sms.message_received inserts server-side** through the existing
  map-events connection: the public events RLS policy stays
  waitlist-only on purpose.

Follow-ups this creates: phone-to-family linking design; action_costs
row for SMS once it carries billable traffic (law #3's billable clause);
outbound/proactive SMS (needs opt-in UX per the campaign's stated flow);
10-digit long code throughput is sole-prop-tier (fine for cohort one,
revisit at scale); revisit the voice assistant fork (import into eve or
retire) after the experiment.

**Addendum (morning, founder "how do we get texts to work"):** founder's
cell verified (+1 954 990 3497, via API, the trial account's one
verified number), after which the voice call connected end to end
(founder confirmed). SMS channel then shipped live: TELNYX_SMS_ENABLED
set in Vercel prod and production deployed via `vercel deploy --prod`
from the working tree (the project's established deploy path; the
selective git commit is pending because packages/core/src/events.ts is
shared with other uncommitted overnight work whose emitters are
untracked, and committing the file wholesale would fail check:events).
Webhook verified live: unsigned POST to /eve/v1/chat/telnyx returns 401.
Outbound test message (API → founder's verified cell) was accepted by
Telnyx but **carrier-blocked with error 40010 "Not 10DLC registered"**:
the trial tier's "outbound to verified number" allowance is
Telnyx-side only; US carriers require 10DLC registration regardless of
destination. So texting waits solely on the human chain in HUMAN-TODO:
account upgrade (Verified/KYC) → TELNYX_SP_* → pnpm telnyx:provision →
OTP. Zero code or deploy steps remain.

## 2026-07-07 (small hours) · apps/mobile: Expo companion app, first cut

Founder instruction ("START A MOBILE BUILD WITH EXPO. BOIL THE OCEAN")
overrode the default sequencing (D0 remains the only real deadline; no
D0 work was displaced, this landed as a parallel lane). Shipped: a new
`apps/mobile` workspace app (Expo SDK 56, expo-router, TypeScript
strict) that is a pure client on the existing backend: Supabase
email/password auth with AsyncStorage sessions, RLS-scoped family +
children reads/writes (`create_my_family` RPC, children insert), and
the real eve chat: `useEveAgent` from `eve/react` pointed at
`EXPO_PUBLIC_API_URL` with a per-request Supabase bearer, exactly the
web channel's auth contract (`agent/channels/eve.ts` needed zero
changes). Transcript + session cursor persist per user in AsyncStorage
(the web chat's localStorage pattern; M1-02 replaces both). Screens:
sign in, Today, Chat (streaming, worksheet cards, memory chips, busy
labels), Family. Brand: tokens + Logo hand-copied per the AGENTS.md
sync rule, icons/splash generated from the house mark into
`assets/brand/*.svg` + PNGs. Verified: workspace `pnpm typecheck` and
mobile `eslint .` green, `expo export` (Metro iOS bundle) builds clean.

Decisions made alone (auditable):
- **eve/react used directly, not a hand-written client.** Verified
  eve 0.19.0's client layer has no DOM globals and rides plain fetch +
  ReadableStream; the one gap (React Native's fetch cannot stream) is
  closed by installing `expo/fetch` as the global fetch at startup
  (`src/lib/streaming-fetch.ts`, eve exposes no per-client fetch
  injection). Law 8 note: the web chat also uses `useEveAgent`
  directly today; when M1-14 wraps the frontend hook behind the
  harness, both surfaces adopt it together.
- **SDK 56 over week-old SDK 57**: current default template, settled
  ecosystem, Expo Go for 57 still in store review; the upgrade path is
  one `expo install --fix` away.
- **Email/password only for now**; Google OAuth needs a Supabase
  redirect-URL registration (HUMAN-TODO) and expo-auth-session wiring.
- **Onboarding/map flow deliberately not mirrored**: its auth is an
  httpOnly resume cookie, web-only by design; mobile assumes a
  signed-in family.
- **No `build`/`dev` scripts in apps/mobile on purpose**: CI runs its
  lint + typecheck via turbo, native builds belong to EAS later, and
  `pnpm dev` should not try to boot a simulator.
- **Payments stay on the web** (App Store IAP rules); nothing billing
  related ships in the app.

## 2026-07-07 (small hours) · M3-05 data layer pulled forward: state_requirements seeded

Founder: "build it so we can pull all the data and save it to build on
top of" (the HomeschoolLeap API identified in 07-deep-research-notes §3).
Shipped:

1. **Snapshot layer** (`data/state-requirements/`): all 51 jurisdictions
   pulled verbatim from HomeschoolLeap's free public API (CC BY-SA 4.0,
   attribution required) via `pnpm pull:state-requirements`. Deterministic
   sorted-key JSON so re-pulls diff cleanly; script validates count and
   shape before writing anything.
2. **Migration #21** (`state_requirements`, applied to homa-prod,
   version 20260707032148): one row per jurisdiction; typed summary
   columns (regulation_level, notification/assessment flags, compulsory
   ages, default pathway, HomeschoolLeap's per-state last-verified date)
   plus the full upstream document as `payload` jsonb (payload wins if
   they disagree). RLS: members READ, deliberately NO write policies
   (skill_bank / M3-04 reasoning: legal claims are fleet-wide blast
   radius; no Data API role or compromised model turn can alter one).
3. **Seed** (`pnpm seed:state-requirements`): direct pooler connection
   (the only write path), upserts snapshots, fails unless the table ends
   at exactly 51 rows. `pulled_at` always advances; `updated_at` moves
   only on real content change so it stays an honest "this rule last
   changed" signal. Verified idempotent (second run: 51 unchanged, zero
   updated_at movement).
4. **Guards + docs**: isolation check gains state_requirements probes
   (anon reads nothing, anon insert 403), green on homa-prod; refresh
   procedure + J-H correction steps in
   runbooks/state-requirements-refresh.md; README repo map + supabase
   README + backlog M3-05 row updated. Security advisors: no new
   findings after the migration.

Decisions made alone (auditable):
- **Snapshots in git as the review gate** before any seed (quarantine
  reasoning ported from M3-04): a re-pull must land as a reviewable diff
  and git history must preserve every version we ever served, for J-H
  blast-radius work. Straight API-to-table was rejected.
- **Read posture starts authenticated-only** (mirrors skill_bank).
  Public SEO state pages (journeys/02 §1) render server-side, so no anon
  policy is needed yet; widening to anon is a deliberate later decision
  when that surface lands.
- **Kept upstream text verbatim** in snapshots and payload (including
  upstream punctuation): archival fidelity beats house style inside
  quoted data; everything Homa-authored around it follows repo style.
- Table lives at the STATE grain with pathways inside payload; a
  per-pathway relational split waits until the hours engine (M3-05
  remainder) proves it needs one.

## 2026-07-07 (small hours) · Cleanup audit executed: every non-destructive fix applied

Executed docs/homa-planning/plans/2026-07-06-codebase-cleanup-audit.md on
founder instruction ("fix everything that is non destructive"). Code: em
dashes out of page metadata + llms-full.txt, Nav "Sign up" casing, terms
"waitlist" wording, FAQ single-sourced into faq-items.ts (page JSON-LD +
Faq component), forget_skill documented in agent instructions,
plansNeedingRetest gains the missing email-null guard, .env.example gains
RESEND_API_KEY/CRON_SECRET/SUPABASE_DB_PASSWORD/NEXT_PUBLIC_SITE_URL.
Guardrails: scripts/events-check.mts (MJ-08 registry parity, both
directions) wired as check:events; skills-targeting-check wired as
check:skills-targeting; both + lint added to CI; CI node 22 to 24 (matches
apps/web engines and local). Docs: PRD non-goal/FR-1/pricing supersession
patches, BUILD.md signup gate + D0 remaining list + CI text, supabase
README count, HUMAN-TODO Stripe ticks + /onboarding URL, 18 planning docs
got pricing-v1 supersession notes, lead-magnet HTML specs got D8-overturn
banners, benchmarks docs moved 15 to 16 domains, Florida percentile claim
resolved against lane 16, root docs swept of em dashes.

Judgment calls made alone, flagged for review:
1. Deleted apps/web/public/videos/homa-brand-film.mp4 (16 MB in every
   deploy, zero references since the founder removed the hero film) and
   the byte-identical uploads/hf_20260705_*.mp4 duplicate; canonical copy
   stays at docs/homa-design/assets/videos/homa-brand-film.mp4.
2. Removed the fictional `pnpm test` (turbo no-op, no workspace defines
   test); AGENTS.md now lists the four check:* guards as the test suite.
3. Did NOT touch: applied migration files (comment fixes skipped on
   purpose, applied migrations stay byte-stable), @homa/core unused barrel
   exports (API-surface call, needs an owner), privacy/method page wording
   (owed inside the LLM-report PR per the D8-overturn ruling), MapFlow
   internal naming (deliberate), marketing signal top-up (content task).
4. One audit claim inverted on inspection: packages/core/src/map/schemas.ts
   comments were already correct (email at S1, name at signup) and were
   left alone; the claim route comment really was stale (said name-at-S1)
   and was fixed to the email-at-S1 order.

## 2026-07-07 (small hours) · Family workspace bridge SHIPPED (D3 re-decision built)

Implementation of plans/2026-07-06-family-workspace-at-report-implementation-prompt.md,
uncommitted, awaiting founder review of the e2e screenshots. Every score now
runs `ensureFamilyWorkspace` (apps/web/lib/map/bridge.ts) after createReport:
family via the create_my_family RPC, children mirrored from lead kids with
REAL birth dates, profiles mirror forward on rescore, all writes as the
signed-in caller under RLS, no service role. Migration 20260707021827 adds
`lead_children.child_id` (nullable FK, on delete set null). New registry
events: map.family_bridged, map.family_bridge_skipped. Verified: typecheck,
forced build, check:map, check:isolation (extended with a lead_children
insert-forge probe covering child_id) all green; live e2e on homa-prod
through the real UI (fresh email, 2 kids incl. one pending-band, checklist,
extras, password signup, report, /home, /chat context reply naming both
kids, whats-working + rescore, later sibling into the SAME family); test
rows then deleted scoped by lead id AND family id in both worlds, residue
check all zeros.

Decisions made alone (auditable):
- **Session-lead identity check added beyond the prompt**: requireLead also
  honors the emailed link token, so a report link opened in a browser
  signed into a DIFFERENT account would have mirrored kids into that other
  family. The bridge only runs when the session user IS the lead's linked
  auth user; anything else emits map.family_bridge_skipped
  {reason: "auth-user-mismatch"} and stands down. Self-healing: state-route
  linking fixes the lead, the next score bridges.
- **Race hardening, caught live in e2e run 1**: two parallel score calls
  (dev StrictMode double-effect; a double-tap or two devices in prod)
  both saw child_id null and duplicated the product children. The mirror
  phase now runs in one transaction holding `select ... for update` on the
  lead row, plus an orphan-adoption pass (a product child matching name +
  birth date that no lead kid links to is adopted, never twinned), so even
  an interrupted run cannot duplicate kids on retry. Run 1's rows were
  cleaned scoped by ids; run 2 (post-fix) was fully green.
- **map.family_bridged emits only when something changed** (family created,
  child created, or profile updated). A pure no-op rescore stays silent,
  per the 2026-07-06 lesson about flooding the funnel during analysis.
- **The prompt's "the product profile has no other writer for these fields
  today" is not quite true**: the chat agent's update_child_profile tool
  writes interests/focus. Founder-ruled last-write-wins mirror stands, but
  a rescore can clobber an agent-era interest with stale lead data; the
  extras step also REPLACES the lead's interests list per save (its own
  semantics), so the mirrored list is the newest sitting's list. Flagged
  as a known sharp edge for the M2-04 profile engine.
- **Stretch memory seed built, gated to first-time only**: one what_works
  row per child, seeded only while the child has NO what_works memories
  (agent consolidation is never fought, rescores never duplicate), content
  is the parent's own words behind the scanMemoryContent injection gate,
  source "onboarding". Notes arriving after a child's memory exists are
  NOT re-seeded; the narrative build feeds them into report facts anyway.
- **Isolation checker**: read probes already covered the new column via
  select=*; added an insert-forge probe (anon inserting a lead_children
  row with a child_id link) rather than extending reads.
- Advisors after the migration: no new findings (deny-all INFO lines and
  the documented create_my_family SECURITY DEFINER warn, unchanged).

## 2026-07-06 (night) · Multi-kid order is the parent's call: the next-kid choice ships

Founder: "it needs to be easier to add your second or third kids
questions", the parent chooses whether to answer the other kids before
generating, or generate kid 1's report and do kid 2 after, and the ask
must be "simple, easy to understand, under 10 words".

Shipped, all in the onboarding flow (no schema or query changes):

1. **The next-kid choice (`next-kid-step.tsx`, new phase).** After one
   kid's checklist + extras, if another in-range kid still has open
   questions, one screen asks: **"Leo's questions now, or Maya's report
   first?"** (7 words; plural form "...or the reports first?" once two or
   more are queued). Secondary sage button starts/continues the sibling's
   questionnaire (kids-step task-order precedent, detour above primary);
   clay primary goes to the report(s). Caption reuses the report handoff
   line ("Same questionnaire, tuned to Leo's age. About five minutes.")
   or, for a started sibling, the saved-answers count.
2. **One scoring beat, several reports.** `reportQueue` in map-flow
   tracks kids finished this sitting, in order; ScoringStep now takes
   `kids[]`, scores each sequentially (per-kid status lines, "Building
   the progress reports…"), and lands on the FIRST kid's report. Any kid
   finished in an earlier sitting but never scored is swept into the same
   beat. Signup heading names the landing kid, not the last-answered one.
3. **Report page: sibling-ready card.** After a multi-kid build, the
   landing report shows "Leo's report is ready too" linking to
   /onboarding (the session-scoped family page), deliberately NOT the
   sibling's token URL: report pages are shareable capability links, and
   embedding a sibling's token would let anyone holding one kid's link
   open the other kid's report.
4. **Honesty fixes the seams exposed:** extras' finish button says
   "Continue" (and its headline drops "while I build") whenever the
   choice or the account step comes next, not "See the report"; the hub
   gained a finished-kid card ("Every question is answered. The report is
   one tap away." → scoring) replacing a dead "Continue the
   questionnaire" that mounted an empty checklist; ?start= links for
   already-finished kids route to scoring instead of that same dead card.

Verified: typecheck, lint, build green; two Playwright e2es (answer-both
lane with plural ask + both reports in one beat + ready-too card, and
report-first lane with single-kid beat + handoff card + second sitting
pointing back at kid 1). Test leads and their bridged families/children/
auth users deleted by lead id afterward, per the standing lesson.

## 2026-07-06 (night) · D3 re-decided: family workspace provisions at first report (founder ruling)

Same session as the D8 overturn below. Founder, on learning that a lead's
auth account exists by report time but the product workspace does not:
"ok so we should probably fix that so once they generate a report they
create a family workspace." This completes the erosion of lead-magnet
decision D3 (option A, "lead records now, account claim at invite") that
open signup (2026-07-05) and password-before-report (2026-07-06) started:
accounts AND workspaces now exist during the flow. MJ-09's invite-time
bridge shrinks to legacy-lead reconciliation.

Shape (full spec:
plans/2026-07-06-family-workspace-at-report-implementation-prompt.md):
idempotent bridge at the score route, RLS-only writes as the signed-in
user (create_my_family RPC + children inserts, NO service-role key),
lead_children gains a child_id link column, profiles mirror forward on
rescore, bridge failure never blocks a report. Deliberately NOT included,
flagged for a separate founder call: exposing /chat or /home to
report-holding families (report CTA still says invite list; the FAQ's
invite-only line stands until ruled otherwise).

## 2026-07-06 (night) · D8 overturned: the LLM writes the report's words, code keeps the numbers (founder rulings)

Grilling session on the report-depth exploration prompt
(docs/homa-planning/plans/2026-07-06-llm-report-depth-exploration-prompt.md).
Full Q&A and options table: plans/2026-07-06-llm-report-depth-options.md.
Rulings, in the founder's words where they ruled:

1. D8 (lead-magnet index.html, "curated sentence banks, zero model calls")
   is OVERTURNED for report prose: "fuck privacy. customers care about
   results." The scorer, ages, badges, chart, movement math, and citations
   stay deterministic code, unchanged.
2. Scope: "LLM should write all of it," with facts "deterministic or at
   least tracked in the database over time." Read as the facts/voice split:
   code computes every number, the model writes every parent-facing word
   (top note, card lines, new whole-picture synthesis, drawer explainers,
   four-week plan prose), and every generation is stored on the report row
   versioned by bank version + prompt version + model, snapshotting into
   history on rescore. "Building homa into an 'agent' for the user that is
   personal to them": report generation shares the chat agent's voice
   source and model (gateway claude-sonnet-5).
3. Latency: report waits behind an honest writing beat, UNCAPPED. "I would
   rather the report and the deep dives and the 4 week ciricculums be
   FUCKING INCREADIBLE, then have it take less than 20 seconds." Templates
   render on hard failure only, never on slowness. Report email sends after
   generation completes so the emailed link opens a finished report.
4. Defaults accepted without veto: regenerate on every rescore; v1 email
   stays the two-line pointer; sample report narrative generated once, hand
   reviewed, committed as fixture (doubles with the struggling-kid fixture
   as the read-aloud bar for every prompt change); runtime gate ports the
   map-check laws plus a no-invented-numbers grounding check, rejected
   pieces fall back per piece.
5. Consequences owed in the same PR: privacy page subprocessor section and
   the "No AI provider receives your questionnaire answers" line rewritten
   (the page promises it "changes first"), method page determinism wording
   becomes "numbers by plain arithmetic, never AI; Homa writes the words,
   checked against safety rules." FAQ's "your child never talks to an AI"
   stays, still true.
6. Conference timing was asked and not explicitly ruled; standing default
   logged: build behind a server flag now, flip on when the founder
   read-aloud passes, before or after July 13 as quality decides.

Implementation prompt handed off:
plans/2026-07-06-llm-report-narrative-implementation-prompt.md.

## 2026-07-06 (night) · Pro renamed Homa Plus + Plus annual at $249/yr (founder: "same discount, don't call it pro")

Follow-up to the pricing entry below, both environments:

- "Homa Pro" product renamed "Homa Plus" (converges with the name the
  planning corpus always used, R4 conversion screen). "Homa+" stays a
  UI-surface wordmark treatment if design ever wants it; the Stripe
  product name and receipts say "Homa Plus".
- Monthly lookup key renamed homa_pro_monthly_49 to homa_plus_monthly_49.
- New annual price homa_plus_annual_249 + payment links. Judgment call on
  "same discount": base annual is 56.6% off ($99 vs $228); the exact same
  ratio on $49/mo is $255.32/yr, rounded to the clean sibling price $249
  (57.6% off). One API call to change if the founder wants a different
  number.
- Env vars renamed/extended: `..._PAYMENT_LINK_PLUS_MONTHLY_URL` +
  `..._PLUS_ANNUAL_URL` in `.env.local` and `.env.example` (nothing reads
  them yet).

## 2026-07-06 (late evening) · Pricing v1 set by founder: Homa $19/mo or $99/yr, Homa Pro $49/mo ("let's not overthink this")

Founder call, superseding the $29/$49 numbers from D2/C1 (structure decided
2026-07-03; numbers were always provisional under T2). Executed in BOTH
Stripe environments: new prices on the existing "Homa" product
(homa_monthly_19, homa_annual_99), new "Homa Pro" product + price
(homa_pro_monthly_49), three payment links per environment (recorded in
`apps/web/.env.local` as `..._PAYMENT_LINK_{MONTHLY,ANNUAL,PRO}_URL`), old
$29 price archived and its link deactivated in both environments.

Judgment calls + flags, made alone and noted for review:
1. Pro's "bells and whistles" were founder-delegated ("we'll make some
   stuff up"); chose ONLY claims that are true or hand-deliverable today,
   per C2/no-fiction law: "Everything in Homa, plus the best intelligence
   we can run, custom worksheets made for your kids, and priority support
   from a real person." Editable in the dashboard when the tier sharpens.
2. FLAG: $99/yr is Homeschool Fox's exact annual price (T3 says never
   compete on their price axis). Stated to founder in-session; his call.
3. FLAG: $99/yr is a 57% discount vs $19/mo (norm is 15 to 20%), and
   annual-at-first-conversion reverses R3's September/month-3 timing
   recommendation. Both accepted as founder prerogative, logged so the
   reversal is deliberate, not drift.
4. Site copy untouched: the FAQ's "pricing gets published before anyone
   pays a cent" promise still holds until the paywall placement decision.

## 2026-07-06 (late evening) · "Founding families" framing retired everywhere (founder ruling)

Founder: "remove all references to founding families. everywhere." Scrubbed
and replaced across product surfaces, active specs, and forward-looking
drafts; replacement vocabulary is plain: "invite list", "first families",
"invite-only", "first cohort".

- Web copy: report CTA band, plan-page band, hub pending line ("You're on
  the invite list"), FAQ, Community section, footer link (now "Joining
  Homa"), Stories promise line, terms, email footer, signin comment.
- `components/marketing/FoundingFamilies.tsx` renamed to `InviteBand.tsx`
  (eyebrow now "Joining Homa"); `app/page.tsx` updated.
- Active specs and drafts: BUILD.md hard-constraints row (now also records
  this ruling), journeys/02 waitlist copy guidance, journeys/09 preorder
  experiment language (E6, ladder rungs, open question 2: now
  "first-cohort"), map-announcement-draft, lead-magnet mocks.

Judgment calls on scope, flagged for review:
1. LEFT INTACT: historical build-log entries and the already-superseded
   migration #7 (applied migrations and audit history stay immutable; the
   invite-code store it seeded was dropped by migration #8).
2. LEFT INTACT: icp-research citations of competitors' founding-family
   rates (Homeschool Managed) and the dated A11 research verdicts; they
   are evidence about the market, not our copy. The pattern (early price
   lock) is not retired, only the phrase.
3. LEFT INTACT: "founding story" / "founding documents" usages (different
   sense of the word).

## 2026-07-06 (late evening) · Post-review polish rounds: kids copy arc, checklist consolidation, extras split, report drawer rebuilt twice

A string of founder read-throughs after the "do it all" overhaul, each
implemented and verified live the same evening:

1. **Kids step copy, four rounds.** "Nice to meet you, Sidney." + "Now,
   add your family." was ruled two disconnected beats ("I hate this");
   collapsed to one headline, finally "Let's add your kids(, Sidney)".
   The subtitle was cut entirely (its one job, "a nickname is fine",
   already lives in the field label), the label became "Your child's
   name (or nickname)" after the greeting-adjacency made a bare "Name or
   nickname" re-enterable as HER name, and the birthday reason moved to
   a muted parenthetical, reworded once more because "(for their exact
   age)" restated what a birthday is instead of why it's asked:
   "(so questions match their age)".
2. **"+ Add a sibling" fix.** After saving kid one, the primary CTA
   latched onto the first saved kid's name ("Start Story's
   questionnaire") right as she'd asked to add another, read as the flow
   forgetting her. The button now only ever names the kid being typed
   right now; empty form = generic label, two-plus kids = plural.
3. **Checklist consolidated to one meta row + card** ("still seems like
   a lot going on"): hint bar, domain intro, and ladder note now share
   the card's single kicker slot (also killing a whole-screen jump on
   the first answer), the 16-segment dots died (the rail is desktop
   progress, one hairline bar on mobile), the mobile report strip died,
   the question centers in the card's fixed height, the card took the
   screen's strongest elevation, undo renamed "undo last answer", and
   the exit label became "back to your family" (the header already says
   everything saves; the hub is also where "add another kid" lives,
   answering a real founder question). "1 answers saved" pluralization
   fixed on the hub.
4. **Extras split to one question per card** with an "extra 1 of 2"
   counter; saving moved to the end so skipping question two never
   discards question one. "Done. The report is next." became a
   hand-note celebration ("questionnaire done ✓") over one beat ("Two
   quick extras while I build Story's report"). Selected chips use the
   soft clay tint (solid clay stays reserved for the CTA), free text
   became a dashed "add your own..." pill.
5. **Report subject drawer, two passes.** First: "at age"/"growing"
   right-column labels removed (numberLabel in sentences.ts now speaks
   only when it adds beyond the badge), plan CTA clay only on growing
   subjects, the "Go deeper..." riddle became "Answer a few deeper
   questions", sources muted, answer pills flattened to text, "often
   solid by" replaced "typical by", mid-dot eyebrow, "hide ↑"
   affordance. Second ("make the national average vs the child
   legible"): each answer is now a soft block reading top-down
   (question, "You said: Easily", age strip), where the strip puts the
   national benchmark (grey dot, "most kids by 4y 6m") and the child
   (clay marker, "Maya · 4y 2m") on one shared hairline per drawer, so
   the comparison is read, not computed. Every drawer zone opens with a
   one-line plain-language explainer, per the data-viz guideline (dots
   on one baseline, stages not scores, no red, no "behind").
6. Housekeeping: deleted the dead `email-step.tsx` (orphaned since the
   auth restructure made ParentStep the email screen).

All verified with Playwright walkthroughs (desktop + narrow) against the
sample report and live flow; typecheck, lint, build, isolation, and
map-check green after every round; every test lead removed from
homa-prod afterward.

## 2026-07-06 (evening) · Stripe payment rails stood up (founder: "create the recurring product + payment link so we can test; paywall placement decided later")

Live Stripe activated as sole proprietor (founder canceled the Atlas LLC
application after the cost discussion; entity deferred per the existing
HUMAN-TODO ruling). Created via API in BOTH environments, per the cohort-one
mechanism in 08-billing-credits-design ("Payment Link $29/mo, usage watched
manually"):

- Product "Homa", $29/mo recurring (price lookup_key `homa_monthly_29`),
  statement descriptor THANKSHOMA.
  - Test (sandbox acct_1TqIhu…): prod_Uq01TGhJROfVQ5 /
    price_1TqK1oLyeN6YfdNkoCqM9HbM
  - Live (acct_1TqJCq…, charges_enabled: true): prod_Uq02Zo8DUidRnH /
    price_1TqK24GnIMAiH0MJcLf0aoyB
- Payment Links recorded in `apps/web/.env.local` + `.env.example` as
  `NEXT_PUBLIC_STRIPE_{TEST,LIVE}_PAYMENT_LINK_URL`. No product code reads
  them yet.
- Live keys mirrored to Vercel Production (Sensitive):
  `STRIPE_LIVE_SECRET_KEY`, `STRIPE_LIVE_RESTRICTED_KEY`,
  `NEXT_PUBLIC_STRIPE_LIVE_PUBLISHABLE_KEY`. Local `.env.local` renamed the
  test pair to `STRIPE_TEST_*` so test/live can never be confused.

Judgment calls made alone, flagged for review:
1. Product description written honest-to-today ("A fresh progress report for
   every kid, every month."), NOT the Branch B plan copy (materials daily,
   weekly notes), because none of that exists yet and a live link can charge
   a real card. Editable in the dashboard when the offer is decided.
2. No trial on the link: trial shape is open founder question #2 in
   journeys/10-reconciliation §Open questions (300 credits vs 2-weekly-notes
   sizing), and T1's card-upfront ruling can be honored later by adding
   `trial_period_days` when the offer ships.
3. Paywall placement, price framing ($29 first-cohort membership vs
   report-only price), and fake-door vs real-charge remain UNDECIDED founder
   calls; the 07-04 ruling "no Stripe preorder ask at the conference" still
   stands.

## 2026-07-06 · Onboarding UX review implemented in full (founder: "do it all, boil the ocean")

A senior-designer review of the whole onboarding flow was delivered and the
founder approved implementing everything in one pass. Shipped, in priority
order, with the judgment calls noted:

1. **Two real defects fixed.** (a) The page shell centered steps with
   flexbox `justify-center`, which clips a too-tall step's heading up
   underneath the nav, unreachable by scrolling (seen live on the account
   step); auto margins center-when-room / top-align-when-not instead.
   (b) A returning parent whose email already had an account hit
   `signUp` failure with a "try again" that could never succeed; the
   signup route now returns `reason: "exists"` and the step offers
   "sign in and you'll come right back here" (`/signin?next=/onboarding`;
   the signin page + actions grew a validated `next` param). The
   sign-in return path works because `/api/map/state` links ANY live
   Supabase session to the lead, not just Google ones.
2. **Quiet chrome mid-flow.** The founder's earlier "use the nav bar and
   the footer" ruling stands on the page-like moments (entry, hub) via
   the new `OnboardingShell`, but during kids/questionnaire/extras/
   signup/scoring the marketing nav (whose Sign Up button navigates to
   /onboarding itself and dumped mid-questionnaire parents onto the hub)
   gives way to logo + "everything saves as you go" + the original
   two-link footer. Judgment call: this narrows, not reverses, the
   founder's nav ruling; flagging here in case it should be reversed.
3. **The live-assembling report rail.** The entry page's report-preview
   mock disappeared for the whole questionnaire, exactly when motivation
   is spent. New `ReportRail` (desktop) and `ReportRailStrip` (mobile):
   the subjects fill in with sage checks as she answers, "N subjects to
   go" underneath, same visual language as the entry mock.
4. **Kids step**: numeric MM/DD/YYYY fields with auto-advance replace the
   three `<select>`s; the primary button stays enabled and explains
   what's missing on tap; it personalizes ("Start Maya's questionnaire")
   the moment a name is typed; "+ Add another kid first" (ambiguous)
   became a quiet "+ add another kid" link; the 2-to-16 range is stated
   up front; name field autofocuses.
5. **Checklist**: chips in scale order (single row desktop, ordered stack
   mobile, the 2x2 grid shuffled the scale); a tapped chip flashes
   selected ~140ms before advancing; "subject 4 of 16" became "about
   N min left" (16 subjects read as long; time was the promise).
6. **Extras dieted from nine asks to two** (interests + help-with, the
   ones that feed the report). "About your homeschool" (style,
   curriculums, values) moved to the report page as
   `HomeschoolContextCard`, gated by `hasFamilyContext`, saving through
   the same cookie-authed extras route as the whats-working boxes.
   Judgment call: activities/crew/notes were dropped from the lead flow
   entirely (product-stage context, collectable in-app later).
7. **Account step re-offers Google** (one tap beats name+password at the
   moment friction costs most), autofocuses, and gained a show-password
   toggle. Entry email label now carries the why: "Where should I send
   the report?".
8. **Routing**: a fully-answered unscored child now resumes at the finish
   line (signup/scoring) instead of the hub, closing the Google-redirect
   loop; focus moves to fresh step content on phase changes.
9. **Housekeeping found along the way**: fixed "Mayadoes" (the Turbopack
   JSX leading-space strip) in the report's method section; fixed the
   three pre-existing React lint errors (ref-read during render in the
   checklist, `Date.now()` in a ref initializer in scoring, and
   setState-in-effect in plan-weeks, now `useSyncExternalStore`), so
   `pnpm lint` is green again.

Verified end to end against homa-prod with a real account creation
(desktop + mobile Playwright walkthroughs, every step screenshotted);
all test leads and the test auth user deleted afterward. Typecheck,
lint, build, isolation all green.

## 2026-07-06 · S1 becomes the parent's name; birthdates are now real days, not month/year

Founder call, same session as the email-to-signup reversal above, one step
further: "I don't want the first question to be the kids' name, collect the
parent's name (first, last), then add your family," plus "get the actual
birthday, not just month, year." Two changes:

1. **New true S1: `ParentStep`.** First and last name, both required,
   right after the silent anonymous bootstrap, carrying the hero headline
   and the benchmark trust strip that used to live on `KidsStep`. New
   `/api/map/name` route + `saveParentName` (migration `lead_last_name`
   adds the column, applied to homa-prod) update the caller's own
   cookie-resolved lead directly, no upsert-by-anything needed since the
   lead already exists from the anonymous bootstrap. `KidsStep` drops back
   to a plain "add your family" step, no hero, no entry branching.
   `MapFlow`'s name gate (`!firstName`) takes priority over every other
   routing decision, including resume-link `?dd=`/`?start=` params (moot
   in practice: anyone holding such a link already claimed, and claiming
   is downstream of naming).
2. **Since name is now known before signup, `SignupStep` shrank back to
   one field: email.** Re-collecting the name there would have meant
   asking twice. `mapClaimSchema.firstName` stays accepted for backward
   compatibility (a route contract, not a UI field anymore); the claim
   route now forwards the already-known `lead.first_name`/`last_name`
   into both `claimLead` and the waitlist mirror instead of trusting the
   client for it.
3. **Real birthdates.** `mapChildSchema.birthMonth` (YYYY-MM) became
   `birthDate` (YYYY-MM-DD, validated as a real calendar date, e.g.
   rejects Feb 30). `lead_children.birth_month` already a bare `date`
   column, no migration needed, just stopped force-appending `-01`.
   `ageInMonths` became day-precise (a child isn't credited a whole month
   until the calendar reaches their exact birth day), verified live: a
   kid born 2022-05-17 read 4y 1m on 2026-07-06 (not 4y 2m, which the old
   month-only math would have shown). Backward compatible with bare
   "YYYY-MM" callers (the pinned sample report): a missing day just skips
   the day-adjustment, identical to the old behavior. Six `to_char(...,
   'YYYY-MM')` reads in `store.ts` (report view, plan builder,
   band-ready cron, etc.) all widened to `'YYYY-MM-DD'` so the stored day
   actually reaches `ageInMonths`. `KidsStep` gained a Day select between
   Month and Year, clamped to the real day count for the chosen month
   (handles Feb 28/29 without a separate leap-year check).
4. **Scoped to the lead-magnet only.** `public.children`/`lib/family.ts`/
   `lib/child-age.ts` (the real, post-signup product's family system) were
   deliberately left untouched: separate table, separate age math, out of
   the ask, and changing it risks the live chat agent's age-targeted
   material selection for no requested benefit.

Verified live end to end twice against homa-prod: the full happy path
(name → family → checklist → extras → signup-by-email-only → scored
report, name and real birthday confirmed in Postgres) and the
all-pending-band edge case (name → family with only an out-of-range kid →
pre-hub signup, personalized off the still-known name → hub with the
email-me-this-link option now live). All test rows deleted after.

## 2026-07-06 · Email moves from S1 to signup: "no email needed, sign up as the last question"

Founder call, reversing the /onboarding lead magnet's original zero-friction
ruling (email first, S1): kids and the checklist now auto-save under a fully
anonymous session, and email is asked for once, framed as creating the
account, right before the report scores. Real architecture change, not copy:

1. **Schema.** Migration `lead_email_optional` (applied to homa-prod):
   `lead_families.email` drops `not null`, the unique constraint becomes a
   partial index (`where email is not null`), so many anonymous rows can
   share null. `mapStartSchema` shrank to `{source, utm}` (no email, no
   name); a new `mapClaimSchema` (email, optional firstName/usState) covers
   the signup moment. `map.claimed` added to the event registry rather than
   reusing `map.started`, since this is now a genuinely separate moment
   from session start (a lead can answer the whole checklist before it
   fires).
2. **Store.** `upsertLead` split into `startAnonymousLead` (always inserts,
   email null) and `claimLead` (attaches email to the caller's own
   cookie-resolved lead). If that email already belongs to a different,
   older lead, `claimLead` reparents this sitting's `lead_children` onto
   the older account and deletes the now-empty anonymous row, so a second
   sitting on a new device never splits or loses a family. Verified live:
   claim against a pre-existing email correctly merged and left one row.
3. **Routes.** `/api/map/start` is now the silent, idempotent anonymous
   bootstrap (a caller who already holds a valid cookie gets a no-op
   success). New `/api/map/claim` is the only place email is ever asked
   for; `/api/map/score` now 409s defensively if a lead somehow reaches it
   unclaimed.
4. **The honesty gap this reversal opens, closed:** the hub already
   promises "I'll email you the moment the checklist is ready" for
   out-of-range kids. A family whose only kids are outside the scored band
   never reaches the checklist/signup path at all, so `needsPreHubSignup()`
   routes to signup before the hub whenever there is no reachable
   checklist and no email yet, keeping that promise honest. Verified live
   with a same-day-born kid: lands on signup ("...I'll email you the
   moment X's checklist is ready"), then the hub, with the email-me-this-
   link option now available.
5. **First name moved with it.** It had just been added to the old email
   step; rather than ask it twice (once vaguely upfront, once again at
   signup), it now lives only in signup, paired with email as "create your
   account." `ExtrasStep`'s "what should Homa call you" question is
   removed to match (it would have fired before signup on a fresh lead).
6. **Known trade-off, not fixed:** the 24h "you started but didn't finish"
   reminder cron is now mostly unreachable for a first sitting, since a
   family stalled mid-checklist has no email yet by design. Only a family
   that reached signup and stalled after (mid-extras) can still be
   nudged. `leadsNeedingReminder` and `childrenNowInBand` were both
   email-gated defensively so a null email can never reach a send
   attempt; this is a real reduction in recoverable abandonment, accepted
   as the direct cost of removing the upfront email ask.
7. **Also fixed while in this code:** `checklist-step.tsx`'s "answer from
   what you've seen {name} do" hint was silently rendering as one word
   ("Mayado") in Turbopack/SWC's build, not Babel's: a multi-line JSX text
   node right after an expression loses its leading space differently
   than the documented Babel algorithm. Rewritten with an explicit
   `{" "}` rather than relying on source whitespace across the line
   break; other `{child.name}` interpolations elsewhere in the app were
   spot-checked but not exhaustively swept for the same pattern.

## 2026-07-06 · The Homa skills bank: shared craft, targeted by age and capability

Founder: "we should have a homa skills bank... per age (or capability) or
general, so great family skills can be generalized for all users", with
the concrete example that a letter-worksheets skill should load for kids
learning letters and never for families that don't need it. Shipped:

1. **Migration #15** (`skill_bank`, applied to homa-prod): fleet-wide
   curated skills with targeting metadata: nullable min/max_age_months,
   lowercase stem tags (text[]), published flag, provenance note. RLS:
   members READ published rows only; deliberately NO write policies over
   the Data API, so nothing (member, anon, or a compromised model turn)
   can write fleet-wide instructions. Unpublish = one-action revert
   (M3-04 quarantine reasoning applied to skills).
2. **Targeting semantics** (pure functions in lib/agent-skills.ts): a
   bank skill advertises when at least ONE child passes EVERY gate it
   sets: inside the age band (when set) and matching a capability stem
   against the child's focus + interests text (when set). Both gates on
   the same child on purpose (a teen whose focus mentions letters must
   not summon the ages 2.5-7 letter skill). No gates = general, always
   advertised. 15 deterministic checks in
   `scripts/skills-targeting-check.mjs` (node --experimental-strip-types,
   no model, no network).
3. **One merged resolver** (`agent/skills/skill-library.ts`, replaces
   family-skills.ts): family_skills + filtered skill_bank in one map;
   family skill overrides a same-named bank skill (personalization, and
   also required: two dynamic resolvers emitting one name is a runtime
   ambiguity error in eve).
4. **Seeded the first two bank skills** (data insert, not migration):
   `letter-sounds-worksheets` (30-84 months, stems letter/phonic/
   alphabet/abc/sound/read; sound-first craft, the founder's Alessa
   example generalized) and `counting-worksheets` (24-72 months, stems
   count/number/math; cardinality + just-past-the-edge aiming).
5. Instructions now tell Homa the advertised set includes shared Homa
   craft skills and to load a match before improvising.

E2E on the real stack: member reads published bank rows; member POST to
skill_bank rejected (403); fresh session for a 5-year-old with focus
"letter sounds" loaded `letter-sounds-worksheets` via load_skill and
produced a D-and-M letter page themed to her dinosaurs ("tracing, letter
hunts, and a name finish": the seeded craft, followed). Test family and
user deleted (0 remain); the 2 bank rows stay, they are product content.
Typecheck, build, isolation (with skill_bank probes) all green.

Decisions made alone (auditable):
- **Promotion policy · FOUNDER RULING 2026-07-06 (overrides the agent's
  initial consent-first call, logged here for the audit trail)**: during
  beta, promotion from a family skill to the bank is founder-curated
  only. No family notification or consent step: "the objective is to
  make the product amazing; families won't (and don't need to) know."
  What stays regardless: the founder generalizes and strips anything
  family-identifiable before a row goes fleet-wide (that part is privacy
  posture, not permission), promotion happens outside the product via
  SQL, and no auto-promotion by the model ever. Revisit the consent
  question at the M4-04 privacy-policy lawyer pass before public GA.
- **Tags are curator-chosen lowercase stems**, substring-matched, because
  child focus is free text; stems ("letter", "count") hit the natural
  phrasings without a taxonomy. A real capability taxonomy can ride in
  when M2-04 gives profiles structured domain positions.
- **No audience enum column**: generality is derived (no age gate + no
  tag gate), one less thing to keep consistent.
- Bank read query capped at 100 published rows; advertised-per-family
  stays small by targeting, and the count cap on family skills (20)
  still bounds the family tier.
- markdownlint's first-line-heading warning on agent/instructions.md is
  pre-existing (the file is a prompt, not a doc); left alone.

## 2026-07-06 · Hero background warmed (founder screenshot: "update the hero bg like this")

The flat band-sky hero background is now warm cream with a soft gold glow
rising from the top-right, matching the founder's reference screenshot.
Calls made alone, keeping it in-system per the design law (never invent new
colors): the reference's sampled corner color (#FDEEC3) maps to the existing
`--gold-100` (#FFF3C2) and the base to `--bg-page`, rendered as one radial
gradient, no new tokens. The ribbon seam below the hero previously filled
its top half with band-sky to match the old hero; both halves are now
bg-page. Only the landing hero changed; the report page's band-sky header
and the Wave default are untouched.

## 2026-07-06 · Hero slimmed to one CTA, brand-named headline (founder call: "remove watch the film, remove the free-to-start trust line, add Homa is your homeschool assistant")

Founder gave three hero edits. Removals were literal: the "Watch the film"
button and the "Free to start ... See a sample report" trust line are gone.
The film modal (video element, resume-position localStorage, Escape handler)
only existed for that button, so it left too, along with the `.lp-film-*`
CSS; Hero no longer holds state and became a server component. The brand
film asset stays in `public/videos/` (unreferenced, cheap, likely reusable
for social). Call made alone: "add Homa is your homeschool assistant" was
read as the headline, replacing "Your homeschool assistant.", because it is
that exact sentence with the brand name added and the founder's 2026-07-05
ruling was already "say exactly what it is"; the accent color moved with the
word "assistant". /onboarding/sample keeps its other entry points (email
step, sitemap); the report promise now lives only in the onboarding flow
itself.

## 2026-07-06 · Benchmark demo removed from landing (founder call: "remove the where would homa start section, keep the Curious how Homa works card")

The "Where would Homa start?" three-question demo (BenchmarkDemo + DemoMap +
ds/Chip) is gone from the landing page. The surviving peek card now lives in
`components/marketing/HowHomaWorksCard.tsx` with `SkillWeb.tsx` moved up
beside it (the `benchmark/` folder no longer described anything). Calls made
alone, as consequences of the removal rather than new policy: the "Try it"
links in the nav and footer pointed at the removed section's `#try` anchor,
so they were removed rather than left dead (a "How it works" nav link still
covers the how-does-this-work intent); the demo's `.bd-sum` pop animation
CSS was dead and removed; the demo's inline "See where your child stands"
lead-magnet link is gone with the section, the hero, nav, and CTA band still
route to /onboarding.

Founder asked for a senior design review of the /onboarding first screen.
All changes use existing tokens; the surface now carries exactly two playful
devices (ruled paper + one hand note) per the restraint rule. Decisions made
alone, auditable:

- **Found a real layout bug**: the :root `--container-*` tokens (820/1100/
  1280) shadow Tailwind v4's `max-w-md/lg/xl` scale, so the page's `max-w-xl`
  column rendered 1280px wide (the near-full-bleed card in the founder's
  screenshot). /onboarding now uses explicit rem widths. Still shadowed
  elsewhere (signin `max-w-md` renders 820px, report fallback `max-w-xl`
  1280px); flagged for a follow-up sweep.
- Page shell: warm paper schoolbook background (`--bg-page-warm` +
  `--bg-paper`, the web-app onboarding kit's treatment), the trust line as a
  quiet pill chip, the flow column vertically centered, and a 260ms ease-out
  rise on step change (opacity + transform only).
- Footer no longer repeats the card's reassurance sentence on the same
  viewport; it slims to the method + privacy links. The sentence stays inside
  the card at the decision point. All ruled copy kept verbatim.
- "See a sample report first" moved from inside the action card to just
  below it: one action per card.
- Flow cards moved from `border-default` to `border-subtle` per the tokens
  doc (default is the input tone); answer chips keep default. Email step gets
  the kit's elevated single-card treatment (shadow-lg), DS-spec input (1.5px
  border, 54px, clay focus glow), arrow on the CTA, danger border on the
  invalid state.
- Pre-existing lint: eslint fails on 3 react-hooks errors that fail on clean
  HEAD too (checklist-step ref-read-in-render, plan-weeks setState-in-effect,
  scoring-step Date.now-in-render). Not introduced here; typecheck and build
  are green.

## 2026-07-06 · Skillify: "save this as a skill" works in the cloud (family skill library)

Founder asked whether eve can do what the Mac Mini's OpenClaw setup did:
Alessa says "make a worksheet that looks like Paw Patrol", then "save this
as a skill", and Homa can reuse it forever. Answer: yes, via eve's dynamic
skills (defineDynamic in agent/skills/ resolving per turn from the caller's
auth), with rows replacing files since deploys orphan sandbox filesystems.
Shipped the whole loop:

1. **Migration #14** (`family_skills`, applied to homa-prod): name
   (kebab-case, unique per family), description (the always-advertised
   routing hint, capped 200 chars), markdown (the procedure, capped 6,000
   chars, loaded only on demand), source, RLS member-CRUD like
   family_memories.
2. **Dynamic resolver** (`agent/skills/family-skills.ts`): turn.started,
   reads the caller's rows under their own RLS token, returns a map of
   defineSkill entries. eve advertises each description next to its
   built-in load_skill; the body enters context only when loaded
   (progressive disclosure). Failure posture: on DB error skills are
   absent for a turn rather than failing the turn.
3. **Tools**: `save_skill` (same injection scan as memory, count cap 20
   with a retire-one-first error, upsert-by-name so "tweak that skill"
   works) and `forget_skill` (exact name match, deleted body returned so
   "keep it" can re-save).
4. **Instructions**: new section drawing the line (memory = facts, skills
   = repeatable procedures), when to offer ("at most once per
   conversation, never nag"), and to load a matching skill instead of
   re-deriving.
5. **Chat chips**: "Skill saved / updated / removed" + busy labels
   ("looking up how we do this…" while load_skill runs).

E2E on the real stack, the founder's literal scenario: turn 1 made a
Chase-and-Skye letter-sounds worksheet; turn 2 "save this as a skill" →
save_skill wrote `paw-patrol-worksheet` with a proper routing description
(model-authored); a BRAND NEW session asked for "your Paw Patrol skill,
counting this time" → load_skill fired, create_worksheet followed the
saved style ("the whole pup crew helping her count to 5"). Both test
families and users deleted after (0 remain). Typecheck, build, isolation
(with new family_skills probes) all green.

Decisions made alone (auditable):
- **Two-tier skill model**: fleet skills (authored, git, ship by deploy)
  vs family skills (these rows). A family skill sharing a future fleet
  skill's name overrides it for that family only, eve's documented
  behavior, kept deliberately as personalization.
- **Skill saves are explicit-request or accepted-offer only** (Hermes
  staging insight, adapted): the model never silently grows the library,
  and every save/delete is chip-visible in the transcript.
- **Count cap 20** so the advertised list stays one bounded block of
  context; consolidation is a conversation ("which one should we retire?").
- **No skill events emitted**: same registry gap as memory (journeys/06
  §4 has no skill.* names and inventing names is banned); flagged for the
  registry v2 pass alongside M2-13's events.
- First E2E run's turn 1 "failed" only in the harness: 300s stream timeout
  during dev-server cold compile; the turn completed server-side (turn 2
  proved it). Rerun on the warm server passed 14/14. Noting so nobody
  chases a phantom.

## 2026-07-06 · /map renamed /onboarding (founder call: "instead of /map can we call it /onboarding")

The public route only. `app/map` moved to `app/onboarding` (report pages now
`/onboarding/r/[token]`, sample and method pages likewise), every internal
link, the sitemap, the emailed report URL, the share button, and the
resume-link redirect target updated. Permanent redirects added in
`next.config.ts` (`/map` and `/map/:path*`, plus `/conference` and
`/waitlist` now pointing at `/onboarding`), so every report or resume link
already sitting in an inbox keeps working. Deliberately NOT renamed, to keep
the change shippable and honest to the founder's ask (the URL): the
`/api/map/*` endpoints, `lib/map/`, `@homa/core` map modules, `map.*` event
names, `check:map` tooling, and the `lead_*` tables. "Map" stays the internal
concept name; "onboarding" is the public word.

## 2026-07-06 · The chat gets a brain: persona + durable memory (M2-01, M2-02 slice)

Founder direction: "make the chat incredible, Homa should be so smart; turn
onboarding info into files eve can use, maintain, and grow." Design answer
first: eve has no file memory, and sandbox files die on every deploy, so the
"files" are Postgres rows injected into context every turn (eve's documented
multi-tenant memory pattern; 01-architecture.md state model). Shipped:

1. **Migration #13** (`family_memory`, applied to homa-prod):
   `family_memories` table (kind fact / what_works / daily_note-reserved,
   500-char check, RLS: members CRUD their own family's rows, child
   coherence enforced through the caller's own RLS view of children);
   `families.parent_display_name` + `create_my_family(family_name,
   family_us_state, parent_name)` (old 2-arg signature dropped so
   PostgREST stays unambiguous); events INSERT policy for authenticated
   members emitting `chat.%` stamped with their own family_id.
2. **Per-turn family context** (`agent/instructions/family-context.ts`,
   defineDynamic on turn.started): family name/state/parent name, children
   with computed ages + interests + focus + child ids, and saved memories
   with budget usage, rendered as a labeled data-not-instructions block.
   A fresh session starts already knowing the family, which is what makes
   session rotation free, and turn 2 of the E2E proved it (new session,
   zero tools, correct recall).
3. **Memory tools**: `remember` (dedupe, 4,000-char family budget with the
   Hermes consolidate-on-full error shape, write-time injection scan:
   invisible-unicode blocklist + threat regexes in `lib/agent-memory.ts`),
   `forget` (substring match, ambiguity returns candidates, deleted content
   returned for undo-by-resave), `update_child_profile` (schema-bounded
   interests/focus only, scanned like memory). All caller-scoped via
   lib/agent-db (RLS is the tenancy wall); get_children demoted to a
   mid-conversation refresher.
4. **Persona port (M2-01)**: instructions.md now carries the SOUL/IDENTITY
   voice (opinions with conviction, proactive-when-earned, coach-the-parent,
   multi-child disambiguation, boundaries) merged with the design-system
   content fundamentals (offers never commands, reassure-before-inform,
   never "behind", sibling-comparison ban, one nudge max, no sycophant
   openers) + memory laws incl. the distress-data firewall (D5: acute
   distress is never written to memory).
5. **Onboarding → context**: "What should Homa call you?" field on family
   setup writes parent_display_name; child intake (interests/focus) already
   flows into the context block, so everything collected at onboarding now
   reaches Homa's head every turn without seeding duplicate rows.
6. **Chat surface**: assistant replies render markdown (react-markdown +
   remark-gfm, DS-token styles); busy bubble shows named tool activity
   ("saving a note…", "putting the worksheet together…") and hides while
   text streams; sage "Noted / Forgot / Profile updated" chips make memory
   effects visible in the transcript (MJ-02 confirmation spirit); error
   copy reassures first. Greeting uses the parent's name.
7. **Events (MJ-08)**: `chat.turn_completed` added to the typed registry
   (status/error_class/modality/latency_ms/model_tier/tool_calls);
   emitEvent gained optional accessToken + familyId so browser emits ride
   the caller's own RLS. Emitted from the chat client on finish and on
   error.

Verified against the real stack (next+eve dev, homa-prod, real model):
full E2E passed: signup → create_my_family with parent name → child →
turn 1 shares "co-op every Friday" → Homa calls remember unprompted → row
in family_memories → brand-new session answers "Fridays!" with zero tool
calls (pure injected context) → member can emit chat.turn_completed, cannot
emit for a foreign family_id. Test rows + user deleted after (0 remain).
Typecheck, build, isolation checks (extended with family_memories + chat
event probes) all green. Security advisors: no new findings (the
create_my_family SECURITY DEFINER warn is the documented, intended one).

Decisions made alone (auditable):
- **Memory medium is Postgres rows, not files**: forced by verified eve
  behavior (deploy-scoped sandboxes); the template's MEMORY.md layering
  survives as kinds on rows.
- **Timezone**: context date pinned to US Eastern for cohort one (families
  have no timezone column yet; the drip scheduler MJ-05 owns per-family
  timezones). TODO for human if a non-Eastern family joins earlier.
- **No approval gate on forget**: eve HITL parking would strand the lean
  chat UI (no approval surface yet, M1-04 proper). Guardrails instead:
  family-scoped RLS, single-row deletes, deleted content returned so the
  model can restore on "keep that".
- **Client-side event emit**: journeys/06 marks chat.turn_completed source
  "agent", but eve hooks don't expose auth attributes, so the browser emits
  under the caller's token until M1-02's server-side event persistence.
  tool_calls counts the last assistant message's tool parts (honest v0).
- **No memory.saved event invented**: the registry law forbids inventing
  names; the closest spec'd event (observation.logged) requires domain
  codes M2-13 owns. Logged as a known gap for M2-13.
- **Migration file named to the remote-assigned version** (20260706061222)
  so local files match `supabase migration list`. (A parallel agent session
  running tonight committed migration #11's file and this session's
  events.ts registry change mid-build; reconciled, no divergence left.)
- Pre-existing `pnpm lint` failures in map/* files (react-hooks purity
  rules) left untouched; CI gates typecheck + build + isolation, not lint.
  New chat code lints clean.

Still open toward "incredible chat": M1-04 proper (shadcn chat components
+ streaming scroll polish), cross-device history (M1-02 conversations
table), voice notes (M1-05), the M2-13 post-turn learning review (the
automated "gets smarter" loop; today Homa saves memories in-turn per her
instructions), M2-15 recall_conversations search.

## 2026-07-06 · Movement pass: the report becomes a living document

Founder asked "what would make this better for the user," then "do this
all." Shipped the full movement layer on top of the deep-dive loop:

1. Score history (migration #11, `lead_reports.history` jsonb): every
   rescore snapshots the prior per-subject scores with a timestamp before
   overwriting. History is capped at 12 snapshots.
2. Movement on the report, anti-guilt enforced: subjects that moved up
   since the last sitting get a "+N mo since last time" chip and the note
   from Homa celebrates the count ("1 subject moved since last time. Your
   work is showing up in the numbers."). Drops render nothing, silence,
   never a down arrow. The picture chart shows a faded hollow ring at the
   prior position, connected to the solid dot, only when movement is
   positive.
3. Shared `ReportView` server component now renders the live token page
   and `/map/sample`. The sample is a fictional demonstration child
   ("Maya", clearly bannered as sample data) so parents can see a finished
   report before giving an email. Linked from the hero's secondary CTA.
4. Next-kid handoff: when a family has another kid without a report, the
   report page ends with "[Name] is next" linking to `/map?start=<id>`,
   which drops straight into that kid's checklist.
5. Back button in the checklist and deep dive: undoes the last answer
   (server-persisted answers are simply overwritten on re-answer).
6. Plan check-offs: each plan activity gets a checkbox persisted in
   localStorage (key `homa-plan-<child>-<domain>`), no schema change,
   celebration line when a week completes.
7. State legal line: if the family gave a US state in extras, the report
   footer says homeschooling is legal in all 50 states including theirs,
   worded as reassurance, no legal advice. Sample shows Texas.

Decisions made alone: movement chips only ever show gains (drops are
noise at this sample size and violate the anti-guilt law); prior rings
capped at one per subject (latest prior, not the whole trail); the sample
child's answers climb full ladders so the sample shows a strengths-first
report, matching what a real strong sitting produces.

## 2026-07-06 (morning, wave 2) · World-class benchmark push: provenance codes, freshness loop, re-norm loop, 6 new research lanes

Founder: "do everything except 5&6 [paid instruments, expert review].
Boil the ocean." Four workstreams, decisions made alone:

1. **Provenance codes.** `MapItemContent` gained an optional `standards`
   field; 89 of 220 items now carry formal codes (CCSS, NGSS, CSTA, CEE,
   ELOF, C3, ACTFL, NCAS, SHAPE) populated only where the corpus verified
   the code. Re-verification after a standards revision is now a grep,
   not a research project. check:map validates the field.
2. **Freshness loop.** `pnpm check:sources`
   (scripts/benchmarks-freshness.mts): probes all 24 MAP_SOURCES URLs,
   enforces a verified-date manifest both directions, warns at 180 days
   stale, carries a revision watchlist (CSTA 2026, NCAS review, CEE 3rd
   ed, CCSS site move). Deliberately not in CI (network). First run
   caught two dead government URLs (CDC and ELOF both moved hosts in
   2025 site redesigns): fixed in MAP_SOURCES, which also fixes the
   public /onboarding/method source links. Paywalled journal hosts that
   reject probes are marked botBlocked (warning, not failure). Runbook:
   runbooks/benchmark-freshness.md.
3. **Re-norm loop (Homa-native norms).** `pnpm report:norms`
   (scripts/map-norms-report.mts): founder-ops, read-only, aggregate-only
   report over lead_answers x lead_children.birth_month, per item per
   6-month age bucket, next to the published anchor. Privacy posture:
   no PII in output, buckets under n=30 render as "low n", runs locally
   with the server-only DB credential, never deployed. Anchor-move gates
   (100+ observations, selection-bias check, wording check, conservative
   direction) live in runbooks/map-renorm.md. Smoke-tested against prod:
   38 answers, 1 child, everything correctly "insufficient data". No
   schema changes. Root devDep added: postgres (for the script only).
4. **Research wave 2, 6 parallel lanes** into docs/homa-benchmarks/:
   11 score distributions (percentile curves: Wordbank CDI, MAP, ORF,
   Lexile, NIH Toolbox), 12 ND/2e trajectories (tolerance implications
   per domain, D5 boundary respected), 13 math curriculum crosswalk
   (Saxon, Singapore, Math-U-See, and 7 more mapped to bank items),
   14 ELA curriculum crosswalk (AAR, Logic of English, IEW, and more),
   15 refresh sweep (executes the synthesis follow-up queue: CSTA 2026
   status, NAEP gaps, ORF grades 7 to 8, World Book missing grades,
   ELOF indicators, and more), 16 the 50-state homeschool assessment
   sweep (not legal advice; product re-verifies before display).
   Corpus README index updated with all six lanes.

Verified: check:map green (220 items, 89 coded), check:sources green,
typecheck green, build green, norms report runs against prod read-only.

Wave-2 outcome (all six lanes returned by 09:19): 1,793 corpus lines
added, dash law clean, every lane structured with porting notes and dry
wells. Load-bearing results folded into 00-synthesis.md sections 5 to 7:
the 14-item follow-up queue fully executed (NAEP civics cuts and grade 4
math average recovered, Ohio language hours table recovered, ELOF
indicators completed, tooth brushing and monkey bars anchored); one
supersession (Florida has NO statutory percentile line, correcting lane
10's unverified figure; Ohio abolished homeschool assessment Oct 2023,
lane 16 now canonical for states); one policy shift (AAP replaced its
2016 media policy Feb 2026, displacement model, affects future screen
copy); tolerance-band method with 13 verified bank-item windows (lane
11); the 16-domain ND/2e tolerance table (lane 12); and 134 curriculum
level rows mapped to bank items (lanes 13, 14). CSTA 2026 final text
lands July 13 to 15: computer_science re-verify is calendared.

## 2026-07-06 (morning, later) · Computer science ships as the 16th domain

Founder: "add the computer science domain." Decisions made alone:

1. Exposure-based, like spanish. CSTA anchors are when-taught placements,
   not developmental norms; a child who never met Scratch is not "growing"
   in anything. Exposure domains never render months-ahead, and the report
   frames them as "part of your world / whenever you like", which is the
   honest framing for CS. Anchors (66 to 192mo) order the ladder rungs.
2. 8 items on CSTA 2017 (the published edition): unplugged robot game,
   block sequence, debugging, loops and events, variables, decomposition
   and planning, text language, ships-something-real. New `csta` source
   key renders on /onboarding/method. Placed before spanish so spanish's
   "Last one:" intro stays true; checklist grows to 16 base questions.
3. Exposure copy in sentences.ts generalized (the "second language" line
   was hardcoded for all exposure domains); CS gets its own line. CS
   practice patterns added to plans.ts (the fallback would have served
   math patterns). Hardcoded "15 subjects" copy fixed: scoring step and
   map-check now derive from MAP_DOMAINS.length, BenchmarkDemo says 16.
4. Same MAP_BANK_VERSION (2026.07.2): the version has not shipped yet
   today, one bump covers the day's change set.
5. Queued for the CSTA 2026 release (this month): re-verify item wording
   against the renamed concepts, consider an AI-literacy rung (UNESCO
   2024 / AI4K12 were captured in corpus lane 09).

Verified: check:map green (16 domains, 220 items), typecheck green, build
green.

## 2026-07-06 (morning) · Benchmark corpus ported into the bank (v2026.07.2)

Founder: "do everything you need to use this to make our product better,
update everything." First porting pass from docs/homa-benchmarks/ into
`packages/core/src/map/content.ts`, 188 to 212 items, MAP_BANK_VERSION
2026.07.1 to 2026.07.2. Decisions made alone:

1. Applied the synthesis's top corrections: focus-5/focus-15 lost their
   minute claims (the minutes-per-year rule is unsourced folklore per lane
   08); short-sentences re-anchored to familiar listeners with a new
   stranger-clear item at 46mo (Hustad 2021); counts-to-100 moved 72 to 78
   (CCSS vs Clements-Sarama tension split, dual-cited); rides-bike moved
   108 to 84 (AAP 4-to-7 window). Anchor moves are safe: every stored
   report records the bank version that scored it (method page states
   this), and rescoring only happens on a new sitting.
2. Added 24 ladder items across 13 domains from lane porting notes, only
   parent-observable statements with verified anchors: theory of mind at
   56mo, Lowenfeld drawing stages, Tabors/Hoff-Core spanish exposure rungs,
   gallop/swim/bike sequence, rhythm notation, savings plan (CEE),
   continents and oceans, stop-and-go inhibition game, time estimation.
   7 new source keys (hustad, crowe-mcleod, wellman, lowenfeld, ufli, cee,
   hoff-core) render automatically on /onboarding/method.
3. Deliberately NOT ported: per-minute fluency rates (field disagrees 2x),
   topic-placement items (no national grade placement exists), legal ages
   (facts, not development), FitnessGram zones (display-law risk). The CS
   domain is deferred: CSTA 2026 lands this month and a 16th domain
   lengthens every child's checklist, so that is a founder call, queued.
4. Plans/sentences needed no changes: practice patterns are per-domain and
   new statements were written to read correctly through skillPhrase's
   gerund transform (verified by check:map plan fixtures).

Verified: check:map green (212 items, all fixtures pass), typecheck green,
build green. Corpus synthesis and README updated with porting status.

## 2026-07-06 (overnight) · National benchmark corpus commissioned

Founder: capture national benchmarks on all subjects and milestones for
ages 2 to 16, via deep parallel research, kept so progress reports get
better anchors. Decisions made alone, in the ICP-research pattern:

1. Location: new tracked folder `docs/homa-benchmarks/` (README + 10 lane
   files + synthesis). `homa-research/` is off-limits by repo law, and the
   corpus must be tracked and agent-readable. Root README repo map updated.
2. Shape: internal reference docs, never parent-facing. Assessment
   vocabulary is allowed inside the corpus; anything ported to product
   surfaces still passes the map content laws (parent-observable, banned
   words, citations) and the anti-guilt display law.
3. Anchor convention: whole months, end-of-grade grade-to-month table in
   the folder README matching the anchors already in content.ts (gr 3 =
   108mo etc). Grade conversions are marked convention, not fact.
4. Nothing auto-flows into `packages/core/src/map/content.ts`: porting is
   deliberate, per item, with a MAP_BANK_VERSION bump and check:map green.
   Each lane file ends with "Product porting notes" naming its candidate
   anchors.
5. Sourcing law copied from the ICP folder: every claim linked with access
   date, FACT vs INFERENCE labeled, unverifiable numbers go to "dry wells"
   sections instead of being estimated.

Ten research agents dispatched in parallel (early childhood 2 to 5, math,
reading, writing and language, science, social studies, arts/PE/health,
SEL/EF/life skills, world languages/CS/digital, assessment norms and the
homeschool testing landscape). Synthesis file written after their return.

## 2026-07-06 · Deep dive now ends in the curriculum (founder live-test feedback)

Founder, testing on production: "when I click dive deeper and answer more
questions, it just brings me back to the progress report. Expected: it
creates a custom curriculum for the next month." Fixed: a deep-dive
sitting now rescores and lands directly on that subject's four-week plan,
REBUILT from the refined answers (`getOrBuildPlan` gained a rebuild mode:
fresh targets from the just-found starting line, retest clock restarted,
retest email re-armed, which IS the monthly loop). The plan page shows a
"built from your deep dive" banner; the report's go-deeper buttons now
promise the plan ("pin down the start, get the plan"). The first full
checklist still lands on the report, deep dives land on the plan.

Also fixed while reading rendered plans: skill statements now conjugate
into sentences (gerundize: "Knows multiplication facts" reads as "ten
minutes a day of knowing multiplication facts", with colon-example and
second-verb-clause trimming so week focuses stay short). Verified live:
initial plan targeted multiplication, deep dive walked down to the 7y
foothold, rebuilt plan re-targeted skip-counting first, retest clock
reset and email re-armed, banner rendered. Test rows cleaned scoped by
email; one real lead (with a plan) appeared during the session and was
left untouched.

## 2026-07-06 (later still) · Full copy simplification pass

Founder: "do a pass that simplifies and clarifies all copy." Ran the
copy-editing skill's clarity/voice/word-level sweeps over every parent-
facing string: the sentence bank (domainLine, homaNote, tryHeading), all
15 domain intros and both growing-activity sets, all ~45 plan practice
patterns and 9 style notes, every flow screen (email, kids, checklist,
extras, deep dive, scoring, hub), the report, plan, method, and privacy
pages, the four transactional emails, and the landing sections. Rules
applied: cut weak intensifiers (completely/totally/genuinely), one idea
per sentence, front-load the point, verbs over abstractions, keep the
warmth but never at the cost of the meaning. ~130 strings tightened; the
banned-word/em-dash linter guarded the whole pass.

Two real fixes surfaced by reading rendered output during the pass:

1. homaNote grammar: with zero ahead subjects the note read "on track in
   12 more" with no preceding clause; "more" now only follows an "ahead
   in N" clause.
2. Plan floor bug: when a subject had ONLY a not-yet answer (no confirmed
   easier skills), plan targets fell to the bottom of the bank, so a
   6-year-old's fine-motor plan targeted block-stacking. The target floor
   now anchors at the named not-yet itself (the deep dive refines it
   downward only with evidence). Regression fixture added to check:map.

Verified: check:map, typecheck, build green; fresh 6-year-old e2e with
screenshots of the report, plan, /map, and hero; scoped test cleanup (the
two real leads untouched). Committed together with the parallel session's
/terms page (below), which was verified in the same build.

## 2026-07-06 (later still) · /terms shipped for Google OAuth branding

Google's consent-screen branding form (part of making the Google sign-in
screen say "Homa" instead of the raw Supabase URL) requires public privacy
and terms URLs. /privacy existed; /terms did not, so it was written in the
same plain-language voice and shipped at apps/web/app/terms/page.tsx
(+ footer Support column + sitemap). Two deliberate omissions, both because
the LLC filing is deferred until Stripe activation (entry #11 above): no
legal entity name and no governing-law clause. Revisit both when the entity
exists. Content commitments mirror what is already true in code and copy:
free today, parents only (18+), children never use Homa, not-a-test and
not-medical-advice disclaimers matching /map/method, data terms deferring
to /privacy, delete-anytime via hello@mail.thankshoma.com.

## 2026-07-06 (later) · The go-deeper loop shipped (founder: "don't defer these, BOIL THE OCEAN")

The read-through session's "deferred" list, built the same night on founder
order. What shipped:

1. **Subject deep dives** (the click-into-a-subject ask): up to 8 extra
   questions per sitting via an adaptive probe (`nextDeepDiveItem` in
   packages/core): walks DOWN after a not-yet to find the honest starting
   line ("how far back does the struggle begin", framed as footing, never
   as testing-at-N-years-old), climbs UP past the report's two-rung cap
   for strong subjects. Mode chooser first, straight from the transcript:
   answer from memory, or sit with the kid and try them together (mode
   captured in map.deep_dive_started). Rescoring updates the same report
   token; the report email is now sent once ever (rescores never re-mail).
   Entry points: per-subject "Go deeper" buttons on the report and the
   `?dd=childId.domainId` param the retest email uses.
2. **Four-week plans + the retest loop** (the addiction mechanic): pure
   deterministic builder (`buildFourWeekPlan`): the child's confirmed
   footing sets the starting line, the bank's next two rungs become week
   1-2 and 3-4 focuses, ~45 hand-written practice patterns (3 per subject:
   daily rep, interest-flavored rep, out-in-the-world rep) fill the weeks,
   the first interest flavors the copy, and the family's homeschool style
   adds a one-line bend (9 style notes). Plan page at
   /map/r/[token]/plan/[subject], tokenized + printable, built on first
   view (migration #9 `20260706035723_lead_plans`, deny-all RLS). Building
   a plan arms retest_at (+28 days); cron job 3 sends the one retest email
   into the subject's deep dive, so the number can visibly move. Verified
   once-only send.
3. **What-are-you-doing-right capture**: strength cards on the report ask
   "what are you doing in [subject] that works?", saving per-subject into
   the child's context (deep-merged so subjects never clobber each other).
4. **Extras additions**: per-kid activities tags (gymnastics, co-op...)
   and the family "crew" tags (family members, pets, stuffed animals, the
   neighbor kid) for future personalized materials. Names only.
5. **Bug found and fixed live (migration #10 `20260706040958_lead_link_token`):**
   every cron/resume email used to ROTATE resume_token_hash, which silently
   logged out the device the mom actually used. Emailed links now mint a
   separate link token; both are honored on lookup, so an email never kills
   the cookie. Also fixed: plan targets could aim below already-confirmed
   skills after a deep dive (now floored at the highest confirmed anchor),
   and long two-clause skill statements are trimmed to their first clause
   inside plan sentences.

NOT built, still law-gated (not scope-gated): photo upload for
personalization. BUILD.md law 5 / D4 requires the dedicated consent screen,
TTL on raws, and executed no-training DPAs first; those are founder
artifacts. The crew capture is the text-only forerunner. Location-aware
suggestions stayed generic-outing level on purpose (PRD non-goal:
discover/local engine); health/weight capture stays in the notes field per
MJ-13/D6.

Checks grew with the surface: deep-dive direction fixtures (down after
not-yet, up after easily, sitting cap), plan fixtures (4 clean weeks × 15
subjects × 4 ages, no placeholders, no banned words). Verified live end to
end as a 10-year-old with growing math: base checklist → deep dive walking
down to the 7-year-old foothold → rescore (no duplicate email) → plan
targeting skip-counting and multiplication (not baby skills) flavored with
minecraft + Montessori → forced retest_at → cron sent exactly one retest
email → whats-working deep merge kept two subjects. Test rows cleaned,
scoped by lead id; the two real production leads untouched.

## 2026-07-06 · Progress report v2: founder + Alessa read-through implemented

Source: the recorded 45-minute walkthrough (founder + Alessa driving the live
flow, transcript in Downloads). Every actionable ruling extracted and shipped:

1. **Vocabulary, everywhere user-facing:** "progress report" not map,
   "subject" not domain, plain age words not "band", color words
   yellow/green/blue in copy (tokens stay gold/sage/sky in code). Rebased
   over and merged with the parallel copy commit 5f861c4 (same direction,
   subset), keeping its further ruling: the "a checklist for you, never a
   test for them" tagline is dropped everywhere as confusing without
   context.
2. **Landing hero says what it is:** "Your homeschool assistant." with the
   old tagline demoted into the sub-line; CTAs are "See where your child
   stands" (hero/nav/founding families) and "Get your free progress report"
   (blog/method).
3. **Flow simplification:** S1 is email-only ("Enter your email to get
   started"); kids are name + age only with an explicit nickname-is-fine
   line; no interstitial before question one (a one-time hint rides above
   it); fixed-height question card so nothing jumps; "subject 4 of 15".
   Item fixes: "without a wobble" and "for a few turns" rewritten; the
   second-language questions are now self-explanatory and lead with "skip
   if it's not part of your home."
4. **The extras step (new):** after the checklist, before the report, all
   optional: typeable interest tags with age-aware suggestions, multi-select
   help-with, per-kid notes, and (first time only) what to call her,
   homeschool style + how-closely, current curriculums as tags, and a
   family-values free text. Migration #8 (`20260706023548_lead_context_jsonb`)
   adds jsonb context bags on lead_families and lead_children; new
   /api/map/extras route + map.context_added event. Rationale from the
   session: ask context AFTER she's invested, and style/curriculums are
   load-bearing for future curriculum generation.
5. **Report fixes:** the note-from-Homa is spoken by the logo mark (the
   "h" circle read as a mystery); growing subjects name the child's actual
   next skill (frontierStatement from the scorer) with rotating phrasings
   instead of one repeated sentence 13 times; the top note reads the room
   (a growing-heavy picture gets "solid footing in N subjects, a clear
   next step in the blues", never a defeating tally); "with something
   small to try attached" phrasing gone; the things-to-try section
   right-sizes to "Where to start, pick one for this week" when 3+
   subjects are growing; every subject card expands (details/summary) to
   show what was asked, her answers, "typical by [age]" anchors, the
   growing activity, and linked benchmark sources, answering "where did
   you get that benchmark?" in two taps.
6. **Verified:** typecheck, build, check:map, check:isolation green; live
   e2e as a struggling 10-year-old (12 not-yets) confirming the kind
   read-the-room note, named frontiers, expanders, and context persistence;
   screenshots reviewed; test rows cleaned.

Deferred to the product backlog, captured from the session but NOT built
into the lead magnet (they are product scope): click-to-go-deeper quizzes
per subject with optional kid-sits-with-you mode, build-a-curriculum from
a growing subject + retest in four weeks (the retention loop, ties to
FR-9/M3-03), what-are-you-doing-right follow-up on far-ahead subjects,
photo upload + family members for personalization (D4 consent floor
applies), location-aware activity suggestions (museum trips), and health/
weight/social context capture (sensitive: MJ-13/D6 firewall applies).
The extras step's notes field captures the light version of the last one.

Operational notes: two real leads existed in prod during this session (one
with 2 kids + 2 reports generated), so the map.* events cleanup used during
testing wiped their funnel events too, analytics-only loss, lesson logged:
future test cleanup must filter by the test lead's ids, not by event name.
Announcement draft updated to progress-report wording; still unsent.

## 2026-07-05 (later) · Map bank v2026.07.1: ages 8 to 16 shipped (LM-7)

Continuation of the "ship all" mandate: 75 new upper-band items across all
15 domains, anchored to school grade bands (gr 3 ~108mo, gr 5 ~132mo, gr 8
~168mo, gr 10 ~192mo, ladder headroom to ~17.5y) and cited to the same
frameworks the template benchmark library carries for PreK-12 (CCSS math +
ELA, NGSS MS/HS, C3, National Core Arts, SHAPE, CASEL, ACTFL Seal-of-
Biliteracy path, plus three new source keys: Dawson & Guare executive
skills, AAP HealthyChildren life-skills/chores guidance, ASHA school-age
language). Scored range now 2y0m to 17y0m; under-2s keep the pending-band
promise flow. Each domain gained an age-appropriate "growing" activity for
kids 8+ (report picks by age). Agent calls made alone: plateaued skills
(e.g. phonics for teens) deliberately read "at age" rather than
manufacturing ahead-months; teen items lean on artifacts a parent has seen
(essays, laundry, schedules, ensembles) rather than quiz-the-kid prompts,
per the plan's face-validity risk note. Verified: check:map extended to the
full range with 10yo and 15yo golden-kid fixtures (all green), live 12yo
e2e against homa-prod (base selection, scoring, teen report render, older
activity swap, no toddler copy leaks), test rows cleaned. The read-aloud
debt now covers all 188 items.

## 2026-07-05 · Lead magnet v2 SHIPPED (founder: "ship all, start with your recommendations, make room to improve")

Founder ruled all eight planning decisions to the recommended options
(D1 two-stage ages 2-7 first · D2 "where your child stands" vs national
benchmarks, months-ahead framing · D3 lead tables + claim-at-invite ·
D4 full adaptive checklist · D5 report on screen + email · D6 one announce
email to the existing waitlist · D7 capture out-of-range kids + automatic
promise-keeping · D8 human-reviewed sentence banks, zero model calls).
Built and verified end to end this session:

1. **Migration #7 (`20260705223838_map_lead_tables`)**: lead_families /
   lead_children / lead_answers / lead_reports, RLS enabled with ZERO
   policies plus privileges revoked from anon+authenticated (stricter than
   the waitlist). Applied to homa-prod via MCP; file renamed to the applied
   version. `scripts/isolation-check.mjs` gained 6 lead-table cases, all
   green.
2. **Server data path**: first server-only secret enters `apps/web`
   (SUPABASE_DB_PASSWORD via the Supabase transaction pooler,
   `lib/map/db.ts` + postgres.js, prepare=false, max=2). Added to Vercel
   prod+preview (Sensitive) via CLI. Lead ids never come from the client:
   an httpOnly resume cookie (sha256-stored token) is the only session
   mechanism, and every child-scoped write re-checks ownership.
3. **packages/core `map/`**: bands math, versioned content bank
   (v2026.07.0: 15 domains, 113 parent-observable items, ages 2 to 7,
   every item cited to CDC/ELOF/CCSS/NGSS/C3/NCA/SHAPE/CASEL/ACTFL/
   Harvard-EF/Clements-Sarama/HWT), adaptive ladder (base + up to 2 rungs,
   unlocked only by "easily"), deterministic scorer (frontier months-ahead,
   +24 cap, growing floor, confidence), sentence bank, map.* typed events.
   Bank content derives from homa-template's questionnaire + benchmark
   library (the M0-10 asset), extended to cover 4.5-7 where the template
   bank thinned out.
4. **`pnpm check:map` + CI step**: content linter (banned words per the
   never-say law, em dash ban, citation presence, sane anchors) + golden-kid
   scorer fixtures (ahead/mixed/sparse/struggling, determinism, no negative
   number ever rendered). Caught one real violation pre-ship ("behind" in a
   social-studies item, rewritten).
5. **The flow at `/map`**: email-first (lead secured before any work, dup =
   welcome back), kids with interests + help-with chips and the sage
   out-of-range card, per-kid checklist (4 chips + skip, tap-to-save with
   retry queue, finish-later), 2.2s scoring theater, report page at
   `/map/r/[token]` (strengths first, server-rendered SVG dot chart, per-
   domain evidence echoing her own answers, growing activities attached,
   methodology + sources, founding-families close, print styles), report
   email via Resend, `/map/method` methodology page, `/privacy` (launch
   gate 7 pulled forward: we now hold child names + birth months + answers,
   so the policy ships with the feature naming Supabase/Vercel/Resend and
   the delete-anytime path).
6. **Promise-keeping cron** (`/api/map/cron`, hourly via apps/web/
   vercel.json, CRON_SECRET-gated): the single 24h reminder (one send ever)
   and the band-ready email that fires automatically when a pending child's
   age band ships.
7. **Landing claims pass**: hero "Loved by 12,000+ homeschooling families"
   avatar row and "Start free for 14 days" CTA (rulings C2/T2 violations,
   ported from the kit) replaced with the honest map CTA + trust line;
   pricing tier grid replaced by a founding-families band (D9's unlimited-
   children promise is the only plan claim); invented testimonial quotes
   replaced by the true our-story band with an explicit no-invented-
   testimonials promise; community section's fake "4 families within 5
   miles" stat reframed as roadmap; FAQ rewritten honestly (ages 2-7 today,
   child never uses it, pricing published before anyone is charged);
   benchmark demo now hands off to /map. `/waitlist` + `/conference` 308 to
   `/map`; old form + page deleted; every lead still mirrors into
   public.waitlist so MJ-09 invites read one list. This also resolves DM7's
   flagged tension for map leads: the S1 microcopy now says "your email gets
   each child's map and your founding-family invite," which is the consent
   scope for everything the flow sends.
8. **Verified**: typecheck, build, check:isolation, check:map all green;
   live e2e against homa-prod (start → dup → 2 kids → 26 answers → score →
   report page renders lawfully → Resend delivery to delivered@resend.dev →
   viewed_at stamped → cron auth + run → resume no-enumeration → bad token
   soft page); report + /map + landing screenshotted; all test rows deleted
   after.

Agent-made calls within the founder's mandate, logged: ladder capped at 2
rungs per domain (reaches the +24 display cap; more taps add fatigue, not
signal) · offline S1 falls back to the existing waitlist queue so a dead-
wifi lead is still captured · exposure-based domain (second language) never
produces a months number · report email contains no numbers (sibling-
comparison law applied to inboxes) · cron reminder requires 4h of
inactivity and one child unfinished. Founder still owes: read-aloud pass on
the 113 item statements + report sentences (same bar as the copy kit), the
D6 announce email send (draft: `docs/homa-planning/map-announcement-draft.md`),
and the phone test.

## 2026-07-05 · Marketing demand engine spec (14-marketing-demand-engine.md)

Founder-approved design session for the B2C demand-gen pipeline, ported from the
founder's B2B consulting content engine. Founder rulings recorded as DM1 to DM6 in
the spec: lives inside this repo as `marketing/` (not a separate repo), blog built
in `apps/web` as part of the project, all six social channels plus blog plus
waitlist email at launch, manual trigger first with routines shipped disabled,
full-engine scope, email lane day one.

Agent calls made alone (all in the spec): raw/ and signals/ live beside content/
(reservoir vs outputs lifecycle), micro-copy formats get a batched gate pass
instead of nine full double-gates (cost), skills named `marketing-*` in
`.agents/skills/`, scorer is stdlib Python local-only (not in CI yet), no empty
growth-map folders.

Tension flagged, not resolved: **DM7**, the live waitlist form promises "email
only used to send your invite," so pipeline nurture emails are staged but never
sent until the founder rules on consent scope (options in spec §10). Sources
honored: `homa-macmini/`, `homa-research/`, `homa-template/` were not read and are
banned as signal sources in the spec's safety rails.

## 2026-07-05 · Lead magnet v2 planning session (artifacts only, no product code)

Founder asked for a plan to replace the write-only waitlist with a
context-grab lead magnet ("see where your child ranks" report per child,
ages 2 to 16, benchmark-compared, emailed). Produced five reviewable HTML
artifacts in `docs/homa-planning/lead-magnet/` (index + decisions, flow
chart, user journey, states + backend map, full report mock). No decisions
were made unilaterally; eight decision points (D1 to D8: conference timing,
claim framing, account-vs-lead storage, checklist depth, delivery, existing
waitlist emails, out-of-range capture, narrative source) are presented with
recommendations and await founder rulings via the artifact composer.

Tensions flagged for the record, not resolved here:

1. "See where your child ranks" vs the never-say law: artifacts recommend
   "see where your child stands" + months-ahead vs national benchmarks
   (the shipped hero's own promise), never percentile/"national average"
   claims we cannot substantiate.
2. Real accounts during the flow would touch the PRD non-goal ("public
   signup: invite codes only") and would put family-creation on a public
   surface before the M1-07 adversarial suite exists; artifacts recommend
   lead tables + claim-at-invite instead (rides MJ-09).
3. Report generation needs the first server-only Supabase secret in
   `apps/web` (build-log 2026-07-04 #3 anticipated this moment for MJ-09).
4. Privacy policy (launch gate 7) effectively pulls forward: this feature
   holds children's names, birth months, and developmental answers, not
   just emails, and the current form promise ("email only used for your
   invite") must be re-vetted.
5. Pre-existing violation spotted in shipped code: `Hero.tsx` renders the
   kit's "Loved by 12,000+ homeschooling families" avatar row (fabricated
   social proof, ruling C2) and a "Start free for 14 days" CTA (pricing
   claim, T2 + Deliverable 0 hard constraint). Journeys/02's header note
   explicitly says both may not ship. Needs a fix regardless of v2.

Sources honored: `homa-macmini/` was NOT read (repo law; founder-provided
screenshots used instead). Reference material came from `homa-template/`
(read-only): the 15-domain questionnaire bank (2y0m to 7y0m) and the
PreK-12 citation-backed benchmark files, which is the ported asset M0-10
already names.

## 2026-07-04 · Deliverable 0 build session

1. **"Never used to train AI" claim withheld from the landing page.** The
   journeys/02 landing spec includes the no-training privacy line, but claim
   rule 6.6 (journeys/07 §6) says data promises ship only when the DPAs are
   executed. The DPAs do not exist yet, so the page says only what is already
   true: "we'll only use your email to send your invite" and "we'll publish our
   full privacy policy before the first family joins." Swap in the strong claim
   the day the DPAs are signed.
2. **No pricing anywhere on the page**, including the "$29 when you're ready"
   line the journeys/02 conference spec suggests. BUILD.md Deliverable 0 hard
   constraint ("no pricing on the page," decision T2) outranks the older
   journey doc per the documented precedence order.
3. **Waitlist storage pattern: write-only RLS with the publishable key.** The
   anon role can INSERT a pending waitlist row and waitlist.* events, and can
   never SELECT/UPDATE/DELETE (verified by scripts/isolation-check.mjs). No
   service-role secret exists in the app at all yet. When the invite service
   (MJ-09) needs to read the list, it gets a server-only secret key via env.
4. **Age bands on the waitlist form:** under 2, 2–3, 4–5, 6–7, 8–10, 11+.
   Chosen to cover the full boil-the-ocean range (D3) while keeping the proven
   2–7 core visible as distinct bands for cohort prioritization.
5. **Typed event registry (MJ-08) lives in `packages/core`** and writes to
   `public.events` over the Data API, best-effort (analytics never break the
   feature). First registered event: `waitlist.joined`. Event props carry no
   PII; the email lives only in the waitlist row.
6. **UI is deliberately wireframe.** Sidney is running the design pass; copy,
   structure, and behavior are binding, visuals are placeholders. The
   worksheet-sample slot on the landing page is an empty dashed box on purpose
   (no fabricated artifacts, ruling C2).
7. **Tenancy v0 (M0-05) shipped read-side only.** families/family_members/
   children tables exist with deny-by-default RLS and member-scoped SELECT
   (plus children INSERT/UPDATE for members). Family creation policies land
   with FR-1's server-side invite flow, so nothing can create a family from
   the public surface today.
8. **Advisor fix applied to a project-level helper:** revoked Data API EXECUTE
   on `public.rls_auto_enable()` (Supabase auto-RLS trigger helper) plus our
   `is_family_member()`, per security advisors 0028/0029.

9. **Deployed to production; canonical project is `homa`.** Sidney bought
   **thankshoma.com** and attached it (via the dashboard) to a Vercel project
   named `homa` (team Homa) rather than the agent-created `homa-web`; both
   pointed at the same repo/rootDirectory. Consolidated on `homa`: copied the
   env vars over (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
   VERCEL_USE_EXPERIMENTAL_FRAMEWORKS=1), redeployed from main, added
   www.thankshoma.com as a 308 redirect to apex, deleted the duplicate
   `homa-web` project, relinked the local checkout. Verified on the domain:
   /, /conference, www redirect, and a waitlist POST that landed in Supabase
   (then cleaned). Nameservers were already on Vercel DNS. eve's /eve routes
   fail closed (no auth policy configured yet), which is correct until FR-1.
10. **Deliverable 0 definition-of-done status:** deployed ✓, waitlist rows
   verified in Supabase ✓, phone test ☐ (Sidney), Alessa read-aloud ☐
   (Sidney + design pass).

11. **No booth at the conference (founder correction, 2026-07-04).** Alessa
   tells moms "thankshoma.com" in conversation; there is no QR banner. So `/`
   is the primary conference capture surface (spoken-word signups arrive as
   source=organic), and `/conference` is repurposed as the link Alessa texts
   a mom mid-conversation, keeping clean source=conference attribution when a
   link can carry the path. Post-conference, conference-weekend organic rows
   can be classified in SQL at invite time. Booth-presuming copy removed from
   the page.
12. **`/conference` renamed to `/waitlist` (founder call, 2026-07-04:
   "waitlist instead of conference, let's not overcomplicate it").** One
   generic direct-to-form page, source=organic, channel attribution via utm
   params if a shared link ever carries them, plus created_at time windows.
   `/conference` 308-redirects to `/waitlist` so anything already shared
   keeps working. The `conference` value stays in the source enum for future
   use.
13. **Wireframe carries no drafted copy (founder correction, 2026-07-04).**
   The first wireframe pass drafted voice-level copy (hero, trust points,
   form microcopy, SEO metadata); founder ruled the wireframe must be
   non-opinionated. Now: voice-level copy renders as labeled
   `WireframeSlot` placeholders pointing at the copy kit (journeys/07 §5);
   headings, form labels, buttons, and validation messages use neutral
   functional text (best-practice defaults: visible labels, optional
   marking, plain error text, form-adjacent privacy note); metadata is
   neutral. The one voice sentence kept is the vetted always-true privacy
   line (entry #1). Copy kit + design pass fill the slots.

## 2026-07-04 · Blindspot pass + grilling session (finding-unknowns skill)

A full BUILD.md/planning review (blindspot pass on the plan corpus + repo-state
audit, then a one-question-at-a-time grilling interview) surfaced 9 gaps.
Decisions made, in the order asked:

1. **July 13 copy/design path:** agents draft final landing copy from the
   `journeys/07 §5` kit (variant B) and apply the homa-design v2 pass,
   replacing the wireframe slots; founder + Alessa do the read-aloud + phone
   test after. BUILD.md's Deliverable 0 DoD line corrected to drop the
   "at a booth" framing (there is no booth, per entry #11).
2. **M0-07 conference kit:** re-scoped for no-booth reality, question card +
   phone-based capture (no printed sheets), commitment ladder stops at the
   waitlist-email rung, the $29/$19 Stripe preorder rung dropped (no Stripe
   account exists yet, no booth to run a QR off). Entity/LLC filing deferred
   until it actually blocks (Stripe activation, ahead of invite #1) rather
   than done tonight. See `journeys/09 §2, §6.2` (re-scoped M0-07 spec).
3. **IC-10 vs D4 photo contradiction resolved:** `journeys/05` IC-10 ("no
   child-likeness uploads") is superseded by D4 (photo personalization ships
   day one with consent). IC-10's decline copy now applies only to the
   consent-declined path. Amended in `journeys/05` directly (the row + §4
   example 8).
4. **CI added now**, before any Phase A code: `.github/workflows/ci.yml` runs
   typecheck + build + `check:isolation` on every push/PR to `main`. Required
   secrets (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   — both public-safe publishable values) set on the GitHub repo. Satisfies
   BUILD.md law #1 ("isolation tests green in CI always") for the first time;
   extend with the MJ-08 events-registry check once that registry covers more
   than `waitlist.joined`.
5. **M0-01 timing:** next major agent task after the copy/design pass, not
   run in parallel and not skipped. `eve` pinned to an exact version (`0.19.0`,
   was `^0.19.0`) in `apps/web/package.json` so upgrades are always a
   deliberate, logged decision; started `docs/homa-planning/eve-churn-log.md`
   to feed the eject tripwire (`12-roadmap-okrs.md` §tripwires) with real data.
6. **Email/invite bridge named explicitly:** BUILD.md's Phase B bullet list now
   names **M1-08 minimal** (Resend transactional email: welcome, journal-prompt,
   weekly-note, receipt templates + the opens/clicks/unsubscribes webhook
   bridge that `journeys/06 §7` requires for the anti-guilt ratio law) and
   **MJ-09** (waitlist read path + invite codes + invite email — today's
   waitlist is write-only with no way to invite anyone off it) — previously
   both were only implicit under FR-1/FR-3.
7. **Cost-telemetry timing (Gateway `ai-reporting-*` headers + per-key budget
   caps moved into Phase B vs staying in Phase C with FR-11): left open,
   question skipped.** BUILD.md's Phase A section gained a platform-ceilings
   summary (sandbox region/rate/snapshot limits, Workflow event/step caps,
   function duration) so the next agent designing M0-01/M0-03 sees them, but
   the FR-11/T2 telemetry sequencing itself was not changed.
8. **Resend domain live:** `mail.thankshoma.com` verified in Resend (DKIM, SPF
   MX+TXT, DMARC, tracking CNAME all green; click+open tracking on per
   `journeys/06 §7`'s explicit opens/clicks webhook requirement; inbound
   receiving deliberately left off — `journeys/02` line 890 defers
   reply-to-email to POST-GA, v1 is deep-link-to-chat only).
   `RESEND_API_KEY` is in `apps/web/.env.local` (gitignored) and in Vercel
   production env (added via CLI, type Sensitive).

## 2026-07-04 · Deliverable 0 copy + design pass (grilling decision Q1)

Replaced the wireframe's placeholder slots with final copy and the homa-design
v2 visual system, closing the loop the grilling session opened.

1. **Copy**: hero is variant B verbatim from `journeys/07 §5` ("Know exactly
   where your child stands. Without ever testing them."). How-it-works,
   trust, and paperwork bands pull from pillars A/B/C one-liners. Trust point
   #3 uses the vetted honest claim from entry #1 ("we'll publish our full
   privacy policy before the first family joins"), not the gated "never
   trains AI" line. Waitlist band uses "Founding families" framing per
   BUILD.md's hard constraint (no pricing, T2). CTA stays functional ("Join
   the waitlist") rather than the kit's more evocative "Meet your child's
   map" — no product exists yet for that CTA to honestly lead to.
2. **Design**: homa-design v2 tokens (colors, radius, shadows, fonts) copied
   into `apps/web/app/globals.css` and wired through Tailwind v4's
   `@theme inline`, so classes like `bg-brand`, `text-strong`, `rounded-pill`
   work directly. Fonts (Newsreader, Hanken Grotesk, Caveat, JetBrains Mono)
   load via `next/font/google` instead of the design system's raw `@import`,
   for self-hosting and zero layout shift. `Logo` component ported from
   `docs/homa-design/components/brand/Logo.jsx`. This is a hand-copied
   subset, not the formal `packages/design` workspace package; M1-17 still
   owns porting the full component library.
3. **Verification**: typecheck + production build green; rendered and
   screenshotted at desktop and mobile (390px) widths via Playwright for
   both `/` and `/waitlist` — readable, on-brand, touch-friendly. Founder
   phone test + Alessa read-aloud (build-log #10's two remaining DoD boxes)
   are next.
4. Deleted `wireframe-slot.tsx` (no slots remain, per its own comment).

## 2026-07-04 · M0-01 GO/NO-GO criteria written (not yet run)

Per the council re-scope's requirement ("GO/NO-GO criteria written BEFORE
starting"), wrote `docs/homa-planning/m0-01-adversarial-prototype-gate.md`
covering the five adversarial tests from `03-backlog.md` (eve upgrade drill,
deploy+rollback mid-run, dispatcher kill mid-fan-out, HITL-parked rotation,
100-family fan-out), each with a concrete pass/fail bar, plus: a strict
2-session/≤2-day timebox distinct from BUILD.md's no-calendar-estimates
roadmap stance, a contained-blast-radius environment plan (Vercel preview
branch, real homa-prod schema with tagged+cleaned-up synthetic rows, never
production), and a verdict rule (any leakage/data-loss/stuck-state = NO-GO
regardless of the other four; eject to M0-02 on failure). BUILD.md now links
it. **The spike itself has not been run yet** — this session only produced
the criteria, per the gate's own requirement that they exist first.

## 2026-07-04 · M0-01 test (a) run: NO-GO

Ran the eve upgrade drill (test a of `m0-01-adversarial-prototype-gate.md`)
locally, isolated on a throwaway `spike/m0-01` branch (deleted after, no code
diff to keep — this was a pure test, nothing to merge). Parked a session in
HITL under eve 0.18.2, bumped to 0.19.0 (today's `latest`; no newer version
exists to test a true forward upgrade), and tried to resume it.

**Result: reproducible failure.** The parked session's event log corrupts on
replay (`CorruptedEventLogError`, 3 failed recovery attempts, confirmed on
retry), and the resume API silently opens a fresh, memoryless session instead
of erroring, `{"ok": true}` with no indication anything went wrong. The
original question and its answer are permanently lost. Likely cause: a
patch-level (not flagged breaking) change to how 0.19.0 records tool-call
results in the durable workflow log. Full evidence in `eve-churn-log.md`;
gate writeup in `m0-01-adversarial-prototype-gate.md`.

**Per the gate's own verdict rule, this single failure is enough: NO-GO.**
Tests (b)–(e) were not run — the verdict doesn't change once (a) fails this
decisively, and they remain available for a custom-harness retest later.
**This is now an open decision for Sidney**, not resolved here: eject to
M0-02 (custom harness) per the rule as written, treat it as a narrower
operational risk (drain HITL-parked sessions before every upgrade) and
re-test, or report upstream and wait for a fix. Phase B work should not
proceed on eve, as-is, until this is decided.

## 2026-07-04 · Mitigations for the M0-01 finding (fix without diverging)

Asked "what would fix this without diverging too much" after the NO-GO.
Built three things, all in our own code/process, none touching eve
internals:

1. `apps/web/lib/harness/resume-session.ts` — narrow seed of M1-14. Every
   resume of an eve session must go through this. It doesn't trust eve's
   synchronous `ok: true` alone (the finding showed that's not confirmation);
   it watches the event stream for a real new turn or an explicit failure
   before calling a resume successful, and throws a typed error otherwise.
   Verified against the live bug: 2/2 correctly caught the real corruption,
   1/1 correctly passed a healthy same-version control (no false positive).
2. `scripts/eve-upgrade-check.mjs` — automates the exact repro against any
   candidate version pair. Verified: correctly passes a same-version no-op,
   correctly fails the known-bad 0.18.2→0.19.0 pair (twice).
3. `docs/homa-planning/runbooks/eve-version-bump.md` — the procedure: read
   the changelog for tool/replay/workflow language, run the script, check
   for live parked sessions (stubbed until M1-02), deploy, smoke-test, log
   the outcome in `eve-churn-log.md` either way.

This does not resolve the open decision (eject to M0-02 vs. stay on eve with
these mitigations vs. report upstream and wait) — that's still Sidney's call.
It does mean Phase B is no longer flatly blocked: BUILD.md now says
"mitigated, not resolved" instead of "blocked."

## 2026-07-05 (later) · Test (b) retested for real: "let's test on real Vercel builds"

Resolved the local-vs-production caveat on the deploy/rollback finding.
Deployed two separate real Vercel previews (fixing a genuine gap along the
way: no `.vercelignore` existed, so a local `vercel deploy` tried to upload
the multi-gigabyte `homa-research/`/`homa-macmini/` folders and failed —
added `.vercelignore` mirroring `.gitignore`'s exclusions). Started a
session on the first deployment, let it complete, deployed the second, sent
a follow-up to the second deployment's URL using the first's session and
token.

**Result: clean pass.** The second deployment correctly resumed the exact
session with real context intact (recalled a secret code from the first
turn). This is strong evidence the earlier "stuck forever" finding was a
limitation specific to `eve dev`'s local disk-backed workflow world, not a
production-relevant risk — Vercel Workflow (the managed service actual
production uses) handles cross-deployment continuity correctly.

Still open, narrower: this tests session portability across deployments,
not literal mid-step crash recovery, which is much harder to replicate
against real Vercel infra (deploys take far longer than a model turn, and a
preview-to-preview deploy doesn't tear down the first one). De-risked, not
fully closed. Full detail: `eve-churn-log.md`,
`m0-01-adversarial-prototype-gate.md`.

Also: enabled Vercel's Protection Bypass for Automation on the project
(`vercel project protection enable --protection-bypass`) to make this kind
of preview-deployment testing possible; documented the mechanism for reuse.
Cleaned up both throwaway preview deployments and the test branch after.

## 2026-07-05 · Founder decision: stay on eve; spike continued

Sidney: "stay and continue." Resolved the open M0-01 decision — not
ejecting to M0-02, staying on eve with the mitigations from 2026-07-04.
Continued the spike since committing to eve means the other adversarial
tests should actually be checked against it:

- **Adapted test (e)** (concurrent sessions, no schedule dispatcher exists
  yet to test the original version): 12 concurrent synthetic-tenant
  sessions, zero cross-session leakage, confirmed twice. Clean pass on the
  single most safety-critical property.
- **Test (b)** (deploy + rollback mid-turn): failed, reproducibly, across
  three variants (hard kill, graceful stop, explicit nudge) — a step killed
  between start and completion never resumes, with zero server-side error
  logged. **Important caveat**: this is against the local dev workflow
  world, not real Vercel Workflow, which the docs describe as a different,
  managed durability substrate. Needs a Vercel-preview retest before being
  trusted as production-relevant. Logged in full in `eve-churn-log.md` and
  `m0-01-adversarial-prototype-gate.md`.
- Tests (c) and (d) stay deferred — they need a schedule dispatcher and a
  session-rotation state machine that don't exist yet (M3-10/M1-02, M1-15).
  Not skipped, just correctly sequenced.
- Relocated `resume-session.ts` from `apps/web/agent/harness/` to
  `apps/web/lib/harness/` — the old path is an eve-discovered directory
  convention and eve's discovery warned on it; the module is app code
  calling eve's API, not an eve capability.

Phase B is clear to start with the mitigations in place and the deploy/
rollback finding tracked as an open risk, not a blocker.

## 2026-07-05 · Playable MVP: auth → family → child → chat → worksheet

Founder asked "can we get an mvp shipped so i can start playing with it" —
built the trimmed walking-skeleton slice end to end, real code not hacks:

1. **Auth (minimal M1-01):** Supabase Auth email/password via @supabase/ssr.
   `lib/supabase/{server,client}.ts` helpers, `proxy.ts` (Next 16's renamed
   middleware) refreshes sessions per request and gates /home + /chat with
   `getClaims()` (JWT-verified, not spoofable). /signin page with a
   founding-family gate: signup requires the invite code in
   `HOMA_SIGNUP_CODE` (set in Vercel prod env; unset locally = open signup
   for dev). MJ-09's real invite codes replace this.
2. **Family creation (migration #6):** `create_my_family()` RPC — an
   authenticated user with no membership creates exactly one family
   atomically; the one-family rule lives in the function body. RLS advisor
   warning is intentional (documented in the migration).
3. **Child intake (minimal M2-03i):** /home shows create-family → add-child
   → children list; children write to `children.profile` jsonb (interests,
   focus) under the existing "members add children" RLS policy.
4. **eve auth (FR-1 slice):** `agent/channels/eve.ts` custom AuthFn — chat
   sends the caller's Supabase access token as a bearer (resolved fresh per
   request by useEveAgent), the channel verifies it via `auth.getUser()`,
   resolves familyId under the caller's OWN RLS, and stamps
   `{ principalId: userId, attributes: { familyId, supabaseAccessToken } }`.
   The raw token in attributes is server-custody state, never model-visible,
   refreshed per turn; M1-02's SET LOCAL pattern replaces it.
5. **Agent tools (first two):** `get_children` (reads the family's kids +
   profiles as the caller — RLS is the wall inside tools too, no service
   key exists in the app) and `create_worksheet` (schema-validates the
   worksheet the model composes; the UI renders it as a printable card).
   `lib/agent-db.ts` is the shared caller-scoped DB helper. Instructions
   updated: call get_children at conversation start, worksheet composition
   rules, voice laws.
6. **Chat UI (trimmed M1-04):** /chat with useEveAgent, on-brand bubbles,
   suggestion chips, worksheet card with a print button (browser print
   dialog → paper/PDF; v0 of MJ-01). shadcn integration stays with M1-04
   proper.

**Verified end to end with Playwright against the real stack** (Next dev +
eve dev + homa-prod Supabase + real model calls): unauthenticated /chat
bounces to /signin; sign in lands on /home; create family; add child (Maya,
5, dinosaurs+drawing, letter sounds); chat "make Maya a worksheet" →
get_children + create_worksheet tool calls → on-brand printable "Maya's
Dino Letter Sounds" card with 5 themed exercises. Test rows deleted from
homa-prod after. Typecheck, production build, and isolation checks green.

Known deferrals: voice, photo personalization, conversation persistence
(chat history resets on reload — eve session is durable server-side but the
UI doesn't rehydrate it yet), real invite codes (MJ-09), the reportlab/fal
worksheet pipeline (M0-03/M2-05 — current output is text-exercise layouts),
proper session-tracking table.

## 2026-07-05 · Fixes: signup dead-ended, chat history lost on reload

Two real defects in the MVP slice, both found and fixed:

1. **Signup dead-ended.** The project has email confirmation ON, so the
   first real signup returned no session and parked on a confirmation email
   (default Supabase mailer, not our Resend, rate-limited/spammy). Also the
   app-layer HOMA_SIGNUP_CODE check was bypassable by calling the Supabase
   auth API directly with the publishable key. **Fix (migration #7):** a
   `before insert` trigger on auth.users enforces the invite code (from
   `private.settings`, not exposed over the Data API) at the database
   boundary and auto-confirms the account when the code matches, so
   password sign-in works immediately with no email round-trip. The signup
   action now passes the code in user metadata and signs in right after;
   the trigger's 500 rejection is translated to a friendly "invite code
   isn't right" message. Invite code required in the UI now.
2. **Chat history vanished on reload.** The chat didn't persist the eve
   session cursor, so every reload silently started a fresh, memoryless
   conversation. **Fix:** wired eve's documented resumable-sessions pattern
   into chat-client.tsx — initialEvents/initialSession from localStorage
   (keyed per user id), snapshot saved onFinish. Added a "New chat" button
   to deliberately start fresh. /chat is now a server component that resolves
   the user id for the storage key.

Verified end to end with Playwright against the real stack: UI signup with
the code confirms and lands on /home (no email), wrong code shows the
friendly error, family+child setup works, chat knows the child; a hard
reload restores the transcript AND a follow-up resumes the SAME durable
session (POSTs to /eve/v1/session/{id}, and Homa correctly recalled a
secret word set before the reload — real continuity, not just restored
pixels). All test users deleted from homa-prod after (0 users remain).
Typecheck, build, lints green.

Note the deferred item is now smaller: chat history persists client-side
(localStorage); the Postgres conversations table (cross-device history,
M1-02) is still the future proper version.

## 2026-07-05 · Open signup (founder decision: "as easy as possible, no hoops")

Founder chose fully open signup over the invite-only gate. This reverses the
PRD's "public signup (invite codes only)" non-goal and the founding-families
framing — a deliberate founder call, logged here as the auditable override.

- **Migration #8:** dropped the invite-enforcing trigger + `private.settings`
  code store from migration #7; replaced with a plain `autoconfirm_new_user`
  trigger that confirms every new account at creation. So signup is email +
  password with an immediate session and no email round-trip, regardless of
  the project's email-confirmation setting.
- **Signup action:** removed the invite-code handling; plain signUp +
  signInWithPassword.
- **Signup form:** removed the invite-code field.
- **Vercel:** removed the now-unused `HOMA_SIGNUP_CODE` production env var.

On email confirmation itself: the project-level setting can't be toggled with
the tools available here (no admin/management token; the MCP is DB-scoped).
The auto-confirm trigger makes it moot for signup either way. If the founder
turns off "Confirm email" in the dashboard (Authentication → Sign In /
Providers → Email), the trigger becomes redundant and can be dropped.

Verified: raw-API signup with no code returns a confirmed session; full UI
flow (signup with just email+password → family → child → chat) passes E2E.
Test users deleted from homa-prod (0 remain). Typecheck, build, lints green.

## File additions this session

- `supabase/migrations/20260704033725_waitlist_and_events.sql`: waitlist +
  events tables, write-only RLS for public traffic.
- `supabase/migrations/20260704033742_tenancy_v0.sql`: families,
  family_members, children + deny-by-default RLS + `is_family_member()`.
- `supabase/migrations/20260704033812_function_grant_hygiene.sql`: EXECUTE
  grant hygiene per security advisors.
- `packages/core/src/waitlist.ts`: waitlist submission schema + age bands +
  sources (shared by form, API, future invite service).
- `packages/core/src/events.ts`: typed event registry (MJ-08) + `emitEvent()`.
- `packages/core/src/us-states.ts`: US state list for the form.
- `apps/web/app/page.tsx`: landing page (hero variant B, efficacy lead; final
  copy + homa-design v2 styling as of the copy/design pass above).
- `apps/web/components/brand/Logo.tsx`: brand lockup, ported from
  `docs/homa-design/components/brand/Logo.jsx`.
- `apps/web/app/conference/page.tsx`: QR conference variant (`/conference`).
- `apps/web/app/api/waitlist/route.ts`: validated capture endpoint; duplicate
  email = success (idempotent retries).
- `apps/web/components/waitlist-form.tsx`: optimistic form, offline queue.
- `apps/web/components/wireframe-slot.tsx`: labeled placeholder primitives
  for undecided copy/media (deleted when the copy kit lands).
- `apps/web/lib/waitlist-client.ts`: timeout + retry + localStorage queue +
  online-event flush (bad conference wifi survival).
- `scripts/isolation-check.mjs`: anon-key isolation smoke checks (M1-07 seed);
  run with `pnpm check:isolation`.
- `.github/workflows/ci.yml`: typecheck + build + isolation check on every
  push/PR to `main` (see entry #14 above).
- `docs/homa-planning/eve-churn-log.md`: dated log of eve version bumps and
  breaking changes, feeding the eject tripwire.
- `docs/homa-planning/m0-01-adversarial-prototype-gate.md`: GO/NO-GO criteria
  for the M0-01 spike, written before the spike runs.
- `apps/web/lib/harness/resume-session.ts`: resume-identity + forward-
  progress guard (M1-14 seed), mitigating the M0-01 finding. Lives in
  `lib/`, not `agent/` — it calls eve's API, it isn't an eve capability.
- `scripts/eve-upgrade-check.mjs`: automated pre-bump regression check for
  any eve version change.
- `docs/homa-planning/runbooks/eve-version-bump.md`: the procedure for
  bumping the pinned eve version safely.
