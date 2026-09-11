import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { LiveSessionDiagnostics, LiveVoiceConversation } from "../../../../packages/core/src/live-voice";

// Exercise the actual clients with controllable transports, not a second
// implementation of their lifecycle. No microphone or provider is contacted.
async function mount(native: boolean) {
  const effects: (() => unknown)[] = [];
  const states: unknown[] = [];
  const notices: string[] = [];
  const logs: unknown[] = [];
  let stopped = false;
  let peerClosed = false;
  let created = 0;
  let appState: ((state: string) => void) | undefined;
  const track = { stop: () => { stopped = true; }, enabled: true };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const channel = {
    readyState: "open", onmessage: undefined as ((event: { data: string }) => void) | undefined,
    onclose: undefined as (() => void) | undefined, onerror: undefined as (() => void) | undefined,
    send: (raw: string) => { if (JSON.parse(raw).type === "session.close") receive({ type: "session.closed", usage: { seconds: 12 }, reason: "close_requested" }); },
    close: () => { channel.readyState = "closed"; channel.onclose?.(); },
  };
  const receive = (event: unknown) => channel.onmessage?.({ data: JSON.stringify(event) });
  class Peer {
    constructor() { created++; }
    iceGatheringState = "complete";
    localDescription = { sdp: "v=0" };
    addTrack() {}
    createDataChannel() { return channel; }
    async createOffer() { return { sdp: "v=0" }; }
    async setLocalDescription() {}
    async setRemoteDescription() {}
    getReceivers() { return []; }
    close() { peerClosed = true; }
  }
  const react = {
    useRef: (current: unknown) => ({ current }),
    useState: (initial: unknown) => [initial, (value: unknown) => states.push(value)],
    useEffect: (effect: () => unknown) => effects.push(effect),
    useCallback: (callback: unknown) => callback,
  };
  const exports = {} as { useVoiceSession: () => { start: () => void }; VoiceMode: (props: Record<string, unknown>) => unknown };
  const source = native ? "apps/mobile/src/features/voice/use-voice-session.ts" : "apps/web/app/app/voice-mode.tsx";
  const code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const fetcher = async (path: string) => path.endsWith("/session") ? Response.json({ sessionId: "fixture", sdp: "answer", closeToken: "fixture" }) : Response.json({ ok: true });
  runInNewContext(code, {
    exports, crypto: { randomUUID: () => "fixture" }, AbortSignal, Response,
    setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
    fetch: fetcher, navigator: { mediaDevices: { getUserMedia: async () => stream } },
    RTCPeerConnection: Peer, Audio: class { pause() {} async play() {} },
    console: { info: (...args: unknown[]) => logs.push(args) },
    require: (name: string) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx: () => ({}), jsxs: () => ({}) };
      if (name === "@homa/core") return { LiveSessionDiagnostics, LiveVoiceConversation, waitForLiveIce: async () => {} };
      if (name === "react-native") return { AppState: { addEventListener: (_type: string, listener: (state: string) => void) => { appState = listener; return { remove() {} }; } } };
      if (name === "react-native-webrtc") return { RTCPeerConnection: Peer, RTCSessionDescription: class {}, mediaDevices: { getUserMedia: async () => stream } };
      if (name.endsWith("/homa-voice-audio")) return { prepareVoiceAudioForConversation: async () => {} };
      if (name.endsWith("/env")) return { env: { apiUrl: "https://fixture.test" }, EVE_CHANNEL_HEADER: {} };
      if (name.endsWith("/supabase")) return { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "fixture" } } }) } } };
      if (name.endsWith("/realtime-tool-effects")) return { messagesFromVoiceToolEffects: () => [] };
      return {};
    },
  });
  if (native) {
    const session = exports.useVoiceSession(); effects.forEach((effect) => effect()); session.start();
  } else {
    exports.VoiceMode({ onTurn() {}, onClose() {}, onEffects() {}, onNotice: (text: string) => notices.push(text), onActiveChange() {}, onWorking() {}, onAnnouncementChange() {} });
    effects.forEach((effect) => effect());
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { receive, channel, states, notices, logs, appState: (state: string) => appState?.(state), created: () => created, stopped: () => stopped, peerClosed: () => peerClosed };
}

for (const native of [false, true]) {
  const label = native ? "native" : "web";
  test(`${label}: a rejected update keeps the microphone and session available`, async () => {
    const f = await mount(native);
    f.receive({ type: "session.started" });
    f.receive({ type: "error", error: { code: null, client_event_id: "unrecognized" } });
    assert.equal(f.stopped(), false);
    assert.equal(f.peerClosed(), false);
    f.receive({ type: "session.closed", usage: { seconds: 20 }, reason: "expired" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(f.stopped(), true);
    assert.equal(f.peerClosed(), true);
    assert.match(String(f.logs), /"finalized":true/);
  });
  for (const kind of ["onclose", "onerror"] as const) {
    test(`${label}: ${kind} ends a misleading listening state`, async () => {
      const f = await mount(native);
      f.receive({ type: "session.started" });
      f.channel[kind]?.();
      await new Promise((resolve) => setTimeout(resolve, 10));
      assert.equal(f.stopped(), true);
      assert.equal(f.peerClosed(), true);
      assert.ok(f.states.includes(native ? "failed" : true));
    });
  }
}


test("returning to the native app does not reopen the microphone or create a paid session", async () => {
  const f = await mount(true);
  f.receive({ type: "session.started" });
  f.appState("background");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(f.stopped(), true);
  f.appState("active");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(f.created(), 1);
  assert.ok(f.states.includes("paused"));
});
