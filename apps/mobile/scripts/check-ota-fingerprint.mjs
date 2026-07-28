#!/usr/bin/env node
// Guards against the 2026-07-27 class of failure: mobile-ota-update.yml
// published a green update every time for weeks while every installed
// binary's native fingerprint had already drifted away from it, so no
// phone ever received the JavaScript. expo-updates matches an OTA update
// to an installed build by exact fingerprint (runtimeVersion policy
// "fingerprint" in app.json); a mismatch is not a warning, it is silence.
//
// This script computes the current checkout's fingerprint the same way
// EAS does at build time, and compares it against the fingerprint of the
// most recent FINISHED production build recorded by EAS. Run it from
// apps/mobile, after `pnpm install` and BEFORE `eas update`, from a clean
// checkout with no apps/mobile/ios directory: a locally prebuilt ios/
// folder gets hashed as a "bareNativeDir" source and silently produces a
// wrong, non-reproducible fingerprint (found the hard way during the
// 2026-07-28 launch investigation). CI checkouts never have that folder,
// so this is a real guard there, not a footgun.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

function run(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function fail(message) {
  console.error(`\nOTA fingerprint guard: ${message}\n`);
  console.error(
    "This means publishing an OTA update right now would ship JavaScript " +
      "that no installed binary can receive: expo-updates silently ignores " +
      "an update whose runtimeVersion (fingerprint) does not match the " +
      "installed build. Cut a new production build from this commit " +
      "(`eas build --platform ios --profile production`) before this " +
      "workflow can publish safely again. See .agents/skills/ios-release.",
  );
  process.exit(1);
}

if (existsSync(new URL("../ios", import.meta.url))) {
  fail(
    "apps/mobile/ios exists in this checkout. A prebuilt native folder is " +
      "hashed as a fingerprint source and produces a wrong result; this " +
      "guard must run against a clean checkout with no ios/ directory.",
  );
}

let currentFingerprint;
try {
  const raw = run("npx", [
    "@expo/fingerprint",
    "fingerprint:generate",
    "--platform",
    "ios",
    ".",
  ]);
  currentFingerprint = JSON.parse(raw).hash;
} catch (error) {
  fail(`could not compute the current fingerprint: ${error.message}`);
}

if (!currentFingerprint) {
  fail("fingerprint:generate returned no hash.");
}

let latestBuild;
try {
  const raw = run("npx", [
    "eas-cli",
    "build:list",
    "--platform",
    "ios",
    "--build-profile",
    "production",
    "--status",
    "finished",
    "--limit",
    "1",
    "--json",
    "--non-interactive",
  ]);
  [latestBuild] = JSON.parse(raw);
} catch (error) {
  fail(`could not query EAS for the latest production build: ${error.message}`);
}

if (!latestBuild) {
  fail(
    "no FINISHED production build exists on EAS at all. An OTA update " +
      "would have nothing to attach to.",
  );
}

const buildFingerprint = latestBuild.fingerprint?.hash;
if (!buildFingerprint) {
  fail(`build ${latestBuild.id} has no recorded fingerprint.`);
}

if (currentFingerprint !== buildFingerprint) {
  fail(
    `this checkout's fingerprint (${currentFingerprint}) does not match ` +
      `the latest production build ${latestBuild.id}'s fingerprint ` +
      `(${buildFingerprint}, built ${latestBuild.createdAt} from commit ` +
      `${latestBuild.gitCommitHash?.slice(0, 8) ?? "unknown"}).`,
  );
}

console.log(
  `OTA fingerprint guard: ok. Matches production build ${latestBuild.id} ` +
    `(${buildFingerprint}).`,
);
