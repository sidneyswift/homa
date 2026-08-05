import {
  BRAND_CONTRACT,
  CHANNELS_CONTRACT,
  COLOR_CONTRACT,
  CONTENT_CONTRACT,
  DESIGN_CONTRACT_SCHEMA_VERSION,
  DESIGN_CONTRACT_VERSION,
  DOCTRINE_CONTRACT,
  FONT_SYSTEM_CONTRACT,
  ICON_CONTRACT,
  IDENTITY_CONTRACT,
  LAYOUT_CONTRACT,
  MOTION_CONTRACT,
  NATIVE_PROJECTION_CONTRACT,
  PROFILES_CONTRACT,
  STATES_CONTRACT,
  TYPOGRAPHY_CONTRACT,
  assertDesignContract,
} from "../contract/index.ts";

export type DesignArtifact = Readonly<{
  relativePath: string;
  content: string;
}>;

export type DesignArtifactSet = Readonly<{
  version: typeof DESIGN_CONTRACT_VERSION;
  sourceChecksum: string;
  artifacts: readonly DesignArtifact[];
}>;

export const DESIGN_GENERATED_DIRECTORY = "packages/design/generated" as const;

export const DESIGN_CONTRACT_SOURCE = {
  brand: BRAND_CONTRACT,
  channels: CHANNELS_CONTRACT,
  colors: COLOR_CONTRACT,
  content: CONTENT_CONTRACT,
  fonts: FONT_SYSTEM_CONTRACT,
  identity: IDENTITY_CONTRACT,
  icons: ICON_CONTRACT,
  layout: LAYOUT_CONTRACT,
  motion: MOTION_CONTRACT,
  profiles: PROFILES_CONTRACT,
  states: STATES_CONTRACT,
  typography: TYPOGRAPHY_CONTRACT,
  doctrine: DOCTRINE_CONTRACT,
  native: NATIVE_PROJECTION_CONTRACT,
} as const;

export function canonicalizeDesignValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeDesignValue).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalizeDesignValue(child)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export type DesignSourceHasher = (canonicalSource: string) => string;

export function designContractSourceChecksum(hashSource: DesignSourceHasher): string {
  const checksum = hashSource(canonicalizeDesignValue(DESIGN_CONTRACT_SOURCE));
  if (!/^[0-9a-f]{64}$/u.test(checksum)) throw new Error("Design source hasher must return a lowercase SHA-256 digest");
  return checksum;
}

export function expectedGeneratedProjectionPaths(artifacts: readonly DesignArtifact[]): string[] {
  const prefix = `${DESIGN_GENERATED_DIRECTORY}/`;
  return artifacts
    .map(({ relativePath }) => relativePath)
    .filter((relativePath) => relativePath.startsWith(prefix))
    .sort((left, right) => left.localeCompare(right));
}

export function findGeneratedProjectionInventoryViolations(
  actualRelativePaths: readonly string[],
  artifacts: readonly DesignArtifact[],
): string[] {
  const expected = new Set(expectedGeneratedProjectionPaths(artifacts));
  const actual = new Set(actualRelativePaths);
  return [
    ...[...expected].filter((path) => !actual.has(path)).map((path) => `missing:${path}`),
    ...[...actual].filter((path) => !expected.has(path)).map((path) => `unexpected:${path}`),
  ].sort((left, right) => left.localeCompare(right));
}

function cssTokenName(name: string): string {
  return name.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
}

function yamlString(value: string): string {
  return JSON.stringify(value);
}

function channelsWithExpression(expression: string): string {
  return Object.entries(CHANNELS_CONTRACT.channelProfiles)
    .filter(([, profile]) => profile.expression === expression)
    .map(([channel]) => channel)
    .join(", ");
}

