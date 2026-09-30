# Conversation rebuild council

September 12, 2026. Companion to [One continuing conversation with Homa](2026-09-12-conversation-rebuild-plan.md). Three AI subagent seats conducted two review rounds, including six simulated parent situations. No interviews or implementation changes occurred. This records challenges, not customer approval votes.

The central requirement is that a parent can return to both the conversation and the work it produced. Saving words alone does not preserve a worksheet, a pending request, the meaning of “that one,” or confidence that a calendar change happened once.

## Evidence before role-play

The [persistence audit](2026-09-12-chat-persistence-audit.md) records repository findings and synthetic reproductions. Defects remain OPEN under [#1182](https://github.com/sidneyswift/homa/issues/1182). This council does not establish production incidence.

Historical parent evidence supplied the following questions:

| Source, checked in the worktree | What it establishes and what it does not |
| --- | --- |
| [July 25 raw feedback](../journeys/evidence/raw/2026-07-25-carolyng-whatsapp-feedback.md), lines 21-28 and 41-53 | A co-founder reported missing typed responses, switched to another assistant, liked phone/email, lost track of an unfinished plan after changing topics, and found web chat unaware of phone work. These are historical complaints. The source explicitly does not establish whether the missing responses were storage loss or delayed display. |
| [September feedback review](2026-09-05-cofounder-feedback-review.md), F02, lines 126-136 | Later minutes lost earlier identifying book/lesson context. **The review records the bounded repair FIXED through PR #1130.** It motivates a regression journey, not a newly open defect. |
| Same review, F03, lines 142-148 | Distinct activities with matching durations were suppressed as duplicates. **The review records the bounded repair FIXED through PR #1130.** Preserve the distinction between a repeated delivery and a new similar activity. |
| [Historical personas](../journeys/01-personas-jtbd.md), lines 3-7 and 19-39 | The source labels invented demographics, assumptions and quotes. It is a hypothesis set, not a validated segment map. |
| [Product brief](../00-product-brief.md), lines 108-111 | Capture-now and first-class parent voice originated in actual usage. This is historical intent, not authority for replacing current storage policy. |

Current constraints were checked separately: [founder rulings](../journeys/10-reconciliation.md), lines 125, 153, 167, 209, 216 and 219 cover unfinished plans, transcript retention, adult privacy, dispatched voice work and material versions. [Design doctrine](../../homa-design/doctrine.md), lines 83-100, requires accessible focus, interruption handling and immediate critical exits. The council does not reopen those policies by role-playing a different preference.

## Three council seats

| Seat | Independent challenge |
| --- | --- |
| Data architecture, distributed systems and privacy (`conversation_data_council`) | Can data disappear, duplicate, reorder, expose private revisions, or escape catch-up? Can old clients and backfill coexist with new writes? |
| Voice/mobile reliability, accessibility and client experience (`conversation_experience_council`) | Do controls match microphone, playback and work states? Can the parent type, stop, leave and recover without operating the infrastructure? |
| Simulated parent panel (`conversation_parent_council`) | Do guarantees survive interrupted teaching, several devices, poor connectivity, shared devices and assistive technology? Which steps consume the time Homa should save? |

Each seat examined findings, then challenged the draft. The parent seat used these six situations; no scores or fabricated consensus were generated.

## Six simulated situations

| Situation | Objection used to test the plan | Required experience |
| --- | --- | --- |
| Experienced parent with several children | Saving cannot become another supervised task. | Speak, help a child, lock the phone, return. Acknowledged words and accepted work survive without a closing ritual. |
| Overwhelmed newcomer | A friendly acknowledgement sounds like completion. | “I will make it” remains connected to working, ready or failed status. Returning finds the actual result or unfinished work, without a new dashboard. |
| Working parent moving between devices | Different screens cannot contain different versions of the relationship. | Phone, laptop and stale tab catch up. A typed clarification targets the intended work. Reading position stays stable. |
| Parent with unreliable internet | Uncertainty causes repetition, which can cause duplicate actions. | Preserve pending content; distinguish received requests from local drafts; reconcile uncertain results before retrying; avoid executing stale instructions on reconnect. |
| Parent sharing a tablet | Persistence can become a privacy failure. | Logout is easy. Another adult sees no previous transcript, draft or private search result, while permitted shared materials remain available. |
| Parent using assistive technology | Fading, moving or repeatedly announced content can become unreadable. | Stable focus and scroll, bounded announcements, meaningful non-color states and immediately reachable Stop at enlarged text sizes. |

These situations identify failures; they do not establish prevalence or buying intent.

## Round one: changes to the initial direction

| Challenge | Adopted requirement in the plan | Verification |
| --- | --- | --- |
| One visual thread can conceal two competing assistants. | Voice and text share one authenticated acceptance boundary and durable request identity. Context includes authorized current work and artifact referents. | Alternate speech, typing and files; continue tomorrow; clarify between two plausible artifacts. |
| A single changing icon can remove Stop when the parent types. | Keep the normal mic/send/stop control; temporarily expose both Send and Stop when voice and a draft coexist. | Type during speech and upload; stop without clearing or accidentally sending the draft. |
| A saved transcript does not prove an action happened. | Separate transcript persistence, request acceptance and work completion. Captions never directly replay tools. | Lose acknowledgements and retry; verify one acceptance and the original domain receipt. |
| Closing voice can orphan work or retain the microphone. | Release capture/playback immediately, drain only already-captured events, and keep accepted work connected to its receipt. | Stop during generation; reopen elsewhere; verify mic release independently of worksheet completion. |
| Permanent history can still feel forgetful. | Persist structured request/result references independently of runtime sessions and summaries. | “Make that harder” after topic changes and session rotation resolves the correct version or asks once. |
| Storage convenience can violate later intent. | Recover accepted work automatically; restore genuinely unaccepted requests for review after leaving/reloading. | Compare an offline observation with an outdated calendar request. |

## Round two: contract and journey corrections

The draft made the direction concrete enough to reveal these additional requirements. They are accepted planning changes, not implemented fixes.

- **Separate acknowledgement types.** A casual transcript checkpoint has no executed request. Give it a transcript acknowledgement; accepted requests have a request acknowledgement. A receipt's committed change token cannot advance the client's applied cursor over missing messages.
- **Make catch-up commit-safe.** Transactional conversation changes, consistent snapshot boundaries and atomic client apply/cursor updates prevent an allocated-but-uncommitted change being skipped. Deterministic backfill placement is separate from synchronization sequence; test older-history browsing during backfill and live writes.
- **Pin recipient visibility to delivered content.** Addressing another adult an earlier revision does not authorize every later revision. Retain a delivered snapshot or authorized revision, recheck current access when replaying changes, and make revocation explicit. Multiple deliveries enrich one entry rather than duplicate bubbles.
- **Prove voice event boundaries.** Speech-onset and finality signals, not just provider replay, need adapter evidence. Checkpoint while alive, retain a durable queue, and resume on return. No browser-kill guarantee: the system cannot identify words it never received.
- **Test Stop before connection completes.** A delayed permission success must not start capture after cancellation. Cover keyboard and screen-reader operation as well as touch.
- **Preserve immutable corrected intentions.** A later child/date correction is a new linked request. It cannot rewrite the original action's evidence or claim to cancel an already completed effect.
- **Qualify old-file recovery.** Material policy permits reclaiming large print files and rebuilding an older version from source. Preserve delivered identity and preview; do not promise the original PDF bytes are retained forever.
- **Split early repairs from foundational work.** Separable history/reader fixes can ship first. Full pending-send and voice revision durability must use the common foundation, not a temporary second outbox. Existing-account pilots need older-history paging too.

Tests cover assistant-first greetings, stale membership, expired cursors and revised approvals. Immediate restart keeps late transcripts/results attached to the old session, never spoken into the new one. Suppress screen-reader announcements while Homa speaks audibly; captions remain readable. Surveys cannot certify these invariants.

## Remaining tensions

**Founder decision after review, September 12: send automatically.** Sidney answered “send auto” when asked about a request sent offline, closing Homa and returning the next day. This supersedes the council's review-before-dispatch recommendation above; the round-one row remains historical provenance. Queued requests send automatically when the authenticated client reconnects, while same-intent retries recover any existing receipt. Special delayed-date handling was subsequently deferred by the founder; see `conversation-delayed-dates-deferred`. Canonical ruling: `conversation-offline-auto-send`.

**Founder decision after review, September 12: voice keeps going when switching apps.** Sidney chose continued listening and talking over pausing. Canonical ruling: `conversation-voice-app-switch-continues`. Device support still needs physical evidence; phone calls, screen lock, permission loss and Bluetooth changes remain distinct interruption cases. Generic blur also includes permission/file dialogs and is not a stop trigger. Explicitly stopped microphones do not automatically restart. No new notification subscription or automatic work cancellation is implied.

**Founder decision after review, September 12: typing keeps voice going too.** Sidney selected simultaneous voice and text. The Stop+Send exception preserves both abilities and keeps microphone shutdown reachable. Ending voice merely because typing starts is no longer an open alternative. Canonical ruling: `conversation-voice-typing-continues`.

Founder-selected presentation: normal recording is invisible; only actual recording/delivery failures produce actionable notices. Unfinished work appears through compact existing receipts. Privacy warnings must still offer immediate logout rather than trapping the parent with unsent text.

**Founder decision after review, September 12: return to the newest message.** This supersedes restoring an older reading position on return. Preserve active reading against incoming-message jumps, but reopening/returning starts at the latest. Canonical ruling: `conversation-return-newest`.

**Founder scope decision after review, September 12: skip special delayed-date handling.** Sidney called the days-late “tomorrow” example too much of an edge case. Exclude its specialized interpretation/clarification workflow from the initial rebuild, rather than holding the core persistence work for it. Ordinary timestamps and existing date checks remain. Canonical ruling: `conversation-delayed-dates-deferred`.

**Founder requirement after review, September 12: every conversation token is recorded continuously on the server.** Canonical ruling: `conversation-continuous-server-recording`. Recording belongs to infrastructure, never a model choice or an occasional save operation. The plan now requires a lossless content stream with canonical message projections, durable-before-publish assistant text, and server-owned voice observation/relay proven independently of browser lifetime. Earlier checkpoint cadence and lossy provisional-snapshot proposals are superseded. Optimize batching without dropping content. Unsubmitted drafts, genuinely disconnected client data and provider-unexposed audio retain honest boundaries; no raw-audio or hidden-reasoning archive is introduced. Revalidate the baseline schedule after proving the stream path.

A focused follow-up architecture review (`continuous_recording_contract_review`) confirmed six required changes: infrastructure ownership, durable-before-publish text, lossless event retention, server-owned voice observation, truthful offline handling, and stronger crash/publication gates. These were incorporated into the revised plan. The review specifically rejected using “zero lost acknowledged messages” alone, since that could still allow visible but unacknowledged words to disappear. This is design review evidence, not runtime certification.

## Validation that can change the plan

Recruit actual parents across these situations using consented sandbox journeys and fictional child details. Ask what they expect after Send, Stop, refresh and return on another device before explaining the design. Observe recovery from an intentionally dropped connection, a delayed caption, an ambiguous reference and an unfinished worksheet. Revisit later so retrieval is tested beyond fresh memory.

Inspect persisted messages, authorized result links and action receipts alongside observed behavior. Any published assistant text without a prior durable record, unaccounted provider-exposed conversation text event, lost acknowledged message, duplicate accepted operation, privacy disclosure or misunderstood active microphone blocks release until repaired and retested. Usability sessions identify confusion; fault tests establish correctness. Neither synthetic personas nor a small qualitative sample establishes prevalence or market demand.

## Feedback to copy

- Keep Send and Stop available together while I am talking and typing.
- Automatically send queued requests when I return; recover accepted work without duplication.
- Show me the provider recovery, exact acceptance contract and real-parent observations before implementing the rebuild.
