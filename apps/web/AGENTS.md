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