function renderDesignFrontMatter(sourceChecksum: string): string {
  const colors = COLOR_CONTRACT.tokens;
  const fontRoles = TYPOGRAPHY_CONTRACT.fontRoles;
  const radii = LAYOUT_CONTRACT.radii;
  const motion = MOTION_CONTRACT;

  return [
    "---",
    `version: ${DESIGN_CONTRACT_VERSION}`,
    `contractChecksum: ${sourceChecksum}`,
    `name: ${yamlString(DOCTRINE_CONTRACT.displayName)}`,
    `description: ${yamlString(DOCTRINE_CONTRACT.description)}`,
    "colors:",
    `  canvas: ${yamlString(colors.canvas)}`,
    `  ink: ${yamlString(colors.ink)}`,
    `  paper: ${yamlString(colors.paper)}`,
    `  floating: ${yamlString(colors.floating)}`,
    `  visual-coral: ${yamlString(colors.visualCoral)}`,
    `  primary-action: ${yamlString(colors.midnightAction)}`,
    `  brand-text: ${yamlString(colors.brandText)}`,
    `  control-boundary: ${yamlString(colors.controlBoundary)}`,
    `  constructive-ink: ${yamlString(colors.constructiveInk)}`,
    `  constructive-tint: ${yamlString(colors.constructiveTint)}`,
    `  info-ink: ${yamlString(colors.infoInk)}`,
    `  info-tint: ${yamlString(colors.infoTint)}`,
    `  highlight-ink: ${yamlString(colors.highlightInk)}`,
    `  highlight-tint: ${yamlString(colors.highlightTint)}`,
    `  error-ink: ${yamlString(colors.errorInk)}`,
    `  error-tint: ${yamlString(colors.errorTint)}`,
    "typography:",
    "  display:",
    `    fontFamily: ${yamlString(fontRoles.display.family)}`,
    `    minimumFontSize: ${fontRoles.display.minimumPx}px`,
    `    role: ${yamlString(fontRoles.display.purpose)}`,
    "  interface:",
    `    fontFamily: ${yamlString(fontRoles.interface.family)}`,
    `    role: ${yamlString(fontRoles.interface.purpose)}`,
    "  wordmark:",
    `    fontFamily: ${yamlString(fontRoles.wordmark.family)}`,
    `    role: ${yamlString(fontRoles.wordmark.purpose)}`,
    "shape:",
    `  control: ${radii.control}px`,
    `  card: ${radii.card}px`,
    `  frame: ${radii.frame}px`,
    `  pill: ${yamlString(LAYOUT_CONTRACT.pillPolicy.usage)}`,
    "motion:",
    `  sequence: ${yamlString(motion.sequence.join(", "))}`,
    `  duration: ${yamlString(`${motion.durations.fast}ms to ${motion.durations.slow}ms per movement, under ${motion.totalMaximum}ms total`)}`,
    `  reducedMotion: ${yamlString(motion.reducedMotionEndpoint)}`,
    "channels:",
    `  expressive: ${yamlString(channelsWithExpression("full-expressive"))}`,
    `  staticRich: ${yamlString(channelsWithExpression("static-rich"))}`,
    `  constrained: ${yamlString(channelsWithExpression("constrained"))}`,
    `  plainText: ${yamlString(channelsWithExpression("plain-text"))}`,
    "appearance:",
    `  light: ${yamlString(CHANNELS_CONTRACT.appearancePolicies.light.tokenSource)}`,
    `  darkAdaptive: ${yamlString(CHANNELS_CONTRACT.appearancePolicies["dark-adaptive"].tokenSource)}`,
    `  forcedColors: ${yamlString(CHANNELS_CONTRACT.appearancePolicies["forced-colors"].tokenSource)}`,
    `  increasedContrast: ${yamlString(CHANNELS_CONTRACT.appearancePolicies["increased-contrast"].tokenSource)}`,
    `  grayscale: ${yamlString(CHANNELS_CONTRACT.appearancePolicies.grayscale.tokenSource)}`,
    "---",
  ].join("\n");
}

function renderDesignDocument(template: string, sourceChecksum: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n(?<body>[\s\S]*)$/u.exec(template);
  if (!match?.groups?.body) throw new Error("DESIGN.md must contain YAML front matter followed by a Markdown body");
  return `${renderDesignFrontMatter(sourceChecksum)}\n\n${match.groups.body.replace(/^\s*/u, "")}`;
}

