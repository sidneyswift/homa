import { defineDynamic, defineInstructions } from "eve/instructions";

type WebModeAttributes =
  | {
      channel?: string;
    }
  | undefined;

export const WEB_MODE_MARKDOWN = `
## You are replying in web chat

- Answer the parent's request fully.
- Keep optional next-step offers out of the reply body. The composer offers
  those after your reply.
- Ask one direct question only when Homa truly needs the answer before it can
  continue. End that reply with the question and do not add another offer.
`.trim();

/**
 * Returns reply guidance only when authenticated channel attributes identify
 * the current session as web chat.
 */
export function webModeMarkdown(
  attributes: WebModeAttributes,
): string | null {
  return attributes?.channel === "web" || attributes?.channel === "conversation-request" ? WEB_MODE_MARKDOWN : null;
}

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const markdown = webModeMarkdown(
        ctx.session.auth.current?.attributes as WebModeAttributes,
      );
      return markdown ? defineInstructions({ markdown }) : null;
    },
  },
});
