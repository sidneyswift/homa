import { defineDynamic, defineInstructions } from "eve/instructions";

/**
 * SMS-mode guidance, injected only for sessions arriving through the
 * Telnyx channel (agent/channels/telnyx.ts). Web sessions get nothing
 * (returning null contributes no instruction block). Detection uses the
 * channel metadata the chat-sdk bridge stamps (adapterName) with the
 * compiler's channel kind as a belt-and-braces fallback.
 */
export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const adapterName = ctx.channel.metadata?.adapterName;
      const isSms =
        adapterName === "telnyx" || ctx.channel.kind === "channel:telnyx";
      if (!isSms) return null;

      const attributes = ctx.session.auth.current?.attributes as
        | { familyId?: string }
        | undefined;
      const linked = Boolean(attributes?.familyId);

      const linkage = linked
        ? `- This number belongs to a Homa family and their family context is
  loaded: use the kids' names and saved facts naturally, same as web
  chat.
- Your memory tools work over text: remember, forget, log_hours,
  update_child_profile, and recall all work here exactly like web chat.
  Save durable facts and log school time the moment they come up.
- An evening text that reads like "here's how today went" IS the
  journal: reply warmly in one or two sentences, save the durable
  bits, and log any school time mentioned. Never recite what you
  saved; one short natural aside covers it.
- Worksheets and emails are not available over text. When one would
  clearly help, offer it for their next web visit ("I'll have a
  counting page ready at thankshoma.com").`
        : `- This phone number is not linked to a family account, so no family
  context is loaded. Answer general homeschool questions warmly from
  your own expertise.
- If the parent asks for something that needs their family workspace
  (worksheets, saved memories, their kids' profiles), say texting can
  be linked from their /settings page at thankshoma.com in one step.`;

      return defineInstructions({
        markdown: `
## You are texting (SMS)

This conversation is happening over text message, not the web app.

- Keep replies short: 1 to 2 sentences, one text bubble. No markdown,
  no headers, no bullet lists, no links unless asked.
${linkage}
- Never send more than one reply per incoming text.
        `.trim(),
      });
    },
  },
});
