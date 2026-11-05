import assert from 'node:assert/strict';
import { fetchChatHistory } from '/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11/apps/web/lib/chat-history.ts';
import { persistConversationMessage } from '/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11/apps/web/lib/conversation-log.ts';
import { parseAttachmentMarkers, composeFileMarker } from '/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11/apps/web/lib/attachments/markers.ts';
import { prepareAttachmentChatTurn } from '/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11/apps/web/app/app/chat-send-policy.ts';

const row = {id:'msg',session_id:'voice-v1:example',turn_id:'voice_1',role:'assistant',channel:'web',content:'Here is your worksheet.',created_at:'2026-09-12T14:00:00.000Z'};
const material = {id:'worksheet',title:'Worksheet',kind:'worksheet',skill:null,preview_url:'https://example.test/preview.png',pdf_url:'https://example.test/worksheet.pdf',created_at:'2026-09-12T14:00:00.000Z',session_id:'bridge-session',child_name:null,status:'final',revises:null,review_pass:'true'};
function fake(materials: typeof material[], error: boolean = false) {
  const calls: unknown[]=[];
  return { calls, from(table: string) {
    let limit = Infinity;
    const chain = {
      select(...args: unknown[]) { calls.push([table,'select',args]); return chain; },
      eq(...args: unknown[]) { calls.push([table,'eq',args]); return chain; },
      order(...args: unknown[]) { calls.push([table,'order',args]); return chain; },
      limit(n: number) { limit=n; calls.push([table,'limit',n]); return chain; },
      then(resolve: (x:unknown)=>void) {
        const data=table==='conversation_messages'?[row]:table==='materials'?materials:[];
        return Promise.resolve({data:data.slice(0,limit),error:table==='materials' && error?{message:'synthetic material read failure'}:null}).then(resolve);
      }
    }; return chain;
  }};
}
const read=async (db:ReturnType<typeof fake>)=>fetchChatHistory({familyId:'family',userId:'adult',supabase:db as never});
const error = await read(fake([],true));
assert.equal(error,null);
console.log('PASS material-read failure suppresses otherwise valid text history.');
const bridge = await read(fake([material]));
assert.equal(bridge?.messages.length,1); assert.equal(bridge?.materials.length,0);
const control = await read(fake([{...material,session_id:row.session_id}]));
assert.equal(control?.materials.length,1);
console.log('PASS material in bridge session is excluded; matching canonical session control included.');
const eighty = Array.from({length:80},(_,i)=>({...material,id:`other-${i}`}));
const cap = await read(fake([...eighty,{...material,session_id:row.session_id}]));
assert.equal(cap?.materials.length,0);
console.log('PASS 80 unrelated newer materials crowd out a matching older material.');
const marker1=composeFileMarker({name:'one.docx',url:'https://example.test/one.docx'});
const marker2=composeFileMarker({name:'two.docx',url:'https://example.test/two.docx'});
const turn=prepareAttachmentChatTurn({text:'Please compare these documents.',draftFromVoice:false,attachmentBlocks:[`[Attached Word document, text extracted]\n${'a'.repeat(4000)}`,`[Attached Word document, text extracted]\n${'b'.repeat(4000)}`,marker1,marker2]});
assert.equal(parseAttachmentMarkers(turn.text).markers.length,2);
let stored='';
await persistConversationMessage({attributes:{familyId:'family',memberUserId:'adult',episodeId:'episode'},sessionId:'session',channelKind:'web',sequence:0,role:'user',content:turn.text,turnId:'turn_0'},{resolveInbound:async()=>{throw Error('Unexpected continuity call')},persistCanonical:async input=>{stored=input.content;return {id:'id',episodeId:'episode',replyClaimed:false,content:stored}},embed:async()=>null,saveEmbedding:async()=>{}});
assert.equal(stored.length,8000); assert.equal(parseAttachmentMarkers(stored).markers.length,0);
console.log('PASS two 4000-character document extractions cause canonical truncation to discard both attachment markers.');
