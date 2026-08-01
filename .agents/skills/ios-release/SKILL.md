---
name: ios-release
description: Ship the Homa iOS app (apps/mobile) safely. Use when building, submitting, or OTA-updating the mobile app, when deciding whether a change ships over the air or needs a store build, or when checking App Store release state. Not for running the app locally; mobile-simulator owns that.
---

# iOS release

## The one law: the fingerprint decides everything

expo-updates matches OTA JavaScript to installed binaries by native
fingerprint (`runtimeVersion.policy: "fingerprint"` in
`apps/mobile/app.json`). An OTA update reaches a phone only if a FINISHED
production binary with the same fingerprint is installed there. Break the
match and you get the July 2026 failure silently: three weeks of green OTA
publishes that no installed phone ever received, and a store binary that
could never be patched.

Before calling any mobile change shipped, prove the chain:

```sh
cd apps/mobile && npx expo fingerprint --platform ios   # fingerprint of HEAD
npx eas-cli build:list --platform ios --limit 5 --json --non-interactive \
  | jq '.[] | {id, status, version: .appVersion, buildNumber: .appBuildVersion, fingerprint: .fingerprintHash, commit: .gitCommitHash}'
npx eas-cli update:list --branch production --limit 5 --non-interactive
```

The update's fingerprint must equal a FINISHED production build's
fingerprint, and that build must be the one users install. If they differ,
the change did not ship, no matter how green the workflow run was.

## OTA or store build?

- **OTA (automatic)**: any pure JS/TS change under `apps/mobile/src` or
  `packages/core`. Pushing to `main` runs
  `.github/workflows/mobile-ota-update.yml`, which publishes to the
  `production` channel. Nothing to do beyond the fingerprint proof above.
- **Store build (deliberate)**: adding/removing any package with native
  code, an Expo SDK bump, or native `app.json` config (plugins, ios/android
  blocks, splash, icons). These change the fingerprint, which orphans every
  installed binary from future OTA until a new binary ships. Batch native
  changes together; each one costs a full build + review cycle.

When in doubt: run `npx expo fingerprint --platform ios` before and after
the change. Same hash = OTA. Different hash = store build.

## Store build and submit

```sh
cd apps/mobile
npx eas-cli build --platform ios --profile production   # autoIncrement bumps build number
npx eas-cli submit --platform ios --latest
```

- Build from `main` only. The July 2026 1.0.0 binary was built from a
  branch that was closed unmerged; main could not reproduce the app that
  sat in App Store Connect. Never again: the submitted commit must be an
  ancestor of `main` at submit time.
- `eas.json` `submit.production.ios.ascAppId` pins submissions to Homa's App
  Store Connect record, so the configured EAS credentials can submit
  non-interactively. If Apple authentication still expires or challenges the
  account, that is a founder-action item, not something to work around.
- SIWA is a provisioning-profile capability. Build 4 (fb45d812) failed
  exactly there; if an EAS build errors with a missing
  `com.apple.developer.applesignin` entitlement, the profile must be
  regenerated interactively (founder), then rebuild.
- After any store build lands in ASC, publish one OTA update from the same
  commit so the new fingerprint has a matching update stream from day one.

## What agents cannot see or do (hand to the founder, explicitly)

App Store Connect state is invisible without an ASC API key: whether a
build is attached to a version, review status, rejection messages,
metadata completeness. When release state matters, ask the founder to read
ASC directly, or to provision an ASC API key as an EAS secret. Founder-only
surfaces: ASC metadata and screenshots, App Privacy questionnaire, age
rating questionnaire, review notes and demo account entry, Supabase Apple
provider Client IDs, Apple capability/profile regeneration.

The App Review demo account is the sandbox family
`sidney+homatestappreview@recoupable.com` ("App Review Family"). Keep it working:
never delete it, never let entitlement changes wall it, and verify sign-in
on device before every submit.

## Review-sensitive invariants (why the app is shaped this way)

- The app sells the monthly Homa, Homa Plus, and Homa Max plans through
  StoreKit. It never opens or links to Stripe checkout. Existing Stripe-paid
  families receive the same provider-neutral entitlement after signing in and
  are never asked to subscribe twice. Changing this posture is a founder
  decision with review consequences, not a code cleanup.
- Account deletion in-app is required (5.1.1(v)) because Apple/Google/email
  sign-in creates accounts in-app. Do not ship a build that removes or
  hides it.
- Sign in with Apple must stay working next to Google (4.8): its
  Supabase Client IDs entry and the entitlement are both load-bearing.

## Verify a release end to end

1. `eas build:list` shows the new build FINISHED with the expected
   fingerprint and a main-ancestor commit.
2. `eas submit` (or founder) confirms delivery to ASC; founder confirms
   review state.
3. Install the binary path on a simulator via the mobile-simulator skill;
   sign in with the demo account; send one chat turn; confirm streaming.
4. Publish a trivial OTA update and confirm `update:list` shows the
   matching fingerprint.
