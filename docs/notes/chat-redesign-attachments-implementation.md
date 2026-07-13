# Chat redesign + attachments: implementation notes

Build started 2026-07-13 ~2:30 AM, from the approved refined design
(`docs/homa-planning/plans/2026-07-13-chat-refined.html`) and its build
order. Founder calls locked: keep tape corners, keep handwritten photo
captions (Caveat), compact one-line day header ("Tuesday · July 14"),
keep the seconds count on the worked-for line.

Entry types: Plan-confirmed · Discovery · Deviation · Todo for human.

---

## 2026-07-13 02:35 · Discovery: eve channel needs no change for attachments

The plan said "agent/channels/eve.ts stops stripping non-text parts and
forwards image and file parts to the model." Reading eve's channel
types (`eve/dist/src/public/channels/eve.d.ts`): `onMessage` only
CHOOSES auth and prepends context; the inbound message dispatches
as-is. The web channel never stripped parts from the dispatched
message, it only extracts text for continuity matching, which is still
correct with markers in the text part. `useEveAgent().send` accepts
`{ message: string | UserContent }` natively (SendTurnPayload). So the
web client can send AI SDK parts today; normalization must happen
client-side BEFORE send (the channel cannot rewrite the message), which
means a prepare step at upload time, mirroring what telnyx.ts does
webhook-side. eve's default upload policy (25MB, all types) only
inspects file parts with inline bytes; URL-payload parts pass through,
which is what we send.

## 2026-07-13 02:40 · Deviation: PDFs ride as URLs, not downloaded bytes

Plan (from SMS parity) assumed PDFs download to base64 file parts. SMS
does that because Telnyx media URLs are ephemeral and need bearer auth.
Chat uploads live at stable public Vercel Blob URLs, so the part can
carry the URL string and the provider fetches it directly; no 4MB MMS
cap applies, no giant base64 through the send body. Conservative
choice: URL parts for chat photos and PDFs (strings, not URL objects,
so JSON serialization through eve session storage cannot flatten them);
SMS keeps its byte lanes untouched. Revisit: none needed unless a
provider rejects URL documents.

## 2026-07-13 02:45 · Decision record: marker format carries the URL

`conversation_messages` is text-only (8000-char cap). SMS leaves
`[Photo attached: caption]` markers so photos exist in the durable
record. Web scrollback must RE-RENDER photos, so web markers carry the
blob URL too. One shared module (`lib/attachments/markers.ts`) owns the
format both ways (compose at send, parse at render):

    [Photo attached · <caption> · <url>]
    [File attached · <name> · <url>]

The bubble renderer strips marker lines from the visible text and
renders the parsed photos as polaroids and files as chips; the model
and recall see the full marker text. SMS marker formats stay untouched
(no URL: theirs expire).

## 2026-07-13 02:55 · Discovery: eve summarizes parts sends into the durable text

`createMessageReceivedEvent` (eve protocol) folds a `UserContent` send
into one string: text parts joined by newlines, plus `[image: <type>]`
and `[file: <name> (<type>)]` placeholders per media part. That string
is what the persist hook stores AND what the client reducer renders as
the user message. Consequences: (1) markers written into the text part
persist for free, (2) the renderer must strip eve's placeholder lines
too, (3) turn recovery's sent-text matching must compare against that
summary, so the client mirrors the summarize function when it sends
parts.

## 2026-07-13 03:00 · Discovery: plain https strings are legal part payloads

ai@7 treats a string starting with `http` as a URL for both
`ImagePart.image` and `FilePart.data` (dist check, line 11709). So web
parts carry plain URL strings, which survive JSON serialization; `new
URL(...)` objects (what SMS uses in-process) would flatten to `{}` over
the wire and are avoided.

## 2026-07-13 03:05 · Deviation: sms-attachments.ts stays untouched

Plan said "generalize lib/voice/sms-attachments.ts to accept Blob
URLs". The truly shared machinery is one layer lower and already
importable: captionSmsImage (takes any URL or bytes), transcribeAudio,
describeVideoBytes, mammoth, SheetJS. A new chat-side normalizer
(lib/attachments/) composes those directly; the SMS module keeps its
Telnyx-download glue and zero regression risk two hours into a launch
week. Revisit: if a third channel ever needs lanes, extract a shared
lanes module then.

## 2026-07-13 03:20 · Plan-confirmed: storage layer live

Migration #80 (chat_attachments) applied to production via MCP
(additive-only, allowed to lead). Isolation guard extended with
anon-denied, cross-family read, and write-denied probes for the new
table; full guard green. /api/chat/upload (Blob token, per-type caps)
and /api/chat/attachments (prepare + undo) in place.

## 2026-07-13 03:40 · Deviation: the queue stays text-only

