# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Homa mobile rules

Read the repo root `AGENTS.md` first: voice laws (no em dash ever, sentence
case, reassure-before-inform), security boundaries, and the design-system
rule all apply here unchanged. The system model for this lane (the seam
registry, the verification ladder, program posture, and where learnings go)
is `docs/homa-planning/16-mobile-native-architecture.md`. The current-truth
map is [README.md](README.md).

## Laws

- **Client only.** This package holds no secrets, no service keys, and no
  tenancy logic. `familyId` never comes from client input for agent
  identity; app writes that pass a selected `family_id` run under the
  caller's RLS context and are re-checked by policy. The eve agent is
  reached through `EXPO_PUBLIC_API_URL` with a Supabase bearer token.
- **Streaming install order.** `src/app/_layout.tsx` must call
  `installStreamingFetch()` during module initialization before anything
  sends a request. The import does not need to be first; the installation
  order is the invariant, because eve streams NDJSON and React Native's
  built-in fetch cannot read response streams.
- **Design values** come from `@homa/design/contract` through the `quiet*`
  exports of `src/theme/native-projection.ts`. `src/theme/tokens.ts` is a
  frozen legacy snapshot owned by the route-by-route migration (gh#720,
  primitives tracked by gh#984): never an authority, never a place to add
  values. The native Logo adapter consumes generated identity geometry and
  may not redraw or rename Homa locally.
- **Never edit `ios/` or `android/`.** Both are prebuild output and
  gitignored. Native configuration changes go through `app.json` and
  `plugins/` (scar: a plugin silently deleting a required Info.plist key
  produced repeated ITMS-90683 store rejections, 555480f9).
- **Know your rail before you build.** Run
  `npx expo fingerprint --platform ios` before and after any change that
  could touch native surface. Same hash ships over the air on merge; a
  different hash orphans every installed binary from future updates until a
  new store build ships (scar: three weeks of green OTA publishes no phone
  ever received, July 2026). The ios-release skill owns the procedure.
- **Wire new tests in or they never run.** Mobile tests are colocated
  `*.test.ts` files executed by the `check:mobile-*` lists in the root
  `package.json`; a test file not named there is dead. On merge conflicts,
  union the lists by key or you silently delete main's new tests. On a PR
  that touches mobile plus anything else, CI runs zero mobile checks
  (gh#986): run the affected suites yourself before merging.
- **Voice costs money per minute.** A realtime session and the microphone
  start only on an explicit tap, never automatically (gh#987; launch
  defaults to text chat, 63b5292f).
- **Channel honesty moves with the UI.** When a native surface appears,
  moves, or dies, update `apps/web/agent/instructions/ios-mode.ts` in the
  same PR, or Homa starts giving parents directions to surfaces that do not
  exist (scar: gh#1040).
- **eve version changes** require `node scripts/eve-upgrade-check.mjs` and
  the runbook, no exceptions (root law; the mobile chat stack is the
  deepest eve/react coupling in the repo).

## Which guard covers what

Enumerate the authoritative lists live with
`grep '"check:mobile' package.json` (plus the mobile entries inside
`check:auth-recovery`, `check:events`, `check:billing`, `check:month-plan`,
`check:chat-ui`). The routing that is not obvious from names:

| Touching | Run |
|---|---|
| `features/chat`, onboarding cards | `pnpm check:mobile-chat` |
| `features/bootstrap`, gates | `pnpm check:mobile-bootstrap` |
| `features/planner`, mutation receipts, calendar export | `pnpm check:mobile-planner` |
| `features/progress` | `pnpm check:mobile-progress` |
| `features/voice`, `lessons`, `materials` print and share | `pnpm check:mobile-voice` |
| `features/auth` | `pnpm check:auth-recovery` |
| `features/billing` | `pnpm check:billing` |
| events, relays | `pnpm check:events` |
| brand assets, icon registry | `pnpm check:mobile-brand` |
| accessibility, any new surface | `pnpm check:mobile-accessibility` |
| `scripts/`, the OTA workflow | `pnpm check:mobile-release-rails` |
| anything | `pnpm --filter mobile typecheck && pnpm --filter mobile lint` |

## Which loop, which skill

- Run, drive, or verify the app in a simulator:
  `.agents/skills/mobile-simulator/SKILL.md`.
- Ship it, decide OTA vs store build, or check release state:
  `.agents/skills/ios-release/SKILL.md`; rails, rollback, and evidence
  states in [release/ROLLBACK.md](release/ROLLBACK.md).
- Anything crossing a seam (auth, transport, rendering, entitlement,
  events, release): the seam registry in
  `docs/homa-planning/16-mobile-native-architecture.md` §3 names the
  owning code, the guard, and the failure tell.
