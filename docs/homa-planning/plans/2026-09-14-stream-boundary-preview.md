# Hosted stream-boundary diagnostic

Status: four preview replies completed and saved. The five-second, 19-of-20
useful-answer goal remains unmet. Owner: gh#1171.

## Verified setup

Source `5445a1647959bf027e93f2063824e7b145d2866d`, protected READY preview
`dpl_CMejg3Wj8jLeTB8fooXh94sZneQj`,
`https://homa-eam3a948z-homa-1d878b0e.vercel.app`. Vercel's deployment metadata
matches the committed source and tree. Eve 0.19.0, AI 7.0.14, Node 24, Astra
medium. Model and sandbox timing plus deferred user indexing were enabled;
model racing, inline turns, priority, and chat warmup were disabled. Progress
and claim extraction remained enabled. No production deployment was made.

One retained reserved synthetic family, `racebased`, received four fixed
definition questions through the ordinary browser UI. No new families were
created. Existing history stayed visible. The first Send rotated the old
session into `wrun_01M2F6CSX2HQDRYMXXGDBMBGB3` automatically. All four calls ran
on the new preview and emitted the new timing markers.

An initial log search used the prior session ID and found only a stream read.
The initial hypothesis that inference remained on an older worker was wrong.
The new preview's bounded time-window logs established automatic rotation and
the actual current worker. The remaining Sends resumed only after confirming
the first reply's complete timing markers. No repeat Send or new fixture was
used to recover from that diagnostic mistake.

## Results

All numbers below are seconds. Model wait runs from the wrapped provider call
to the first nonblank response-text delta, including stream opening.

| Prompt | Send to first visible text | Before model request | Model wait | Stream open | After open to text | Text to app append hook | Append hook to visible |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Phonics | 11.365–11.437 | 6.132 | 5.048 | 1.745 | 3.303 | 0.002 | 0.255 |
| Syllable | 11.284–11.353 | 3.983 | 7.284 | 1.602 | 5.682 | 0.002 | 0.084 |
| Phonics repeated | 15.833–15.904 | 3.009 | 12.811 | 1.294 | 11.517 | 0.001 | 0.083 |
| Rhyme | 9.873–9.948 | 2.682 | 7.224 | 1.314 | 5.910 | 0.001 | 0.041 |

Each reply used exactly one recorded Astra call, advertised 95 tools, and
executed zero tools. All four answers were correct short definitions, without
an acknowledgement standing in for the answer. First observed text included
partial words; every first-text interval already misses five seconds, so a
later useful prefix cannot pass. Eight canonical messages are saved and indexed.
The account signed out successfully and the test tab was closed.

Input tokens were 42,715 / 43,036 / 43,362 / 43,683, with zero reported cache-read
tokens on every call. No reasoning delta reached the new observer; this does
not establish that the provider performed no hidden reasoning. Model-service
queueing, prefill, internal retries and hidden reasoning remain unsplit.

The append marker follows Eve's awaited stream writer and event-hook dispatch;
its 1–2ms gap is not a benchmark of final canonical conversation persistence.
The separate scoped database read proves the completed messages were saved.
The direct model-text-to-visible interval is only 42–257ms in these samples.

Coverage is continuous sampled DOM visibility, not physical display paint.
All four samples have visible-page evidence and no observation gap over one
second; the largest gap is 345ms. Cross-host phase differences assume aligned
clocks. Overall Send-to-visible intervals use the observer's own clock. This
four-question diagnostic does not estimate representative p95 or establish
production performance.

## Failure retained before Send

The first authenticated `/app` load showed the error boundary. Request
`rrt47-1789363821328-bb88b4e19ded` logged `children read failed: Children lookup
temporarily unavailable.` The ordinary Try again button retained the error;
a full page reload restored the previous conversation. This happened before
any Send and is kept separately from answer latency. It resembles the issue
tracked by gh#1194 despite the bounded reader being present. The exact failing
transport condition is not established. No new production occurrence or fix
is claimed from this preview observation.

## Decision and next experiment

For these four simple replies, durable delivery and browser rendering are not
the multi-second bottleneck. Remaining preparation is material, but most of
the variable delay occurs after the provider stream opens and before text.
The 43k input with no cache reuse is a concrete intervention candidate, not a
proven cause. Earlier cached calls also had long waits; cache reuse alone is
not a solution established by the evidence.

Review the existing artifact-only deferred-tool-search candidate for a separate
protected comparison: preserve all tools and their authorization, let the model
discover detailed tool schemas when needed, keep Astra medium, and retain both
simple definitions and real tool tasks. That candidate has offline serialization
and authorization tests but no hosted acceptance or latency result yet. It must
not be described as shipped or faster until the actual comparison proves it.

Raw evidence: `/private/tmp/homa-eve-hosted-5445a164/`, including frozen protocol,
exact source provenance, deployment verification, four continuous samples,
post-reply UI snapshots, current and mistaken-session log queries, scoped DB
metadata, normalized timing markers, analysis script and `analysis.json`.
