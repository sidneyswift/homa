import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAND_CONTRACT,
  COLOR_CONTRACT,
  CONTENT_CONTRACT,
  DESIGN_CONTRACT_SCHEMA_VERSION,
  DESIGN_CONTRACT_VERSION,
  ICON_CONTRACT,
  FONT_SYSTEM_CONTRACT,
  IDENTITY_CONTRACT,
  LAYOUT_CONTRACT,
  MOTION_CONTRACT,
  PROFILES_CONTRACT,
  STATES_CONTRACT,
  TYPOGRAPHY_CONTRACT,
} from "../packages/design/src/contract/index.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = resolve(ROOT, "packages/design/generated");
const DESIGN_PATH = resolve(ROOT, "DESIGN.md");
const CHECK = process.argv.includes("--check");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const source = {
  brand: BRAND_CONTRACT,
  identity: IDENTITY_CONTRACT,
  colors: COLOR_CONTRACT,
  content: CONTENT_CONTRACT,
  icons: ICON_CONTRACT,
  fonts: FONT_SYSTEM_CONTRACT,
  layout: LAYOUT_CONTRACT,
  motion: MOTION_CONTRACT,
  profiles: PROFILES_CONTRACT,
  states: STATES_CONTRACT,
  typography: TYPOGRAPHY_CONTRACT,
};
const sourceChecksum = createHash("sha256").update(canonical(source)).digest("hex");
const header = `Homa design contract ${DESIGN_CONTRACT_VERSION}; source-sha256 ${sourceChecksum}`;
const outputs: Record<string, string> = {
  "contract.json": `${JSON.stringify({ schemaVersion: DESIGN_CONTRACT_SCHEMA_VERSION, version: DESIGN_CONTRACT_VERSION, sourceChecksum, source }, null, 2)}\n`,
  "native.json": `${JSON.stringify({ version: DESIGN_CONTRACT_VERSION, sourceChecksum, colors: COLOR_CONTRACT.tokens, typography: TYPOGRAPHY_CONTRACT, fonts: FONT_SYSTEM_CONTRACT, layout: LAYOUT_CONTRACT, motion: MOTION_CONTRACT, states: STATES_CONTRACT, profiles: PROFILES_CONTRACT }, null, 2)}\n`,
  "channels.json": `${JSON.stringify({ version: DESIGN_CONTRACT_VERSION, sourceChecksum, profiles: PROFILES_CONTRACT.targetProfiles, typography: TYPOGRAPHY_CONTRACT, fonts: FONT_SYSTEM_CONTRACT, content: CONTENT_CONTRACT }, null, 2)}\n`,
  "fonts.json": `${JSON.stringify(FONT_SYSTEM_CONTRACT, null, 2)}\n`,
  "web.css": `/* ${header} */\n:root {\n${Object.entries(COLOR_CONTRACT.tokens).map(([name, value]) => `  --homa-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}: ${value};`).join("\n")}\n  --homa-radius-control: ${LAYOUT_CONTRACT.radii.control}px;\n  --homa-radius-card: ${LAYOUT_CONTRACT.radii.card}px;\n  --homa-radius-frame: ${LAYOUT_CONTRACT.radii.frame}px;\n  --homa-font-display: EB Garamond, Georgia, Times New Roman, serif;\n  --homa-font-interface: DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;\n  --homa-font-wordmark: Fredoka, Arial Rounded MT Bold, Arial, sans-serif;\n  --homa-motion-ease-out: ${MOTION_CONTRACT.easeOut};\n  --homa-motion-ease-in-out: ${MOTION_CONTRACT.easeInOut};\n  --homa-motion-fast: ${MOTION_CONTRACT.durations.fast}ms;\n  --homa-motion-base: ${MOTION_CONTRACT.durations.base}ms;\n  --homa-motion-slow: ${MOTION_CONTRACT.durations.slow}ms;\n}\n`,
};
const designDocument = readFileSync(DESIGN_PATH, "utf8");
const checksumLine = `contractChecksum: ${sourceChecksum}`;
const designWithChecksum = /^contractChecksum:\s*.*$/m.test(designDocument)
  ? designDocument.replace(/^contractChecksum:\s*.*$/m, checksumLine)
  : designDocument.replace(/^version:\s*.*$/m, (line) => `${line}\n${checksumLine}`);

if (!CHECK) mkdirSync(OUT_DIR, { recursive: true });
for (const [name, content] of Object.entries(outputs)) {
  const output = resolve(OUT_DIR, name);
  if (CHECK) {
    if (!existsSync(output) || readFileSync(output, "utf8") !== content) throw new Error(`Generated design projection is stale: ${output}`);
  } else {
    writeFileSync(output, content);
  }
}
if (CHECK) {
  if (designDocument !== designWithChecksum) throw new Error(`DESIGN.md contract checksum is stale. Expected ${sourceChecksum}`);
} else {
  writeFileSync(DESIGN_PATH, designWithChecksum);
}
console.log(`${CHECK ? "Checked" : "Wrote"} ${Object.keys(outputs).length} design projections at ${OUT_DIR} (${sourceChecksum})`);
