# Immediate first step with deferred tools

Status: combined local durability checks pass; remote CI and hosted measurement
pending. Owner: gh#1171, existing draft PR #1191. The goal remains a useful
visible answer within five seconds of Send for 19 of 20 normal replies, using
Astra medium with app overhead, hidden reasoning and tool work included.

The previous [deferred-tool experiment](2026-09-14-deferred-tool-preview.md)
reduced provider input and worked with a real progress save, but all nine Sends
missed the target. The successful candidate rhyme took 6.681 seconds before the
model request and 1.824 seconds to first answer text afterward. The interval
between inbound continuity and family-context startup was 4.983 seconds. That
includes uninstrumented work, scheduling and startup; it is not all proven
removable child dispatch.

## Blindspots and experiment boundaries

Three material traps from the installed implementation:

1. The immediate path does one durable first step, then carries a checkpoint to
   the existing child runner when more work is required. Tool search and its
   result must survive this transfer without repeating an authored effect.
   Implementation: `patches/eve@0.19.0.patch`, `runInlineTurn` and child input v2.
2. An approval response can arrive with another user message. They may produce
   separate model rounds. Compare complete model history, event boundaries and
   effects with the ordinary child runner rather than assuming one fixed count.
   Fixture: `scripts/fixtures/eve-inline-turn/runtime.mjs` approval continuation.
3. Enabling a deployment flag is not activation proof. Acceptance must stamp the
   allowlisted verified user and immutable deployment; the actual worker must
   match. Inspect the hosted root/child execution after the first sample. Missing
   proof stops subsequent Sends, without silently resending the first question.
   Gate: `readEligibleAcceptedDeploymentId` in the existing Eve patch.

The revised experiment is to keep deferred tool loading enabled in both arms,
vary only authenticated immediate first-step execution, use the existing
reserved synthetic family or families, preserve each failed Send and all
conversation/tool records, and verify actual execution before interpreting
latency. Do not bypass membership checks, alter Astra medium, reduce capability,
or count an acknowledgement as a useful answer.

## Combined local evidence

The existing installed-package Workflow test now also enables deferred loading
in both the ordinary and immediate paths. Every tested model call checks that
the review tool remains deferred, hosted search is present, and skill loading
remains eager. The search response uses the real installed OpenAI converter
with canned server events and a custom network-free response function.

New coverage verifies ordinary replies, a discovered tool continuing through an
encrypted v2 checkpoint, approval and denial by another authenticated responder,
and a new process replaying after the first durable step is persisted. The
replay performs one search conversion and one authored effect total. Prompts
and public event boundaries match the ordinary runner. All network interfaces
remain blocked and each process starts without credentials.

`pnpm check:eve-inline-turn` passes 53 durable assertions, 22 routing/channel
assertions and strict declarations. Its first combined attempt correctly
rejected an assumed two-call approval count: the fixture also supplies a
follow-up message. The corrected test compares both complete paths and proves
the follow-up appears once; it does not relax the no-duplicate effect check.
Logs: `/private/tmp/homa-combined-inline-deferred-check.log` and the successful
`/private/tmp/homa-combined-inline-deferred-check-v2.log`.

No application code or package versions changed for this combined test. The
previous source's real Eve build and protected deployments remain evidence for
that unchanged runtime, not for this unmeasured combination. Push the owned
draft branch and verify actual current-head CI before the hosted trial, as
required by the original inline experiment. No production promotion is planned
from the local checks alone.
