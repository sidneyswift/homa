# Mobile native architecture · the agent's operating model for the iOS app

> Status: engineering doctrine, written 2026-08-31. This doc consolidates the
> founder rulings, shipped code, and release machinery that govern
> `apps/mobile` into one system model, so an agent landing in the mobile lane
> can orient in minutes instead of re-deriving the system per session. It
> creates no policy: every law here cites its founder ruling or scar, and
> every repository statement is a dated observation, not a production claim.
> Where a fact is volatile, this doc teaches the derivation command instead
> of hand-maintaining the answer (context-file rule 8,
> `plans/2026-07-24-context-engineering-cleanup.md`).
>
> Companions: `apps/mobile/AGENTS.md` (the lane laws that load with every
> mobile session), `apps/mobile/README.md` (the current-truth map),
> `.agents/skills/mobile-simulator/SKILL.md` (run and verify loop),
> `.agents/skills/ios-release/SKILL.md` (ship loop),
> `apps/mobile/release/ROLLBACK.md` (release rails and evidence states).

## 0. Read this when

Use this doc to answer: what is the mobile system, which seams does my change
cross, what proof does my claim need, what may I not do without a founder
reopen, and where does what I learned go. It does not answer how to run the
simulator (mobile-simulator skill), how to ship (ios-release skill and
ROLLBACK.md), or what any screen currently looks like (the code, listed live).

## 1. The one-sentence model

