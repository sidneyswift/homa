# Native Media Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development or superpowers:executing-plans to
> implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Add a private Docker-backed Vercel media service that conforms
under-floor videos with ffmpeg, preserves the current video gateway interface,
and establishes the durable project pattern for trusted native workloads.

**Architecture:** The public Next.js service calls a private media service
through a Vercel service binding. Shared schemas and pure planning rules live in
`@homa/media`; the media worker owns ffmpeg execution and exposes named,
versioned operations only. Local development retains a host-ffmpeg adapter,
while deployed code uses the private service.

**Tech Stack:** TypeScript, Node.js 24, Zod 4, Node test runner, pnpm
workspaces, Turborepo, Docker, Debian slim, ffmpeg/ffprobe, Vercel Services,
Container Images, VCR, Fluid Compute, Next.js 16.

**Working-tree note:** This repository contains substantial founder-owned and
parallel-agent changes. Do not reset, stash, or rewrite unrelated files. Commit
steps are intentionally omitted because no commit was requested.

---

## File structure

### Shared media package

- Create `packages/media/package.json`: workspace package metadata and scripts.
- Create `packages/media/tsconfig.json`: strict server-side TypeScript config.
- Create `packages/media/src/contracts.ts`: versioned operation and source
  schemas.
- Create `packages/media/src/conform-plan.ts`: pure decision and ffmpeg
  argument planning.
- Create `packages/media/src/node/process-runner.ts`: bounded child-process
  execution.
- Create `packages/media/src/node/conform-local.ts`: temp-file lifecycle,
  ffprobe, ffmpeg, and cleanup.
- Create `packages/media/src/index.ts`: narrow package exports.
- Create `packages/media/src/conform-plan.test.ts`: pure planner tests.
- Create `packages/media/src/contracts.test.ts`: schema and source-boundary
  tests.
- Create `packages/media/src/node/conform-local.test.ts`: real ffmpeg tests.

### Private media worker

- Create `apps/media-worker/package.json`: container worker workspace package.
- Create `apps/media-worker/tsconfig.json`: strict Node config.
- Create `apps/media-worker/Dockerfile.vercel`: reproducible Node plus ffmpeg
  image.
- Create `apps/media-worker/src/source-loader.ts`: inline and Homa Blob source
  loading.
- Create `apps/media-worker/src/operation-registry.ts`: explicit operation
  dispatch.
- Create `apps/media-worker/src/server.ts`: HTTP lifecycle, health, errors, and
  binary response streaming.
- Create `apps/media-worker/src/source-loader.test.ts`: SSRF, family-prefix,
  byte-cap, and timeout tests.
- Create `apps/media-worker/src/server.test.ts`: health, operation, error, and
  content-log tests.

### Web adapter and video gateway

- Replace internals in `apps/web/lib/video/pad.ts`: remote service adapter plus
  local adapter selection.
- Modify `apps/web/lib/video/twelvelabs.ts`: pass a typed inline or Homa Blob
  source into conformance.
- Modify `apps/web/app/api/video/describe/route.ts`: pass the auth-derived
  family ID into URL analysis.
- Modify `apps/web/scripts/twelvelabs-smoke.mts`: support local and deployed
  worker verification without weakening production URL checks.
- Modify `apps/web/package.json`: add `@homa/media`.
- Modify `apps/web/next.config.ts`: transpile `@homa/media`.
- Create `apps/web/app/api/internal/media-health/route.ts`: CRON_SECRET-gated
  binding and capability probe.

### Deployment, CI, and durable guidance

- Create `vercel.json`: repository-root services topology, binding, public web
  routing, and existing cron.
- Preserve `apps/web/vercel.json` until production Root Directory cutover.
- Modify `.github/workflows/ci.yml`: shared tests and Docker build.
- Modify `turbo.json`: cache media package output only if emit is introduced.
- Modify `AGENTS.md`: trusted native workload decision rule.
- Modify `README.md`: repo map entries for media worker and package.
- Modify `BUILD.md`: one Vercel deployment with private services.
- Modify `docs/homa-planning/05-vercel-platform-facts.md`: June 2026 platform
  facts.
- Create `docs/homa-planning/runbooks/container-workloads.md`: durable setup,
  security, and cutover procedure.
- Modify `docs/homa-planning/build-log.md`: founder decision and verification
  evidence.
- Modify `apps/web/.env.example`: binding and local development behavior.

---

