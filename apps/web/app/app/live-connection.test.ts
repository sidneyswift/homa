import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { LiveSessionDiagnostics, LiveVoiceConversation } from "../../../../packages/core/src/live-voice";

// Exercise the actual clients with controllable transports, not a second
// implementation of their lifecycle. No microphone or provider is contacted.
async function mount(native: boolean, initialPreferences = { microphoneOn: true, speakerOn: true }) {
  const effects: (() => unknown)[] = [];
  const hookSlots: Array<{ value?: unknown; deps?: unknown[] }> = [];
  let hookIndex = 0;
  const states: unknown[] = [];
  const notices: string[] = [];
  const logs: unknown[] = [];
  let stopped = false;
  let peerClosed = false;
  let created = 0;
  const audioElements: Array<{ muted: boolean }> = [];
  const controller = { current: null as { end: () => Promise<void>; sendText: (text: string) => boolean } | null };
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
    useRef: (current: unknown) => {
      const slot = hookSlots[hookIndex++] ??= { value: { current } };
      return slot.value;
    },
    useState: (initial: unknown) => {
      const slot = hookSlots[hookIndex++] ??= { value: initial };
      return [slot.value, (value: unknown) => { slot.value = value; states.push(value); }];
    },
    useEffect: (effect: () => unknown, deps?: unknown[]) => {
      const index = hookIndex++;
      const prior = hookSlots[index];
      if (!deps || !prior || !prior.deps || deps.some((dep, at) => dep !== prior.deps![at])) effects.push(effect);
      hookSlots[index] = { deps };
    },
    useCallback: (callback: unknown) => callback,
    useImperativeHandle: (ref: { current?: unknown } | undefined, create: () => unknown) => { if (ref) ref.current = create(); },
  };
  const exports = {} as { useVoiceSession: () => { start: () => void }; VoiceMode: (props: Record<string, unknown>) => unknown };
  const source = native ? "apps/mobile/src/features/voice/use-voice-session.ts" : "apps/web/app/app/voice-mode.tsx";
  const code = ts.transpileModule(readFileSync(source, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const fetcher = async (path: string) => path.endsWith("/session") ? Response.json({ sessionId: "fixture", sdp: "answer", closeToken: "fixture" }) : Response.json({ ok: true });
  runInNewContext(code, {
    exports, crypto: { randomUUID: () => "fixture" }, AbortSignal, Response,
    setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {},
    fetch: fetcher, navigator: { mediaDevices: { getUserMedia: async () => stream } },
    RTCPeerConnection: Peer, Audio: class { muted = false; constructor() { audioElements.push(this); } pause() {} async play() {} },
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
  const renderWeb = (preferences = initialPreferences) => {
    hookIndex = 0;
    exports.VoiceMode({ ...preferences, controlsRef: controller, onTurn() {}, onClose() {}, onEffects() {}, onNotice: (text: string) => notices.push(text), onActiveChange() {}, onWorking() {}, onAnnouncementChange() {} });
    effects.splice(0).forEach(effect => effect());
  };
  if (native) {
    const session = exports.useVoiceSession(); effects.forEach((effect) => effect()); session.start();
  } else {
    renderWeb();
  }
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { receive, channel, states, notices, logs, renderWeb, track, audioElements, controller, appState: (state: string) => appState?.(state), created: () => created, stopped: () => stopped, peerClosed: () => peerClosed };
}

test("web audio preferences change the live resources without reconnecting", async () => {
  const f = await mount(false, { microphoneOn: false, speakerOn: false });
  assert.equal(f.track.enabled, false);
  assert.equal(f.audioElements[0].muted, true);
  f.receive({ type: "session.started" });
  f.renderWeb({ microphoneOn: true, speakerOn: false });
  assert.equal(f.track.enabled, true);
  assert.equal(f.audioElements[0].muted, true);
  f.renderWeb({ microphoneOn: false, speakerOn: true });
  assert.equal(f.track.enabled, false);
  assert.equal(f.audioElements[0].muted, false);
  assert.equal(f.created(), 1);
  assert.equal(f.stopped(), false);
  await f.controller.current!.end();
  assert.equal(f.stopped(), true);
  assert.equal(f.peerClosed(), true);
});

test("web controller rejects typing before connection and after end", async () => {
  const f = await mount(false);
  assert.equal(f.controller.current!.sendText("hello"), false);
  f.receive({ type: "session.started" });
  f.renderWeb();
  assert.equal(f.controller.current!.sendText(""), false);
  await f.controller.current!.end();
  f.renderWeb();
  assert.equal(f.controller.current!.sendText("hello"), false);
});

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
      if (kind === "onclose") f.channel.close();
      else { f.channel.send = () => { throw new Error("transport unavailable"); }; f.channel.onerror?.(); }
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
