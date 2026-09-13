# Runbook: bumping the pinned eve version

> Early exception to M4-09 (`docs/homa-planning/runbooks/` is a post-Deliverable-0
> ticket): this one exists now because the need is real now, not later. See
> `docs/homa-planning/eve-churn-log.md` (2026-07-04) for why: a session
> parked in HITL corrupted on resume across an eve patch bump, and the
> resume API returned `ok: true` naming a different session instead of
> erroring. Follow this runbook every time the `eve` version in
> `apps/web/package.json` changes, no exceptions, including patch bumps.

## Why this exists

`eve` is pinned to an exact version (no `^`) specifically so upgrades are
always a deliberate act, never a silent `pnpm install` surprise. This runbook
is what "deliberate" means in practice. Semver patch does not imply
workflow-replay-safe for eve: the bug that motivated this runbook shipped in
a patch release.

## Steps, in order

### 1. Read the changelog first

Check `apps/web/node_modules/eve/CHANGELOG.md` (or the release notes) for the target
version and everything between it and the current pin. Flag anything
mentioning "tool", "replay", "workflow", "event log", or "durable"; those
are the categories that have already broken a parked session once.

### 2. Run the automated regression check

Start from a clean working tree and record the current `apps/web/package.json`,
`pnpm-lock.yaml`, installed package, and patch state. The check changes the Eve
dependency, runs `pnpm install` three times, starts local servers, and calls the
configured model through AI Gateway. It needs package-network access and the
model credentials used by `apps/web/agent/model.ts`. If it is interrupted,
restore the original pin and lockfile, run `pnpm install`, and verify the diff
before doing anything else.

Eve also has a version-specific pnpm patch. Inspect
`pnpm-workspace.yaml` and `patches/eve@0.19.0.patch`. The current patch keeps
three behavior protections until upstream absorbs them:

1. Client `isStreamDisconnectError` treats WebKit/Chromium "Load failed" /
   "Failed to fetch" as reconnectable stream deaths.
2. Shared Vercel function `eve/__server.func` writes `maxDuration: "max"` so
   long chat streams use the plan ceiling (Pro: 800s) instead of the Fluid
   Compute default of 300s.
3. The empty-delivery guard retries a sentinel-only reply when the current
   parent turn has produced no tool action or visible card. Preserve both
   streaming and generated-call coverage; `pnpm check:eve-empty-delivery`
   checks the installed harness.

An inactive candidate patch, `patches/eve@0.54.3.patch`, currently ports the
browser stream-open `TypeError: Load failed` case and the shared function duration
setting. The new output writer applies the duration before replacing the shared
function, preserves its other configuration, and rejects malformed configuration.
The empty-delivery protection is still missing: do not activate this patch or
accept the candidate as fully protected yet. The current pin and workspace patch
mapping remain on 0.19.0.

To check an extracted candidate copy with its patch applied, without a package
install or provider request:

```bash
node scripts/eve-stream-reconnect-probe.mjs /path/to/patched/eve/package /tmp/eve-reconnect.json
node scripts/eve-stream-max-duration-check.mjs --package-root /path/to/patched/eve/package
```

The reconnect probe uses the actual client with synthetic HTTP. It checks an
initial stream-open failure, a body interruption after partial text, exact cursor
resumption, no duplicate message POST, bounded retries, and non-retryable parse,
programming, and authorization failures. It does not run inside a browser engine.
The duration probe calls the actual candidate build-output normalizer on temporary
fixtures, checking configuration preservation and stream aliases. The extracted
package option cannot certify the installed build and is rejected with VERCEL=1.
A real candidate build and its default duration check are still required.

The candidate regression run is unpatched. Before accepting a new pin, prove
that each patch hunk is upstream or port it to a patch named for the candidate
version. Also run `pnpm check:eve-stream-duration` against the candidate
install so the stream-function duration hunk cannot silently disappear.

```bash
node --test scripts/eve-upgrade-proof.test.mjs
node scripts/eve-upgrade-check.mjs --to <candidate-version>
```

This reproduces the exact failure mode from 2026-07-04: park a session in
HITL, bump the version, try to resume it, check that the same session comes
back and actually processes the answer, with no replay divergence or
corrupted event log in the server logs. **Do not bump the pin if this
script exits non-zero.** If it fails, log the result in `eve-churn-log.md`
with the same rigor as the original finding, and treat the candidate version
as unsafe until eve fixes it.

The proof requires a real `input.requested` question before stopping the old
server, then supplies a newly generated probe value through `inputResponses`.
The original session must repeat that value and complete a new turn.
`session.waiting` alone only means that a session is idle; it does not prove
a question is pending. Malformed events and transport failures invalidate proof.

