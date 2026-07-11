# Native media service design

Status: approved by the founder on 2026-07-11.

## Purpose

Homa needs a durable way to run trusted workloads that require operating-system
packages. The first workload conforms short or low-resolution parent videos for
Twelve Labs with ffmpeg and ffprobe. The architecture must also support later
media capabilities without moving native binaries into the public Next.js
deployment or exposing arbitrary command execution.

The initial product behavior remains narrow:

- A clip rejected by Twelve Labs for duration or resolution is conformed once.
- A clip shorter than four seconds holds its final frame and pads audio with
  silence until five seconds.
- A clip below the 360-pixel floor is upscaled while preserving its aspect
  ratio.
- Homa retries Twelve Labs once with the conformed MP4.
- Existing fail-soft behavior remains when conformance or analysis fails.

## Product expansion this architecture preserves

The media service is an enabling tier, not a promise to ship every possible
media feature. The strongest future uses are grounded in Homa's existing
product contract and tester evidence:

1. **Video-to-observation.** A parent sends a clip, Homa identifies the activity,
   records an honest observation, and logs school time.
2. **Evidence timeline and portfolio.** Opted-in photos, thumbnails, work
   samples, and short clips accrue against a child's existing observations.
3. **Worksheet feedback loop.** A parent sends a clip of a child using a Homa
   material. Homa extracts the relevant evidence and adjusts the next version.
4. **Lesson recap.** Homa creates an analysis proxy and audio track from a
   longer recording, then summarizes activity and time.
5. **Private growth recap.** Explicitly retained milestone clips can be trimmed
   and composed into a weekly or monthly family recap.
6. **Portfolio export.** Evidence artifacts and generated materials can become
   a private, parent-controlled export.
7. **Privacy and accessibility transforms.** Metadata stripping, rotation,
   compression, captions, audio normalization, muting, and later
   user-directed region blurring can be named operations.

Face recognition remains permanently banned by the PRD. Child-voice grading
and diagnosis are outside this module's purpose.

## Options considered

### Static binaries inside the web function

Bundling `ffmpeg-static` and `ffprobe-static` into the existing Next.js
function is the smallest immediate change, especially now that Vercel Large
Functions support packages up to 5 GB. It was rejected as the platform
architecture because every new operating-system dependency would enlarge and
couple the public web deployment.

### Vercel Sandbox per job

Sandbox supports custom images, root access, snapshots, and Docker. It remains
the correct tier for untrusted, user-generated, or AI-generated execution. It
was rejected for trusted media transforms because each request would gain a
sandbox lifecycle, control-plane calls, and separate billing without improving
the operation's interface.

### Private container Function service

Vercel Services can deploy the existing Next.js app and a Docker-backed
Function in one project. Services are private unless a top-level rewrite
exposes them. A service binding injects the media service's internal URL into
the web service.

This is the selected architecture.

## Architecture

### Deployment topology

The Vercel project becomes a services deployment rooted at the repository:

- `web`: `apps/web`, Next.js 16 plus eve. It owns all public routes.
- `media`: `apps/media-worker`, a private container Function. No public rewrite
  targets it.

The web service receives a binding URL in `HOMA_MEDIA_SERVICE_URL`. Calls use
Vercel's internal service network. The media service can later move to a
separate project without changing product callers because the binding URL is
behind a web-side adapter.

The current `apps/web/vercel.json` cron configuration is preserved during the
preview migration. The final production cutover moves routing and cron
ownership to the repository-root `vercel.json` in the same deploy that changes
the Vercel project's Root Directory. No production root setting changes ahead
of committed code.

### Code modules

- `apps/media-worker/`: HTTP server, Dockerfile, operation registry, process
  runner, resource limits, and health metadata.
- `packages/media/`: versioned wire schemas, operation names, preset names, and
  pure ffmpeg planning rules shared by the web and media services.
- `apps/web/lib/video/pad.ts`: stable product-facing interface. It selects the
  bound media adapter in deployed environments and the local process adapter
  during ordinary local development.

The external seam remains:

```ts
conformVideoToFloors(bytes, context?): Promise<ArrayBuffer | null>
```

Callers do not learn container URLs, ffmpeg arguments, temp-file rules, or
transport details.

### Operation registry

The media service accepts named, versioned operations only. The first operation
is `media.conform.twelvelabs-input.v1`.

The service never accepts:

- shell strings
- executable names
- raw ffmpeg arguments
- arbitrary output paths
- arbitrary network URLs

