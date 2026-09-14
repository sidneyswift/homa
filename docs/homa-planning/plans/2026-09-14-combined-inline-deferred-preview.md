# Immediate first step with deferred tools

Status: combined local checks, current-source CI and nine hosted Sends complete.
Two useful follow-up answers passed five seconds; the goal remains unmet.
Owner: gh#1171, existing draft PR #1191. The goal remains a useful
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

## Hosted evidence, September 14

Measured source: `98bdda5174c3c1a0be8b8f3641ed924574cb7e77`, tree
`3f0ebc7339c39d387696104e27b8ee3d58b06302`. GitHub CI run
[34813494608](https://github.com/sidneyswift/homa/actions/runs/34813494608)
passed, including the aggregate gate; the classifier skipped mobile checks.
The PR's Vercel preview also passed. The earlier run at `605d28b7` failed the
punctuation guard on retained upstream minified patch context; `98bdda51` added
the same narrow upstream-string exception used for the other retained patch.
No application or dependency bytes changed in that correction.

Two protected source deployments reached READY, both Node 24 and preview-only:

- Immediate: `dpl_H9a8ybj34EHiHupDLq6G8b6svatB`.
- Ordinary child runner: `dpl_DXeWh4MoFXi9eqkziYUXM32AaHDG`.

Archive hashes and all 5,498 tracked source files matched. The sole behavioral
flag difference was `EVE_EXPERIMENT_INLINE_TURN`, enabled only for the existing
allowlisted synthetic user on the immediate deployment. Both enabled deferred
tools, disabled racing and priority, and kept Astra medium. No production
promotion or additional family creation occurred.

One candidate acceptance Send preceded eight fixed, alternating comparison
Sends. No warmup or failed Send was excluded, and nothing was resent. Both
families had existing synthetic histories; the first control question started
a new session, while its matching candidate question was a follow-up. These
differences prevent attributing the whole paired improvement to the flag.

| Question | Ordinary runner, first visible text | Immediate runner, first visible text | Immediate useful answer |
|---|---:|---:|---:|
| Initial phonics acceptance | Not part of comparison | 7.734-7.808 s | Miss |
| Syllable definition | 8.344-8.416 s | 4.055-4.125 s | By 4.579 s |
| Rhyme definition | Not sent, membership timeout | 3.478-3.549 s | By 3.767 s |
| Latest counting note | 20.070-20.141 s | 16.685-16.772 s | Miss |
| Save nine-car counting note | 18.260-18.348 s | 18.813-18.882 s | Miss |

Timing is continuous visible-DOM sampling from Send, not physical display-paint
instrumentation. First fragments such as `A`, `The` and `Saved` are separate
from useful answers. The two passing prefixes actually explain syllable and
rhyme. All other answered rows already exceed five seconds at first text.
This is a diagnostic sample, not a representative 95th-percentile estimate.

### Actual execution and durable results

The official Workflow CLI's exact-run step inspector shows five completed
`turnStep` entries in the candidate root, one for each Send, and two later
`dispatchTurnStep` entries for the record-reading and saving continuations.
The control root has three dispatch steps and no root turn step. This proves
activation beyond the deployment flag. Every accepted model call in both
arms recorded 92 deferred tools out of 96 advertised entries.

The candidate stored and indexed ten messages and made nine main chat model
calls. The control stored and indexed six messages and made seven main chat
model calls. Both progress reads returned the actual latest eight-block
observation. Each save ran one completed `manage_child_progress` call and
confirmed the nine-car observation. Both freshly loaded Progress pages showed
the September 14 one-to-one counting journal evidence. Exact domain-row quote
contents and duplicate counts were not independently queried, so the UI and
tool evidence do not claim that stronger audit. Both synthetic accounts signed
out with one click and their test tabs were closed. This does not resolve the
separately escalated production sign-out issue #1196.

### What still consumes time

| Candidate question | Send to first model request | Model and tool work to answer text | Text to visible DOM |
|---|---:|---:|---:|
| Initial phonics | 6.054 s | 1.681 s | 0.073 s |
| Syllable | 2.254 s | 1.798 s | 0.073 s |
| Rhyme | 1.927 s | 1.564 s | 0.058 s |
| Latest counting note | 1.904 s | 14.767 s | 0.101 s |
| Save counting note | 2.606 s | 16.155 s | 0.121 s |

These cross-host phase splits assume clock alignment; the primary visible
intervals use one observer clock. Both record operations required three main
model calls, skill loading, hosted tool discovery, and the domain tool. The
read tool itself took 334 ms on the candidate, while saving took 5.184 s.
Source inspection shows saving also invokes the shared Astra claim extractor
before deterministic validation; this sample's chat-only usage query does not
independently time that nested model call. Do not label all five seconds model
time. The candidate save was slightly slower than the control, so the immediate
path has no demonstrated benefit for that operation here.

The previous deferred-only rhyme's Workflow event trace also narrows the old
4.983-second preparation gap: hook receipt to dispatch-step start was 3.984 s,
and dispatch-step start to family-context start was 0.843 s. The root HTTP
invocation had already arrived during the larger interval. This does not prove
that interval was all queueing, or all removable child dispatch. Evidence is
in the prior exact-run inspector files, not an inferred health-check timing.

### Failed Send and recorder incident

The control rhyme request's authenticated membership lookup timed out after
5.053 s, before any main model call or stored user message. The UI displayed
`Not sent`. This is a separate account-service failure, not deferred-tool or
model rejection. The existing #1178 error classification does not eliminate
the underlying timeout; no new production occurrence was established here.

The same sample's local recorder later failed with ENOSPC. Its original file
retains continuous visible observations through 34.709 s, already sufficient
to establish a five-second miss. A separate incident file records the truncated
observation, the UI outcome and zero resends. Do not present it as a completed
90-second observation. Only the two reproducible deployment upload folders
were removed after verifying every file against the pushed Git blobs; all
measurements and receipts remain. Subsequent observations completed normally.

## Evidence and next experiment

Private evidence roots are `/private/tmp/homa-eve-hosted-98bdda51-inline` and
`/private/tmp/homa-eve-hosted-98bdda51-child`: frozen protocols, source/READY/CI
receipts, samples and useful-prefix reviews, complete runtime logs, exact-run
step metadata, read-only family-scoped message/tool evidence, fresh Progress
snapshots and sign-out receipts. `inline/analyze.mjs` validates these joins and
writes `analysis.json`; source upload copies are reproducible and removed.

Keep the goal and draft PR open. The next bounded comparison should target the
two setup model rounds for record operations: skill loading and tool discovery,
while preserving the full skill procedure and exact authenticated tool effects.
Measure that separately from the nested claim-extraction work and from first
session startup. Any eager-tool subset must keep the full capability surface
available and be justified by observed routing, not keyword interpretation of
parent language. No more broad latency claim or production rollout is supported
by these nine Sends.