export function createDesignArtifacts(designTemplate: string, hashSource: DesignSourceHasher): DesignArtifactSet {
  assertDesignContract();
  const sourceChecksum = designContractSourceChecksum(hashSource);
  const header = `Homa design contract ${DESIGN_CONTRACT_VERSION}; source-sha256 ${sourceChecksum}`;
  const generated = new Map<string, string>([
    [
      "packages/design/generated/contract.json",
      `${JSON.stringify({ schemaVersion: DESIGN_CONTRACT_SCHEMA_VERSION, version: DESIGN_CONTRACT_VERSION, sourceChecksum, source: DESIGN_CONTRACT_SOURCE }, null, 2)}\n`,
    ],
    [
      "packages/design/generated/native.json",
      `${JSON.stringify({ version: DESIGN_CONTRACT_VERSION, sourceChecksum, colors: COLOR_CONTRACT.tokens, nativeTonalScale: COLOR_CONTRACT.nativeTonalScale, typography: TYPOGRAPHY_CONTRACT, fonts: FONT_SYSTEM_CONTRACT, layout: LAYOUT_CONTRACT, motion: MOTION_CONTRACT, states: STATES_CONTRACT, profiles: PROFILES_CONTRACT, channels: CHANNELS_CONTRACT, doctrine: DOCTRINE_CONTRACT, projection: NATIVE_PROJECTION_CONTRACT }, null, 2)}\n`,
    ],
    [
      "packages/design/generated/channels.json",
      `${JSON.stringify({ version: DESIGN_CONTRACT_VERSION, sourceChecksum, channels: CHANNELS_CONTRACT, profiles: PROFILES_CONTRACT.targetProfiles, typography: TYPOGRAPHY_CONTRACT, fonts: FONT_SYSTEM_CONTRACT, content: CONTENT_CONTRACT, doctrine: DOCTRINE_CONTRACT }, null, 2)}\n`,
    ],
    [
      "packages/design/generated/fonts.json",
      `${JSON.stringify({ version: DESIGN_CONTRACT_VERSION, sourceChecksum, fonts: FONT_SYSTEM_CONTRACT }, null, 2)}\n`,
    ],
    [
      "packages/design/generated/web.css",
      `/* ${header} */\n:root {\n${Object.entries(COLOR_CONTRACT.tokens).map(([name, value]) => `  --homa-${cssTokenName(name)}: ${value};`).join("\n")}\n${Object.entries(COLOR_CONTRACT.webCompatibilityTokens).map(([name, value]) => `  --homa-${cssTokenName(name)}: ${value};`).join("\n")}\n  --homa-radius-control: ${LAYOUT_CONTRACT.radii.control}px;\n  --homa-radius-card: ${LAYOUT_CONTRACT.radii.card}px;\n  --homa-radius-frame: ${LAYOUT_CONTRACT.radii.frame}px;\n  --homa-motion-ease-out: ${MOTION_CONTRACT.easeOut};\n  --homa-motion-ease-in-out: ${MOTION_CONTRACT.easeInOut};\n  --homa-motion-fast: ${MOTION_CONTRACT.durations.fast}ms;\n  --homa-motion-base: ${MOTION_CONTRACT.durations.base}ms;\n  --homa-motion-slow: ${MOTION_CONTRACT.durations.slow}ms;\n  --homa-font-display: EB Garamond, Georgia, Times New Roman, serif;\n  --homa-font-interface: DM Sans, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;\n  --homa-font-wordmark: Fredoka, Arial Rounded MT Bold, Arial, sans-serif;\n}\n`,
    ],
    ["DESIGN.md", renderDesignDocument(designTemplate, sourceChecksum)],
  ]);

  return {
    version: DESIGN_CONTRACT_VERSION,
    sourceChecksum,
    artifacts: [...generated.entries()].map(([relativePath, content]) => ({ relativePath, content })),
  };
}
