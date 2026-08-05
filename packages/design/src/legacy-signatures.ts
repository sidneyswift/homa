export const LEGACY_FONT_PATH_SIGNATURE = "legacy-font-path" as const;

export const legacySignatureNames = [
  "legacy-font-schibsted",
  "legacy-font-hanken",
  "legacy-font-caveat",
  "legacy-warm-playful-doctrine",
  "legacy-design-doc-path",
  "legacy-color-canvas",
  "legacy-color-ink",
  "legacy-color-ink-soft",
  "legacy-color-muted",
  "legacy-color-muted-warm",
  "legacy-coral-action",
  "legacy-color-coral-dark",
  "legacy-color-coral-deep",
  "legacy-color-coral-bright",
  "legacy-color-border",
  "legacy-color-border-dark",
  "legacy-color-clay-muted",
  "legacy-shape-language",
  "legacy-token-namespace",
  "legacy-rounded-pill",
  "legacy-shadow-radius-namespace",
] as const;

export type LegacySignatureName = (typeof legacySignatureNames)[number];

export interface LegacySignatureMatch {
  signature: LegacySignatureName;
  index: number;
  value: string;
}

interface LegacySignatureRule {
  name: LegacySignatureName;
  patterns: readonly RegExp[];
  applies?: (path: string, text: string, index: number) => boolean;
}

const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".mts",
  ".svg",
  ".ts",
  ".tsx",
  ".txt",
  ".vcf",
  ".xml",
  ".yml",
  ".yaml",
]);

/**
 * Exact sources that must name retired vocabulary in order to reject it.
 * Test and spec files are handled separately so new detector fixtures remain
 * sentinels without growing this list.
 */
const detectorSentinelPaths = new Set([
  "packages/design/src/contract/contract.test.ts",
  "packages/design/src/legacy-signatures.ts",
  "scripts/brand-residue-check.mts",
  "scripts/brand-surfaces.mts",
  "scripts/design-authoring-rails-check.mts",
  "scripts/font-system-check.mts",
  "scripts/marketing-production-check.mts",
]);

