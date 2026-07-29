import { defineDynamic } from "eve/tools";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";

/**
 * The choice card: when Homa genuinely cannot proceed without the
 * parent's call, she asks with tappable options instead of a paragraph
 * of questions. Web chat renders the output as a stepped card, one
 * question on screen at a time (question-card.tsx), and the parent's
 * taps come back as an ordinary message. The Expo app arrives on this
 * same "web" channel and draws its own twin of that card
 * (apps/mobile/src/features/chat/question-card.tsx), so both screens
 * compose the identical answer message.
 *
 * Screens only, on purpose (founder ruling 2026-07-21). The one-question-
 * at-a-time rule that governs progress check-ins came from SMS, where
 * a stack of questions in a text thread is a burden and no card can
 * render anyway. On a screen a short set of real options is lighter
 * than a paragraph, so the cap here is four rather than one.
 *
 * The channel gate is structural, not a refusal: on SMS, email,
 * dispatch, and agent jobs this resolver returns null and the tool does
 * not exist for that turn, so Homa cannot spend a call discovering she
 * should have used words. Those channels keep the plain-text ask that
 * instructions.md already asks for.
 *
 * This is a UI contract only. No family data is read or written and no
 * familyId is touched: the same pattern as ask_for_photo.
 */

/** Channels with no chat surface to host the card. */
const NO_CARD_CHANNELS = new Set(["sms", "email", "dispatch", "agent-job"]);

const optionSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(60)
    .describe(
      'The option as the parent would say it, in sentence case, e.g. "Start with phonics".',
    ),
  description: z
    .string()
    .max(120)
    .optional()
    .describe(
      'One short line on what this choice means for her, e.g. "Short daily sound drills before any reading."',
    ),
});

const questionSchema = z.object({
  header: z
    .string()
    .min(1)
    .max(16)
    .describe(
      'A two or three word chip naming what is being decided, e.g. "Subject" or "Pace".',
    ),
  question: z
    .string()
    .min(1)
    .max(160)
    .describe(
      'The question in plain warm words, e.g. "Where should we start with Maya?"',
    ),
  options: z
    .array(optionSchema)
    .min(2)
    .max(4)
    .describe(
      "Two to four real choices. Every option must be one you can actually act on this turn.",
    ),
  multiSelect: z
    .boolean()
    .optional()
    .describe(
      "True only when more than one option can genuinely be true at once. Leave it out for a normal pick-one.",
    ),
});

const askUserQuestions = defineBoundedTool({
  description:
    'Ask the parent to choose ONLY when the answer is a fact about her household that you cannot research, infer from the family block, or pick well yourself: which child she means when the family has several and she named none, which of two curriculums they own she is asking about. This renders a card with tappable options, one question on screen at a time; her taps come back as an ordinary message. Ask the FEWEST questions that unblock you, usually one, never more than four. Build first and reach for this rarely. When she asks you to make something, make the most sensible version now and offer changes once she can see it, rather than opening a card to spec it first. When she asks what to do, research it and propose one answer. A card returns her question to her unanswered, so it is the wrong move whenever your own judgment could settle it. Never use it for yes/no confirmations, for anything she could answer in a sentence, or to check work you should just do.',
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema: z.object({
    questions: z
      .array(questionSchema)
      .min(1)
      .max(4)
      .describe(
        "One question, unless answering truly needs more. Order them the way she would decide them.",
      ),
  }),
  async execute(input) {
    return {
      asked: true,
      questions: input.questions.map((question) => ({
        header: question.header,
        question: question.question,
        multiSelect: question.multiSelect === true,
        options: question.options.map((option) => ({
          label: option.label,
          description: option.description ?? null,
        })),
      })),
      note: "The card is on screen and she is looking at it. Stop here and wait: her answer arrives as her next message. Do not answer your own question, do not guess an option, and do not ask the same thing again in text below the card.",
    };
  },
});

export default defineDynamic({
  // step.started, never turn.started: a dynamic TOOL resolved on
  // turn.started is persisted as durable metadata and replayed on later
  // steps by looking its execute up in an in-memory step registry. These
  // tools have no bundler-generated step function, so eve registers a
  // fallback into `globalThis` at resolve time, and any later step that
  // lands on a different lambda isolate finds nothing and drops the tool
  // with only a log line. The model then simply does not have it, which
  // reads to the parent as "my tool is not connected" (2026-07-26/27,
  // gh#345). step.started re-resolves live every step and carries the
  // real closure, which is what eve documents for framework tools.
  events: {
    "step.started": (_event, ctx) => {
      // Detection mirrors instructions/sms-mode.ts: the chat-sdk bridge
      // stamps adapterName, with the compiler's channel kind as a
      // belt-and-braces fallback. The auth attribute covers the
      // server-originated channels (email, dispatch, agent jobs).
      const adapterName = ctx.channel.metadata?.adapterName;
      if (adapterName === "telnyx" || ctx.channel.kind === "channel:telnyx") {
        return null;
      }
      const channel = (
        ctx.session.auth.current?.attributes as { channel?: string } | undefined
      )?.channel;
      if (channel !== undefined && NO_CARD_CHANNELS.has(channel)) return null;
      return askUserQuestions;
    },
  },
});
