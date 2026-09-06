import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "deeper-progress.spec.ts",
  workers: 1,
  fullyParallel: false,
  reporter: "list",
});
