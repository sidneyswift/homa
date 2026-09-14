# Defer Office readers until a document needs them

Status: local extraction, packaging and startup checks pass. The two protected
previews completed eight Sends; none met the useful-answer target. Exact-source
CI passes, while an earlier CI run and the local PDF memory check failed. Owner: gh#1171, draft PR #1191. Astra remains on medium. The acceptance
measure stays Send to first useful visible answer under five seconds for 19/20
normal replies, including preparation and hidden model work.

## Finding-unknowns pass

The task sounds like speeding up a model. The observed preparation outliers also
include starting fresh application processes. Removing unused startup work is a
separate, measurable experiment; it cannot explain or eliminate every model delay.

Three landmines and one measurement boundary:

- **Three eager import paths:** web attachments, Library processing and SMS
  attachments all imported mammoth and xlsx. Changing only the visible web path
  leaves the same readers in the agent's startup graph. Defer all three through
  the shared loader, following `lib/sharp-loader.ts`.
- **Bundled interop:** source-level dynamic imports passing tests do not prove
  Eve's emitted CommonJS conversion still exposes the expected reader APIs.
  Build the actual agent, execute its emitted loader expressions and parse real
  files before staging any hosted experiment.
- **Old Excel character tables:** local profiling identified cpexcel startup
  work, but deleting those tables would lose legacy language support. Keep the
  full parser and check BIFF5 CP1252 as well as Unicode BIFF8/XLSX and DOCX.
- **Startup is part of the wait:** platform Cold durations do not account for
  the whole Send-to-preparation gap. Local import timings omit platform routing,
  Workflow initialization, replay and model execution. A first-document request
  still pays for loading its parser. No hosted speed claim follows from a local
  health request.

The revised implementation keeps the existing parser versions, options, text
limits, family URL checks, download bounds and failure handling. Load Office
readers only inside existing extraction branches. Verify actual formats and the
packaged output, then measure hosted ordinary replies with the same model and
preview switches. Stop the comparison if packaging or authenticated activation
fails. Existing approval covers this reversible implementation and paid synthetic
experiments; this document does not authorize production promotion.

## Platform evidence behind the experiment

The three preparation outliers from the completed skill-linked comparison have
actual platform cold-start labels, inspected in authenticated Vercel request
details. Each had one concurrent execution and a 2048 MB maximum.

| Sample | Route | Platform Cold | Arrival to first preparation mark |
| --- | --- | --- | --- |
| Linked simple reply | Workflow flow | 2.40 s | 4.879 s |
| Linked save | Eve admission | 2.20 s | 3.715 s |
| Control repeated read | Eve admission | 2.25 s | 4.321 s |

Request IDs are `pwhl4-1789371041727-89c93a84d8ae`,
`2znxr-1789371175446-da35ff2b3dc3`, and
`jv7gd-1789371092829-7873300e70c8`, respectively. These explain part of the
preparation wait. They do not prove the remaining interval was queueing, and
platform duration fields should not be assumed additive.

Private detail snapshots are `slow-simple-workflow-startup-detail.txt` and
`slow-save-startup-detail.txt` in `/private/tmp/homa-eve-hosted-2f2fb4cd-linked`,
and `slow-read-startup-detail.txt` in the corresponding `-control` directory.
The earlier production baseline also included a slow Hot execution, so cold
starts are not the sole cause of missed replies.

## Change and local evidence

`apps/web/lib/office-document-loaders.ts` uses literal dynamic imports. Its three
callers load a parser only after their bounded download succeeds. The Library's
spreadsheet extraction helper becomes asynchronous; its public caller was
already asynchronous. There is no model, schema, query, package-version or
permission change.

- 36 web, SMS and Library tests pass. Twelve new format cases exercise actual
  document bytes through all three download seams; Library cases also check
  source sections. Fixtures contain synthetic text only.
- The broader Library suite passes 123 tests; conversation continuity passes
  334. Web typecheck and the production-mode Eve build pass. The stream-duration
  guard passes all three checks with none skipped.
- The actual emitted loader region successfully parses DOCX, XLSX, BIFF8 and
  BIFF5 CP1252, and rejects corrupt DOCX. The check uses the emitted conversion
  helper and only rebases relative module paths for execution. It makes zero
  network calls. This is a packaged-loader check, not a hosted upload test.
- One isolated local before/after sample measured Workflow entry import at
  717.303 ms before and 485.486 ms after. RSS was 379,158,528 and 351,748,096
  bytes. Earlier before samples were about 700 ms, two run concurrently.
  These are nonrandomized macOS Node 24 measurements with disk-cache effects,
  not a hosted performance estimate. The after profile has no Office-named
  frames; the build emits the parsers as separate dynamically imported files.

Raw profile, guard, emitted-loader verification and comparison artifacts live
under `/private/tmp/homa-five-second-active/startup-investigation/`, named
`office-before-isolated-20260914-01`, `office-after-isolated-20260914-01`,
`office-build-verification.json` and `office-profile-comparison.json`.
Other checks use `/private/tmp/homa-office-*.log`.

The preceding evidence-only commit 14eb89a8 failed CI run 34818807319 on the
64 MiB PDF memory guard: 799.574 MiB exceeded 768 MiB. A local disposable-database
run with this change also failed at 834.641 MiB. Functional PDF reading completed,
but the memory requirement did not. Do not report full CI as green or relax the
limit to pass this experiment. The exact-source CI run 34820083283 subsequently passed every required job,
including this guard at 728.996 MiB. This does not erase the local failure or
establish why the earlier run exceeded the limit. The inconsistent memory
result remains recorded with the owning issue.

The local Eve build skipped sandbox template prewarm without a deployment ID.
Any hosted candidate must therefore build from tracked source, never deploy this
local output as prebuilt.