### Task 1: Upgrade and verify the Vercel CLI

**Files:** None.

- [ ] **Step 1: Record the baseline**

Run:

```bash
vercel --version
```

Expected baseline: `54.18.7`.

- [ ] **Step 2: Upgrade globally**

Run:

```bash
npm install --global vercel@latest
```

Expected: command exits zero.

- [ ] **Step 3: Verify current CLI and authentication**

Run:

```bash
vercel --version
vercel whoami
```

Expected: Vercel CLI `55.0.0` or newer and authenticated username
`sidneysyncstream`.

### Task 2: Create the shared operation contract and pure conform planner

**Files:**

- Create: `packages/media/package.json`
- Create: `packages/media/tsconfig.json`
- Create: `packages/media/src/contracts.ts`
- Create: `packages/media/src/conform-plan.ts`
- Create: `packages/media/src/index.ts`
- Test: `packages/media/src/contracts.test.ts`
- Test: `packages/media/src/conform-plan.test.ts`

- [ ] **Step 1: Write failing contract tests**

Cover these exact cases with `node:test` and `assert`:

```ts
it("accepts the versioned Twelve Labs conform operation", () => {
  const parsed = mediaConformRequestSchema.parse({
    operation: "media.conform.twelvelabs-input.v1",
    requestId: "7f74fb44-6ad8-4e86-8021-a9b19b7f2bc8",
    source: {
      kind: "inline",
      mediaType: "video/mp4",
      base64: Buffer.from("video").toString("base64"),
    },
  });
  assert.equal(parsed.operation, MEDIA_CONFORM_OPERATION);
});

it("rejects arbitrary operation names and URL source kinds", () => {
  assert.equal(
    mediaConformRequestSchema.safeParse({
      operation: "shell.exec",
      requestId: crypto.randomUUID(),
      source: { kind: "url", url: "https://example.com/file.mp4" },
    }).success,
    false,
  );
});
```

Planner tests must cover:

- duration 2.5s, 480x480, audio true: pad to 5s and add `apad`
- duration 8s, 200x200, audio false: scale only and add `-an`
- duration 2.5s, 200x200: pad and scale
- duration 8s, 480x480: return `null`
- non-finite duration and zero dimensions: reject metadata

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm exec tsx --test packages/media/src/contracts.test.ts packages/media/src/conform-plan.test.ts
```

Expected: FAIL because the package modules do not exist.

- [ ] **Step 3: Implement schemas and pure planner**

Use the fixed public names:

```ts
export const MEDIA_CONFORM_OPERATION =
  "media.conform.twelvelabs-input.v1" as const;

export const mediaSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("inline"),
    mediaType: z.string().startsWith("video/"),
    base64: z.string().min(1).max(4 * 1024 * 1024),
  }),
  z.object({
    kind: z.literal("homa_blob"),
    url: z.url(),
    familyId: z.uuid(),
  }),
]);

export const mediaConformRequestSchema = z.object({
  operation: z.literal(MEDIA_CONFORM_OPERATION),
  requestId: z.uuid(),
  source: mediaSourceSchema,
});
```

The pure planner returns `null` for compliant media or a structure containing
`videoFilters`, `audioArgs`, `durationArgs`, and `outputArgs`. It owns the 4s
floor, 5s target, 360-pixel floor, H.264, AAC, `yuv420p`, `veryfast`, and
`+faststart` constants.

- [ ] **Step 4: Run tests and verify GREEN**

Run the Task 2 test command.

Expected: all contract and planner tests pass.

- [ ] **Step 5: Typecheck the package**

Run:

```bash
pnpm --filter @homa/media typecheck
```

Expected: exit zero.

### Task 3: Move local ffmpeg execution behind the shared package

**Files:**

- Create: `packages/media/src/node/process-runner.ts`
- Create: `packages/media/src/node/conform-local.ts`
- Test: `packages/media/src/node/conform-local.test.ts`
- Modify: `packages/media/package.json`

- [ ] **Step 1: Write real ffmpeg integration tests**

Generate synthetic fixtures with ffmpeg in the test temp directory and assert:

```ts
const result = await conformMediaLocally(shortClip, {
  ffmpegPath: "ffmpeg",
  ffprobePath: "ffprobe",
});
assert.ok(result);
assert.ok(result.metadata.durationSeconds >= 5);
assert.equal(result.metadata.width, 480);
assert.equal(result.metadata.height, 480);
```

Add tests for resolution-only, combined floors, silence, malformed bytes,
timeout, and temp-directory cleanup.

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
pnpm exec tsx --test packages/media/src/node/conform-local.test.ts
```

