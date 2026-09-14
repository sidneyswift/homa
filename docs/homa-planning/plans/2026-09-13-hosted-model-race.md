# Hosted Astra race experiment

Status: first hosted intervention did not activate; corrected pilot pending. Owner: gh#1171.

The target remains Send to first visible useful answer within five seconds for
19 of 20 normal replies, including preparation, reasoning, tools, transport, and
rendering. Astra stays on medium. This experiment does not establish that target.

## Intervention

An opt-in preview starts two identical inference streams for the main Eve agent
and forwards one complete stream to Eve. The first nonempty answer text or
complete tool proposal wins. Hidden reasoning, setup events, and partial tool
headers do not win. Only the selected proposal reaches application tools, so
the experiment does not run two turns or duplicate deterministic writes.

The SDK default-provider hook preserves Eve's canonical string model reference,
Gateway attribution, automatic caching, and compaction identity. Registration
only wraps Astra. The main-agent attribution header further excludes standalone
claim extraction and report calls that share Astra. Production and disabled
previews use their original provider. Unknown provider-executed tools and
raw-stream consumers bypass the race because their speculative effects or
buffering cannot be controlled here. Eve's specific `gateway.parallel_search`
tool is allowed: it reads web results and may incur speculative search charges,
but does not perform application writes. This does not authorize other provider
tools. The installed Gateway factory and
[Vercel's description](https://vercel.com/changelog/parallel-web-search-is-now-on-ai-gateway)
establish this tool's search scope.

Loser cancellation is requested without delaying the winner for acknowledgement.
Cancellation does not prove billing stopped. Existing usage records describe
the winner, not total experiment spend. Race diagnostics contain timestamps,
selection reasons, and cancellation outcomes, never prompts or reasoning.
An already visible winner is never replaced after a later error. Prefix bounds
commit a stream rather than fail valid long reasoning, but do not count as TTFT.

## Comparison plan

Deploy two protected source-only previews from the same commit and dependencies:
Eve 0.19.0, AI SDK 7.0.14. Only `HOMA_PREVIEW_MODEL_RACE` differs. Keep model and
sandbox timing plus deferred user indexing enabled in both. Explicitly enable
Progress and claim extraction in both; project preview flags do not inherit
production-only values. Inline turns, priority, and chat warmup remain disabled.

Use fresh reserved synthetic families. Alternate the deployment order across
families. Each family receives a counting activity request, a child observation
followup, and a short phonics question. Observe each Send continuously in the
actual hosted UI, retain every attempt and failure, and review whether first
text is useful content or merely a notice. Wait for each full turn before the
next Send. Read only fixture-scoped server records to verify one tool execution
per selected proposal and durable conversation messages.

This is a small integration and mechanism screen, not a p95 acceptance batch.
Compare preparation and provider phases separately. Require hosted race logs
to establish that interception actually ran. If it does not, classify the
deployment as a failed intervention rather than a treatment result.

## Local verification

Nine real-SDK tests cover competing save proposals, hidden reasoning, connection
and stream failures, parent cancellation, selected-stream cancellation, slow
loser acknowledgement, provider-tool bypass, and main-agent-only registration.
Type checking, focused lint, Next build, Eve build, and the stream-duration guard
pass. These checks do not prove hosted latency, total cost, or answer quality.

## Interrupted first deployment

Source `c502bad3d5f0a43d02fb7bd3420c8b8ce02beba1` produced two READY,
protected previews: baseline `dpl_F6pVw6aZokGn6QnwRe3DM4mjgoG3` and candidate
`dpl_Fcuzvmsqzhdmqy4XUzY23WCw5qmB`. The first three baseline observations were
20.891-20.973s, 42.197-42.266s, and 12.502-12.595s. The first candidate observation
was 19.625-19.707s. All four had continuous sampled visibility without a gap
above one second. No observation met five seconds.

The candidate's three chat calls produced timing logs but no race logs. Stop
after four of twelve planned Sends; retain the other eight as unattempted.
Do not interpret this candidate observation as a race treatment result.

Installed Eve 0.19 advertises Gateway's provider-executed Parallel search on
every main chat request. The original all-provider-tools bypass therefore
excludes this workload even when no search executes. The correction permits
only that audited read-only tool and adds explicit registration and skip
diagnostics. The real-SDK save test now includes the actual Gateway search
factory, matching this important part of Eve's live tool list.

The two used fixture accounts were signed out; fixtures and all observations
remain retained. Two original families remain unused and are eligible for a
fresh corrected six-Send mechanism pilot on matched source deployments. This
smaller pilot checks activation and tool safety before spending on a larger
comparison; it does not change the five-second, 19-of-20 goal.

Raw local evidence: `/private/tmp/homa-eve-hosted-c502bad3/`, including protocol,
four samples, stopped-run state, segmented logs, deployment identities, and
fixture-scoped server records. Production stayed on deployment
`dpl_HJ8w7KiwbdjFEcPxeorznh9mDQ7i`, SHA
`2e67c7f13a0e67b3b8d726c6615180dc94db71ce` at the preflight check.
