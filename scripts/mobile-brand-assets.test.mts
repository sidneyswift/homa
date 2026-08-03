import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { colorTokens, logoGeometry } from "../packages/design/src/contract/index.ts";

const appConfigPath = new URL("../apps/mobile/app.json", import.meta.url);
const brandAsset = (name: string) => new URL(`../apps/mobile/assets/brand/${name}`, import.meta.url);

const retiredColors = ["#FBF7F0", "#221E1A"] as const;

test("Expo surfaces use the Quiet canvas projection", async () => {
  const config = JSON.parse(await readFile(appConfigPath, "utf8")) as {
    expo: {
      android: { adaptiveIcon: { backgroundColor: string } };
      plugins: Array<string | [string, Record<string, unknown>]>;
    };
  };

  assert.equal(config.expo.android.adaptiveIcon.backgroundColor, colorTokens.canvas);
  const splash = config.expo.plugins.find(
    (plugin): plugin is [string, { backgroundColor: string }] =>
      Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  );
  assert.ok(splash, "Expo splash-screen plugin is missing");
  assert.equal(splash[1].backgroundColor, colorTokens.canvas);
});

test("native SVG projections stay generated from the contract", async () => {
  const names = [
    "android-background.svg",
    "android-foreground.svg",
    "android-monochrome.svg",
    "icon.svg",
    "splash-icon.svg",
  ];
  const requiredColors: Record<string, readonly string[]> = {
    "android-background.svg": [colorTokens.canvas],
    "android-foreground.svg": [colorTokens.paper, colorTokens.visualCoral, colorTokens.ink],
    "android-monochrome.svg": [colorTokens.paper],
    "icon.svg": [colorTokens.canvas, colorTokens.paper, colorTokens.visualCoral, colorTokens.ink],
    "splash-icon.svg": [colorTokens.paper, colorTokens.visualCoral, colorTokens.ink],
  };

  for (const name of names) {
    const source = await readFile(brandAsset(name), "utf8");
    if (name !== "android-background.svg") {
      assert.ok(source.includes(logoGeometry.housePath), `${name} must use the master house path`);
    }
    for (const color of requiredColors[name]) {
      assert.ok(source.includes(color), `${name} is missing contract color ${color}`);
    }
    for (const retired of retiredColors) {
      assert.equal(source.includes(retired), false, `${name} still contains retired color ${retired}`);
    }
  }
});
