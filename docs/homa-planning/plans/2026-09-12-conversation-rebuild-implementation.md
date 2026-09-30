# Conversation rebuild implementation evidence

September 13, 2026, 16:12 UTC checkpoint. Owner: Codex. Branch: `codex/gh-1158-generative-workspace`. Worktree: `.claude/worktrees/homa-audit-cleanup-424b11`. Tracking: [#1158](https://github.com/sidneyswift/homa/issues/1158), [#1182](https://github.com/sidneyswift/homa/issues/1182).

The founder authorized implementing the [plan](2026-09-12-conversation-rebuild-plan.md). This is a partial local implementation and Phase 0 evidence, not a completed rebuild or production release. No migration has been applied remotely. No production fix is marked shipped.

## Current implementation checkpoint

This section supersedes incomplete-work statements in the historical checkpoints
below. New behavior remains disabled; no remote migration, CI result, production
release, physical-device voice certification, or canary is claimed.

Completed local slices now include committed request acceptance, automatic device
outbox delivery, account-scoped drafts and staged file bytes, continuous durable
Eve source consumption and lossless text projection, paged history with committed
change cursors, deleted-record fencing, ordinary question choices and freeform
replies, native pending-input admission, private immutable tool-operation receipts,
prospective exact recipient delivery snapshots, and a durable search-index queue.
The mounted v2 composer uses the new acceptance and history readers only when its
rollout gates are enabled. It retains accepted optimistic messages until their
canonical rows arrive, and preserves rejected words for recovery.

Current browser evidence covers offline Send, refresh, two tabs, sign-out and
account switches, staged files, question answers, history reading position and
screen-reader announcements. It uses actual mounted product controls and IndexedDB,
with synthetic authentication and backend responses. This is not a live-provider,
real-account, or native mobile certification.

Native cards now use the unified paged feed, including restored exact answer
labels and free text. Rejected native answers retain their original question
identity rather than becoming a new ordinary chat message. The separate polling
reader was removed.

Private foreground-to-background job linkage, current-adult execution fencing,
and result delivery are implemented locally for bounded standalone materials.
The complete brief lives in server-only conversation storage, not the legacy
family-readable job plan. The next foreground request can run while that material
is made. Artifact linkage, stage completion and job completion commit together;
source deletion and membership changes fence late results. Optional quoted parent
words must exactly match the accepted message. Calibration, quality and workflow
choices remain in the materials-studio skill. No real provider build is certified.

The device cache can restore an offline queue after refreshing, but a fresh server
access check remains mandatory before delivery. Recorded-source pickup performs
up to three bounded passes while active to cover more of the minute between
scheduled sweeps. Live source-to-visible latency has not been measured.

Native input recovery is now installed and locally verified after explicit founder
approval. The same-version Eve 0.19.0 patch preserves each queued answer envelope
and its key, invokes the authenticated delivery guard before consuming an input,
and checkpoints seen keys with the runtime state. Identical retries cannot consume
a later question; changed payloads are rejected. Expired, unclaimed native delivery
can retry the same lease and original route; already claimed execution stays fenced.
Runtime-marked child questions include exact parent coordinates, so delayed events
cannot alter completed requests or newer replies. See the [installed patch evidence](2026-09-12-native-replay-approval.md).
A real local host hard-restart regression now passes and is wired into CI.
Explicit recovery of an interrupted step also succeeded in an exploratory probe,
but default local restart did not automatically resume that step. Automatic
interrupted-work recovery and deployed-host proof remain enablement gates.
The voice decision still blocks the full recording architecture.

The voice decision remains unanswered: the current live voice can emit audio
before transcript words. A voice spoken from committed replies can meet the new
recording boundary but changes her sound. The user has not approved that switch.
The legacy browser voice path is not certified as continuous server recording.

Final local checks at this checkpoint:

- Full four-suite PostgreSQL command passed. Each fresh cluster applied 210
  migrations. Core request/recording, attachments, combined feed storage (49 tests)
  and native-input suites completed. The final linked-job suite separately passed
  seven tests, including the source-delete/completion race.
- Conversation storage unit suite: 157 passed, one intentional database-only skip.
  Installed tool-call identity and native answer guards passed; eight installed
  queue/envelope tests passed. Core and native 210-migration PostgreSQL suites
  were rerun after integration, including delayed proxy attribution cases.
- Continuity: 289 passed. Tool deadline and trace checks: 27 passed.
- Device browser: 10 passed. Mounted product controls: 10 passed, with the final
  native-feed and rejection cases rerun after integration. These use synthetic
  authentication/backend replies, not a live family or provider.
- Web typecheck, changed-web-file lint, migration uniqueness, fleet-skill hygiene,
  Vercel-target Eve build and three built stream-duration checks passed. The local
  build skipped sandbox template provisioning without a deployment ID; do not
  publish this local build as a prebuilt deployment.

The full isolation guard also passed. New server-only stores remain absent remotely
and are reported pending, with their candidate schema tested in disposable PostgreSQL.

Counts overlap across suites and must not be added together. The final real-model workflow check passed all three synthetic cases: an eligible
worksheet starts one background job with preserved constraints and an exact quote;
missing reading-level evidence asks for calibration without building; reopening
saved work uses find/show without a new job. An earlier run exposed foreground
building caused by the old multi-week-only tool description. The tool routing and
skill handoff were corrected, then the same three cases passed. Tool receipts in
this model harness are simulated and cannot create or deliver real materials.
Historical checks remain dated evidence, not proof of newer edits.

Outstanding release work includes automatic interrupted-work recovery and deployed workflow-host proof; the server-owned voice decision and implementation; real provider and
physical-device/background journeys; existing-user migration/shadow verification;
measured latency, canary and eventual /app cutover. General reconciliation of
uncertain external effects is not solved by the local operation receipt table.


## September 13, 2026, 16:12 UTC: real local host restart

`pnpm test:conversation-host:restart` passed against the installed Eve development host, with a deterministic model and a synthetic channel. The test creates its own temporary directory, local port and credential-free process environment. It waits for persisted question and completed workflow-step records, sends the first answer, waits for the second question, kills the complete owned host process group with SIGKILL, and starts the same host against the same local data directory. Retrying the first answer is dropped. The second question remains unanswered until its own answer arrives, and the final reply contains exactly the first Yes and second No once. The reusable test is wired into CI; no remote CI run is claimed.

A separate exploratory process-kill test interrupted the answer before its step checkpoint. Default local restart plus retry left that child run marked running without further progress during the probe. Installed source inspection found default local-world initialization does not invoke its recovery start method. Explicit `reenqueueRun` with the application queue namespace resumed the saved child; the queued duplicate was dropped, and the final reply again contained the exact two answers once. This establishes explicit local replay, not automatic startup recovery or deployed Vercel recovery. Initial requeue without the application namespace was rejected as an unhandled queue and did not resume work. No product recovery hook was installed.

The custom HTTP event-stream route returned a local socket error, so this test reads the actual persisted local stream records and completed checkpoints. It does not certify browser reconnect streaming, real authentication, live providers, external effects, automatic interrupted-work pickup or deployment recovery. Application authentication is covered separately by the database suite. The temporary server was stopped after verification. The portable fixture contains no test-only interruption hook or absolute temporary paths.

Local evidence: `scripts/eve-native-host-restart.test.mjs`, `scripts/fixtures/eve-native-host/`, `/private/tmp/homa-native-host-final-regression.log`, `/private/tmp/homa-native-midstep-receipt.json`. The exploratory run's disk files are temporary evidence, not a reusable test; the committed-checkpoint restart journey is the reusable regression.

## Historical implementation checkpoints

The sections below preserve the order of investigation and implementation. Read
them as evidence at their stated checkpoint, not as a current inventory.

## Implemented locally

- `/app2` loads the authenticated adult's existing server history. Refresh restored 50 existing messages and opened at the newest entry in the in-app browser. No synthetic message was sent to the real family.
- Unsubmitted text drafts use account-scoped IndexedDB storage. A synthetic draft survived refresh, then was cleared through the UI. Draft writes acknowledge transaction completion; a failed storage operation produces a specific notice.
- Voice and text appear in one chronological local display. Send and Stop are both reachable while voice and a draft coexist. This does not yet unify their model execution or give live voice durable recording.
- History deduplication requires matching session identity. A new session's `turn_0` cannot hide another session's `turn_0`.
- `/app` no longer adopts another tab's newer cursor without loading its missing messages. Server reconciliation compares the mounted reducer's events, not the other tab's cache. Full mounted-product cross-tab certification remains outstanding; the existing browser fixture tests cache/lock behavior only.
- Material query errors and thrown transport failures preserve healthy text history with `materialsUnavailable`. An unavailable material cannot erase the conversation.
- Canonical message persistence precedes search indexing. Index failures cannot undo that commit. Indexing still runs in the hook's awaited path; moving it to a durable indexing queue remains open.
- Canonical content is no longer trimmed or truncated at 8,000 characters. Terminal replacement keeps the original creation time. The additive constraint relaxation MUST precede deployment of these writers. The recording flag does not gate this schema prerequisite.

## Recording storage candidate, disconnected from live traffic

Migration `20260912180000_conversation_recording.sql` and `conversation-recording.ts` provide an adult-scoped, content-only event store with commit-ordered positions. The canonical message UUID remains the history identity. Raw event tables have no browser read/write grants.

The recorder requires the absolute source index from the durable Eve stream, including non-content events in that count. Do not substitute a hook-local counter, timestamp, string hash, offset or turn/step identity. Only conversation text is copied; raw audio, reasoning, tool arguments and authentication envelopes are excluded.

Access revocation is separate from erasure: current membership and a live family are required for writes; RLS requires current membership for reads. Family/adult record ownership survives membership removal and follows actual family/account deletion. Canonical deletion removes both linked and unlinked event copies by source identity and writes a content-free deletion marker to reject replay resurrection.

The first hook draft was removed after independent review reproduced a real identity collision. There is currently no hook or scheduled consumer feeding this candidate storage. `HOMA_CONVERSATION_RECORDING` is not enabled. Do not enable or describe this slice as continuous recording.

## Phase 0 findings that block enabling the new path

### Text event identity and replay

Installed Eve 0.19.0 documents durable session streams and reconnect by event index. Its hook declarations say hooks run after durable event recording. Channel adapter errors are caught and swallowed by the installed runtime, so a throwing channel callback is not a Postgres-before-publication gate.

The actual installed `emitStreamContent` emitted text, a provider tool call and more text within the same turn and step, resetting `messageSoFar`. Both text fragments had offset zero. The initial offset-based recording key collided. The regression now runs that actual emitter and proves all four text append/completion records have distinct source positions, including identical repeated words.

Required next implementation: an authenticated durable-source consumer with a committed source cursor, retry/backfill of missed copies, bounded lossless batches, deletion-aware projection and interrupted-message restoration. Persisting an event is not sufficient until its recovery and readable projection exist. Do not put a multi-query transaction in the critical path for every fragment without measuring latency.

### Voice transport

The current browser WebRTC connection is the primary Live transport. The [official Live sideband contract](https://developers.openai.com/api/reference/resources/live/sideband-websocket) explicitly does not replay earlier events on attachment. A recording connection that drops and reconnects cannot prove that it recovered every missed transcript event. A browser copy or Stop-time flush cannot close that gap.

The [primary WebSocket contract](https://developers.openai.com/api/reference/resources/live/primary-websocket) supports a backend connection carrying audio and control events. It is a candidate for a server-controlled relay, not evidence that replay, crash recovery or audio/transcript timing has already been solved. [Vercel WebSockets](https://vercel.com/docs/functions/websockets) remain bounded by function duration; reconnect can reach a different instance.

Required change: route voice through an authenticated server-owned transport and establish a durable recording boundary before output delivery, with a proven recovery contract. If the Live provider cannot supply the required recovery, evaluate a voice path whose spoken output is derived from already-recorded text. Voice behavior and latency must be measured before choosing or rolling out that replacement. No raw-audio archive is authorized or introduced.

### Request acceptance

Installed Eve explicitly does not provide a durable FIFO of incoming user messages. A continuation token resumes a session; it is not a request idempotency key. The current channel send implementation may fall back from failed delivery to starting a session. Therefore blind automatic retry cannot yet be enabled without risking duplicated work.

Required next implementation: caller intent identity, committed request receipt plus dispatch outbox, execution claiming before tools, and reconciliation of an uncertain dispatch result. Then connect the account-scoped client outbox and automatic reconnect sending. The storage boundary is now implemented and tested locally as described below. The authenticated HTTP adapter is now implemented behind a disabled rollout flag. A disabled dispatcher candidate now exists as described below. Safe effect recovery and end-to-end delivery remain unimplemented, not silently supplied by Eve.

## Continued implementation: acceptance and device queue

The earlier September 12 continuation added a tested storage boundary disconnected from live submission. The later HTTP/admission continuation is recorded below; no new path is enabled for parents.

`conversation-requests.ts` plus `20260912213000_conversation_requests.sql` commit the exact canonical user input, request receipt and queued dispatch state in one transaction. Repeating an intent returns the same request and canonical UUID; changing its text conflicts. Dispatch leases are fenced and expire only before execution. The winning runtime session/turn/sequence owns execution permanently. A timeout becomes `recovery_required`, never an automatic new execution. Claim validates the exact submitted text and rebinds the existing canonical UUID before the ordinary persistence hook can see it. Canonical creation time remains unchanged.

Membership removal rotates the adult record's access epoch and revokes queued/leased requests. Old clients cannot re-admit or claim them after rejoining. Access revocation preserves history. A trusted original runtime can still record an already-observed terminal outcome with its exact secret lease and runtime identity; it cannot regain read access or permission for new effects. Canonical deletion scrubs the request fingerprint and leaves a content-free intent tombstone. The earlier recorder also now creates a source tombstone when deletion precedes its first write. Bounded whole-transaction retries handle deletion/claim deadlocks without retrying external effects.

`conversation-local-store.ts` now supports an IndexedDB outbox separately from drafts. Explicit Send creates an immutable intent; device transaction order, rather than clock timestamps, orders submissions. Draft revision identity and prior-write fencing protect a newer identical draft. `useConversationDraft` partitions mounted memory by account and ignores the prior account when rendering.

The transport-independent delivery loop uses fresh, account-pinned authentication for each request. An uncertain response retains the same intent; a malformed receipt does not delete it. Permanent rejection is kept outside the active queue for correction, allowing later messages through. A deleted response removes content and leaves an intent marker. A valid changed server access epoch purges the obsolete pending generation; malformed access metadata pauses without deleting data. Account-discard and failed-message readers are available for the future UI coordinator. A bounded delivery pass reports `snapshot_drained`, not a claim that no other tab queued additional work.

### Remaining integration constraints

- Execution identity is not external-effect idempotency. Eve can replay an interrupted step. Tool operation receipts or provider idempotency must cover the crash after an effect but before its recorded result.
- The worker adapter must carry the accepted episode, canonical UUID and authenticated ownership through Eve setup before the ordinary persistence hook. It must expose committed acceptance in the eventual conversation change feed.
- Current leasing serializes unresolved requests and returns a structured blocked reason. Separate foreground turn admission from background operation ownership before connecting this policy to live UX; a worksheet must not prevent clarification or cancellation.
- A deletion prevents new dispatch/claims. It does not itself cancel an already-admitted tool effect. Effect admission must recheck authority, and uncertain in-flight work must be reconciled honestly.
- The composer still uses the existing direct Eve send. Attachment acceptance, enqueue/reconnect coordination, the new HTTP/account bootstrap adapter, failed-item UI and logout handling remain to be connected to the mounted composer. Logout must cancel/drain pending draft writes and clear mounted memory before disk purge. Do not enable automatic retry against the legacy send route.
- Continuous text-source copying, server-owned voice, timeline paging/change catch-up, migration/canary and physical-device certification remain open.

### New validation

- Disposable PostgreSQL applied all 200 migrations. Tests passed for concurrent duplicate acceptance, exact long Unicode, full rollback after failure between canonical insert and receipt, lease fencing, competing execution claims, same canonical UUID on normal-hook replay, immutable chronology, terminal-state monotonicity, wrong-adult access, browser write denial, revocation/rejoin, trusted outcome finalization, account erasure, delete-before-first-record and eight concurrent delete/claim races.
- Sixteen focused unit tests passed, including installed Eve emitter identity tests and the device delivery loop's lost confirmation, account switch, malformed metadata, rejection and concurrent enqueue cases.
- Three real Chromium fixture journeys passed: IndexedDB upgrade/reload/two-tab ordering and draft revision preservation; revoked/deleted content handling; and mounted React account switching followed by Send and reload. These exercise actual browser storage and the draft hook, not the full live product or a real microphone.
- Web typecheck, focused lint and migration-version checks passed. The tenant-isolation guard passed with explicit pending notices for the unpublished additive tables. That target check does not certify deployed v2 storage; the disposable database tests cover its candidate permissions.
- Reproducible commands: `pnpm check:conversation-storage`, `pnpm test:conversation-storage:postgres`, and `pnpm test:conversation-device:browser`. The browser configuration restricts discovery to the actual source fixture, excluding Eve build snapshots.

## Continued implementation: authenticated HTTP and pre-tool admission

The next continuation adds `/api/conversation/requests` with GET access/receipt lookup and POST text acceptance. The route returns 503 unless `HOMA_CONVERSATION_REQUESTS=1`; that flag is not enabled. Do not enable it until dispatch and readable answer recovery are connected and certified. No request worker or composer retry was silently enabled.

- `conversation-request-auth.ts` requires an exact bearer, verifies it with Supabase and queries the newest live membership using the same caller token. Cookies cannot substitute another login. Authentication infrastructure failures are retryable; membership query errors do not become an empty account.
- `conversation-request-route.ts` derives family/adult identity on the server. The supplied account string can only reject a mismatch, never choose authority. A strict text-only envelope rejects extra selectors and unsupported attachments. Actual streamed body bytes are limited to 1 MiB with explicit rejection, never truncation. Every response is private/no-store. Accepted text returns 202 after the existing database transaction; a replay returns 200 and the same receipt. Unknown commit outcomes return retryable 503 without transcript, token or database details.
- `conversation-http-transport.ts` bootstraps identity on every attempt, submits with that exact bearer, omits cookies, refuses redirects, and bounds each network wait. Ambiguous receipts, account/epoch changes and temporary errors preserve the device intent. An actual deleted result removes content; permanent text rejection retains it for correction. The transport is implemented but not mounted in the composer.
- `conversation-request-admission.ts` is called by the existing global `message.received` persistence hook before canonical persistence/model/tools. A root dispatcher envelope must use its dedicated authenticated channel and cannot take the voice/producer persistence skips. Parented internal work retains its existing lineage handling. The database claim supplies the accepted episode and canonical UUID; ordinary persistence must return that same UUID. Ordinary web input does not query request storage.

Independent review found the root persistence-skip bypass and it was corrected with a regression test. The council also verified two worker constraints in the installed Eve runtime: delivery can fall back to a new session, and multiple deliveries can coalesce under the latest auth. The first safe worker must use attempt-specific execution routing plus the database claim, not use a continuation token as request idempotency. A claim-once hook does not yet provide per-tool effect replay protection.

### Next worker boundary

A JWT-less background request cannot simply impersonate the web channel or join the existing family-pinned allowlist. It needs current adult membership, access epoch and claimed-execution validation before sensitive context/tools. The worker must keep those checks separate from the trusted ability to record an already-observed outcome after revocation. It must preserve billing/ownership behavior and permit foreground clarification while an independent background operation continues. No permission bypass has been added to make the candidate worker appear functional.

### HTTP/admission validation

- 54 focused tests passed across the new HTTP/auth/admission boundary, device transport, existing recording/request/outbox tests and family-context security. The real Supabase client adapter was exercised against intercepted synthetic HTTP responses. The lost-confirmation journey exercised the actual request handler and browser transport with a storage test double; it did not send a real family message or replace the earlier PostgreSQL transaction evidence.
- All 288 continuity regressions passed. Web typecheck and focused lint passed.
- Tenant-isolation preflight passed before the new membership query. Candidate table notices remain pending because migrations are unpublished.
- Eve's Vercel build passed again after the final root-envelope tightening. The stream-duration guard passed. Added the unit, disposable PostgreSQL and browser device journeys to CI; no remote CI run is claimed.
- No production code, flag or schema was changed. End-to-end sending, continuous voice recording, dispatcher execution and the remaining rebuild are not certified.

## Background worker candidate, disabled

The server pickup loop now discovers adults with queued work, takes an expiring lease, checks billing, and starts an attempt-specific Eve session with the exact accepted input. A one-minute Eve schedule supplies periodic pickup; `after` in the successful acceptance route adds a best-effort immediate wake-up. The wake-up uses the current deployment URL, never request Host/Origin or the public marketing URL. Local development requires an explicit loopback `HOMA_CONVERSATION_WORKER_ORIGIN`. Missing/failed wake-up cannot change acceptance. Hosted scheduler and deployment-protection behavior remain unverified.

`conversation-request-access.ts` validates the current adult, family, access epoch, lease and claimed runtime before family hydration and before authored tools. Root global `turn.started` preflight precedes dynamic instructions in installed Eve 0.19.0; the exact-text execution claim remains in `message.received`, before model/tools. Descendants must match their actual root lineage and use the admitted origin. Generic pinned-channel access was not widened. Authorization has its own bounded wait before entering the effect body, preventing a late permission result from starting a timed-out call.

`conversation-request-context.ts` supplies the most recent 24 authorized rows across runtime episodes using the existing bounded context renderer. It includes own visible history and confirmed recipient deliveries. It excludes queued inputs and unpublished outputs from unresolved requests, while allowing assistant updates already delivered during ongoing work. Context failure aborts the root preflight; a verified empty result cannot fall back to an unrelated episode. This improves the candidate text worker's context, not voice continuity or unbounded model memory.

Observed completion requires canonical assistant text from the same adult/session/turn. `turn.failed` and outer `session.failed` can mark the exact original execution for recovery, never redispatch it. Terminal completion cannot regress after a late failure. The worker preserves web reply guidance and child-framing validation. Routing identifiers hash the lease; raw execution credentials stay out of routing labels. Leasing before billing and rotating pickup age prevents a full page of blocked accounts from starving later adults.

Independent source review found and corrected the late-authorization start, billing starvation, raw lease routing exposure and confirmed-delivery context exclusion. The review did not execute a real family turn.

### Worker validation

- 61 conversation storage/auth/access/transport/worker tests passed, plus 45 existing access, deadline, family-context and web-guidance regressions. All 288 continuity tests passed. The tool-deadline guard passed with its 27 tests.
- Disposable PostgreSQL applied all 200 migrations. Tests prove exact input and retry identity, claim competition, before/after-claim permissions, revocation and erasure, same-adult output proof, monotonic outcomes, history across completed episodes, queued-input exclusion, separate adult privacy, recipient delivery, and pickup fairness beyond the ten-owner batch. Fixtures and cluster were removed.
- Web typecheck passed. Lint passed with four pre-existing unused-variable warnings outside these changes. Eve's Vercel-mode build passed; local sandbox templates are not provisioned, so this output is not a deployment artifact. No remote CI or release is claimed.
- The isolation preflight completed before this continuation's query changes using the configured project and temporary sandbox fixtures. A later bare rerun from this worktree stopped because it has no local environment file; it supplied no additional remote isolation evidence. New candidate-table behavior is covered by the disposable PostgreSQL suite, not production.

### Gates still preventing enablement

Do not enable `HOMA_CONVERSATION_REQUESTS` yet. The ordinary question-card recording and completion slice below now supports a subsequent ordinary message. Validated choice submission with explicit reply context and real pending input/authorization continuation remain open. The parked marker still prevents false completion for actual runtime input/authorization and has no resume flow. The winning Eve step can still repeat a tool effect on replay, so operation receipts and uncertain-effect reconciliation remain necessary. A durable source consumer must recover lost outcome callbacks and feed the permanent conversation projection before mounting the new composer transport. Continuous server-owned voice recording is still unimplemented. No Save UI was removed to conceal that gap.

## Ordinary question cards, local candidate

The new `20260912223000_conversation_question_cards.sql` migration stores validated public question cards separately from tool notes and arbitrary tool output. The global `action.result` hook records only a confirmed successful `ask_user_questions` result. Card payload and a readable canonical assistant message commit together. The canonical message retains the original runtime session for adult provenance and uses its own `question-card:<UUID>` turn segment to avoid overwriting normal assistant text. Runtime operations must use the real turn on the request, never that canonical segment.

Source identity includes the original claimed request/session/turn, turn sequence and call ID; step index is bound into replay validation. Installed Eve's action sequence is the turn sequence, not an event counter. Mismatched sequence, changed payload/step, wrong execution and deleted replay fail closed. Exact concurrent replays return one card and one canonical message. The database also requires an object payload so accidental double serialization fails at write time.

A completed card-only turn becomes `awaiting_parent`, rather than a missing-text failure. A later ordinary message gets its own accepted request and marks the earlier question `continued`, never `answered`. A message queued before the card finishes is released after completion. The original execution owner is unchanged, and its tools lose permission after the turn ends. Recorded cards are excluded from worker context until the ending is observed. The authenticated GET questions response is account/epoch scoped, private and uncached; it restores the most recent 24 available card payloads. It is not a mounted customer card interface or an unbounded history feed.

Deletion removes the question payload and leaves only source identity sufficient to reject replay. An erased confirmed card still proves an observed ending without restoring choices or blocking the next request. Trusted finalization uses the exact original execution and lease but does not require current membership, create records or grant new access. Revoked adults cannot read or write cards; rejoining cannot recover old interactive choices into the new access generation. Late failure events cannot regress a waiting/continued receipt.

Independent council review caught and verified fixes for post-revocation finalization, deletion before card-only completion and incorrect turn-sequence assumptions. Database tests additionally caught JSON double serialization and the existing provenance guard clearing ownership when a card was incorrectly put in a separate session. Both were corrected without weakening the guard.

### Card validation

- 65 conversation storage/auth/access/worker/transport unit tests passed. The parser was rerun after the final source-string validation change. All 288 continuity regressions passed.
- Disposable PostgreSQL applies all 201 migrations. Coverage adds transactional rollback, eight concurrent card replays, immutable source identity, exact ownership, card-only completion, context visibility, late failures, next-message admission, early queued replies, payload erasure/replay, browser denial, access epochs, and endings after revocation. The real `action.result` and `turn.completed` hook handlers are exercised with synthetic runtime envelopes against this database. This is not a real provider turn or browser card journey.
- Web typecheck passed; lint passed with four existing warnings outside these changes. Eve's Vercel-mode build and all three stream-duration checks passed. Migration uniqueness and its nine tests passed.
- Tenant-isolation preflight passed before schema/query work. A later full guard encountered two HTTP 504 responses on unrelated anonymous reads; the repeat passed all checks and cleaned up its temporary fixtures. All v2 tables remain explicitly pending on the remote target. No migration was applied remotely and no remote CI/deploy is claimed.

### Separate continuation work still required

`ask_user_questions` emits a normal tool result and expects a new message. Native `ask_question`, tool approval and OAuth authorization actually pause the runtime. The installed runtime accepts invalid choice IDs and can clear a non-approval question when a stale response ID is submitted; the council verified this with a pure installed-module probe. A nonempty `inputResponses` batch avoids the channel's new-session fallback, but still needs exact pending-batch validation and a separately authorized continuation record: resumption creates a new turn without the usual `message.received` claim. Do not weaken or replace the original execution claim to make it resume.

Typed card answers still need stable option IDs, complete choice/skip validation, one atomic answer-plus-new-request commit, duplicate-tab protection and explicit question context for replies to old cards. The current `continued` status intentionally does not claim those semantics. Neither this path nor true runtime approval resume is mounted or enabled. Source reconciliation, effect receipts, permanent feed integration and continuous server-owned voice remain release gates.

## Earlier validation completed

- Tenant-isolation preflight passed before query/schema edits; synthetic fixtures were cleaned up.
- Disposable local PostgreSQL applied all 199 migrations and passed recording retry/conflict, repeated-word, concurrent position, adult isolation, browser-forgery, membership revocation/rejoin, account erasure, exact long content, immutable chronology, unlink-before-delete and replay-after-delete checks. The cluster was removed.
- 50 focused regression tests passed, including the actual Eve emitter identity regression.
- The two additional material-enrichment failure tests passed in the six-test history route suite.
- `check:continuity`: 288 tests passed.
- `check:chat-ui`: 316 tests passed before the two additional enrichment tests. Its browser fixture also passed; local Eve snapshots caused five duplicate fixture discoveries, so this is one unique two-tab cache scenario, not six different journeys.
- Web typecheck and focused lint passed before the final documentation-only update. The final check logs are local evidence, not production verification.
- In-app browser: authenticated history returned after reload, newest-message position verified, draft recovery verified. No real microphone session or physical-device certification was performed.

## Remaining scope at the 22:35 UTC checkpoint

Permanent source consumer and projection; worker parent-input continuation and effect reconciliation; mounted acceptance API integration; offline auto-send coordinator; server-owned voice and continuous recording; simultaneous-input context; history paging/catch-up; typed attachment/result identities; legacy migration/shadow comparison; physical-device interruption tests; real-parent validation; canary and `/app` replacement remain open. No Save UI was removed merely to conceal the still-existing voice persistence path.

Both tracking issues remain open. Existing production persistence failures remain escalated under #1182 until a separable fix is deployed and verified. This branch also contains the preceding authorized Homa v2 visual work; preserve it during integration.
