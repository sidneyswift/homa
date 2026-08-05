import { DESIGN_CONTRACT_VERSION } from "./contract/version.ts";
import type { BrandChannel } from "./contract/channels.ts";
import { identityAssetCatalog } from "./contract/identity.ts";
import type { TargetProfile } from "./contract/profiles.ts";

/**
 * The fixture gallery is a contract index, not a screenshot archive. Each
 * projection is rendered later by its channel gauntlet from these stable
 * IDs, source references, and profile obligations.
 */
export const FIXTURE_GALLERY_SCHEMA_VERSION = 1 as const;
export const FIXTURE_GALLERY_VERSION = "fixture-gallery-v1" as const;

export type FixtureGalleryProofStatus = "required" | "ruled-out" | "compile-only";

export interface FixtureGalleryProfile {
  id: string;
  channel: BrandChannel;
  targetProfile: TargetProfile;
  proof: FixtureGalleryProofStatus;
  viewport?: { width: number; height: number; zoom?: number };
  device?: string;
  appearance: string;
  qualityModes: readonly string[];
  constraints: readonly string[];
  reason: string;
}

/**
 * Every rendering obligation is named here, including the profiles that are
 * intentionally ruled out. A ruled-out profile is still visible in the
 * gallery so a platform cannot invent support by omission.
 */
