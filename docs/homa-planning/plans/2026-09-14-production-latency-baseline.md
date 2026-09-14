# Production latency baseline

Status: six approved production messages completed and saved; five-second goal
not achieved. Owner: gh#1171. Founder explicitly approved two synthetic families,
six messages and their durable records with “yes” on September 14, 2026. The
earlier automatic approval rejection is resolved for this test. Production code
and configuration stayed unchanged.

## Setup and outcomes

Host: `https://thankshoma.com`. Deployment:
`dpl_HJ8w7KiwbdjFEcPxeorznh9mDQ7i`, source
`2e67c7f13a0e67b3b8d726c6615180dc94db71ce`. Its agent configuration is
`openai/gpt-6-astra`, reasoning `medium`. Both reserved synthetic families were
created with the reviewed ownership-checking utility and signed in through the
normal production UI. Each received the three predeclared prompts, once, with
no health warmup or automatic resend. Each turn completed before the next Send.

| Prompt | Family A: first visible text | Family B: first visible text | Model calls per reply | Tool calls per reply |
| --- | ---: | ---: | ---: | ---: |
| Simple counting activity | 18.339–18.409s | 16.105–16.175s | 3 | 2 |
| Counting observation and activity | 29.625–29.694s | 31.350–31.420s | 5 | 4 |
| One-sentence phonics definition | 27.907–27.981s | 6.500–6.569s | 1 | 0 |

All six miss five seconds even at the earliest possible first-text boundary.
The first counting replies ask a clarification instead of providing an
activity. Both follow-ups give a practical sock-counting activity and display
the synthetic child's progress update. Both definitions answer correctly in one
short sentence. Partial first words are first streaming text, not proof of a
complete useful answer; this distinction cannot change these six misses.

The observer continuously sampled rendered text within the viewport. Every run
had visible-page evidence and no unobserved gap exceeding one second; the
largest gap was 343ms. These are sampled DOM intervals, not physical display
measurements. Six fixed diagnostic prompts do not estimate representative p95
or replace the 19-of-20 normal-reply acceptance batch.

## Where the wait occurs

Matching each exact session/turn to production timing markers gives:

| Sample | Send to first agent step | First step to first durable text | Durable text to observed text |
| --- | ---: | ---: | ---: |
| A counting | 6.633s | 11.688s | 0.088s |
| A follow-up | 3.206s | 26.412s | 0.076s |
| A definition | 4.052s | 23.790s | 0.139s |
| B counting | 4.172s | 11.843s | 0.160s |
| B follow-up | 3.265s | 28.053s | 0.102s |
| B definition | 3.330s | 3.168s | 0.071s |

The first-step marker precedes actual provider invocation. Its following bucket
includes remaining Eve/model setup, model execution and tool work; it must not
be called pure provider latency. This production revision lacks the newer
per-provider instrumentation and `model_usage.duration_ms` is null. The matching
first-text marker occurs after writing durable stream text. These timestamps
strongly argue against browser rendering as the multi-second bottleneck.
Client-to-server timestamp differences assume aligned clocks; clock offsets
were not independently calibrated. The six Send-to-visible-text measurements
use the observer's own clock and do not depend on that assumption.

### Follow-up: separate model setup from streamed answer delivery

Read-only inspection found no recorded Vercel trace for the slow definition's
exact worker request (`7b5db-1789362323767-7d49905c2eb0`, trace lookup returned
404). The exact Agent Runs lookup did not return within roughly two minutes
and was stopped. Neither lookup sent another model request. Clicking the
external API path in the platform panel only copies the path; it does not
expose the missing request-start timing. The displayed API duration is not
established as answer-text latency.

Installed, patched Eve 0.19.0 source confirms that `tool-loop.js` emits
`step.started` before asynchronous provider-tool preparation and advertised-tool
assembly. `emission.js` forwards each answer delta to the ordered durable
emitter. This ordering identifies possible measurement gaps; it does not prove
which one caused the production outlier.

