import { voiceEffectMessageId, type VoiceEffectContext } from "./voice-effects";
import type { VoiceHomaBridgeOutput } from "../../lib/voice/homa-bridge";
import { selectParentVisibleMaterialMessageParts } from "./material-message-parts";

/** A replacement call has no authority over the previous Eve continuation.
 * Announce a receipt, never ask its old follow-up question in the new call. */
export function voiceHandoffNotice(output: VoiceHomaBridgeOutput): string {
  const parts = output.effects.map((effect) => ({
    type: "dynamic-tool", state: "output-available", toolName: effect.toolName, output: effect.output,
  }));
  const ready = output.ok && selectParentVisibleMaterialMessageParts(parts).some((part) =>
    part.status === "final" && part.reviewPass === true,
  );
  return ready
    ? "Your printable is ready. You can open it in our chat."
    : "There is an update from your earlier request in our chat.";
}

/** Route only newly completed results to an explicitly opened replacement
 * call. This neither replays conversation history nor starts a microphone. */
export class VoiceResultHandoff {
  private active: { generation: number; say: (text: string) => void } | null = null;
  private delivered = new Set<string>();

  attach(generation: number, say: (text: string) => void) {
    this.active = { generation, say };
  }

  detach(generation: number) {
    if (this.active?.generation === generation) this.active = null;
  }

  complete(generation: number, context: VoiceEffectContext, output: VoiceHomaBridgeOutput) {
    const id = voiceEffectMessageId(context);
    if (this.delivered.has(id)) return;
    this.delivered.add(id);
    // The originating live conversation owns its own announcement. Once
    // voice is off, the result remains visual and is never queued for replay.
    if (this.active && this.active.generation !== generation) this.active.say(voiceHandoffNotice(output));
  }
}
