# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Homa mobile rules

- Read the repo root `AGENTS.md` first: voice laws (no em dash ever,
  sentence case, reassure-before-inform), security boundaries, and the
  design-system rule all apply here unchanged.
- Tokens and the Logo are hand-copied into `src/theme/tokens.ts` and
  `src/components/brand/logo.tsx` from `docs/homa-design/` (via
  `apps/web`'s copies). If design tokens change, update those files too.
- This app is a client only. `familyId` never comes from client input,
  for agent identity. Some app writes pass the selected `family_id` back
  to Supabase, but they run under the caller's RLS context and must be
  re-checked by policy. The eve agent is reached through
  `EXPO_PUBLIC_API_URL` with a Supabase bearer token. Never add a
  service key or server secret to this package.
- `src/app/_layout.tsx` must call `installStreamingFetch()` during module
  initialization before anything sends a request. The import does not need to be
  first; the installation order is the invariant because eve streams NDJSON and
  React Native's built-in fetch cannot read response streams.
