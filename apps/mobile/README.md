# Homa mobile (Expo)

The native companion app: same backend as `apps/web` (Supabase auth + the
eve agent mounted in the Next.js deployment), rebuilt UI in React Native.
The phone app is a pure client; it holds no secrets, no service keys, and
no tenancy logic. RLS and the eve channel's bearer auth are the boundary.

## Run it

```sh
cp apps/mobile/.env.example apps/mobile/.env   # fill in the three values
pnpm install
pnpm --filter mobile ios        # or: android, start
```

Local agent testing: run `pnpm --filter web dev` and point
`EXPO_PUBLIC_API_URL` at it (`http://localhost:3000` in the iOS
simulator; your Mac's LAN IP from a real phone).

## Ship it

Two release paths, both from `apps/mobile` (EAS project:
`@sidneyswift/homa`, bundle `com.thankshoma.homa`):

- OTA-safe changes ship over the air. A push to `main` touching the mobile
  JavaScript closure runs `.github/workflows/mobile-ota-update.yml`. The
  workflow requires an ancestor production-store build with the same native
  fingerprint, waits for exact-commit CI and Vercel success, verifies one
  exported iOS bundle, and publishes those exact bytes to the `production`
  channel. Installed apps can download it on a later launch and run it after a
  relaunch; only a physical-device observation proves installation.
- Native changes (a package with native code, an Expo SDK upgrade,
  native `app.json` config) need a new store build:
  `npx eas-cli@21.4.0 build --platform ios --profile production`, then
  `npx eas-cli@21.4.0 submit --platform ios --id EAS_BUILD_ID --profile production`.
  Submitting an explicit ID preserves the source-to-store audit chain. Updates only apply to builds
  with a matching native fingerprint, so a stale binary never receives
  incompatible JavaScript.

The workflow retains its classification and delivery evidence for 90 days.
Rollback and the evidence boundary are documented in
`apps/mobile/release/ROLLBACK.md`.

CI authenticates with the `EXPO_TOKEN` repo secret. Public distribution is
iOS-only. Android remains compile-only in CI, and the founder-owned platform
disposition plus EAS pre-install hook rejects Android public builds.

## How it hangs together

| Piece | Where | Notes |
|---|---|---|
| Design tokens | `src/theme/tokens.ts` | Temporary legacy projection, migrating to `@homa/design` under gh#720 |
| Fonts | `src/theme/fonts.ts` | Temporary legacy projection. Quiet authority roles are generated from `@homa/design`; migration is tracked by gh#715 and gh#720. |
| Auth | `src/lib/supabase.ts` | supabase-js + AsyncStorage sessions (cookie-free twin of `@supabase/ssr`) |
| Chat | `src/features/chat/` | `useEveAgent` from `eve/react` against `EXPO_PUBLIC_API_URL/eve/v1/*` |
| Streaming | `src/lib/streaming-fetch.ts` | `expo/fetch` installed globally; RN's built-in fetch cannot stream NDJSON |
| Family data | `src/lib/family.ts` | Port of `apps/web/lib/family.ts` + home actions, RLS-scoped |
| Events | `src/lib/events.ts` | `@homa/core` typed registry, caller's own token |
| Brand assets | `assets/brand/*.svg` | SVG and PNG projections are generated together from the Quiet authority contract: `pnpm gen:brand` |

The home greeting uses the current member display name when available. M1-17
owns design-system integration, not general mobile parity.

## Current native boundaries

- Authentication is Apple, Google, or email and password. Google runs
  the browser OAuth flow (`signInWithOAuth` plus
  `exchangeCodeForSession`) against the same Supabase provider the web
  app uses, so it needs the app's redirect URLs on the Supabase allow
  list. Apple is the native sheet (`expo-apple-authentication` plus
  `signInWithIdToken`), required next to Google by App Review 4.8; it
  needs the bundle ID under the Apple provider's Client IDs in
  Supabase. Native Google Sign-In (the account-picker sheet) is not
  present.
- No push-notification configuration is present.
- Printable artifacts render in chat and open their PDF URL in the system viewer, which can offer platform print or share actions. There is no native in-app print control.
- New and unfinished families open the web `/onboarding` flow. Native onboarding is not present.
