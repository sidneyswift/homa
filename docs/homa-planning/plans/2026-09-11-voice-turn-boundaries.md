# Voice turn boundaries and continued replies

Source: founder production test on September 11, gh#1152. The current task is
01a08eeb-72b2-7ae2-ada2-e2b8978eac43, owned by Codex. Branch:
`codex/gh-1152-voice-turns`. Checkout:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11`.

## Observed failure and rival explanations

Confirmed: `LiveVoiceConversation` previously kept one unsealed parent row until
a backend delegation. Normal assistant replies could never divide subsequent
parent speech. The screenshot's growing earlier bubble follows directly.

Confirmed: delegation source selection used to wait behind a running backend
request. A typed request could seal the queued spoken source, allowing later
speech to replace it before the queued request ran. Capturing the immutable source promptly removes that race.

Suspected contributor to silence: the Live prompt globally said to speak only
the backend-supplied answer while also allowing casual conversation. The revised
instruction applies waiting to that task and explicitly continues conversational
replies and delegates short answers to backend clarification questions.

Separate possibility: audio transport or model behavior can stall while captions
continue. A screenshot does not establish that mechanism, and fixing caption
rows alone does not prove all intermittent audio silence is resolved.

## Implementation

Caption rows now use session timeline intervals for each speaker independently.
A non-overlapping reply separates later speech; overlap stays in the ongoing row.
Parent grouping also requires a one-second gap between their fragments, keeping
brief acknowledgments from splitting the tail of a sentence. This is a display
heuristic, never a semantic turn-completion or action trigger.
Late fragments can revise an unfrozen earlier row, including splitting two
utterances when their intervening reply arrives late. Display boundaries never
start work. After delegation freezes a source, late older fragments remain
transcript history and cannot authorize another action. A resumed audio session
has a new timestamp generation.

Delegation captures the latest new parent utterance after the bounded transcript
skew window, before waiting for earlier backend work. Backend execution remains
serial so the next request receives the preceding Eve session state. Timestamp
cutoffs exclude later corrections. Immutable transcript persistence and the
existing authenticated bridge remain unchanged. No prior transcript is exported
to a replacement OpenAI session.

## Validation

Focused cases include ordinary exchanges, overlapping acknowledgments, late
input and output delivery, request cutoffs, duplicate delegation, queued source
capture, closed sessions, reconnect clock resets, and immutable-save failure.
Full voice, native compatibility, typecheck, and release evidence are recorded
on gh#1152 as checks finish.

A local browser harness uses the actual web VoiceMode and GPT Live / Gleam,
synthetic speech, and a held synthetic backend response. It exercises greeting,
casual reply, delegated work, a check-in while work remains pending, and a delayed
result. It makes no real family writes. Physical-device listening and the exact
reported long production conversation are distinct from this test.

Protocol basis: [OpenAI session management](https://developers.openai.com/api/docs/guides/live-conversations)
and [client delegation](https://developers.openai.com/api/docs/guides/live-delegation).
The provider supplies timestamped fragments, not authoritative completed turns;
caption grouping is application presentation and backend state is separate.
