# Native answer recovery proposal

Status: explicitly approved by Sidney on September 13, 2026 and installed locally in the existing Eve 0.19.0 patch. The patch checksum was refreshed by pnpm. Production configuration remains unchanged. Authenticated channel integration is implemented. Installed-runtime, database and build verification passed at September 13, 2026, 03:11 UTC. A real local host restart regression now passes; automatic interrupted-work recovery and deployed-host certification remain outstanding.

A parent can answer a saved question once. If the worker stops after accepting that answer but before the runtime confirms delivery, the current conservative boundary prevents resending it into a later question. This prevents accidental approval of a different action, but that answer can remain waiting for recovery. Native input stays disabled until safe retry is implemented and verified.

## Concrete change for review

The adjacent `2026-09-12-native-replay-candidate.json` records four exact JavaScript replacements and two declaration additions in four files of the already installed Eve 0.19.0 package. Extend the existing package patch, preserving its tool execution identity change and the same package version. The approved local patch-commit and reinstall are complete; the lockfile contains the resulting patch checksum.

The change exposes the existing internal channel delivery callback through Eve's public channel definition. It also preserves a channel-owned input key through the send payload. The key is metadata and never enters model text. Homa can then record a question answer's key in durable channel state and discard an identical retry before Eve consumes any pending question. A changed answer under the same key must fail. Server ownership, access epoch, exact full-batch validation, and deletion checks still run before accepting delivery.

## Verification scope

The initial candidate evidence has been replaced by tests importing the installed patched modules. The completed local application boundary checks authenticated ownership, current access epoch, exact continuation, deletion and the full saved answer batch before dropping an identical retry or accepting an unseen answer. Seen keys remain for the session lifetime. These checks are not production workflow-host crash certification.

## Approval boundary

Automatic approval review rejected applying and installing this dependency patch because it modifies security-sensitive runtime input and channel behavior plus dependency metadata. Installation was not retried until Sidney explicitly answered yes. That approval covers the concrete same-version patch and local reinstall described here, followed by implementation and verification. Production enablement remains a separate evidence gate.

## Installed verification

The three checkpoint tests now import the installed patched runtime directly, with no in-memory source replacement. They pass for the actual public delivery callback, preserved send key, and saved channel/input-state replay before a newer approval. `scripts/eve-native-answer-replay-check.mjs` is part of the conversation storage CI command and verifies installed behavior plus refusal to start a fresh session after an answer delivery error. This remains distinct from production workflow-host crash certification.

## Queued-answer verification extension

Review of the installed driver found that it merged queued input responses and retained only the last answer key before the authored guard. The same-version patch now preserves each keyed answer envelope and its authentication, while keeping ordinary message coalescing. Keyed answers reach the root guard before any child routing. Child input events receive a runtime-authored proxy marker and exact parent turn coordinates that survive event serialization; Homa refuses those unsupported batches. Only matching executing or recovery-required requests may fail. Missing parent evidence, stale parent coordinates and completed requests cannot mutate a newer reply. The exact installed diff lives in `patches/eve@0.19.0.patch`, with file provenance recorded in the adjacent JSON.

Eight installed-boundary regressions cover queued duplicate/new answers, ordinary-prefix behavior, live queue pushback, child routing, proxy marker serialization and current authentication before the authored guard. The actual installed checkpoint tests remain separate. These checks do not certify a deployed workflow host restart.

## Final local evidence

Conversation storage: 157 passed, one intentional database-only skip; eight installed queue/envelope tests passed. Both core and native disposable PostgreSQL suites passed with 210 migrations, including delayed proxy attribution regressions. Web typecheck, focused lint, 289 continuity tests, full isolation guard, Vercel-target Eve build and three built stream-duration checks passed. The isolation guard reports new remote tables as pending because no remote migration was applied; the disposable database supplies candidate-schema evidence. No deploy, host-restart certification or production enablement is claimed.

## September 13, 2026, 16:12 UTC: real local host restart

`pnpm test:conversation-host:restart` passed against the installed Eve development host, with a deterministic model and a synthetic channel. The test creates its own temporary directory, local port and credential-free process environment. It waits for persisted question and completed workflow-step records, sends the first answer, waits for the second question, kills the complete owned host process group with SIGKILL, and starts the same host against the same local data directory. Retrying the first answer is dropped. The second question remains unanswered until its own answer arrives, and the final reply contains exactly the first Yes and second No once. The reusable test is wired into CI; no remote CI run is claimed.

A separate exploratory process-kill test interrupted the answer before its step checkpoint. Default local restart plus retry left that child run marked running without further progress during the probe. Installed source inspection found default local-world initialization does not invoke its recovery start method. Explicit `reenqueueRun` with the application queue namespace resumed the saved child; the queued duplicate was dropped, and the final reply again contained the exact two answers once. This establishes explicit local replay, not automatic startup recovery or deployed Vercel recovery. Initial requeue without the application namespace was rejected as an unhandled queue and did not resume work. No product recovery hook was installed.

The custom HTTP event-stream route returned a local socket error, so this test reads the actual persisted local stream records and completed checkpoints. It does not certify browser reconnect streaming, real authentication, live providers, external effects, automatic interrupted-work pickup or deployment recovery. Application authentication is covered separately by the database suite. The temporary server was stopped after verification. The portable fixture contains no test-only interruption hook or absolute temporary paths.

Local evidence: `scripts/eve-native-host-restart.test.mjs`, `scripts/fixtures/eve-native-host/`, `/private/tmp/homa-native-host-final-regression.log`, `/private/tmp/homa-native-midstep-receipt.json`. The exploratory run's disk files are temporary evidence, not a reusable test; the committed-checkpoint restart journey is the reusable regression.
