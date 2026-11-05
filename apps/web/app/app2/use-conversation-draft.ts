"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from "react";

import { readConversationDraftState, writeConversationDraft, queueConversationIntent, clearConversationDeviceAccount } from "./conversation-local-store";
import type { PendingConversationIntent } from "./conversation-outbox";

type Draft = { text: string; revision: string | null; replyToQuestionId: string | null; touched: boolean; error: string | null };
const emptyDraft: Draft = { text: "", revision: null, replyToQuestionId: null, touched: false, error: null };

export function useConversationDraft(account: string | null) {
  // Render only the active account's state, including the render before effects
  // run. An old asynchronous read/write cannot paint another adult's draft.
  const [drafts, updateDrafts] = useState<Record<string, Draft>>({});
  const current = useRef<Record<string, Draft>>({});
  const snapshots = useRef<Record<string, Map<string, Draft>>>({});
  const writes = useRef<Record<string, Promise<void>>>({});
  const activeAccount = useRef(account);
  const previousAccount = useRef(account);
  useLayoutEffect(() => {
    activeAccount.current = account;
    const previous = previousAccount.current;
    previousAccount.current = account;
    if (previous && previous !== account) {
      // Drain writes queued before logout, then erase that account. Clearing
      // first would let a late draft write resurrect private words afterward.
      if (account === null) void (writes.current[previous] ?? Promise.resolve()).catch(() => {}).then(() => clearConversationDeviceAccount(previous)).catch(() => {});
      delete current.current[previous];
      delete snapshots.current[previous];
      updateDrafts(values => { const next = { ...values }; delete next[previous]; return next; });
    }
    return () => { activeAccount.current = null; };
  }, [account]);
  const key = account ?? "anonymous";
  const display = drafts[key] ?? emptyDraft;
  const update = useCallback((owner: string, change: Partial<Draft>) => {
    if (owner !== (activeAccount.current ?? "anonymous")) return;
    const next = { ...(current.current[owner] ?? emptyDraft), ...change };
    current.current[owner] = next;
    if(next.revision) {
      const versions=snapshots.current[owner] ??= new Map();
      versions.set(next.revision,next);
      if(versions.size>64) versions.delete(versions.keys().next().value!);
    }
    updateDrafts(previous => ({ ...previous, [owner]: next }));
  }, []);

  useEffect(() => {
    let active = true;
    if (account) void readConversationDraftState(account).then(value => {
      if (active && !current.current[account]?.touched) update(account, value);
    }).catch(() => {
      if (active) update(account, { error: "This device could not restore your unsent draft." });
    });
    return () => { active = false; };
  }, [account, update]);

  const setDraft = useCallback((value: SetStateAction<string>) => {
    const owner = account ?? "anonymous";
    const previous = current.current[owner] ?? emptyDraft;
    const text = typeof value === "function" ? value(previous.text) : value;
    const revision = crypto.randomUUID();
    update(owner, { text, revision, touched: true });
    if (!account) return;
    writes.current[account] = (writes.current[account] ?? Promise.resolve()).catch(() => {}).then(() =>
      writeConversationDraft(account, text, revision, previous.replyToQuestionId),
    ).then(() => { update(account, { error: null }); }).catch(() => {
      update(account, { error: "This device cannot keep your draft after closing. You can still send it now." });
    });
  }, [account, update]);

  const setReplyToQuestionId = useCallback((replyToQuestionId: string | null) => {
    if(replyToQuestionId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(replyToQuestionId)) throw new Error("Invalid question reply");
    const owner=account ?? "anonymous",previous=current.current[owner] ?? emptyDraft;
    const revision=crypto.randomUUID();
    update(owner,{replyToQuestionId,revision,touched:true});
    if(!account)return;
    writes.current[account]=(writes.current[account] ?? Promise.resolve()).catch(()=>{}).then(()=>
      writeConversationDraft(account,previous.text,revision,replyToQuestionId),
    ).then(()=>{update(account,{error:null});}).catch(()=>{
      update(account,{error:"This device cannot keep your draft after closing. You can still send it now."});
    });
  },[account,update]);
  const clearReplyToQuestion = useCallback(()=>setReplyToQuestionId(null),[setReplyToQuestionId]);

  const queueDraft = useCallback(async (entry: PendingConversationIntent, submittedRevision?: string | null) => {
    if (!account || entry.account !== account || activeAccount.current !== account) throw new Error("Conversation account changed");
    const latest=current.current[account] ?? emptyDraft;
    const submitted=submittedRevision === undefined || latest.revision===submittedRevision ? latest
      : submittedRevision ? snapshots.current[account]?.get(submittedRevision) : undefined;
    if (!submitted || submitted.text !== entry.text || (entry.replyToQuestionId !== undefined && entry.replyToQuestionId !== submitted.replyToQuestionId)) {
      throw new Error("Conversation draft changed");
    }
    const queued={...entry,...(submitted.replyToQuestionId ? {replyToQuestionId:submitted.replyToQuestionId}:{})};
    // Finish earlier draft writes before consuming this revision. Newer writes
    // may proceed, but their different revision prevents accidental clearing.
    await (writes.current[account] ?? Promise.resolve());
    if (activeAccount.current !== account) throw new Error("Conversation account changed");
    await queueConversationIntent(queued, submitted.revision);
    if (current.current[account]?.revision === submitted.revision) {
      update(account, { text: "", revision: crypto.randomUUID(), replyToQuestionId: null, touched: true, error: null });
    }
  }, [account, update]);

  return { draft: display.text, draftRevision: display.revision, replyToQuestionId: display.replyToQuestionId,
    setDraft, setReplyToQuestionId, clearReplyToQuestion, draftError: display.error, queueDraft };
}
