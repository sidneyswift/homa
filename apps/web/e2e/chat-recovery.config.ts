import { defineConfig } from "@playwright/test";

export default defineConfig({ testDir: ".", testMatch: "chat-recovery.spec.ts", workers: 1 });
