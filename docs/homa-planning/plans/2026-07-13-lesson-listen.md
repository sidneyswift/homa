# Lesson listen · record a whole lesson, Homa turns it into progress and coaching

> Status: BUILT DARK (founder "BUILD", 2026-07-13 late night). LL-0
> through LL-6 are implemented behind HOMA_LESSON_LISTEN_ENABLED, both
> additive migrations are applied to homa-prod, all guards pass, and
> both copy gates ran. Two recorded deviations (chat delivery
> deferred, flag-off fan-out skipped) and the enablement checklist
> live in build-log.md § Lesson listen ships dark. Original decided
> plan below, amended in place where decisions changed. Scoping decisions were made by the
> founder directly (§1), and the remaining calls were delegated the
> same evening with one instruction: optimize for product-market fit
> above all. The picks and reasoning are recorded in §7; no open
> questions remain. Amended late the same night with founder
> direction on tone (the analysis hears audio, §1 item 7) and lesson
> media (§1 item 8), plus every constraint from the blindspot pass
> (2026-07-13-lesson-listen-unknowns.html). The child-voice consent
> ruling in §4.1 must land before any code ships (LL-0). Sequencing
> note: the season simulation field study said to hold lesson
> listening until its outputs have a durable home; this plan builds
> that home (the lesson review) as part of the feature and rides the
> observation ledger that now exists.

## 1. Founder direction, distilled (2026-07-13)

1. A parent records an entire lesson with their kid. Homa saves it,
   transcribes it, analyzes it, updates the child's progress, and
   comes back with what went well, where the kid lit up or drifted,
   and two or three ideas for next time.
2. This is NOT the chat mic button. Dictation is capped at 3 minutes
   and 4MB, never stores audio, and shares its transcription module
   with SMS voice notes. Lesson listen is its own lane end to end.
3. Decided 2026-07-13: build the in-app segmented recorder and the
   upload-a-file fallback together in v1.
4. Decided 2026-07-13: progress writes follow journal parity. High
   confidence clauses become evidence through the existing server-side
   matcher, everything else lands in child_observations. No new
   scoring authority.
5. Decided 2026-07-13: raw audio auto-deletes 30 days after
   transcription. Transcript and review are kept. Mirrors the D4
   raw-photo TTL commitment.
