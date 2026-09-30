import assert from 'node:assert/strict';
import test from 'node:test';
import { createSendFn } from '../apps/web/node_modules/eve/dist/src/channel/send.js';
import { eveChannel } from '../apps/web/node_modules/eve/dist/src/public/channels/eve.js';

test('explicit new session skips resume; existing continuations and flag-off retain it', async () => {
 const original=process.env.HOMA_DIRECT_CREATE;
 try {
  let deliveries=0, runs=0;
  const runtime={deliver:async()=>{deliveries++;return {sessionId:'existing'};},run:async()=>{runs++;return {sessionId:'new'};}};
  const send=createSendFn(runtime,{},'eve');
  process.env.HOMA_DIRECT_CREATE='true';
  await send('hello',{auth:{},continuationToken:'fresh',homaCreateNew:true});
  assert.deepEqual({deliveries,runs},{deliveries:0,runs:1});
  await send('again',{auth:{},continuationToken:'existing'});
  assert.deepEqual({deliveries,runs},{deliveries:1,runs:1});
  process.env.HOMA_DIRECT_CREATE='false';
  await send('hello',{auth:{},continuationToken:'fresh',homaCreateNew:true});
  assert.deepEqual({deliveries,runs},{deliveries:2,runs:1});
 } finally {if(original===undefined)delete process.env.HOMA_DIRECT_CREATE;else process.env.HOMA_DIRECT_CREATE=original;}
});

test('only create route sets server-owned new-session option', async () => {
 const channel=eveChannel({auth:async()=>({})});
 const create=channel.routes.find(r=>r.method==='POST'&&r.path==='/eve/v1/session');
 let options;
 const response=await create.handler(new Request('https://example.test/eve/v1/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'hi'})}),{send:async(_input,o)=>{options=o;return {id:'new',continuationToken:o.continuationToken};}});
 assert.equal(response.status,202);assert.equal(options.homaCreateNew,true);
});
