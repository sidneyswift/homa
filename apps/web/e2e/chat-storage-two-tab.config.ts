import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "chat-storage-two-tab.spec.ts",
  workers: 1,
});
