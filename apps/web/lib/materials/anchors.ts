import { ANCHOR_BYTES_B64 } from "./anchor-bytes.generated";

/**
 * Fleet material anchors: shared, read-only reference images that the
 * materials studio hands to the image model to set the visual bar for a
 * format ("this good or better"). They are product assets, not family
 * data, so the same anchor is safe for every family: no tenant boundary
 * is involved.
 *
 * The model may only choose an anchor by id from this fixed registry; it
 * can never pass a URL through this path. The tool resolves the id to
 * trusted bytes (embedded in anchor-bytes.generated.ts, regenerated from
 * the skill package by scripts/build-material-anchors.mts). Family
 * reference images keep going through isFamilyArtifactUrl untouched.
 *
 * Register mirrors the style directive's age/seriousness dial: `playful`
 * anchors carry full handmade warmth; `restrained` anchors stay clean and
 * grown-up. See the materials-studio SKILL.md for how Homa picks one.
 */
export type MaterialAnchorRegister = "playful" | "restrained";

export interface MaterialAnchor {
  readonly id: string;
  readonly title: string;
  /** Routing instruction: the intent that should select this anchor. */
  readonly useWhen: string;
  readonly register: MaterialAnchorRegister;
  readonly mediaType: string;
}

const REGISTRY: readonly MaterialAnchor[] = [
  {
    id: "order-of-operations-chart",
    title: "Order of operations (PEMDAS/GEMDAS) reference chart",
    useWhen:
      "building a math reference chart, poster, or foldable about the order of operations (PEMDAS or GEMDAS)",
    register: "playful",
    mediaType: "image/jpeg",
  },
  {
    id: "five-paragraph-essay-outline",
    title: "Five-paragraph essay outline / writing scaffold",
    useWhen:
      "building an essay outline, a writing scaffold, or a structured planning sheet for older students",
    register: "restrained",
    mediaType: "image/jpeg",
  },
];

const BY_ID: ReadonlyMap<string, MaterialAnchor> = new Map(
  REGISTRY.map((anchor) => [anchor.id, anchor]),
);

export function listStudioAnchors(): readonly MaterialAnchor[] {
  return REGISTRY;
}

export function studioAnchorIds(): readonly string[] {
  return REGISTRY.map((anchor) => anchor.id);
}

export function getStudioAnchor(id: string): MaterialAnchor | undefined {
  return BY_ID.get(id);
}

/**
 * Decodes one anchor's embedded JPEG bytes. Returns null when the id is
 * not a registered anchor or its bytes are missing, so a caller can turn
 * an unknown id into a model-readable error instead of a thrown turn.
 */
export function decodeStudioAnchorBytes(id: string): Uint8Array | null {
  if (!BY_ID.has(id)) return null;
  const b64 = ANCHOR_BYTES_B64[id];
  if (b64 === undefined) return null;
  const buffer = Buffer.from(b64, "base64");
  return buffer.byteLength > 0 ? new Uint8Array(buffer) : null;
}

/** Every anchor id that has embedded bytes (for parity checks/tests). */
export function embeddedAnchorIds(): readonly string[] {
  return Object.keys(ANCHOR_BYTES_B64);
}
