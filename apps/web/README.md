# web

The one deployable: the Homa marketing site, lead-magnet onboarding flow,
and product surfaces (auth, home, chat), a Next.js App Router app with the
eve agent mounted inside it via `withEve()` (see `agent/`).

Start at the repo root: `AGENTS.md` for commands and laws, `BUILD.md` for
the build phases. This README covers only what is specific to this package.

## Run it

```bash
pnpm install            # from the repo root
cp apps/web/.env.example apps/web/.env.local   # then fill in values
pnpm --filter web dev   # http://localhost:3000
```

## Layout

- `app/` routes: `/` marketing page, `/onboarding` lead magnet (internal
  code says "map": `/api/map/*`, `lib/map/`, kept on purpose through the
  rename), `/blog`, `/privacy`, `/terms`, `/signin`, and the signed-in
  app under one `/app` prefix (`/app` dashboard, `/app/chat`,
  `/app/planner`, `/app/kids/[childId]`, `/app/settings`; old top-level
  paths redirect).
- `agent/` the eve agent: `instructions.md` persona, `tools/`, `channels/`.
- `lib/map/` lead-magnet data layer (server-only Postgres, deny-all RLS
  tables). `lib/agent-db.ts` caller-scoped DB access for agent tools.
- `components/marketing/` landing sections, ported from
  `docs/homa-design/ui_kits/landing/` (tokens hand-copied into
  `app/globals.css` until `packages/design` lands, ticket M1-17).
- `vercel.json` hourly cron hitting `/api/map/cron` (needs `CRON_SECRET`).

## Guards

Run from the repo root: `pnpm typecheck`, `pnpm lint`, `pnpm check:map`,
`pnpm check:events`, `pnpm check:skills-targeting`, `pnpm check:isolation`.
CI runs all of them; keep it green.
