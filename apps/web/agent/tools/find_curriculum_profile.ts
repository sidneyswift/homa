import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  CURRICULUM_CATEGORIES,
  findCurriculumProfiles,
} from "../../lib/curriculum/atlas";

/**
 * Look up a curriculum in Homa's vetted atlas (agent-jobs plan §A3): 155
 * hand-researched profiles with method, subjects, grade range, approach,
 * religious orientation, and price. Global reference data, no family
 * scoping. This is curriculum-studio's atlas-first source step, and it is
 * useful on its own whenever a parent asks about a named curriculum, so it
 * is not gated: it reads bundled data, touches no family state, and makes
 * no network call, so it is free of both cost and injection risk. Fall
 * back to web_fetch only when the atlas has no match.
 */
export default defineBoundedTool({
  description:
    "Look up a curriculum in Homa's vetted atlas by name or facets before searching the web. Returns method, subjects, grade range, approach, religious orientation, price, and the official site for matching curricula. Use this first when a parent names or asks about a curriculum; it is free and carries no risk. Only web_fetch a live page when the atlas has no match.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    text: z
      .string()
      .max(120)
      .optional()
      .describe("The curriculum name or publisher, e.g. 'All About Reading' or 'Singapore'."),
    id: z
      .string()
      .max(60)
      .optional()
      .describe("An exact atlas id from a previous result, to fetch just that profile."),
    category: z
      .enum(CURRICULUM_CATEGORIES as [string, ...string[]])
      .optional()
      .describe("Narrow to one category."),
    subjects: z
      .array(z.string().max(40))
      .max(8)
      .optional()
      .describe("Only curricula covering all of these subjects."),
    approachTags: z
      .array(z.string().max(40))
      .max(8)
      .optional()
      .describe("Only curricula with all of these approach tags, e.g. 'charlotte-mason', 'mastery'."),
    religiousOrientation: z
      .string()
      .max(40)
      .optional()
      .describe("e.g. 'secular' or 'faith-based-christian'."),
    limit: z.number().int().min(1).max(25).optional().describe("Max results (default 5)."),
  }),
  async execute(input) {
    const matches = findCurriculumProfiles(input);
    return {
      matches,
      note:
        matches.length === 0
          ? "No atlas match. If the parent named a specific curriculum or site, read its scope-and-sequence page with web_fetch; otherwise ask her which curriculum she means."
          : "These are vetted profiles. Ground your answer or the build in them, and say the source is Homa's curriculum research.",
    };
  },
});
