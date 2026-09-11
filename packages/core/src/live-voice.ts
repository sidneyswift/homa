/** GPT Live protocol shared by web and native. Captions are presentation;
 * only a provider delegation or an explicit typed request starts agent work. */
export const LIVE_VOICE_MODEL = "gpt-live-1";
export const LIVE_VOICE_NAME = "gleam";

export interface LiveCaption {
  role: "user" | "assistant";
  text: string;
  sessionId: string;
  sequence: number;
}
interface Fragment { text: string; start: number; end: number }
interface Row extends LiveCaption { fragments: Fragment[]; sealed: boolean; generation: number; from: number; until: number }
export interface LiveBridgeOutput {
  ok: boolean;
  spokenReply: string;
  effects: unknown[];
  sessionState?: unknown;
}
interface Dependencies {
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  send: (event: Record<string, unknown>) => void;
  onCaption: (caption: LiveCaption) => void;
  onEffects: (output: LiveBridgeOutput, context: { sessionId: string; sourceSequence: number }) => LiveBridgeOutput | void;
  onError: (message: string) => void;
  onWorking: (working: boolean, context: { sessionId: string; sourceSequence: number }) => void;
  activeObject?: () => unknown;
  transcriptDelayMs?: number;
}
const failure = (): LiveBridgeOutput => ({ ok: false, spokenReply: "I could not confirm that request. Please check the chat before trying it again.", effects: [] });

/** Each append is capped below the documented 500-token limit even for
 * Unicode: a byte-level tokenizer cannot use more tokens than UTF-8 bytes. */