## Completed hosted comparison

Candidate d1db32eca9f65b40b6c632a2a9513691329a3124 and control
2f2fb4cd29aae20f42366211491c6173eb83f680 both reached READY from tracked source.
The only application change between them is the deferred Office reader change;
the intervening commit contains evidence. The deployment records retain exact
tree and archive hashes. Neither targets production.

- Candidate: `dpl_49mF8K8SbT2AQgHsxf4VXtRmnLvR`,
  <https://homa-ppu2166fa-homa-1d878b0e.vercel.app>,
  session `wrun_01M2FEX9X333D79R9MP50KWD81`.
- Control: `dpl_FQgEs3dqz69TySfNfK6qzkKRhTBJ`,
  <https://homa-6xy82smgr-homa-1d878b0e.vercel.app>,
  session `wrun_01M2FF241P5X3NM9SCDEYJ2Y44`.

Both use Astra medium, immediate first-step execution, deferred tools and
user-message indexing. Skill-linked tools, priority, racing and chat warmup
are disabled. Logs confirm 92 deferred tools, 96 advertised tools and zero
skill-linked tools on all eight main model calls per arm. Each actual Workflow
has four completed root turn steps and two completed continuation dispatches.
Both families have eight stored, indexed conversation messages, with all five
recorded tool operations completed. There were no manual retries or excluded Sends.

The protocol was frozen before any Send, then amended before any Send when the
UI disproved the assumption that a new preview means a blank conversation. Both
fresh previews restore family history; the initial visible user-message counts
were 20 and 14. A previously opened old control was signed out without a Send.
Those unequal histories, sequential request timing, different family-data
availability and the small sample prevent a causal or p95 claim.

| Question | Control first text | Candidate first text | Control preparation | Candidate preparation |
| --- | --- | --- | --- | --- |
| Syllable definition | 6.294 to 6.370 s | 13.512 to 13.597 s | 3.881 s | 11.395 s |
| Ten-button counting game | 24.199 to 24.278 s | 21.399 to 21.496 s | 2.569 s | 2.690 s |
| Help with word guessing | 15.357 to 15.447 s | 13.562 to 13.642 s | 6.297 s | 2.245 s |
| Number-bond definition | 4.823 to 4.913 s | 8.413 to 8.496 s | 1.748 s | 2.016 s |

All eight miss first useful answer within five seconds. The apparent exception,
control number-bond text before five seconds, was only "A number". The first
useful definition prefix appeared between 5.161 and 5.244 seconds. Both reading
answers began with a useful direction at their first-text boundary. Other
samples stopped after observing late partial words; their exact useful-answer
time is not measured, but the miss is already established. The observer remained
visible, with no gap over 356 ms. It measures viewport DOM visibility, not
physical display paint.

The ordinary definitions used one model call each, the counting game four, and
reading help two. Both counting-game paths loaded a skill, discovered and read
the child map, then verified the suggested activity before answering. Both
reading-help paths loaded a skill. Time from first agent step to first provider
answer text was 2.009, 18.677, 10.800 and 6.410 seconds for the candidate; control
was 2.437, 21.493, 8.673 and 2.996 seconds. Provider text to observed viewport
text added 52 to 597 ms. The long model intervals include tools and multiple
calls where applicable; they are not estimates of hidden reasoning alone.

### Startup and service stalls

The candidate's first admission request
`xn2ks-1789372830765-e311d1136cfe` was platform **Cold (1.93s)**, peak 381 MB,
concurrency one. The control reading-help admission
`7hkwl-1789373150556-c1a79c2563ad` was **Cold (2.22s)**, peak 402 MB,
concurrency one. These are two different invocations, not a controlled cold-start
benchmark. They are consistent with a smaller startup, but cannot establish its
size or reliability.

The candidate first Send spent 3.011 seconds between admission arrival and the
first authentication mark, then 400 ms authenticating and 1.303 seconds checking
membership. Its family-row read hit the 2.506-second deadline and context loaded
in degraded mode. A parallel stream attachment also timed out authentication at
2.503 seconds and subsequently recovered; do not add that overlapping timeout
to the critical preparation interval. The answer and both messages were saved.
Later candidate family-context loads did not degrade.

Control reading-help waited 4.474 seconds between admission arrival and its first
authentication mark, despite family context subsequently completing in 220 ms.
Thus preparation outliers remain after the Office change. The final candidate
definition also spent 6.410 seconds from agent step to provider text with only
one model call and a large prompt-cache hit. Eliminating document imports alone
cannot meet the target.

### Answer review and retained evidence

The definition and reading answers were usable after they arrived. The counting
answers differed: control practiced one-to-one object counting from the latest
observation, while candidate selected spoken-number practice citing an older
September 13 record. Neither experiment code nor timing proves equal quality;
this is another reason not to promote the trial as a validated improvement.

Private evidence is in `/private/tmp/homa-eve-hosted-d1db32ec-office` and
`/private/tmp/homa-eve-hosted-2f2fb4cd-office-control`: protocol revisions,
source/deployment receipts, original samples, manual prefix reviews, complete
runtime logs, scoped message/model/tool records, actual Workflow steps and full
visible answers. `analysis.json` separates preparation, model/tool time and
delivery. The two cold-start DOM receipts are `first-admission-startup-detail.txt`
and `reading-admission-startup-detail.txt` respectively. All eight Sends remain
in the record. Both synthetic accounts signed out on the first click, verified
on the sign-in screen, and both test tabs were closed. This does not resolve the
separate production sign-out issue gh#1196. No production promotion occurred.

Next investigation: the remaining admission-before-authentication interval and
family-data deadline behavior, separately from sequential model/skill work.
The five-second goal remains active and unmet.
