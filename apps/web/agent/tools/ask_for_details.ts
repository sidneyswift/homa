import { defineDynamic } from "eve/tools";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
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

const askForDetails = defineBoundedTool({
  description:
    "Put up a small card of fields for facts you need exactly right, instead of asking for them in a paragraph. family_basics and homeschool_profile are each asked once, early, in that order; child repeats, once per child, for as many children as she has. Say who the card is about in your own words BEFORE you call it: it asks one question at a time and carries no heading, so a child card sent cold asks about a person nobody has named. She fills it in and it saves itself; you will hear what she entered. If she already typed a child's facts in full, use add_child instead of sending her back through fields she filled in by typing.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    kind: z
      .enum(["family_basics", "homeschool_profile", "child"])
      .describe(
        "family_basics: what to call her, and her state. homeschool_profile: any homeschool approach she follows, fully skippable. child: one child's name and birthday.",
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
      // The sentinel, not "emit no text": the harness never accepts an
      // empty reply (it retries one with a nudge), so a model told to
      // say nothing invents filler instead, and five shipped variants of
      // that filler are enumerated in app/app/assistant-text.ts. The
      // sentinel is the one reply the harness delivers as real silence.
      // And it is honest: the web transcript drops every text part that
      // follows this call (message-parts.tsx, ENDS_THE_TURN), so any
      // words written here cost the parent seconds and are never shown.
      note:
        "The fields are on her screen and the card saves itself. This turn is over: reply to THIS tool result with exactly <eve-empty-delivery/> and nothing else. It is delivered as silence, and nothing written after this call is ever shown to her, so any other reply only costs her seconds; your words belonged BEFORE this call. The sentinel is for finishing this turn only. Her entries will arrive as her next message, and that is a new turn where she is owed your real reaction in words, never the sentinel.",
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
