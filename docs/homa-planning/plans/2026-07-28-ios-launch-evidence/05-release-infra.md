# 05: App Store release infrastructure, exact state as of 2026-07-28

Reader scope: EAS build/submit state, OTA pipeline correctness, eas.json store-readiness, Expo stack health, and the remaining founder-only vs automatable steps for a public App Store launch. Repo root: `/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-chat-onboarding-testing-10c9c1` (branch `claude/homa-ios-product-planning-470a45`, cut from main after PR #72 merged). All EAS facts below come from live queries against the EAS API (logged in as `sidneyswift`), not from repo prose.

## 1. Bottom line

- The 1.0.0 store binary (EAS build `fa773afb`, iOS build number 5) was built 2026-07-21T13:08Z and its EAS submission to App Store Connect FINISHED 2026-07-21T20:19Z. The IPA is inside App Store Connect.
- The app is NOT publicly live. `https://itunes.apple.com/lookup?bundleId=com.thankshoma.homa` returns `resultCount: 0` (probed 2026-07-28), and the thankshoma.com homepage contains zero App Store links (only apple-touch-icon markup). Seven days post-upload with no listing strongly suggests the version was never actually submitted for App Review inside ASC, or is parked; only the founder can see which, in App Store Connect.
- Two structural problems mean the binary in ASC is already a dead end even if approved as-is: (a) its JS was built from a branch that was never merged (PR #76 CLOSED unmerged 2026-07-27), so main cannot reproduce the app that reviewers would see; (b) its native fingerprint has never matched any published OTA update, so it can never receive a single over-the-air fix. Details in sections 4 and 5.

## 2. Build and submission ledger (EAS API, live)

iOS builds on EAS project `916ce7cf-5c57-4036-a9a9-af8651f1624a` (`@sidneyswift/homa`, bundle `com.thankshoma.homa`):

| Build | Version (build #) | Profile | Status | Fingerprint | Git commit | Created |
|---|---|---|---|---|---|---|
| `fc4467ca` | 0.1.0 (1) | production | FINISHED | null (pre-fingerprint) | n/a | 2026-07-14T02:59Z |
| `0036d6af` | 0.1.0 (2) | production | FINISHED | `24043da3...` | main | 2026-07-14T18:30Z |
| `a4744650` | 0.1.0 (2) | development | FINISHED | `4e11cd57...` | 14820e42 | 2026-07-21T03:05Z |
| `918fe42d` | 0.1.0 (3) | production | FINISHED | `4e11cd57...` | 6599d0a4 (branch) | 2026-07-21T03:31Z |
| `fb45d812` | 1.0.0 (4) | production | ERRORED | `d2d9ae0d...` | 26c16dc3 (branch) | 2026-07-21T03:52Z |
| `fa773afb` | 1.0.0 (5) | production | FINISHED | `d2d9ae0d...` | f3dc2be8 (branch) | 2026-07-21T13:08Z |

`fb45d812` failed with `XCODE_BUILD_ERROR`: the provisioning profile dated 2026-07-14 lacked the Sign In with Apple capability and `com.apple.developer.applesignin` entitlement. The founder reran the build interactively to regenerate the profile, producing `fa773afb`. This matches project memory and is now confirmed from the EAS error record.

iOS submissions (EAS GraphQL, filter platform IOS), all status FINISHED (FINISHED means delivered to App Store Connect, not approved or released):

| Submission | Build | Version | When |
|---|---|---|---|
| `6158e3ce` | fc4467ca | 0.1.0 (1) | 2026-07-14T03:24Z |
| `df0091e6` | 0036d6af | 0.1.0 (2) | 2026-07-18T14:23Z |
| `5850c3e5` | 918fe42d | 0.1.0 (3) | 2026-07-21T03:41Z |
| `de4dad7f` | fa773afb | 1.0.0 (5) | 2026-07-21T18:52Z, finished 20:19Z |

So four binaries have reached ASC; distribution before 1.0.0 was TestFlight-only. Nothing has been built or submitted since 2026-07-21. There is no ASC API key in the repo or EAS submit profile, so App Review state (waiting for review, in review, approved, rejected, draft never submitted) is invisible to agents; founder must read it in App Store Connect.

## 3. What the submitted 1.0.0 binary actually contains

Build 5's `gitCommitHash` is `f3dc2be8` ("mobile: full parent-surface parity, read-only v1": five-tab shell Today/Chat/Planner/Progress/More, plus Planner, Tasks, Progress, Binder, Lessons, Settings screens). That commit exists only on `claude/mobile-parity` (verified: `git branch -a --contains f3dc2be8` returns only that branch). Its PR #76 was CLOSED unmerged at 2026-07-27T21:26:58Z, the same minute PR #72 merged.

Main's mobile app today has three tabs only: `apps/mobile/src/app/(tabs)/index.tsx`, `chat.tsx`, `family.tsx` plus `(auth)/signin.tsx` (verified by listing `apps/mobile/src/app`). Issue #263 (open, P1) tracks building the native planner board on main.

Consequence for launch planning: the binary reviewers would evaluate shows a five-tab product that the repo's mainline cannot rebuild or iterate on. Any next build from main produces a visibly different, smaller app (3 tabs). A decision is required: either land the parity surfaces on main first (the #263 arc), or accept a 3-tab v1 and rebuild/resubmit from main. Do not approve-and-release build 5 as-is; see section 4 for why it is also unpatchable.

## 4. OTA pipeline: correct design, silently orphaned in practice

Design (`.github/workflows/mobile-ota-update.yml:14-61` and `apps/mobile/README.md:20-40`): every push to main touching `apps/mobile/**` or `packages/core/**` typechecks mobile, loads EXPO_PUBLIC_ env from `eas.json` (so OTA and store builds ship identical public config, workflow lines 50-52), and publishes `eas update --channel production --platform ios` with `EXPO_TOKEN`. Runtime versioning is `"policy": "fingerprint"` (`apps/mobile/app.json:13-15`), so an update only applies to binaries whose native fingerprint matches. All 15 recent workflow runs succeeded (gh run list).

Reality (from `eas update:list --branch production`, 32+ updates since 2026-07-14):

- Every OTA update from 2026-07-14 through PR #234 (approx 2026-07-27T00:36Z) carried fingerprint `24043da3...`. That matches only build 2 (0.1.0, TestFlight, 07-14). Installed build-2 phones were the sole consumers of three weeks of OTA publishes.
- The submitted 1.0.0 binary (fingerprint `d2d9ae0d...`) has NEVER had a matching update published. Zero. It runs only its embedded 07-21 JS forever. The feature branches carried native modules (expo-apple-authentication, expo-web-browser) that main lacked until 07-27, so main's fingerprint could never match.
- On 2026-07-27 the fingerprint on main moved twice: #231 (version-skew alignment) produced `b3765b7a...`, then the #72 merge produced `9c5e8a85...`. The last three OTA updates (#72, #270, #273) target `9c5e8a85...`, a fingerprint for which NO binary exists at all.

Net: as of today every installed binary is orphaned from OTA (build 2 phones stopped receiving updates at #234; build 5 never received any), and the workflow keeps publishing green no-op updates into a void. The workflow's own comment ("installed builds download the new JavaScript on next launch", mobile-ota-update.yml:4-5) has been false for the store candidate its entire life. Nothing alarms on this: fingerprint drift is silent by construction.

Fixes (automatable):
1. Cut a new production build from current main so a binary exists at `9c5e8a85...`, then resubmit. This is the mandatory next release step regardless.
2. Add a drift guard to the OTA workflow: compute `npx expo fingerprint` on the checkout, compare to the latest FINISHED production build's fingerprint (EAS API), and fail loudly or open an issue on mismatch instead of publishing a no-op.
3. Pin `eas-cli` in the workflow (currently `npx eas-cli@latest`, line 61: an unpinned CLI in a release pipeline).

## 5. eas.json store-readiness (`apps/mobile/eas.json`)

Build side is store-ready: `production` profile (lines 17-25) has `autoIncrement: true`, `channel: "production"`, remote `appVersionSource` (line 4, build numbers live on EAS servers; next is 6), and inlines the three EXPO_PUBLIC_ values (Supabase URL, publishable key, API URL: public-by-design, RLS is the boundary per `apps/mobile/.env.example`).

Submit side is NOT automated: `"submit": { "production": {} }` (lines 27-29). No `ascAppId`, no `ascApiKeyPath`, no `appleTeamId`. This confirms the memory claim: `eas submit --non-interactive` fails, every submission so far was interactive with the founder's Apple login. The 07-21 interactive submits happened, but the ascAppId was never saved back into eas.json and committed. One line of config (founder supplies the ASC app ID, or one more interactive submit with save) unlocks agent-driven `eas submit --platform ios --latest`.

App config (`apps/mobile/app.json`): version 1.0.0 (line 5), `bundleIdentifier com.thankshoma.homa`, `usesAppleSignIn: true`, `ITSAppUsesNonExemptEncryption: false` (lines 16-23, so no export-compliance question at submit), `supportsTablet: false` (iPhone-only review surface, deliberate), updates URL wired to the EAS project (line 11). Android config exists (lines 24-33) but no Android build has ever run; iOS-only is the current posture and the OTA workflow publishes iOS only (README.md:38-40 explains `--platform all` breaks on the web export).

## 6. Expo stack health

`apps/mobile/package.json`: Expo SDK ~56.0.15 (current major), React Native 0.85.3 (New Architecture only at this version), React 19.2.4 aligned with web after #231, expo-router ~56.2.14, reanimated 4.3.1 + react-native-worklets 0.8.3 (the correct rea4 pairing), react-native-screens 4.25.2, TypeScript ~6.0.3, `eve` 0.19.0 pinned, `experiments.reactCompiler: true` (app.json:50-52). This is a modern, coherent SDK 56 stack; nothing deprecated or mismatched jumped out.

Native project is CNG-managed: `/ios` and `/android` are gitignored (`apps/mobile/.gitignore`, "generated native folders"); the `apps/mobile/ios/` directory on disk (Homa.xcworkspace, Pods, build/) is an untracked local prebuild artifact, not source of truth. Correct setup; nobody should hand-edit it.

expo-updates usage: no runtime `Updates.*` calls anywhere in `apps/mobile/src` (grep clean), so behavior is the default check-on-launch, apply-next-launch. Fine for v1; a foregrounded `checkForUpdateAsync` + reload prompt is a later nicety.

Worth knowing for launch scope (from `apps/mobile/README.md:58-71`): no push notifications configured, no native onboarding (new families are sent to the web `/onboarding`), payments deliberately stay on the web (no IAP anywhere; build-log line 9644 records this as intentional under App Store rules), and native Google Sign-In sheet is absent (browser OAuth flow instead). Apple sign-in requires the bundle ID in Supabase's Apple provider Client IDs field; README flags it, memory says unconfirmed done.

## 7. Remaining steps: founder-only vs automatable

Founder-only (App Store Connect or dashboards agents cannot reach):
1. Open App Store Connect and report the actual state of 1.0.0 build 5: attached to a version? metadata complete? ever pressed Submit for Review? Any rejection sitting unread since 07-21? This is the single gating unknown.
2. Supply or save `ascAppId` (visible in ASC under App Information, or via one interactive `eas submit`) so the submit profile can be committed and future submits go non-interactive.
3. Privacy nutrition labels (App Privacy questionnaire) in ASC. Not automatable; app collects account data (email), user content (chat, child names/ages, photos), identifiers. Needs honest answers.
4. Screenshots and listing copy in ASC: 6.9" and 6.5" iPhone screenshot sets, description, keywords, subtitle, support URL, marketing URL. (Agents can produce the assets; only the founder can upload/enter them unless an ASC API key is provisioned.)
5. Age rating questionnaire. Note: Homa is parent-facing, so it should NOT enroll in the Kids Category; rate honestly (likely 4+) and keep the parent-directed positioning in review notes.
6. App Review Information: demo account exists and was verified end-to-end on 2026-07-21 (`sswift+homatest@swiftdrtv.com`, credentials recorded in project memory `mobile-app-store-release.md`; "App Review Family", child Maya). Enter it plus review notes explaining sign-in options and that billing is web-only with no in-app purchase links (Guideline 3.1.3(a) posture).
7. Verify Supabase Apple provider Client IDs contains `com.thankshoma.homa` (Supabase dashboard, Auth > Providers > Apple). If missing, SIWA fails in the store binary, which is a guaranteed review rejection.
8. Privacy policy URL field: `https://thankshoma.com/privacy` returns 200 (probed today), `/terms` also 200. Ready to paste.
9. Decide the product question in section 3: land parity on main first, or ship the 3-tab main as v1.

Automatable (agent-side, in order):
1. Decide-then-build: once section 3 is ruled, `eas build --platform ios --profile production` from main HEAD so the binary matches OTA fingerprint `9c5e8a85...` (or its successor). Everything shipped since 07-21, including the session-fork fix (#230) and choice cards, only reaches phones via a new binary.
2. Commit `ascAppId` into `eas.json` submit.production once known; thereafter `eas submit --platform ios --latest --non-interactive`.
3. Add the OTA fingerprint-drift guard and pin eas-cli (section 4).
4. Produce screenshot/listing asset packs for the founder to upload; or provision an ASC API key as an EAS secret to automate submission metadata end-to-end.
5. Optional hardening: in-app update check UX; a CI job that runs `npx expo-doctor` on mobile changes.

## 8. Corrections to project memory

- PR #72 merged 2026-07-27T21:26:56Z, not 07-20/21 (07-20 was branch creation; `gh pr view 72` mergedAt is authoritative). The 1.0.0 store build therefore predates its own code landing on main by six days.
- Build `fb45d812` is the ERRORED build 4, not the release candidate; the submitted binary is `fa773afb` (build 5).
- "ascAppId submit status TBD" is now resolved: still absent from eas.json, non-interactive submit still blocked.
- "First public release in flight" overstates: binary uploaded to ASC, but no public listing exists as of 2026-07-28 and no repo/build-log evidence that review submission ever happened.

## Key file pointers

- `apps/mobile/eas.json` (submit profile empty at lines 27-29; production build profile lines 17-25)
- `apps/mobile/app.json` (version line 5, updates lines 10-15, iOS block lines 16-23, reactCompiler lines 50-52)
- `.github/workflows/mobile-ota-update.yml` (OTA pipeline; misleading comment lines 3-12; unpinned CLI line 61)
- `apps/mobile/README.md` (release runbook lines 20-40; native boundaries lines 58-71)
- `apps/mobile/package.json` (stack versions, lines 14-51)
- `apps/mobile/.gitignore` (generated native folders; ios/ untracked)
- `docs/homa-planning/plans/2026-07-20-mobile-parity-and-beyond.md` (store-build cadence assumptions, lines 127-133)
- GitHub: PR #72 (merged 07-27), PR #76 (closed unmerged 07-27), issues #196, #263, #211