Expected: FAIL because `conformMediaLocally` does not exist.

- [ ] **Step 3: Implement the bounded process runner and local adapter**

Move the behavior currently in `apps/web/lib/video/pad.ts` into
`packages/media/src/node/conform-local.ts`. Accept dependency options:

```ts
export interface LocalConformOptions {
  ffmpegPath: string;
  ffprobePath: string;
  timeoutMs?: number;
}

export async function conformMediaLocally(
  bytes: ArrayBuffer,
  options: LocalConformOptions,
): Promise<ConformMediaResult | null>;
```

Keep subprocess arguments as arrays, never shell strings. Limit stderr capture
to 8 KB. Kill on timeout. Create one `mkdtemp` directory per request and remove
it in `finally`.

- [ ] **Step 4: Run test and typecheck**

Run:

```bash
pnpm exec tsx --test packages/media/src/node/conform-local.test.ts
pnpm --filter @homa/media typecheck
```

Expected: all pass.

### Task 4: Build the private media worker and container

**Files:**

- Create: `apps/media-worker/package.json`
- Create: `apps/media-worker/tsconfig.json`
- Create: `apps/media-worker/src/source-loader.ts`
- Create: `apps/media-worker/src/operation-registry.ts`
- Create: `apps/media-worker/src/server.ts`
- Create: `apps/media-worker/Dockerfile.vercel`
- Test: `apps/media-worker/src/source-loader.test.ts`
- Test: `apps/media-worker/src/server.test.ts`

- [ ] **Step 1: Write source-loader and server tests**

Tests must prove:

- inline source decodes only video media types and stays below its decoded cap
- Blob source requires HTTPS
- hostname ends exactly in `.public.blob.vercel-storage.com`
- pathname begins `/families/{familyId}/`
- redirects to another hostname are rejected
- response over the byte cap is aborted
- registry rejects every unknown operation
- `/healthz` lists `media.conform.twelvelabs-input.v1` and ffmpeg versions
- errors never include source URLs, family IDs, temp paths, or subprocess stderr

- [ ] **Step 2: Run worker tests and verify RED**

Run:

```bash
pnpm exec tsx --test apps/media-worker/src/source-loader.test.ts apps/media-worker/src/server.test.ts
```

Expected: FAIL because worker modules do not exist.

- [ ] **Step 3: Implement source loading and operation registry**

Use `mediaConformRequestSchema` from `@homa/media`. Keep the registry explicit:

```ts
const handlers = {
  [MEDIA_CONFORM_OPERATION]: handleMediaConform,
} satisfies Record<MediaOperation, MediaOperationHandler>;
```

Blob fetches use `redirect: "manual"`, a 30s abort signal, content-length
precheck, streaming byte count, and the family path predicate before fetch.

- [ ] **Step 4: Implement the HTTP server**

Routes:

- `GET /healthz`: operation list, Node version, ffmpeg version, ffprobe version
- `POST /self-test`: generate a synthetic 2.5-second clip with ffmpeg's local
  `lavfi` source, run it through the registered conform operation, and stream
  the conformed MP4 with synthetic input/output metadata in response headers
- `POST /v1/operations`: parse request, load source, run named handler, stream
  MP4 on success
- all others: 404

Set `Content-Type: video/mp4`,
`X-Homa-Media-Operation`, `X-Homa-Media-Request-Id`, and transformation
metadata headers. JSON errors use stable codes: `invalid_request`,
`source_rejected`, `media_invalid`, `operation_timeout`, and
`operation_failed`.

- [ ] **Step 5: Add the container image**

The final image uses `node:24-bookworm-slim`, installs only
`ffmpeg` and `ca-certificates`, runs as a non-root user, exposes `$PORT`, and
starts `node src/server.ts`. Build context is the repository root so pnpm can
deploy `apps/media-worker` with its `@homa/media` dependency.

- [ ] **Step 6: Run worker tests and build the image**

Run:

```bash
pnpm exec tsx --test apps/media-worker/src/source-loader.test.ts apps/media-worker/src/server.test.ts
pnpm --filter media-worker typecheck
docker build -f apps/media-worker/Dockerfile.vercel -t homa-media-worker:test .
```

