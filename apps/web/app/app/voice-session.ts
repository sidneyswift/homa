import type { Experimental_RealtimeServerEvent as RealtimeEvent } from "ai";

import type { VoiceHomaBridgeOutput } from "../../lib/voice/homa-bridge";
import type { VoiceTranscriptLine } from "./voice-transcript";

interface Turn {
  sequence: number;
  role: "user" | "assistant";
  text: string;
  complete: boolean;
  parts: Map<string, string>;
}

interface VoiceToolCall {
  toolCallId: string;
  toolName: string;
  args: unknown;
}

interface Dependencies {
  fetch: typeof fetch;
  onTurn: (line: VoiceTranscriptLine) => void;
  onError: (message: string) => void;
  onEffects?: (output: VoiceHomaBridgeOutput, context: { sessionId: string; sourceSequence: number }) => void;
  transcriptTimeoutMs?: number;
}

const missingTranscript = (): VoiceHomaBridgeOutput => ({
  ok: false,
  spokenReply: "I did not catch your words clearly enough to save that. Please say it once more.",
  effects: [],
});

/** Owns identity across SDK renders. SDK 7 inserts late user transcripts into
 * its message array; array positions cannot identify a durable source turn.
 * Audio commits and response starts reserve immutable sequence numbers. */
export class WebVoiceSession {
  private turns: Turn[] = [];
  private users = new Map<string, Turn>();
  private responses = new Map<string, Turn>();
  private responseSources = new Map<string, Turn | undefined>();
  private callSources = new Map<string, Turn | undefined>();
  private latestUser: Turn | undefined;
  private sourceWaiters = new Map<Turn, Set<() => void>>();
  private calls = new Map<string, Promise<VoiceHomaBridgeOutput>>();
  private sourceCalls = new Map<Turn, Promise<VoiceHomaBridgeOutput>>();
  private bridgeQueue: Promise<unknown> = Promise.resolve();
  private homaSessionState: VoiceHomaBridgeOutput["sessionState"];
  private cursor = 0;
  private writes = new Map<number, Promise<void>>();
  private unsaved = new Map<number, Turn>();
  private persistenceQueue: Promise<void> = Promise.resolve();
  private ended = false;

  constructor(readonly sessionId: string, private readonly deps: Dependencies) {}

  private addTurn(role: Turn["role"]): Turn {
    const turn: Turn = {
      sequence: this.turns.length, role, text: "", complete: false, parts: new Map(),
    };
    this.turns.push(turn);
    return turn;
  }

  private wake(turn: Turn) {
    this.sourceWaiters.get(turn)?.forEach((resolve) => resolve());
    this.sourceWaiters.delete(turn);
  }

  /** Runs synchronously before the SDK's onToolCall effect. */
  receive(event: RealtimeEvent): void {
    if (this.ended) return;
    switch (event.type) {
      case "audio-committed": {
        if (!event.itemId) break;
        let turn = this.users.get(event.itemId);
        if (!turn) {
          turn = this.addTurn("user");
          this.users.set(event.itemId, turn);
        }
        this.latestUser = turn;
        break;
      }
      case "input-transcription-completed": {
        const turn = this.users.get(event.itemId);
        // A transcript without its audio commit has no verified ordering.
        if (!turn || turn.complete) break;
        turn.text = event.transcript.trim();
        turn.complete = true;
        this.wake(turn);
        break;
      }
      case "custom": {
        if (event.rawType !== "conversation.item.input_audio_transcription.failed") break;
        const raw = event.raw as { item_id?: unknown } | null;
        const turn = typeof raw?.item_id === "string" ? this.users.get(raw.item_id) : undefined;
        if (turn && !turn.complete) {
          turn.complete = true;
          this.wake(turn);
          this.deps.onError("I could not transcribe that part. Please say it again if you want me to save it.");
        }
        break;
      }
      case "response-created": {
        if (!this.responses.has(event.responseId)) {
          this.responses.set(event.responseId, this.addTurn("assistant"));
          this.responseSources.set(event.responseId, this.latestUser);
        }
        break;
      }
      case "function-call-arguments-done": {
        if (!this.callSources.has(event.callId)) {
          this.callSources.set(event.callId, this.responseSources.get(event.responseId));
        }
        break;
      }
      case "text-delta":
      case "audio-transcript-delta":
      case "text-done":
      case "audio-transcript-done": {
        const turn = this.responses.get(event.responseId);
        if (!turn || turn.complete) break;
        const prior = turn.parts.get(event.itemId) ?? "";
        const text = event.type === "audio-transcript-done" ? event.transcript ?? prior
          : event.type === "text-done" ? event.text ?? prior
          : prior + event.delta;
        turn.parts.set(event.itemId, text);
        turn.text = [...turn.parts.values()].join("\n").trim();
        break;
      }
      case "response-done": {
        const turn = this.responses.get(event.responseId);
        if (turn) turn.complete = true;
        break;
      }
    }
    this.flush();
  }

