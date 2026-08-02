import { readFileSync } from "node:fs";
import path from "node:path";

import { generateText, Output } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { loadFamilyContextPinned, renderFamilyContext } from "../family-context";
import { gatewayAttribution, recordModelUsage } from "../model-usage";
import {
  PROMPT_SUGGESTIONS_PROMPT_VERSION,
  createPromptSuggestionAssistantFingerprint,
  createFallbackPromptSuggestionSet,
  type PromptSuggestionRequest,
  type PromptSuggestionSet,
} from "./contract";

export interface GeneratePromptSuggestionSetInput {
  familyId: string;
  request: PromptSuggestionRequest;
}

export type PromptSuggestionProducer = (
  input: GeneratePromptSuggestionSetInput,
) => Promise<unknown>;

export const PROMPT_SUGGESTION_SCENARIOS = [
  "email_worksheet",
  "email_word_cards",
  "email_summary",
  "revise_material",
  "create_reading_game",
  "create_math_game",
  "create_animal_game",
  "create_counting_game",
  "create_short_passage",
  "create_practice_page",
  "explain_next",
  "compare_options",
  "show_next_skill",
  "email_hours",
  "email_sources",
  "set_reminder",
  "choose_activity",
] as const;

export type PromptSuggestionScenario =
  (typeof PROMPT_SUGGESTION_SCENARIOS)[number];

export const PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO = {
  email_worksheet: "Email worksheet",
  email_word_cards: "Email word cards",
  email_summary: "Email this summary",
  revise_material: "Revise this page",
  create_reading_game: "Make reading game",
  create_math_game: "Make math game",
  create_animal_game: "Make animal game",
  create_counting_game: "Make counting game",
  create_short_passage: "Make short passage",
  create_practice_page: "Make practice page",
  explain_next: "Explain next step",
  compare_options: "Compare options",
  show_next_skill: "Show next skill",
  email_hours: "Email hours summary",
  email_sources: "Email source summary",
  set_reminder: "Set Homa reminder",
  choose_activity: "Choose one activity",
} as const satisfies Record<PromptSuggestionScenario, string>;

export const promptSuggestionScenarioOutputSchema = z
  .object({
    scenario: z.enum(PROMPT_SUGGESTION_SCENARIOS),
  })
  .strict();

export const PROMPT_SUGGESTION_PRODUCER_SETTINGS = {
  reasoning: "none",
  maxOutputTokens: 1_024,
} as const;

let cachedPromptSuggestionsPrompt: string | null = null;

/** Reads the founder-editable system prompt once per server process. */
function promptSuggestionsPrompt(): string {
  if (cachedPromptSuggestionsPrompt) return cachedPromptSuggestionsPrompt;
  cachedPromptSuggestionsPrompt = readFileSync(
    path.join(process.cwd(), "agent", "prompt-suggestions.md"),
    "utf8",
  );
  return cachedPromptSuggestionsPrompt;
}

async function producePromptSuggestions(
  input: GeneratePromptSuggestionSetInput,
): Promise<unknown> {
  const started = Date.now();
  const model = process.env.HOMA_SUGGESTIONS_MODEL ?? HOMA_MODEL;
  const familyContext = await loadFamilyContextPinned(input.familyId);
  const result = await generateText({
    model,
    ...PROMPT_SUGGESTION_PRODUCER_SETTINGS,
    system: promptSuggestionsPrompt(),
    prompt: [
      "Family context:",
      renderFamilyContext(familyContext),
      "",
      "Bounded conversation JSON:",
      JSON.stringify(input.request.messages),
    ].join("\n"),
    output: Output.object({
      schema: promptSuggestionScenarioOutputSchema,
    }),
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(input.familyId, "chat_suggestions"),
      },
    },
  });

  await recordModelUsage({
    familyId: input.familyId,
    surface: "chat_suggestions",
    channel: "web",
    model,
    modality: "text",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - started,
    resourceKind: "conversation_message",
    resourceId: input.request.assistantMessageId,
  });

  return result.output;
}

export async function generatePromptSuggestionSet(
  input: GeneratePromptSuggestionSetInput,
  producer: PromptSuggestionProducer = producePromptSuggestions,
): Promise<PromptSuggestionSet> {
  const assistantText = input.request.messages.at(-1)?.text ?? "";
  try {
    const produced = await producer(input);
    const parsed = promptSuggestionScenarioOutputSchema.safeParse(produced);
    if (!parsed.success) {
      return createFallbackPromptSuggestionSet(
        input.request.assistantMessageId,
        assistantText,
      );
    }

    return {
      setId: crypto.randomUUID(),
      assistantMessageId: input.request.assistantMessageId,
      assistantMessageFingerprint:
        createPromptSuggestionAssistantFingerprint(assistantText),
      promptVersion: PROMPT_SUGGESTIONS_PROMPT_VERSION,
      source: "model",
      suggestions: [
        PROMPT_SUGGESTION_TEMPLATE_BY_SCENARIO[parsed.data.scenario],
      ],
    };
  } catch {
    // Keep logs content-free because producer errors can echo prompt inputs.
    console.error("Prompt suggestion generation failed; using fallback");
    return createFallbackPromptSuggestionSet(
      input.request.assistantMessageId,
      assistantText,
    );
  }
}
