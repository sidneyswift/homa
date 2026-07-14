import type { Modality } from "../agent-memory";
import type { MaterialKind } from "../materials/kinds";

/**
 * Maps material kinds (the high-level type stored in the materials table)
 * to learning modalities. Some kinds are unambiguously one modality;
 * others are null (too ambiguous to signal anything useful).
 *
 * Source of truth: apps/web/agent/activity-formats.md modality tags.
 * This is a coarser mapping because the specific format slug isn't
 * persisted on the material row — only the MaterialKind is.
 *
 * worksheet → visual (themed worksheets are primarily visual engagement)
 * coloring  → kinesthetic (hands-on coloring, fine motor)
 * flashcards → visual (drill and recall via sight)
 * reader    → reading_writing (reading comprehension)
 * poster    → visual (reference charts, displayed)
 * infographic → visual (diagrams, visual reference)
 * game      → kinesthetic (interactive, hands-on)
 * packet    → null (mixed, too broad to classify)
 * other     → null (unclassifiable)
 */
const KIND_MODALITY_MAP: Partial<Record<MaterialKind, Modality>> = {
  worksheet: "visual",
  coloring: "kinesthetic",
  flashcards: "visual",
  reader: "reading_writing",
  poster: "visual",
  infographic: "visual",
  game: "kinesthetic",
  // packet and other are too ambiguous to assign a modality
};

/**
 * Return the modality for a material kind, or null when the kind is too
 * ambiguous to produce a useful signal. Callers should only write a
 * modality signal when this returns non-null.
 */
export function modalityForMaterialKind(kind: MaterialKind): Modality | null {
  return KIND_MODALITY_MAP[kind] ?? null;
}
