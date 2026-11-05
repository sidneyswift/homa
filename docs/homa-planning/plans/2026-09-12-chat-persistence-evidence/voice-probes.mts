import { LiveVoiceConversation } from '/Users/sidneyswift/Documents/Projects/Sidney/homa/.claude/worktrees/homa-audit-cleanup-424b11/packages/core/src/live-voice.ts';
import assert from 'node:assert/strict';
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
function fixture() {
  let id = 0;
  const saved: any[] = [];
  const attempts: any[] = [];
  const captions = new Map<number, any>();
  const errors: string[] = [];
  const session = new LiveVoiceConversation('synthetic-audit', {
    send: () => {}, onWorking: () => {}, onEffects: () => {},
    onCaption: row => captions.set(row.sequence, row), onError: e => errors.push(e),
    fetch: async (path, init) => {
      const body = JSON.parse(String(init?.body)); attempts.push(body);
      if (!path.endsWith('/turn')) return Response.json({output:{ok:true,spokenReply:'Done',effects:[]}});
      if (body.content.trim().length > 8000) return Response.json({ok:false,reason:'bad-turn'},{status:400});
      saved.push(body); return Response.json({ok:true});
    },
  });
  const fragment = (role: 'input'|'output', delta: string, start_ms: number, end_ms: number) => session.receive({type:`session.${role}_transcript.delta`,event_id:`e${id++}`,delta,start_ms,end_ms});
  return { session, fragment, saved, attempts, captions, errors };
}
{
 const f=fixture();
 for(let i=0;i<5;i++){f.fragment('input',`Parent ${i}.`,i*5000,i*5000+500);f.fragment('output',`Reply ${i}.`,i*5000+1000,i*5000+1500);}
 await tick(); assert.equal(f.captions.size,10); assert.equal(f.saved.length,0);
 console.log('casual_exchange',JSON.stringify({visibleRows:f.captions.size,savedBeforeStop:f.saved.length}));
 await f.session.finish(); assert.equal(f.saved.length,10);
 console.log('after_stop',JSON.stringify({savedRows:f.saved.length}));
}
{
 const f=fixture();f.fragment('input','Please save',0,500);
 const result = await f.session.finish();f.fragment('input',' my notes.',500,1000);
 assert.equal(result,true);assert.equal(f.saved[0].content,'Please save');assert.equal(f.captions.get(0).text,'Please save');
 console.log('late_caption_after_stop',JSON.stringify({reportsSaved:result,savedText:f.saved[0].content,lateSuffixIgnored:true}));
}
{
 const f=fixture();f.fragment('input','a'.repeat(8001),0,1000);f.fragment('output','I hear you.',2000,2500);
 const result=await f.session.finish();const before=f.attempts.length;const retried=await f.session.retrySave();
 assert.equal(result,false);assert.equal(retried,false);assert.equal(f.saved.length,0);assert.equal(f.attempts.length-before,2);
 console.log('oversized_caption',JSON.stringify({firstSaveOk:result,retryOk:retried,savedRows:f.saved.length,attempts:f.attempts.length,allAttemptsSameFirstRow:f.attempts.every(x=>x.sequence===0)}));
}
{
 const f=fixture();f.fragment('output','Reply delivered first',3000,4000);f.fragment('input','Earlier parent words',1000,2000);
 await f.session.finish();assert.deepEqual(f.saved.map(x=>x.role),['assistant','user']);
 console.log('cross_speaker_delivery_order',JSON.stringify(f.saved.map(x=>({role:x.role,sequence:x.sequence,content:x.content}))));
}
