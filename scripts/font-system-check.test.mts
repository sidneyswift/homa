import assert from "node:assert/strict";
import test from "node:test";
import { findLegacyFontResidue } from "./font-system-check.mts";

test("font residue scanner catches a retired family used as a declaration", () => {
  const findings = findLegacyFontResidue(
    "apps/web/app/example.tsx",
    'const display = { fontFamily: "Schibsted Grotesk" };',
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.signature, "legacy-font-schibsted");
});
test("font residue scanner catches retired package guidance", () => {
  const findings = findLegacyFontResidue(
    "apps/mobile/src/theme/fonts.ts",
    'import { HankenGrotesk_400Regular } from "@expo-google-fonts/hanken-grotesk";',
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.signature, "legacy-font-hanken");
});

test("ordinary prose and historical evidence stay outside the font scan", () => {
  assert.deepEqual(
    findLegacyFontResidue("apps/web/components/marketing/Stories.tsx", "Caveat stays in the story copy."),
    [],
  );
  assert.deepEqual(
    findLegacyFontResidue("docs/homa-design/evidence/legacy/warm-playful/readme.md", 'font-family: "Hanken Grotesk";'),
    [],
  );
});
