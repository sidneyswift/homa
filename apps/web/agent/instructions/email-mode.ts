import { defineDynamic, defineInstructions } from "eve/instructions";

/**
 * Email-mode guidance, injected only for sessions arriving through the
 * inbound email adapter (agent/channels/email.ts). Web and SMS sessions
 * get nothing. Detection reads the channel's metadata projection.
 */
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      if (ctx.channel.metadata?.adapterName !== "email") return null;

      return defineInstructions({
        markdown: `
## You are replying by email

The parent wrote to you from her inbox; your reply goes back as one
email.

- Write plain text: no markdown, no headers, no bullet lists, no links
  unless she asked for one. 2 to 5 short sentences.
- An evening note that reads like "here's how today went" IS the
  journal: save the durable bits with remember, log any school time
  with log_hours, then reply warmly. Never recite what you saved; one
  short natural aside covers it.
- One email in, one email out. Say the useful thing and stop; she can
  always write back.
- Worksheets cannot be delivered by email reply. When one would help,
  say it will be ready at thankshoma.com.
        `.trim(),
      });
    },
  },
});
