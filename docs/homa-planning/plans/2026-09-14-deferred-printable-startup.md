# Defer printable browser startup

Status: local verification and eight hosted Sends complete. Candidate passed two
of four useful-prefix checks; control passed one. The target remains unmet.
Exact-source CI failed the existing PDF memory guard. Owner: gh#1171,
draft PR #1191. Astra remains medium. The target remains Send to first useful
visible answer within five seconds for 19/20 normal replies, including all app
preparation and hidden model work. No production promotion.

## Hypotheses and change

The installed Eve runtime constructs the channel and agent graph before dispatch.
A credential-free probe of the actual compiled entry took 13.907 ms to dispatch
its first unauthenticated request after import, then 0.381 ms on the second.
It returned 401 without network activity. This weakens expensive post-import
routing as the explanation; it does not reproduce hosted authentication or
platform startup.

Module-load instrumentation instead found that plain chat eagerly loaded the
printable browser drivers through lib/materials/render-page.ts. The new literal
dynamic imports load Puppeteer and bundled Chromium when launchBrowser actually
needs them. Existing browser caching, local executable selection, deadlines,
network policy, PDF-to-preview provenance and handwriting validation stay intact.
There are no model, dependency, query, schema or configuration changes.

## Local evidence and limits

- Actual compiled-entry load events fell from 911 to 702, with unique module URLs
  falling from 427 to 243. Puppeteer-core files fell from 127 to zero and Chromium
  files from four to zero. The instrumentation changes loader behavior, so use
  these counts rather than its elapsed times as evidence.
- Uninstrumented local entry imports measured 1366.288 ms before and 387.361 ms
  after, with first unauthenticated dispatch 13.907 and 13.123 ms respectively.
  Disk-cache effects and sequential sampling prevent a causal speed estimate.
- All 19 real Chrome rendering checks pass, including actual PDF/raster and
  handwriting geometry cases. All 546 materials tests pass without skips.
  Web typecheck, targeted lint, Eve build and all three stream-duration checks
  pass. The preceding evidence commit 38d8474b passed CI run 34821646515;
  this is not CI proof for the new change.
- The actual emitted loader region imports both drivers, exposes expected APIs,
  and resolves the packaged Chromium and font archives. This probe has no
  network calls or forbidden effects. It does not launch Linux Chromium on macOS.
- The build remains 142 MB, including a 64,795,438-byte Chromium archive. This
  reduces initialization work, not total deployment size. It cannot by itself
  solve multi-call model waits or establish the hosted five-second target.

Private evidence is in /private/tmp/homa-five-second-active/startup-investigation:
office-admission-dispatch-20260914-01, browser-deferred-admission-20260914-01,
office-module-loads-20260914.json, browser-deferred-module-loads-20260914.json and
printable-browser-build-verification.json. Check logs use
/private/tmp/homa-browser-defer-*.log. The emitted entry SHA256 is
477740dc149b98e4bf6e8fdf266bfce25839d6244baaab07df574b6bd28f0d07.

## Hosted experiment

Build protected previews from committed source, with the same existing inline
turn, deferred tools, deferred indexing and timing flags. Keep warmup, priority,
racing and skill-linked tools off. Retain startup samples, failures, visible
conversation history and useful-prefix reviews. Compare against the Office-only
source; do not call a local import reduction a reply-time improvement. Freeze
the sample protocol before sending. Existing authorization covers synthetic paid
messages and these protected previews, not production promotion.

## Completed hosted comparison

Candidate 3dcfb559f2f624ab62607acee813d72961e485de and control
38d8474b67f8a986ddafc506d3229366a0db8676 both reached READY from tracked source.
The candidate deployment is dpl_9KjY9d5213sUTx4n9YNjMJsmiQyk at
<https://homa-e6eoc0gv9-homa-1d878b0e.vercel.app>, with session
wrun_01M2FGT86T072F67J4YKN97KFC. The control is
dpl_Gs3A7nTRJRFuZ2VtgCrjXFWeVefx at
<https://homa-hec7nlixg-homa-1d878b0e.vercel.app>, with session
wrun_01M2FGWZ7XWB7MK67FP7Z2SVJ5. Both retain the frozen settings above.

