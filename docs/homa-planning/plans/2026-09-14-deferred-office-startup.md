# Defer Office readers until a document needs them

Status: local extraction, packaging and startup checks pass. Hosted comparison
pending. The wider branch's PDF memory guard fails locally and in its previous
CI run. Owner: gh#1171, draft PR #1191. Astra remains on medium. The acceptance
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
limit to pass this experiment. This failure remains open with the owning issue.

The local Eve build skipped sandbox template prewarm without a deployment ID.
Any hosted candidate must therefore build from tracked source, never deploy this
local output as prebuilt.
