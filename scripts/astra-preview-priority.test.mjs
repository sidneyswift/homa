import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const file = fileURLToPath(import.meta.url);
const repo = dirname(dirname(file));
const installed = realpathSync(join(repo, "apps/web/node_modules/eve"));

async function compileOffline(appRoot) {
  const attempts = [];
  const deny = (kind) => () => {
    attempts.push(kind);
    throw new Error(`Network is disabled in the agent config test: ${kind}`);
  };
  const require = createRequire(import.meta.url);
  globalThis.fetch = deny("fetch");
  for (const name of ["http", "https"]) {
    const transport = require(`node:${name}`);
    transport.request = deny(`${name}.request`);
    transport.get = deny(`${name}.get`);
  }
  const net = require("node:net");
  net.connect = deny("net.connect");
  net.createConnection = deny("net.createConnection");
  net.Socket.prototype.connect = deny("socket.connect");
  require("node:tls").connect = deny("tls.connect");
  const dns = require("node:dns");
  for (const key of ["lookup", "resolve", "resolve4", "resolve6", "resolveAny"]) {
    dns[key] = deny(`dns.${key}`);
    dns.promises[key] = deny(`dns.promises.${key}`);
  }
  require("node:dgram").Socket.prototype.send = deny("dgram.send");
  syncBuiltinESMExports();

  const load = (path) => import(pathToFileURL(join(installed, "dist/src", path)));
  const { compileAgentConfig } = await load("compiler/normalize-agent-config.js");
  const { discoverAgent } = await load("discover/discover-agent.js");
  const { resolveWebSearchBackend, resolveWebSearchProviderTool } = await load("harness/provider-tools.js");
  const { resolveRuntimeModelReference } = await load("runtime/agent/resolve-model.js");
  const { mergeGatewayAutoCaching } = await load("harness/prompt-cache.js");
  const { manifest } = await discoverAgent({ appRoot, agentRoot: join(appRoot, "agent") });
  const config = await compileAgentConfig(manifest, {
    modelCatalog: {
      getModelLimits: deny("modelCatalog.getModelLimits"),
      getByProviderModelId: deny("modelCatalog.getByProviderModelId"),
    },
  });
  const backend = resolveWebSearchBackend(config.model);
  const search = await resolveWebSearchProviderTool(backend);
  const model = await resolveRuntimeModelReference(config.model);
  const captured = JSON.stringify(config);
  process.env.VERCEL_ENV = process.env.VERCEL_ENV === "preview" ? "production" : "preview";
  process.env.HOMA_PREVIEW_ASTRA_PRIORITY = config.model.providerOptions ? "0" : "1";
  assert.equal(JSON.stringify(config), captured);
  assert.equal(await resolveRuntimeModelReference(config.model), model);
  assert.deepEqual(attempts, []);
  return {
    config,
    search: { backend, type: search.type, id: search.id, args: search.args },
    model,
    providerOptions: mergeGatewayAutoCaching(config.model.providerOptions),
    networkAttempts: attempts,
  };
}

if (process.argv[2] === "--compile-offline") {
  process.stdout.write(JSON.stringify(await compileOffline(process.argv[3])));
} else {
  await test("Astra Priority compiles only for an explicitly enabled preview", { timeout: 60000 }, async (t) => {
    const root = mkdtempSync(join(tmpdir(), "homa-preview-priority-test-"));
    try {
      mkdirSync(join(root, "agent"));
      mkdirSync(join(root, "node_modules"));
      writeFileSync(join(root, "package.json"), JSON.stringify({ name: "web", type: "module" }));
      symlinkSync(installed, join(root, "node_modules/eve"), "dir");
      for (const name of ["agent.ts", "model.ts"]) {
        copyFileSync(join(repo, "apps/web/agent", name), join(root, "agent", name));
      }
      const run = (environment) => {
        const result = spawnSync(process.execPath, [file, "--compile-offline", root], {
          env: { PATH: `${dirname(process.execPath)}:/usr/bin:/bin`, TMPDIR: root, ...environment },
          encoding: "utf8",
          timeout: 20000,
          maxBuffer: 1024 * 1024,
        });
        assert.equal(result.status, 0, result.stderr.slice(-3000));
        return JSON.parse(result.stdout);
      };
      const baseline = run({});
      assert.equal(baseline.config.model.id, "openai/gpt-6-astra");
      assert.equal(baseline.config.reasoning, "medium");
      assert.equal(baseline.config.model.source, undefined);
      assert.equal(baseline.config.model.providerOptions, undefined);
      assert.deepEqual(baseline.providerOptions, { gateway: { caching: "auto" } });
      assert.deepEqual(baseline.search, { backend: "parallel", type: "provider", id: "gateway.parallel_search", args: {} });
      const cases = [
        ["default with flag enabled", { HOMA_PREVIEW_ASTRA_PRIORITY: "1" }, false],
        ["preview without flag", { VERCEL_ENV: "preview" }, false],
        ["preview with flag zero", { VERCEL_ENV: "preview", HOMA_PREVIEW_ASTRA_PRIORITY: "0" }, false],
        ["preview with nonliteral flag", { VERCEL_ENV: "preview", HOMA_PREVIEW_ASTRA_PRIORITY: "true" }, false],
        ["preview with literal flag", { VERCEL_ENV: "preview", HOMA_PREVIEW_ASTRA_PRIORITY: "1" }, true],
        ["production with flag enabled", { VERCEL_ENV: "production", HOMA_PREVIEW_ASTRA_PRIORITY: "1" }, false],
        ["development with flag enabled", { VERCEL_ENV: "development", HOMA_PREVIEW_ASTRA_PRIORITY: "1" }, false],
      ];
      for (const [name, environment, enabled] of cases) {
        await t.test(name, () => {
          const actual = run(environment);
          assert.deepEqual(actual.search, baseline.search);
          assert.equal(actual.model, baseline.model);
          assert.deepEqual(actual.networkAttempts, []);
          if (!enabled) {
            assert.deepEqual(actual, baseline);
            return;
          }
          assert.deepEqual(actual.config.model.providerOptions, { gateway: { serviceTier: "priority" } });
          assert.deepEqual(actual.providerOptions, { gateway: { serviceTier: "priority", caching: "auto" } });
          delete actual.config.model.providerOptions;
          assert.deepEqual(actual.config, baseline.config);
        });
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
