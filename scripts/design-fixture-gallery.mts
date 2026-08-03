import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  BRAND_CONTRACT,
  CHANNELS_CONTRACT,
  COLOR_CONTRACT,
  CONTENT_CONTRACT,
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
  FIXTURE_GALLERY_VERSION,
  FIXTURE_GALLERY_SCHEMA_VERSION,
  appearanceModes,
  brandChannels,
  channelProfiles,
  characterStates,
  colorTokens,
  fixtureGalleryAssets,
  fixtureGalleryPatterns,
  fixtureGalleryPrimitives,
  fixtureGalleryProfiles,
  fixtureGallerySignatures,
  fontRoles,
  interactionStates,
  qualityModes,
  radii,
  semanticIcons,
  semanticStateRoles,
  spacing,
  typeRoles,
} from "../packages/design/src/contract/index.ts";
import type { BrandChannel } from "../packages/design/src/contract/channels.ts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = resolve(ROOT, "docs/homa-design/evidence/fixture-gallery.json");
const GENERATED_CONTRACT_PATH = resolve(ROOT, "packages/design/generated/contract.json");
const CHECK = process.argv.includes("--check");

export type FixtureGalleryCategory =
  | "atoms"
  | "assets"
  | "primitives"
  | "patterns"
  | "states"
  | "appearances"
  | "channels"
  | "reductions"
  | "signatures"
  | "profiles";

export interface FixtureRecord {
  id: string;
  category: FixtureGalleryCategory;
  source: string;
  description: string;
  profileIds: readonly string[];
  evidenceStatus: "contract-only";
  checksum: string;
  details: Readonly<Record<string, unknown>>;
}

export interface FixtureGalleryManifest {
  schemaVersion: typeof FIXTURE_GALLERY_SCHEMA_VERSION;
  galleryVersion: typeof FIXTURE_GALLERY_VERSION;
  designEra: "quiet-authority-v1";
  sourceContractChecksum: string;
  generator: "scripts/design-fixture-gallery.mts";
  profileMatrix: typeof fixtureGalleryProfiles;
  categories: Record<FixtureGalleryCategory, readonly FixtureRecord[]>;
  fixtureCount: number;
  manifestChecksum: string;
}

export interface FixtureGalleryIssue {
  code: string;
  fixtureId?: string;
  message: string;
}

