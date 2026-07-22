import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

/**
 * The facts card: when Homa needs a small set of exact facts, she puts
 * up the fields instead of asking for them in a paragraph.
 *
 * This is the deterministic half of the card loop
 * (plans/2026-07-21-chat-first-onboarding.md §1). Asking "what should I
 * call you, and which state are you in, and tell me about your child" in
 * prose is what makes a conversation feel like a form: three questions
 * to hold in her head, typed back in an order she has to invent, and
 * every one of them a chance to answer half. The card takes them in one
 * pass, saves as she fills it, and costs no model turn to do it.
 *
 * One input per question (founder rule, 2026-07-22): the card asks for
 * one thing at a time, whatever it is collecting. So a card is never
 * "the form for X", it is a short run of single questions, and the
 * number of them is not something to mention to her.
 *
 * It is a UI contract and nothing else. No family data is read, nothing
 * is written, and no familyId is touched here: the card posts to its own
 * authenticated route, exactly as the checklist's taps already do. Same
 * pattern as ask_for_photo and ask_user_questions.
 *
 * Web only, structurally. On SMS and the server-originated channels
 * there is no card to render, so the tool does not exist rather than
 * refusing and costing a call to find out. Those channels keep the plain
 * ask that instructions.md already asks for.
 */

const NO_CARD_CHANNELS = new Set(["sms", "email", "dispatch", "agent-job", "subject_lesson"]);

const askForDetails = defineTool({
  description:
    "Put up a small card of fields for facts you need exactly right, instead of asking for them in a paragraph. Use 'family_basics' once, early, for what to call her and which state she is in. Use 'child' for one child Homa does not have yet, whether she brought the child up or you are turning to her kids for the first time. Say who the card is about in your own words BEFORE you call it: the card asks one question at a time and carries no heading, so a child card sent cold asks about a person nobody has named. She fills it in and it saves itself; you will hear what she entered. Do not ask for the same facts in text as well, and do not use this for anything you can simply ask about in conversation.",
  inputSchema: z.object({
    kind: z
      .enum(["family_basics", "child"])
      .describe(
        "family_basics: what to call her, and her state. child: one child's name and birthday.",
      ),
    intro: z
      .string()
      .max(120)
      .optional()
      .describe(
        "One short line above the fields that says WHO the card is about, and nothing else. Skip it when the words you just wrote already said who: two setups for one card is worse than none, and family_basics never needs one because its fields say 'you'. Never preview what the card asks for. It asks one question at a time and shows them itself, so a line like 'What's their name and birthday?' both spoils the card and asks for two things at once.",
      ),
  }),
  async execute(input) {
    return {
      asked: true,
      kind: input.kind,
      intro: input.intro ?? null,
      note:
        "END TURN. Emit no text after this tool call. The fields are visible to her and the card saves itself; her entries arrive as the next message. Any sentence here is either narrating a card she can already see or asking for what it already asks. If you had something to say, it belonged BEFORE this call: a card with nothing above it reads as a form, not a conversation.",
    };
  },
});

export default defineDynamic({
  events: {
    "turn.started": (_event, ctx) => {
      const adapterName = ctx.channel.metadata?.adapterName;
      if (adapterName === "telnyx" || ctx.channel.kind === "channel:telnyx") {
        return null;
      }
      const channel = (
        ctx.session.auth.current?.attributes as { channel?: string } | undefined
      )?.channel;
      if (channel !== undefined && NO_CARD_CHANNELS.has(channel)) return null;
      return askForDetails;
    },
  },
});
