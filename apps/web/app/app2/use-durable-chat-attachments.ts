"use client";

import { useCallback,useEffect,useLayoutEffect,useRef,useState } from "react";

import type { StagedAttachment } from "../app/chat-attachments";
import { readStagedConversationFiles,removeStagedConversationFile,stageConversationFiles } from "./conversation-file-staging";

export function useDurableChatAttachments(account:string|null){
  const current=useRef(account);
  useLayoutEffect(()=>{current.current=account;},[account]);
  const [view,setView]=useState<{account:string|null;staged:StagedAttachment[]}>({account:null,staged:[]});
  const [pending,setPending]=useState(0),[error,setError]=useState<string|null>(null);
  const urls=useRef<string[]>([]);
  const refresh=useCallback(async()=>{
    if(!account)return;
    try{
      const rows=await readStagedConversationFiles(account);
      if(current.current!==account)return;
      urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];
      const staged=rows.map(row=>{
        const previewUrl=row.mediaType.startsWith("image/") ? URL.createObjectURL(row.bytes):null;
        if(previewUrl)urls.current.push(previewUrl);
        return {localId:row.id,name:row.name,mediaType:row.mediaType,previewUrl,status:"ready" as const,blobUrl:row.blobUrl ?? null};
      });setView({account,staged});
    }catch{if(current.current===account)setError("This device couldn’t restore your files. Try again.");}
  },[account]);
  useEffect(()=>{
    void refresh();const update=()=>void refresh();window.addEventListener("homa-attachment-staging",update);
    return()=>{window.removeEventListener("homa-attachment-staging",update);urls.current.forEach(url=>URL.revokeObjectURL(url));urls.current=[];};
  },[refresh]);
  const addFiles=useCallback((files:readonly File[])=>{
    if(!account)return;setPending(value=>value+1);setError(null);
    void stageConversationFiles(account,files).catch(()=>{
      if(current.current===account)setError("These files couldn’t be kept on this device. Please choose them again.");
    }).finally(()=>setPending(value=>value-1));
  },[account]);
  const remove=useCallback((id:string)=>{
    if(account)void removeStagedConversationFile(account,id).catch(()=>{
      if(current.current===account)setError("This file couldn’t be removed. Try again.");
    });
  },[account]);
  const clear=useCallback(()=>{void refresh();},[refresh]);
  const staged=view.account===account ? view.staged:[];
  return {staged,addFiles,remove,clear,anyUploading:pending>0,readyCount:staged.length,error};
}