Expected: tests and typecheck pass; Docker exits zero.

- [ ] **Step 7: Run the container health probe**

Run the image on port 3101, request `/healthz`, then stop it.

Expected JSON includes:

```json
{
  "ok": true,
  "operations": ["media.conform.twelvelabs-input.v1"]
}
```

### Task 5: Replace the web padding implementation with adapters

**Files:**

- Modify: `apps/web/lib/video/pad.ts`
- Modify: `apps/web/lib/video/twelvelabs.ts`
- Modify: `apps/web/app/api/video/describe/route.ts`
- Modify: `apps/web/scripts/twelvelabs-smoke.mts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/next.config.ts`
- Test: `apps/web/lib/video/pad.test.ts`

- [ ] **Step 1: Write adapter-selection tests**

Inject fetch and environment state rather than mutating globals. Assert:

- binding URL present: remote adapter is called
- production with no binding: returns null and never spawns
- development with no binding: local adapter runs
- remote 200: returns MP4 bytes
- remote 204: returns null
- remote 4xx/5xx, timeout, invalid content type, or oversized output: returns
  null
- Blob source carries the auth-derived family ID

- [ ] **Step 2: Run test and verify RED**

Run:

```bash
pnpm exec tsx --test apps/web/lib/video/pad.test.ts
```

Expected: FAIL against the current direct-process implementation.

- [ ] **Step 3: Implement the deep web interface**

Keep the existing bytes call and add one Blob call:

```ts
export async function conformVideoToFloors(
  bytes: ArrayBuffer,
): Promise<ArrayBuffer | null>;

export async function conformFamilyBlobVideoToFloors(input: {
  url: string;
  familyId: string;
}): Promise<ArrayBuffer | null>;
```

Both use one private `requestMediaConformance(source)` adapter. Remote service
selection reads `HOMA_MEDIA_SERVICE_URL`. Development may call
`conformMediaLocally`; production may not.

- [ ] **Step 4: Thread the Blob source through Twelve Labs**

Add `familyId?: string` to `DescribeVideoOptions`. When a URL analysis receives
a conformable error and `familyId` exists, call
`conformFamilyBlobVideoToFloors`. The describe route passes
`auth.familyId`. The smoke script's arbitrary URL mode remains local-only and
downloads to the inline adapter.

- [ ] **Step 5: Run focused tests and checks**

Run:

```bash
pnpm exec tsx --test apps/web/lib/video/pad.test.ts
pnpm --filter web typecheck
pnpm --filter web lint
```

Expected: all pass.

### Task 6: Configure Vercel Services and the private binding

**Files:**

- Create: `vercel.json`
- Preserve: `apps/web/vercel.json`
- Create: `apps/web/app/api/internal/media-health/route.ts`
- Modify: `apps/web/.env.example`

- [ ] **Step 1: Add repository-root services configuration**