6. Decided 2026-07-13 evening: the founder delegated the remaining
   §7 calls ("you pick, we are pre product-market fit, choose what
   gets us PMF above all"). The delegated picks are §7.
7. Decided 2026-07-13 late evening: transcription alone is not
   enough. A reliable lesson listen must read between the lines, so
   the analysis HEARS the audio (tone, energy, pauses), it does not
   only read a transcript. The tone lane in §4.4 and §4.5 is v1
   scope, not an upgrade.
8. Decided 2026-07-13 late evening: the parent can snap photos
   during the lesson without stopping the recording (a worksheet as
   it happens), and can attach any media at the end, even after the
   recorder is off. Design in §4.9.
9. Folded the same evening under the standing delegation, from the
   unknowns pass (2026-07-13-lesson-listen-unknowns.html): recording
   starts from the kid page, segments run 3 minutes, the STT model
   stays whisper-large-v3-turbo (the tone lane supersedes the
   nova-3 diarization question), and every landmine constraint from
   that artifact is folded into §4 below.

## 2. Why the mic button is the wrong base (verified in code)

- app/app/dictation.tsx: MAX_RECORDING_SECONDS = 180, records into
  browser memory, everything is lost on tab death.
- app/api/chat/dictation/route.ts: MAX_AUDIO_BYTES = 4 MiB, audio is
  never stored, route is user-scoped, not family-scoped.
- lib/voice/transcribe.ts is shared with inbound SMS media. Changing
  its behavior for lessons risks the SMS lane. Lesson listen CALLS
  transcribeAudio (it is fail-soft and format-tolerant by design) but
  never modifies it.

## 3. What already exists (reuse, do not rebuild)

- **Large upload gateway.** app/api/video/upload/route.ts mints a
  scoped Vercel Blob client-upload token for
  families/{familyId}/videos/ (200MB cap, random-suffix URLs,
  resolveApiFamily for tenancy). Lesson listen copies this route
  shape for a lessons/ prefix. Bytes never pass through our API,
  which sidesteps the 4.5MB function body cap.
- **Transcription.** lib/voice/transcribe.ts, Telnyx STT
  (openai/whisper-large-v3-turbo), accepts webm and mp4 by extension
  mapping, returns null on failure, never throws.
- **Background extraction pattern.** lib/voice/transcript-sync.ts plus
  lib/learning/call-memory.ts: store the artifact, claim it with a
  timestamp column, run the model, write results, un-claim on failure,
  and let the hourly /api/map/cron sweep retry stalled work. Lesson
  listen uses the same claim-and-sweep posture with an immediate kick
  on finish so the parent is not waiting for the top of the hour.
- **The trust boundary for scoring.** journal-matcher.ts (0.85
  threshold), recordJournalProgressEvidence in progress-service.ts,
  and the child_observations ledger (migration 20260713134500).
  Lesson clauses go through this exact path.
- **Consent template.** The D4 kid-photo pattern:
  settings/kid-photo-field.tsx, setChildPhotoConsent in
  lib/family-profile.ts, family-level consent stamp columns, a
  dedicated consent screen before first use, commitments spelled out
  in copy.
- **Reinforcement rail.** brief-context.ts already weaves status-new
  observations into the morning brief, and mark_observation_used
  closes the loop. Lesson observations inherit this for free.
- **UI freshness pattern.** The narrative-status poll
  (app/api/map/narrative-status/route.ts) is the model for the
  "Homa is listening" card that flips to "review ready".

## 4. Design

### 4.1 Consent gate and the child-voice ruling (blocks everything)

The personas journey says no child voice ingestion in v1, and a
lesson recording contains the child by definition. Shipping this
feature is a founder ruling that supersedes that line. The ruling and
its consent mechanics land first:

- New columns on public.families: lesson_audio_consent_at
  timestamptz, lesson_audio_consent_by uuid. Same once-per-family,
  first-agree-wins posture as child photos.
- A dedicated consent screen before the first recording (not bundled
  into signup), with the commitments in plain words: recordings are
  used only to write this child's lesson review and progress, the
  audio is processed by AI services under no-training terms, raw
  audio deletes itself after 30 days, transcripts stay on the child's
  record, no voice identification, delete anytime.
- Server gate: upload token route refuses when the stamp is missing.
- Existing law IC-11 stands: the parent is Homa's user. Nothing in
  the review addresses the child directly.
- Ticket LL-0 appends the ruling to build-log.md and the
  founder-ruling index (journeys/10-reconciliation.md §5).

Consent copy goes through homa-copy-reviewer then homa-copy-editor.

### 4.2 Capture: segmented recorder plus upload fallback

The recorder's job is to make a 45-minute recording survivable on a
phone browser. Three failure modes, three answers:

- **Tab death loses memory.** Record in segments: MediaRecorder stops
  and restarts every 3 minutes, so every segment is a standalone
  playable file (webm on Chrome and Android, mp4 on iOS Safari; copy
  dictation.tsx's MIME fallback chain exactly, both containers are
  already in transcribe.ts's extension map). Each finished segment
  uploads immediately. A crash loses at most the current segment.
  Three minutes, not five: whisper-large-v3-turbo returns text with
  no timestamps, so a moment can only be located to its segment.
  Segment length IS moment resolution, and it also bounds the
  crash-loss window and keeps iOS AAC segments small on rural
  uploads (Safari ignores bitrate hints; the dictation header
  documents the same physics).
- **Screen lock suspends the mic.** Request a screen wake lock while
  recording, re-acquire on visibilitychange, and say it honestly in
  the UI: "keep this screen open while you teach". If the recorder
  still suspends (app switch), the segment boundary makes the gap
  survivable and the timeline just shows a gap.
- **The end-of-lesson upload fails.** There is no end-of-lesson
  upload. By the time the parent taps done, everything but the final
  segment is already stored and mostly transcribed.

Resume: a lesson row stuck in status recording plus any local pending
segment means the record page offers "You have a lesson from 2:14pm
still open. Finish it or discard?" Finish analyzes whatever segments
made it.

Fallback: an "already recorded it?" path on the same page accepts an
audio file (Voice Memos m4a and friends) and enters the pipeline as
one long segment. This is the reliability floor: the phone's native
recorder cannot be broken by our tab. Mechanics, verified against
the Telnyx STT docs 2026-07-13: the endpoint accepts a public
file_url up to 100MB (15s download timeout), and our Blob URLs are
already public with random suffixes, so the file never passes
through a Vercel function. A new ADDITIVE transcribeAudioUrl export
lands beside transcribeAudio for this lane; segments keep the bytes
path and existing callers never change. Cap fallback uploads at
100MB with honest copy. Tone: a single 45-minute file cannot ride
the per-segment tone pass; if the audio model refuses the file, the
text-only analysis still runs and the review says so plainly
("uploaded recordings get a lighter read; recording inside Homa
hears tone").

One child per recording in v1: the parent picks the kid before
recording starts, because evidence and observations need an
unambiguous child_id (see Q2). Multi-kid families get the kid page's
own sibling switcher on the record screen (founder direction
2026-07-14), so changing who the lesson is for is one tap; once
recording starts the kid is locked.

### 4.3 Storage and schema (additive migration)

Blob layout: families/{familyId}/lessons/{lessonId}/segment-0001.webm
under the existing homa-artifacts store, token route copied from
video/upload with audio/* content types.

```sql
create table public.lesson_recordings (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  created_by uuid references auth.users (id) on delete set null,
  status text not null default 'recording' check (status in
    ('recording', 'uploaded', 'analyzing', 'ready', 'failed')),
  source text not null default 'recorder'
    check (source in ('recorder', 'upload')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer,
  analysis_claimed_at timestamptz,
  attempts integer not null default 0,
  audio_deleted_at timestamptz,
  error text,
  constraint lesson_recordings_child_fkey
    foreign key (child_id, family_id)
    references public.children (id, family_id)
    on update cascade on delete cascade
);

create table public.lesson_segments (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null
    references public.lesson_recordings (id) on delete cascade,
  family_id uuid not null,
  seq integer not null,
  blob_url text not null,
  content_type text not null,
  duration_seconds integer,
  transcript text,
  transcribe_claimed_at timestamptz,
  transcribed_at timestamptz,
  tone_notes jsonb,
  tone_noted_at timestamptz,
  unique (lesson_id, seq)
);

create table public.lesson_media (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null
    references public.lesson_recordings (id) on delete cascade,
  family_id uuid not null,
  blob_url text not null,
  content_type text not null,
  caption text,
  captured_during_seq integer,
  attached_after_ready boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.lesson_reviews (
  lesson_id uuid primary key
    references public.lesson_recordings (id) on delete cascade,
  family_id uuid not null,
  child_id uuid not null,
  summary text not null,
  insights jsonb not null,
  evidence_count integer not null default 0,
  observation_count integer not null default 0,
  created_at timestamptz not null default now()
);
```

RLS posture copied from the ChildProgress tables: enable RLS, members
get SELECT via the family membership check, all writes stay on the
guarded server path (mapDb). Run pnpm check:isolation before this
lands. Two constraint extensions ride along in the same migration:
'lesson_listen' joins the evidence source normalizer and the
TypeScript unions (types.ts, view-schema.ts, tool-result-contract.ts,
same commit), and 'lesson' joins the child_observations channel
check. Lesson rows carry message_id null: the existing foreign key
into conversation_messages assumes a conversation, and a lesson is
not one.

### 4.4 Pipeline: two ears per segment, one synthesis at finish

No new async primitive anywhere in this pipeline: the repo has no
"kick background work from a route" pattern (waitUntil lives only in
eve schedule handlers, call-memory rides the cron), and lesson listen
does not need one. Routes do their work inline before responding; the
client simply does not await the slow parts; the cron sweep is the
only retry mechanism.

1. **Start**: POST /api/lessons creates the lesson row (consent
   checked, child re-scoped to the family) and returns the id.
2. **Per segment, two passes inline**: client uploads the blob, then
   POSTs /api/lessons/{id}/segments to register it. The route claims
   the segment and runs both ears before responding (the recorder
   fires and forgets this request):
   - **The words**: transcribeAudio (Telnyx Whisper), verbatim
     transcript onto the segment row. A 3-minute opus segment is
     under 1MB and transcribes in seconds.
   - **The tone**: the same segment audio goes to an audio-input
     model through the AI Gateway (Gemini class; audio runs about 32
     tokens per second, so 3 minutes is roughly 6k input tokens,
     cents per lesson). It returns structured tone_notes: energy
     level, engagement shifts, roughly who is speaking and how much,
     laughter, long silences, frustration or excitement beats, each
     positioned "early / middle / late in this segment". Fail-soft
     like every media pass in this repo: null tone_notes never blocks
     the lesson.
   By the time the parent taps done, both lanes are nearly complete.
3. **Finish**: POST /api/lessons/{id}/finish flips status to uploaded
   and runs the analysis inline (maxDuration = 300). It sweeps
   straggler segments, assembles the full transcript with segment
   timestamps (segment N starts near minute 3N), and runs one
   generateObject synthesis pass on HOMA_MODEL over three inputs:
   the transcript, every segment's tone_notes, and lesson media
   captions (§4.9). gatewayAttribution plus recordModelUsage, like
   call-memory.
4. **Sweep**: the hourly /api/map/cron gains one job: re-kick lessons
   stuck in analyzing past 15 minutes (bounded attempts column, then
   failed), transcribe or tone-note orphaned segments, and delete
   audio blobs past the 30-day TTL (stamp audio_deleted_at, keep rows
   and transcripts).

**LL-5 opens with a half-day spike, before any contract is locked:**
send one real 3-minute webm segment and one iOS mp4 segment through
the gateway to the candidate audio model and confirm (a) file parts
reach it through the gateway, (b) both containers are accepted or a
supported transcode target exists, (c) tone notes come back usable.
If the spike fails on formats, the tone lane degrades to the fallback
posture (text-only analysis, honest copy) rather than blocking v1,
and the segment audio is kept 30 days so tone can be backfilled the
day the lane lights up.

### 4.5 What analysis writes (the trust boundary holds)

The synthesis model reads the transcript, the tone notes, and the
media captions, and produces a structured document. It has NO
authority to score. Its output splits into two lanes:

- **Ability clauses, as PAIRS.** The unknowns pass (landmine 1)
  proved that verbatim transcript quotes score nothing: the journal
  matcher only reads clauses whose grammatical subject is the child's
  name (childAttributedPredicates anchors on the name, drops other
  actors, and evidence-policy routes "we ..." phrasing to
  activity_only), and a lesson transcript is dialogue, not parent
  reports. So the model emits pairs: a normalized child-attributed
  clause in parent-report style ("Emma read the whole page aloud
  without help") as MATCHER INPUT, plus the verbatim transcript
  excerpt and segment number as PROVENANCE. The server verifies the
  excerpt is a literal substring of the transcript AND that the
  normalized clause shares meaningful tokens with its excerpt (reuse
  normalizeMeaningfulTokens with a tested overlap floor), so nothing
  invented can launder through normalization. Each pair then rides
  the SAME path journal messages take: recordJournalProgressEvidence
  called from lib/child-progress/runtime.ts (never the service or
  repository directly, or the MJ-08 events silently stop firing),
  source lesson_listen, idempotency key
  lesson:{lessonId}:{sha256(normalizedClause)} so retried analysis
  passes are stable regardless of clause order, capped at 12 accepted
  clauses per lesson. The 0.85 matcher decides evidence; no_match,
  activity_only, and ambiguous land in child_observations exactly as
  they do tonight for chat. Replays cannot double-write. Tone alone
  NEVER becomes an ability clause: excitement is review material,
  not evidence.
- **The review**: everything scoring cannot hold. Stored on
  lesson_reviews.insights:
  - summary: what the lesson covered, two or three sentences.
  - moments: beats where the kid was excited, distracted, frustrated,
    or had a breakthrough, each grounded in a tone_notes entry or a
    quote, stamped to its segment and phrased softly ("about 20
    minutes in"), never faked to the second.
  - what_worked and friction: "switching to the beads brought her
    back", "energy dropped hard in the last ten minutes".
  - next_time: two or three suggestions framed as offers, never
    commands ("she asked about volcanoes twice; a volcano book could
    carry the next reading session").
  - open_questions: things Homa could not tell, phrased for a
    follow-up chat.

All review copy obeys the house laws: reassure before inform, no
red or "behind" framing, never compare siblings. The extraction
prompt states them and the copy gates check the rendered surface.

### 4.6 Surfacing and delivery

- A review page at /app/lessons/{id}: summary up top, moments
  timeline (tone-grounded, worksheet photos inline where they pair
  with a moment), suggestions, what it wrote to progress (with
  links), the media gallery, and the transcript behind a disclosure.
  Entry and link live on the kid's page (§7 Q5).
- While processing, the page (and a small card wherever the parent
  lands after finishing) polls a status endpoint,
  narrative-status-style: "Homa is listening back through the
  lesson", then "Ready".
- Chat delivery on ready is DEFERRED (build decision 2026-07-13 late
  night, build-log § Lesson listen ships dark): a wrong
  persistCanonicalMessage write pollutes every adult's transcript
  under chat-privacy-per-adult, so wiring a sessionless artifact into
  the continuity ledger gets its own reviewed slice. v1 delivery is
  the review page, its status poll, and the kid-page lesson list; a
  canonical chat message plus a lesson retrieval tool are the
  fast-follow.
- Observations flow into the morning brief automatically through the
  existing brief-context query and mark_observation_used loop.
  Nothing new to build there.

### 4.7 Events (MJ-08 registry, ids and counts only, never quotes)

- lesson.recorded: family_id, child_id, source, segment_count,
  duration_seconds
- lesson.review_ready: family_id, child_id, evidence_count,
  observation_count, moment_count, tone_coverage (segments with
  tone_notes over total, so the PMF read knows when tone was deaf)
- lesson.media_attached: family_id, child_id, when (during, finish,
  after_ready)
- lesson.failed: family_id, child_id, stage
- progress.evidence_recorded and progress.observation_saved fire from
  the shared committed path with no changes.

Registry entries in packages/core/src/events.ts, pnpm check:events
before push.

### 4.8 Failure copy and limits

- Any terminal failure keeps the audio and transcript-so-far and says
  so: "I couldn't finish listening to this one. The recording is
  safe, and you can try again." Never a dead spinner, never a loss.
- Rate cap 6 lessons per family per day (same shape as the video
  describe limiter; §7 Q4), revisit after dogfooding.
- transcribeAudio stays untouched; lesson listen is a caller only.
  The fallback lane's transcribeAudioUrl is a new additive export in
  the same module, zero change to existing callers.

### 4.9 Lesson media: photos during and after the lesson

Founder direction (§1 item 8): a worksheet moment should not force a
choice between the photo and the recording.

- **During the lesson**: the recorder screen carries a camera button.
  It opens the native camera through a file input (capture attribute),
  the photo downscales client-side through the existing
  prepareChildPhotoForUpload pattern (JPEG, EXIF stripped), uploads to
  families/{familyId}/lessons/{lessonId}/media-{n}.jpg under the same
  token route, and registers on lesson_media stamped with the segment
  playing when she tapped (captured_during_seq). Known iOS reality:
  opening the camera backgrounds the page and MAY suspend the current
  audio segment. The recorder already survives suspension (segment
  closes cleanly, next one starts on return), so the honest behavior
  is a bounded gap, not a broken lesson. This exact interaction is on
  the LL-3 device-test list; if the gap proves ugly on a real iPhone,
  the button's copy says so ("snapping a photo pauses listening for a
  moment").
- **After the lesson**: the finish screen asks once, softly:
  "Anything to add? Worksheet photos, her drawing." And the review
  page keeps an "Add photos" affordance forever; rows added after the
  review exists carry attached_after_ready = true.
- **Captions**: each image gets a short caption at register time
  through the existing captionSmsImage pattern (gateway gpt-5.4-mini,
  20s timeout, fail-soft null). Captions and captured_during_seq feed
  the finish synthesis ("worksheet photo during segment 5: ten
  two-digit subtraction problems, workings visible"), so the review
  can pair a moment with its artifact.
- **Media attached after ready** shows in the review's gallery but
  does not re-run analysis in v1. Evidence NEVER originates from an
  image in v1: the substring guard has no teeth against pixels, so
  images inform the review narrative only, and the ledger stays
  transcript-grounded.
- Cap 12 media items per lesson, images only in v1.

## 5. Tickets

**LL-0 · ruling and consent (blocks the rest).**
Founder ruling recorded in build-log.md and the founder-ruling index.
families columns, consent screen (kid-photo-field.tsx pattern),
server gate, family.lesson_audio_consented event. Copy through both
gates. Guards: pnpm check:isolation, pnpm check:events.

**LL-1 · schema.**
Migration per §4.3 plus the source and channel constraint
extensions, types.ts unions, repository plumbing. Guards: pnpm
check:isolation before it lands, pnpm check:child-progress.

**LL-2 · ingest routes.**
Token route (video/upload copy for lessons/ prefix, audio/* and
image/*), POST /api/lessons, segments register, media register
(caption at register, captionSmsImage pattern), finish, status. Rate
cap and the 12-item media cap. Fallback upload page riding the new
additive transcribeAudioUrl (file_url lane, 100MB cap). Tests for
tenancy refusals (wrong family child, missing consent).

**LL-3 · recorder UI.**
Segmented MediaRecorder with 3-minute rotation and dictation.tsx's
MIME fallback chain, wake lock with re-acquire, upload-as-you-go,
camera button (§4.9), finish screen's "anything to add?" step, resume
flow, honest states. Device-test list on a real iPhone before done:
screen lock, phone call interruption, Low Power Mode, airplane-mode
segment retry, and photo-while-recording (does the camera suspend the
segment, and is the gap bounded). Copy through both gates.

**LL-4 · segment workers plus sweep.**
Per-segment claim, transcribe, and tone pass inline on register;
straggler pass on finish; cron sweep for stalls, orphaned segments,
and the 30-day audio TTL delete (artifact-store del pattern). Tests:
claim races, replay, TTL stamps, tone fail-soft leaves transcript
lane intact.

**LL-5 · synthesis pass.**
Opens with the gateway audio spike (§4.4). Then: generateObject
synthesis over transcript plus tone_notes plus media captions, the
pairs contract with substring AND token-overlap verification, clause
fan-out through recordJournalProgressEvidence called via
lib/child-progress/runtime.ts (source lesson_listen, sha256 clause
keys, 12-clause cap), lesson_reviews write, events, model usage
ledger. Tests: fabricated excerpt rejected, normalized clause with no
token overlap rejected, replay writes once, matcher outcomes route to
the right ledgers, dialogue-style transcript still yields evidence
through normalized clauses.

**LL-6 · review surface and delivery.**
/app/lessons/{id}, status poll, kid-page entry button and link,
media gallery, canonical chat message on ready. Copy through both
gates. Guards: pnpm check:progress-ui if progress cards are touched,
and pnpm --filter web exec eve build locally if any agent surface
changes.

## 6. Non-goals (explicit)

- No live in-lesson coaching. Homa listens after, never interrupts.
- No diarization vendor and no STT model change in v1. Tone, energy,
  and rough speaker sense come from the per-segment audio pass
  (§4.4); the transcript lane stays on whisper-large-v3-turbo. A
  nova-3 diarization experiment is a later ticket only if the tone
  lane proves insufficient.
- No child-directed output of any kind (IC-11 stands).
- No evidence from images or from tone in v1. The progress ledger
  stays transcript-grounded where the substring guard has teeth.
- No video in lesson media v1 (images only).
- No mobile app recorder in v1. The ingest API is client-agnostic so
  apps/mobile can add true background recording later.
- No automatic family_memories writes from lessons.
- No multi-child recordings in v1 (see Q2).

## 7. Decisions (delegated 2026-07-13 evening, PMF lens)

- **Q1 · transcript visibility: family-shared.** Consistent with
  progress, materials, and memories; no new privacy machinery to
  build or explain. A second parent reading the review is also an
  activation vector, not a leak. This decides visibility for LESSON
  transcripts only; the older open ruling on call and chat transcript
  visibility in the reconciliation index stays open.
- **Q2 · combined lessons: one child per recording in v1.** Trust is
  the asset PMF depends on, and a wrong-kid evidence write damages it
  worse than a missing feature. The extraction still notes "another
  child appears in this lesson" as review text only, which doubles as
  demand measurement for multi-child tagging.
- **Q3 · where reviews file: kid page plus chat only in v1.** Chat
  delivery is the habit surface. Binder filing is polish; it becomes
  a fast-follow only if reviews prove sticky (see §8 signals).
- **Q4 · rate cap: 6 per family per day** (raised from the draft's 3).
  A cap should bound abuse, never the habit loop: three kids times
  two lessons is a normal homeschool morning, and the marginal cost
  of a lesson (transcription plus one extraction pass) is far below
  the value of a power family forming the habit. Revisit only if
  model-usage ledger data says otherwise.
- **Q5 · entry point: the kid page** (folded from the unknowns
  artifact under the same delegation). Recording starts from the page
  that already owns this kid's progress, so the child is pre-picked
  by context and no picker screen exists. Chat can deep-link to it
  later; a second door is a fast-follow, not v1.
- **Q6 · segment length: 3 minutes** (folded from the unknowns
  artifact). Moment resolution, crash-loss window, and iOS segment
  size all improve together; the cost is a few more uploads per
  lesson.
- **Q7 · tone posture: whisper stays, tone is a second ear, not a
  vendor swap** (founder direction §1 item 7 plus the unknowns
  artifact). The transcript lane keeps the model every other lane
  trusts; the audio-native per-segment pass owns tone. Consent copy
  in LL-0 names AI processing under no-training terms, since lesson
  audio now reaches a second model provider through the gateway.

## 8. Rollout order (deploy laws apply)

1. Everything ships dark behind HOMA_LESSON_LISTEN_ENABLED. The
   migration is additive-only, so it may lead or ride the code push.
   pnpm check:isolation before it lands.
2. Evidence writes inherit HOMA_LIVE_PROGRESS_ENABLED. Where live
   progress is off, the clause fan-out is skipped entirely (verified
   pairs are kept on the review row as skipped_flag_off) and the
   review still renders; the journal service has no observation-only
   mode and inventing one was not worth the risk to the shipped
   journal path (build decision 2026-07-13 late night).
3. Deploy, watch Vercel to READY, probe legacy paths, then enable the
   flag for the founder family first. Dogfood at least one real
   45-minute lesson on a phone (segments, a mid-lesson worksheet
   photo, resume, tone notes present, review, progress writes) before
   any wider enablement.
4. Rollback is the flag off. Tables and blobs are additive and inert.
5. PMF signals, readable from the MJ-08 events this plan already
   registers (no extra instrumentation):
   - The habit signal: a family records a SECOND lesson within 7 days
     of their first, unprompted. lesson.recorded per family over time
     is the retention curve; this is the number that decides whether
     lesson listen earns more investment.
   - The wow signal: review pages opened within a day of
     lesson.review_ready (page analytics), and follow-up chat
     messages referencing the review.
   - The trust signal: correction rate on lesson_listen evidence. Low
     corrections mean the matcher threshold is holding; a spike means
     tighten before widening the rollout.
   - The demand signal for v2: how often reviews carry the "another
     child appears in this lesson" note (§7 Q2), which sizes
     multi-child tagging before building it.
