import { defineTool } from "eve/tools";
import { z } from "zod";

import { MissingFamilyContextError, resolveAgentAccess } from "../../lib/agent-db";
import { emitMapEvent } from "../../lib/map/events";
import { rateLimited } from "../../lib/map/ratelimit";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import {
  PHOTO_KINDS,
  searchWebPhotos,
  serpConfigured,
} from "../../lib/search/serp-images";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SEARCHES_PER_FAMILY_PER_DAY = 10;

/**
 * The studio's photo desk, step one of two: find real pictures the
 * image model cannot honestly make (real animals, coins, landmarks,
 * what a curriculum actually looks like). Results carry signed
 * photoTokens, never URLs; keep_photo turns a pick into a permanent
 * family-library URL. Query text goes to the search vendor, so the
 * instruction law matches the research brief: topics, never the family.
 */
export default defineTool({
  description:
    "Search the web (Google Images) for real photographs and reference pictures: real animals and plants for nature study, real coins for money math, landmarks, book or curriculum covers, anything that should look real rather than illustrated (generate_image owns illustration). Returns numbered results with title, source site, and pixel size, each with a photoToken. Results are NOT usable directly: call keep_photo with the photoToken of the one you want, and embed or reference only the URL keep_photo returns. Search about topics, never the family: no child, parent, or family names in queries, ever. Searches are budgeted per day; make one well-worded search rather than several.",
  inputSchema: z.object({
    query: z
      .string()
      .trim()
      .min(3)
      .max(200)
      .describe(
        "What to find, phrased like a Google Images search about the TOPIC, e.g. 'monarch butterfly on milkweed photo'. Never include a child's or parent's name.",
      ),
    kind: z
      .enum(PHOTO_KINDS)
      .optional()
      .describe(
        "What sort of picture: photo (default, real photography), clipart, lineart, or any.",
      ),
    count: z
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .describe("How many results to return. Defaults to 8."),
  }),
  async execute(input, ctx) {
    let access;
    try {
      access = resolveAgentAccess(ctx.session.auth.current?.attributes);
    } catch (error) {
      if (error instanceof MissingFamilyContextError) {
        return { photos: [], note: error.message };
      }
      throw error;
    }
    const channel = usageChannelFromAttributes(
      ctx.session.auth.current?.attributes,
    );
    if (channel === "subject_lesson") {
      return {
        photos: [],
        note: "Use an HTML-only subject lesson worksheet without photo or reference search.",
      };
    }

    if (!serpConfigured()) {
      return {
        photos: [],
        note: "Photo search is not configured on this deployment. Design with generated art or plain description instead.",
      };
    }
    if (
      rateLimited(
        `web-photos:${access.familyId}`,
        MAX_SEARCHES_PER_FAMILY_PER_DAY,
        DAY_MS,
      )
    ) {
      return {
        photos: [],
        note: "This family's photo searches for today are used up. Work with photos already kept, generate_image, or plain description.",
      };
    }

    const startedAt = Date.now();
    const outcome = await searchWebPhotos({
      familyId: access.familyId,
      query: input.query,
      kind: input.kind,
      count: input.count,
    });
    if (!outcome.ok) {
      return { photos: [], note: outcome.note };
    }

    await emitMapEvent("materials.photo_searched", {
      family_id: access.familyId,
      channel,
      results: outcome.photos.length,
      duration_ms: Date.now() - startedAt,
    });

    return {
      photos: outcome.photos,
      note:
        outcome.photos.length > 0
          ? "Pick by title, source, and size (bigger prints better), then call keep_photo with that result's photoToken. Only keep_photo's URL is usable; never invent an image URL."
          : "Nothing usable came back. Try different words once, or design with generate_image instead.",
    };
  },
});