Eve 0.31.0 changed the public session protocol to ID-addressed handles and
removed continuation tokens from HTTP bodies. The regression probe selects
the candidate's request shape, but that does not migrate Homa's browser,
mobile, channel, schedule, or session-ownership adapters. Audit those surfaces
and the new control/child-stream routes before running a September candidate.
Never loosen the ownership guard merely to get a candidate to boot.

For a handle-client candidate, an offline lifecycle probe can run against an
already extracted package before changing the dependency. Use Node 24:

```bash
node scripts/eve-client-lifecycle-probe.mjs /path/to/extracted/eve/package /tmp/eve-client-lifecycle.json
```

It runs the candidate's client, store, and message reducer through Homa's
recoverable-store wrapper, with synthetic HTTP responses and no model calls.
It checks early partial text, same-session follow-ups, local abort without
durable cancellation, read-only replay and replacement, stale callback
suppression, and duplicate-send rejection. This is not the parked-session
regression above, a React integration test, a candidate build, or latency proof.

The React connection also has a synthetic browser test:

```bash
pnpm --filter web test:chat-recovery
HOMA_EVE_CANDIDATE_PACKAGE=/path/to/extracted/eve/package pnpm --filter web test:chat-recovery
```

The second command bundles the extracted candidate client into the browser
fixture without changing the install. Both exercise Homa's actual chat hook,
including queued sends, partial rendering, local stop, and recovered-session
adoption. The fixture replaces HTTP responses; it does not mount the complete
chat screen or contact Homa's hosted server. The installed-version run is part
of check:chat-ui. Neither command measures model latency or app overhead.

The voice bridge can exercise its actual default runner against either reviewed
SDK with synthetic HTTP responses, preserving signed voice headers and results:

```bash
node scripts/eve-voice-bridge-probe.mjs apps/web/node_modules/eve /tmp/eve-voice-current.json
node scripts/eve-voice-bridge-probe.mjs /path/to/extracted/eve/package /tmp/eve-voice-candidate.json
```

This checks creation, same-session follow-up, advanced cursor persistence,
spoken output, authored effects, and failure without resubmission. It uses a
temporary bundle and synthetic signing secret; no model, database, or audio
device is contacted. Protocol fixtures currently cover 0.19.0 and 0.54.3 and
must be reviewed for another version. This does not replace a spoken-device
check or the real parked-session upgrade proof.

Evaluation messages must retain their per-turn context and headers across the
SDK change. Run the offline probe against each reviewed version:

```bash
node scripts/eve-eval-message-probe.mjs apps/web/node_modules/eve /tmp/eve-eval-current.json
node scripts/eve-eval-message-probe.mjs /path/to/extracted/eve/package /tmp/eve-eval-candidate.json
```

It exercises the SDK's actual evaluation context with a synthetic session
driver. It checks worksheet context, voice and onboarding headers, returned
turn identity, and a failed send without retry. It does not run the behavioral
evaluations or their model judges, and does not measure latency. The fixtures
cover 0.19.0 and 0.54.3; review the protocol before using another version.

### 3. Check for live parked sessions before deploying

The repository does not currently have an executable inventory of Eve sessions
parked in HITL. Product conversation tables store messages, episodes, bindings,
and runtime session IDs, but not parked status or continuation tokens. M1-15 owns
the session-lifecycle inventory and rotation work.

Until that inventory exists, a production Eve bump is blocked unless an
authorized provider-side query can prove there are no parked sessions. Do not
infer absence from product tables or the age of the deployment. If anything is
parked, wait for it to clear or resolve it gracefully before changing the pin.
Never let an in-flight HITL pause sit across a version-changing deploy; that is
the exact condition that broke.

### 4. Deploy, then verify

After deploying the new pin, use an authorized synthetic account to start a
production session, park it deliberately through `ask_question`, and confirm
that the same session resumes. Record the deployment, synthetic principal,
session identifier, timestamps, and sanitized result, then remove the fixture.
The current production baseline does not contain this evidence. Without an
authenticated procedure and cleanup authority, the bump remains unverified.

### 5. Log the outcome

One line in `eve-churn-log.md` either way: version, date, changelog flags (if
any), regression check result. The log's whole purpose is giving the eject
tripwire (`12-roadmap-okrs.md` §tripwires) real data. A bump with nothing to
report is still worth a line ("clean bump, no issues").

## What this runbook does not solve

It does not fix the underlying eve bug. It makes the bug survivable by
never letting the exact trigger condition (a real, in-flight HITL pause
during a version-changing deploy) occur, and by refusing to ship a version
that fails the regression check. Report the bug upstream separately; that
timeline is independent of this runbook.
