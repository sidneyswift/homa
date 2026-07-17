import { resolveApiFamily } from "../../../../lib/api-auth";
import {
  createFallbackPromptSuggestionSet,
  promptSuggestionRequestSchema,
} from "../../../../lib/chat-suggestions/contract";
import { generatePromptSuggestionSet } from "../../../../lib/chat-suggestions/generate";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const parsed = promptSuggestionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const suggestionSet = await generatePromptSuggestionSet({
      familyId: auth.familyId,
      request: parsed.data,
    });
    return Response.json(suggestionSet, { headers: NO_STORE_HEADERS });
  } catch {
    return Response.json(
      createFallbackPromptSuggestionSet(
        parsed.data.assistantMessageId,
        parsed.data.messages.at(-1)?.text ?? "",
      ),
      { headers: NO_STORE_HEADERS },
    );
  }
}
