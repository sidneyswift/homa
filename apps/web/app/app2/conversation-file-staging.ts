import { upload } from "@vercel/blob/client";

import { prepareChildPhotoForUpload } from "../../lib/child-photo-prepare";
import { openConversationDeviceDatabase,conversationDeviceAccountGeneration } from "./conversation-local-store";
import { sameConversationIntentContent, type PendingConversationIntent } from "./conversation-outbox";

export interface StagedConversationFile {
  account: string; id: string; name: string; mediaType: string; bytes: Blob;
  visible: boolean; submittedIntentId?: string; createdAt: number;
  blobUrl?: string; uploadedMediaType?: string; receiptId?: string;
}
const changed = () => { if(typeof window !== "undefined") window.dispatchEvent(new Event("homa-attachment-staging")); };

/** Explicitly selected files are device drafts until Send. No upload occurs here. */
export async function stageConversationFiles(account: string, files: readonly File[]): Promise<string[]> {
  if(!account || !files.length || files.length > 6) throw new Error("Choose up to six files");
  const generation=conversationDeviceAccountGeneration(account);
  const rows=files.map(file=>({account,id:crypto.randomUUID(),name:(file.name || "file").slice(0,120),
    mediaType:file.type || "application/octet-stream",bytes:file,visible:true,createdAt:Date.now()}));
  const db=await openConversationDeviceDatabase();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction("attachments","readwrite");const store=tx.objectStore("attachments");
    const existing=store.index("account").getAll(account);
    existing.onsuccess=()=>{
      if(generation!==conversationDeviceAccountGeneration(account)){tx.abort();return;}
      if(existing.result.filter((row:StagedConversationFile)=>row.visible).length+rows.length>6){tx.abort();return;}
      rows.forEach(row=>store.add(row));
    };
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(new Error("Files could not be kept on this device"));
  });
  changed();return rows.map(row=>row.id);
}

export async function readStagedConversationFiles(account: string, visibleOnly=true): Promise<StagedConversationFile[]> {
  const db=await openConversationDeviceDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("attachments","readonly");const read=tx.objectStore("attachments").index("account").getAll(account);
    tx.oncomplete=()=>resolve(read.result.filter((row:StagedConversationFile)=>!visibleOnly || row.visible));
    tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(new Error("Files could not be restored"));
  });
}

/** UI removal never discards the file of an already submitted pending message. */
export async function removeStagedConversationFile(account:string,id:string):Promise<void>{
  const db=await openConversationDeviceDatabase();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction("attachments","readwrite"),store=tx.objectStore("attachments"),read=store.get([account,id]);
    read.onsuccess=()=>{if(read.result && !read.result.submittedIntentId)store.delete([account,id]);};
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(new Error("File could not be removed"));
  });changed();
}

async function updateStagedFile(entry:PendingConversationIntent,id:string,values:Partial<StagedConversationFile>):Promise<StagedConversationFile>{
  const db=await openConversationDeviceDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("attachments","readwrite"),store=tx.objectStore("attachments"),read=store.get([entry.account,id]);
    let result:StagedConversationFile;
    read.onsuccess=()=>{
      if(!read.result || read.result.submittedIntentId!==entry.intentId){tx.abort();return;}
      // Two tabs may finish upload together. The first recorded URL/receipt wins.
      result={...read.result,...(!read.result.blobUrl && values.blobUrl ? {blobUrl:values.blobUrl,uploadedMediaType:values.uploadedMediaType}:{}),
        ...(!read.result.receiptId && values.receiptId ? {receiptId:values.receiptId}:{})};store.put(result);
    };
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(new Error("File ownership changed"));
  });
}

/** Before the FIRST admission POST, atomically freeze file receipts. Every retry
 * thereafter uses these exact IDs, including tabs that prepared concurrently. */
