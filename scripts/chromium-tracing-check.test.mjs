import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkChromiumTraces } from "./chromium-tracing-check.mjs";

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), "homa-chromium-traces-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const serverDir = path.join(root, ".next/server");
  const packageDir = path.join(root, "node_modules/.pnpm/chromium-fixture/node_modules/@sparticuz/chromium");
  const archives = ["chromium.br", "fonts.tar.br", "swiftshader.tar.br", "al2023.tar.br"];
  mkdirSync(serverDir, { recursive: true });
  mkdirSync(path.join(packageDir, "bin"), { recursive: true });
  writeFileSync(path.join(packageDir, "package.json"), "{}");
  for (const archive of archives) writeFileSync(path.join(packageDir, "bin", archive), "fixture");
  function trace(route, included = archives, archiveDir = packageDir) {
    const tracePath = path.join(serverDir, route);
    mkdirSync(path.dirname(tracePath), { recursive: true });
    const files = [path.join(packageDir, "package.json"), ...included.map((file) => path.join(archiveDir, "bin", file))];
    writeFileSync(tracePath, JSON.stringify({ version: 1, files: files.map((file) => path.relative(path.dirname(tracePath), file)) }));
  }
  return { root, serverDir, packageDir, archives, trace };
}

test("checks every emitted Chromium route, including a new server action entrypoint", (t) => {
  const f = fixture(t);
  f.trace("app/app/binder/page.js.nft.json");
  f.trace("app/api/compliance/pack/route.js.nft.json");
  assert.equal(checkChromiumTraces(f.serverDir).length, 2);
  f.trace("app/new-route/page.js.nft.json", []);
  assert.throws(() => checkChromiumTraces(f.serverDir), /new-route.*missing real Chromium archive/);
});

test("rejects a partially packaged function even when the browser archive is present", (t) => {
  const f = fixture(t);
  f.trace("app/app/binder/page.js.nft.json", f.archives.filter((file) => file !== "fonts.tar.br"));
  assert.throws(() => checkChromiumTraces(f.serverDir), /missing real Chromium archive fonts.tar.br/);
});

test("rejects pnpm symlink archive includes instead of accepting files present locally", (t) => {
  const f = fixture(t);
  const linkedPackage = path.join(f.root, "node_modules/@sparticuz/chromium");
  mkdirSync(path.dirname(linkedPackage), { recursive: true });
  symlinkSync(f.packageDir, linkedPackage, "dir");
  f.trace("app/app/binder/page.js.nft.json", f.archives, linkedPackage);
  assert.throws(() => checkChromiumTraces(f.serverDir), /missing real Chromium archive/);
});

test("fails closed when a build emitted no traces or no Chromium dependency", (t) => {
  const f = fixture(t);
  assert.throws(() => checkChromiumTraces(f.serverDir), /No Next traces found/);
  writeFileSync(path.join(f.serverDir, "page.js.nft.json"), JSON.stringify({ version: 1, files: [] }));
  assert.throws(() => checkChromiumTraces(f.serverDir), /No Chromium function traces found/);
});
