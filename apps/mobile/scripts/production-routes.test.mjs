import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const configPath = require.resolve("../metro.config.js");

test("release discovery excludes lab routes while development keeps them", () => {
  const original = process.env.NODE_ENV;
  try {
    for (const mode of ["production", "development"]) {
      process.env.NODE_ENV = mode;
      delete require.cache[configPath];
      const config = require(configPath);
      const patterns = [config.resolver.blockList].flat().filter(Boolean);
      const blocked = (path) => patterns.some((pattern) => pattern.test(path));
      assert.equal(blocked("/repo/apps/mobile/src/app/labs/onboarding-v2/index.tsx"), mode === "production");
      assert.equal(blocked("C:\\repo\\apps\\mobile\\src\\app\\labs\\onboarding-v2\\index.tsx"), mode === "production");
      assert.equal(blocked("/repo/apps/mobile/src/app/(auth)/signin.tsx"), false);
      assert.equal(blocked("/repo/apps/mobile/src/app/(app)/index.tsx"), false);
    }
  } finally {
    if (original === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = original;
    delete require.cache[configPath];
  }
});
