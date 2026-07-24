import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";

/**
 * The agent's opening move on genuinely slow work over SMS: one short
 * progress text sent before substantial reasoning, research, dependent
 * tools, or a material build. The chat-sdk bridge cannot post agent text
 * until every tool finishes, so this rides the tool-send lane and shares
 * one dedupe window with automatic material fallbacks. The destination
 * comes from channel auth, never the model (anti-relay law).
 */

const headsUpInput = z.object({
  message: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .describe(
      "One short line telling her what you are working through. Do not include markdown, links, or an exact time estimate.",
    ),
});

export default defineBoundedTool({
  description:
    "Text the parent one short progress message BEFORE slow work in an SMS conversation. Call it first when substantial reasoning, current research, several dependent tools, or a material build would otherwise leave her waiting in silence. Keep the line specific to her request. Do not use it for greetings, quick answers, clarifying questions, signup, consent, invitations, account linking, or one-step record updates. One progress text is allowed per slow turn. The completed reply remains the only reply to the parent's text. On web chat, do not call this: write one short sentence in your reply instead, then start the work.",
  deadlineMs: TOOL_DEADLINE.fetch,
  inputSchema: headsUpInput,
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes as
      | { channel?: string; phoneNumber?: string; familyId?: string }
      | undefined;
    const channel = usageChannelFromAttributes(attributes);

    if (channel !== "sms" || !attributes?.phoneNumber) {
      return {
        sent: false,
        note: "This is not a text conversation, so no heads-up text is needed. Write one short sentence in your reply about what you are starting, then do the work in the same turn.",
      };
    }

    const sent = await sendSmsProgressTextOnce({
      familyId: attributes.familyId ?? null,
      phoneNumber: attributes.phoneNumber,
      text: input.message,
    });
    return sent
      ? {
          sent: true,
          note: "Progress text sent. Do the work, then send the completed reply. Never send a second progress message.",
        }
      : {
          sent: false,
          note: "No progress text was confirmed. It may already have been sent for this slow turn. Continue the work. Do not claim the text was delivered. Do not try another progress message.",
        };
  },
});