Define:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "web": {
      "root": "apps/web",
      "framework": "nextjs",
      "bindings": [
        {
          "type": "service",
          "service": "media",
          "format": "url",
          "env": "HOMA_MEDIA_SERVICE_URL"
        }
      ]
    },
    "media": {
      "root": ".",
      "runtime": "container",
      "entrypoint": "apps/media-worker/Dockerfile.vercel"
    }
  },
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": { "service": "web" }
    }
  ],
  "crons": [
    {
      "path": "/api/map/cron",
      "schedule": "0 * * * *"
    }
  ]
}
```

There is deliberately no public rewrite to `media`.

- [ ] **Step 2: Add the gated health bridge**

`GET /api/internal/media-health` requires
`Authorization: Bearer ${CRON_SECRET}`, calls the private `/healthz`, caps its
response, and returns only versions and operation names. `POST` applies the
same gate, calls the private `/self-test`, sends the returned synthetic MP4
through `describeVideoBytes`, and returns only synthetic metadata plus the
Twelve Labs description. Neither method accepts family media.

- [ ] **Step 3: Validate local Services routing**

Run:

```bash
vercel dev -L
```

With `CRON_SECRET` from `.env.local`, call the health bridge.

Expected: web responds, binding resolves, media health lists the conform
operation, and no direct public route reaches the media service.

### Task 7: Make the architecture durable in CI and project guidance

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `BUILD.md`
- Modify: `docs/homa-planning/05-vercel-platform-facts.md`
- Create: `docs/homa-planning/runbooks/container-workloads.md`
- Modify: `docs/homa-planning/build-log.md`

- [ ] **Step 1: Add CI coverage**

After install, add media tests and a Docker build:

```yaml
- name: Native media tests
  run: pnpm exec tsx --test packages/media/src/*.test.ts packages/media/src/node/*.test.ts apps/media-worker/src/*.test.ts

- name: Media worker container
  run: docker build -f apps/media-worker/Dockerfile.vercel -t homa-media-worker:ci .
```

- [ ] **Step 2: Add the standing decision rule to `AGENTS.md`**

Record:

- ordinary Function for standard trusted code
- container Function service for trusted fixed OS dependencies
- Sandbox for untrusted or dynamic execution
- Workflow/Queues for durable or long-running jobs
- no arbitrary shell operation in a product container
- new container services remain private unless a founder-approved public route
  requires otherwise

- [ ] **Step 3: Add repo and platform documentation**

Document `apps/media-worker`, `packages/media`, the private binding, June 2026
VCR/Container Images/Services/Large Functions facts, the product opportunities
preserved, local commands, preview flow, and production Root Directory cutover.

- [ ] **Step 4: Check documentation consistency**

Run:

```bash
pnpm check:docs
rg -n "one deployable|Vercel does not|ffmpeg.*absent|add ffmpeg-static" AGENTS.md BUILD.md README.md docs/homa-planning apps/web/lib/video apps/web/.env.example
```

Expected: docs guard passes; stale platform claims are removed or clearly
marked historical.

### Task 8: Run complete local verification

**Files:** No new files.

- [ ] **Step 1: Run all media tests**

```bash
pnpm exec tsx --test packages/media/src/*.test.ts packages/media/src/node/*.test.ts apps/media-worker/src/*.test.ts apps/web/lib/video/pad.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run Homa verification**

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter web exec eve build
pnpm check:isolation
pnpm check:map
pnpm check:events
pnpm check:skills-targeting
pnpm check:taxonomy
pnpm check:docs
```

Expected: every command exits zero.

- [ ] **Step 3: Run live Twelve Labs smoke locally**

Generate a 2.5-second 480x480 clip with speech, run:

```bash
pnpm --filter web exec tsx scripts/twelvelabs-smoke.mts --file /tmp/homa-short.mp4
```

Expected: Twelve Labs first returns `video_duration_too_short`, media
conformance produces a clip of at least 5s, retry returns an honest
description.

### Task 9: Deploy and verify a Vercel preview

**Files:** No new files.

- [ ] **Step 1: Confirm the production setting stays untouched**

Read the current project Root Directory and record it. Do not PATCH the
production project setting during preview verification.

- [ ] **Step 2: Deploy from the repository root**

Run:

```bash
vercel deploy --cwd . --logs
```

Expected: preview deployment builds both `web` and `media`, creates the private
binding, and reaches READY.

- [ ] **Step 3: Probe binding and container health**

Use `vercel curl` or deployment-bypass access to call
`/api/internal/media-health` with `CRON_SECRET`:

```bash
vercel curl /api/internal/media-health \
  --deployment "$PREVIEW_URL" -- \
  --header "Authorization: Bearer $CRON_SECRET"
```

Expected: Node 24, ffmpeg, ffprobe, and
`media.conform.twelvelabs-input.v1` are present.

- [ ] **Step 4: Probe a synthetic short clip through the preview**

Run the private worker's synthetic self-test through the gated web bridge:

```bash
vercel curl /api/internal/media-health \
  --deployment "$PREVIEW_URL" -- \
  --request POST \
  --header "Authorization: Bearer $CRON_SECRET"
```

Expected: the synthetic clip crosses the internal binding and reports a valid
MP4 output of at least five seconds, and Twelve Labs returns a non-empty
description of the synthetic clip.

- [ ] **Step 5: Inspect logs and topology**

Verify:

- no public route targets `media`
- no media URL, family ID, transcript, or bytes appear in logs
- no runtime errors occurred
- temporary files do not persist across requests

- [ ] **Step 6: Report the production cutover gate**

Production cutover requires one atomic action after these changes are committed:

1. move the Vercel project Root Directory from `apps/web` to repository root
2. deploy the commit
3. wait for READY
4. probe live web, cron registration, eve channel, media binding, and short
   video conformance
5. remove `apps/web/vercel.json` in the next cleanup commit

Do not change production Root Directory before the repository-root services
configuration exists in the deployed commit.
