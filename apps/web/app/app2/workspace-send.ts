import type { UserContent } from "ai";

import type { PreparedAttachmentSend, StagedAttachment } from "../app/chat-attachments";
import { prepareAttachmentChatTurn } from "../app/chat-send-policy";

export interface WorkspaceAttachmentCache {
  current: { key: string; value: PreparedAttachmentSend } | null;
}

/** Release the composer before the response finishes, retaining a rejected draft. */
export async function submitWorkspaceDraft(input: {
  text: string;
  setDraft: (value: string | ((current: string) => string)) => void;
  send: () => Promise<boolean>;
}): Promise<boolean> {
  input.setDraft("");
  let accepted = false;
  try {
    accepted = await input.send();
    return accepted;
  } finally {
    if (!accepted) input.setDraft(current => current || input.text);
  }
}

export function workspaceSendFailure(accepted: boolean) {
  return accepted
    ? "Your message reached Homa, but the reply was interrupted. Check the main conversation before sending it again."
    : "That did not send. Your text and files are still here. Try again.";
}

/** Preserve every model part and distinguish rejected sends from lost replies. */
export async function sendWorkspaceMessage(input: {
  text: string;
  staged: readonly StagedAttachment[];
  cache: WorkspaceAttachmentCache;
  prepare: (files: readonly StagedAttachment[]) => Promise<PreparedAttachmentSend>;
  dispatch: (message: UserContent) => Promise<void>;
  isAccepted: () => boolean;
}): Promise<{ accepted: boolean; error?: string }> {
  if (input.staged.some(file => file.status !== "ready")) {
    return { accepted: false, error: "Wait for uploads to finish, or remove any file that did not attach." };
  }
  if (input.staged.length > 6) {
    return { accepted: false, error: "You can send up to six attachments at once." };
  }
  try {
    const key = input.staged.map(file => file.localId).join(":");
    if (input.staged.length && input.cache.current?.key !== key) {
      input.cache.current = { key, value: await input.prepare(input.staged) };
    }
    const files = input.staged.length ? input.cache.current?.value : undefined;
    const turn = prepareAttachmentChatTurn({ text: input.text, attachmentBlocks: files?.textBlocks ?? [], draftFromVoice: false });
    await input.dispatch([{ type: "text", text: turn.text }, ...(files?.parts ?? [])]);
    return { accepted: input.isAccepted() };
  } catch {
    const accepted = input.isAccepted();
    return { accepted, error: workspaceSendFailure(accepted) };
  }
}
