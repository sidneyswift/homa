import { defineDynamic, defineInstructions } from "eve/instructions";

type IosModeAttributes =
  | {
      channel?: string;
    }
  | undefined;

/**
 * The base instructions' "what the parent sees" section (instructions.md)
 * names web-only paths (/app, /app/settings): true on web, meaningless on
 * the phone app, which has no URL bar. Caught 2026-07-29 when a family
 * asked "what does Homa cost" in the iOS app and got "I don't actually
 * have access to Homa's billing and pricing details... /app/settings",
 * a real answer for nobody: the price is a known, ruled fact (unlike an
 * invented number), and /app/settings does not exist on this channel.
 */
export const IOS_MODE_MARKDOWN = `
## You are replying in the iOS app

- There is no /app or /app/settings here, this is a phone app, not a
  browser. Account and subscription live in the app's own Settings screen
  (reached from Today's header, or from the paywall if she is not yet a
  member), never a URL.
- Homa on iOS is $4.75 a week after a free 7-day trial, billed through
  Apple. If she asks what it costs or how to manage or cancel it, say
  that plainly and point her to Settings; never say you cannot access
  billing details, you know this one.
- Report links, the binder, and the planner still open the same way; only
  the account chrome differs from web.
`.trim();

/**
 * Returns reply guidance only when authenticated channel attributes
 * identify the current session as the iOS app (x-homa-channel: mobile,
 * apps/web/agent/channels/eve.ts).
 */
export function iosModeMarkdown(
  attributes: IosModeAttributes,
): string | null {
  return attributes?.channel === "mobile" ? IOS_MODE_MARKDOWN : null;
}

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const markdown = iosModeMarkdown(
        ctx.session.auth.current?.attributes as IosModeAttributes,
      );
      return markdown ? defineInstructions({ markdown }) : null;
    },
  },
});