export const fixtureGalleryProfiles: readonly FixtureGalleryProfile[] = [
  { id: "web-phone-small", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 320, height: 800 }, appearance: "light", qualityModes: [], constraints: ["phone-gutter"], reason: "Smallest supported web width." },
  { id: "web-phone", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 390, height: 844 }, appearance: "light", qualityModes: [], constraints: ["phone-gutter"], reason: "Primary phone web width." },
  { id: "web-desktop", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 1440, height: 1000 }, appearance: "light", qualityModes: [], constraints: ["desktop-gutter", "workspace-container"], reason: "Primary desktop web width." },
  { id: "web-reflow-200", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 640, height: 900, zoom: 2 }, appearance: "light", qualityModes: ["200%-zoom"], constraints: ["effective-reflow"], reason: "Effective 200 percent zoom reflow." },
  { id: "web-reflow-400", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 320, height: 900, zoom: 4 }, appearance: "light", qualityModes: ["400%-reflow"], constraints: ["effective-reflow"], reason: "Effective 400 percent reflow." },
  { id: "web-large-text", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 390, height: 844 }, appearance: "light", qualityModes: ["large-text"], constraints: ["text-expansion"], reason: "Large text must preserve hierarchy and action reachability." },
  { id: "web-localization-expanded", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 390, height: 844 }, appearance: "light", qualityModes: ["localization-expanded"], constraints: ["long-copy", "text-expansion"], reason: "Expanded copy must not clip or hide the next move." },
  { id: "web-forced-colors", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 390, height: 844 }, appearance: "forced-colors", qualityModes: ["forced-colors"], constraints: ["system-colors"], reason: "System colors preserve roles and boundaries." },
  { id: "web-increased-contrast", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 390, height: 844 }, appearance: "increased-contrast", qualityModes: ["increased-contrast"], constraints: ["contrast-floor"], reason: "Selection, focus, status, and action boundaries remain visible." },
  { id: "web-reduced-motion", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 390, height: 844 }, appearance: "light", qualityModes: ["reduced-motion"], constraints: ["final-still-immediately"], reason: "Meaning survives without nonessential movement." },
  { id: "web-dark-adaptive", channel: "web", targetProfile: "webProduct", proof: "required", viewport: { width: 390, height: 844 }, appearance: "dark-adaptive", qualityModes: ["dark-or-adaptive"], constraints: ["adaptive-tokens", "contrast-floor"], reason: "Adaptive appearance is a tested projection, not an invented palette." },
  { id: "native-iphone-oldest", channel: "native", targetProfile: "nativeProduct", proof: "required", device: "oldest-supported-iphone", appearance: "light", qualityModes: [], constraints: ["safe-area", "portrait"], reason: "Minimum supported native iPhone posture." },
  { id: "native-iphone-current", channel: "native", targetProfile: "nativeProduct", proof: "required", device: "current-iphone", appearance: "light", qualityModes: [], constraints: ["safe-area", "portrait"], reason: "Primary installed native posture." },
  { id: "native-large-text", channel: "native", targetProfile: "nativeProduct", proof: "required", device: "current-iphone", appearance: "light", qualityModes: ["large-text"], constraints: ["dynamic-type", "safe-area"], reason: "Dynamic Type keeps labels and the next move reachable." },
  { id: "native-localization-expanded", channel: "native", targetProfile: "nativeProduct", proof: "required", device: "current-iphone", appearance: "light", qualityModes: ["localization-expanded"], constraints: ["long-copy", "dynamic-type"], reason: "Expanded native copy reflows without clipped controls." },
  { id: "native-increased-contrast", channel: "native", targetProfile: "nativeProduct", proof: "required", device: "current-iphone", appearance: "increased-contrast", qualityModes: ["increased-contrast"], constraints: ["contrast-floor", "control-boundary"], reason: "Native action and state boundaries remain legible." },
  { id: "native-reduced-motion", channel: "native", targetProfile: "nativeProduct", proof: "required", device: "current-iphone", appearance: "light", qualityModes: ["reduced-motion"], constraints: ["final-still-immediately"], reason: "Native motion resolves to a truthful still state." },
  { id: "native-dark-adaptive", channel: "native", targetProfile: "nativeProduct", proof: "required", device: "current-iphone", appearance: "dark-adaptive", qualityModes: ["dark-or-adaptive"], constraints: ["adaptive-tokens", "safe-area"], reason: "Native appearance follows the platform without palette drift." },
  { id: "native-ipad-portrait-ruled", channel: "native", targetProfile: "nativeProduct", proof: "ruled-out", device: "ipad-portrait", appearance: "light", qualityModes: [], constraints: ["no-tablet-support"], reason: "Tablet support is explicitly ruled out by the current native release contract." },
  { id: "native-ipad-landscape-ruled", channel: "native", targetProfile: "nativeProduct", proof: "ruled-out", device: "ipad-landscape", appearance: "light", qualityModes: [], constraints: ["no-tablet-support"], reason: "Landscape tablet support cannot appear silently." },
  { id: "native-android-compile-only", channel: "native", targetProfile: "nativeProduct", proof: "compile-only", device: "android", appearance: "light", qualityModes: [], constraints: ["no-production-distribution"], reason: "Android remains compile guarded until its release ruling changes." },
  { id: "marketing-desktop", channel: "marketing", targetProfile: "marketingRich", proof: "required", viewport: { width: 1440, height: 1000 }, appearance: "light", qualityModes: [], constraints: ["static-rich", "artifact-first"], reason: "Public story uses the same signature at rich static scale." },
  { id: "marketing-grayscale", channel: "marketing", targetProfile: "marketingRich", proof: "required", viewport: { width: 1440, height: 1000 }, appearance: "grayscale", qualityModes: [], constraints: ["grayscale-proof"], reason: "Marketing hierarchy survives grayscale output." },
  { id: "email-600-light", channel: "email", targetProfile: "emailConstrained", proof: "required", viewport: { width: 600, height: 900 }, appearance: "light", qualityModes: [], constraints: ["safe-fallbacks", "image-optional", "no-motion"], reason: "Common email reading width with safe fallbacks." },
  { id: "email-320-narrow", channel: "email", targetProfile: "emailConstrained", proof: "required", viewport: { width: 320, height: 900 }, appearance: "light", qualityModes: [], constraints: ["safe-fallbacks", "long-copy", "no-motion"], reason: "Narrow email clients cannot hide the useful next move." },
  { id: "email-client-controlled", channel: "email", targetProfile: "emailConstrained", proof: "required", viewport: { width: 600, height: 900 }, appearance: "client-controlled", qualityModes: [], constraints: ["client-controlled", "safe-fallbacks"], reason: "Client-controlled appearance preserves meaning without a second brand." },
  { id: "sms-plain-text", channel: "sms", targetProfile: "smsPlainText", proof: "required", appearance: "client-controlled", qualityModes: [], constraints: ["plain-text", "no-motion", "no-image"], reason: "SMS keeps one plain-language next move." },
  { id: "print-letter", channel: "print", targetProfile: "artifactPrint", proof: "required", viewport: { width: 612, height: 792 }, appearance: "grayscale", qualityModes: [], constraints: ["embedded-fonts", "provenance", "no-motion"], reason: "US Letter artifact output with embedded or declared font fallback." },
  { id: "print-a4", channel: "print", targetProfile: "artifactPrint", proof: "required", viewport: { width: 595, height: 842 }, appearance: "grayscale", qualityModes: [], constraints: ["embedded-fonts", "provenance", "no-motion"], reason: "A4 artifact output remains readable and attributable." },
  { id: "provider-static", channel: "provider", targetProfile: "providerConstrained", proof: "required", appearance: "provider-controlled", qualityModes: [], constraints: ["approved-static", "safe-fallbacks", "provider-owned-motion"], reason: "Provider-owned surfaces receive approved static inputs only." },
  { id: "metadata-plain-text", channel: "metadata", targetProfile: "metadataConstrained", proof: "required", appearance: "client-controlled", qualityModes: [], constraints: ["plain-text", "tiny-static"], reason: "Metadata carries the name and useful next move without visual assumptions." },
] as const;

export interface FixtureGallerySource {
  id: string;
  source: string;
  description: string;
  profileIds?: readonly string[];
}

export const fixtureGalleryAssets: readonly FixtureGallerySource[] = identityAssetCatalog.map((asset) => ({
  id: `asset-${asset.id}`,
  source: `packages/design/src/contract/identity.ts#identityAssetCatalog.${asset.id}`,
  description: `${asset.destination} asset projection for ${asset.appearance} appearance.`,
}));