  private flush() {
    while (this.cursor < this.turns.length) {
      const turn = this.turns[this.cursor];
      if (!turn.complete) break;
      this.cursor += 1;
      if (!turn.text) continue;
      this.deps.onTurn({ role: turn.role, text: turn.text, sessionId: this.sessionId, sequence: turn.sequence });
      this.save(turn);
    }
  }

  private save(turn: Turn) {
    if (this.writes.has(turn.sequence)) return;
    this.unsaved.set(turn.sequence, turn);
    const write = this.persistenceQueue.then(async () => {
      // The privacy guard needs a saved user turn before assigning an
      // assistant turn to this adult. Hold later writes if an earlier save
      // failed, rather than accepting an assistant receipt that stays hidden.
      if ([...this.unsaved.keys()].some((sequence) => sequence < turn.sequence)) return;
      // Only the transcript endpoint is retried. Its immutable session/turn
      // key is idempotent; a bridge request can perform family mutations.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await this.deps.fetch("/api/voice/realtime/turn", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({
              sessionId: this.sessionId, sequence: turn.sequence,
              role: turn.role, content: turn.text,
            }),
          });
          const body = await response.json();
          if (response.ok && body?.ok === true) {
            this.unsaved.delete(turn.sequence);
            return;
          }
        } catch { /* Retry the same transcript key once. */ }
      }
      this.deps.onError("Some of this conversation has not saved. Keep this page open and try saving again.");
    }).finally(() => this.writes.delete(turn.sequence));
    this.writes.set(turn.sequence, write);
    this.persistenceQueue = write;
  }

  private async sourceReady(turn: Turn | undefined): Promise<boolean> {
    if (!turn || this.ended) return false;
    if (turn.complete) return turn.text.length > 0;
    await new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.sourceWaiters.get(turn)?.delete(finish);
        resolve();
      };
      const timer = setTimeout(finish, this.deps.transcriptTimeoutMs ?? 8_000);
      const waiters = this.sourceWaiters.get(turn) ?? new Set();
      waiters.add(finish);
      this.sourceWaiters.set(turn, waiters);
    });
    return !this.ended && turn.complete && turn.text.length > 0;
  }

  runTool(call: VoiceToolCall): Promise<VoiceHomaBridgeOutput> {
    const existing = this.calls.get(call.toolCallId);
    if (existing) return existing;
    // Capture now. A second audio commit cannot retarget a queued call.
    const source = this.callSources.get(call.toolCallId);
    // Every bridge call forwards the complete utterance to Homa. Multiple
    // provider calls for that utterance must share its one workflow receipt.
    const sourceCall = source && this.sourceCalls.get(source);
    if (sourceCall) {
      this.calls.set(call.toolCallId, sourceCall);
      return sourceCall;
    }
    const ready = this.sourceReady(source);
    const result = this.bridgeQueue.then(async () => {
      if (!(await ready) || !source || this.ended) return missingTranscript();
      try {
        const response = await this.deps.fetch("/api/voice/realtime/tool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(300_000),
          body: JSON.stringify({
            name: call.toolName, args: call.args,
            sessionId: this.sessionId,
            sourceSequence: source.sequence, sourceText: source.text,
            homaSessionState: this.homaSessionState,
          }),
        });
        const body = await response.json();
        const output = body?.output as VoiceHomaBridgeOutput | undefined;
        if (!response.ok || typeof output?.ok !== "boolean" || typeof output.spokenReply !== "string" || !Array.isArray(output.effects)) {
          throw new Error("No bridge receipt");
        }
        if (output.sessionState) this.homaSessionState = output.sessionState;
        this.deps.onEffects?.(output, { sessionId: this.sessionId, sourceSequence: source.sequence });
        return output;
      } catch {
        // A lost receipt does not prove that a dispatched mutation failed.
        this.deps.onError("I lost the confirmation for that request. Check your records before trying it again.");
        return {
          ok: false,
          spokenReply: "I lost the confirmation for that request. Please check your records before trying it again.",
          effects: [],
        };
      }
    });
    this.calls.set(call.toolCallId, result);
    if (source) this.sourceCalls.set(source, result);
    this.bridgeQueue = result;
    return result;
  }

  /** Stop dispatching before disconnecting. Already dispatched work may still
   * finish; ending audio cannot truthfully cancel a server-side mutation. */
  async finish(): Promise<boolean> {
    this.ended = true;
    for (const turn of this.turns) {
      if (!turn.complete && turn.role === "user") {
        this.deps.onError("The last words had not finished transcribing when the conversation ended.");
      }
      turn.complete = true;
      this.wake(turn);
    }
    this.flush();
    await Promise.all([...this.writes.values()]);
    return this.unsaved.size === 0;
  }

  async retrySave(): Promise<boolean> {
    for (const turn of this.unsaved.values()) this.save(turn);
    await Promise.all([...this.writes.values()]);
    return this.unsaved.size === 0;
  }
}
