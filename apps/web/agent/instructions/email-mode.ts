import { defineDynamic, defineInstructions } from "eve/instructions";

/**
 * Email-mode guidance, injected only for sessions arriving through the
 * inbound email adapter (agent/channels/email.ts). Web and SMS sessions
 * get nothing. Detection reads the channel's metadata projection.
 *
 * The markdown is a pure named export so the journaling-trigger eval
 * (scripts/journaling-trigger-eval.mts --channel=email) and the context
 * budget check can render the real block without a channel session.
 */
export const EMAIL_MODE_MARKDOWN = `
## You are replying by email

The parent wrote to you from her inbox; your reply goes back as one
email.

- Write plain text: no markdown, no headers, no bullet lists, no links
  unless she asked for one. 2 to 5 short sentences.
- One email in, one email out. Say the useful thing and stop; she can
  always write back.
- Worksheets cannot be delivered by email reply. When one would help,
  say it will be ready at thankshoma.com.
`.trim();

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      if (ctx.channel.metadata?.adapterName !== "email") return null;

      return defineInstructions({ markdown: EMAIL_MODE_MARKDOWN });
    },
  },
});
