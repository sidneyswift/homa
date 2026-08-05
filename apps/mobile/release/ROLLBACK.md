# iOS delivery and rollback

Homa has two production delivery rails. The classifier decides which rail is
safe for the exact `main` commit. A native change never becomes an OTA update
by judgment or by filename alone.

## Evidence states are not interchangeable

| State | What it proves | What it does not prove |
|---|---|---|
| EAS build `finished` | Expo produced a store-distribution binary from the recorded source and fingerprint | App Store Connect received it, Apple processed it, or a phone installed it |
| App Store Connect processed | Apple accepted the uploaded binary for TestFlight or review | A tester installed it or the public release began |
| TestFlight available | The processed build can be assigned to the named test group | The priority journeys passed on a physical device |
| Installed-device certification | The named device, OS, installation path, source, build number, and runtime passed the recorded checks | Another device or a later update behaves identically |
| EAS Update published | Expo accepted the verified JavaScript bytes for a compatible runtime | A phone downloaded or launched those bytes |

Keep these states as separate evidence rows. Never label an EAS artifact an
App Store release before App Store Connect reports that state.

## OTA-safe commit

The `Mobile OTA update` workflow requires a finished iOS store build with the
`production` profile and channel. Its native fingerprint must match the
checkout, and its source commit must be an ancestor of the release commit. The
workflow then waits for exact-SHA `build-and-check` and Vercel success, runs the
full mobile suites, exports once with source maps, rejects forbidden product
sources and secrets, publishes those same bytes, and writes a schema-validated
delivery receipt.

To recover from a bad OTA:

1. Revert the bad source on `main` with a normal pull request.
2. Let the same workflow classify, test, verify, and publish the revert.
3. Confirm the new receipt names the revert source, `production` channel,
   expected runtime fingerprint, update ID, update group, eligible store build,
   and exact production gates.
4. On a physical iPhone that already has the compatible App Store binary,
   verify launch, background and foreground recovery, termination and relaunch,
   and the repaired journey after the update is fetched.

Never reuse an old export directory or edit a receipt. An OTA rollback is a new
verified update with its own provenance and the same compatible runtime.

## Store-binary-required commit

Use this rail when the classifier reports `store-binary-required` or
`fingerprint-changing`.

### 1. Freeze and prove the source

1. Start from a reviewed commit already merged to `main` with a clean checkout.
2. Record the full source SHA and current Expo fingerprint.
3. Require successful `build-and-check`, Vercel, mobile unit suites, native
   gauntlet, brand assets, identity assets, and production bundle inspection.
4. Keep one physical iPhone on the previous public binary. Prove its launch,
   authentication, reads, writes, and recovery against the current production
   server before releasing a server change that the old binary cannot use.

### 2. Build and submit with the pinned CLI

Run from `apps/mobile`:

```sh
npx eas-cli@21.4.0 build --platform ios --profile production --non-interactive
npx eas-cli@21.4.0 submit --platform ios --id EAS_BUILD_ID --profile production --non-interactive
```

Record the EAS build ID, source SHA, fingerprint, `ios` platform, `finished`
status, `store` distribution, `production` build profile, `production` channel,
app version, and build number. Separately record the EAS submission ID and the
App Store Connect build number. A completed submit command still is not an
installed-device result.

### 3. Rehearse through TestFlight

1. Wait for App Store Connect processing, then assign the exact build to the
   internal TestFlight group.
2. Perform a clean TestFlight install on one supported iPhone.
3. Upgrade a second supported iPhone from the previous public binary without
   deleting local state.
4. On both paths, certify launch, relaunch, authentication, planner changes,
   printable opening, StoreKit restore, voice route and interruption recovery,
   offline recovery, large text, VoiceOver, Reduced Motion, icon, splash, and
   background and foreground continuity.
5. Record device model, iOS version, install path, build number, source SHA,
   fingerprint, tester, timestamps, failures, and retest evidence.

Do not promote the build while any priority journey or previous-binary server
compatibility check is unresolved.

### 4. Release with a pause path

Submit the tested build for App Review. When approved, use App Store phased
release. Record who owns the release control, the initial cohort, observation
window, and the exact App Store Connect pause action. Pause immediately for a
privacy, data-loss, launch, authentication, purchase, or recovery failure.

Before expanding the phase, repeat a clean App Store install and an upgrade
from the previous public build. App Store availability and installation are two
separate observations and both are required.

### 5. Publish the matching OTA rail

After the new store build is finished and eligible, dispatch `Mobile OTA
update` from the current exact `main` commit. The classifier must select that
build or another finished production build with the same fingerprint whose
source is an ancestor. The resulting receipt must bind the store build, exact
`main` source, fingerprint, verified export, EAS update, and production gates.

This publication is required even when the JavaScript matches the binary. It
establishes the production channel for later compatible updates. Verify real
OTA uptake by terminating and relaunching a physical device with the new store
binary, then record the installed update ID and runtime fingerprint separately.

## Binary rollback

An installed store binary cannot be replaced by EAS Update when its native
fingerprint is wrong.

1. Pause the App Store phased release and record its visible state.
2. Keep the production server compatible with the previous installed binary.
3. Restore the last known-good source with a normal pull request.
4. Increment the iOS build number, create a new pinned production EAS build,
   and submit that new build. Never reuse the bad build number.
5. Repeat App Store Connect processing, TestFlight clean-install and upgrade
   rehearsal, physical-device certification, App Review, and phased release.
6. Once the replacement store build is eligible, publish and verify its matching
   OTA rail as described above.

The prior identity deleted by the brand migration is never a rollback target.
Rollback means the latest compatible Quiet authority release.

## Android boundary

Android remains compile-only. CI exports Android JavaScript, generates native
projects, and assembles a debug binary for compatibility proof. The
founder-owned `release/platform-disposition.json` and the EAS pre-install hook
block public Android builds. There is no Google Play submit profile. Changing
that boundary requires a founder-approved pull request with an equivalent
Google Play build, internal-test, installed-device, staged-release, pause, and
rollback rail.
