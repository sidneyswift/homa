/** Homa's persisted cursor also represents a chat with no active Eve session. */
export interface ChatSessionCursor {
  sessionId?: string;
  streamIndex: number;
  /** Legacy Eve credential; handle clients do not issue or send this field. */
  continuationToken?: string;
}
