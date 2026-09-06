/**
 * Verify emitted Next function traces, not just the configured include globs.
 * Chromium reads compressed archives dynamically, so externalizing its JS is
 * insufficient. Every function that traces Chromium must ship the real files.
 */
import { globSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const chromiumPath = `${path.sep}node_modules${path.sep}@sparticuz${path.sep}chromium${path.sep}`;

export function checkChromiumTraces(serverDir) {
  serverDir = realpathSync(serverDir);
  const traceFiles = globSync("**/*.nft.json", { cwd: serverDir }).sort();
  if (traceFiles.length === 0) throw new Error(`No Next traces found in ${serverDir}. Run next build first.`);
  const checked = [];
  for (const traceFile of traceFiles) {
    const traceDir = path.dirname(path.join(serverDir, traceFile));
    const { files } = JSON.parse(readFileSync(path.join(serverDir, traceFile), "utf8"));
    const tracedPaths = new Set(files.map((file) => path.resolve(traceDir, file)));
    const packageDirs = new Set();
    for (const file of tracedPaths) {
      const index = file.indexOf(chromiumPath);
      if (index >= 0) packageDirs.add(file.slice(0, index + chromiumPath.length - 1));
    }
    if (packageDirs.size === 0) continue;
    for (const packageDir of packageDirs) {
      const realPackageDir = realpathSync(packageDir);
      const binDir = path.join(realPackageDir, "bin");
      const archives = readdirSync(binDir).filter((file) => file.endsWith(".br"));
      if (!archives.includes("chromium.br")) throw new Error(`${traceFile}: Chromium has no browser archive.`);
      for (const archive of archives) {
        const archivePath = path.join(binDir, archive);
        if (!tracedPaths.has(archivePath)) {
          throw new Error(`${traceFile}: missing real Chromium archive ${archive}. Add a route-scoped outputFileTracingIncludes entry pointing at the real pnpm package files.`);
        }
      }
      // pnpm's public node_modules links cannot be copied into Vercel functions.
      for (const file of tracedPaths) {
        if (file.startsWith(`${packageDir}${path.sep}bin${path.sep}`) && realpathSync(file) !== file) {
          throw new Error(`${traceFile}: Chromium archive uses a symlinked path: ${file}`);
        }
      }
    }
    checked.push(traceFile);
  }
  if (checked.length === 0) throw new Error("No Chromium function traces found; the renderer packaging check did not run.");
  return checked;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const checked = checkChromiumTraces(path.join(repoRoot, "apps/web/.next/server"));
  console.log(`chromium-tracing-check: real archives present in ${checked.length} Next function traces.`);
  for (const trace of checked) console.log(`  ${trace}`);
}
