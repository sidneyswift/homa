import { gateway } from "@ai-sdk/gateway";
import { type LanguageModelMiddleware, wrapLanguageModel } from "ai";

import { HOMA_MODEL, HOMA_REASONING, type HomaTurnModel } from "../agent/model";

/** Eve 0.19 has a static model slot; dispatch from its session-scoped state.
 * Both call modes use the same policy, including research compaction. Never
 * retry on Astra after a research failure: that silently changes the cost.
 */
export function createHomaTurnModel(options: {
  currentModel: () => HomaTurnModel;
  resolveModel?: (id: string) => ReturnType<typeof gateway>;
}) {
  const resolveModel = options.resolveModel ?? gateway;
  const middleware: LanguageModelMiddleware = {
    specificationVersion: "v4",
    async wrapGenerate({ params }) {
      const model = options.currentModel();
      const result = await resolveModel(model).doGenerate({
        ...params,
        reasoning: model === HOMA_MODEL ? HOMA_REASONING : "provider-default",
      });
      // Gateway can omit response.modelId. Without this the SDK labels a
      // Sonnet result with the wrapper's static Astra identity (gh#1209).
      return { ...result, response: { ...result.response, modelId: result.response?.modelId ?? model } };
    },
    async wrapStream({ params }) {
      const model = options.currentModel();
      const result = await resolveModel(model).doStream({
        ...params,
        reasoning: model === HOMA_MODEL ? HOMA_REASONING : "provider-default",
      });
      return { ...result, stream: result.stream.pipeThrough(new TransformStream({
        transform(part, controller) {
          controller.enqueue(part.type === "response-metadata"
            ? { ...part, modelId: part.modelId ?? model }
            : part);
        },
      })) };
    },
  };
  return wrapLanguageModel({ model: resolveModel(HOMA_MODEL), middleware });
}
