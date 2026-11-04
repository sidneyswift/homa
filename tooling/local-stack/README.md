# Local stack

A private copy of Homa's backend on your Mac: Supabase (database, sign-in,
storage, a mail viewer) with every migration applied, the web app and the
eve agent pointed at it, and three test parents you can sign in as from
the simulator in one tap. Nothing here can reach production.

Use it to test the app at any stage: as a brand-new parent, halfway
through onboarding, or as a family that has used Homa for months.

## One-time setup

1. Install Docker. OrbStack is the lighter choice on a Mac:
   `brew install --cask orbstack`, then open it once.
2. The Supabase CLI: `brew install supabase/tap/supabase`.
3. A dev build of the app in the simulator (`.agents/skills/mobile-simulator/SKILL.md`).
   The local stack changes no native code, so any recent dev build works.

## Every day

```bash
pnpm dev:stack
```

Starts Supabase, applies any migrations it has not seen yet, and on the
very first run seeds the test parents. The first run downloads the
Supabase images and takes a few minutes; after that it starts in seconds.

Then, in two more terminals:

```bash
pnpm dev:stack web
```

```bash
pnpm dev:stack mobile
```

`web` runs the web app on http://localhost:3000 against the local stack.
The app needs it: the phone's chat, onboarding and billing calls all go
to the web server. `mobile` runs Metro with the app pointed at the local
stack instead of production.

In the simulator, the sign-in screen now has a **Local test parents** link
under "Continue with email". Tap a parent and you are in. Or from a
terminal, without touching the simulator:

```bash
pnpm dev:stack open established
```

## The test parents

| Persona | Signs in as | Lands on |
|---|---|---|
| `new` | A brand-new account every tap | The first onboarding screen, with a family the app's own sign-up path just created |
| `onboarding` | `onboarding+homatest@homa.test` | The parent screen of onboarding, with Juno already added |
| `established` | `established+homatest@homa.test` | Chat. Ada and Mateo, consented, comped, three months of hours, notes and memories |

The password for all of them is `homa-local-persona`. It opens nothing
outside this Mac. The roster lives in
`apps/mobile/src/features/dev/local-personas.ts`; the seeding is
`scripts/local-stack-personas.mts`.

To put one back the way it started (for example after finishing
onboarding as `onboarding`):

```bash
pnpm dev:stack persona onboarding
```

`pnpm dev:stack persona all` rebuilds all three.

You can also test the real email-code sign-in: tap "Continue with email",
use any address, and read the code in the mail viewer at
http://127.0.0.1:54324. Nothing is actually sent.

## Commands

| Command | Does |
|---|---|
| `pnpm dev:stack` | Start, apply new migrations, seed on first run |
| `pnpm dev:stack web` | Web app on :3000 against the stack |
| `pnpm dev:stack mobile` | Metro against the stack (clears its cache) |
| `pnpm dev:stack persona <id\|all>` | Rebuild a test parent |
| `pnpm dev:stack open <id>` | Rebuild it, then sign the booted simulator in as it |
| `pnpm dev:stack isolation` | The tenancy isolation guard (`check:isolation`) against the stack, not production |
| `pnpm dev:stack status` | Print URLs and personas |
| `pnpm dev:stack reset` | Wipe the database, replay every migration, reseed |
| `pnpm dev:stack down` | Stop the containers; the data stays for next time |

Supabase Studio, to browse the tables, is at http://127.0.0.1:54323.
On a slow connection, `pnpm dev:stack --no-studio` skips it: Studio is the
largest optional download, and everything else works without it.

## How it stays off production

- **Supabase** runs from `tooling/local-stack/supabase/config.toml`, not
  the repo's `supabase/` folder, so the CLI never auto-applies migrations
  in filename order. `scripts/local-stack.mts` replays them in
  production's order (`scripts/supabase-migration-order.mts`) and records
  each in `local_stack.applied_migrations`.
- **The web app** gets its environment from `scripts/local-stack-env.mts`,
  which works by allowlist: every key in `apps/web/.env*` is blanked
  unless it is the model gateway, a read-only provider API, a feature flag
  or a Stripe test link. The database, the artifact store and Supabase all
  point at this machine through the eval isolation seam
  (`apps/web/lib/eval-isolation.ts`). Chat still calls the real models,
  so turns still cost model tokens.
- **The app** gets the local URLs at Metro start. The persona picker is a
  lab route (`src/app/labs/personas.tsx`), which Metro blocks from
  production bundles, and both the picker and its sign-in link stay
  hidden unless the app points at a backend on this machine.
- **The isolation guard** (`pnpm check:isolation`, which AGENTS.md asks
  for before any schema or query change) creates fixture users and
  families in whatever `apps/web/.env.local` names, which is production.
  `pnpm dev:stack isolation` aims both its API and its database here
  instead, and the guard refuses any run where the two disagree
  (`scripts/isolation-target.mjs`).

## What behaves like production

- **Feature flags:** every flag production sets is on locally
  (`PRODUCTION_FLAGS` in `scripts/local-stack-env.mts`), so worksheets,
  Progress, the paywall and a new iPhone family's check-in work. Three
  stay off because they reach outside this Mac: SMS, thank-you cards and
  family drives. Refresh the list with `vercel env ls production` from
  `apps/web`, and read every name: `HOMA_CHAT_ONBOARDING` is a flag
  without the `_ENABLED` ending.
- **Worksheets:** `dev:stack web` nudges the job runner every minute,
  standing in for production's five-minute sweep, so a first worksheet
  finishes and a failed step retries. Each one spends real model and
  image tokens.
- **The paywall:** a new family is walled exactly as in production. The
  gate signs its checkout links with a fake Stripe key that Stripe
  rejects, so no checkout or charge can happen. In the simulator the
  App Store prices do not load (there is no StoreKit test catalog yet),
  so the paywall says it cannot reach the App Store; "No thanks" and
  everything after it work.

Plain `pnpm --filter mobile start` and `pnpm --filter web dev` still use
`.env` and `.env.local`, which point at production. Use the `dev:stack`
commands whenever you mean local.

## Gotchas

- **`web` stops at "The Vercel OIDC token expired":** chat needs a fresh
  model token. Run `pnpm dev:token`. In a fresh worktree it fails until
  the worktree knows its Vercel project: copy `apps/web/.vercel/project.json`
  from the main checkout first (it names the project and grants nothing).
- **Just installed OrbStack and `docker` is not found:** the terminal
  predates it. Open a new one; OrbStack adds itself to `~/.zprofile`.
- **Switching between local and production in Metro:** the URLs are
  baked into the bundle, so `dev:stack mobile` always clears Metro's
  cache. When you go back to plain `pnpm --filter mobile start`, pass
  `--clear` once too.
- **A real phone** instead of the simulator needs your Mac's LAN address
  in place of 127.0.0.1 and localhost; the scripts assume the simulator.
- **Apple and Google sign-in** are off locally (they need real provider
  credentials). Use the test parents or the email code.
- **A migration fails on replay:** the error names the file. Production
  applied it, so the usual cause is an ordering dependency; add the pair to
  `APPLY_BEFORE` in `scripts/supabase-migration-order.mts`.
- **A persona reset fails on a foreign key:** a new table references
  `families` without cascading. Add it to the delete list in
  `scripts/local-stack-personas.mts`, mirroring
  `apps/web/lib/account-deletion.ts`.
