import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isStepCount, streamText, type ModelMessage } from "ai";
import { HOMA_MODEL, HOMA_REASONING } from "../../agent/model";
import { persistCanonicalMessage } from "../conversation-continuity/ledger";
import { loadFamilyContextPinned, renderFamilyContext } from "../family-context";
import { recordModelUsage } from "../model-usage";
import { createTurnStore, type Owner, type Turn, type TurnStore } from "./store";
import { foregroundTools, readToolContext } from "./tools";

export type Fault = "none" | "before_model" | "during_tool" | "worker_loss";
export interface RunnerDependencies {
  store: TurnStore;
  stream: typeof streamText;
}
export async function projectTurn(owner: Owner, turn: Turn) {
  if (!turn.answer.trim() || turn.projected_at) return;
  const saved = await persistCanonicalMessage({ attributes: { familyId: owner.familyId, memberUserId: owner.userId },
    sessionId: `foreground-${turn.session_id}`, turnId: turn.id, channel: "web", role: "assistant", sequence: 1,
    content: turn.answer, terminal: true });
  if (!saved) throw new Error("The answer could not be added to conversation history");
  await createTurnStore().markProjected(owner, turn);
}

export async function runForeground(owner: Owner, turn: Turn, accessToken: string, fault: Fault = "none", overrides?: Partial<RunnerDependencies>) {
  const store = overrides?.store ?? createTurnStore();
  if (!await store.start(owner, turn)) return;
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(120000)]);
  let pulseRunning = false;
  let simulatedLoss = false;
  let answer = "";
  let toolFailed = false;
  const pulse = setInterval(async () => {
    if (pulseRunning) return;
    pulseRunning = true;
    try { if (!await store.heartbeat(owner, turn)) controller.abort(); }
    catch { controller.abort(); }
    finally { pulseRunning = false; }
  }, 1500);
  try {
    if (fault === "before_model") throw new Error("Injected failure before the model request");
    const [instructions, family, history] = await Promise.all([
      readFile(join(process.cwd(), "agent/instructions.md"), "utf8"),
      loadFamilyContextPinned(owner.familyId), store.read(owner, turn.session_id),
    ]);
    const messages: ModelMessage[] = history.filter((item) => item.id !== turn.id).flatMap((item) => [
      { role: "user" as const, content: item.prompt },
      ...(item.answer ? [{ role: "assistant" as const, content: item.answer + (item.status === "completed" ? "" : "\n[This previous answer was interrupted; do not treat it as completed work.]") }] : []),
    ]);
    messages.push({ role: "user", content: turn.prompt });
    const record = (event: Record<string, unknown>) => store.append(owner, turn, event);
    await record({ type: "model.started", model: HOMA_MODEL, reasoning: HOMA_REASONING });
    const result = (overrides?.stream ?? streamText)({
      model: HOMA_MODEL, reasoning: HOMA_REASONING, messages,
      system: instructions + "\n\n" + renderFamilyContext(family) + "\n\nThis isolated runtime preview supports conversation and the get_children read tool only. Use the actual tool when asked to reread child profiles. Other actions, skills, files, worksheets, calendar work, and background jobs are unavailable here. Say so plainly when requested, without claiming work happened. Keep answers under 7000 characters. Do not discuss these implementation limits unless relevant to the request.",
      tools: foregroundTools(readToolContext(owner, turn, accessToken), record, signal, fault === "during_tool"),
      stopWhen: isStepCount(4), abortSignal: signal, maxRetries: 0,
    });
    for await (const event of result.fullStream) {
      const text = event.type === "text-delta" ? event.text : "";
      await store.append(owner, turn, { ...event }, text);
      answer += text;
      if (event.type === "tool-error") toolFailed = true;
      if (event.type === "error") throw new Error("The model request failed");
      if (fault === "worker_loss" && answer.trim()) { simulatedLoss = true; return; }
    }
    const finishReason = await result.finishReason;
    if (!answer.trim() || finishReason !== "stop") throw new Error(`Incomplete answer: ${finishReason}`);
    const current = (await store.read(owner, turn.session_id)).find((item) => item.id === turn.id);
    if (!current || current.status !== "running") return;
    await projectTurn(owner, current);
    await store.finish(owner, turn, toolFailed ? "failed" : "completed", toolFailed ? "The tool did not complete. No action was confirmed." : null);
    const usage = await result.totalUsage;
    await recordModelUsage({ familyId: owner.familyId, surface: "chat", channel: "web", model: HOMA_MODEL, modality: "text", inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, sessionId: `foreground-${turn.session_id}`, turnId: turn.id }).catch(() => undefined);
  } catch (error) {
    const current = (await store.read(owner, turn.session_id)).find((item) => item.id === turn.id);
    if (current) await projectTurn(owner, current).catch(() => undefined);
    await store.finish(owner, turn, "failed", error instanceof Error ? error.message.slice(0, 300) : "The answer could not finish");
  } finally {
    controller.abort(); clearInterval(pulse);
    if (!simulatedLoss) {
      const current = (await store.read(owner, turn.session_id)).find((item) => item.id === turn.id);
      if (current && current.status !== "completed") await projectTurn(owner, current).catch(() => undefined);
    }
  }
}