export const fixtureGalleryPrimitives: readonly FixtureGallerySource[] = [
  { id: "web-quiet-action", source: "apps/web/components/design/QuietAction.tsx", description: "Primary and secondary parent-decided action." },
  { id: "web-quiet-choice", source: "apps/web/components/design/QuietChoice.tsx", description: "Choice control with truthful selected state." },
  { id: "web-quiet-feedback", source: "apps/web/components/design/QuietFeedback.tsx", description: "Feedback and recovery message." },
  { id: "web-quiet-field", source: "apps/web/components/design/QuietField.tsx", description: "Labelled input and validation boundary." },
  { id: "web-quiet-frame", source: "apps/web/components/design/QuietFrame.tsx", description: "Paper, contained, and floating reading surface." },
  { id: "web-quiet-identity", source: "apps/web/components/design/QuietIdentity.tsx", description: "Logo and identity lockup." },
  { id: "web-quiet-media", source: "apps/web/components/design/QuietMedia.tsx", description: "Artifact-first media treatment." },
  { id: "web-quiet-nav", source: "apps/web/components/design/QuietNav.tsx", description: "Navigation with current location and useful exit." },
  { id: "web-quiet-footer", source: "apps/web/components/design/QuietFooter.tsx", description: "Canonical public links and policy exits." },
  { id: "web-quiet-status", source: "apps/web/components/design/QuietStatus.tsx", description: "Semantic constructive, information, attention, and error state." },
  { id: "web-quiet-thread", source: "apps/web/components/design/QuietThread.tsx", description: "Meaningful thread connecting work to the next move." },
  { id: "web-semantic-icon", source: "apps/web/components/design/Icon.tsx", description: "Semantic icon adapter with fail-closed role lookup." },
  { id: "native-semantic-icon", source: "apps/mobile/src/components/design/icon.tsx", description: "Native semantic icon adapter." },
  { id: "native-logo", source: "apps/mobile/src/components/brand/logo.tsx", description: "Native master identity projection." },
  { id: "web-quiet-primitive-css", source: "apps/web/components/design/quiet-primitives.css", description: "Web token, state, focus, motion, and appearance endpoints." },
] as const;

export const fixtureGalleryPatterns: readonly FixtureGallerySource[] = [
  { id: "pattern-quiet-shell", source: "apps/web/app/design/quiet-authority/page.tsx", description: "Shared identity, page frame, and footer shell." },
  { id: "pattern-real-work-card", source: "apps/web/app/design/quiet-authority/page.tsx#evidence", description: "Real learning artifact leads the composition." },
  { id: "pattern-warm-guide", source: "apps/web/app/design/quiet-authority/page.tsx#guide", description: "Homa keeps the thread without becoming the hero." },
  { id: "pattern-useful-next-move", source: "apps/web/app/design/quiet-authority/page.tsx#next", description: "One specific parent-decided next move." },
  { id: "pattern-auth-shell", source: "apps/web/app/signin/page.tsx", description: "Trust-critical entry with Quiet frame and recovery." },
  { id: "pattern-communication-card", source: "apps/web/lib/email/render.ts", description: "Email reduction preserving Logo and plain-language next move." },
  { id: "pattern-artifact-preview", source: "apps/web/app/admin/artifact-preview.tsx", description: "Operator preview preserving provenance and density." },
] as const;

export const fixtureGallerySignatures: readonly FixtureGallerySource[] = [
  { id: "signature-real-work", source: "packages/design/src/contract/content.ts#contentRules.signature", description: "Real work leads." },
  { id: "signature-homa-keeps-thread", source: "packages/design/src/contract/doctrine.ts#doctrinePrinciples.homa-keeps-the-thread", description: "Homa connects the evidence to meaning." },
  { id: "signature-one-useful-next-move", source: "packages/design/src/contract/doctrine.ts#doctrinePrinciples.one-useful-next-move", description: "The composition resolves to one useful move." },
  { id: "signature-parent-decides", source: "packages/design/src/contract/doctrine.ts#doctrinePrinciples.parent-decides", description: "Homa suggests and the parent decides." },
  { id: "signature-semantic-color", source: "packages/design/src/contract/doctrine.ts#doctrinePrinciples.semantic-color-is-truthful", description: "Color communicates state, not decoration." },
  { id: "signature-motion-ends-in-state", source: "packages/design/src/contract/doctrine.ts#doctrinePrinciples.motion-ends-in-state", description: "Motion ends where the truth is." },
  { id: "signature-channel-reduction", source: "packages/design/src/contract/doctrine.ts#doctrinePrinciples.channel-reductions-preserve-meaning", description: "Constrained channels keep the meaning." },
] as const;

export const FIXTURE_GALLERY_CONTRACT = {
  version: DESIGN_CONTRACT_VERSION,
  schemaVersion: FIXTURE_GALLERY_SCHEMA_VERSION,
  galleryVersion: FIXTURE_GALLERY_VERSION,
  profiles: fixtureGalleryProfiles,
  primitives: fixtureGalleryPrimitives,
  patterns: fixtureGalleryPatterns,
  signatures: fixtureGallerySignatures,
} as const;
