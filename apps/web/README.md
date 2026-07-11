# web

The one deployable: Homa's marketing site, onboarding flow, authenticated
product, API routes, and eve agent in one Next.js App Router application.

Start at the repo root: `AGENTS.md` for commands and laws, `BUILD.md` for
the build phases. This README covers only what is specific to this package.

## Run it

```bash
pnpm install            # from the repo root
cp apps/web/.env.example apps/web/.env.local   # then fill in values
pnpm --filter web dev   # http://localhost:3000
```

## Layout

- `app/` includes `/`, `/onboarding`, `/blog`, `/privacy`, `/terms`,
  `/signin`, and `/join`. Internal onboarding code retains the earlier map
  name in `/api/map/*` and `lib/map/`.
- Authenticated routes live under `/app`: `/app` is chat, `/app/report`
  resolves the current child report, `/app/[childId]/report` renders one
  report, and planner, tasks, child, and settings surfaces have their own
  routes. Settings includes saved memories and adult membership controls.
- `agent/` contains the eve instructions, tools, channel adapters, schedules,
  and hooks. A source prompt does not prove that an external provider has
  been re-provisioned with its current bytes.
- `lib/map/` owns onboarding and report data. Onboarding writes directly to
  family and child data after the ONE WORLD retirement of the `lead_*` tables.
  `lib/agent-db.ts` uses caller JWT plus RLS for web chat and authenticated
  family-pinned access for server-originated channels; M1-02 owns the remaining
  transaction-local role hardening.
- `components/marketing/` landing sections, ported from
  `docs/homa-design/ui_kits/landing/` (tokens hand-copied into
  `app/globals.css` until `packages/design` lands, ticket M1-17).
- `vercel.json` registers the hourly `/api/map/cron` request. Registration does
  not prove successful production execution.

## Guards

Use the current root command list in `AGENTS.md`. Agent-module changes also
require `pnpm --filter web exec eve build`. Do not infer that CI passed from
the workflow definition; inspect the actual run.

## Public summary ownership

`public/llms-full.txt` is the canonical long public product summary.
`public/llms.txt` is a condensed derivative and must not introduce a product
claim that is absent from the long summary. Public claims require the same
policy, repository, and production evidence recorded in the reconciliation
ledger.