Plan implied attachments participate in the send queue. The queue
flushes multiple entries as ONE joined text message, which cannot carry
parts, and reworking the queue mid-build risks the never-stuck
guarantees. Conservative choice: while a turn runs, Send holds staged
files (a quiet line says "Your files go out when Homa finishes this
reply"); text-only sends still queue exactly as before. Revisit: parts
support in QueuedChatMessage.

## 2026-07-13 03:50 · Deviation: receipts and turn seconds are live-session state

Receipts ("Photo saved in Maya's binder" + Undo) key off the sent
message's summary text in client state; the worked-for seconds map keys
off live message ids. Neither survives a reload: scrollback shows
photos and files (markers carry the URL) but no receipt chips, and
restored worked-for lines read "Worked on it" without a count. Same
undo-window shape progress cards already have. Revisit: persist
receipt ids in a marker extension if reload-surviving undo matters.

## 2026-07-13 04:00 · Deviation: chain steps ship labels, sparse findings

The refined mock showed per-step findings and evidence chips. Tool
outputs mostly lack safe one-line summaries today, so v1 ships
past-tense labels plus findings only where the output carries one
(printable title, loaded skill name, recall count). Unmapped tools fall
back to "Worked on it". Revisit: a per-tool summary field in outputs.

## 2026-07-13 04:10 · Deviation: snap card stages, never auto-sends

Mock implied snapping the page sends it. House law (nothing sends until
she sends) wins: the camera stages the photo in the composer and the
card says so ("The photo goes into the message box below"). The full
dim rule landed exactly as specified: history dims only while a snap
card is the live ask. The mock's slim composer variant was dropped, the
standard composer stays during the ask (smallest surface; the dim is
the signal). Todo for human: auto-send after capture, if staging feels
like one tap too many in real use.

## 2026-07-13 04:15 · Discovery: web drops SMS's BMP lane on purpose

SMS converts carrier-legal BMP images to PNG. Web file pickers and
cameras produce JPEG/PNG/HEIC (HEIC re-encodes to JPEG in the browser
downscale step), so the chat normalizer takes the failure-note lane for
BMP instead of the sharp conversion. The picker accepts image/* so a
hand-picked BMP degrades gracefully, never silently.

## 2026-07-13 04:30 · Plan-confirmed: copy gates ran

All new strings went through homa-copy-editor (reader-gate reactions
were collected on the mocks earlier). 7 must-fixes implemented: failed
chips say "Didn't attach" (names the failure), remove buttons say
"Remove this photo/file" (never a kid's name), note vocabulary unified
(Noted that / Removed a note / Searched my notes / Saved research
notes), the snap helper line lost its personification and unnamed
referent, "Add a caption…" replaced "Add a note about this…", and the
attach error gained its settle-the-nerves beat.

## 2026-07-13 04:40 · Discovery: a concurrent session broke unrelated typecheck

Mid-build, packages/core/src/map/scoring.ts and several progress and
tasks files changed underneath this session (the trajectory-chart
work). Its SubjectScore change added required fields, breaking three of
its own files (progress-view.fixture.ts, report-snapshot.test.tsx,
map-model.test.ts). Not touched here: this build's files typecheck
clean, and the trajectory session owns those fixtures. Whoever merges
first should re-run the full suite.

## 2026-07-13 04:50 · Discovery: a concurrent session committed around this build

While this build ran, another session committed the child-photos,
founder-deep-view, tasks, and trajectory work from the same working
tree, and its commit carried this build's events.ts registry entry
early, parked in the guard's STAGED_EVENTS shim ("until its in-flight
emitter lands"). The emitter now exists, so the shim entry is removed
and check:events is green again. The working tree still holds that
session's in-progress trajectory change, whose OWN files fail repo
typecheck (progress-view.fixture.ts, report-snapshot.test.tsx,
map-model.test.ts) and lint (trajectory-chart.tsx, react-hooks/purity).
Nothing in this build touches those files.

## Todo for human: rescreen the built UI, then commit and deploy

The refined design's build order ends with a reader-gate rescreen on
the BUILT surface and a deploy watched to READY. Screens need an
authenticated session with fixture data, which this environment does
not have. No commit was made: the shared tree carries another session's
red WIP, and committing or deploying now would entangle it. Migration
#80 is already applied and additive, so production is unaffected until
this code ships. Blocked on: founder look (or demo credentials), then
commit this build's files and deploy.

## Closing: what attempt #2 should know

- eve's channel cannot rewrite an inbound message; any attachment
  normalization for a browser channel must happen in a route BEFORE
  send. Design servers-side prepare steps first, not channel hooks.
- eve summarizes parts sends into text (markers + placeholders), which
  is what persistence, continuity, recovery matching, and the reducer
  all see. Any new part type needs its marker story decided up front.
- Plain https strings are the only part payloads that survive the
  browser-to-eve JSON trip; new URL() works only in-process (SMS).
- The isolation guard requires explicit coverage for every new public
  table; budget the fixture plumbing with the migration, not after.
- Repo tests are explicit file lists in root package.json, not globs; a
  new .test.ts runs nowhere until wired in (markers.test.ts runs ad hoc,
  wire it into a check list when one fits).