export interface FixtureGalleryReport {
  status: "pass" | "fail";
  fixtureCount: number;
  categoryCounts: Record<FixtureGalleryCategory, number>;
  issues: FixtureGalleryIssue[];
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const sha256 = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");
const profileIds = fixtureGalleryProfiles.map((profile) => profile.id);
const requiredProfileIds = profileIds.filter((id) => !id.endsWith("-ruled") && !id.endsWith("-compile-only"));

function designContractSource(): Record<string, unknown> {
  return {
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
  };
}

function sourceContractChecksum(): string {
  return sha256(canonical(designContractSource()));
}

function makeFixture(
  category: FixtureGalleryCategory,
  id: string,
  source: string,
  description: string,
  details: Readonly<Record<string, unknown>> = {},
  profiles: readonly string[] = requiredProfileIds,
): FixtureRecord {
  const payload = {
    category,
    description,
    details,
    evidenceStatus: "contract-only" as const,
    galleryVersion: FIXTURE_GALLERY_VERSION,
    id,
    profileIds: profiles,
    source,
  };
  return { ...payload, checksum: sha256(canonical(payload)) };
}

function buildAtomFixtures(): readonly FixtureRecord[] {
  const atoms: FixtureRecord[] = [];
  for (const [id, value] of Object.entries(colorTokens)) {
    atoms.push(makeFixture("atoms", `atom-color-${id}`, "packages/design/src/contract/colors.ts#colorTokens", `Color token ${id}.`, { token: id, value }));
  }
  for (const [id, role] of Object.entries(fontRoles)) {
    atoms.push(makeFixture("atoms", `atom-font-role-${id}`, "packages/design/src/contract/typography.ts#fontRoles", `Font role ${id}.`, { role: id, family: role.family, purpose: role.purpose }));
  }
  for (const [id, role] of Object.entries(typeRoles)) {
    atoms.push(makeFixture("atoms", `atom-type-role-${id}`, "packages/design/src/contract/typography.ts#typeRoles", `Type role ${id}.`, { role: id, familyRole: role.familyRole }));
  }
  spacing.scale.forEach((value, index) => {
    atoms.push(makeFixture("atoms", `atom-spacing-${index}`, "packages/design/src/contract/layout.ts#spacing.scale", `Spacing scale step ${index}.`, { index, value }));
  });
  for (const [id, value] of Object.entries(radii)) {
    atoms.push(makeFixture("atoms", `atom-radius-${id}`, "packages/design/src/contract/layout.ts#radii", `Radius token ${id}.`, { token: id, value }));
  }
  for (const id of semanticIcons) {
    atoms.push(makeFixture("atoms", `atom-icon-${id}`, "packages/design/src/contract/icons.ts#semanticIcons", `Semantic icon role ${id}.`, { role: id }));
  }
  for (const id of Object.keys(semanticStateRoles)) {
    atoms.push(makeFixture("atoms", `atom-state-role-${id}`, "packages/design/src/contract/states.ts#semanticStateRoles", `Semantic state role ${id}.`, { role: id }));
  }
  for (const [id, value] of Object.entries(MOTION_CONTRACT.durations)) {
    atoms.push(makeFixture("atoms", `atom-motion-duration-${id}`, "packages/design/src/contract/motion.ts#durations", `Motion duration ${id}.`, { token: id, value }));
  }
  for (const id of Object.keys(IDENTITY_CONTRACT.safeAreas)) {
    atoms.push(makeFixture("atoms", `atom-safe-area-${id}`, "packages/design/src/contract/identity.ts#identitySafeAreas", `Identity safe area ${id}.`, { safeArea: id }));
  }
  for (const id of Object.keys(CONTENT_CONTRACT)) {
    atoms.push(makeFixture("atoms", `atom-content-rule-${id}`, "packages/design/src/contract/content.ts#contentRules", `Content rule ${id}.`, { rule: id }));
  }
  return atoms;
}

function buildStateFixtures(): readonly FixtureRecord[] {
  return [
    ...interactionStates.map((id) => makeFixture("states", `state-interaction-${id}`, "packages/design/src/contract/states.ts#interactionStates", `Interaction state ${id}.`, { state: id })),
    ...qualityModes.map((id) => makeFixture("states", `state-quality-${id}`, "packages/design/src/contract/states.ts#qualityModes", `Quality mode ${id}.`, { mode: id })),
    ...characterStates.map((id) => makeFixture("states", `state-character-${id}`, "packages/design/src/contract/brand.ts#characterStates", `Character state ${id}.`, { state: id })),
  ];
}

function buildAppearanceFixtures(): readonly FixtureRecord[] {
  return appearanceModes.map((id) => makeFixture("appearances", `appearance-${id}`, "packages/design/src/contract/channels.ts#appearanceModes", `Appearance mode ${id}.`, { mode: id }));
}

function buildChannelFixtures(): readonly FixtureRecord[] {
  return brandChannels.map((id) => makeFixture("channels", `channel-${id}`, "packages/design/src/contract/channels.ts#brandChannels", `Brand channel ${id}.`, { channel: id }));
}

function buildReductionFixtures(): readonly FixtureRecord[] {
  return brandChannels.map((id) => {
    const profile = channelProfiles[id];
    return makeFixture(
      "reductions",
      `reduction-${id}`,
      `packages/design/src/contract/channels.ts#channelProfiles.${id}`,
      `Channel reduction for ${id}.`,
      { channel: id, expression: profile.expression, motion: profile.motion, preservedElements: profile.preservedElements, allowedAppearance: profile.allowedAppearance },
    );
  });
}

function buildProfileFixtures(): readonly FixtureRecord[] {
  return fixtureGalleryProfiles.map((profile) => makeFixture(
    "profiles",
    `profile-${profile.id}`,
    "packages/design/src/contract/fixtures.ts#fixtureGalleryProfiles",
    profile.reason,
    { channel: profile.channel, targetProfile: profile.targetProfile, proof: profile.proof, appearance: profile.appearance, qualityModes: profile.qualityModes, viewport: profile.viewport ?? null, device: profile.device ?? null, constraints: profile.constraints },
    [profile.id],
  ));
}

function buildStaticFixtures(category: "assets" | "primitives" | "patterns" | "signatures", sources: readonly { id: string; source: string; description: string }[]): readonly FixtureRecord[] {
  return sources.map((item) => makeFixture(category, item.id, item.source, item.description));
}

export function buildFixtureGalleryManifest(): FixtureGalleryManifest {
  const categories: Record<FixtureGalleryCategory, readonly FixtureRecord[]> = {
    atoms: buildAtomFixtures(),
    assets: buildStaticFixtures("assets", fixtureGalleryAssets),
    primitives: buildStaticFixtures("primitives", fixtureGalleryPrimitives),
    patterns: buildStaticFixtures("patterns", fixtureGalleryPatterns),
    states: buildStateFixtures(),
    appearances: buildAppearanceFixtures(),
    channels: buildChannelFixtures(),
    reductions: buildReductionFixtures(),
    signatures: buildStaticFixtures("signatures", fixtureGallerySignatures),
    profiles: buildProfileFixtures(),
  };
  const withoutChecksum = {
    schemaVersion: FIXTURE_GALLERY_SCHEMA_VERSION,
    galleryVersion: FIXTURE_GALLERY_VERSION,
    designEra: "quiet-authority-v1" as const,
    sourceContractChecksum: sourceContractChecksum(),
    generator: "scripts/design-fixture-gallery.mts" as const,
    profileMatrix: fixtureGalleryProfiles,
    categories,
    fixtureCount: Object.values(categories).reduce((sum, entries) => sum + entries.length, 0),
  };
  return { ...withoutChecksum, manifestChecksum: sha256(canonical(withoutChecksum)) };
}

function expectedContractProjectionChecksum(): string | null {
  if (!existsSync(GENERATED_CONTRACT_PATH)) return null;
  const generated = JSON.parse(readFileSync(GENERATED_CONTRACT_PATH, "utf8")) as { sourceChecksum?: unknown };
  return typeof generated.sourceChecksum === "string" ? generated.sourceChecksum : null;
}

function addIssue(issues: FixtureGalleryIssue[], code: string, message: string, fixtureId?: string): void {
  issues.push(fixtureId ? { code, fixtureId, message } : { code, message });
}

export function validateFixtureGallery(manifest: FixtureGalleryManifest): FixtureGalleryReport {
  const issues: FixtureGalleryIssue[] = [];
  const categories = ["atoms", "assets", "primitives", "patterns", "states", "appearances", "channels", "reductions", "signatures", "profiles"] as const;
  const categoryCounts = Object.fromEntries(categories.map((category) => [category, manifest.categories?.[category]?.length ?? 0])) as Record<FixtureGalleryCategory, number>;
  if (manifest.schemaVersion !== FIXTURE_GALLERY_SCHEMA_VERSION) addIssue(issues, "schema-version", `Expected schema ${FIXTURE_GALLERY_SCHEMA_VERSION}.`);
  if (manifest.galleryVersion !== FIXTURE_GALLERY_VERSION) addIssue(issues, "gallery-version", `Expected gallery ${FIXTURE_GALLERY_VERSION}.`);
  if (manifest.designEra !== "quiet-authority-v1") addIssue(issues, "design-era", "Fixture gallery must target Quiet authority.");
  const sourceChecksum = sourceContractChecksum();
  if (manifest.sourceContractChecksum !== sourceChecksum) addIssue(issues, "source-checksum", "Fixture gallery source checksum does not match the typed design contract.");
  const generatedChecksum = expectedContractProjectionChecksum();
  if (generatedChecksum !== null && generatedChecksum !== sourceChecksum) addIssue(issues, "stale-projection", "Generated design contract projection is stale relative to the fixture gallery source.");
  const seenIds = new Set<string>();
  const expectedCategories: Record<FixtureGalleryCategory, readonly FixtureRecord[]> = {
    atoms: buildAtomFixtures(),
    assets: buildStaticFixtures("assets", fixtureGalleryAssets),
    primitives: buildStaticFixtures("primitives", fixtureGalleryPrimitives),
    patterns: buildStaticFixtures("patterns", fixtureGalleryPatterns),
    states: buildStateFixtures(),
    appearances: buildAppearanceFixtures(),
    channels: buildChannelFixtures(),
    reductions: buildReductionFixtures(),
    signatures: buildStaticFixtures("signatures", fixtureGallerySignatures),
    profiles: buildProfileFixtures(),
  };
  for (const category of categories) {
    const records = manifest.categories?.[category] ?? [];
    if (records.length === 0) addIssue(issues, "empty-category", `Fixture category ${category} is empty.`);
    const actualIds = new Set(records.map((fixture) => fixture.id));
    for (const expectedFixture of expectedCategories[category]) {
      if (!actualIds.has(expectedFixture.id)) addIssue(issues, "missing-fixture", `Fixture ${expectedFixture.id} is missing from ${category}.`, expectedFixture.id);
    }
    for (const actualId of actualIds) {
      if (!expectedCategories[category].some((fixture) => fixture.id === actualId)) addIssue(issues, "unexpected-fixture", `Fixture ${actualId} is not declared by the typed gallery contract.`, actualId);
    }
    for (const fixture of records) {
      if (seenIds.has(fixture.id)) addIssue(issues, "duplicate-id", "Fixture IDs must be unique across categories.", fixture.id);
      seenIds.add(fixture.id);
      if (fixture.category !== category) addIssue(issues, "category-mismatch", `Fixture is stored under ${category} but declares ${fixture.category}.`, fixture.id);
      if (fixture.evidenceStatus !== "contract-only") addIssue(issues, "false-proof-status", "The fixture contract cannot claim rendered or device evidence.", fixture.id);
      if (!fixture.source || !fixture.description || fixture.profileIds.length === 0) addIssue(issues, "missing-fixture-metadata", "Every fixture needs source, description, and profile obligations.", fixture.id);
      const { checksum, ...payload } = fixture;
      if (checksum !== sha256(canonical(payload))) addIssue(issues, "fixture-checksum", "Fixture checksum is stale.", fixture.id);
      for (const profileId of fixture.profileIds) {
        if (!profileIds.includes(profileId)) addIssue(issues, "unknown-profile", `Fixture references unknown profile ${profileId}.`, fixture.id);
      }
    }
  }
  const profileIdsInManifest = manifest.profileMatrix.map((profile) => profile.id);
  if (new Set(profileIdsInManifest).size !== profileIdsInManifest.length) addIssue(issues, "duplicate-profile-id", "Profile IDs must be unique.");
  for (const profile of fixtureGalleryProfiles) {
    if (!profileIdsInManifest.includes(profile.id)) addIssue(issues, "missing-profile", `Profile ${profile.id} is missing from the manifest.`);
  }
  if (manifest.categories.profiles.length !== fixtureGalleryProfiles.length) addIssue(issues, "profile-fixture-count", "Every profile matrix row needs one stable profile fixture.");
  const requiredChannels = new Set<BrandChannel>(brandChannels);
  const coveredChannels = new Set(manifest.categories.channels.map((fixture) => String(fixture.details.channel)));
  for (const channel of requiredChannels) if (!coveredChannels.has(channel)) addIssue(issues, "missing-channel", `Channel ${channel} has no fixture.`);
  const requiredProfileFixtures = ["web-phone-small", "web-phone", "web-desktop", "web-reflow-200", "web-reflow-400", "web-large-text", "web-localization-expanded", "web-forced-colors", "web-increased-contrast", "web-reduced-motion", "web-dark-adaptive", "native-iphone-oldest", "native-iphone-current", "native-large-text", "native-localization-expanded", "native-increased-contrast", "native-reduced-motion", "native-dark-adaptive", "native-ipad-portrait-ruled", "native-ipad-landscape-ruled", "native-android-compile-only", "print-letter", "print-a4", "email-600-light", "email-320-narrow", "email-client-controlled", "sms-plain-text"];
  const profileFixtures = new Set(manifest.categories.profiles.map((fixture) => String(fixture.details.id ?? fixture.id.replace(/^profile-/, ""))));
  for (const required of requiredProfileFixtures) if (!profileFixtures.has(required)) addIssue(issues, "missing-required-profile", `Required rendering profile ${required} is missing.`);
  const withoutChecksum = { ...manifest } as Record<string, unknown>;
  delete withoutChecksum.manifestChecksum;
  if (manifest.manifestChecksum !== sha256(canonical(withoutChecksum))) addIssue(issues, "manifest-checksum", "Gallery manifest checksum is stale.");
  return {
    status: issues.length === 0 ? "pass" : "fail",
    fixtureCount: manifest.fixtureCount,
    categoryCounts,
    issues,
  };
}

export function assertFixtureGallery(manifest: FixtureGalleryManifest): FixtureGalleryReport {
  const report = validateFixtureGallery(manifest);
  if (report.issues.length > 0) {
    for (const issue of report.issues) console.error(`[${issue.code}]${issue.fixtureId ? ` ${issue.fixtureId}` : ""} ${issue.message}`);
    throw new Error(`Design fixture gallery gate failed with ${report.issues.length} finding(s).`);
  }
  return report;
}

const expected = buildFixtureGalleryManifest();
if (CHECK) {
  if (!existsSync(OUTPUT_PATH)) throw new Error(`Fixture gallery is missing: ${OUTPUT_PATH}`);
  const existing = JSON.parse(readFileSync(OUTPUT_PATH, "utf8")) as FixtureGalleryManifest;
  assertFixtureGallery(existing);
  if (readFileSync(OUTPUT_PATH, "utf8") !== `${JSON.stringify(expected, null, 2)}\n`) {
    throw new Error(`Generated fixture gallery is stale: ${OUTPUT_PATH}`);
  }
} else {
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(expected, null, 2)}\n`);
  assertFixtureGallery(expected);
}
console.log(`${CHECK ? "Checked" : "Wrote"} ${expected.fixtureCount} deterministic design fixtures (${expected.manifestChecksum})`);
