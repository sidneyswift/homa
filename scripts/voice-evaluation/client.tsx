import React from 'react';
import {createRoot} from 'react-dom/client';
import {VoiceMode} from './app/app/voice-mode';

const token=location.pathname.slice(1);
const originalFetch=window.fetch.bind(window);
window.fetch=(input,init)=>originalFetch(input,{...init,headers:{...init?.headers,'x-evaluation-token':token}});
const post=async(path:string,body:unknown)=>{const response=await fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw Error(`Lab request failed: ${path}`);return response.json();};
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
let active=false;
let lastOutput=0;
let lastInputEnd=0;
let awaitingOutput=false;
let resultCount=0;
let noise=false;
let speechContext:AudioContext|null=null;
let speechTarget:MediaStreamAudioDestinationNode|null=null;
let observed:{captions:{role:string;text:string;sequence:number;at:number}[];responseGapsMs:number[];playbackStarted:boolean;audioSeconds:number;diagnostics:unknown[];harnessError?:string};
const logs=console.info.bind(console);
console.info=(...values)=>{logs(...values);if(values[0]==='Live session diagnostics')observed?.diagnostics.push(JSON.parse(String(values[1])));};
const originalPlay=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=async function(){await originalPlay.call(this);observed.playbackStarted=true;};
const Peer=window.RTCPeerConnection;
window.RTCPeerConnection=class extends Peer {
  constructor(configuration?:RTCConfiguration){super(configuration);this.addEventListener('track',({track,streams})=>{
    if(track.kind!=='audio')return;
    const context=new AudioContext();const source=context.createMediaStreamSource(streams[0]);const analyser=context.createAnalyser();source.connect(analyser);
    const samples=new Float32Array(analyser.fftSize);
    const timer=setInterval(()=>{analyser.getFloatTimeDomainData(samples);if(samples.some(x=>Math.abs(x)>.001))observed.audioSeconds+=.1;},100);
    this.addEventListener('connectionstatechange',()=>{if(this.connectionState==='closed'){clearInterval(timer);void context.close();}});
  });}
};
navigator.mediaDevices.getUserMedia=async()=>{
  speechContext=new AudioContext();await speechContext.resume();speechTarget=speechContext.createMediaStreamDestination();
  const buffer=speechContext.createBuffer(1,speechContext.sampleRate,speechContext.sampleRate);
  const values=buffer.getChannelData(0);for(let i=0;i<values.length;i++)values[i]=noise?(Math.random()*2-1)*.012:0;
  const source=speechContext.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(speechTarget);source.start();
  return speechTarget.stream;
};
async function speak(text:string){
  const response=await fetch('/speech',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});
  if(!response.ok)throw Error('Speech fixture failed');
  const buffer=await speechContext!.decodeAudioData(await response.arrayBuffer());
  const source=speechContext!.createBufferSource();source.buffer=buffer;source.connect(speechTarget!);source.start();
  await new Promise<void>(resolve=>{source.onended=()=>resolve();});lastInputEnd=Date.now();awaitingOutput=true;
}
async function until(check:()=>boolean,ms=35000){const deadline=Date.now()+ms;while(!check()){if(Date.now()>deadline)throw Error('Scenario timed out waiting for voice or backend');await pause(100);}}
function App(){
 const [open,setOpen]=React.useState(false);const [busy,setBusy]=React.useState(false);const [status,setStatus]=React.useState('Choose a synthetic scenario.');
 const [scenario,setScenario]=React.useState('clarification');const [variant,setVariant]=React.useState('current');const [independent,setIndependent]=React.useState(false);const [withNoise,setNoise]=React.useState(false);
 const [captions,setCaptions]=React.useState<Record<string,string>>({});const [report,setReport]=React.useState('');
 const stop=()=>{setOpen(false);active=false;};
 const run=async()=>{
  setBusy(true);setCaptions({});setReport('');noise=withNoise;resultCount=0;lastOutput=0;awaitingOutput=false;
  observed={captions:[],responseGapsMs:[],playbackStarted:false,audioSeconds:0,diagnostics:[]};
  const deadline=setTimeout(()=>stop(),150000);
  try{
   const fixture=await post('/start',{scenario,variant,independent,noise});
   setStatus('Connecting synthetic audio');setOpen(true);await until(()=>active,50000);await pause(5000);
   for(let index=0;index<fixture.utterances.length;index++){
    if(index>0){
      if(fixture.delayMs){await pause(1500);}else{await until(()=>resultCount>=index);await until(()=>Date.now()-lastOutput>2200);}
    }
    let text=fixture.utterances[index];
    if(independent&&index>0){const next=await post('/caller',{captions:observed.captions});text=next.text;}
    setStatus(`Speaking synthetic turn ${index+1}`);await speak(text);
   }
   if(scenario==='unauthorized')await pause(10000);
   else await until(()=>resultCount>=(scenario==='completion'?1:fixture.utterances.length),55000);
   await pause(14000);
   if(!observed.playbackStarted||observed.audioSeconds===0)throw Error('No browser audio playback evidence');
  }catch(error){observed.harnessError=error instanceof Error?error.message:String(error);}
  finally{
   clearTimeout(deadline);stop();setStatus('Closing call and grading');await pause(6500);
   await speechContext?.close();speechContext=null;speechTarget=null;
   try{const result=await post('/report',observed);setReport(JSON.stringify(result,null,2));setStatus(observed.harnessError??'Scenario complete');}
   catch(error){setStatus(`Report failed: ${error}`);}
   setBusy(false);
  }
 };
 return <main style={{fontFamily:'system-ui',padding:24,maxWidth:900,margin:'auto'}}>
 <h1>Homa voice evaluation</h1><p>Synthetic speech, actual Live connection, disposable backend. No microphone recording or family writes. Browser playback is measured; physical listening remains unverified.</p>
 <label>Scenario <select disabled={busy} value={scenario} onChange={e=>setScenario(e.target.value)}>{['clarification','correction','cancellation','completion','failure','unauthorized'].map(value=><option key={value}>{value}</option>)}</select></label>{' '}
 <label>Instructions <select disabled={busy} value={variant} onChange={e=>setVariant(e.target.value)}><option>current</option><option>concise</option></select></label>
 <p><label><input type="checkbox" disabled={busy} checked={independent} onChange={e=>setIndependent(e.target.checked)}/>Independent caller answers</label>{' '}
 <label><input type="checkbox" disabled={busy} checked={withNoise} onChange={e=>setNoise(e.target.checked)}/>Synthetic background noise</label></p>
 <button disabled={busy} onClick={()=>void run()}>Run scenario</button><p role="status">{status}</p>
 {Object.entries(captions).map(([id,text])=><p key={id}>{text}</p>)}
 {open&&<VoiceMode onTurn={line=>{
   const at=Date.now();const existing=observed.captions.find(row=>row.sequence===line.sequence&&row.role===line.role);
   if(existing){existing.text=line.text;existing.at=at;}else observed.captions.push({role:line.role,text:line.text,sequence:line.sequence,at});
   if(line.role==='assistant'){lastOutput=at;if(awaitingOutput){observed.responseGapsMs.push(at-lastInputEnd);awaitingOutput=false;}}
   setCaptions(current=>({...current,[line.sessionId+line.sequence]:line.role+': '+line.text}));
 }} onClose={stop} onWorking={()=>{}} onEffects={()=>{resultCount++;}} onNotice={message=>setStatus(message)} onActiveChange={value=>{active=value;}} onAnnouncementChange={()=>{}}/>}
 <pre>{report}</pre>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