All eight Sends completed without manual retries or exclusions. Each arm has
four completed root turn steps, one completed continuation dispatch, seven main
Astra model calls, four completed tool operations and eight indexed conversation
messages. All seven model calls per arm advertise 96 tools, defer 92 and use zero
skill-linked tools. Both synthetic accounts signed out on the first click,
verified on the sign-in screen; both test tabs were closed. This does not resolve
the separate production sign-out issue gh#1196.

| Question | Control first text | Candidate first text | Control preparation | Candidate preparation |
| --- | --- | --- | --- | --- |
| Syllable definition | 7.305 to 7.373 s | 7.757 to 7.842 s | 5.323 s | 6.071 s |
| Ten-button counting game | 20.371 to 20.440 s | 21.018 to 21.109 s | 2.320 s | 2.010 s |
| Help with word guessing | 7.118 to 7.189 s | 4.261 to 4.343 s | 5.068 s | 1.529 s |
| Number-bond definition | 3.141 to 3.220 s | 4.277 to 4.357 s | 1.319 s | 1.594 s |

Useful-prefix review passes candidate reading help at 4.343 seconds and the
number-bond definition at 4.909 seconds. Control passes its number-bond definition
at 3.497 seconds. Earlier first letters do not count. The other five samples
already exceeded five seconds at their first text, so the useful upper boundary
was not measured. All samples stayed visible, with at most 70 ms between polls;
the observer measures viewport DOM visibility, not physical screen paint.

Counting used four main model calls in each arm: load the skill, discover tools
and read the child map, verify the activity, then answer. Step-to-provider-text
was 18.981 seconds for candidate and 17.882 seconds for control. Both reading
answers used one model call this time, unlike the preceding Office experiment.
Candidate reading used 2.635 seconds from first step to provider text; control
used 1.950 seconds. Its faster visible arrival is explained by a shorter measured
preparation interval, not faster generation. Across all eight samples, provider
text to visible text added 60 to 238 ms.

Both first Sends read the current binding, attached the prior Office-preview
session stream, read the binding again and created a new Workflow. Candidate
Send-to-new-admission arrival was 2.685 seconds; control was 2.774 seconds.
The new admission-to-first-step interval was 3.386 and 2.549 seconds. This is a
measured restoration sequence, not proof that all of the interval is avoidable,
or that the same behavior occurs for ordinary production conversations. Platform
Cold/Hot detail was not inspected for these two deployments. Do not label the
whole first-turn penalty as a cold start.

The candidate's visible initial history contained 24 user messages versus 18 for
control. Counting advice again differed: candidate targeted the spoken sequence
from a September 13 record, while control targeted matching one object to one
number from September 14. The small sample, unequal histories and advice prevent
a causal or equal-quality claim. The browser-loader change is not established as
a hosted speed improvement. No production promotion occurred.

### Validation result and retained evidence

Exact-source CI run 34823055811 failed the 64 MiB PDF memory guard at
775.305 MiB against a 768 MiB ceiling. Other required jobs passed, with the
aggregate gate failing as expected. The failed guard is the same independently
observed inconsistent limit from the Office trial; its cause is not established.
Do not relax the limit or call CI green. The actual hosted builds succeeded;
local and hosted bundle totals are different, so the local 142 MB total is not
a claim about the hosted deployment's aggregate size.

Private roots are /private/tmp/homa-eve-hosted-3dcfb559-printable and
/private/tmp/homa-eve-hosted-38d8474b-printable-control. They retain source hashes,
project/deployment receipts, the pre-Send protocol, original samples, manual
useful-prefix reviews, complete visible answers, sign-out receipts, scoped stored
messages/model/tool metadata and Workflow step metadata. The runtime exports
contain 1000 rows each with repeated request records; analysis deduplicates
measurement events and has all seven model starts per arm. They must not be
represented as an exhaustive platform-log archive. The failed CI log is
/private/tmp/homa-printable-ci-failed.log.

## Next question

Prioritize the measured restoration sequence and sequential skill/tool/model
work over further small import cleanups. The official
[OpenAI latency guide](https://developers.openai.com/api/docs/guides/latency-optimization),
checked September 14, recommends reducing sequential requests and parallelizing
independent work. Applied to Homa, that is a hypothesis to test without bypassing
fresh family context, child-map grounding or activity verification. The guide
provides no five-second guarantee for Astra medium. No prompt or workflow policy
change is included in this experiment.
