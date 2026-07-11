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

## How it hangs together

| Piece | Where | Notes |
|---|---|---|
| Design tokens | `src/theme/tokens.ts` | Hand-copied from `docs/homa-design/tokens/`, same sync rule as `apps/web` |
| Fonts | `src/theme/fonts.ts` | Schibsted Grotesk, Hanken Grotesk, Fredoka via `@expo-google-fonts` |
| Auth | `src/lib/supabase.ts` | supabase-js + AsyncStorage sessions (cookie-free twin of `@supabase/ssr`) |
| Chat | `src/features/chat/` | `useEveAgent` from `eve/react` against `EXPO_PUBLIC_API_URL/eve/v1/*` |
| Streaming | `src/lib/streaming-fetch.ts` | `expo/fetch` installed globally; RN's built-in fetch cannot stream NDJSON |
| Family data | `src/lib/family.ts` | Port of `apps/web/lib/family.ts` + home actions, RLS-scoped |
| Events | `src/lib/events.ts` | `@homa/core` typed registry, caller's own token |
| Brand assets | `assets/brand/*.svg` | PNGs in `assets/images/` are generated: `rsvg-convert -w 1024 -h 1024 brand/<name>.svg -o images/<name>.png` |

The home greeting uses the current member display name when available. M1-17
owns design-system integration, not general mobile parity.

## Current native boundaries

- Authentication is email and password. No Google OAuth flow is present in this package.
- No push-notification or EAS build and submit configuration is present.
- Printable artifacts render in chat and open their PDF URL in the system viewer, which can offer platform print or share actions. There is no native in-app print control.
- New and unfinished families open the web `/onboarding` flow. Native onboarding is not present.