The preview-only `chat-model-timing.ts` observer now records model-stream
request, stream opening, first nonblank reasoning delta and first nonblank
answer delta, alongside existing SDK call and durable append markers. It logs
coordinates and times only. It does not change model settings or add requests.
Correlation uses the prompt-array identity supplied by installed AI 7.0.14;
the SDK's public event type omits that runtime field, so a guard logs
`model_stream_correlation_unavailable` and leaves inference unchanged if it
disappears. Real SDK tests verify this correlation across concurrent sessions.
These are worker observation times, not independent network packet timestamps
or proof of browser paint.

Next hosted diagnostic: keep Astra medium and racing disabled; join the new
markers to first durable text and continuous viewport observations for repeated
one-sentence definitions. Before-provider delay implicates remaining setup;
provider-to-first-text delay implicates model/gateway streaming; first-text to
durable-append delay implicates the delivery queue. Do not attribute the old
24-second bucket using the new instrumentation until a hosted sample captures
all boundaries. The production baseline and five-second target remain unchanged.

Local validation: 13 timing/race SDK tests, web typecheck, focused ESLint,
`VERCEL=1 eve build`, and all three stream-duration checks passed. The emitted
web server and workflow handler both contain the new first-text marker. No
hosted run of this instrumentation has been performed yet. One initial
controlled-stream test omitted the required runtime-context projection and
waited indefinitely; that test was stopped, corrected, bounded by a timeout,
and passed in the final suite.

Family-context assembly took 198–376ms. User persistence, including its
embedding, took 341–997ms. They are contained within the preparation bucket,
not additional waits to add to it. The follow-ups each perform `load_skill`,
`manage_child_progress`, `explore_child_map`, and `verify_progress_next_move`.
The initial counting replies each load a skill and inspect the map before
asking their clarification.

Both definition workflow invocations were **Hot**, Node 24, peak concurrency
two. The slow one used 490MB peak memory, the fast one 498MB. Both sent 49,427
input tokens with zero cache-read tokens and made exactly one chat model call,
with no tools. Their step-to-first-text times differed by 20.622s. Therefore
cold startup and extra tool rounds do not explain this particular difference.

Vercel's external-request table displays 1.47s and 1.87s for the slow and fast
language-model HTTP requests respectively. Those table durations are not
verified full-stream or response-text timings. Do not subtract them from the
step duration and claim an identified 22-second app pause. Distinguishing time
before request, headers, reasoning/output chunks and durable publication is
the next useful measurement.

## Durability, cleanup and release limits

Ownership-checked, read-only database verification found exactly six canonical
message rows per family: three users and three assistants. All twelve rows are
indexed. All eighteen chat usage rows name Astra; each family has model-call
counts 3/5/1 across its three turns. All twelve tool records are complete. The
two owned test accounts are signed out and the temporary browser tabs closed.
Synthetic fixtures and their saved conversations are retained as approved.

**Unfixed production failure, escalated September 14, 2026: gh#1196.** The second
family's first sign-out changed the URL to `/signin` while leaving chat visible;
reload returned to authenticated `/app`. A second sign-out succeeded. This is
cleanup success, not a shipped fix. The auth action ignores a returned sign-out
error, but provider error versus session/cookie race is not established. The
approved baseline kept production code unchanged; auth-specific reproduction
and a verified release remain necessary.

Next latency work: separate the unexplained single-call tail from remaining
preparation, then test reducing unnecessary serial work before simple replies.
Preserve Astra medium, durability, ownership checks and truthful tool outcomes.
Do not promote the image-loader experiment as the five-second solution.

## Evidence

`/private/tmp/homa-preparation-startup-20260914/` contains the approved protocol,
production receipt, fixture registry, six `samples/prod-prep-*.json` recordings,
six complete-answer snapshots, `fixture-metadata-complete.json`, session-filtered
runtime logs, `production-timing-marks.json`, `production-analysis.json`, both
definition platform snapshots, and `browser-closeout.json`. Credentials remain
in the fixture utility's private files and are not included in this document.