export async function finalizeStagedConversationIntent(entry:PendingConversationIntent,attachmentIds:string[]):Promise<PendingConversationIntent>{
  const db=await openConversationDeviceDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(["outbox","attachments"],"readwrite"),store=tx.objectStore("outbox"),read=store.get([entry.account,entry.intentId]);
    let result:PendingConversationIntent;
    read.onsuccess=()=>{
      const existing=read.result as PendingConversationIntent|undefined;
      if(!existing || !sameConversationIntentContent({...existing,attachmentIds:[]},{...entry,attachmentIds:[]}) ||
        existing.accessEpoch!==entry.accessEpoch || existing.submittedAt!==entry.submittedAt){tx.abort();return;}
      if(existing.attachmentIds?.length){result=existing;return;}
      const ids=entry.stagedAttachmentIds ?? [];
      if(ids.length!==attachmentIds.length || !ids.length){tx.abort();return;}
      let remaining=ids.length;
      ids.forEach((id,index)=>{
        const file=tx.objectStore("attachments").get([entry.account,id]);
        file.onsuccess=()=>{
          if(file.result?.submittedIntentId!==entry.intentId || file.result.receiptId!==attachmentIds[index]){tx.abort();return;}
          if(--remaining===0){result={...existing,attachmentIds};store.put(result);}
        };
      });
    };
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(new Error("Submitted files changed"));
  });
}

export interface ConversationFilePreparationDependencies {
  upload:typeof upload;
  fetch:typeof fetch;
  image:typeof prepareChildPhotoForUpload;
}
const defaults:ConversationFilePreparationDependencies={upload,fetch:(...args)=>fetch(...args),image:prepareChildPhotoForUpload};

/** Only the authenticated outbox invokes this. Drafts never upload on login.
 * Explicit attachment audio is a parent-selected file, not voice-session audio. */
export async function prepareStagedConversationIntent(entry:PendingConversationIntent,token:string,signal:AbortSignal,
  dependencies:ConversationFilePreparationDependencies=defaults):Promise<PendingConversationIntent>{
  if(entry.attachmentIds?.length || !entry.stagedAttachmentIds?.length)return entry;
  const familyId=entry.account.split(":")[0];
  if(!/^[a-f0-9-]{36}$/iu.test(familyId) || !token)throw new Error("File sign-in changed");
  const files=await readStagedConversationFiles(entry.account,false),receiptIds:string[]=[];
  for(const id of entry.stagedAttachmentIds){
    signal.throwIfAborted();
    let file=files.find(item=>item.id===id && item.submittedIntentId===entry.intentId);
    if(!file)throw new Error("Submitted file missing");
    if(!file.blobUrl){
      let bytes:Blob=file.bytes,mediaType=file.mediaType;
      if(mediaType.startsWith("image/")){
        const image=await dependencies.image(new File([bytes],file.name,{type:mediaType}));
        if(image){bytes=image;mediaType="image/jpeg";}
      }
      signal.throwIfAborted();
      const name=file.name.replace(/[^\w.-]+/gu,"-").slice(-80)||"file";
      const uploaded=await dependencies.upload(`families/${familyId}/chat/${id}-${name}`,bytes,{
        access:"private",handleUploadUrl:"/api/chat/upload",headers:{authorization:`Bearer ${token}`},
        clientPayload:mediaType,contentType:mediaType,abortSignal:signal,
      });
      signal.throwIfAborted();
      file=await updateStagedFile(entry,id,{blobUrl:uploaded.url,uploadedMediaType:mediaType});
    }
    if(!file.receiptId){
      const response=await dependencies.fetch("/api/chat/attachments",{method:"POST",credentials:"omit",cache:"no-store",redirect:"error",
        headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},signal,
        body:JSON.stringify({items:[{url:file.blobUrl,name:file.name,mediaType:file.uploadedMediaType ?? file.mediaType}]})});
      if(!response.ok)throw new Error("File preparation interrupted");
      const body=await response.json(),receiptId=body?.receipts?.[0]?.id;
      if(!body.ok || body.receipts.length!==1 || typeof receiptId!=="string" || !/^[a-f0-9-]{36}$/iu.test(receiptId))throw new Error("Invalid file receipt");
      signal.throwIfAborted();file=await updateStagedFile(entry,id,{receiptId});
    }
    receiptIds.push(file.receiptId!);
  }
  signal.throwIfAborted();return finalizeStagedConversationIntent(entry,receiptIds);
}