const rules: readonly LegacySignatureRule[] = [
  { name: "legacy-font-schibsted", patterns: [/\bSchibsted(?:\s+Grotesk)?\b/giu] },
  { name: "legacy-font-hanken", patterns: [/\bHanken(?:\s+Grotesk)?\b/giu] },
  {
    name: "legacy-font-caveat",
    patterns: [
      /family=Caveat\b/giu,
      /font-family\s*:\s*[^;\n]*\bCaveat\b/giu,
      /--(?:font|f|hand)[a-z0-9_-]*\s*:\s*[^;\n]*\bCaveat\b/giu,
      /@(?:expo-google-fonts|fontsource)\/caveat\b/giu,
      /\bCaveat\b[^\n]{0,48}\b(?:caption|font|handwriting|margin[ -]note|script|typeface)\b/giu,
      /\b(?:caption|font|handwriting|margin[ -]note|script|typeface)\b[^\n]{0,48}\bCaveat\b/giu,
    ],
  },
  { name: "legacy-warm-playful-doctrine", patterns: [/warm[\s-]+(?:and|&)[\s-]+playful/giu] },
  {
    name: "legacy-design-doc-path",
    patterns: [/docs\/homa-design\/(?:components|guidelines|templates|tokens|ui_kits|styles\.css)/giu],
  },
  { name: "legacy-color-canvas", patterns: [/#FBF7F0\b/giu] },
  { name: "legacy-color-ink", patterns: [/#221E1A\b/giu] },
  { name: "legacy-color-ink-soft", patterns: [/#332E29\b/giu] },
  { name: "legacy-color-muted", patterns: [/#6B6259\b/giu] },
  { name: "legacy-color-muted-warm", patterns: [/#8A7D6C\b/giu] },
  { name: "legacy-coral-action", patterns: [/#F05A31\b/giu] },
  { name: "legacy-color-coral-dark", patterns: [/#C44C22\b/giu] },
  { name: "legacy-color-coral-deep", patterns: [/#9C3B1B\b/giu] },
  { name: "legacy-color-coral-bright", patterns: [/#F1793F\b/giu] },
  { name: "legacy-color-border", patterns: [/#E7DDCE\b/giu] },
  { name: "legacy-color-border-dark", patterns: [/#D6C8B4\b/giu] },
  { name: "legacy-color-clay-muted", patterns: [/#B3A492\b/giu] },
  {
    name: "legacy-shape-language",
    patterns: [
      /\b(?:doodle|squiggle|wavy[\s-]+band)\b/giu,
      /\b(?:background|brand|decorative|hero|organic|playful|visual)[\s-]+blobs?\b/giu,
      /\bblobs?[\s-]+(?:decoration|geometry|illustration|motif|shape)\b/giu,
      /(?:className|class|id)\s*=\s*["'][^"']*\bblob(?:[a-z0-9_-]*)\b/giu,
      /\.[a-z0-9_-]*blob[a-z0-9_-]*\s*\{/giu,
    ],
    applies: (path, text, index) => {
      if (!path.startsWith("docs/homa-curriculum-atlas/curricula/")) return true;
      const context = text.slice(Math.max(0, index - 120), index + 160).toLowerCase();
      return !/(?:read-aloud|child|kids?|mold clay|drawing|craft|activity|art|writing)/.test(context);
    },
  },
  {
    name: "legacy-token-namespace",
    patterns: [
      /var\(\s*--(?:clay|sage|gold|sky|stone|pill)(?:[-_][a-z0-9-]+)?\s*(?=[,)])/giu,
      /(?:^|[;{]\s*)--(?:clay|sage|gold|sky|stone|pill)(?:[-_][a-z0-9-]+)?\s*:/gimu,
      /\b(?:accent|bg|border|caret|divide|fill|from|outline|ring|shadow|stroke|text|to|via)-(?:clay|sage|gold|sky|stone)(?:[-/][a-z0-9.[\]-]+)?\b/giu,
    ],
  },
  { name: "legacy-rounded-pill", patterns: [/\brounded-pill\b/giu] },
  {
    name: "legacy-shadow-radius-namespace",
    patterns: [
      /var\(\s*--(?:radius|shadow)(?:[-_][a-z0-9-]+)?\s*(?=[,)])/giu,
      /(?:^|[;{]\s*)--(?:radius|shadow)(?:[-_][a-z0-9-]+)?\s*:/gimu,
    ],
  },
];

const stableCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

export function isLegacyTextPath(path: string): boolean {
  const lastDot = path.lastIndexOf(".");
  return lastDot >= 0 && textExtensions.has(path.slice(lastDot).toLowerCase());
}

export function isLegacySignalSentinelPath(path: string): boolean {
  return /\.(?:test|spec)\.(?:js|mjs|mts|ts|tsx)$/.test(path)
    || detectorSentinelPaths.has(path);
}

export function isLegacyResidueExcludedPath(path: string): boolean {
  return path.startsWith(".cosmo/curriculums/")
    || path.startsWith(".cosmo/references/")
    || path === ".cosmo/inspo-catalog.md"
    || path.startsWith("docs/homa-design/evidence/")
    || path.startsWith("docs/homa-planning/history/")
    || path.startsWith("docs/notes/")
    || isLegacySignalSentinelPath(path);
}

export function isLegacyOnlyHistoricalDocumentPath(path: string): boolean {
  return path.startsWith("docs/")
    && isLegacyTextPath(path)
    && !isLegacyResidueExcludedPath(path);
}

export function collectLegacySignatureMatches(path: string, text: string): LegacySignatureMatch[] {
  if (!isLegacyTextPath(path) || isLegacyResidueExcludedPath(path)) return [];
  const matches: LegacySignatureMatch[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        if (rule.applies && !rule.applies(path, text, match.index)) {
          if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
          continue;
        }
        const key = `${rule.name}:${match.index}:${match[0]}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({ signature: rule.name, index: match.index, value: match[0] });
        }
        if (pattern.lastIndex === match.index) pattern.lastIndex += 1;
      }
    }
  }
  return matches.sort((left, right) => left.index - right.index
    || stableCompare(left.signature, right.signature)
    || stableCompare(left.value, right.value));
}

export function collectLegacySignatures(path: string, text: string): LegacySignatureName[] {
  return [...new Set(collectLegacySignatureMatches(path, text).map((match) => match.signature))]
    .sort(stableCompare) as LegacySignatureName[];
}

export function isLegacyFontPath(path: string): boolean {
  if (isLegacyResidueExcludedPath(path)) return false;
  return /(?:^|[/_.-])(?:schibsted|hanken)(?:[/_.-]|$)/iu.test(path)
    || /(?:^|[/_.-])caveat(?:[/_.-]|$)/iu.test(path);
}
