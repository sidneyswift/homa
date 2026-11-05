"use client";

import { useEveAgent } from "eve/react";
import { useRef, useState } from "react";

import { createSupabaseBrowserClient } from "../../lib/supabase/client";
import { prepareAttachmentsForSend, type ChatAttachmentReceipt, type StagedAttachment } from "../app/chat-attachments";
import { chatSendHeaders } from "../app/chat-send-policy";
import type { VoiceTranscriptLine } from "../app/voice-transcript";
import { sendWorkspaceMessage, workspaceSendFailure, type WorkspaceAttachmentCache } from "./workspace-send";

/** The same authenticated multipart transport as chat, independent of mic access. */
export function useWorkspaceChat() {
  const [supabase] = useState(createSupabaseBrowserClient);
  const [preparing, setPreparing] = useState(false);
  const [waitingForReply, setWaitingForReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const accepted = useRef(false);
  const [messageTimes, setMessageTimes] = useState<Record<string, number>>({});
  const pendingReceipts = useRef<ChatAttachmentReceipt[]>([]);
  const [receiptsBySummary, setReceiptsBySummary] = useState<Record<string, ChatAttachmentReceipt[]>>({});
  // Reuse prepared files after a rejected send instead of filing them twice.
  const prepared = useRef<WorkspaceAttachmentCache["current"]>(null);
  const agent = useEveAgent({
    auth: { bearer: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token ?? "";
    } },
    maxReconnectAttempts: 4,
    onEvent(event) {
      if (
        (event.type === "message.appended" && event.data.messageSoFar.trim()) ||
        (event.type === "message.completed" && event.data.message?.trim()) ||
        event.type === "input.requested" || event.type === "authorization.required"
      ) setWaitingForReply(false);
      if (event.type === "message.received" || event.type === "message.appended" || event.type === "message.completed") {
        const key = `${event.data.turnId}:${event.type === "message.received" ? "user" : "assistant"}`;
        const at = Date.now();
        setMessageTimes(current => key in current ? current : { ...current, [key]: at });
      }
      if (event.type === "message.received") {
        accepted.current = true;
        const receipts = pendingReceipts.current;
        if (receipts.length) setReceiptsBySummary(current => ({ ...current, [event.data.message]: receipts }));
      }
    },
    onFinish(snapshot) {
      setWaitingForReply(false);
      if (snapshot.error) setError(workspaceSendFailure(accepted.current));
    },
  });

  async function send(text: string, staged: readonly StagedAttachment[], context: readonly VoiceTranscriptLine[]) {
    if (sending.current || (!text.trim() && staged.length === 0)) return false;
    sending.current = true;
    accepted.current = false;
    setError(null);
    setPreparing(true);
    setWaitingForReply(true);
    try {
      const result = await sendWorkspaceMessage({
        text, staged, cache: prepared,
        prepare: files => prepareAttachmentsForSend(files, null),
        isAccepted: () => accepted.current,
        dispatch: async message => {
          pendingReceipts.current = staged.length ? prepared.current?.value.receipts ?? [] : [];
          setPreparing(false);
          await agent.send({
            message,
            headers: chatSendHeaders("text", "parent"),
            clientContext: context.length ? { recentVoiceConversation: context.slice(-20).map(({ role, text }) => ({ role, text })) } : undefined,
          });
        },
      });
      if (result.error) setError(result.error);
      return result.accepted;
    } finally {
      sending.current = false;
      setPreparing(false);
      setWaitingForReply(false);
    }
  }

  return { send, messageTimes, sessionId: agent.session?.sessionId, receiptsBySummary, messages: agent.data.messages, error, waitingForReply, preparing, busy: preparing || agent.status === "submitted" || agent.status === "streaming" };
}
