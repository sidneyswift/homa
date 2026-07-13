# Wispr Flow for web dictation: investigation and integration plan

Date: 2026-07-13 · Author: investigation session run from outside this repo (read-only;
nothing in this doc changed code). Founder asked: can we add the Wispr Flow voice API
(https://api-docs.wisprflow.ai) to the web app's voice input for better accuracy, and to
tag kids, domains, topics, materials, locations, skills, tools?

**Verdict: strong fit for the accuracy half, and it lands on a need our own journey doc
already names. Wispr Flow's `context.dictionary_context` is exactly the "child-name
biasing from family roster" that journeys/04 specifies and the current Telnyx lane cannot
do. But Wispr is a transcription API, not an entity tagger: it returns better TEXT (names
spelled right, filler removed, AI-prompt formatting), not tags. Tagging is a small
downstream step that Wispr makes reliable, because you can only match "Theo" to a kid if
the transcript says Theo and not Leo. Two gates before building: a privacy/DPA answer
(kids' names would flow to a third-party processor) and an iOS Safari audio-conversion
spike (Wispr wants 16kHz WAV, MediaRecorder produces webm/mp4).**

## What we have today (the thing being upgraded)

- `apps/web/app/app/dictation.tsx`: MediaRecorder state machine. Records webm/opus
  (Chrome/Firefox) or mp4/AAC (iOS Safari) at a 32kbps hint, 180s cap, uploads as
  multipart form data. Chosen over the Web Speech API on purpose (iOS Safari
  unreliability, absent in Firefox); that reasoning still holds and is unchanged by this
  plan.
- `apps/web/app/api/chat/dictation/route.ts`: auth-gated, 4MB body cap (Vercel functions
  reject past ~4.5MB), 30 dictations/user/hour rate limit, never stores audio.
- `apps/web/lib/voice/transcribe.ts`: the shared core. Telnyx STT
  (`openai/whisper-large-v3-turbo`), fail-soft null contract. Shared with the SMS
  voice-note lane (`lib/voice/sms-attachments.ts`), which this plan does NOT touch: MMS
  media lives at Telnyx and should keep transcribing there.
- `apps/web/app/app/chat-client.tsx` (~line 372): transcript joins the draft for review;
  nothing sends until she sends. The kids list `{id, name}[]` is already a client prop
  (`app/app/page.tsx` line 81 passes it for the slash composer).
- The documented gap this fills, verbatim from `docs/homa-planning/journeys/04-feature-journeys.md`
  (lines 285-286): "Name mis-transcription ('Theo'→'Leo') poisons routing" and the
  transcribe step should apply "child-name biasing from family roster". The Telnyx
  endpoint takes a model name and a file, nothing else; biasing is unbuildable on it.

## What Wispr Flow offers (from api-docs.wisprflow.ai)

Three integration surfaces, one request schema:

- REST `POST /api` with org API key (server-side), or REST `POST /client_api` with a
  short-lived client JWT, or WebSocket streaming (`/client_ws`, their recommended
  lowest-latency path). Client JWTs are minted server-side via `/generate_access_token`
  using the org key (client_id + duration + metadata), revocable.
- Audio input: base64, 16kHz mono WAV, max 25MB or 6 minutes. This is the big format
  constraint (see Constraints below).
- `language`: ISO 639-1 list; a single-item list forces the language (we would send
  `["en"]` initially, or the family's languages later).
- `context`, all optional, the reason to do this at all:
  - `app.name` + `app.type: "ai"`: formats output for prompting an AI agent, which is
    exactly what the chat composer feeds.
  - `dictionary_context`: "list of uncommon names or words relevant to the context".
    This is the tagging-adjacent field: kid names, domain/topic names, material titles,
    skill names, curriculum/homeschool-style terms, city names.
  - `user_first_name` / `user_last_name` / `user_identifier`: speaker's own name spelled
    right.
  - `textbox_contents.before_text/selected_text/after_text`: the current draft, so
    casing/spacing/punctuation continue correctly when a take appends to typed text.
  - `conversation.{id,participants,messages[]}`: recent chat turns for context (privacy
    call, see gates).
  - `screenshot` / `content_text` / `content_html`: not needed for our composer.
- Response: `{ id, text, detected_language, total_time, generated_tokens }`. Note what is
  NOT there: no word timestamps, no entities, no tags. Hence the tagging section below.
- Ops notes: a Warm Up API exists to pre-warm before a session (cuts first-take latency).
  Billing is usage-token based and contract-billed; the dashboard has NO hard API limits
  ("use the API in your code responsibly"), so our existing per-user rate limit stays
  load-bearing. Per-token price is not published in the docs [UNVERIFIED; get from
  contract/dashboard before the cost call].

## Field-by-field: Wispr context ← Homa sources

| Wispr context field | Homa source (all family-scoped, already built) |
|---|---|
| `dictionary_context` kid names | `kids` prop already on the chat client (`app/app/page.tsx` line 81) |
| `dictionary_context` adult names | `getMyFamilyMembers` (`lib/family.ts` line 77) |
| `dictionary_context` material titles | materials library (`lib/materials/library.ts`, `SUMMARY_COLUMNS` has title/skill/subject/theme) |
| `dictionary_context` skill names | `getSlashMenuSkills` (`lib/slash-skills.ts` line 31) |
| `dictionary_context` domain/topic names | `@homa/taxonomy` display names. Server-only package by law (`packages/taxonomy/src/index.ts` header: never enter a client bundle). Pass a curated small list of NAME STRINGS from a server component, never the graph |
| `dictionary_context` homeschool terms | `lib/homeschool-styles.ts` (Charlotte Mason, unschooling, etc.) |
| `dictionary_context` location words | `families.us_state` / `address_city` (`lib/family.ts` line 55) |
| `user_first_name` | `parentFirstName` (`lib/family.ts` line 46) or the member's own `display_name` (`getMyMemberProfile`, multi-parent aware) |
| `textbox_contents.before_text` | the composer `draft` state (client-side already) |
| `app` | `{ name: "Homa", type: "ai" }` |
| `conversation.messages` | recent turns from the chat client. PRIVACY GATE: off by default until ruled on |

Keep the dictionary focused: names most likely to be misheard, not an entity dump. The
docs state no size cap [UNVERIFIED], so treat ~100-200 short strings as the working
budget and measure.

## What Wispr does NOT do: the tagging half

"Tag kids, domains, topics, materials, locations, skills, tools" is two separable jobs:

1. **Get the words right** (Wispr's job): "Theo finished the Montessori bead chain" comes
   through with Theo and Montessori spelled correctly because both were in the
   dictionary.
2. **Attach structure** (our job, downstream): match transcript text to family entities
   and taxonomy. Two existing seams already do or can host this:
   - The chat agent already interprets the sent message (routing, child attribution).
     Better transcripts directly improve it with zero new code.
   - If we want visible pre-send tags (chips on the draft: kid, topic, material), that is
     a deterministic matcher over the transcript against the same lists we sent as
     dictionary context, rendered next to the composer. That is a product/design
     decision, not part of this integration, and it works identically whichever STT
     vendor produced the text.

Recommendation: ship accuracy first, measure, then decide if pre-send chips earn their
UI. Do not conflate the two in one ticket.

## Constraints and gotchas found

1. **16kHz WAV requirement.** MediaRecorder cannot produce it. Two paths:
   - Convert on accept (recommended first step): recorded blob → `decodeAudioData` →
     `OfflineAudioContext(1, n, 16000)` resample → Int16 PCM → WAV header → base64. All
     standard browser APIs, no deps. NEEDS AN IOS SAFARI SPIKE: decodeAudioData of its
     own mp4/AAC recordings and arbitrary-rate OfflineAudioContext are the two things to
     verify on real phones (the same phones that motivated MediaRecorder in the first
     place, M0-04).
   - Or capture raw PCM via AudioWorklet at 16kHz (skips MediaRecorder entirely). This is
     also the exact shape the WebSocket streaming path wants, so it is the natural phase
     2, not phase 1.
2. **Vercel body limits make the proxy path awkward.** 16kHz 16-bit mono is 1.92MB/min
   raw, 2.56MB/min as base64. The current 180s cap would be ~7.7MB base64, over both the
   route's 4MB cap and Vercel's ~4.5MB. So EITHER cut max duration to ~110s and keep
   proxying, OR (recommended) use Wispr's client-auth: a mint-token route + the browser
   calls `POST /client_api` directly. Direct calls get the full 6-minute/25MB Wispr
   budget (today's 180s cap fits with room), lower latency, and audio stops transiting
   our servers entirely.
3. **Fail-soft law (M1-05: voice failure is a moat failure).** Wispr becomes the primary;
   the existing Telnyx route stays as automatic fallback: Wispr error/timeout → post the
   original webm blob to `/api/chat/dictation` exactly as today. The client keeps the
   original recording until a transcript lands. Copy stays unchanged; the fallback is
   invisible.
4. **SMS lane untouched.** `transcribeSmsMedia` keeps Telnyx: MMS media already lives
   there, AMR handling is verified there (build-log 2026-07-09), and no browser exists in
   that lane to hold a client JWT.
5. **No API-side spend limits.** Keep the 30/user/hour rate limit; it now guards Wispr
   spend too. Token minting must be auth-gated the same way the dictation route is.
6. **Audio retention/training at Wispr [UNVERIFIED].** The dictation route promises
   "never stored" today. What Wispr retains, for how long, and whether they train on API
   audio is not in the public docs. Same posture as founder ruling D4 set for image
   providers (no-training/no-retention DPAs): get it in writing before kids' names or
   audio flow.

## Recommended plan (phased)

**Phase 0, spikes (half a day):** iOS Safari conversion spike on a real phone; one manual
API call with and without dictionary_context to confirm the accuracy delta on kid-name
audio; retention/DPA answer from Wispr.

**Phase 1, REST with client auth + context (the win):**
- `apps/web/lib/voice/wispr-token.ts` + `app/api/chat/dictation-token/route.ts`: mint a
  short-lived client JWT (org key `WISPR_FLOW_API_KEY` server-side only, client_id = user
  id, ~15 min duration, refresh on 401). Auth + rate-limit like the dictation route.
  The route response also carries the server-side dictionary slice (member names,
  material titles, taxonomy name strings, homeschool terms) so the client never imports
  server-only modules.
- `apps/web/lib/voice/wav.ts`: recording blob → 16kHz mono WAV base64 (pure functions,
  testable).
- `dictation.tsx`: on accept, convert, call `POST /client_api` directly with `language:
  ["en"]` and context (app ai, user first name, kids from props, server dictionary
  slice, draft as before_text). On any failure, fall back to the existing route with the
  original blob. Emit which lane won (the `chat.turn_completed.modality` funnel already
  exists; add lane + fallback-rate signal per MJ-08 rules, no content).
- Keep 180s cap (fits Wispr's 6 min).
**Phase 2, latency polish:** Warm Up API call when the mic permission lands; consider the
WebSocket + AudioWorklet path for live partial text in `DictationRow` (the "Listening…"
row becomes live words). Only if phase 1 latency disappoints.
**Phase 3, tags in the UI (separate decision):** deterministic entity chips over the
final transcript (kid, topic, material, skill), confirm-before-send. Design work first.

## Open questions (founder gates)

1. Privacy: OK sending kids' FIRST names as dictionary context? And is conversation
   history in scope, or off until a DPA exists? (Recommend: names yes with DPA, history
   no for v1.)
2. Cost: per-token price vs Telnyx per-call [UNVERIFIED both]; the funnel's
   dictations/user/week makes this a real number once measured.
3. Does Wispr's auto-edit behavior ("actually let's do 7" → "7pm") ever HURT a
   journal-style capture where mom's exact words matter? Worth watching in phase 0/1
   evals; `app.type` and dictation-not-voice-notes scope suggest low risk.