Future operations may include `media.inspect.v1`, `media.thumbnail.v1`,
`media.extract-audio.v1`, `media.clip.v1`, and `media.compose.v1`. Each new
operation gets its own schema, handler, limits, tests, and review.

Unrelated dependency groups should become separate services instead of making
one kitchen-sink image. A later document service may contain LibreOffice,
Tesseract, or document sanitizers. Untrusted execution remains in Sandbox.

## Data flow

1. The web service sends the original source to Twelve Labs.
2. Only a machine-readable `video_duration_too_short` or
   `video_resolution_too_low` rejection enters the conformance path.
3. The web adapter calls the private media service.
4. Small MMS clips use an inline source under the service request cap.
5. Web-uploaded clips use a Homa Blob reference plus the auth-derived family ID.
6. The media service validates source type, byte limit, Blob host, and
   `families/{familyId}/` path before reading anything.
7. The service downloads or decodes the source to an isolated temp directory.
8. ffprobe produces metadata. A pure planner chooses the approved preset.
9. ffmpeg receives local file paths only and writes one MP4 output.
10. The service streams the result and non-sensitive metadata to the web
    adapter.
11. The web service retries Twelve Labs once.
12. Temp files are removed in `finally`, whether the operation succeeds,
    times out, or fails.

Future large-output operations may return Blob artifact references. That
transport is not needed by the first operation and is not implemented now.

## Security and privacy

- The media service has no public route.
- `familyId` is resolved by web auth, never model input.
- Blob sources must use HTTPS, Homa's Blob hostname, and the caller family's
  path prefix.
- ffmpeg and ffprobe receive local files, never remote URLs.
- Process arguments are built from a fixed preset. No user text reaches a
  command argument.
- Input bytes, duration, dimensions, CPU time, and output bytes are capped.
- Child media and URLs never enter logs. Logs contain request ID, operation,
  byte counts, dimensions, elapsed time, and outcome only.
- Temp directories are unique per request and always removed.
- Errors return stable codes and no subprocess stderr containing media paths.
- The service fails closed on malformed sources and the product caller remains
  fail-soft.
- Future retained evidence requires the existing dedicated consent posture.
  Conformance itself is ephemeral and creates no durable family record.

## Local development

`pnpm dev` starts the web and media workspaces. The media worker uses host
ffmpeg during ordinary development. `vercel dev -L` is the canonical test of
service bindings and container routing. The web adapter may use a documented
localhost URL only in development.

The Vercel CLI is upgraded to the current v55 release before services work.

## Verification

Local verification covers:

- shared schema and preset tests
- duration-only conformance
- resolution-only conformance
- combined duration and resolution conformance
- silent clips and clips with audio
- malformed input, byte cap, timeout, and cleanup
- normal clips avoiding unnecessary conformance
- container image build and health check
- full Homa typecheck, lint, build, eve build, and existing guards

Preview verification covers:

- both services build in one deployment
- the media service has no public rewrite
- the web service receives its private binding
- the bound health probe reports ffmpeg and the operation version
- a synthetic short clip crosses the real binding, becomes a valid MP4 of at
  least five seconds, and is accepted by Twelve Labs
- runtime logs contain no media URL or content

## Durable project guidance

The implementation updates:

- `AGENTS.md` with the native-workload decision rule
- `README.md` with the media worker and shared media package
- `BUILD.md` with the multi-service deployment topology
- `docs/homa-planning/05-vercel-platform-facts.md` with June 2026 Container
  Images, VCR, Services, Large Functions, and Sandbox distinctions
- `docs/homa-planning/runbooks/container-workloads.md` with setup, security,
  local development, preview verification, and production cutover procedures
- `docs/homa-planning/build-log.md` with the founder decision and evidence

The standing decision rule is:

1. Use an ordinary Function for trusted code that fits the standard runtime.
2. Use a container Function service for trusted workloads with fixed OS
   packages or language runtimes.
3. Use Sandbox for untrusted or dynamically generated execution.
4. Add Workflow or Queues when work must survive requests, retry durably, or
   run beyond the synchronous interaction budget.

## Risks and reversibility

Vercel Services and Large Functions are beta features in July 2026. The
web-side adapter makes the selected topology reversible:

- If Services is unavailable, deploy the same image as a separate Vercel
  project and set the adapter URL.
- If the container path regresses, the local ffmpeg adapter remains available
  for diagnosis and SMS retains its audio-transcription fallback.
- No database migration or durable media retention is introduced by this
  architecture.