**The phone app is a projection of the one Homa, not a second product.**
One brain (the eve agent mounted in `apps/web`, reached over HTTPS with the
caller's Supabase JWT), one record (Postgres under RLS, artifacts in Blob),
one design authority (`packages/design`), one event registry
(`packages/core`). The native layer earns its existence only through what a
phone in the room can do that a browser cannot: speak while hands are busy,
print and share through the system sheets, write to the device calendar,
capture the worksheet with the camera (tracked, not built, gh#1018), and
someday tap the parent on the shoulder with push (not built, needs a founder
reopen, gh#307 closing comment). Everything else the app shows is server
truth rendered client-side.

Four consequences follow, and they shape every change:

| Consequence | What it means in practice |
|---|---|
| The server owns judgment | Skills, tools, prices, and claims live in `apps/web`. The client renders results and never invents one. When the phone cannot show something, it says so; channel honesty is a seam (§3.3), not a hope. |
| OTA-safe is the default | A pure JS or TS change ships over the air on merge. Anything that changes the native fingerprint orphans every installed binary from future updates until a new store build ships, so native surface changes are deliberate and batched (§3.9, ios-release skill). |
| Merge is not delivery | Nothing on a phone is shipped until the fingerprint chain proves an installed, compatible binary can receive the bytes. A green workflow is not evidence a phone changed (scar: three weeks of green publishes into a void, July 2026). |
| Maintenance happens at the desk | Guards and the simulator cover most verification. A physical device is required only where hardware is the contract: audio routes, print and share destinations, calendar, StoreKit sheets (§4). |

## 2. Program posture · maintenance active, launch cut

The App Store launch program was **cut from the PMF queue on 2026-08-16**.
The program epics (gh#299 and its arcs gh#302 through gh#308, the voice
workbench gh#534, the award-program epics gh#617 and gh#618, and the
modernization epic gh#684) are closed with founder closing comments; gh#299's
reads: current focus stays on the web product's buy, activation, and return
loop, and "No App Store launch is authorized now." gh#606, the per-adult
privacy P0, shipped with production evidence before the cut and is not
affected by it.

What stays ACTIVE under the cut:

- The installed fleet keeps working. The founder and co-founders use the app
  through TestFlight, and merges to `main` that touch the mobile JavaScript
  closure still publish OTA updates through
  `.github/workflows/mobile-ota-update.yml`.
- Live bugs follow `prod-bugs-fixed-not-stored` exactly as on web: found in
  the session, fixed and verified in the session, or plainly escalated.
- Store builds and TestFlight distribution remain legitimate maintenance
  moves when a fingerprint change requires them; without a matching binary
  the OTA rail dies (§3.9).

What is NOT authorized without an explicit founder reopen: public App Store
submission or release, listing and ASO work, native growth funnels, launch
collateral, and new native scope justified by launch. The reopen triggers,
from the closing comments: proven native demand, or a paying-family need that
web cannot serve.

## 3. The seam registry

The mobile system is defined by its seams. Each row names the contract, the
owning code, the guard that protects it, and the tell that it broke. When a
change crosses a seam, read the owning code first and run the guard before
and after.

| # | Seam | Contract and owning code | Guard | Failure tell |
|---|---|---|---|---|
| 1 | Identity and session | Supabase auth with three doors: Apple (native sheet), Google (browser OAuth round trip), and email code. Sessions persist in AsyncStorage. `apps/mobile/src/features/auth/`, `src/lib/supabase.ts`. The doors depend on Supabase dashboard configuration the repo cannot show (§6). | `pnpm check:auth-recovery` | Sign-in that works in dev but fails in a store build points at provider config (Apple Client IDs, redirect allow list), not at this code. |
| 2 | Agent transport | eve streams NDJSON over `EXPO_PUBLIC_API_URL` with the caller's bearer token. `expo/fetch` is installed globally because React Native's fetch cannot read response streams; the install-before-first-request order in `src/app/_layout.tsx` is the invariant. `src/lib/streaming-fetch.ts`, `src/features/chat/chat-session.tsx`. The eve version coupling is governed by the eve-upgrade-check law (root `AGENTS.md`). | `pnpm check:mobile-chat` | Local turns all failing after an `eve build` while `pnpm --filter web dev` is running: the build deleted the snapshot the dev server was pinned to. Restart the dev server. |
| 3 | Channel identity and honesty | The client sends `X-Homa-Channel: mobile` on every eve and API call (`src/lib/env.ts`); the server maps it in `apps/web/agent/channels/eve.ts` and loads `apps/web/agent/instructions/ios-mode.ts` each turn, which teaches Homa what the phone shows, the ruled price, and (on voice turns) the spoken-reply rules. This module must track the real app: it is the only thing standing between Homa and inventing surfaces. | the `apps/web/agent` pre-push law (`VERCEL=1 pnpm --filter web exec eve build`, then `VERCEL=1 pnpm check:eve-stream-duration`) plus `apps/web/lib/voice/ios-mode.test.ts` | Homa naming a surface, path, or price that the app does not have (scar: gh#1040, Settings directions pointed at a retired Today header). When a native surface moves, this module moves in the same PR. |
| 4 | Render contract | Chat dispatches typed part parsers per tool in `src/features/chat/message-view.tsx` with card models beside it; a message-level fallback fires when a completed turn rendered nothing (gh#376 deliberately allows per-part silence when authored text is present). Voice uses a kind-discriminated overlay union with a guaranteed generic receipt, `src/features/voice/overlay-model.ts`: anything not deliberately ignored lands as at least a receipt line. | `pnpm check:mobile-chat`, `pnpm check:mobile-voice` | A new server tool that shows nothing in mobile chat is this seam: extend the parser table, the fallback naming, and the voice overlay in the same change as the tool. |
| 5 | Family record access | Reads and writes go straight to Postgres under the caller's RLS. The client may pass a selected `family_id` but policy re-scopes it; the package holds no service keys and no server secrets, ever. `src/lib/family.ts` and per-feature data modules. | `pnpm check:isolation` before any schema or query change | A query that works with the service role but fails on device is an RLS policy gap, not a client bug. |
| 6 | Entitlement | StoreKit purchases (`expo-iap`) confirm server-side (`/api/billing/apple/confirm`); the client reads one JSON decision from `/api/billing/gate`. Entitlement is provider-neutral: a Stripe-paid family is never asked to subscribe twice. Review-sensitive invariants (in-app deletion, SIWA next to Google, no Stripe links in the binary) live in the ios-release skill. | `pnpm check:billing` | The gate saying walled while the App Store says active is a reconciliation gap: check the `apple_*` columns and the confirm route before touching the client. |
| 7 | Design projection | Exact values come from `@homa/design` through the `quiet*` exports of `src/theme/native-projection.ts`. `src/theme/tokens.ts` is a frozen legacy snapshot owned by the route-by-route migration gh#720 (a handful of product files migrated as of 2026-08-31; gh#984 tracks primitives still on the snapshot). The native Logo adapter consumes generated identity geometry and is never redrawn locally (`brand-casing-homa`). | `pnpm check:mobile-brand`, `pnpm check:design-parity` | A hex literal in a component is a violation. A "wrong shade" report usually means the screen is still on the frozen snapshot, which is correct until its route migrates. |
| 8 | Events | The typed registry in `packages/core/src/events.ts` owns every mobile event, including bootstrap stages and onboarding steps. Family-scoped events relay through `/api/mobile/event`; family-free startup telemetry through `/api/mobile/bootstrap-event`. | `pnpm check:events` | An event that exists client-side but never lands in the ledger is the relay contract, not the emitter. |
| 9 | Release rails | The fingerprint decides everything: `runtimeVersion.policy: "fingerprint"` in `app.json`. A per-commit classifier picks OTA or store-binary; the OTA workflow fails closed on mismatch and writes a schema-validated delivery receipt. `apps/mobile/scripts/`, `.github/workflows/mobile-ota-update.yml`, canonical rails and evidence states in `apps/mobile/release/ROLLBACK.md`. | `pnpm check:mobile-release-rails` | A green OTA run with no phone change is a fingerprint mismatch; gh#1030 tracks the missing same-day alert. Prove the chain with the three commands in the ios-release skill before claiming shipped. |
| 10 | Voice | A real WebRTC peer connection to OpenAI Realtime. The server mints the ephemeral token (`/api/voice/realtime/token`); tool calls relay to `/api/voice/realtime/tool`, which runs the full Homa agent server-side; spoken turns persist via `/api/voice/realtime/turn`. `src/features/voice/use-voice-session.ts`. | `pnpm check:mobile-voice` | Voice costs real provider money per minute. Entry is an explicit tap, never an auto-start (scar: gh#987; launch now defaults to text chat, 63b5292f). |
| 11 | Startup gates | A shared bootstrap runner with five stages (fonts, session, family, consent, billing), a ten-second stage timeout, and family-free telemetry. The gate chain in `src/app/(tabs)/_layout.tsx` runs session, then onboarding, then family readiness, then billing; AI consent gates chat, progress, and voice per route (App Review 5.1.2(i), persisted on `family_members`). `src/features/bootstrap/`, the gate components. | `pnpm check:mobile-bootstrap` | An infinite spinner at cold start is one of these five stages; the bootstrap telemetry names which one and why. |
| 12 | Onboarding walk | A native first-run walk whose state is a server table, `mobile_onboarding_state` (RLS, step check constraint, durable on every answer, silent resume). The first making reuses web's durable materials-studio job via `/api/mobile/onboarding/making`. A family that already started web onboarding skips the walk entirely (founder D6, 2026-08-18). `src/app/(onboarding)/`, `src/features/onboarding/`. | `pnpm check:mobile-chat` (card models) plus the `mobile_onboarding.*` funnel events | The gate fails OPEN into the app on bootstrap error by design; a family stuck outside the walk is a gate bug, a family inside with no state row is a bootstrap bug. |

## 4. The verification ladder

Each rung proves something the rung below cannot. Claim only what your
highest passed rung proves; the release evidence states in
`apps/mobile/release/ROLLBACK.md` are the canonical vocabulary for rungs
three and four and are not restated here.

| Rung | What it is | What it proves | What it never proves |
|---|---|---|---|
| L0 static | `pnpm --filter mobile typecheck` and `lint`, plus the `check:mobile-*` suites (enumerate them live: `grep '"check:mobile' package.json`; the feature-to-suite table is in `apps/mobile/AGENTS.md`). CI runs these only for mobile-only PRs (gh#986), so on a mixed PR you run them yourself. | Contracts, models, and pure logic hold. | That any screen renders, streams, or writes. |
| L1 simulator | A driven journey through the mobile-simulator skill, with screenshots. The native interface gauntlet's static contract also runs in CI; its installed-evidence mode records honest "blocked" for everything `simctl` cannot assert. | The journey works end to end against the real backend. | Audio routes, print and share destinations, StoreKit sheets, interruption behavior, or that a release build behaves the same. |
| L2 device | A named physical iPhone, per the certification steps in ROLLBACK.md. Required where hardware is the contract: spoken turns and interruptions, print and share destinations, calendar, StoreKit, camera when it exists. | The hardware seams work on that device, that build, that OS. | That any other device or a later update behaves identically. |
| L3 rails | The fingerprint chain: the update's fingerprint equals a FINISHED production build's fingerprint, and that build's source is an ancestor of the release commit. Commands in the ios-release skill. | The exact bytes are published to a channel an installed binary can receive. | That any phone downloaded or applied them. |
| L4 uptake | An installed device relaunching onto the update; record the installed update ID and runtime fingerprint. | Delivery happened. | Anything about devices not observed. |

**The sixteen-state bar.** Any new or reworked surface defines these states
before it can be called complete (lifted from the 2026-08-03 award gauntlet,
whose program is closed; this is now the canonical home): entry ·
permission prime · loading · working · review · commitment · success · undo ·
empty · no results · error · offline · interrupted · entitlement ·
accessibility · privacy. A screen that exists only in its happy state is not
a finished mobile feature. The award gauntlet's §"Universal mobile state
contract" holds the full required behavior per state; read it there when
building a surface, and treat it as binding craft even though its parent
program is cut.

## 5. The agent operating loop

1. **Orient.** `apps/mobile/AGENTS.md` loads with the lane. Derive the
   current app instead of trusting prose: `ls apps/mobile/src/app/(tabs)`
   and `(onboarding)` for surfaces, `ls apps/mobile/src/features` for
   modules, §2 for what is authorized.
2. **Change.** Identify the seams your change crosses (§3) and read their
   owning code. Before writing anything that could touch native surface, run
   `npx expo fingerprint --platform ios` so you know your rail before you
   build, not after.
3. **Verify.** Climb the ladder (§4) to the rung your claim needs. A UI
   change needs L1; a hardware seam needs L2; "shipped" needs L3 and, for a
   user-visible fix promised to a person, L4.
4. **Ship.** Merge to `main`; the OTA workflow classifies and publishes or
   fails closed. Prove the chain before telling anyone it is live.
5. **Accrete.** Every session leaves the lane smarter. Route what you
   learned to its one home:

| What you learned | Where it goes |
|---|---|
| A dev-loop gotcha (build, pods, Metro, simulator driving) | `.agents/skills/mobile-simulator/SKILL.md` |
| A ship or release-rail gotcha | `.agents/skills/ios-release/SKILL.md`, or `apps/mobile/release/ROLLBACK.md` when it changes the rails themselves |
| A binding lane law with a scar | `apps/mobile/AGENTS.md`, one line, cite the scar |
| A seam changed shape | This doc's §3 row, in the same PR as the change |
| Volatile status, open work, anything with an owner | A GitHub issue, never a doc |
| Product policy | Never invented here: founder ruling via `build-log.md` and the registry, per root `AGENTS.md` § When unsure |

## 6. External state the repository cannot show

These are load-bearing dependencies that live outside git. When behavior
contradicts the code, check these before doubting the code. Acting on most
of them is founder-only (`founder-action` label).

| External state | Why it matters | How to check / who acts |
|---|---|---|
| Supabase dashboard auth config | Apple provider Client IDs must contain `com.thankshoma.homa` or SIWA fails only in store builds; Google's redirect URLs must be allow-listed; the email-code door depends on OTP settings. None of this is visible in the repo. | Founder reads the dashboard. Agents: suspect this whenever an auth failure is build-channel-specific. |
| EAS project state | Build numbers are EAS-owned (`appVersionSource: "remote"`), credentials and profiles live in EAS. | `npx eas-cli build:list` works with `EXPO_TOKEN`; credential and profile fixes are founder-interactive. |
| App Store Connect | Review state, metadata, IAP products, TestFlight groups are invisible without an ASC API key. `eas.json` pins `ascAppId` so non-interactive submits work, but reading ASC state is founder-only today. | Ask the founder to read ASC, or to provision an ASC API key as an EAS secret. |
| Apple developer program | The SIWA entitlement rides the provisioning profile; a missing `com.apple.developer.applesignin` on an EAS build means the profile must be regenerated interactively (scar: build 4). | Founder regenerates; agents rebuild after. |
| The App Review demo family | `sidney+homatestappreview@recoupable.com`, sandboxed and `billing_exempt`. Never delete it, never let an entitlement change wall it. | Verify sign-in on a simulator before any submit. |
| OpenAI Realtime | Voice tokens mint against `OPENAI_API_KEY` directly, not the AI Gateway; provider outages and price changes arrive from outside. | `/api/voice/realtime/token` behavior plus provider status. |

## 7. Current tracked ergonomics gaps

The tracker owns status; these pointers exist so an agent hitting the
symptom finds the issue instead of rediscovering it. As of 2026-08-31:
gh#986 (CI runs zero mobile checks on any mixed PR, so run them yourself),
gh#1030 (an OTA blocked by fingerprint drift stays silent for days),
gh#987 (voice auto-start investigation; launch now defaults to text chat),
gh#984 (native primitives still on the frozen token snapshot),
gh#1018 (no photo upload path for logging completed work),
gh#530 (binder collections), and gh#1042 (dead-surface cleanup bundle:
the orphaned onboarding react route, `ComingSoonScreen`, two stale
comments). Enumerate the live set with
`gh issue list --search "mobile OR ios" --state open` rather than trusting
this paragraph.

## 8. The documentation tower

One home per rule; everything else is a pointer. The chain an agent walks:

| Question | Home |
|---|---|
| What are the repo-wide laws | root `AGENTS.md`, `BUILD.md` |
| What is the mobile system, its seams, proof rules, posture | this doc |
| What laws bind me while editing `apps/mobile` | `apps/mobile/AGENTS.md` (loads with the lane) |
| What is currently in the app, how do I run it | `apps/mobile/README.md`, which derives rather than lists |
| How do I drive the simulator | `.agents/skills/mobile-simulator/SKILL.md` |
| How do I ship, and did it really ship | `.agents/skills/ios-release/SKILL.md` |
| Release rails, rollback, evidence states | `apps/mobile/release/ROLLBACK.md` |
| Why is the system shaped this way (history) | the dated plans under `plans/`, each carrying a status banner; the build log |
| What is open right now | GitHub Issues, never a doc |

Provenance: consolidated 2026-08-31 from the 2026-07-20 parity plan, the
2026-07-28 launch plan, the 2026-08-02 and 2026-08-03 award gauntlets, the
2026-08-18 onboarding research and v1 plan (each now carries a status banner
pointing here), the PMF-cut closing comments on the program epics, and a
same-day code audit of `apps/mobile` and its `apps/web` seams.
