import { defineTool } from "eve/tools";
import { z } from "zod";

/**
 * Turns worksheet content the model composed into a validated, structured
 * payload the chat UI renders as a print-ready card (the mom prints it from
 * the browser). v0 of M2-05: no sandbox, no PDF pipeline, no image
 * generation yet; the artifact is a schema-checked printable layout. The
 * real reportlab/fal.ai pipeline (M0-03 spike, then M2-05 proper) replaces
 * the rendering layer without changing this tool's contract much.
 */

const worksheetInput = z.object({
  childName: z.string().min(1).max(60),
  title: z.string().min(1).max(90),
  subtitle: z
    .string()
    .max(120)
    .describe("One line naming the skill practiced, e.g. 'Letter sounds practice'"),
  theme: z
    .string()
    .max(60)
    .describe("The child's interest woven through the exercises, e.g. 'dinosaurs'"),
  items: z
    .array(
      z.object({
        instruction: z
          .string()
          .min(1)
          .max(200)
          .describe("What the child should do for this exercise, written to the child"),
        content: z
          .string()
          .max(400)
          .describe(
            "The exercise body: the letters to trace, the things to count, the words to circle. Plain text; use newlines for layout.",
          ),
      }),
    )
    .min(2)
    .max(8),
  encouragement: z
    .string()
    .max(160)
    .describe(
      "One warm closing line written TO the child, second person ('Every trident you earned today...'), printed on the sheet for the parent to say out loud when it's done",
    ),
});

export default defineTool({
  description:
    "Create a personalized printable worksheet for a child. Compose the exercises yourself, themed to the child's interests and aimed at their current focus, then call this to produce the printable card the parent sees in chat. Ages 2-7 exercises should be doable with a pencil on one page.",
  inputSchema: worksheetInput,
  execute(input) {
    // Validation IS the work here: the model composed the content, the UI
    // renders the card from this exact payload.
    return {
      worksheet: input,
      note: "Worksheet card rendered in chat with a print button. Tell the parent it's ready and what it practices, in one warm sentence written to HER; the sheet's closing line already speaks to the child.",
    };
  },
});
