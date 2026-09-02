import { decodeStudioAnchorBytes, getStudioAnchor } from "./anchors";

/**
 * The format's fleet anchor, loaded for the QC reviewer (2026-09-02).
 *
 * The image model has always been handed the anchor ("this good or
 * better"); the reviewer never was, so when a revision shrank a
 * letter-formation page's letters below tracing size it had no memory of
 * how generous the format is supposed to be. Now the anchor rides into
 * each reviewer call as one more image, explicitly not under review, so
 * "at least this big, at least this clear" is a comparison rather than a
 * guess.
 *
 * Fail open, always: a missing, oversize, slow, or throwing anchor load
 * is recorded as a skip reason on the review and the pages are reviewed
 * without it. A reference image is never allowed to hold a family's page
 * back. The loader is a seam so this module compiles against either
 * anchor storage: on main the bytes are embedded and decoded in-process;
 * the Blob-migration branch (materials-studio/anchor-blob-migration)
 * swaps defaultAnchorLoader for its async loadStudioAnchorBytes.
 */

export const REVIEW_ANCHOR_MAX_BYTES = 1_500_000;
export const REVIEW_ANCHOR_LOAD_TIMEOUT_MS = 5_000;

export interface ReviewAnchor {
  id: string;
  title: string;
  data: Uint8Array;
  mediaType: string;
}

/** Why the loader produced no anchor. */
export type ReviewAnchorLoadSkip = "missing" | "too-large" | "load-failed" | "timeout";

/** Every reason a review ran without an anchor, including the two the
 * caller decides before loading: the recipe has none, or the page is a
 * pure image-direct page whose image model already saw it. */
export type ReviewAnchorSkip = "no-anchor" | "not-html" | ReviewAnchorLoadSkip;

export type ReviewAnchorLoad =
  | { anchor: ReviewAnchor; skipped?: undefined }
  | { anchor: null; skipped: ReviewAnchorSkip };

export type ReviewAnchorLoader = (id: string) => Promise<Uint8Array | null>;

// The storage seam. On main the anchor bytes are embedded (anchors.ts,
// anchor-bytes.generated.ts) and decode synchronously; the Blob-migration
// branch swaps this one line for loadStudioAnchorBytes.
const defaultAnchorLoader: ReviewAnchorLoader = async (id) =>
  decodeStudioAnchorBytes(id);

/**
 * loadReviewAnchor(anchorId, loader?, timeoutMs?): the anchor as a
 * reviewer image, or the reason there is none. Never throws and never
 * hangs: the loader races a timer, every failure is caught, and the
 * registry supplies the title and media type so a caller cannot pass a
 * URL through this path (only registered ids resolve).
 */
export async function loadReviewAnchor(
  anchorId: string,
  loader: ReviewAnchorLoader = defaultAnchorLoader,
  timeoutMs: number = REVIEW_ANCHOR_LOAD_TIMEOUT_MS,
): Promise<ReviewAnchorLoad> {
  const registered = getStudioAnchor(anchorId);
  if (!registered) return { anchor: null, skipped: "missing" };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    // Promise.race subscribes to the loader too, so a loader that rejects
    // after the timer wins is still a handled rejection.
    const bytes = await Promise.race([loader(anchorId), timeout]);
    if (bytes === "timeout") return { anchor: null, skipped: "timeout" };
    if (!bytes || bytes.byteLength === 0) return { anchor: null, skipped: "missing" };
    if (bytes.byteLength > REVIEW_ANCHOR_MAX_BYTES) {
      return { anchor: null, skipped: "too-large" };
    }
    return {
      anchor: {
        id: registered.id,
        title: registered.title,
        data: bytes,
        mediaType: registered.mediaType,
      },
    };
  } catch {
    return { anchor: null, skipped: "load-failed" };
  } finally {
    clearTimeout(timer);
  }
}
