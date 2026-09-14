# Deferred image-processing startup experiment

Status: implemented and verified locally; hosted benefit unmeasured. Owner:
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
