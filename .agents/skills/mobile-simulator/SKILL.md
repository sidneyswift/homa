---
name: mobile-simulator
description: Build, launch, and drive the Homa mobile app (apps/mobile) in the iOS Simulator through Claude Code Desktop's own simulator pane, never screen takeover. Use when asked to run, test, build, launch, or check the mobile app on a simulator, or to verify a mobile change actually works end to end.
---

# Mobile simulator

## Why this exists, and why not computer-use

Claude Code Desktop ships a dedicated iOS Simulator pane
(`mcp__Claude_Code_iOS_Simulator__*` tools) that builds, installs,
launches, taps, types, and screenshots a simulator device directly,
without touching the user's screen or mouse. Prefer it over
`computer-use`/screen takeover for anything simulator-related: the user
keeps their computer, and the workflow stays headless-safe.

## Prerequisites, check once and fix if missing

- **Xcode 26 or newer.** `apps/mobile` is Expo SDK 56, and one of its
  native deps (`expo-modules-jsi`) uses Swift 6.2 syntax (`weak let`),
  which Xcode's Swift 6.1 (Xcode 16.x) rejects outright as a parse
  error. Check with
  `/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild -version`.
  Below 26, the fix is a real macOS plus Xcode upgrade (Xcode 26 needs
  macOS 26.2+); there is no dependency-side workaround for this one.
- **`xcode-select -p`** should point at
  `/Applications/Xcode.app/Contents/Developer`, not the bare Command
  Line Tools path. Fix:
  `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
  (needs the user's password interactively, so ask them to run it).
- **CocoaPods installed** (`pod --version`). If missing:
  `brew install cocoapods`. If Homebrew refuses over an unrelated
  untrusted tap, `HOMEBREW_NO_REQUIRE_TAP_TRUST=1 brew install cocoapods`
  is the narrow, one-off fix, not a permanent trust change.
- If `pod install` fails on a CDN or trunk permission error mentioning
  `~/.netrc`, that file's permissions are too open for curl to trust it:
  `chmod 600 ~/.netrc` fixes it, and is the correct permission for that
  file regardless.

## One-time setup per worktree

`apps/mobile/.env` and `apps/mobile/ios/` are both gitignored, so a
fresh worktree needs this before anything else:

```sh
cp <a worktree that already has it>/apps/mobile/.env apps/mobile/.env
cd apps/mobile && npx expo prebuild --platform ios --no-install
cd ios && LANG=en_US.UTF-8 pod install
```

`expo prebuild` generates `ios/Homa.xcworkspace`. Never hand-edit
anything under `ios/`, it gets regenerated. Confirm `pod install` ends
with "Pod installation complete" and a dependency count; the
"deprecated, use `expo run:ios`" notice is expected and harmless.

## Every session: boot, build, launch

```sh
xcrun simctl list devices available          # pick a device UDID
xcrun simctl boot <udid>                     # if not already booted
```

Then, through the simulator tools:

1. `control` action `attach`, opens the live pane. If it errors "No
   booted simulator found" right after boot, wait a couple of seconds
   and retry once; CoreSimulator needs a moment to register a fresh
   boot.
2. `build` action `build`, with `workspace_path` pointing at
   `apps/mobile/ios/Homa.xcworkspace` and `scheme` set to `Homa`.
   Omit `device`: building for the generic iOS Simulator platform and
   launching onto whatever is already booted is more reliable than
   device-name matching, which can fail even when `simctl` confirms
   the named device is booted.
3. Watch the returned log path for `BUILD SUCCEEDED` or `BUILD FAILED`
   instead of polling `build_status` repeatedly. Background a
   grep-until-match loop on the log file and let its own completion
   notify you.
4. `control` action `launch`, with the `app_path` the build reported (a
   `.app` under `~/Library/Application Support/Claude/simulator-builds/
   <hash>/DerivedData/Build/Products/Debug-iphonesimulator/`). This
   installs and launches in one step; there is no need for a manual
   `simctl install`/`launch`.
5. Start Metro if it is not already up: `pnpm --filter mobile start`
   in the background, then wait for `Waiting on http://localhost:8081`.
   A Debug build is a dev client: it needs Metro to load any JS. Once
   connected, editing anything under `apps/mobile/src` and saving
   hot-reloads in the simulator in a second or two, no rebuild needed.

On a later run in the same session, skip straight to step 4: the built
`.app` persists across the session at that `simulator-builds` path.
Only rebuild after a native change (a package with native code, an
Expo SDK bump, native `app.json` config). A pure JS or TS change never
needs a rebuild, just Metro's hot reload.

## Driving the app: tap and text

- **Coordinates are in points, not the screenshot's pixel dimensions.**
  `attach`/`launch` report the point coordinate space (for example
  `440x956`). Screenshots come back at a larger pixel size. Convert
  with `point = pixel * (point_width / screenshot_pixel_width)`, close
  to `pixel / 2.09` on a 3x-scale device. Sending raw screenshot-pixel
  coordinates straight to `tap` lands in the wrong place silently:
  there is no error, just a missed tap.
- **Tapping mid-text can select a word instead of placing a cursor**
  (shows a blue selection plus a spell-check bubble). Tap in the empty
  padding to the right of the existing text to reliably place the
  cursor at the end instead.
- **`text` into an email or URL-shaped field can silently drop trailing
  characters** (seen once: `@domain.com` landing as `@domain.` with no
  `com`). Always screenshot after typing into such a field to confirm
  the full string landed before submitting. If it is short, tap to
  place the cursor at the true end (see above) and type the missing
  remainder rather than clearing and starting over.
- Sign-in and every other network call in the simulator hit the real
  Supabase project, the same one web uses. Use a `+homatest` alias
  account for anything that should not look like a real family (see
  the prod test family hygiene note in project memory); errors shown
  are real backend responses, not simulator artifacts.

## If attach or launch cannot find a simulator that simctl says is booted

This means Claude Code Desktop's simulator tooling is holding a stale
connection to CoreSimulator, most commonly right after an Xcode
upgrade (the framework it links against changed underneath it). Fix:
restart Claude Code Desktop. Metro and the booted simulator's installed
apps do not survive that restart either, so afterward: reboot the
device, `launch` the existing `.app` again (no rebuild needed), and
restart Metro.
