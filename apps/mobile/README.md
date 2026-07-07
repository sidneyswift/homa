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

## Not here yet, on purpose

- Google OAuth (needs the deep-link redirect registered in Supabase, see HUMAN-TODO)
- Push notifications (needs an EAS project + credentials)
- Worksheet printing (stays on the web; the card says so)
- The onboarding/map flow (its API auth is an httpOnly resume cookie, web-only for now)
- EAS build/submit config (arrives with the store-release decision)
