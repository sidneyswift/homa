import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "conversation-outbox.spec.ts",
  workers: 1,
  reporter: "line",
  outputDir: join(tmpdir(), "homa-conversation-browser-results"),
});
