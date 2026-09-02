import { createHash } from "node:crypto";

import { ANCHOR_MANIFEST } from "./anchor-manifest.generated";
import { isFleetAnchorUrl } from "./artifact-store";
import { MAX_REFERENCE_BYTES } from "./reference-limits";

/**
 * Fleet material anchors: shared, read-only reference images that the
 * materials studio hands to the image model to set the visual bar for a
 * format ("this good or better"). They are product assets, not family
 * data, so the same anchor is safe for every family: no tenant boundary
 * is involved.
 *
 * The model may only choose an anchor by id from this fixed registry; it
 * can never pass a URL through this path. The tool resolves the id to
 * trusted bytes: the JPEGs live in Vercel Blob under
 * fleet/material-anchors/<id>-<sha12>.jpg (public, content-addressed),
 * and anchor-manifest.generated.ts records each anchor's URL and sha256.
 * scripts/build-material-anchors.mts uploads anchor-sources/*.jpg and
 * writes the manifest; loadStudioAnchorBytes fetches a manifest URL only
 * after isFleetAnchorUrl accepts it and verifies the sha256 before handing
 * bytes on. Family reference images keep going through isFamilyArtifactUrl
 * untouched.
 *
 * Isolated eval runs (lib/eval-isolation.ts) scrub write credentials but
 * do not block network egress, and the anchor store is public, so evals
 * read anchors from the same Blob URLs production does; no sandbox
 * seeding is needed.
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
  {
    id: "letter-number-formation-practice",
    title: "Letter / number formation practice page",
    useWhen:
      "building a letter or number formation practice page: a model letter or digit with a stroke cue, and a row of trace repetitions",
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

type ManifestEntry = (typeof ANCHOR_MANIFEST)[string];

/**
 * One anchor's manifest entry, only when the id is registered AND the
 * recorded URL passes isFleetAnchorUrl. The manifest is generated code,
 * but the URL check stays: a hand edit or a corrupted build must never
 * turn this path into an arbitrary fetch.
 */
function trustedManifestEntry(id: string): ManifestEntry | null {
  if (!BY_ID.has(id)) return null;
  if (!Object.hasOwn(ANCHOR_MANIFEST, id)) return null;
  const entry = ANCHOR_MANIFEST[id];
  return isFleetAnchorUrl(entry.url) ? entry : null;
}

/**
 * The public Blob URL for one registered anchor (the founder console links
 * to it), or null for anything that is not a registered, trusted anchor.
 */
export function studioAnchorUrl(id: string): string | null {
  return trustedManifestEntry(id)?.url ?? null;
}

/**
 * Well inside TOOL_DEADLINE.generate (240s): four anchors at the cap add
 * 40s to a call whose generation budget is 200s. A healthy fetch of a
 * roughly 100 KB JPEG from Blob is well under a second.
 */
const ANCHOR_FETCH_TIMEOUT_MS = 10_000;

/** Verified bytes per anchor id, so a warm instance fetches each once. */
const loadedAnchors = new Map<string, Uint8Array>();

/**
 * Resolves one anchor id to its verified JPEG bytes: registry lookup,
 * manifest lookup, isFleetAnchorUrl, a bounded fetch, the reference byte
 * cap, and a sha256 check against the manifest. Any failure returns null
 * (with one runtime log line, the per-turn diagnostics surface) so the
 * caller can turn it into a model-readable note instead of a thrown turn;
 * nothing here throws. Successes are memoized for the life of the isolate.
 */
export async function loadStudioAnchorBytes(id: string): Promise<Uint8Array | null> {
  const cached = loadedAnchors.get(id);
  if (cached) return cached;
  const entry = trustedManifestEntry(id);
  if (!entry) return null;

  const reject = (reason: string): null => {
    console.warn(`loadStudioAnchorBytes: anchor "${id}" ${reason}`);
    return null;
  };
  if (entry.bytes > MAX_REFERENCE_BYTES) {
    return reject(`is over the reference byte cap in the manifest (${entry.bytes} bytes)`);
  }
  try {
    const response = await fetch(entry.url, {
      signal: AbortSignal.timeout(ANCHOR_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return reject(`fetch returned HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) return reject("fetch returned no bytes");
    if (bytes.byteLength > MAX_REFERENCE_BYTES) {
      return reject(`fetch returned ${bytes.byteLength} bytes, over the reference cap`);
    }
    if (bytes.byteLength !== entry.bytes) {
      return reject(`fetch returned ${bytes.byteLength} bytes, manifest says ${entry.bytes}`);
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== entry.sha256) return reject("sha256 does not match the manifest");
    loadedAnchors.set(id, bytes);
    return bytes;
  } catch (error) {
    return reject(
      `fetch failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Every anchor id the manifest carries (for parity checks/tests). */
export function manifestAnchorIds(): readonly string[] {
  return Object.keys(ANCHOR_MANIFEST);
}
