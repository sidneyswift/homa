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

const JPEG = "image/jpeg";

const REGISTRY: readonly MaterialAnchor[] = [
  {
    id: "order-of-operations-chart",
    title: "Order of operations (PEMDAS/GEMDAS) reference chart",
    useWhen:
      "building a math reference chart, poster, or foldable about the order of operations (PEMDAS or GEMDAS)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "five-paragraph-essay-outline",
    title: "Five-paragraph essay outline / writing scaffold",
    useWhen:
      "building an essay outline, a writing scaffold, or a structured planning sheet for older students",
    register: "restrained",
    mediaType: JPEG,
  },
  {
    id: "foldable",
    title: "Foldable / interactive notebook insert",
    useWhen: "building a foldable or interactive notebook insert",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "cut-and-paste-word-work",
    title: "Cut-and-paste CVC word work page",
    useWhen: "building a cut-and-paste word work page for early phonics or CVC words",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "number-practice-page",
    title: "Single-number practice page",
    useWhen:
      "building a single-number practice page (trace, ten-frame, count, color)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "math-practice",
    title: "General math practice page",
    useWhen: "building a general arithmetic or math practice page",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "one-page-mini-book",
    title: "One-page fold-into-eight mini book",
    useWhen: "building a one-page mini book that folds into eight panels",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "matching-visual-discrimination",
    title: "Preschool matching / visual discrimination page",
    useWhen:
      "building a preschool matching, sorting, or visual discrimination page",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "unit-study-packet",
    title: "Themed unit study packet",
    useWhen: "building a themed, multi-activity unit study packet",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "activity-pack",
    title: "Four-quadrant activity pack",
    useWhen: "building a themed activity pack of four mini-activities in quadrants",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "daily-rhythm-cards",
    title: "Daily rhythm / schedule cards",
    useWhen: "building cut-apart daily schedule or rhythm cards",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "visual-schedule-cards",
    title: "Visual schedule cards",
    useWhen: "building visual schedule cards for routines or transitions",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "singapore-workbook-page",
    title: "Singapore-style CPA math workbook page",
    useWhen:
      "building a Singapore-style workbook page using the concrete-pictorial-abstract progression",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "hive-puzzle",
    title: "Hexagonal hive constraint puzzle",
    useWhen: "building a hexagonal hive number-constraint puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "cross-number-puzzle",
    title: "Cross-number arithmetic puzzle",
    useWhen: "building a cross-number (crossword-style) arithmetic puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "fraction-link-puzzle",
    title: "Fraction-equivalence link puzzle",
    useWhen: "building a fraction-equivalence or fraction-link grid puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "fraction-maze-escape",
    title: "Fraction-comparison maze",
    useWhen: "building a fraction-comparison or ordering maze",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "decimal-path-puzzle",
    title: "Decimal-ordering path puzzle",
    useWhen: "building a decimal comparison or ordering path puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "geometry-maze",
    title: "Geometry / angle maze",
    useWhen: "building a geometry or angle maze, or a maze-style practice page",
    register: "playful",
    mediaType: JPEG,
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
