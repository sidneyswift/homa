<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# apps/web gotchas

- A green `pnpm build` is not a green deploy. Vercel also runs `eve build`,
  which compiles agent tool modules outside Next's bundler, so imports Next
  tolerates (`next/server`, JSON loaders) can still sink the deploy. Before
  pushing changes under `apps/web/agent/`, run
  `VERCEL=1 pnpm --filter web exec eve build` locally, then
  `VERCEL=1 pnpm check:eve-stream-duration` so the shared `/eve/__server`
  stream function keeps `maxDuration: "max"`. CI runs both under `VERCEL=1`.
- Before ANY eve version bump, no exceptions:
  `node scripts/eve-upgrade-check.mjs`, then the procedure in
  `docs/homa-planning/runbooks/eve-version-bump.md`.
- The route map for this app lives in `apps/web/README.md`; do not duplicate
  it here or in the root `AGENTS.md`.

## Prompt authoring and packaging

Edit `apps/web/prompt-sources/voice-rules.md` for shared voice boundaries and
`apps/web/prompt-sources/chat.md`, `apps/web/prompt-sources/report.md`, or `apps/web/prompt-sources/curriculum.md` for role-specific
guidance. Run `pnpm build:agent-prompts` to generate the three Markdown
prompts under `apps/web/agent/` and their report/voice TypeScript bundles. Do not
hand-edit those outputs. `pnpm check:agent-prompts`, included in the existing
instructions CI gate, checks exact generation parity and rejects comments
or unresolved source markers in model-facing text. Runtime Markdown contains
only instructions intended for the model; put maintenance notes here.

Eve embeds `apps/web/agent/instructions.md` as text. Report writing imports
`apps/web/lib/map/report-writer-prompt.generated.ts`. The curriculum insights route
reads `apps/web/agent/curriculum-writer.md`, explicitly included by Next's file tracing.
These are different packaging paths, not files the chat model can open by
reading their repository names. Skills and their references are separately
packaged into the model's workspace.

Voice uses the generated chat persona above `## What you know each turn`.
Keep that heading exactly once, after `## Have opinions`; both
`scripts/build-voice-persona.mts` and the developer-run
`scripts/telnyx-provision.mts` depend on the boundary. The latter configures
the hosted phone assistant and appends `apps/web/agent/phone-rules.md` and
`apps/web/agent/general-call-instructions.md`; deploying web code does not run it.
`pnpm check:instructions-split` verifies this structural dependency.

Any report prompt or report schema change requires a `REPORT_PROMPT_VERSION`
bump in `apps/web/agent/report-writer-version.ts` and regenerated, reviewed narrative
fixtures through `scripts/map-narrative-fixtures.mts`. `pnpm check:map`
checks their version and copy gates. Shared-rule edits affect the report
prompt too. Report and curriculum constraints, such as report pronouns and
single-child scope, remain in their role templates.
