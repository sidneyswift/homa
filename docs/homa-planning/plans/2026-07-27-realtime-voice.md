# One Homa who can hear: the phone line, and whether it needs rebuilding

Date: 2026-07-27. Status: revised after a simplification pass; founder rulings
recorded in §6. Investigation method: two parallel deep-readers over the voice
stack and the eve harness, a literal read of the OpenAI Realtime, Vercel AI
Gateway realtime, and Vercel Functions WebSocket docs, then an adversarial
simplification review that overturned this document's own first conclusion.
Every codebase claim carries a file reference. §9 maps the work to GitHub
issues. §0.1 records what the first pass got wrong, because the refuted
reasoning is as load-bearing as the reasoning that survived.

## 0. TLDR

Homa's phone line does not run on Homa. Telnyx's hosted assistant owns the
whole conversation on `Qwen/Qwen3-235B-A22B`
(`scripts/telnyx-provision.mts:485`), picked in July because it was the
strongest option needing no provider key. Phone Homa has **4 tools** against
eve's **62**, and phone is not a channel in the continuity ledger at all.

The first draft of this document concluded: therefore rebuild the phone on the
OpenAI Realtime API. **That conclusion was wrong, or at least premature.** The
two live defects used to justify the rebuild are both fixable this week on the
architecture we already have:

