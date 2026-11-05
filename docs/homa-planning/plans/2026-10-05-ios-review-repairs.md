# October 5 iOS review evidence

Tracking: gh#299, gh#308, gh#310 and gh#1136. This document records evidence;
current work status belongs on those issues.

## Apple record observed

- App ID 6790637746, Homa: Homeschool Lessons.
- Version 1.0, build 1.0.0 (48), rejected September 9, 2026.
- Submission 6fcc1a03-36c6-4a60-9401-08b6b724b878 contains the app,
  Homa Monthly, Homa Annual and Homa Membership. Subscription items are
  Ready for Review; the app's rejection prevents approval of the set.
- Guideline 4: Apple name/email requested again after Apple sign-in.
- Guideline 5.1.2: tracking declarations without ATT. Founder confirms no
  ad-network/data-broker sharing. All ten tracking flags changed to no and
  published October 5; preview no longer shows Data Used to Track You.
  The other collection categories still need a complete accuracy audit.
- Guideline 2.1: reviewer could not proceed past Print it, iPad Air 11-inch
  (M3), iPadOS 26.6. The local reveal layout was not scrollable.
- Earlier September 2 EULA rejection: current description contains Apple's
  standard EULA link. No change needed.
- Developer agreement warning disappeared after founder action. EU trader
  status warning remains; the distribution/account decision is founder-owned.

## Repair evidence

The patch retains Apple's one-time name with an account-keyed retry copy,
reuses it without asking again, makes reveal content scrollable and restores
print controls after failure. The existing consent UI now gates onboarding
with safe-area and scrolling; both making and reaction endpoints enforce the
authenticated member's recorded consent before AI work.

Before and after native fingerprint:
`bc62e95f737ecb7dec5083286e8dc4f08813b7b1`, matching finished production
build 48. No native dependency or configuration change is part of the patch.

Production bugs are **ESCALATED, 2026-10-05** pending deployment and device
verification: Apple identity repetition, the reviewer's print/onboarding
block, and AI processing before consent (gh#1136). Local source and tests
must not be described as a live repair.

## Remaining evidence before resubmission

- Resolve local native build compatibility: installed Xcode 27 rejects
  ExpoModulesJSI JavaScriptRuntime.swift's C-function-pointer conversion.
  The first attempt also rejected old pod deployment targets; overriding
  the simulator target to 16.4 reached the Swift failure. No dependency
  workaround was committed.
- Test the patched onboarding on iPhone and iPad compatibility mode,
  including large text, declined/failed consent, unavailable printer,
  cancelled print sheet, relaunch and Apple returning-user sign-in.
- Verify a production build from reviewed main, the review account, StoreKit
  purchase/restore, and the matched update on a physical iPhone.
- Reconcile collection labels, EU availability/trader status and review notes.
  Existing notes claim every plan has a seven-day trial, while the current
  pricing ruling gives annual fourteen days. Verify current StoreKit offers
  and correct the notes before submission.
- Submit the tested build and verify Waiting for Review. Apple approval and
  public availability remain separate future observations.

## Local validation

Mobile and web typecheck/lint passed (web lint has five existing warnings).
The isolation guard, mobile bootstrap (16 tests), chat (129 tests), voice,
auth recovery and accessibility checks passed. Rendered accessibility tests
passed all 43 tests in six suites under Node 24, including the new Apple
profile, consent and printing interactions. The independent code review
found no remaining actionable defect after the safe-area and name-cache fixes.

The documentation reconciliation command remains failing with broad
baseline/manifest drift and historical claim errors; it is not a green gate.
The new evidence document also needs inclusion in the ongoing reconciliation.

An existing development binary was installed on the iPad simulator as a
fallback, but the available app-control tool could not access Simulator.
Metro did not receive a bundle request. This is not a successful simulator
check and does not replace physical-device certification.

## Continued publication work

Device Hub at Xcode's `Contents/Applications/DeviceHub.app` is controllable
and replaces the unavailable Simulator app. The old development binary
loads Metro but lacks ExpoPushTokenManager, so it is not a valid test host.
A fresh EAS review-simulator build is in progress:
`fdc942fe-2109-4356-b19a-219c02006d15`.

Production and review-simulator profiles now pin the SDK 56-compatible
`macos-tahoe-26.4-xcode-26.4` image from Expo's official infrastructure
reference. The native static gauntlet passes all 33 tests with this pin.
The CI workflow was audited end to end again after its model-router test
addition; the exact audit hash was refreshed, and release-rail tests pass.
Android remains compile-only.

The first cloud simulator build failed because OpenIAP now references
StoreKit PricingTerms/BillingPlanType APIs unavailable in Xcode 26.4.
The build image was corrected to `macos-tahoe-26.5-xcode-26.6`, which
provides the newer StoreKit SDK while avoiding the Xcode 27 Swift failure.
Replacement simulator build: `d6e132c1-3b2b-4c6a-8191-c081496f52ad`.
Static gauntlet and mobile brand checks pass.

Apple's live subscription offers confirm monthly one-week and annual
two-week free trials. The app review notes were corrected accordingly.
