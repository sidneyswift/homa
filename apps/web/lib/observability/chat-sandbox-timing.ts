import { randomUUID } from "node:crypto";

import type { SandboxBackend, SandboxSession } from "eve/sandbox";

/** Preview diagnostics only. Backend identity and reconnect state stay owned by Eve. */
export function withPreviewSandboxTiming<BO, SO>(backend: SandboxBackend<BO, SO>): SandboxBackend<BO, SO> {
  if (process.env.VERCEL_ENV !== "preview" || process.env.HOMA_PREVIEW_SANDBOX_TIMING !== "1") return backend;

  return {
    name: backend.name,
    prewarm: input => backend.prewarm(input),
    async create(input) {
      const acquisitionId = randomUUID();
      const sessionId = input.tags?.sessionId;
      const reconnectMetadataPresent = input.existingMetadata !== undefined;
      async function measure<T>(stage: "acquire" | "read_skill" | "capture_state" | "dispose", operation: () => PromiseLike<T>): Promise<T> {
        const startedAtMs = Date.now();
        const started = performance.now();
        let outcome: "ok" | "error" = "error";
        try {
          const value = await operation();
          outcome = "ok";
          return value;
        } finally {
          try {
            console.info("[chat-sandbox]", JSON.stringify({ stage, acquisitionId, sessionId,
              startedAtMs, durationMs: Math.round(performance.now() - started), outcome,
              reconnectMetadataPresent }));
          } catch {
            // Diagnostics cannot change workspace acquisition, I/O or cleanup.
          }
        }
      }
      const handle = await measure("acquire", () => backend.create(input));
      const source = handle.session;
      // Forward through the original receiver, including methods that rely on private fields.
      const session: SandboxSession = {
        get id() { return source.id; },
        resolvePath: path => source.resolvePath(path),
        run: options => source.run(options),
        spawn: options => source.spawn(options),
        readFile: options => source.readFile(options),
        readBinaryFile: options => source.readBinaryFile(options),
        readTextFile: options => {
          const path = options.path;
          return (path.startsWith("/workspace/skills/") || path.startsWith("skills/")) && path.endsWith("/SKILL.md")
            ? measure("read_skill", () => source.readTextFile(options))
            : source.readTextFile(options);
        },
        writeFile: options => source.writeFile(options),
        writeBinaryFile: options => source.writeBinaryFile(options),
        writeTextFile: options => source.writeTextFile(options),
        removePath: options => source.removePath(options),
        setNetworkPolicy: policy => source.setNetworkPolicy(policy),
      };
      return {
        session,
        useSessionFn: options => handle.useSessionFn(options),
        captureState: () => measure("capture_state", () => handle.captureState()),
        dispose: () => measure("dispose", () => handle.dispose()),
      };
    },
  };
}
