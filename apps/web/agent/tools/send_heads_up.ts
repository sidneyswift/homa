import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import { usageChannelFromAttributes } from "../../lib/model-usage";
import { sendSmsProgressTextOnce } from "../../lib/sms-progress";

/**
 * The agent's opening move on genuinely slow work over SMS: one short
 * progress text sent before substantial reasoning, research, or a material
 * build. Routine capture is excluded even when it takes several tools:
 * #1206 confirmed that the extra SMS looked like a duplicate reply.
 * The chat-sdk bridge cannot post agent text
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
    "Use when a parent requests substantial analysis, current research, or new material creation over SMS and would otherwise wait in silence. Send one short, specific progress text before that slow work, then finish with the completed reply. Not for routine reports of learning, milestones, journal observations, memory, Hours, or Planner record updates: do the saves and send only the completed reply, even when one message covers several children or needs several tools. Tool count alone does not make a request slow work. Also not for greetings, quick answers, clarification, signup, consent, invitations, or account linking. One progress text is allowed per eligible turn. On web chat, write a short progress sentence in the response instead of calling this tool.",
  deadlineMs: TOOL_DEADLINE.fetch,
  repeatable: false,
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
