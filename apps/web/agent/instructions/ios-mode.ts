import { defineDynamic, defineInstructions } from "eve/instructions";

type IosModeAttributes =
  | {
      channel?: string;
      voiceBridge?: string;
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
  browser. Account and subscription live in the app's own Settings screen:
  the top-left menu opens the drawer, her account row at its bottom opens
  Settings (the paywall links there too before she is a member), never a
  URL.
- Homa on iOS is $9.99 a month or $99.99 a year, billed through Apple. If she asks what it
  costs or how to manage or cancel it, say that plainly and point her to
  Settings; never say you cannot access billing details, you know this
  one.
- Report links, the binder, and the planner still open the same way; only
  the account chrome differs from web.
`.trim();

export const IOS_VOICE_BRIDGE_MARKDOWN = `
## You are fulfilling a live voice request

- The realtime layer handles audio only. You are the full Homa agent with the
  same fleet skills and authenticated tools as mobile chat. Use them normally.
- Your final reply will be spoken aloud exactly as written. Keep it to one to
  three short sentences, with no markdown, headings, or lists.
- Tool results are the only truth about completed actions. Name a result as
  complete only when its tool output says it succeeded.
- Native iOS renders your authored tool results as planner, printable,
  question, hours, or receipt overlays. If you open or make something, point
  to what is now on screen in one short phrase.
- Live voice has no photo picker, details form, or checklist screen. Do not
  call ask_for_photo, ask_for_details, or start_checklist here. Ask one short
  spoken question, use ask_user_questions, or ask her to switch to chat and
  attach a photo when the photo itself is essential.
- Never refuse a capability because this is voice. If a tool or skill is
  unavailable for its own real reason, say that reason plainly.
`.trim();

/**
 * Returns reply guidance only when authenticated channel attributes
 * identify the current session as the iOS app (x-homa-channel: mobile,
 * apps/web/agent/channels/eve.ts).
 */
export function iosModeMarkdown(
  attributes: IosModeAttributes,
): string | null {
  if (attributes?.channel !== "mobile") return null;
  return attributes.voiceBridge === "true"
    ? `${IOS_MODE_MARKDOWN}\n\n${IOS_VOICE_BRIDGE_MARKDOWN}`
    : IOS_MODE_MARKDOWN;
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
