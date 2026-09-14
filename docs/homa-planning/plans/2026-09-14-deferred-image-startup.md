# Deferred image-processing startup experiment

Status: local checks and hosted admission smoke checks pass; cold-start benefit
and hosted first image use remain unmeasured. Owner:
gh#1171, existing branch `codex/gh-1171-inline-turn-preview`. No production
deployment or live test records were created. The separate six-message
production preparation baseline still requires explicit approval following
automatic approval review's rejection.

## Finding and decision

The current compiled Eve admission function loaded Sharp before handling a
plain-text request. Its eager callers were SMS BMP conversion and Library cover
rendering/inspection. A fresh local Node 24 CPU profile attributed 960.58ms to
the native loader beneath `@img/sharp-darwin-arm64/index.cjs`. This identifies a
real startup dependency, not the size of its Linux hosted cost.

Both callers now use `lib/sharp-loader.ts`, whose literal dynamic import remains
visible to Next and Eve packaging. Native image processing loads on first image
use; existing conversion settings and failure handling remain intact. Eve's
existing external dependency configuration already includes Sharp. No model,
reasoning level, authentication, persistence, or tool execution rule changed.

## Evidence and limitations

Three credential-free local processes before the change imported the compiled
admission entry in 2475.85, 538.11, and 556.75ms. After the change, three fresh
processes took 505.86, 505.64, and 515.53ms. Native-library loading appeared in
all original profiles and none of the changed profiles. Each process made two
in-memory unauthenticated requests that returned 401. Network attempts and
forbidden effects were empty in all six runs.

These runs were sequential on macOS with uncontrolled disk caches. The first
original process was much slower than the subsequent original processes. Do
not subtract the first measurements and claim a two-second app improvement,
or count these import timings toward the five-second Send-to-answer target.
The defensible result is that eager native image loading was removed.

The isolated deployment-package check copied each complete server and workflow
function outside the workspace. Both imported without loading Sharp, then
created and decoded a JPEG through Sharp and rendered a red PDF page through
PDF.js and canvas. Import times were 447.48ms and 481.83ms respectively. These
are also local package measurements, not hosted requests.

The first version of this check failed because it resolved Sharp's CommonJS
export while the application uses its ESM export. Eve correctly traced the
ESM files. The corrected check resolves and imports the same ESM entry as the
application and passes in both isolated functions. Keep the failure as test
development evidence, not a claim that an unshipped application broke on Vercel.

Validation: 37 distinct focused tests passed across Library covers, SMS
attachments, and PDF startup. The new BMP regression passes real bytes through
the attachment normalizer and confirms the decoded pixel remains red. Web
typecheck, focused lint, Next build, Eve build, and stream-duration guard passed.
No external services were used by the attachment test.

Local evidence:
`/private/tmp/homa-preparation-startup-20260914/deferred-sharp-receipt.json`,
`deferred-sharp-build-receipt.json`, and `package-check.log` in that directory;
raw profiles in `/private/tmp/homa-five-second-active/startup-investigation/`.

## Remaining unknowns

- Measure the actual hosted cold-start cost on matched source previews before
  attributing any Send-to-answer improvement to this change.
- Inspect the approved live baseline once explicit production test approval
  arrives. Preview startup behavior does not establish production behavior.
- Check the hosted first image use before release. Local isolated packaging
  covers dependency tracing and real image output, but not Vercel's Linux host.
- Keep Astra medium and the requirement that 19 of 20 ordinary replies show a
  useful answer within five seconds. This experiment does not establish that.

## Hosted admission comparison

Two source-only protected previews reached READY on September 14, 2026 UTC:

- Updated `5c3c42851272b599dbadf75f4b5cdecca66b7c97`:
  `dpl_Gka75MG7UaQVfNkFhRk1Qg9AQyC9`,
  https://homa-2caxdt2z0-homa-1d878b0e.vercel.app.
- Control `b1689ffe0602ca9123edc035b76953d0b74c5fd9`:
  `dpl_AAScYRWW87aPr3qPLpBFKmcdmzjh`,
  https://homa-i6kvv5jge-homa-1d878b0e.vercel.app.

Both use Eve 0.19.0, AI 7.0.14, Node 24, and the same explicit build/runtime
flags: deferred user indexing, model timing, sandbox timing, live progress and
claim extraction enabled; model racing, inline turns, priority service and
chat warmup disabled. Tracked source and dependency bytes were verified before
upload. Local disk exhaustion interrupted the first control staging attempt;
only this turn's incomplete and unused temporary copies were removed before
staging one verified source copy per version. No partial source was deployed.

The fixed sequence was updated first, control first, control repeat, updated
repeat. Each POST `/eve/v1/session` had an empty JSON object and no Homa
authorization. All four returned the expected 401 before conversation creation.
There were no retries or warmups. Curl request-to-first-byte measurements:

| Version | First request | Repeat |
| --- | ---: | ---: |
| Updated | 339ms | 161ms |
| Control | 304ms | 133ms |

These exclude the CLI's authentication/setup time and include connection/TLS
time. They are not answer TTFT and do not establish a warm-request improvement.
The first requests' Vercel panels both report **Hot (prewarmed)**, despite being
protected previews. Updated: 64ms execution, 166ms platform response, 381MB peak.
Control: 62ms execution, 140ms platform response, 388MB peak. Both had concurrency
one and no outgoing API requests. Exact request IDs:

- Updated: `c2q99-1789346410881-67d051fe98ea`.
- Control: `dvrgp-1789346435757-63396e574716`.

Blindspot: a new preview deployment is not a reliable cold-start experiment.
Inspect the request's actual start type; do not infer coldness from deployment
age or infer that all previews lack prewarming from production-focused docs.
The next measurement must separate observed cold and prewarmed requests, retain
both, and include real authenticated preparation before drawing a user-latency
conclusion. Hosted image first use remains a separate release check.

Evidence: `hosted-startup-protocol.json`, `hosted-startup-results.json`, the four
`*-startup-*.json` samples and both `*-startup-panel.txt` snapshots in
`/private/tmp/homa-preparation-startup-20260914/`. Deployment/source receipts live
in `/private/tmp/homa-eve-hosted-5c3c4285/` and
`/private/tmp/homa-eve-hosted-b1689ffe/`. Production-test approval remains pending;
this comparison created no Homa accounts, conversations or model requests.