- **Phone-call amnesia (#171) is a provisioning omission.** The curriculum
  line already receives a call-ended webhook in production via a Telnyx Insight
  Group (`scripts/telnyx-curriculum-provision.mts:196`,
  `insight_settings: { insight_group_id }`). The general line sets
  `dynamic_variables_webhook_url` and nothing else
  (`scripts/telnyx-provision.mts:495`). That single missing binding is the
  entire reason a call currently waits an hour for a cron.
- **The materials bridge (#187) is about 90% shipped.** `apps/web/lib/jobs/`
  is 1,789 lines of live, migrated, flag-gated background-job machinery
  (`runner.ts` 591, `store.ts` 507) and `contracts.ts:146` already holds a
  single-stage `materials-studio` contract. The gap is one call:
  `lib/jobs/milestone.ts:112` sends `submitHomaSms(phone, body)` with no
  media, while the MMS-with-PDF path is fully built at
  `agent/tools/create_printable.ts:801`. The bridge plan was written
  2026-07-20; agent-jobs landed after it and made its proposed new channel
  redundant.

**So the plan is three phases, not one march.**

**Phase 1 (this week, about 3 days, no new vendor, no new credential, no
ruling required):** close both defects on Telnyx, fix a live footgun, move the
phone's rules out of a CLI script, and make voice spend visible.

**Phase 2 (half a day, then a wait):** get the three numbers this project has
been arguing without: real metered cost per call, whether Telnyx can hand a
call to OpenAI at all, and how many families actually call.

**Phase 3 (only if the numbers justify it):** rebuild the phone on
`gpt-realtime-2.1`, built the simple way: **one door into Homa, not sixty-two
tools over a wire.**

**Parked:** in-app voice. A shipped, session-gated, wall-integrated,
instrumented "have me call you now" affordance already exists
(`app/onboarding/r/[token]/call-homa-ps.tsx`); pointing it at the general line
is an argument change. Build browser audio only if that button gets used.

## 0.1 What the first pass got wrong

Kept visible on purpose.

| Claim | Why it was wrong |
|---|---|
| "Amnesia and the materials gap require a new architecture." | Both are fixable on Telnyx today. §0 above. This inverted the whole justification: the rebuild is a quality bet, not defect repair. |
| "Expose the light tools live on the call, dispatch the heavy ones." | There is no light tier. `lib/agent-tool-deadline.ts:96-121`, derived from n=3155 production calls: `quick`'s slowest is **13.9s** and covers 38 tools, `fetch` is **41.4s** and covers 20. That is 58 of 60. The plan rejected forwarding to eve at 6 to 12 seconds, then proposed something slower. |
| "The 5 second webhook wall is the reason the bridge plan existed." | The wall was never the reason; tool latency was, and tool latency is unchanged by any of this. The bridge plan's own §5 already returns as soon as `send()` resolves. |
| A `ONE BRAIN CONFIG` box in `lib/voice/`. | That box sat **outside** the seam that actually unifies Homa and re-derived four of its five contents. The real seam is `isPinnedAgentChannel` (`lib/agent-db.ts:137-161`), a six-member union off which family context, the tool surface, the hooks, continuity, and usage attribution all hang. Adding `"voice"` is one line, and the comment at `:129-136` records the 2026-07-18 defect caused by keeping a second list. A genuine one-brain design puts voice **inside** that union. |
| `check:voice-parity` as a new merge gate. | Half of it already runs in CI: `scripts/instructions-split-check.mts` (`.github/workflows/ci.yml:56`) already asserts the persona slice yields persona plus Voice with no web-tool leakage. The other half only exists if we build the complicated version. |

Solutions that existed only because tools would run outside eve, all now
deleted: `check:voice-parity`, the generated capability boundary and its
generator, the per-call scoped MCP bearer, a new conversational deadline tier,
a hook adapter with zero prior art in this repo, and decision D3 itself.

## 1. What exists today

### 1.1 The phone line is not ours

```
Parent's phone → PSTN → Telnyx number → assistant's auto-created TeXML app
                                              │
   ╔══════════════════════════════════════════▼═══════════════╗
   ║ TELNYX AI ASSISTANT  "Homa voice (experiment)"           ║
   ║   ASR, TTS, turn-taking: Telnyx's, opaque                ║
   ║   LLM: Qwen/Qwen3-235B-A22B, Telnyx-hosted               ║
   ╚══════════════════════════════════════════════════════════╝
        │ once at call start          │ 0..N times, blocking, ~5s
        ▼                             ▼
  POST /api/voice/context      POST /api/voice/tools/{4 of them}

        ── call ends; nothing fires ──   ← THE BUG, and it is one setting
                 │
        ⏱ up to 60 min (hourly cron) → call_transcripts
```

`RTCPeerConnection`, `new WebSocket`, `wss://`, and `media_stream` are absent
across `apps/web`, `apps/mobile/src`, and `scripts/`. **Zero audio bytes touch
Homa's infrastructure during a call.**

Naming trap: `apps/web/agent/channels/telnyx.ts` is 690 lines and contains no
voice code. It is the SMS channel. So is roughly 90% of
`lib/voice/telnyx-api.ts`.

### 1.2 The capability gap

Phone: `remember`, `log_hours`, plain-text `send_email`, `send_signup_link`.
Web and SMS: 62 tools. The 4 phone tools are 383 lines of route code that call
`emitMapEvent` and nothing else.

### 1.3 Phone is not a channel in the ledger

`lib/conversation-log.ts:60-68` types `channelLabel` as
web|sms|email|dispatch. `lib/conversation-continuity/ledger.ts:41` as
web|sms|email. Phone turns never enter `conversation_messages`. They live in
`call_transcripts`, read on demand by one tool
(`agent/tools/recall.ts:121-136`) and never by the per-turn family context.

Half the vocabulary was already built and abandoned:
`conversation_deliveries.channel` already admits `'voice'`
(`migrations/20260711143707:89`), as do `ContinuityChannel`
(`continuity-service.ts:17`), `ChatTurnModality`
(`app/app/chat-send-policy.ts:3`), and the typed `chat.turn_completed` event
(`packages/core/src/events.ts:888`). Only `conversation_messages.channel` does
not.

### 1.4 What is already good, and must survive

**Tenancy by templating.** `scripts/telnyx-shared.mts:270-274` builds every
tool URL as `...&family_id={{family_id}}`, substituted by Telnyx from the
call's own variables. **The model never supplies `family_id`.** Any
replacement reproduces this exactly, not approximately.

**Fail open to the stranger experience.** `context/route.ts:139-146` catches
everything and returns a blank variable set, so a database wobble makes a
known family an unknown caller rather than dropping the call.

**The honesty coupling.** `app/api/voice/tools/send-email/route.ts:32-38`
returns a three-sentence boundary instead of `{success: true}`, mirrored in
`general-call-instructions.md:68-75`. It works. Its weakness is that the
coupling is a code comment with no test.

**Context is already transport-agnostic.** `lib/family-context.ts:273` says so
in its own header: "Renders the context block shared by web chat, SMS, and
voice." `app/api/voice/context/route.ts:86-114` already calls the shared
loaders, each individually fail-open. There is no separate voice context
builder to unify.

### 1.5 In-app audio today

`app/app/dictation.tsx` (311 lines) is a MediaRecorder mic producing a
**composer draft**, transcribed by `openai/whisper-large-v3-turbo` hosted at
Telnyx. It is dictation, not conversation, and it stays.

`app/onboarding/r/[token]/call-homa-ps.tsx` is a shipped one-tap "have me call
you now" that rings the number the family gave at onboarding. Supabase-session
gated to a family member (founder ruling 2026-07-14 option b), wall
integrated, beacons `report.action_tapped` on every tap regardless of flag.
The outbound call takes `AIAssistantId` as a parameter.

`apps/mobile` has no audio dependency of any kind.

## 2. What the Realtime API gives us, for Phase 3

Read literally 2026-07-27. Retained because Phase 3 depends on it and the
research does not need repeating.

### 2.1 The model

`gpt-realtime-2.1`: 128k context, 32k max output, cutoff 2024-09-30, text plus
audio plus image in, text plus audio out. Function calling, prompt caching,
`reasoning_effort` (`minimal` to `xhigh`; docs recommend starting `low`).

Per 1M tokens: text in $4, cached text $0.40, text out $24, **audio in $32,
cached audio in $0.40, audio out $64**, image in $5.
`gpt-realtime-2.1-mini`: text $0.60/$2.40, **audio $10/$20**.

### 2.2 Transports

**SIP** for telephony, **WebRTC** for browser and mobile, **WebSocket** for
server-side media pipelines. SIP is the one that matters: OpenAI terminates
the media, so Homa never runs an audio server. That removes the only seam in
this project with no precedent in the repo.

**Unverified and load-bearing:** whether Telnyx will SIP-forward our number to
`sip:$PROJECT_ID@sip.api.openai.com;transport=tls` with caller ID intact.
OpenAI documents the path and Twilio and Bandwidth both publish carrier-side
setup, but **Telnyx's own guidance for OpenAI Realtime points at a media-stream
WebSocket bridge you run yourself**, which is exactly what we are avoiding. If
Telnyx cannot forward, the fallback is not a bridge on Vercel (800s cap plus
8 kHz to 24 kHz transcoding); it is keeping Telnyx for SMS and 10DLC and
getting a voice number from a carrier that documents the path. §5 Phase 2
answers this.

### 2.3 SIP lifecycle

Carrier routes to the OpenAI SIP URI. OpenAI POSTs `realtime.call.incoming`
with `call_id` and a `sip_headers` array carrying `From`, `To`, `Call-ID`,
plus `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers. We
answer with `POST /v1/realtime/calls/{call_id}/accept`, whose body **is** the
session configuration. `/reject` (default 603), `/refer`
(`{"target_uri": "tel:+1..."}`, a real human-handoff path), and `/hangup`
complete it. The `From` header is what keeps `findFamilyIdentityByPhone`
working unchanged.

### 2.4 Turn detection, voices, transcription

`turn_detection` supports `server_vad` and `semantic_vad` with `threshold`,
`prefix_padding_ms`, `silence_duration_ms`, `eagerness`, `create_response`,
`interrupt_response`; `null` gives push-to-talk. Barge-in is server-handled on
SIP and WebRTC. Voices: `marin` and `cedar` recommended, plus alloy, ash,
ballad, coral, echo, sage, shimmer, verse. Input transcription is configurable
per session, which is how we get the parent's own words without a second STT
vendor.

### 2.5 The Vercel AI Gateway path, and why Phase 3 does not use it

The gateway supports realtime, lists `openai/gpt-realtime-2.1`, and
`gateway.experimental_realtime.getToken()` accepts a Vercel OIDC token. Its
limits: 25 minute max session, 5 minute idle, 256 KB max message, per-team
concurrency, **no image input**, and reconnect does not resume. It needs
canary releases (`ai@canary`, `@ai-sdk/gateway@canary`,
`@ai-sdk/react@canary`) against pinned `ai@^7.0.14`, `eve@0.19.0`, and
`patches/eve@0.19.0.patch`. It is **WebSocket only** and does not proxy
`/v1/realtime/calls/*`.

It exists in this document only for the in-app path, which is parked. If
in-app voice is ever built, this is the route that honors the OIDC law, and
the ruling `voice-provider-key-telephony-only` stands untouched.

## 3. Phase 3's shape, if we get there: one door, not sixty-two

The realtime model gets **one** tool. Call it `ask_homa`. It opens an eve turn
and returns Homa's answer for the model to speak.

```
   Parent's phone
        │ SIP
        ▼
   gpt-realtime-2.1  ── holds the conversation, barge-in, chit-chat: instant
        │
        │ one tool: ask_homa("she wants a syllables worksheet for Amalia")
        ▼
   lib/harness/resume-session.ts   ← already written, tested, deliberately dormant
        │                            header: "the first schedule dispatcher,
        │                            parked-HITL path, or other app-owned HTTP
        │                            resume MUST go through this function"
        ▼
   an eve session with channel "voice" in PINNED_CHANNELS (agent-db.ts:137-161)
        │
        └── every one of the 62 tools, family context, the hooks, continuity,
            usage attribution, tenancy. All of it, for one line of change.
```

**Why this is right.** Everything that makes Homa Homa hangs off
`isPinnedAgentChannel`. Adding `"voice"` to that union gets tools **and** the
family block together, which is the lesson recorded at `agent-db.ts:129-136`
after a real 2026-07-18 defect. The per-tool allowlist needs no new machinery
either: `defineDynamic` returning `null` on `turn.started` already removes a
tool for a session, and six tools already do it
(`agent/tools/generate_image.ts:214-222`). That only works if voice runs
inside eve.

**Cost 1: latency on tool turns.** 6 to 12 seconds. Bridged by a spoken line,
a pattern this repo already scripts:
`agent/tools/start_first_making.ts:175` returns "SPEAK AFTER THIS ONE: ... it
needs one warm line in your voice." Chit-chat, which is most of a call, stays
instant on the realtime model. Note this is **not** the option ruling
`voice-brain-hybrid` declined: that declined forwarding *every* turn. This
forwards only tool turns.

**Cost 2, and it is the serious one: paraphrase drift.** The realtime model
restates eve's answer, which is a new fabrication surface on the exact product
whose defining scar is fabrication. If eve returns "saved" and the model says
"saved and emailed," we are back at 2026-07-19 by a different mechanism.
Mitigation is the pattern already in the codebase: return results as
verbatim-read text the way `send-email`'s `SENT_NOTE` does
(`send-email/route.ts:32-38`), and cover it in the honesty eval. Designed in,
never assumed.

**Cost 3:** `resume-session.ts` is deliberately dormant and has never run in
production. Phase 3 is its first real use.

## 4. Data model

One additive migration, and it belongs to Phase 3, not Phase 1.

```sql
alter table public.conversation_messages
  drop constraint if exists conversation_messages_channel_check;
alter table public.conversation_messages
  add constraint conversation_messages_channel_check
  check (channel in ('web', 'sms', 'email', 'dispatch', 'voice'));
```

`'voice'` over `'phone'` deliberately: three other places already use it
(§1.3). A fifth name for a thing with four names is the exact disease the
one-planner spec is treating. Additive only, so it may lead the deploy.

**Phase 1 does not need it.** Telnyx-summarized call content lands in
`call_transcripts`, and a bounded recent-calls line added to the per-turn
family context makes it visible to chat within a minute of hangup. That is
literally what #171's own work order step 3 asked for.

**`UsageChannel` gaining `voice` moved to Phase 3**, attempted in Phase 1 and
reverted. Typecheck showed the type has three consumers with three different
domains: the `model_usage` ledger, the `materials.channel` column (whose
CHECK the founder ruled unchanged in voice-materials-bridge D3), and the
typed event registry. Nothing sets `channel: "voice"` today, so widening now
cascades across seven files plus a migration for a channel that does not
exist. It belongs with #280, where the channel is actually created and all
three consumers have to be resolved together. The failure it guards against,
an unknown channel resolving to `"web"` and thereby suppressing the SMS
branch in `create_printable.ts:544,801`, cannot fire before then.

## 5. Sequencing

### Phase 1: fix what is broken, on what we have

No new vendor, no new credential, no ruling required. About 3 days. Nothing
here depends on any Phase 3 decision.

1. **#285, the footgun.** `pnpm telnyx:provision --status` POSTs
   `{instructions, tools}` unconditionally (`:508-511`), and with
   `TELNYX_WEBHOOK_SECRET` absent from the shell `tools` becomes `[]`
   (`:460-467`), stripping every tool off the live phone line. Two lines.
   Ship first, because everything else in Phase 1 runs that script.
2. **#278, make the phone remember.** An Insight schema plus Insight Group on
   the general line, mirroring `telnyx-curriculum-provision.mts:160-198`; a
   route to receive it; the write into `call_transcripts`; and a bounded
   recent-calls line in the per-turn family context. **Closes #171.**
3. **#281, attach the file to the text.** Join `agent_job_stage_artifacts` to
   `materials.preview_url` and `pdf_url` and pass `mediaUrls` through
   `lib/jobs/milestone.ts`, behind the `voice-dispatch-sandbox-gate` ruling:
   sandbox families always, everyone else behind
   `HOMA_JOB_MATERIAL_DELIVERY_ENABLED`. The `voice` case in
   `usageChannelFromAttributes` moved to Phase 3, see §4. **Closes #187.**
4. **#276, the phone's rules become a file.** The ~85 lines of binding founder
   rulings living as a TypeScript array literal at
   `scripts/telnyx-provision.mts:368-445` move to `agent/phone-rules.md`, so a
   prompt change deploys with code instead of waiting for someone to remember
   to run a script. Watch `:364`, `full.split("## What you know each turn")[0]`
   is a load-bearing heading slice already guarded by
   `scripts/instructions-split-check.mts`.
5. **#283, in-app voice v1.** Point the existing call button at the general
   line and put it where a signed-in parent will find it. Measure taps.

### Phase 2: get the three numbers

**#275.** Half a day of throwaway work, then a wait for real usage.

1. **Can Telnyx hand a call to OpenAI?** Prove SIP forwarding to
   `sip.api.openai.com` with caller ID intact, on a test number. If not, price
   a voice number at a carrier that documents it, keeping Telnyx for SMS and
   10DLC.
2. **What does a call actually cost?** Metered, on a real five-minute call.
   Every dollar figure in this document assumes roughly 800 audio tokens per
   minute per direction and is a guess until this exists. Verify prompt
   caching engages on audio context; without the $0.40/M cached rate, call
   cost grows with the square of call length.
3. **How many families call at all?** `call_transcripts` row counts, plus tap
   counts on Phase 1 item 5.

### Phase 3: rebuild, if the numbers say yes

6. **#280, one door into Homa.** `"voice"` into `PINNED_CHANNELS`, `ask_homa`
   backed by `resume-session.ts`, verbatim-read tool results, the honesty
   eval.
7. **#279, SIP inbound on a test number**, behind
   `HOMA_REALTIME_VOICE_ENABLED`. Session built from Phase 1's extracted
   functions. Model per ruling `voice-model-tier`.
8. The additive migration and the ledger widening (§4), now that turns are
   held live rather than summarized.
9. **#282, cut the live number over.** Sandbox family first. Rollback is one
   PATCH pointing `connection_id` back at the Telnyx TeXML app
   (`telnyx-provision.mts:516-529`), so keep the Telnyx assistant provisioned
   until the soak passes.

Blocked on **#286** (voice casting), because the first family to call after
cutover hears whatever is configured.

### Parked indefinitely

Browser audio (the old arc H) and mobile voice (the old arc I, #284, closed).
Revisit only if Phase 1 item 5 shows demand. The precedent is #253: a surface
shipped with no discovery loop measured zero real families.

## 6. Founder decisions

Ruled 2026-07-27, registered in `journeys/10-reconciliation.md` §5. The
three-phase split changes **when** each binds, not what was decided.

| | Ruling | Binds |
|---|---|---|
| **D1** | Scoped `OPENAI_API_KEY`, telephony only; in-app on OIDC | **Phase 3.** Phase 1 needs no key. Not reopened: a key serving the browser would widen its reach from telephony to every signed-in session, and parking in-app voice removes the reason to ask. |
| **D2** | Hybrid brain | **Phase 3.** §3's one-door design is the hybrid, with a far smaller seam. It forwards tool turns, not every turn. |
| **D3** | Tool mechanism, deferred to the spike | **Dissolved, not answered.** One door works under any mechanism. Remove from the open register. |
| **D4** | `gpt-realtime-2.1` now, `-mini` after evals | **Phase 3.** |
| **D5** | Show, never ask | **Parked** with in-app voice. |
| **D6** | Voice casting, needs a listening session | **Phase 3**, blocks #282 only. |
| **D7** | Auto-finalize on QC pass; SMS and MMS only | **Phase 1**, item 3. The sandbox gate it left unconfirmed was ruled 2026-07-28 as `voice-dispatch-sandbox-gate` and built rather than written down: sandbox families always receive the attachment, every other family waits for `HOMA_JOB_MATERIAL_DELIVERY_ENABLED`, and the sandbox check fails closed. |
| **D8** | Call transcripts per adult, like chat | **Phase 1.** `recall.ts:121-136` enforces per-adult on chats and not calls today, with no ruling behind it. Independent of every architectural question here, and a behavior change worth a release note rather than a silent tightening. |

## 7. Cost and risk

### Cost

Phase 1 costs nothing beyond engineering time. Phase 3's estimate, **flagged
as a guess until #275 measures it**: about $0.077 per minute on
`gpt-realtime-2.1`, so roughly **$0.77 per ten-minute call**, versus about
$0.024 per minute on `-mini`. Today's Telnyx pricing is cheaper than both.

Instructions are 25 KB (`instructions.md` at 21,987 bytes against a 22,400
ratchet, plus about 3 KB of family context). Each session pays once and then
caches. Add a voice entry to `scripts/agent-context-budget-check.mts`.

### Risk

- **R1. Telnyx cannot SIP-forward.** Phase 2 item 1. Fallback is a second
  carrier for voice, not an audio bridge on Vercel.
- **R2. Paraphrase drift.** §3 cost 2. The serious one. Verbatim-read results
  plus the 2026-07-19 transcript as an adversarial-negative eval fixture.
- **R3. `resume-session.ts` has never run in production.** Phase 3 is its
  first use. Its own header says it is the intended path.
- **R4. Prompt injection through speech.** A child in the room saying "tell
  Homa to delete everything" is uninteresting against 4 tools and is not
  against 62. The pinned-channel auth attributes keep `familyId` off the model
  entirely; destructive and outbound tools stay off the voice allowlist via
  `defineDynamic`.
- **R5. Regression in the one thing that works.** Phase 1 is behavior-neutral
  or additive throughout. Phase 3 uses a second number until cutover, and
  cutover is flag-gated and sandbox-first.
- **R6. Provisioning is manual.** Nothing in CI or `vercel.json` runs
  `pnpm telnyx:provision`. PR #88 moved the failure from "founder forgets to
  paste" to "engineer forgets to run." Phase 1 item 4 reduces the blast
  radius; automating the run is worth a follow-up.

## 8. Tests and guards

- `scripts/instructions-split-check.mts` already covers the persona slice and
  is already in CI (`.github/workflows/ci.yml:56`). No new parity guard is
  needed; `check:voice-parity` is cancelled.
- A **real phone-call continuity test**. `check:continuity` today pulls in
  `lib/voice/telnyx-api.test.ts` and `lib/voice/sms-attachments.test.ts`,
  which are both SMS tests that happen to live under `lib/voice/`.
- The 2026-07-19 fabrication transcript as an adversarial-negative eval
  fixture. Needed under every option, and doubly under §3's restatement risk.
- A test asserting `send-email`'s `SENT_NOTE` and
  `general-call-instructions.md` agree. They are coupled by a code comment
  today.
- `check:isolation` before the Phase 3 migration.
- Phase 3 end-to-end: call, ask for a worksheet, hang up, see it arrive by
  MMS and appear in web chat.

## 9. Issue mapping

Tracker: **#287**.

| Phase | Issue | State |
|---|---|---|
| 1 | **#285** | The `--status` footgun. Ship first. |
| 1 | **#278** | Make the phone remember. **Closes #171.** |
| 1 | **#281** | Attach the file to the text. **Closes #187.** |
| 1 | **#276** | The phone's rules become a file. |
| 1 | **#283** | In-app voice v1 via the existing call button. |
| 2 | **#275** | The three numbers. |
| 3 | **#280** | One door into Homa. |
| 3 | **#279** | SIP inbound, test number. |
| 3 | **#282** | Cut the live number over. |
| 3 | **#286** | Voice casting. Founder. |
| closed | **#277** | Half shipped in CI already, half unnecessary. |
| closed | **#284** | Mobile. Nothing to spec until Phase 3 lands. |

Also touched: **#252** (do not repeat unattributed spend: `UsageChannel` gains
`voice` in Phase 1), **#264** (the voice-calendar law retires when the phone
genuinely gains calendar tools, which is Phase 3), **#197** (draft-stranded
materials, adjacent to Phase 1 item 3).
