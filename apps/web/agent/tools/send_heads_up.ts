import { defineTool } from "eve/tools";
import { z } from "zod";

import { sendWaitTextOnce } from "../../lib/materials/sms-ack";
import { usageChannelFromAttributes } from "../../lib/model-usage";

/**
 * The agent's opening move on slow work over SMS: one short text in her
 * own voice ("on it, making Story's counting page now") sent BEFORE she
 * designs and builds, so the parent never stares at a silent phone. The
 * chat-sdk bridge cannot post agent text until every tool finishes, so
 * this rides the tool-send lane (lib/materials/sms-ack.ts), sharing the
 * dedupe window with the automatic tool-start ack: whichever fires
 * first wins, one wait text per build. The number comes from channel
 * auth, never the model (anti-relay law).
 */

const headsUpInput = z.object({
  message: z
    .string()
    .trim()
    .min(1)
    .max(160)
    .describe(
      "The one short line to text her, in your voice, naming what you are making and that it takes a minute or two. Plain text: no markdown, no links.",
    ),
});

export default defineTool({
  description:
    "Text the parent one short heads-up BEFORE you start slow work in a text (SMS) conversation: a material build or image generation means a silent minute or two on her phone otherwise. Call it FIRST, before loading skills or designing, e.g. 'On it, making Story's counting page now. Should land here in a minute or two.' One heads-up per build (the tool refuses extras), and your normal reply after the work is still the only real reply. Pointless on web chat, where she already watches your progress live.",
  inputSchema: headsUpInput,
  async execute(input, ctx) {
    const attributes = ctx.session.auth.current?.attributes as
      | { channel?: string; phoneNumber?: string; familyId?: string }
      | undefined;
    const channel = usageChannelFromAttributes(attributes);

    if (channel !== "sms" || !attributes?.phoneNumber) {
      return {
        sent: false,
        note: "This is not a text conversation, so no heads-up is needed; the parent already sees your progress. Just do the work.",
      };
    }

    const sent = sendWaitTextOnce({
      familyId: attributes.familyId ?? null,
      phoneNumber: attributes.phoneNumber,
      text: input.message,
    });
    return sent
      ? {
          sent: true,
          note: "Heads-up texted. Now do the work; when it finishes, reply normally, and never send a second wait message.",
        }
      : {
          sent: false,
          note: "A wait text already went out for this build moments ago. Never send another; just do the work.",
        };
  },
});
