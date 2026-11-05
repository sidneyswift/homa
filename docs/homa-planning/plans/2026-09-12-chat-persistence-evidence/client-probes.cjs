// Disposable, synthetic probes. Imports application code without network or product writes.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = '/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11';
const fromRoot = createRequire(root + '/package.json');
const { archiveFromServerHistory } = fromRoot('./apps/web/lib/chat-history-model.ts');
const { buildTranscript } = fromRoot('./apps/web/app/app/transcript-days.ts');
const { trimEventsForSave, foldEventsToMessages } = fromRoot('./apps/web/app/app/chat-storage.ts');
const { mergeSavedSessionEvents } = fromRoot('./apps/web/app/app/chat-session-cache.ts');
const { createReattachableEveSession } = fromRoot('./apps/web/app/app/reattachable-eve-session.ts');
const { webSessionBindingDecision, latestTurnSequence } = fromRoot('./apps/web/app/app/web-session-restoration.ts');
const { EveAgentStore, defaultMessageReducer } = fromRoot('./apps/web/node_modules/eve/dist/src/client/index.js');
const turn = n => [
  { type: 'turn.started', data: { turnId: `turn_${n}`, sequence: n } },
  { type: 'message.received', data: { turnId: `turn_${n}`, sequence: n, message: `question ${n}` } },
  { type: 'message.completed', data: { turnId: `turn_${n}`, stepIndex: 0, message: `reply ${n}` } },
  { type: 'turn.completed', data: { turnId: `turn_${n}`, sequence: n } },
  { type: 'session.waiting', data: { sequence: n } },
];
async function main() {
  const row = (id, sessionId, role, atMs) => ({ id, sessionId, turnId: 'turn_0', role, atMs, content: `${sessionId} ${role}`, channel: 'web', modality: 'text' });
  const payload = { messages: [row('a-u', 'yesterday', 'user', 1000), row('a-a', 'yesterday', 'assistant', 2000), row('b-u', 'today', 'user', 3000), row('b-a', 'today', 'assistant', 4000)], materials: [] };
  const remaining = archiveFromServerHistory(payload, foldEventsToMessages(turn(0))).map(x => x.message.id);
  assert.deepEqual(remaining, []);
  console.log('OBSERVED cross-session dedup: four durable rows, two live rows, zero history rows retained; yesterday pair incorrectly hidden.');

  const initial = turn(0);
  const advanced = [...initial, ...turn(1)];
  const fake = state => ({ state, send: async function* () { for (const event of turn(2)) { state = { ...state, streamIndex: state.streamIndex + 1 }; this.state = state; yield event; } } });
  const attached = createReattachableEveSession({ createSession: fake, initialSession: { sessionId: 'same-session', streamIndex: 5, continuationToken: 't0' } });
  const store = new EveAgentStore({ initialEvents: initial, session: attached.session, reducer: defaultMessageReducer() });
  const saved = { session: { sessionId: 'same-session', streamIndex: 10, continuationToken: 't1' }, events: advanced };
  attached.adopt(saved.session);
  const now = Date.now();
  const decision = webSessionBindingDecision({ binding: { runtimeSessionId: 'same-session', lastSeenAtMs: now - 2000, latestUserMessageAtMs: now - 1900, latestSequence: 1 }, current: { sessionId: attached.session.state.sessionId, continuationToken: attached.session.state.continuationToken, latestSequence: latestTurnSequence(saved.events) }, nowMs: now, timeZone: 'UTC' });
  assert.equal(decision.kind, 'current');
  await store.send({ message: 'question 2' });
  assert.deepEqual(store.snapshot.data.messages.map(x => x.id), ['turn_0:user', 'turn_0:assistant', 'turn_2:user', 'turn_2:assistant']);
  assert.equal(foldEventsToMessages(mergeSavedSessionEvents(saved, store.snapshot).events).length, 6);
  console.log('OBSERVED stale-tab adoption: installed Eve store shows turns 0 and 2; merged cache correctly has turns 0, 1, 2. Uses fake transport, not mounted ChatClient/browser E2E.');

  const failed = new EveAgentStore({ session: { state: { streamIndex: 0 }, send: async () => { throw new Error('synthetic offline'); } }, reducer: defaultMessageReducer() });
  await failed.send({ message: 'Please keep this message' });
  assert.equal(failed.snapshot.data.messages[0].metadata.status, 'failed');
  assert.equal(failed.snapshot.events.length, 0);
  assert.equal(foldEventsToMessages(failed.snapshot.events).length, 0);
  console.log('OBSERVED failed-send loss: visible failed optimistic message is absent from persisted raw events and disappears on replay.');

  const many = [turn(0)[0], turn(0)[1], ...Array.from({ length: 2100 }, (_, i) => ({ type: 'message.appended', data: { turnId: 'turn_0', stepIndex: 0, messageSoFar: 'a'.repeat(i + 1) } })), ...turn(0).slice(2)];
  const clipped = trimEventsForSave(many);
  assert.equal(clipped.length, 2000);
  assert.equal(clipped[0].type, 'message.appended');
  assert.deepEqual(foldEventsToMessages(clipped).map(x => x.role), ['assistant']);
  console.log('OBSERVED oversized-turn cache: 2105 events become 2000 mid-turn events; question omitted, assistant survives. Canonical history can cover this when available.');

  const transcript = buildTranscript({ archived: [{ at: 3000, message: { id: 'later-recovered', role: 'assistant', parts: [] } }], live: [], liveTimes: {}, spoken: [{ at: 2000, message: { id: 'earlier-spoken', role: 'user', parts: [] } }], now: 4000, timeZone: 'UTC' });
  assert.deepEqual(transcript.filter(x => x.kind === 'message').map(x => x.message.id), ['later-recovered', 'earlier-spoken']);
  console.log('OBSERVED recovery/voice ordering: later archived reply precedes earlier spoken turn because archive is always first. Intentional current helper contract, v2 continuity weakness.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
