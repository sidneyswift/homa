# Homa mobile (Expo)

One brain, one record, the surface in the room. The native app is a pure
client on the same backend as `apps/web` (Supabase auth and Postgres under
RLS, the eve agent mounted in the Next.js deployment): it holds no secrets,
no service keys, and no tenancy logic. The phone earns its native layer
through what a browser cannot do in the room: voice while hands are busy,
the system print and share sheets, write-only calendar export. Everything
else it shows is server truth rendered client-side, replaceable over the
air. The full system model, seam registry, and verification ladder live in
[`docs/homa-planning/16-mobile-native-architecture.md`](../../docs/homa-planning/16-mobile-native-architecture.md);
the lane laws are in [AGENTS.md](AGENTS.md).

## Run it

```sh
cp apps/mobile/.env.example apps/mobile/.env   # fill in the three values
pnpm install
pnpm --filter mobile ios        # or: android, start
```

Agent-driven simulator work (build, launch, tap, screenshot) is owned by
`.agents/skills/mobile-simulator/SKILL.md`, including the per-worktree
prebuild and pod install steps. Local agent testing: run
`pnpm --filter web dev` and point `EXPO_PUBLIC_API_URL` at it
(`http://localhost:3000` in the iOS simulator; your Mac's LAN IP from a
real phone). Simulator sessions hit the real Supabase project: use a
`+homatest` alias account for anything that should not look like a real
family.

## What is in the app

Derive it, do not trust prose: `ls src/app/(tabs)` lists the signed-in
surfaces (a drawer-plus-stack shell, not a tab bar; the group name is
vestigial, founder call 2026-07-29 copied web's nav format),
`ls src/app/(onboarding)` lists the native first-run walk,
`src/app/(auth)` holds the sign-in doors, and `ls src/features` lists the
feature modules. The startup gate chain (session, onboarding, family
readiness, billing, with per-route AI consent) is composed in
`src/app/(tabs)/_layout.tsx`.

## How it hangs together

| Seam | Where | Notes |
|---|---|---|
| Sign-in doors | `src/features/auth/` | Apple (native sheet), Google (browser OAuth), email code; sessions in AsyncStorage via `src/lib/supabase.ts`. The doors depend on Supabase dashboard config the repo cannot show (architecture doc §6). |
| Chat | `src/features/chat/` | `useEveAgent` from `eve/react` against `EXPO_PUBLIC_API_URL/eve/v1/*`, with the incident-hardened recovery stack and per-tool card renderers in `message-view.tsx`. |
| Streaming | `src/lib/streaming-fetch.ts` | `expo/fetch` installed globally; RN's built-in fetch cannot stream NDJSON. Install order in `_layout.tsx` is a law (AGENTS.md). |
| Channel identity | `src/lib/env.ts` | Every eve and API call sends `X-Homa-Channel: mobile`; the server loads the iOS instruction module off it (`apps/web/agent/instructions/ios-mode.ts`). |
| Voice | `src/features/voice/` | WebRTC to OpenAI Realtime; the server mints tokens and runs tools (`/api/voice/realtime/*`). Overlays render tool effects by kind with a guaranteed receipt. |
| Onboarding walk | `src/features/onboarding/`, `src/app/(onboarding)/` | A mobile-born account gets the native onboarding walk; a family that already started web onboarding skips it and finishes in chat. State is durable per answer in the `mobile_onboarding_state` table; the first making reuses web's materials-studio job. |
| Materials out of the screen | `src/features/materials/` | Materials print through the first-party homa-print module's system print sheet and share through the system share sheet. |
| Family data | `src/lib/family.ts` | Port of web's family reads plus home actions, RLS-scoped, caller's own token. The home greeting uses the current member display name when available. |
| Entitlement | `src/features/billing/` | StoreKit via `expo-iap`; the client reads one decision from `/api/billing/gate`; purchases confirm server-side. Review invariants live in the ios-release skill. |
| Events | `src/lib/events.ts`, `src/features/bootstrap/` | `@homa/core` typed registry; family-scoped relay and family-free startup telemetry through `/api/mobile/*`. |
| Design tokens | `src/theme/native-projection.ts` | `quiet*` exports project `@homa/design`; `tokens.ts` is a frozen legacy snapshot being retired route by route (gh#720, gh#984). |
| Brand assets | `assets/brand/*.svg` | Generated from the Quiet authority contract: `pnpm gen:brand`. |

## Ship it

Two rails, decided per commit by a classifier, never by judgment
(EAS project `@sidneyswift/homa`, bundle `com.thankshoma.homa`):

- **OTA**: a push to `main` touching the mobile JavaScript closure runs
  `.github/workflows/mobile-ota-update.yml`, which publishes only when a
  FINISHED production build with the same native fingerprint exists, and
  fails closed otherwise. A green run is not delivery; prove the chain
  with the commands in `.agents/skills/ios-release/SKILL.md`.
- **Store build**: native changes (a package with native code, an Expo SDK
  bump, native `app.json` config) change the fingerprint and need a new
  build and TestFlight pass. Procedure, evidence states, and rollback:
  [release/ROLLBACK.md](release/ROLLBACK.md).

Program posture: the public App Store launch was cut from the PMF queue on
2026-08-16 ("No App Store launch is authorized now", gh#299 and gh#308
closing comments). The installed fleet is TestFlight; maintenance, live
bug fixes, and OTA delivery stay fully active. Details and reopen
triggers: architecture doc §2. Android remains compile-only, blocked by
the founder-owned platform disposition.

## Verify it

The guard table (which `check:mobile-*` suite covers which feature) is in
[AGENTS.md](AGENTS.md). The verification ladder (what a simulator run
proves versus a device versus the release rails) is architecture doc §4.
CI runs the mobile suites only on mobile-only PRs (gh#986): on a mixed PR,
run them yourself.
