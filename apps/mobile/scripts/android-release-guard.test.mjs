import assert from "node:assert/strict";
import test from "node:test";

import {
  assertEasBuildPlatform,
  containsAndroidPublicReleaseCommand,
  readPlatformDisposition,
} from "./android-release-guard.mjs";

test("the founder-owned disposition permits only iOS public builds", () => {
  const disposition = readPlatformDisposition();
  assert.equal(disposition.owner, "founder");
  assert.equal(disposition.ios.publicDistribution, "approved");
  assert.equal(disposition.android.publicDistribution, "blocked");
  assert.equal(disposition.android.allowedScope, "compile-only");
  assert.deepEqual(assertEasBuildPlatform({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "ios" }, disposition), {
    status: "allowed",
    platform: "ios",
  });
  assert.throws(
    () => assertEasBuildPlatform({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "android" }, disposition),
    /Android public distribution is blocked/u,
  );
});

test("the EAS hook fails closed on an unknown build platform but ignores ordinary CI", () => {
  const disposition = readPlatformDisposition();
  assert.deepEqual(assertEasBuildPlatform({ CI: "true" }, disposition), { status: "not-eas-build" });
  assert.throws(
    () => assertEasBuildPlatform({ EAS_BUILD: "true", EAS_BUILD_PLATFORM: "windows" }, disposition),
    /must be ios or android/u,
  );
});

test("all Android, ambiguous, and folded EAS public-release commands fail closed", () => {
  for (const command of [
    "eas build --platform android",
    "eas build --platform=android",
    "eas build -p android",
    "eas build -p=android",
    "eas submit --platform all",
    'eas submit --platform "android"',
    'eas submit --platform="android"',
    'eas submit -p "android"',
    "eas submit -p='android'",
    'eas submit "--platform" "android"',
    'eas submit "-p" android',
    "eas submit \\\n      --platform android",
    "eas submit \\\r\n      --platform='all'",
    "npx eas-cli@21.4.0 build -p all",
    "npm exec eas-cli@21.4.0 -- submit --platform android --latest",
    "npm exec eas-cli@21.4.0 -- build --platform all",
    'npm exec eas-cli@21.4.0 -- "$EAS_ACTION" --platform ios',
    "(eas submit --platform android --latest)",
    "$(eas submit --platform android --latest)",
    "`eas submit --platform android --latest`",
    "e'a's submit --platform android --latest",
    "e\\a\\s submit --platform android --latest",
    "eas\\-cli@21.4.0 submit --platform android --latest",
    "eval 'eas submit --platform android --latest'",
    '"$EAS_BIN" submit --platform ios --latest',
    'npm exec "$EAS_PACKAGE" -- submit --platform ios --latest',
    "eas>/dev/null submit --platform android --latest",
    "eas 2>/dev/null submit --platform android --latest",
    "eas submit --platform ios --latest > /dev/null",
    "python -c 'subprocess.run([\"eas\", \"submit\", \"--platform\", \"android\"])'",
    "eas submit --latest",
    'eas submit --platform "$TARGET"',
    "eas submit --platform ios --platform android",
    "run: >\n  eas submit\n  --platform android\n  --latest",
    "run: |\n  eas submit \\\n    --platform android\n  echo done",
    "steps:\n  - name: safe\n    run: echo safe\n  - run: eas submit --platform android --latest",
    "steps: [{ run: eas submit --platform android --latest }]",
    "steps:\n  - &release\n    run: eas submit --platform android --latest\n  - *release",
    "env:\n  RELEASE_CMD: npm exec eas-cli@21.4.0 -- submit --platform android --latest\nsteps:\n  - run: $RELEASE_CMD",
    "strategy:\n  matrix:\n    release:\n      - eas submit --platform android --latest\nsteps:\n  - run: ${{ matrix.release }}",
    "steps:\n  - run: $RELEASE_CMD",
    "steps:\n  - run: RELEASE_KIND=store $RELEASE_CMD",
    "steps:\n  - run: command $RELEASE_CMD",
    "steps:\n  - run: if $RELEASE_CMD",
  ]) {
    assert.equal(containsAndroidPublicReleaseCommand(command), true, command);
  }
});

test("only a single explicit literal iOS platform is approved", () => {
  for (const command of [
    "eas build --platform ios",
    'eas submit "--platform" "ios"',
    "eas submit --platform='ios'",
    "npx eas-cli@21.4.0 submit -p ios --latest",
    "npm exec eas-cli@21.4.0 -- submit --platform ios --latest",
    "(eas submit --platform ios --latest)",
    'e"a"s submit --platform ios --latest',
    "eas\\-cli@21.4.0 submit --platform ios --latest",
    "run: >\n  eas submit\n  --platform ios\n  --latest",
    "run: |\n  eas submit \\\n    --platform ios\n  echo done",
    "steps:\n  - run: eas submit --platform ios --latest",
    "steps: [{ run: eas submit --platform ios --latest }]",
    "env:\n  RELEASE_CMD: npm exec eas-cli@21.4.0 -- submit --platform ios --latest\nsteps:\n  - run: echo reviewed separately",
    "steps:\n  - run: |\n      node <<'NODE'\n      const message = `${process.env.MESSAGE}`;\n      NODE\n      echo done",
    "npx eas-cli@21.4.0 update --platform ios",
    "expo export --platform android",
    "gradlew :app:assembleDebug",
    "echo release work is easier when explicit",
  ]) {
    assert.equal(containsAndroidPublicReleaseCommand(command), false, command);
  }
});
