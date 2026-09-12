# Ordered stream delivery experiment

Owner: [issue #1171](https://github.com/sidneyswift/homa/issues/1171).
Status: implemented and locally verified; hosted performance is not yet measured.

The target remains 19 of 20 hosted browser replies with a useful first answer
within five seconds of Send, including hidden reasoning and app preparation.
Keep Astra on medium. Errors, timeouts, status text and filler are misses.

## Evidence and hypothesis

On the September 12 synthetic production cohort, one Gateway request reported
completion about 3.37 seconds before Homa's first message-appended hook. Other
turns tracked provider timing closely, including a 17.07-second provider tail.
These observations suggest a stream-drain problem in some turns, not a complete
explanation of latency. Gateway timings and browser visibility are different
measurements; reasoning token counts do not establish provider frame counts.

The installed Eve 0.19 harness awaits each emitted fragment. Its durable sink can
make many small reasoning fragments delay the text behind them. A controlled
experiment using 76 synthetic reasoning fragments and fake 50 ms writes changed
first text at the fake durable store from 4.819 seconds to 0.368 seconds, reducing
81 writes to 7. Those numbers prove a mechanism, not expected production savings.

## Implementation and invariants

Backport the original [Eve commit 640cd8e](https://github.com/vercel/eve/commit/640cd8e),
released in 0.22.5, into the existing 0.19.0 pnpm patch. Do not change the Eve,
AI SDK or Workflow versions. The four added patch sections wrap `emitStreamContent`
and add the original ordered emitter, failure-interruptible iterator and action
batch cancellation support.

- The first event begins emitting immediately. Only adjacent queued text or
  reasoning appends with equal turn, sequence and step coordinates can merge.
- Concatenate deltas and retain the latest cumulative text, metadata and message
  context. Non-append events remain ordered barriers.
- Bound pending source events at 64 and pending delta string code units at
  65,536. These thresholds exclude the active emission and other payloads; they
  are not a strict total memory cap.
- A sink failure interrupts a stalled provider pull. Cancellation joins the
  action batch, and the wrapper drains pending emissions before returning.
- Keep Workflow serialization, one emitted event per durable chunk, cursor
  indexing and writable-lock settlement unchanged. Preserve all five existing
  patch sections for reconnects, stream duration and empty delivery.

Provider consumption may advance while queued emission hooks run; append hooks
can fire fewer times. Homa's canonical user/message persistence, action logs and
step usage hooks preserve their boundaries. Web and mobile client/protocol bytes
are unchanged. This is not the later delta-only Eve protocol.

## Validation

`pnpm check:eve-ordered-stream` runs 14 tests against the actual installed package,
including cumulative data, ordering, capacity, authorization, sentinel handling,
cancellation, sink/provider failure precedence and real Workflow settlement with
a synthetic World. A terminal write failure after the harness returns still
rejects the unchanged Workflow drain. The test makes no model calls.

Independent installed-client tests pass 21 checks, including 20 reconnect cuts and
20 cancellation/resume cuts. Existing validation passes: 289 continuity tests,
119 agent-context tests, 323 chat tests, 129 mobile-chat tests, the two-tab browser
test and three empty-delivery checks. A stale mobile source assertion now accepts
the authentication options added by #1186 without changing client behavior.

The production Eve build and three stream-duration checks pass. The built flow
entrypoint reaches the new ordered emitter and cancellation/drain wrapper, so the
same-version patch was not hidden by an old build cache. Web typecheck passes.
Mobile typecheck and lint pass. The CI addition was reviewed end to end before
recording its exact hash in the Android distribution guard; it adds only local
tests and preserves the guard's rejection of future unaudited edits.

## Hosted experiment and rollback

Compare useful browser text with provider and preparation metadata on the same
synthetic prompts. Keep returning-driver and fresh-driver results separate;
existing drivers remain pinned to the deployment that created them. Verify a
reasoning turn, ordinary turn, follow-up and reconnect. Do not claim 19-of-20
acceptance from a small favorable smoke test. Freeze the representative workload
before its acceptance run and retain failures.

If persistence, cancellation or reconnect regresses, revert this patch and its
lock hash together, deploy, and verify a complete synthetic reply and restore.
Retain every earlier patch section. Do not clear existing conversation journals
or invent new cursors. The independent provider tail requires its own experiment.