export function liveCommentary(content: string, delegationId: string | null): Record<string, unknown>[] {
  const chunks: string[] = [];
  let chunk = "";
  let bytes = 0;
  for (const character of content) {
    const point = character.codePointAt(0)!;
    const size = point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
    if (bytes + size > 400) { chunks.push(chunk); chunk = ""; bytes = 0; }
    chunk += character;
    bytes += size;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((text) => ({ type: "session.commentary.append", delegation_id: delegationId, content: text }));
}

export function liveGreeting(): Record<string, unknown> {
  return { type: "session.instructions.append", delegation_id: null,
    content: "Greet the parent now in English with one warm, short question about their homeschool day, then listen. Do not wait for them to speak first." };
}

export class LiveVoiceConversation {
  private rows: Row[] = [];
  private seen = new Set<string>();
  private delegations = new Map<string, Promise<void>>();
  private queue: Promise<void> = Promise.resolve();
  private saves: Promise<void> = Promise.resolve();
  private unsaved = new Map<number, Row>();
  private sessionState: unknown;
  private ended = false;
  private pendingWork = 0;
  private eventNumber = 0;
  private generation = 0;
  private greeted = false;
  private sourceOffset = -1;

  constructor(readonly sessionId: string, private readonly deps: Dependencies) {}

  private send(event: Record<string, unknown>) {
    if (!this.ended) this.deps.send({ ...event, event_id: `${this.sessionId}-${this.eventNumber++}` });
  }

  private row(role: Row["role"], start = 0, end = start): Row {
    const rows = this.rows.filter((row) => row.role === role && row.generation === this.generation);
    const current = rows.filter((row) => !row.sealed && row.from <= start && start < row.until)
      .sort((a, b) => b.from - a.from)[0];
    let from = start;
    if (current) {
      const lastEnd = Math.max(...current.fragments.map((part) => part.end));
      // Only a completed, non-overlapping exchange divides a caption. A
      // backchannel during ongoing speech leaves both speakers' rows open.
      const reply = this.rows.filter((row) => row.role !== role && row.generation === this.generation)
        .flatMap((row) => row.fragments)
        .filter((part) => part.start >= lastEnd && part.end <= start)
        .sort((a, b) => b.end - a.end)[0];
      if (!reply) return current;
      from = reply.end;
      current.until = from;
    } else {
      // Earlier transcript delivery can precede the first fragment we saw.
      const first = rows[0];
      if (first && !first.sealed && end <= first.from) { first.from = start; return first; }
    }
    const row: Row = { role, text: "", fragments: [], sealed: false,
      generation: this.generation, from, until: Infinity,
      sessionId: this.sessionId, sequence: this.rows.length };
    this.rows.push(row);
    return row;
  }

  private splitForLateReply(role: Row["role"], reply: Fragment) {
    for (const row of [...this.rows]) {
      if (row.sealed || row.role === role || row.generation !== this.generation) continue;
      const before = row.fragments.filter((part) => part.end <= reply.start);
      const after = row.fragments.filter((part) => part.start >= reply.end);
      // A reply arriving late may sit between two already visible utterances.
      // Revise only unfrozen captions; overlapping speech stays together.
      if (!before.length || !after.length || before.length + after.length !== row.fragments.length) continue;
      row.fragments = before;
      row.until = reply.end;
      this.publish(row);
      const next = this.row(row.role, after[0].start, after[0].end);
      next.fragments.push(...after);
      this.publish(next);
    }
  }

  private publish(row: Row) {
    row.fragments.sort((a, b) => a.start - b.start || a.end - b.end);
    row.text = row.fragments.map((part) => part.text).join("");
    this.deps.onCaption({ role: row.role, text: row.text, sessionId: row.sessionId, sequence: row.sequence });
  }

  private seal(row: Row) {
    if (row.sealed) return;
    row.sealed = true;
    if (!row.text.trim()) return;
    this.unsaved.set(row.sequence, row);
    this.saves = this.saves.then(() => this.savePending());
  }

  private async savePending() {
    for (const [sequence, row] of [...this.unsaved].sort(([a], [b]) => a - b)) {
      if (this.rows.some((prior) => prior.sequence < sequence && !prior.sealed)) return;
      let saved = false;
      for (let attempt = 0; attempt < 2 && !saved; attempt++) {
        try {
          const response = await this.deps.fetch("/api/voice/realtime/turn", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: this.sessionId, sequence, role: row.role, content: row.text }),
            signal: AbortSignal.timeout(10_000),
          });
          saved = response.ok && (await response.json()).ok === true;
        } catch { /* Only immutable transcript writes are safe to retry. */ }
      }
      if (!saved) { this.deps.onError("Some of this conversation has not saved. Keep Homa open and try saving again."); return; }
      this.unsaved.delete(sequence);
    }
  }

  receive(value: unknown): void {
    if (this.ended || !value || typeof value !== "object") return;
    const event = value as Record<string, unknown>;
    if (typeof event.event_id === "string") {
      if (this.seen.has(event.event_id)) return;
      this.seen.add(event.event_id);
    }
    if (event.type === "session.started") {
      if (!this.greeted) { this.greeted = true; this.send(liveGreeting()); }
      else this.send({ type: "session.thinking.append", delegation_id: null, content: "The audio connection has resumed after a pause. Wait for the parent; do not greet again. Earlier spoken context is not available in this audio session. Delegate follow-up requests to the Homa backend, which retains the ongoing agent session. Ask for clarification when a reference remains unclear." });
      return;
    }
    if (event.type === "session.input_transcript.delta" || event.type === "session.output_transcript.delta") {
      if (typeof event.delta !== "string" || typeof event.start_ms !== "number" || typeof event.end_ms !== "number"
        || !Number.isFinite(event.start_ms) || !Number.isFinite(event.end_ms) || event.start_ms < 0 || event.end_ms < event.start_ms) return;
      const role = event.type === "session.input_transcript.delta" ? "user" : "assistant";
      const row = this.row(role, event.start_ms, event.end_ms);
      const fragment = { text: event.delta, start: event.start_ms, end: event.end_ms };
      row.fragments.push(fragment);
      this.publish(row);
      this.splitForLateReply(role, fragment);
      if (role === "user" && event.start_ms <= this.sourceOffset) this.seal(row);
      return;
    }
    if (event.type === "session.delegation.created") {
      const delegation = event.delegation as { id?: unknown; target?: unknown } | undefined;
      if (delegation?.target !== "client" || typeof delegation.id !== "string" || typeof event.offset_ms !== "number" || !Number.isFinite(event.offset_ms)) return;
      const id = delegation.id;
      if (this.delegations.has(id)) return;
      const offset = event.offset_ms;
      const generation = this.generation;
      const activeObject = this.deps.activeObject?.();
      // Allow bounded delivery skew. The timestamp cutoff, not this delay,
      // decides which words belong to the request. Later words remain pending.
      const ready = new Promise<void>((resolve) => setTimeout(resolve, this.deps.transcriptDelayMs ?? 350));
      // Capture the source after delivery skew, independently of a slow
      // earlier backend job. Later conversation cannot replace this request.
      const captured = ready.then(() => {
        if (this.ended || generation !== this.generation) return;
        const row = this.rows.filter((item) => item.role === "user" && !item.sealed
          && item.generation === generation
          && item.fragments.some((part) => part.start > this.sourceOffset && part.start <= offset))
          .sort((a, b) => b.from - a.from)[0];
        if (!row) return;
        const included = row.fragments.filter((part) => part.start <= offset);
        const later = row.fragments.filter((part) => part.start > offset);
        row.fragments = included;
        this.publish(row);
        // Older caption rows remain history, never fresh permission to act.
        for (const prior of this.rows) {
          if (prior.generation === generation && prior.sequence <= row.sequence
            && prior.fragments.every((part) => part.start <= offset)) this.seal(prior);
        }
        this.sourceOffset = Math.max(this.sourceOffset, offset);
        if (later.length) {
          const next = this.row("user", later[0].start, later[0].end);
          next.fragments = later; this.publish(next);
        }
        return row;
      });
      const job = this.queue.then(async () => {
        const source = await captured;
        if (this.ended || generation !== this.generation) return;
        if (!source) {
          const output = failure();
          this.say(output.spokenReply, id);
          return;
        }
        await this.run(source, id, activeObject);
      });
      this.delegations.set(id, job);
      this.queue = job.catch(() => this.deps.onError("The voice request could not finish. Please check the chat."));
    }
    if (event.type === "error") this.deps.onError("The voice connection could not complete that step. Please restart the conversation.");
  }

  private async run(source: Row, delegationId: string | null, activeObject: unknown) {
    if (!source.text.trim() || source.text.length > 8_000) { this.say("Please ask that again in a shorter request.", delegationId); return; }
    const generation = this.generation;
    this.pendingWork++;
    const context = { sessionId: this.sessionId, sourceSequence: source.sequence };
    this.deps.onWorking(true, context);
    const output = (async (): Promise<LiveBridgeOutput> => {
      try {
        const response = await this.deps.fetch("/api/voice/realtime/tool", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "ask_homa", args: { request: source.text }, sourceText: source.text,
            sourceSequence: source.sequence, sessionId: this.sessionId, homaSessionState: this.sessionState,
            activeObject }),
          signal: AbortSignal.timeout(295_000),
        });
        const body = await response.json();
        const result = body?.output;
        if (!response.ok || typeof result?.ok !== "boolean" || typeof result?.spokenReply !== "string" || !Array.isArray(result?.effects)) return failure();
        this.sessionState = result.sessionState;
        return result;
      } catch { return failure(); }
    })();
    try {
      const result = await output;
      // Every terminal outcome reaches the chat, including an ambiguous
      // transport failure and a result arriving after the microphone closes.
      const display = this.deps.onEffects(result, context) ?? result;
      if (generation === this.generation) this.say(display.spokenReply, delegationId);
    }
    finally { this.pendingWork--; this.deps.onWorking(this.pendingWork > 0, context); }
  }

  say(text: string, delegationId: string | null = null) {
    for (const event of liveCommentary(text, delegationId)) this.send(event);
  }

  sendText(text: string): boolean {
    if (this.ended || !text.trim() || text.length > 8_000) return false;
    const pending = this.rows.slice().reverse().find((row) => row.role === "user" && !row.sealed);
    if (pending) this.seal(pending);
    const row = this.row("user");
    row.fragments = [{ text: text.trim(), start: 0, end: 0 }];
    this.publish(row);
    this.seal(row);
    const generation = this.generation;
    const activeObject = this.deps.activeObject?.();
    this.queue = this.queue.then(async () => { if (!this.ended && generation === this.generation) await this.run(row, null, activeObject); });
    return true;
  }

  async finish(): Promise<boolean> {
    this.ended = true;
    this.generation++;
    for (const row of this.rows) this.seal(row);
    await this.saves;
    return this.unsaved.size === 0;
  }
  resume() { this.ended = false; this.sourceOffset = -1; this.seen.clear(); }
  async retrySave(): Promise<boolean> { await this.saves; await this.savePending(); return this.unsaved.size === 0; }
}

/** ICE gathering finishes before the one-shot server offer exchange. */
export async function waitForLiveIce(complete: () => boolean): Promise<void> {
  const deadline = Date.now() + 8_000;
  while (!complete()) {
    if (Date.now() >= deadline) throw new Error("Voice connection setup timed out.");
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
  }
}
