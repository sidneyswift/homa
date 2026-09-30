import { tmpdir } from "node:os";
import { join } from "node:path";

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e", testMatch: "conversation-controls.spec.ts", workers: 1,
  reporter: "line", timeout: 30_000, outputDir: join(tmpdir(), "homa-conversation-controls-results"),
});
