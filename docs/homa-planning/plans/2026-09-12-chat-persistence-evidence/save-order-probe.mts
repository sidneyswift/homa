import assert from 'node:assert/strict';
import { persistConversationMessage } from '/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11/apps/web/lib/conversation-log.ts';
let release!: (value: null) => void;
const embedding = new Promise<null>(resolve => { release = resolve; });
const calls: string[] = [];
const save = persistConversationMessage({ attributes: {familyId:'synthetic-family',memberUserId:'synthetic-adult',episodeId:'synthetic-episode'}, sessionId:'synthetic-session',channelKind:'web',sequence:0,role:'user',content:'Synthetic persistence probe.',turnId:'turn_0' }, {
 resolveInbound: async () => { throw new Error('Not expected with supplied episode'); },
 embed: async () => { calls.push('embedding-start'); return embedding; },
 persistCanonical: async input => { calls.push('canonical-write'); return {id:'synthetic-message',episodeId:'synthetic-episode',replyClaimed:false,content:input.content}; },
 saveEmbedding: async () => { calls.push('embedding-save'); },
});
await new Promise(resolve => setTimeout(resolve,20));
assert.deepEqual(calls,['embedding-start']);
console.log('While embedding is pending, canonical writes:', calls.filter(c=>c==='canonical-write').length);
release(null); await save;
assert.deepEqual(calls,['embedding-start','canonical-write']);
console.log('After embedding resolves null, canonical writes:', calls.filter(c=>c==='canonical-write').length);
